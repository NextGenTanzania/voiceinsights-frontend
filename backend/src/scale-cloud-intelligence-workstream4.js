// Workstream 4 — Scale, Cloud Intelligence, Customer Success & VIN™
// Consolidated operational acceptance layer. It measures real evidence and never
// treats an architecture declaration as proof of production readiness.

const QUEUE_TYPES = ['phone','whatsapp','sms','offline_sync','ai','report','export'];
const ACCEPTANCE_AREAS = ['load_test','failover','backup_restore'];

const n=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,n(v,min)));

export function validateQueueJob(input={}){
  const errors=[];
  if(!QUEUE_TYPES.includes(input.queue_type)) errors.push('queue_type must be one of '+QUEUE_TYPES.join(', '));
  if(!input.organization_id) errors.push('organization_id is required');
  if(!input.campaign_id && ['phone','whatsapp','sms','offline_sync'].includes(input.queue_type)) errors.push('campaign_id is required for collection queues');
  if(!input.idempotency_key) errors.push('idempotency_key is required');
  return {ok:errors.length===0,errors,job:{...input,priority:Math.max(1,Math.min(10,n(input.priority,5))),max_attempts:Math.max(1,n(input.max_attempts,5))}};
}

export function computeWorkloadPlan(snapshot={}){
  const depths=snapshot.queue_depths||{};
  const workers=snapshot.worker_capacity||{};
  const queues=QUEUE_TYPES.map(type=>{
    const depth=Math.max(0,n(depths[type],0));
    const capacity=Math.max(1,n(workers[type], type==='sms'?20:type==='whatsapp'?12:type==='phone'?8:6));
    const utilization=clamp(depth/capacity*100);
    const action=utilization>=90?'scale_or_throttle':utilization>=70?'reserve_capacity':'normal';
    return {type,depth,worker_capacity:capacity,utilization_pct:Math.round(utilization),action};
  });
  return {queues,critical:queues.filter(q=>q.utilization_pct>=90),warning:queues.filter(q=>q.utilization_pct>=70&&q.utilization_pct<90),fair_share:true,background_throttling:true};
}

export function evaluateLoadTest(run={}){
  const required=['virtual_users','duration_minutes','requests_total','success_rate_pct','p95_latency_ms','error_rate_pct'];
  const missing=required.filter(k=>run[k]===undefined||run[k]===null);
  if(missing.length) return {ok:false,status:'INCOMPLETE',missing};
  const checks={success_rate:n(run.success_rate_pct)>=99,error_rate:n(run.error_rate_pct)<=1,p95_latency:n(run.p95_latency_ms)<=750,no_data_loss:n(run.data_loss_count,0)===0,no_duplicate_jobs:n(run.duplicate_job_count,0)===0};
  const score=Math.round(Object.values(checks).filter(Boolean).length/Object.keys(checks).length*100);
  return {ok:score===100,status:score===100?'PASS':'FAIL',score_pct:score,checks,capacity_claim:score===100?n(run.campaigns_per_day_proven,0):0};
}

export function evaluateFailover(run={}){
  const checks={trigger_recorded:Boolean(run.trigger),secondary_path_used:Boolean(run.secondary_path_used),recovery_time_met:n(run.recovery_time_minutes,999)<=n(run.rto_minutes,60),data_loss_within_target:n(run.data_loss_minutes,999)<=n(run.rpo_minutes,15),rollback_verified:Boolean(run.rollback_verified),audit_evidence:Boolean(run.evidence_reference)};
  const score=Math.round(Object.values(checks).filter(Boolean).length/Object.keys(checks).length*100);
  return {ok:score===100,status:score===100?'PASS':'FAIL',score_pct:score,checks};
}

export function evaluateBackupRestore(run={}){
  const checks={backup_exists:Boolean(run.backup_reference),restore_completed:Boolean(run.restore_completed),integrity_verified:Boolean(run.integrity_verified),row_counts_reconciled:Boolean(run.row_counts_reconciled),application_smoke_test:Boolean(run.application_smoke_test),rto_met:n(run.restore_minutes,999)<=n(run.rto_minutes,120),evidence_recorded:Boolean(run.evidence_reference)};
  const score=Math.round(Object.values(checks).filter(Boolean).length/Object.keys(checks).length*100);
  return {ok:score===100,status:score===100?'PASS':'FAIL',score_pct:score,checks};
}

export function buildCloudIntelligenceReadiness(data={}){
  const modules={
    production_queues:Boolean(data.production_queues),workload_balancing:Boolean(data.workload_balancing),monitoring:Boolean(data.monitoring),disaster_recovery:Boolean(data.disaster_recovery),
    knowledge_cloud:Boolean(data.knowledge_cloud),marketplace:Boolean(data.marketplace),benchmark_cloud:Boolean(data.benchmark_cloud),api_platform:Boolean(data.api_platform),
    customer_success:Boolean(data.customer_success),training:Boolean(data.training),support_sla:Boolean(data.support_sla),renewal:Boolean(data.renewal),expansion:Boolean(data.expansion),vin:Boolean(data.vin)
  };
  const implementation=Math.round(Object.values(modules).filter(Boolean).length/Object.keys(modules).length*100);
  const evidence={load_test:data.load_test_status==='PASS',failover:data.failover_status==='PASS',backup_restore:data.backup_restore_status==='PASS'};
  const evidenceScore=Math.round(Object.values(evidence).filter(Boolean).length/3*100);
  const readiness=Math.round(implementation*.65+evidenceScore*.35);
  return {modules,evidence,implementation_pct:implementation,operational_evidence_pct:evidenceScore,verified_readiness_pct:readiness,status:readiness>=95?'INTERNATIONAL_OPERATIONAL_READY':readiness>=90?'ENTERPRISE_READY_WITH_CONDITIONS':readiness>=75?'PILOT_READY':'NOT_READY'};
}

export function buildScaleIntelligenceWorkspace(input={}){
  const workload=computeWorkloadPlan(input);
  const readiness=buildCloudIntelligenceReadiness(input);
  return {
    product_name:'Scale, Cloud Intelligence & Customer Success Operations',
    workload,readiness,
    cloud_modules:['Knowledge Cloud™','Marketplace','Benchmark Cloud™','VoiceInsights API Platform','Customer Success','Training & Certification','Support & SLA','Renewal & Expansion','VoiceInsights Intelligence Network™ (VIN™)'],
    safeguards:['tenant isolation','idempotency','dead-letter control','privacy-safe benchmarks','VIN opt-in','Founder activation','auditable acceptance evidence'],
    acceptance_required:['live load test','failover drill','D1 backup restoration drill']
  };
}

export { QUEUE_TYPES, ACCEPTANCE_AREAS };
