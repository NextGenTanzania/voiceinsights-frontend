import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQueueMessage, retryDelaySeconds, sanitizeObject, processQueueBatch } from '../src/cloudflare-queue-platform.js';
import { validateEnvironment } from '../src/environment-validation.js';

function mockDb() {
  const calls=[];
  return { calls, prepare(sql){ return { bind(...args){ return { async first(){ if(sql.includes('SELECT * FROM queue_jobs')) return {job_id:args[0],tenant_id:'org_1',status:'pending',attempts:0}; return null; }, async run(){ calls.push({sql,args}); return {success:true}; }, async all(){ return {results:[]}; } }; }, async first(){return null}, async run(){calls.push({sql,args:[]});return {success:true}} }; } };
}

test('queue message requires tenant and preserves trace metadata',()=>{
  const m=buildQueueMessage({jobType:'report.generation',tenantId:'org_1',correlationId:'corr-1',payload:{token:'secret',report_id:'r1'}});
  assert.equal(m.schema_version,1); assert.equal(m.correlation_id,'corr-1'); assert.equal(m.payload.token,'[redacted]');
  assert.throws(()=>buildQueueMessage({jobType:'report.generation'}),/tenantId/);
});

test('bounded exponential backoff is deterministic with injected random',()=>{
  assert.equal(retryDelaySeconds(1,30,3600,()=>0),22);
  assert.equal(retryDelaySeconds(20,30,3600,()=>1),4500); // capped base plus bounded jitter
  assert.ok(retryDelaySeconds(20,30,3600,()=>1) <= 4500);
});

test('sanitizer redacts nested secrets and bearer credentials',()=>{
  const out=sanitizeObject({authorization:'Bearer abc',nested:{api_key:'xyz'},message:'Bearer token123'});
  assert.equal(out.authorization,'[redacted]'); assert.equal(out.nested.api_key,'[redacted]'); assert.equal(out.message,'Bearer [redacted]');
});

test('production environment fails closed when critical bindings are missing',()=>{
  const result=validateEnvironment({ENVIRONMENT:'production',STRICT_CORS:'false'},'production');
  assert.equal(result.valid,false); assert.ok(result.missing_critical.includes('DB')); assert.ok(result.missing_critical.includes('STRICT_CORS=true'));
});

test('consumer acknowledges a valid persisted job only after its production adapter confirms completion',async()=>{
  const DB=mockDb(); let acked=false;
  const batch={queue:'voiceinsights-operations',messages:[{body:buildQueueMessage({jobId:'job_1',jobType:'notification.delivery',tenantId:'org_1'}),ack(){acked=true},retry(){throw new Error('should not retry')}}]};
  const result=await processQueueBatch(batch,{DB,JOB_ADAPTERS:{'notification.delivery':async()=>({ok:true,provider_status:'accepted'})}});
  assert.equal(acked,true); assert.equal(result[0].status,'completed'); assert.ok(DB.calls.some(c=>c.sql.includes("status='completed'")));
});
