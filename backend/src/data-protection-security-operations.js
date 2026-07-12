// VoiceInsights v210.3B — Data Protection & Security Operations
// Audit Center, Secrets Manager metadata, Consent Vault, Encryption Center and Security Dashboard.

export const V2103B_VERSION = 'v210.3B.0';

export const AUDIT_RISK_LEVELS = Object.freeze(['low','medium','high','critical']);
export const SECRET_STATUSES = Object.freeze(['active','rotation_due','expired','revoked','configuration_required']);
export const CONSENT_STATUSES = Object.freeze(['requested','accepted','declined','withdrawn','expired']);

export function sanitizeAuditMetadata(input = {}) {
  const blocked = /password|secret|token|authorization|cookie|transcript|audio|answer|phone|email/i;
  const out = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (blocked.test(key)) continue;
    if (value === null || ['string','number','boolean'].includes(typeof value)) out[key] = value;
  }
  return out;
}

export function buildAuditEvent({id, organization_id, actor_id, actor_role, action, resource_type, resource_id, result='success', risk_level='low', correlation_id, ip_address, device, metadata} = {}) {
  if (!action) throw new Error('Audit action is required');
  const risk = AUDIT_RISK_LEVELS.includes(risk_level) ? risk_level : 'medium';
  return {
    id: id || `audit_${crypto.randomUUID()}`,
    organization_id: organization_id || null,
    actor_id: actor_id || null,
    actor_role: actor_role || null,
    action: String(action),
    resource_type: resource_type || null,
    resource_id: resource_id || null,
    result,
    risk_level: risk,
    correlation_id: correlation_id || crypto.randomUUID(),
    ip_address: ip_address || null,
    device: device || null,
    metadata: sanitizeAuditMetadata(metadata),
    created_at: new Date().toISOString()
  };
}

export function calculateConsentCoverage({total=0, accepted=0, withdrawn=0, missing=0} = {}) {
  total = Math.max(0, Number(total || 0)); accepted = Math.max(0, Number(accepted || 0));
  const coverage = total ? Math.round((accepted / total) * 100) : 100;
  return { total, accepted, withdrawn:Number(withdrawn||0), missing:Number(missing||0), coverage_pct:coverage, status:coverage >= 98 ? 'healthy' : coverage >= 90 ? 'attention' : 'risk' };
}

export function validateConsentRecord(input = {}) {
  const errors=[];
  for (const field of ['respondent_reference','project_id','campaign_id','channel','consent_version','language','purpose','status']) if (!input[field]) errors.push(`${field} is required`);
  if (input.status && !CONSENT_STATUSES.includes(input.status)) errors.push('Unsupported consent status');
  return { ok:errors.length===0, errors };
}

export function buildSecretMetadata(input = {}) {
  const now = Date.now();
  const next = input.next_rotation_at ? Date.parse(input.next_rotation_at) : null;
  const expired = input.expires_at && Date.parse(input.expires_at) <= now;
  const due = next && next <= now;
  const status = input.revoked_at ? 'revoked' : expired ? 'expired' : due ? 'rotation_due' : (input.status || 'active');
  return {
    id: input.id || `secret_${crypto.randomUUID()}`,
    organization_id: input.organization_id || null,
    name: String(input.name || ''),
    provider: String(input.provider || ''),
    environment: input.environment || 'production',
    secret_reference: input.secret_reference || null,
    masked_value: input.masked_value || '••••••••',
    owner: input.owner || null,
    status: SECRET_STATUSES.includes(status) ? status : 'configuration_required',
    version: Number(input.version || 1),
    last_rotated_at: input.last_rotated_at || null,
    next_rotation_at: input.next_rotation_at || null,
    expires_at: input.expires_at || null,
    used_by: Array.isArray(input.used_by) ? input.used_by : [],
    created_at: input.created_at || new Date().toISOString()
  };
}

export function buildEncryptionPosture(snapshot = {}) {
  const checks = [
    ['data_in_transit', snapshot.data_in_transit !== false],
    ['r2_objects', snapshot.r2_objects !== false],
    ['sensitive_fields', snapshot.sensitive_fields !== false],
    ['signed_downloads', snapshot.signed_downloads !== false],
    ['backup_encryption', snapshot.backup_encryption !== false],
    ['tenant_bound_context', snapshot.tenant_bound_context !== false],
    ['key_versioning', snapshot.key_versioning !== false],
    ['tamper_detection', snapshot.tamper_detection !== false]
  ].map(([control, passed]) => ({control, passed:Boolean(passed)}));
  const score = Math.round(checks.filter(c=>c.passed).length / checks.length * 100);
  return { score, status:score >= 95 ? 'strong' : score >= 80 ? 'attention' : 'risk', checks, pending_rotation_jobs:Number(snapshot.pending_rotation_jobs||0), expired_key_versions:Number(snapshot.expired_key_versions||0) };
}

export function buildSecurityDashboard(snapshot = {}) {
  const consent = calculateConsentCoverage(snapshot.consent || {});
  const encryption = buildEncryptionPosture(snapshot.encryption || {});
  const penalties = Math.min(100,
    Number(snapshot.critical_incidents||0)*25 +
    Number(snapshot.high_risk_audit_events||0)*8 +
    Number(snapshot.users_without_mfa||0)*3 +
    Number(snapshot.secrets_due_rotation||0)*4 +
    consent.missing*2 +
    Math.max(0, 95-encryption.score)
  );
  const score = Math.max(0, 100-penalties);
  return {
    version:V2103B_VERSION,
    title:'Security Operations & Data Protection Center',
    security_posture_score:score,
    status:score >= 90 ? 'strong' : score >= 75 ? 'attention' : 'risk',
    metrics:{
      critical_incidents:Number(snapshot.critical_incidents||0),
      failed_logins_24h:Number(snapshot.failed_logins_24h||0),
      privileged_role_changes_24h:Number(snapshot.privileged_role_changes_24h||0),
      users_without_mfa:Number(snapshot.users_without_mfa||0),
      secrets_due_rotation:Number(snapshot.secrets_due_rotation||0),
      high_risk_api_keys:Number(snapshot.high_risk_api_keys||0),
      consent_gaps:consent.missing,
      backups_verified:Boolean(snapshot.backups_verified ?? true)
    },
    consent,
    encryption,
    modules:['Audit Center','Secrets Manager','Consent Vault','Encryption Center','Security Dashboard']
  };
}
