export const REAL_METRIC_STATUS = Object.freeze({
  READY:'ready', NOT_MEASURED:'not_measured', NOT_CONFIGURED:'not_configured', UNAVAILABLE:'unavailable'
});

export function metric(value, {measured=true, label=null, unit=null}={}) {
  if (!measured || value === null || value === undefined || Number.isNaN(Number(value))) {
    return { value:null, display:'Not yet measured', status:REAL_METRIC_STATUS.NOT_MEASURED, label, unit };
  }
  const n=Number(value);
  return { value:n, display:unit==='percent'?`${Math.round(n)}%`:unit==='currency'?n.toLocaleString('en-US',{maximumFractionDigits:0}):String(n), status:REAL_METRIC_STATUS.READY, label, unit };
}

export function healthMetric({configured=false,last_success_at=null,last_failure_at=null,error_rate=null}={}) {
  if(!configured) return {status:REAL_METRIC_STATUS.NOT_CONFIGURED,display:'Not configured',last_success_at:null,last_failure_at:null,error_rate:null};
  if(!last_success_at) return {status:REAL_METRIC_STATUS.NOT_MEASURED,display:'Awaiting first successful event',last_success_at:null,last_failure_at,error_rate};
  const stale=Date.now()-new Date(last_success_at).getTime()>24*3600*1000;
  return {status:stale?'degraded':'operational',display:stale?'No success in last 24 hours':'Operational',last_success_at,last_failure_at,error_rate};
}

export function validateProvisioningInput(input={}) {
  const errors=[];
  for(const k of ['approval_id','workflow_id','organization_name','project_name']) if(!input[k]) errors.push(`${k} is required`);
  return {ok:errors.length===0,errors};
}

export function buildOfflinePackage({assignment,survey,questions=[],translations=[],validation_rules=[],consent_scripts=[],media=[],manifest={}}={}) {
  if(!assignment||!survey) return {ok:false,errors:['assignment and survey are required']};
  const generated_at=new Date().toISOString();
  const payload={
    package_type:'voiceinsights_offline_assignment',
    package_version:Number(assignment.offline_package_version||1),
    generated_at,
    assignment,
    survey,
    questions:questions.map(q=>({...q,options:q.options_json?JSON.parse(q.options_json):q.options||[]})),
    translations,
    validation_rules,
    consent_scripts,
    media,
    manifest:{...manifest,question_count:questions.length,survey_id:survey.id,assignment_id:assignment.id,generated_at}
  };
  return {ok:true,payload};
}

export function compareConflict(localPayload={},serverPayload={}) {
  const keys=[...new Set([...Object.keys(localPayload||{}),...Object.keys(serverPayload||{})])];
  return keys.filter(k=>JSON.stringify(localPayload?.[k])!==JSON.stringify(serverPayload?.[k])).map(k=>({field:k,local:localPayload?.[k]??null,server:serverPayload?.[k]??null}));
}
