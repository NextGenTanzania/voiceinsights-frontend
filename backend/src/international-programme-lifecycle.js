const present=v=>v!==null&&v!==undefined&&!(Array.isArray(v)&&v.length===0)&&!(typeof v==='string'&&!v.trim());
export function validateResultsFramework(input={}){const errors=[];for(const k of ['project_id','title'])if(!present(input[k]))errors.push(`${k} is required`);if(!Array.isArray(input.indicators)||!input.indicators.length)errors.push('At least one indicator is required');for(const [i,x] of (input.indicators||[]).entries())for(const k of ['name','baseline','target','unit','frequency','source'])if(!present(x[k]))errors.push(`indicators[${i}].${k} is required`);return{ok:!errors.length,errors}}
export function buildMethodologyReadiness(m={}){const controls={sampling_frame:present(m.sampling_frame),sample_design:present(m.sample_design),sample_size:present(m.sample_size),stratification:present(m.stratification)||m.not_applicable?.includes?.('stratification'),clustering:present(m.clustering)||m.not_applicable?.includes?.('clustering'),weights:present(m.weights)||m.not_applicable?.includes?.('weights'),nonresponse_plan:present(m.nonresponse_plan),instrument_version:present(m.instrument_version),training_protocol:present(m.training_protocol),field_qc:present(m.field_qc),ethics_consent:present(m.ethics_consent),analysis_plan:present(m.analysis_plan),data_dictionary:present(m.data_dictionary),limitations:present(m.limitations)};const done=Object.values(controls).filter(Boolean).length,total=Object.keys(controls).length;return{controls,completed:done,total,score:Math.round(done/total*100),status:done===total?'ready':done/total>=.75?'conditional':'incomplete',missing:Object.entries(controls).filter(([,v])=>!v).map(([k])=>k)}}
export function validateManagementResponse(x={}){const errors=[];for(const k of ['project_id','recommendation','management_response','owner','due_date'])if(!present(x[k]))errors.push(`${k} is required`);return{ok:!errors.length,errors}}
export function buildRoleAcceptanceMatrix(results=[]){const required=['founder_executive','operations_manager','organization_admin','project_manager','me_officer','enumerator'];const normalized=results.map(r=>({role:r.role,journey:r.journey||'core_journey',status:['pass','fail','blocked'].includes(r.status)?r.status:'blocked',evidence:r.evidence||{}}));const passed=new Set(normalized.filter(r=>r.status==='pass').map(r=>r.role));return{results:normalized,required_roles:required,missing_roles:required.filter(r=>!passed.has(r)),score:Math.round(passed.size/required.length*100),status:passed.size===required.length?'accepted':'incomplete'}}
export function buildInternationalProgrammeWorkspace({organization_id,projects=[],frameworks=[],management_responses=[],role_acceptance=[]}={}){const open=management_responses.filter(x=>!['closed','completed'].includes(x.status));return{product_name:'International Programme Lifecycle Workspace',organization_id,modules:{programme_design:true,results_framework:true,sampling_methodology:true,management_response:true,role_acceptance:true},metrics:{projects:projects.length,results_frameworks:frameworks.length,open_management_actions:open.length,role_acceptance_passes:role_acceptance.filter(x=>x.status==='pass').length},projects,frameworks,management_responses,role_acceptance,data_policy:'No readiness score is shown unless measured from stored evidence.'}}

// ============================================================
// Program Beta Sprint 1 — Decision Action lifecycle.
// Evolves management_response_actions (migration 028) into a governed
// Action per the approved Enterprise Product Blueprint, reusing the exact
// pure-function/audit_event convention already established by
// buildWorkflowTransition() in governance-security-workstream3.js. Kept as a
// sibling function (not a rewrite of buildWorkflowTransition) because that
// function is deliberately strict-linear (enterprise onboarding has no
// branches); an Action's lifecycle genuinely branches (rejected, needs
// clarification, cancellation from most states), so it needs its own graph
// rather than forcing a linear model to fit.
// ============================================================

export const ACTION_STATUSES = Object.freeze([
  'draft','under_review','needs_clarification','approved','rejected',
  'assigned','in_progress','completed','verified','cancelled'
]);

