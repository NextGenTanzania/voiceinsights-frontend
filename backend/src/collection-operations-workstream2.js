// Collection, Enumerator, Offline & Omni-Channel Operations
// Production-safe domain logic for distribution, delivery, offline sync,
// double-entry verification, supervisor review and fraud/quality intelligence.

export const COLLECTION_OPERATIONS_PRODUCT = 'Collection, Enumerator, Offline & Omni-Channel Operations';

export function resolveTwilioSenders(env = {}) {
  return {
    sms: env.TWILIO_SMS_FROM || env.TWILIO_PHONE_NUMBER || null,
    whatsapp: env.TWILIO_WHATSAPP_FROM || env.TWILIO_WHATSAPP_NUMBER || null,
    voice: env.TWILIO_VOICE_FROM || env.TWILIO_PHONE_NUMBER || null,
  };
}

export function normalizePhone(value = '') {
  const raw = String(value).trim();
  if (!raw) return '';
  if (raw.startsWith('whatsapp:')) return `whatsapp:${normalizePhone(raw.slice(9))}`;
  const digits = raw.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  return digits;
}

export function mapTwilioStatus(status = '') {
  const value = String(status).toLowerCase();
  if (['delivered', 'completed', 'read'].includes(value)) return 'delivered';
  if (['sent', 'queued', 'accepted', 'initiated', 'ringing', 'in-progress'].includes(value)) return 'in_progress';
  if (['failed', 'undelivered', 'busy', 'no-answer', 'canceled'].includes(value)) return 'failed';
  return value || 'unknown';
}

