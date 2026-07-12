// Enterprise production hardening controls. Pure, deterministic helpers are
// shared by APIs, CI checks and dashboards. Missing evidence is never converted
// into a flattering score or an operational state.

export const UNMEASURED = 'NOT_YET_MEASURED';
export const METHODOLOGY_STATES = Object.freeze([
  'NOT_READY', 'READY_FOR_FIELDWORK', 'READY_FOR_ANALYSIS', 'READY_FOR_PUBLICATION'
]);

const requiredMethodology = Object.freeze({
  READY_FOR_FIELDWORK: ['research_objectives','evaluation_questions','sampling_frame','sample_size_calculation','consent','ethics'],
  READY_FOR_ANALYSIS: ['analysis_plan','weights','missing_data_treatment','data_dictionary','reproducibility'],
  READY_FOR_PUBLICATION: ['confidence_intervals','reliability','validity','limitations','evidence_lineage','disclosure_control','quality_statement']
});

const present = value => Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== '' && value !== false;

export function evaluateMethodologyGate(methodology = {}) {
  const missingByState = {};
  let state = 'NOT_READY';
  for (const candidate of METHODOLOGY_STATES.slice(1)) {
    const cumulative = Object.entries(requiredMethodology)
      .filter(([key]) => METHODOLOGY_STATES.indexOf(key) <= METHODOLOGY_STATES.indexOf(candidate))
      .flatMap(([, fields]) => fields);
    const missing = [...new Set(cumulative)].filter(field => !present(methodology[field]));
    missingByState[candidate] = missing;
    if (!missing.length) state = candidate;
  }
  return { state, publication_allowed: state === 'READY_FOR_PUBLICATION', missing_by_state: missingByState };
}

export function displayMetric(value, { configured = true, observed = true, error = false } = {}) {
  if (!configured) return { value: null, status: 'NOT_CONFIGURED', label: 'Not configured' };
  if (error) return { value: null, status: 'UNABLE_TO_VERIFY', label: 'Unable to verify' };
  if (!observed || value === null || value === undefined) return { value: null, status: UNMEASURED, label: 'Awaiting first successful event' };
  return { value, status: 'MEASURED', label: String(value) };
}

export function buildSignedOfflinePackage(input = {}) {
  const required = ['assignment_id','organization_id','project_id','survey_id','survey_version','questions','consent_scripts','expires_at'];
  const missing = required.filter(k => !present(input[k]));
  const canonical = JSON.stringify({
    assignment_id: input.assignment_id,
    organization_id: input.organization_id,
    project_id: input.project_id,
    survey_id: input.survey_id,
    survey_version: input.survey_version,
    questions: input.questions || [],
    translations: input.translations || {},
    skip_logic: input.skip_logic || [],
    validation_rules: input.validation_rules || [],
    consent_scripts: input.consent_scripts || [],
    media_manifest: input.media_manifest || [],
    expires_at: input.expires_at,
    revoked_at: input.revoked_at || null,
  });
  return {
    valid: missing.length === 0,
    missing,
    package: { ...JSON.parse(canonical), checksum_input: canonical, signature_required: true, encryption_required: true }
  };
}

export function resolveOfflineConflict({ local = {}, server = {}, local_timestamp, server_timestamp } = {}) {
  const fields = [...new Set([...Object.keys(local), ...Object.keys(server)])];
  const conflicts = fields.filter(k => JSON.stringify(local[k]) !== JSON.stringify(server[k])).map(field => ({
    field, local_value: local[field] ?? null, server_value: server[field] ?? null,
    local_timestamp: local_timestamp || null, server_timestamp: server_timestamp || null,
  }));
  return {
    has_conflict: conflicts.length > 0,
    conflicts,
    permitted_actions: conflicts.length ? ['ACCEPT_LOCAL','ACCEPT_SERVER','MERGE','RECOLLECT','ESCALATE'] : ['NO_ACTION'],
    supervisor_decision_required: conflicts.length > 0,
    me_approval_required: conflicts.length > 0,
  };
}

export function compareDoubleEntryRecords(entry1 = {}, entry2 = {}) {
  const fields = [...new Set([...Object.keys(entry1), ...Object.keys(entry2)])];
  const comparison = fields.map(field => ({ field, entry_1: entry1[field] ?? null, entry_2: entry2[field] ?? null, match: JSON.stringify(entry1[field]) === JSON.stringify(entry2[field]) }));
  const mismatches = comparison.filter(row => !row.match);
  return { comparison, mismatches, status: mismatches.length ? 'MISMATCH_REVIEW_REQUIRED' : 'MATCHED', supervisor_decision_required: mismatches.length > 0 };
}

const PLACEHOLDER_PATTERNS = [
  { code:'COMING_SOON', re:/\bcoming\s+soon\b/i },
  { code:'TODO', re:/\bTODO\b/ },
  { code:'BROWSER_ALERT', re:/(?:^|[;{}:])\s*alert\s*\(/m },
  { code:'DEAD_HREF', re:/<a\b[^>]*href\s*=\s*["']#["'][^>]*>/i },
  { code:'JAVASCRIPT_VOID', re:/javascript\s*:\s*void\s*\(/i },
  { code:'HARDCODED_OPERATIONAL', re:/>\s*Operational\s*</i },
];
export function detectPlaceholderContent(text = '', { syntheticDemo = false } = {}) {
  if (syntheticDemo) return [];
  return PLACEHOLDER_PATTERNS.filter(p => p.re.test(String(text))).map(p => p.code);
}

export function auditAccessibilityHtml(html = '') {
  const source = String(html);
  const issues = [];
  if (!/<html[^>]+lang=["'][^"']+["']/i.test(source)) issues.push('MISSING_LANGUAGE_METADATA');
  if (!/<main\b/i.test(source)) issues.push('MISSING_MAIN_LANDMARK');
  if (!/href=["']#(?:main|content)/i.test(source)) issues.push('MISSING_SKIP_LINK');
  if (/<img\b(?![^>]*\balt=)[^>]*>/i.test(source)) issues.push('IMAGE_WITHOUT_ALT');
  if (/<input\b/i.test(source) && !/<label\b/i.test(source)) issues.push('FORM_WITHOUT_LABEL');
  if (/onclick\s*=/i.test(source)) issues.push('INLINE_EVENT_HANDLER');
  return { compliant: issues.length === 0, issues };
}

export function calculateReadiness(controls = []) {
  const evaluated = controls.map(control => ({
    id: control.id,
    implemented: control.implemented === true,
    secured: control.secured === true,
    persisted: control.persisted === true,
    ui: control.ui === true,
    tested: control.tested === true,
    monitored: control.monitored === true,
    error_handling: control.error_handling === true,
    external_validation: control.external_validation === true,
  })).map(row => ({ ...row, score: ['implemented','secured','persisted','ui','tested','monitored','error_handling'].filter(k => row[k]).length / 7 * 100 }));
  const sourceCode = evaluated.length ? Math.round(evaluated.reduce((s,r)=>s+r.score,0)/evaluated.length) : 0;
  const externallyValidated = evaluated.filter(r=>r.external_validation).length;
  const live = evaluated.length ? Math.round(sourceCode * (externallyValidated / evaluated.length)) : 0;
  return { source_code_readiness: sourceCode, verified_live_production_readiness: live, controls: evaluated };
}
