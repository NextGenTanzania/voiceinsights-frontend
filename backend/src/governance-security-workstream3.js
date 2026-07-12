// Governance, Security, Compliance & Enterprise Workflow hardening.
// Customer-facing product name intentionally excludes internal release labels.

export const WORKFLOW_STAGES = Object.freeze([
  'demo_received','meeting_completed','proposal_uploaded','contract_uploaded','invoice_uploaded',
  'submitted_for_approval','founder_approved','organization_created','project_created','workspace_ready','team_assigned','campaign_ready'
]);

export const ROLE_HOME = Object.freeze({
  founder_executive:'/admin/founder-dashboard-legacy.html', founder:'/admin/founder-dashboard-legacy.html',
  super_admin:'/admin/super-admin-workspace.html', operations_manager:'/admin/operations-manager-dashboard-legacy.html',
  org_admin:'/app/organization-admin-workspace.html', organization_admin:'/app/organization-admin-workspace.html',
  project_manager:'/app/project-manager-dashboard.html', head_of_programs:'/app/project-manager-dashboard.html', me_officer:'/app/dashboard.html', data_analyst:'/app/analytics.html', enumerator:'/app/enumerator-workspace.html'
});

export function validateEnterpriseWorkflow(input={}) {
  const stage=String(input.stage||'demo_received');
  const errors=[];
  if(!WORKFLOW_STAGES.includes(stage)) errors.push('Unknown workflow stage');
  const required={
    meeting_completed:['meeting_at'], proposal_uploaded:['proposal_reference'], contract_uploaded:['contract_reference'],
    invoice_uploaded:['invoice_reference'], submitted_for_approval:['proposal_reference','contract_reference','invoice_reference'],
    founder_approved:['approval_id'], organization_created:['organization_id'], project_created:['organization_id','project_id'],
    workspace_ready:['organization_id','project_id','workspace_id'], team_assigned:['organization_id','project_id','workspace_id','team_assignment_count'],
    campaign_ready:['organization_id','project_id','workspace_id','campaign_id']
  }[stage]||[];
  for(const field of required) if(input[field]===undefined||input[field]===null||input[field]==='') errors.push(`${field} is required for ${stage}`);
  return {ok:errors.length===0,stage,errors,required_fields:required};
}

export function nextWorkflowStage(stage='demo_received') {
  const i=WORKFLOW_STAGES.indexOf(stage); return i<0||i===WORKFLOW_STAGES.length-1?null:WORKFLOW_STAGES[i+1];
}

export function buildWorkflowTransition(record={}, targetStage, actor={}) {
  const current=String(record.stage||'demo_received'); const currentIndex=WORKFLOW_STAGES.indexOf(current); const targetIndex=WORKFLOW_STAGES.indexOf(targetStage);
  const errors=[];
  if(currentIndex<0||targetIndex<0) errors.push('Invalid workflow stage');
  if(targetIndex!==currentIndex+1) errors.push('Workflow transitions must advance exactly one stage');
  if(targetStage==='founder_approved'&&!['founder_executive','founder','super_admin'].includes(actor.role)) errors.push('Founder approval authority required');
  if(targetStage==='submitted_for_approval'&&!['operations_manager','super_admin','founder_executive','founder'].includes(actor.role)) errors.push('Operations workflow permission required');
  const merged={...record,...record.metadata,...actor,stage:targetStage}; const checked=validateEnterpriseWorkflow(merged);
  errors.push(...checked.errors);
  return {ok:errors.length===0,from:current,to:targetStage,errors,audit_event:{action:'enterprise_workflow.transition',actor_id:actor.id||actor.sub||null,actor_role:actor.role||null,resource_id:record.id||null,from:current,to:targetStage,occurred_at:new Date().toISOString()}};
}

export function buildMfaPolicy(input={}) {
  const privileged=['founder_executive','founder','super_admin','operations_manager','org_admin','organization_admin'];
  return {
    required_roles:privileged,
    challenge_for:['billing.change','organization.suspend','organization.delete','platform.settings','ai.settings','export.all','api_key.create','secret.rotate'],
    grace_period_hours:Number(input.grace_period_hours??24),
    recovery_codes_required:true,
    reset_requires_founder_or_security_admin:true,
    session_reauthentication_minutes:Number(input.session_reauthentication_minutes??15)
  };
}

export function buildSsoAuthorizationRequest(config={}, state, nonce, verifier) {
  if(!config.authorization_endpoint||!config.client_id||!config.redirect_uri) return {ok:false,errors:['authorization_endpoint, client_id and redirect_uri are required']};
  const challenge=verifier?verifier:null;
  const params=new URLSearchParams({response_type:'code',client_id:config.client_id,redirect_uri:config.redirect_uri,scope:config.scope||'openid profile email',state:String(state||''),nonce:String(nonce||'')});
  if(challenge){params.set('code_challenge',challenge);params.set('code_challenge_method','S256');}
  return {ok:true,url:`${config.authorization_endpoint}?${params.toString()}`,state,nonce,pkce:Boolean(challenge)};
}

