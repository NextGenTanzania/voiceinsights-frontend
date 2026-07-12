// External assurance and live acceptance orchestration.
// This module records verifiable execution evidence without claiming external certification.

export const EXTERNAL_ASSURANCE_TYPES = Object.freeze([
  'sso_live_test','scim_live_test','mfa_live_test','penetration_test','soc2_external_review','iso_external_review','client_end_to_end_pilot'
]);

export function validateExternalEvidence(input={}) {
  const errors=[];
  if(!EXTERNAL_ASSURANCE_TYPES.includes(input.type)) errors.push('Unsupported assurance type');
  if(!input.provider_or_auditor) errors.push('provider_or_auditor is required');
  if(!input.executed_at) errors.push('executed_at is required');
  if(!['pass','fail','partial','scheduled'].includes(input.result)) errors.push('result must be pass, fail, partial or scheduled');
  if(input.result==='pass' && !input.evidence_reference) errors.push('evidence_reference is required for a passing result');
  return {ok:errors.length===0,errors};
}

export function buildSsoLiveTestPlan(provider='microsoft_entra', config={}) {
  const providers={
    microsoft_entra:['authorization_code_pkce','jwks_signature','tenant_validation','email_verified','role_mapping','jit_provisioning','logout','session_expiry'],
    google_workspace:['authorization_code_pkce','jwks_signature','hosted_domain_validation','email_verified','role_mapping','jit_provisioning','logout','session_expiry'],
    okta:['authorization_code_pkce','jwks_signature','issuer_validation','email_verified','group_role_mapping','jit_provisioning','logout','session_expiry']
  };
  const checks=providers[provider]||providers.microsoft_entra;
  const configured=Boolean(config.client_id&&config.issuer&&config.redirect_uri);
  return {provider,configured,checks,live_execution_required:true,status:configured?'ready_to_execute':'configuration_required'};
}

export function applyScimLifecycle(state={}, operation, payload={}) {
  const user={...state};
  if(operation==='create') return {ok:Boolean(payload.email),user:{id:payload.id||crypto.randomUUID(),email:payload.email,active:true,display_name:payload.display_name||payload.email},event:'created'};
  if(operation==='update') return {ok:Boolean(user.id),user:{...user,...payload,id:user.id},event:'updated'};
  if(operation==='suspend') return {ok:Boolean(user.id),user:{...user,active:false},event:'suspended'};
  if(operation==='restore') return {ok:Boolean(user.id),user:{...user,active:true},event:'restored'};
  return {ok:false,error:'Unsupported SCIM lifecycle operation'};
}

export function evaluateMfaRecoveryChallenge(input={}) {
  const checks={
    recovery_code_single_use:Boolean(input.recovery_code_single_use),
    lost_device_reset_approved:Boolean(input.lost_device_reset_approved),
    identity_reverified:Boolean(input.identity_reverified),
    privileged_action_rechallenged:Boolean(input.privileged_action_rechallenged),
    old_sessions_revoked:Boolean(input.old_sessions_revoked),
    audit_event_recorded:Boolean(input.audit_event_recorded)
  };
  const passed=Object.values(checks).filter(Boolean).length;
  return {checks,passed,total:Object.keys(checks).length,score_pct:Math.round(passed/Object.keys(checks).length*100),status:passed===Object.keys(checks).length?'pass':'remediation_required'};
}

export function buildExternalAssuranceRegister(rows=[]) {
  const normalized=EXTERNAL_ASSURANCE_TYPES.map(type=>{
    const latest=rows.filter(r=>r.type===type).sort((a,b)=>String(b.executed_at||'').localeCompare(String(a.executed_at||'')))[0];
    return {type,status:latest?.result||'not_executed',provider_or_auditor:latest?.provider_or_auditor||null,evidence_reference:latest?.evidence_reference||null,executed_at:latest?.executed_at||null};
  });
  const passed=normalized.filter(x=>x.status==='pass').length;
  return {certification_claim:false,passed,total:normalized.length,completion_pct:Math.round(passed/normalized.length*100),items:normalized,disclaimer:'External execution and independent evidence are required before any certification or production-assurance claim.'};
}

export function evaluateClientJourneyAcceptance(input={}) {
  const stages=['demo','meeting','proposal','contract','invoice','founder_approval','organization','project','workspace','team','campaign'];
  const checks=Object.fromEntries(stages.map(s=>[s,Boolean(input[s])]));
  const passed=Object.values(checks).filter(Boolean).length;
  return {checks,passed,total:stages.length,score_pct:Math.round(passed/stages.length*100),status:passed===stages.length?'pass':'incomplete',missing:stages.filter(s=>!checks[s])};
}
