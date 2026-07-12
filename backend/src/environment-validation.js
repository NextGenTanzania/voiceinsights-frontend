export const PLATFORM_VERSION = '1.0.0';

const CRITICAL_BINDINGS = ['DB','AUDIO_BUCKET','OPERATIONS_QUEUE','AI_QUEUE','TRANSCRIPTION_QUEUE','TRANSLATION_QUEUE','WHATSAPP_QUEUE','SMS_QUEUE','VOICE_QUEUE','REPORT_QUEUE','EXPORT_QUEUE','NOTIFICATION_QUEUE','OFFLINE_SYNC_QUEUE'];
const CRITICAL_SECRETS = ['JWT_SECRET'];
const OPTIONAL_SECRETS = ['OPENAI_API_KEY','ANTHROPIC_API_KEY','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','RESEND_API_KEY'];

export function validateEnvironment(env = {}, mode = env.ENVIRONMENT || 'development') {
  const missingCritical = [];
  const warnings = [];
  for (const name of CRITICAL_BINDINGS) if (!env[name]) missingCritical.push(name);
  for (const name of CRITICAL_SECRETS) if (!env[name]) missingCritical.push(name);
  if (mode === 'production') {
    if (env.STRICT_CORS !== 'true') missingCritical.push('STRICT_CORS=true');
    if (!env.SITE_URL || /localhost|pages\.dev|workers\.dev/.test(env.SITE_URL)) missingCritical.push('production SITE_URL');
    for (const key of ['DEFAULT_ORG_ID','DEFAULT_CAMPAIGN_ID','DEFAULT_QUESTION_ID']) {
      if (String(env[key] || '').includes('demo') || String(env[key] || '').includes('default')) missingCritical.push(`${key} must not be demo/default in production`);
    }
  }
  for (const name of OPTIONAL_SECRETS) if (!env[name]) warnings.push(`${name} not configured; related integration is disabled`);
  return {
    version: PLATFORM_VERSION,
    environment: mode,
    valid: missingCritical.length === 0,
    status: missingCritical.length ? 'not_ready' : warnings.length ? 'ready_with_warnings' : 'ready',
    missing_critical: missingCritical,
    warnings,
    checked_at: new Date().toISOString(),
  };
}

export function assertRuntimeEnvironment(env, mode = env.ENVIRONMENT || 'development') {
  const result = validateEnvironment(env, mode);
  if (!result.valid) {
    const err = new Error(`Critical environment validation failed: ${result.missing_critical.join(', ')}`);
    err.code = 'ENVIRONMENT_NOT_READY';
    err.validation = result;
    throw err;
  }
  return result;
}