export function nextRetryAt(attempt = 1, now = new Date(), maxMinutes = 60) {
  const minutes = Math.min(maxMinutes, Math.max(2, 2 ** Math.max(1, Number(attempt))));
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

export function decideDeliveryRetry({ providerStatus, attempts = 0, maxAttempts = 5, now = new Date() } = {}) {
  const normalized = mapTwilioStatus(providerStatus);
  if (normalized !== 'failed') return { status: normalized, retry: false, next_attempt_at: null };
  const nextAttempt = Number(attempts) + 1;
  if (nextAttempt >= Number(maxAttempts)) return { status: 'dead_letter', retry: false, attempts: nextAttempt, next_attempt_at: null };
  return { status: 'retry_scheduled', retry: true, attempts: nextAttempt, next_attempt_at: nextRetryAt(nextAttempt, now) };
}

export async function verifyTwilioSignature({ authToken, signature, url, params = {} } = {}) {
  if (!authToken || !signature || !url) return false;
  const payload = Object.keys(params).sort().reduce((s, key) => s + key + String(params[key] ?? ''), url);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export function buildOfflineSyncDecision({ clientVersion = 0, serverVersion = 0, clientUpdatedAt, serverUpdatedAt } = {}) {
  const cv = Number(clientVersion || 0);
  const sv = Number(serverVersion || 0);
  if (cv > sv) return { action: 'accept_client', conflict: false };
  if (cv < sv) return { action: 'keep_server', conflict: true, reason: 'server_version_newer' };
  const c = Date.parse(clientUpdatedAt || 0) || 0;
  const s = Date.parse(serverUpdatedAt || 0) || 0;
  if (c > s) return { action: 'accept_client', conflict: false };
  if (c < s) return { action: 'keep_server', conflict: true, reason: 'server_updated_later' };
  return { action: 'duplicate', conflict: false };
}

function canonical(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

export function compareDoubleEntries(first = {}, second = {}, options = {}) {
  const ignored = new Set(options.ignoredFields || ['created_at', 'updated_at', 'device_id', 'enumerator_id']);
  const critical = new Set(options.criticalFields || []);
  const keys = [...new Set([...Object.keys(first || {}), ...Object.keys(second || {})])].filter(k => !ignored.has(k)).sort();
  const comparisons = keys.map(field => {
    const a = canonical(first?.[field]);
    const b = canonical(second?.[field]);
    const match = a === b;
    return { field, match, critical: critical.has(field), first: first?.[field] ?? null, second: second?.[field] ?? null };
  });
  const matched = comparisons.filter(x => x.match).length;
  const conflicts = comparisons.filter(x => !x.match);
  const matchScore = keys.length ? Math.round((matched / keys.length) * 100) : 100;
  const criticalConflict = conflicts.some(x => x.critical);
  const threshold = Number(options.acceptanceThreshold || 90);
  const status = criticalConflict ? 'needs_me_review' : matchScore >= threshold ? 'verified' : matchScore >= 70 ? 'needs_supervisor_review' : 'needs_me_review';
  return { match_score: matchScore, conflict_score: 100 - matchScore, status, total_fields: keys.length, matched_fields: matched, conflicts };
}

export function selectVerificationMode({ riskScore = 0, criticalIndicator = false, randomValue = Math.random(), randomRate = 0.1 } = {}) {
  if (criticalIndicator || Number(riskScore) >= 80) return 'full_double_entry';
  if (Number(riskScore) >= 50) return 'supervisor_verification';
  if (Number(randomValue) < Number(randomRate)) return 'random_double_entry';
  return 'standard_qc';
}

export function scoreFraudAndQuality(input = {}) {
  const flags = [];
  let fraudRisk = 0;
  let quality = 100;
  const duration = Number(input.duration_seconds || 0);
  if (duration > 0 && duration < Number(input.minimum_duration_seconds || 60)) { flags.push('interview_too_fast'); fraudRisk += 25; quality -= 18; }
  if (input.gps_required && (!Number.isFinite(Number(input.latitude)) || !Number.isFinite(Number(input.longitude)))) { flags.push('gps_missing'); fraudRisk += 15; quality -= 12; }
  if (Number(input.gps_distance_meters || 0) > Number(input.allowed_gps_distance_meters || 1000)) { flags.push('gps_outside_assignment'); fraudRisk += 25; quality -= 18; }
  if (input.duplicate_fingerprint) { flags.push('possible_duplicate'); fraudRisk += 35; quality -= 25; }
  if (Number(input.straight_line_ratio || 0) >= 0.85) { flags.push('straight_lining'); fraudRisk += 20; quality -= 15; }
  if (Number(input.missing_required || 0) > 0) { flags.push('required_answers_missing'); quality -= Math.min(25, Number(input.missing_required) * 5); }
  if (input.consent_valid === false) { flags.push('consent_invalid'); fraudRisk += 20; quality -= 30; }
  fraudRisk = Math.max(0, Math.min(100, fraudRisk));
  quality = Math.max(0, Math.min(100, quality));
  return { fraud_risk_score: fraudRisk, quality_score: quality, flags, verification_mode: selectVerificationMode({ riskScore: fraudRisk, criticalIndicator: input.critical_indicator }) };
}

export function validateAssignment(input = {}) {
  const errors = [];
  if (!input.organization_id) errors.push('organization_id is required');
  if (!input.project_id) errors.push('project_id is required');
  if (!input.survey_id) errors.push('survey_id is required');
  if (!input.enumerator_id) errors.push('enumerator_id is required');
  return { valid: errors.length === 0, errors };
}

export function buildOperationsReadiness(input = {}) {
  const checks = {
    distribution_center: Boolean(input.distribution_center),
    web_collection: Boolean(input.web_collection),
    offline_sync: Boolean(input.offline_sync),
    enumerator_assignments: Boolean(input.enumerator_assignments),
    double_entry: Boolean(input.double_entry),
    supervisor_review: Boolean(input.supervisor_review),
    fraud_quality: Boolean(input.fraud_quality),
    twilio_sms: Boolean(input.twilio_sms),
    twilio_whatsapp: Boolean(input.twilio_whatsapp),
    twilio_voice: Boolean(input.twilio_voice),
    callbacks: Boolean(input.callbacks),
    retry_dead_letter: Boolean(input.retry_dead_letter),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { product_name: COLLECTION_OPERATIONS_PRODUCT, checks, readiness_score: Math.round((passed / Object.keys(checks).length) * 100), ready_for_controlled_pilot: passed >= 9 };
}
