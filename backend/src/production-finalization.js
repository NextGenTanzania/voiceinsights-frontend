// VoiceInsights Africa v210.2 — Production Finalization
// Real workflow adapters, production routing, campaign launch, approvals, notifications and QA.

export const V2102_VERSION = 'v210.2.0';
export const PRODUCTION_ORIGIN = 'https://voiceinsightsafrica.com';

export function resolveProductionOrigin(input = {}) {
  const configured = String(input.siteUrl || input.site_url || '').trim();
  const candidate = configured || PRODUCTION_ORIGIN;
  try {
    const u = new URL(candidate);
    if (u.hostname.endsWith('.pages.dev') || ['localhost', '127.0.0.1'].includes(u.hostname)) return PRODUCTION_ORIGIN;
    return `${u.protocol}//${u.host}`;
  } catch (_) {
    return PRODUCTION_ORIGIN;
  }
}

export function productionUrl(path = '/', input = {}) {
  const origin = resolveProductionOrigin(input);
  const normalized = String(path || '/').startsWith('/') ? String(path || '/') : `/${path}`;
  return `${origin}${normalized}`;
}

export const QUEUE_TYPES = Object.freeze(['phone', 'whatsapp', 'sms', 'offline', 'ai', 'report', 'export']);

export function buildQueueJob(type, payload = {}, options = {}) {
  if (!QUEUE_TYPES.includes(type)) throw new Error(`Unsupported queue type: ${type}`);
  return {
    id: options.id || `job_${crypto.randomUUID()}`,
    queue: type,
    campaign_id: payload.campaign_id || null,
    organization_id: payload.organization_id || null,
    priority: Math.max(1, Math.min(10, Number(options.priority || payload.priority || 5))),
    status: 'queued',
    attempts: 0,
    max_attempts: Number(options.max_attempts || 5),
    next_attempt_at: new Date().toISOString(),
    payload,
    created_at: new Date().toISOString()
  };
}

export function buildCampaignPlan(input = {}) {
  const channels = Array.isArray(input.channels) && input.channels.length ? input.channels : ['web'];
  return {
    id: input.id || `campaign_${crypto.randomUUID()}`,
    survey_id: input.survey_id || null,
    organization_id: input.organization_id || null,
    name: input.name || 'New Intelligence Collection Campaign',
    contacts: Array.isArray(input.contacts) ? input.contacts : [],
    contact_count: Number(input.contact_count || input.contacts?.length || 0),
    channels,
    ai_strategy: input.ai_strategy || 'hybrid',
    policy: input.policy || 'balanced',
    status: 'ready_to_launch',
    steps: ['survey', 'contacts', 'channels', 'ai_strategy', 'launch'],
    created_at: new Date().toISOString()
  };
}

export function buildDistributionActions(input = {}) {
  const surveyCode = input.survey_code || 'EYDEMO';
  const link = productionUrl(`/s/${encodeURIComponent(surveyCode)}`, input);
  return {
    public_link: link,
    actions: [
      { key: 'copy_link', label: 'Copy Link', workflow: 'clipboard + event analytics' },
      { key: 'open_link', label: 'Open Link', workflow: 'open + event analytics' },
      { key: 'whatsapp', label: 'Share via WhatsApp', workflow: 'Twilio/WhatsApp template + delivery status' },
      { key: 'sms', label: 'Send SMS', workflow: 'Twilio SMS + retry + delivery status' },
      { key: 'whatsapp_voice', label: 'Send WhatsApp Voice Invitation', workflow: 'voice asset + Twilio WhatsApp media' },
      { key: 'phone', label: 'Launch Phone Call Campaign', workflow: 'Twilio Voice queue + bot + transcription' },
      { key: 'offline', label: 'Download Offline Assignment Package', workflow: 'signed package + sync registration' },
      { key: 'embed', label: 'Embed Survey', workflow: 'iframe + JavaScript SDK + QR + API' },
      { key: 'qr', label: 'Generate QR Code', workflow: 'production survey QR' }
    ]
  };
}

export function buildOperationsDashboard(data = {}) {
  return {
    version: V2102_VERSION,
    title: 'Operations Dashboard',
    cards: {
      daily_pipeline: Number(data.daily_pipeline || 0),
      pending_meetings: Number(data.pending_meetings || 0),
      pending_contracts: Number(data.pending_contracts || 0),
      pending_approval: Number(data.pending_approval || 0),
      active_projects: Number(data.active_projects || 0),
      upcoming_launches: Number(data.upcoming_launches || 0),
      revenue_pipeline: Number(data.revenue_pipeline || 0),
      approval_requests: Number(data.approval_requests || 0),
      unread_notifications: Number(data.unread_notifications || 0)
    },
    quick_actions: ['create_client_record', 'upload_proposal', 'upload_contract', 'upload_invoice', 'submit_for_founder_approval', 'invite_organization_users']
  };
}

