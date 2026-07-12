import { requireAuth, json } from './utils.js';
import { runAIAssurancePipeline } from './ai-assurance-pipeline.js';
import { generatePublicationReadyReport, validateReportExport } from './report-intelligence.js';
import { buildConsultingVisualSuite } from './visual-intelligence.js';

const allowed = new Set(['super_admin','founder','org_admin','me_officer','data_analyst','report_reviewer']);
const approvalRoles = new Set(['super_admin','founder','org_admin','report_reviewer']);
const id = p => `${p}_${crypto.randomUUID()}`;

async function effectiveOrg(request, claims) {
  const requested = request.headers.get('x-organization-id');
  if (requested && ['super_admin','founder'].includes(claims.role)) return requested;
  return claims.organization_id || claims.org_id;
}

async function persistRun(env, orgId, claims, input, result) {
  const runId = id('aar');
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO ai_assurance_runs
    (id,organization_id,report_id,dataset_id,dataset_version,model,prompt_version,temperature,latency_ms,cost,currency,assurance_score,status,publication_status,created_by,created_at,completed_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(runId,orgId,input.report_id,input.dataset?.dataset_id || '',input.dataset?.version || input.dataset?.dataset_version || '',input.governance?.model || '',input.governance?.prompt_version || '',Number(input.governance?.temperature || 0),Number(input.governance?.latency_ms || 0),Number(input.governance?.cost || 0),input.governance?.currency || 'USD',result.assurance_score,result.status,result.publication_gate.status,claims.sub,now,now).run();
  for (const e of input.dataset?.evidence || []) {
    const evidenceId = e.evidence_id || e.id || id('ev');
    await env.DB.prepare(`INSERT OR IGNORE INTO evidence_registry
      (id,organization_id,dataset_id,dataset_version,source_interview_id,question_id,question_text,respondent_group,quote_text,source_type,sample_size,consent_verified,source_verified,checksum,metadata_json,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(evidenceId,orgId,input.dataset?.dataset_id || e.dataset_id || '',input.dataset?.version || e.dataset_version || '',e.source_interview_id || e.interview_id || '',e.question_id || '',e.question_text || '',e.respondent_group || '',e.quote || e.raw_text || '',e.source_type || 'interview',Number(e.sample_size || 0),e.consent_verified ? 1 : 0,e.source_verified ? 1 : 0,e.checksum || '',JSON.stringify(e.metadata || {}),now).run();
  }
  for (const claim of [...result.claims, ...result.recommendations]) {
    const claimId = claim.claim_id || id('clm');
    await env.DB.prepare(`INSERT INTO report_claims_assurance
      (id,organization_id,report_id,assurance_run_id,claim_type,claim_text,citation_ids_json,confidence_score,verification_status,hallucination_flags_json,contradiction_flags_json,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(claimId,orgId,input.report_id,runId,claim.claim_type,claim.claim,JSON.stringify(claim.citation_ids),claim.confidence.score,claim.verification_status,JSON.stringify(claim.hallucination.flags),JSON.stringify(claim.hallucination.flags.contradictions || []),now).run();
    for (const e of claim.evidence) await env.DB.prepare('INSERT OR IGNORE INTO report_claim_evidence(claim_id,evidence_id,relationship,created_at) VALUES(?,?,?,?)').bind(claimId,e.evidence_id,'supports',now).run();
  }
  await env.DB.prepare('INSERT INTO publication_gate_events(id,organization_id,report_id,assurance_run_id,gate_status,publication_allowed,blocking_reasons_json,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(id('pge'),orgId,input.report_id,runId,result.publication_gate.status,result.publication_gate.publication_allowed ? 1 : 0,JSON.stringify(result.publication_gate.blocking_reasons),claims.sub,now).run();
  return runId;
}

export async function handleAIAssuranceRoute(request, env) {
  const url = new URL(request.url); const path = url.pathname; const method = request.method;
  if (!path.startsWith('/api/ai-assurance') && !path.startsWith('/api/reports/v215')) return null;
  const claims = await requireAuth(request, env);
  if (!allowed.has(claims.role)) return json({error:'AI assurance permission required'},403);
  const orgId = await effectiveOrg(request, claims);
  if (!orgId) return json({error:'Organization context required'},400);

  if (path === '/api/ai-assurance/verify' && method === 'POST') {
    const body = await request.json().catch(()=>null); if (!body?.report_id) return json({error:'report_id is required'},400);
    const result = runAIAssurancePipeline(body); const runId = await persistRun(env,orgId,claims,body,result);
    return json({...result,run_id:runId}, result.publication_gate.publication_allowed ? 200 : 422, {'Cache-Control':'no-store'});
  }
  if (path === '/api/reports/generate' && method === 'POST') {
    const body = await request.json().catch(()=>null); if (!body?.report_id || !body?.report_type) return json({error:'report_id and report_type are required'},400);
    const report = generatePublicationReadyReport(body); const runId = await persistRun(env,orgId,claims,body,report.assurance);
    return json({...report,assurance_run_id:runId},report.publication_ready ? 200 : 422,{'Cache-Control':'no-store'});
  }
  if (path === '/api/reports/visuals' && method === 'POST') {
    const body = await request.json().catch(()=>({})); return json(buildConsultingVisualSuite(body),200,{'Cache-Control':'no-store'});
  }
  const exportMatch = path.match(/^\/api\/reports\/v215\/([^/]+)\/export-check$/);
  if (exportMatch && method === 'POST') {
    const body = await request.json().catch(()=>({})); return json(validateReportExport(body.report || {},body.format || 'pdf'),200,{'Cache-Control':'no-store'});
  }
  const approvalMatch = path.match(/^\/api\/ai-assurance\/runs\/([^/]+)\/approval$/);
  if (approvalMatch && method === 'POST') {
    if (!approvalRoles.has(claims.role)) return json({error:'Reviewer permission required'},403);
    const body = await request.json().catch(()=>({})); if (!['APPROVED','REJECTED','CHANGES_REQUIRED'].includes(body.decision)) return json({error:'Invalid decision'},400);
    const run = await env.DB.prepare('SELECT * FROM ai_assurance_runs WHERE id=? AND organization_id=?').bind(approvalMatch[1],orgId).first();
    if (!run) return json({error:'Assurance run not found'},404);
    const now=new Date().toISOString(), approvalId=id('app');
    await env.DB.prepare('INSERT INTO ai_human_approvals(id,organization_id,report_id,assurance_run_id,reviewer_id,decision,reason,approved_at) VALUES(?,?,?,?,?,?,?,?)').bind(approvalId,orgId,run.report_id,run.id,claims.sub,body.decision,String(body.reason||''),now).run();
    const publicationAllowed = body.decision === 'APPROVED' && run.status === 'ASSURANCE_COMPLETE';
    await env.DB.prepare('UPDATE ai_assurance_runs SET publication_status=? WHERE id=?').bind(publicationAllowed?'PASS':'BLOCKED',run.id).run();
    await env.DB.prepare('INSERT INTO publication_gate_events(id,organization_id,report_id,assurance_run_id,gate_status,publication_allowed,blocking_reasons_json,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id('pge'),orgId,run.report_id,run.id,publicationAllowed?'PASS':'BLOCKED',publicationAllowed?1:0,JSON.stringify(publicationAllowed?[]:[`Human review decision: ${body.decision}`]),claims.sub,now).run();
    return json({ok:true,approval_id:approvalId,publication_allowed:publicationAllowed},200);
  }
  const runMatch=path.match(/^\/api\/ai-assurance\/runs\/([^/]+)$/);
  if(runMatch && method==='GET'){
    const run=await env.DB.prepare('SELECT * FROM ai_assurance_runs WHERE id=? AND organization_id=?').bind(runMatch[1],orgId).first(); if(!run)return json({error:'Not found'},404);
    const claimsRows=(await env.DB.prepare('SELECT * FROM report_claims_assurance WHERE assurance_run_id=? AND organization_id=? ORDER BY created_at').bind(run.id,orgId).all()).results||[];
    return json({run,claims:claimsRows.map(x=>({...x,citation_ids:JSON.parse(x.citation_ids_json||'[]'),hallucination_flags:JSON.parse(x.hallucination_flags_json||'{}')}))},200,{'Cache-Control':'no-store'});
  }
  return json({error:'Not found'},404);
}
