import { requireAuth, json, error } from './utils.js';
import { enqueueJob } from './cloudflare-queue-platform.js';
import { validateEnvironment } from './environment-validation.js';

const OPS_ROLES = new Set(['super_admin','founder','founder_executive','operations_manager']);

async function authorize(request, env) {
  const claims = await requireAuth(request, env);
  if (!OPS_ROLES.has(claims.role)) throw { status:403, message:'Platform Operations access required' };
  return claims;
}

async function checkD1(env) {
  const t=Date.now();
  try { await env.DB.prepare('SELECT 1 AS ok').first(); return {status:'operational',latency_ms:Date.now()-t,source:'direct_dependency_check'}; }
  catch { return {status:'unavailable',latency_ms:Date.now()-t,source:'direct_dependency_check'}; }
}
async function checkR2(env) {
  const t=Date.now();
  if (!env.AUDIO_BUCKET?.head) return {status:'not_configured',latency_ms:null,source:'binding_validation'};
  try { await env.AUDIO_BUCKET.head('__voiceinsights_healthcheck__'); return {status:'operational',latency_ms:Date.now()-t,source:'direct_dependency_check'}; }
  catch (e) {
    const msg=String(e?.message||'');
    if (/not found|404/i.test(msg)) return {status:'operational',latency_ms:Date.now()-t,source:'binding_request_completed'};
    return {status:'unavailable',latency_ms:Date.now()-t,source:'direct_dependency_check'};
  }
}

export async function buildReadiness(env) {
  const config=validateEnvironment(env, env.ENVIRONMENT || 'development');
  const [d1,r2]=await Promise.all([checkD1(env),checkR2(env)]);
  let migrations='unknown';
  try { const row=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='queue_jobs'").first(); migrations=row?'current':'missing'; } catch {}
  let heartbeat=null;
  try { heartbeat=await env.DB.prepare("SELECT * FROM queue_consumer_heartbeats ORDER BY last_seen_at DESC LIMIT 1").first(); } catch {}
  const queueBinding=env.OPERATIONS_QUEUE?.send?{status:'operational',source:'binding_validation'}:{status:'not_configured',source:'binding_validation'};
  const critical=[];
  if (!config.valid) critical.push(...config.missing_critical);
  if (d1.status!=='operational') critical.push('D1 unavailable');
  if (r2.status==='unavailable') critical.push('R2 unavailable');
  if (migrations!=='current') critical.push('Release 2 migration missing');
  const status=critical.length?'not_ready':config.warnings.length?'ready_with_warnings':'ready';
  return {release:'Enterprise Release 2',status,environment:config.environment,application_version:env.APP_VERSION||'2.0.0',checked_at:new Date().toISOString(),critical_failures:critical,warnings:config.warnings,checks:{configuration:config,d1,r2,operations_queue:queueBinding,migrations:{status:migrations},consumer_heartbeat:heartbeat?{status:'operational',last_seen_at:heartbeat.last_seen_at}:{status:'insufficient_data',last_seen_at:null}}};
}

export async function handleOperationsRoute(request, env) {
  const url=new URL(request.url); const path=url.pathname; const method=request.method;
  if (!path.startsWith('/api/ops/')) return null;
  try {
    const claims=await authorize(request,env);
    if (path==='/api/ops/readiness'&&method==='GET') return json(await buildReadiness(env));
    if (path==='/api/ops/health'&&method==='GET') {
      const readiness=await buildReadiness(env);
      const rows=await env.DB.prepare("SELECT queue_name,event_name,COUNT(*) count,AVG(duration_ms) avg_duration_ms,MAX(created_at) last_event_at FROM queue_events WHERE created_at>=datetime('now','-24 hours') GROUP BY queue_name,event_name").all();
      return json({status:readiness.status==='not_ready'?'degraded':'operational',checked_at:new Date().toISOString(),evidence_source:'persisted_queue_events_and_dependency_checks',readiness,queue_events:rows.results||[]});
    }
    if (path==='/api/ops/queues'&&method==='GET') {
      const rows=await env.DB.prepare(`SELECT queue_name,
        SUM(status='pending') pending,SUM(status='processing') processing,SUM(status='completed') completed,SUM(status='retrying') retrying,SUM(status='dead_letter') dead_letter,
        MIN(CASE WHEN status IN ('pending','retrying') THEN created_at END) oldest_pending_at,
        AVG(CASE WHEN completed_at IS NOT NULL AND processing_started_at IS NOT NULL THEN (julianday(completed_at)-julianday(processing_started_at))*86400000 END) avg_processing_ms
        FROM queue_jobs GROUP BY queue_name ORDER BY queue_name`).all();
      return json({source:'application_observed_queue_lifecycle',queues:rows.results||[]});
    }
    if (path==='/api/ops/jobs'&&method==='GET') {
      const tenant=url.searchParams.get('tenant_id');
      const limit=Math.min(200,Math.max(1,Number(url.searchParams.get('limit')||50)));
      const q=tenant?env.DB.prepare('SELECT * FROM queue_jobs WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?').bind(tenant,limit):env.DB.prepare('SELECT * FROM queue_jobs ORDER BY created_at DESC LIMIT ?').bind(limit);
      const rows=await q.all(); return json({jobs:rows.results||[]});
    }
    if (path==='/api/ops/dlq'&&method==='GET') {
      const rows=await env.DB.prepare("SELECT id,job_id,queue_name,tenant_id,correlation_id,attempt_count,error_class,error_message,status,replay_count,created_at,updated_at FROM queue_dead_letters ORDER BY created_at DESC LIMIT 200").all();
      return json({dead_letters:rows.results||[]});
    }
    const replay=path.match(/^\/api\/ops\/dlq\/([^/]+)\/replay$/);
    if (replay&&method==='POST') {
      const row=await env.DB.prepare("SELECT * FROM queue_dead_letters WHERE id=? AND status='open'").bind(replay[1]).first();
      if(!row) return error('Eligible DLQ item not found',404);
      if(Number(row.replay_count||0)>=3) return error('Maximum replay count reached',409);
      const payload=JSON.parse(row.payload_json||'{}');
      const result=await enqueueJob(env,{...payload,jobId:undefined,idempotencyKey:`replay:${row.id}:${Number(row.replay_count||0)+1}`,causationId:row.job_id,actorId:claims.sub,attempt:0});
      await env.DB.prepare("UPDATE queue_dead_letters SET replay_count=replay_count+1,last_replayed_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(row.id).run();
      await env.DB.prepare("INSERT INTO queue_replay_history(id,dead_letter_id,original_job_id,new_job_id,actor_id,tenant_id,created_at) VALUES(lower(hex(randomblob(16))),?,?,?,?,?,datetime('now'))").bind(row.id,row.job_id,result.job_id,claims.sub,row.tenant_id).run();
      return json({replayed:true,...result});
    }
    if(path==='/api/ops/enqueue'&&method==='POST') {
      const body=await request.json();
      const tenantId=claims.role==='super_admin'?(body.tenant_id||claims.organization_id):claims.organization_id;
      return json(await enqueueJob(env,{jobType:body.job_type,tenantId,projectId:body.project_id,actorId:claims.sub,correlationId:request.headers.get('x-correlation-id')||crypto.randomUUID(),idempotencyKey:body.idempotency_key,payloadRef:body.payload_ref,payload:body.payload,maxAttempts:body.max_attempts}),202);
    }
    return error('Operations route not found',404);
  } catch(e) { return error(e.message||'Operations request failed',e.status||500); }
}