export function buildFounderDashboard(data = {}) {
  return {
    version: V2102_VERSION,
    title: 'Founder Executive Dashboard',
    cards: {
      pending_approvals: Number(data.pending_approvals || 0),
      organizations: Number(data.organizations || 0),
      revenue: Number(data.revenue || 0),
      recent_invites: Number(data.recent_invites || 0),
      platform_health: data.platform_health || 'operational',
      cloud_health: data.cloud_health || 'operational',
      security_alerts: Number(data.security_alerts || 0)
    },
    executive_actions: ['approve', 'reject', 'request_changes', 'manage_operations_manager', 'suspend_organization', 'view_audit']
  };
}

export function buildApprovalExecution(request = {}, actor = {}) {
  if (!['super_admin', 'founder_executive', 'founder'].includes(actor.role)) {
    return { ok: false, status: 403, error: 'Founder authorization required' };
  }
  return {
    ok: true,
    approval_id: request.id || `approval_${crypto.randomUUID()}`,
    decision: request.decision || 'approve',
    approved_by: actor.user_id || actor.email || 'founder',
    approved_at: new Date().toISOString(),
    cloud_actions: ['create_organization', 'create_project', 'create_workspace', 'assign_operations_manager', 'enable_invites', 'create_campaign_draft', 'notify_operations_manager']
  };
}

export function buildNotification(input = {}) {
  return {
    id: input.id || `notification_${crypto.randomUUID()}`,
    audience_role: input.audience_role || 'operations_manager',
    organization_id: input.organization_id || null,
    user_id: input.user_id || null,
    title: input.title || 'VoiceInsights notification',
    message: input.message || '',
    channel: input.channel || 'in_app',
    status: 'queued',
    created_at: new Date().toISOString()
  };
}

export function buildProductionReadiness(input = {}) {
  const checks = {
    production_domain: resolveProductionOrigin(input) === PRODUCTION_ORIGIN,
    database: Boolean(input.database),
    storage: Boolean(input.storage),
    twilio_voice: Boolean(input.twilio_voice),
    twilio_sms: Boolean(input.twilio_sms),
    whatsapp: Boolean(input.whatsapp),
    queues: Boolean(input.queues),
    notifications: Boolean(input.notifications),
    approval_engine: Boolean(input.approval_engine)
  };
  const critical = ['production_domain', 'database', 'storage', 'queues', 'approval_engine'];
  const ready = critical.every(k => checks[k]);
  return { version: V2102_VERSION, ready, status: ready ? 'READY' : 'ACTION_REQUIRED', checks };
}

export async function sendTwilioSms(env, { to, body, statusCallback }) {
  const smsFrom = env.TWILIO_SMS_FROM || env.TWILIO_PHONE_NUMBER;
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !smsFrom) {
    return { ok: false, configured: false, error: 'Twilio SMS environment variables are not configured' };
  }
  const form = new URLSearchParams({ To: to, From: smsFrom, Body: body });
  if (statusCallback) form.set('StatusCallback', statusCallback);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form
  });
  const data = await res.json();
  return { ok: res.ok, configured: true, status: res.status, provider: 'twilio', provider_response: data };
}

export async function sendTwilioWhatsApp(env, { to, body, mediaUrl, statusCallback }) {
  const whatsappFrom = env.TWILIO_WHATSAPP_FROM || env.TWILIO_WHATSAPP_NUMBER;
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !whatsappFrom) {
    return { ok: false, configured: false, error: 'Twilio WhatsApp environment variables are not configured' };
  }
  const normalizedTo = String(to).startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const normalizedFrom = String(whatsappFrom).startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`;
  const form = new URLSearchParams({ To: normalizedTo, From: normalizedFrom, Body: body || '' });
  if (mediaUrl) form.set('MediaUrl', mediaUrl);
  if (statusCallback) form.set('StatusCallback', statusCallback);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form
  });
  const data = await res.json();
  return { ok: res.ok, configured: true, status: res.status, provider: 'twilio_whatsapp', provider_response: data };
}

export async function startTwilioCall(env, { to, twimlUrl, statusCallback }) {
  const voiceFrom = env.TWILIO_VOICE_FROM || env.TWILIO_PHONE_NUMBER;
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !voiceFrom) {
    return { ok: false, configured: false, error: 'Twilio Voice environment variables are not configured' };
  }
  const form = new URLSearchParams({ To: to, From: voiceFrom, Url: twimlUrl });
  if (statusCallback) form.set('StatusCallback', statusCallback);
  form.set('StatusCallbackEvent', 'initiated ringing answered completed');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`, {
    method: 'POST', headers: { Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form
  });
  const data = await res.json();
  return { ok: res.ok, configured: true, status: res.status, provider: 'twilio_voice', provider_response: data };
}