// Adjacency list: which statuses a given status may move to, and the single
// action.* permission required to make that move. Every entry is explicit —
// no implicit transitions, matching the brief's own RBAC requirement.
export const ACTION_TRANSITIONS = Object.freeze({
  draft:                { under_review: 'action.submit', cancelled: 'action.cancel' },
  under_review:         { approved: 'action.review', rejected: 'action.review', needs_clarification: 'action.review', cancelled: 'action.cancel' },
  needs_clarification:  { under_review: 'action.submit', cancelled: 'action.cancel' },
  approved:             { assigned: 'action.assign', cancelled: 'action.cancel' },
  rejected:             { draft: 'action.submit' },
  assigned:             { in_progress: 'action.progress', cancelled: 'action.cancel' },
  in_progress:          { completed: 'action.progress', cancelled: 'action.cancel' },
  completed:            { verified: 'action.verify', in_progress: 'action.verify' },
  verified:             {},
  cancelled:            {}
});

export function nextActionStatuses(status='draft') { return Object.keys(ACTION_TRANSITIONS[status] || {}); }

// Pure, deterministic transition validator — same return shape as
// buildWorkflowTransition() (ok/from/to/errors/audit_event) so callers and
// tests can treat both engines consistently.
export function buildActionTransition(record={}, targetStatus, actor={}, context={}) {
  const current = String(record.status || 'draft');
  const edges = ACTION_TRANSITIONS[current] || {};
  const errors = [];
  if (!ACTION_STATUSES.includes(targetStatus)) errors.push('Unknown action status');
  else if (!(targetStatus in edges)) errors.push(`Cannot move from ${current} to ${targetStatus}`);
  const requiredPermission = edges[targetStatus];
  if (requiredPermission && !context.hasPermission?.(actor.role, requiredPermission)) {
    errors.push(`Permission required: ${requiredPermission}`);
  }
  if ((targetStatus === 'completed' || targetStatus === 'in_progress') && current === 'completed' && !present(context.reason)) {
    errors.push('A reason is required when reopening a completed action');
  }
  return {
    ok: errors.length === 0,
    from: current,
    to: targetStatus,
    errors,
    audit_event: {
      action: 'decision_action.transition',
      actor_id: actor.id || actor.sub || null,
      actor_role: actor.role || null,
      resource_id: record.id || null,
      from: current,
      to: targetStatus,
      reason: context.reason || null,
      occurred_at: new Date().toISOString()
    }
  };
}

// project_id/recommendation/owner/due_date match the real, pre-existing
// NOT NULL columns on management_response_actions (migration 028) — kept
// required here rather than silently defaulted, so a Draft Action never
// carries a fabricated placeholder value in a field the schema says is
// meaningful.
export function validateActionCreate(x={}) {
  const errors = [];
  for (const k of ['project_id','recommendation','owner','due_date']) if (!present(x[k])) errors.push(`${k} is required`);
  if (x.priority && !['low','medium','high','critical'].includes(String(x.priority).toLowerCase())) errors.push('priority must be one of low, medium, high, critical');
  if (x.progress_pct !== undefined && (Number(x.progress_pct) < 0 || Number(x.progress_pct) > 100)) errors.push('progress_pct must be between 0 and 100');
  return { ok: errors.length === 0, errors };
}

// Program Beta Sprint 1.5 — pure mapping from a real state transition to its
// canonical domain event type (decision-event-envelope.js's ACTION_EVENT_TYPES).
// Kept as a pure function, independent of the DB, so it can be unit tested
// against every real edge in ACTION_TRANSITIONS without a database.
export function eventTypeForActionTransition(from, to) {
  if (to === 'under_review') return 'decision.action.submitted';
  if (to === 'needs_clarification') return 'decision.action.needs_clarification';
  if (to === 'approved') return 'decision.action.approved';
  if (to === 'rejected') return 'decision.action.rejected';
  if (to === 'assigned') return 'decision.action.assigned';
  if (to === 'in_progress' && from === 'completed') return 'decision.action.reopened';
  if (to === 'in_progress') return 'decision.action.started';
  if (to === 'completed') return 'decision.action.completed';
  if (to === 'verified') return 'decision.action.verified';
  if (to === 'cancelled') return 'decision.action.cancelled';
  if (to === 'draft' && from === 'rejected') return 'decision.action.updated';
  return 'decision.action.updated';
}

export function validateActionUpdate(x={}) {
  const errors = [];
  if (x.progress_pct !== undefined && (Number.isNaN(Number(x.progress_pct)) || Number(x.progress_pct) < 0 || Number(x.progress_pct) > 100)) errors.push('progress_pct must be a number between 0 and 100');
  if (x.budget_actual !== undefined && Number.isNaN(Number(x.budget_actual))) errors.push('budget_actual must be a number');
  if (x.dependencies !== undefined && !Array.isArray(x.dependencies)) errors.push('dependencies must be an array of Action IDs');
  return { ok: errors.length === 0, errors };
}