export function validateSsoCallback(input={}) {
  const errors=[];
  if(!input.code) errors.push('Authorization code is required');
  if(!input.state||input.state!==input.expected_state) errors.push('Invalid SSO state');
  if(!input.nonce||input.nonce!==input.expected_nonce) errors.push('Invalid SSO nonce');
  if(input.email_verified===false) errors.push('Verified email is required');
  return {ok:errors.length===0,errors,subject:input.subject||null,email:input.email||null,role:input.mapped_role||'me_officer'};
}

export function normalizeScimUser(resource={}) {
  const email=resource.userName||resource.emails?.find(x=>x.primary)?.value||resource.emails?.[0]?.value||'';
  return {external_id:resource.externalId||resource.id||null,email:String(email).toLowerCase(),display_name:resource.displayName||[resource.name?.givenName,resource.name?.familyName].filter(Boolean).join(' ')||email,active:resource.active!==false,groups:(resource.groups||[]).map(g=>g.value||g.display).filter(Boolean)};
}

export function validateScimUser(resource={}) {
  const user=normalizeScimUser(resource); const errors=[];
  if(!user.email||!user.email.includes('@')) errors.push('Valid SCIM userName/email is required');
  return {ok:errors.length===0,errors,user};
}

export function redactAuditMetadata(input={}) {
  const blocked=/password|secret|token|authorization|cookie|api[_-]?key|totp|recovery/i;
  const walk=value=>{
    if(Array.isArray(value)) return value.map(walk);
    if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,blocked.test(k)?'[REDACTED]':walk(v)]));
    return value;
  };
  return walk(input);
}

export function buildProcurementEvidenceChecklist(input={}) {
  const controls=[
    ['iam_rbac','IAM and RBAC evidence'],['mfa','MFA coverage and enforcement'],['sso_scim','SSO and SCIM validation'],
    ['audit','Immutable audit trail'],['consent','Consent lifecycle evidence'],['encryption','Encryption and key rotation'],
    ['secrets','Secrets inventory and rotation'],['backup_restore','Backup and restore drill'],['incident_response','Incident response exercise'],
    ['business_continuity','Business continuity evidence'],['penetration_test','External penetration test'],['subprocessors','Subprocessor register'],
    ['retention','Data retention schedule'],['responsible_ai','Responsible AI documentation']
  ];
  const rows=controls.map(([key,label])=>({key,label,status:input[key]||'evidence_pending',external_verification_required:['penetration_test'].includes(key)}));
  const completed=rows.filter(r=>['implemented','system_verified','externally_verified'].includes(r.status)).length;
  return {label:'Procurement Evidence Pack',certification_claim:false,completion_pct:Math.round(completed/rows.length*100),controls:rows,disclaimer:'Readiness and evidence reporting only; no external certification is claimed.'};
}

export function evaluateAuthenticationJourney(input={}) {
  const checks={
    valid_login:Boolean(input.valid_login), invalid_password_blocked:Boolean(input.invalid_password_blocked),
    suspended_user_blocked:Boolean(input.suspended_user_blocked), expired_invite_blocked:Boolean(input.expired_invite_blocked),
    reset_token_single_use:Boolean(input.reset_token_single_use), session_expiry_enforced:Boolean(input.session_expiry_enforced),
    role_redirect_correct:Boolean(input.role_redirect_correct), unauthorized_route_blocked:Boolean(input.unauthorized_route_blocked),
    mfa_challenge_enforced:Boolean(input.mfa_challenge_enforced)
  };
  const passed=Object.values(checks).filter(Boolean).length;
  return {checks,passed,total:Object.keys(checks).length,score_pct:Math.round(passed/Object.keys(checks).length*100),status:passed===Object.keys(checks).length?'pass':'remediation_required'};
}

export function buildEnterpriseControlWorkspace(snapshot={}) {
  return {
    product_name:'Enterprise Governance, Security & Trust Center',
    workflow:{active:Number(snapshot.active_workflows||0),pending_approval:Number(snapshot.pending_approvals||0),blocked:Number(snapshot.blocked_workflows||0)},
    identity:{users:Number(snapshot.users||0),mfa_coverage_pct:Number(snapshot.mfa_coverage_pct||0),sso_active:Number(snapshot.sso_active||0),scim_active:Number(snapshot.scim_active||0),api_keys:Number(snapshot.api_keys||0)},
    security:{open_critical_events:Number(snapshot.open_critical_events||0),consent_coverage_pct:Number(snapshot.consent_coverage_pct||0),secrets_due_rotation:Number(snapshot.secrets_due_rotation||0),encryption_controls_pct:Number(snapshot.encryption_controls_pct||0)},
    compliance:{soc2_readiness:Number(snapshot.soc2_readiness||0),iso_evidence_pct:Number(snapshot.iso_evidence_pct||0),procurement_evidence_pct:Number(snapshot.procurement_evidence_pct||0)},
    role_home:ROLE_HOME,
    generated_at:new Date().toISOString()
  };
}
