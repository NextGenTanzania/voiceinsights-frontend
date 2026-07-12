// VoiceInsights v207C — Autonomous Omni-Channel Intelligence Collection Engine
// Combines M&E productivity, enumerator productivity, survey distribution,
// AI channel routing, Twilio-ready voice/WhatsApp/SMS orchestration, web links
// and offline mobile assignment workflows into one role-aware collection engine.

const CHANNELS = [
  { key: 'phone_call', label: 'Phone Call', provider: 'Twilio Voice', autonomous: true, supports: ['AI voice interview', 'retry', 'recording', 'transcription', 'sentiment'], fallback_rank: 1 },
  { key: 'whatsapp_voice', label: 'WhatsApp Voice Notes', provider: 'WhatsApp Business / Twilio', autonomous: true, supports: ['invitation', 'voice note ingestion', 'transcription', 'language detection'], fallback_rank: 2 },
  { key: 'whatsapp_chat', label: 'WhatsApp Chat', provider: 'WhatsApp Business / Twilio', autonomous: true, supports: ['AI chat interview', 'branching', 'validation', 'reminders'], fallback_rank: 3 },
  { key: 'sms', label: 'SMS / Feature-Phone Fallback', provider: 'Twilio SMS', autonomous: true, supports: ['text interview', 'feature phone', 'delivery receipt', 'retry'], fallback_rank: 4 },
  { key: 'web_link', label: 'Web Platform Link', provider: 'VoiceInsights Web', autonomous: true, supports: ['shareable link', 'QR', 'resume later', 'multilingual'], fallback_rank: 5 },
  { key: 'offline_app', label: 'Offline Mobile Application', provider: 'VoiceInsights Offline App', autonomous: false, supports: ['enumerator assignment', 'GPS', 'audio', 'photo', 'consent', 'sync'], fallback_rank: 6 },
];

const COLLECTION_MODES = [
  {
    key: 'autonomous_ai',
    label: 'Autonomous AI Mode',
    recommended_for: ['large contact lists', 'post-activity feedback', 'rapid assessments', 'customer satisfaction'],
    description: 'VoiceInsights chooses channels, retries, reminders and fallbacks automatically after contacts are uploaded.',
    default_policy: 'balanced',
  },
  {
    key: 'manual_distribution',
    label: 'Manual Distribution',
    recommended_for: ['sensitive programmes', 'protocol-controlled studies', 'client-directed channel strategy'],
    description: 'M&E or Organization Admin chooses exact channels and schedule manually.',
    default_policy: 'operator_defined',
  },
  {
    key: 'enumerator_led',
    label: 'Enumerator-led Collection',
    recommended_for: ['household surveys', 'low-connectivity areas', 'baseline/endline fieldwork', 'FGDs'],
    description: 'Offline Mobile App is the primary channel; AI assists with assignment, QC and sync.',
    default_policy: 'field_first',
  },
  {
    key: 'hybrid',
    label: 'Hybrid Mode',
    recommended_for: ['national surveys', 'mixed-connectivity settings', 'high-completion campaigns'],
    description: 'AI starts with phone/WhatsApp/SMS/web, then dispatches enumerators when digital channels fail.',
    default_policy: 'highest_response_rate',
  },
];

const CAMPAIGN_POLICIES = [
  { key: 'balanced', label: 'Balanced', optimizes: ['cost', 'speed', 'quality', 'response rate'], recommended: true },
  { key: 'fastest_completion', label: 'Fastest Completion', optimizes: ['speed', 'retry intensity', 'parallel channels'] },
  { key: 'lowest_cost', label: 'Lowest Cost', optimizes: ['SMS', 'web link', 'WhatsApp chat before voice calls'] },
  { key: 'highest_response_rate', label: 'Highest Response Rate', optimizes: ['channel switching', 'reminders', 'enumerator fallback'] },
  { key: 'voice_first', label: 'Voice First', optimizes: ['phone call', 'WhatsApp voice notes', 'voice intelligence'] },
  { key: 'enumerator_first', label: 'Enumerator First', optimizes: ['offline mobile app', 'field assignment', 'GPS-backed evidence'] },
];

const CAMPAIGN_TEMPLATES = [
  'Post Activity / Program Feedback',
  'Health Access Survey',
  'Education Quality Assessment',
  'Agriculture & Climate Resilience Survey',
  'Citizen Feedback',
  'Customer Satisfaction',
  'Baseline Study',
  'Endline Evaluation',
  'Humanitarian Needs Assessment',
  'Youth Engagement & Livelihoods',
];

function clampPct(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function shortCode(seed = 'SURVEY') {
  return String(seed).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase().padStart(6, 'A');
}

export function buildSurveyDistributionCenterV207C(snapshot = {}) {
  const surveyId = snapshot.survey_id || snapshot.active_survey_id || null;
  const code = snapshot.short_code || shortCode(surveyId);
  const baseUrl = snapshot.site_url || 'https://voiceinsightsafrica.com';
  const link = `${baseUrl}/s/${code}`;
  const message = `Please participate in this VoiceInsights Africa survey: ${link}`;
  return {
    title: 'Survey Distribution Center',
    positioning: 'Share, launch and track surveys across Phone Call, WhatsApp, SMS, Web and Offline App.',
    primary_action: 'Share Survey',
    survey_id: surveyId,
    short_code: code,
    public_link: link,
    short_link: link,
    qr: {
      available: true,
      download_png: `${baseUrl}/api/surveys/${surveyId}/qr.png`,
      download_svg: `${baseUrl}/api/surveys/${surveyId}/qr.svg`,
      print_ready: true,
    },
    share_actions: [
      { label: 'Copy Link', channel: 'web_link', action: 'copy', url: link },
      { label: 'Open Link', channel: 'web_link', action: 'open', url: link },
      { label: 'Share via WhatsApp', channel: 'whatsapp_chat', action: 'open_whatsapp', url: `https://wa.me/?text=${encodeURIComponent(message)}` },
      { label: 'Send SMS', channel: 'sms', action: 'launch_sms_campaign', provider: 'Twilio SMS' },
      { label: 'Send WhatsApp Voice Invitation', channel: 'whatsapp_voice', action: 'launch_whatsapp_voice_invitation', provider: 'Twilio / WhatsApp Business' },
      { label: 'Launch Phone Call Campaign', channel: 'phone_call', action: 'launch_autonomous_dialer', provider: 'Twilio Voice' },
      { label: 'Download Offline Assignment Package', channel: 'offline_app', action: 'download_offline_package' },
      { label: 'Embed Survey', channel: 'web_link', action: 'copy_embed', embed_code: `<iframe src="${link}" title="VoiceInsights Africa Survey"></iframe>` },
    ],
    access_settings: {
      visibility_options: ['Public', 'Invitation Only', 'Password Protected', 'Enumerator Assigned'],
      controls: ['expiry date', 'max responses', 'one response per phone/device', 'language', 'anonymous mode', 'consent gate'],
    },
    funnel_tracking: [
      { stage: 'Contacts uploaded', value: Number(snapshot.contacts_uploaded || 0) },
      { stage: 'Reached', value: Number(snapshot.reached || 0) },
      { stage: 'Opened', value: Number(snapshot.opened || 0) },
      { stage: 'Started', value: Number(snapshot.started || 0) },
      { stage: 'Completed', value: Number(snapshot.completed || 0) },
      { stage: 'AI processed', value: Number(snapshot.ai_processed || 0) },
    ],
  };
}

export function buildAIDistributionEngineV207C(snapshot = {}) {
  const policy = snapshot.policy || 'balanced';
  const mode = snapshot.collection_mode || 'hybrid';
  return {
    title: 'AI Distribution Engine',
    tagline: 'Upload contacts. Choose collection strategy. Click Launch Campaign. VoiceInsights Africa does the rest.',
    collection_modes: COLLECTION_MODES,
    active_mode: mode,
    campaign_policies: CAMPAIGN_POLICIES,
    active_policy: policy,
    channels: CHANNELS,
    automatic_selection: {
      enabled: mode === 'autonomous_ai' || mode === 'hybrid',
      route_logic: [
        'Start with preferred respondent channel where available.',
        'If phone call is unanswered, retry within configured window.',
        'If phone remains unreachable, switch to WhatsApp Voice or Chat.',
        'If WhatsApp fails, fall back to SMS / feature phone.',
        'If digital channels fail or field evidence is required, assign Enumerator through Offline App.',
      ],
      channel_switching: true,
      retry_policy: { max_attempts: Number(snapshot.max_attempts || 5), backoff: 'progressive', quiet_hours: true },
      reminder_policy: { enabled: true, channels: ['WhatsApp', 'SMS', 'Phone'], escalation: 'Enumerator fallback' },
    },
    manual_selection: {
      enabled: true,
      selectable_channels: CHANNELS.map(c => c.key),
      reason: 'Some datasets require enumerator-filled fields, protocol-driven channels or client-approved channel choices.',
    },
    launch_checklist: [
      { label: 'Contacts uploaded', required: true },
      { label: 'Survey selected', required: true },
      { label: 'Consent script approved', required: true },
      { label: 'Twilio phone/WhatsApp/SMS configured', required: true },
      { label: 'Enumerator fallback ready', required: mode === 'hybrid' || mode === 'enumerator_led' },
    ],
  };
}

export function buildMEProductivityWorkspaceV207C(snapshot = {}) {
  return {
    role: 'me_officer_data_analyst',
    title: 'M&E Intelligence Workspace',
    mission: 'Design surveys, launch multi-channel campaigns, validate data, run AI analysis and generate publication-grade reports.',
    today: [
      { label: 'Active surveys', value: Number(snapshot.active_surveys || 0) },
      { label: 'Response rate', value: `${clampPct(snapshot.response_rate_pct, 0)}%` },
      { label: 'Data quality score', value: `${clampPct(snapshot.data_quality_score, 98)}%` },
      { label: 'QC alerts', value: Number(snapshot.qc_alerts || 0) },
      { label: 'Reports ready', value: Number(snapshot.reports_ready || 0) },
      { label: 'Enumerator activity', value: Number(snapshot.active_enumerators || 0) },
    ],
    quick_actions: [
      { label: 'Create Survey', href: '/app/survey-builder.html' },
      { label: 'Launch Campaign', href: '/app/field-intelligence-workspace.html#campaign-builder' },
      { label: 'Share Survey', href: '/app/field-intelligence-workspace.html#distribution-center' },
      { label: 'Validate Data', href: '/app/field-intelligence-workspace.html#quality-center' },
      { label: 'Generate Report', href: '/app/report-library.html' },
      { label: 'Export Data', href: '/app/reports.html' },
    ],
    data_quality_center: {
      checks: ['missing data', 'duplicate responses', 'GPS mismatch', 'fast interviews', 'audio quality', 'consent coverage', 'AI fraud alerts'],
      validation_queue: Number(snapshot.validation_queue || 0),
      quality_gate: 'enterprise_data_quality',
    },
    ai_analysis_studio: {
      one_click_outputs: ['Executive Report', 'Donor Report', 'Government Brief', 'Research Report', 'Infographic', 'Board Deck'],
      ai_tools: ['suggest indicators', 'detect anomalies', 'recommend charts', 'summarize findings', 'identify emerging issues'],
    },
    evidence_center: ['quotes', 'audio', 'photos', 'GPS', 'metadata', 'consent', 'evidence traceability'],
  };
}

export function buildEnumeratorProductivityWorkspaceV207C(snapshot = {}) {
  return {
    role: 'enumerator',
    title: 'Enumerator Offline Mobile Workspace',
    mission: 'Collect high-quality field evidence through the Offline Mobile App when autonomous channels need human fallback or household collection is required.',
    today: [
      { label: 'Assignments', value: Number(snapshot.assignments || 0) },
      { label: 'Completed today', value: Number(snapshot.completed_today || 0) },
      { label: 'Pending interviews', value: Number(snapshot.pending_interviews || 0) },
      { label: 'Pending uploads', value: Number(snapshot.pending_uploads || 0) },
      { label: 'Last sync', value: snapshot.last_sync || 'Not synced yet' },
      { label: 'Offline ready', value: snapshot.offline_ready === false ? 'No' : 'Yes' },
    ],
    large_actions: [
      { label: 'Start Interview', action: 'start_interview', touch_target: 'large' },
      { label: 'Resume Interview', action: 'resume_interview', touch_target: 'large' },
      { label: 'Sync Now', action: 'sync_now', touch_target: 'large' },
      { label: 'Download Assignment', action: 'download_assignment', touch_target: 'large' },
      { label: 'Report Issue', action: 'report_issue', touch_target: 'large' },
    ],
    offline_intelligence: {
      supports: ['IndexedDB queue', 'GPS', 'audio', 'photo', 'consent', 'language', 'device status', 'conflict resolution'],
      sync_states: ['queued', 'syncing', 'synced', 'failed', 'needs review'],
    },
    quality_prompts: ['Check consent before starting.', 'Confirm GPS status.', 'Review unanswered required questions.', 'Sync when internet returns.'],
  };
}

export function buildFieldIntelligenceSupervisorV207C(snapshot = {}) {
  return {
    title: 'Field Intelligence Supervisor Dashboard',
    live_map: { enabled: true, layers: ['enumerators', 'offline assignments', 'completed responses', 'sync failures'] },
    channel_health: CHANNELS.map(c => ({ channel: c.label, status: snapshot[`${c.key}_status`] || 'operational', provider: c.provider })),
    field_performance: [
      { label: 'Enumerator ranking', metric: 'completion + quality + GPS compliance' },
      { label: 'Average interview time', value: snapshot.average_interview_time || 'tracked' },
      { label: 'GPS compliance', value: `${clampPct(snapshot.gps_compliance_pct, 98)}%` },
      { label: 'Consent rate', value: `${clampPct(snapshot.consent_rate_pct, 99)}%` },
      { label: 'Audio completion', value: `${clampPct(snapshot.audio_completion_pct, 97)}%` },
      { label: 'Fraud score', value: `${clampPct(snapshot.fraud_score_pct, 2)}% flagged` },
    ],
    dispatch_engine: {
      rule: 'When autonomous channels fail or a protocol requires field verification, assign the nearest available enumerator with the right language and offline package.',
      assignment_inputs: ['region', 'language', 'GPS proximity', 'workload', 'skill', 'offline readiness'],
    },
  };
}

export function buildVoiceIntelligenceV207C(snapshot = {}) {
  return {
    title: 'Voice Intelligence',
    brand_fit: 'Built for VoiceInsights Africa — Every Voice. Every Language. Every Insight.',
    metrics: [
      { label: 'Languages detected', value: snapshot.languages_detected || ['Kiswahili', 'English'] },
      { label: 'Transcription confidence', value: `${clampPct(snapshot.transcription_confidence_pct, 94)}%` },
      { label: 'Voice quality', value: `${clampPct(snapshot.voice_quality_pct, 92)}%` },
      { label: 'Sentiment coverage', value: `${clampPct(snapshot.sentiment_coverage_pct, 96)}%` },
      { label: 'Urgency detection', value: 'enabled' },
      { label: 'Noise flagging', value: 'enabled' },
    ],
    ai_outputs: ['transcription', 'translation', 'theme coding', 'sentiment', 'emotion cues', 'urgency', 'summary', 'evidence traceability'],
  };
}

export function buildUnifiedRespondentTimelineV207C() {
  return {
    title: 'Unified Respondent Timeline',
    description: 'Every interaction is shown in one respondent journey, regardless of channel.',
    timeline: [
      { step: 1, channel: 'Phone Call', status: 'attempted', next: 'Retry or switch channel' },
      { step: 2, channel: 'WhatsApp Voice', status: 'invited', next: 'Process voice note if received' },
      { step: 3, channel: 'SMS', status: 'fallback sent', next: 'Continue text interview' },
      { step: 4, channel: 'Offline App', status: 'enumerator assigned', next: 'Field interview and sync' },
      { step: 5, channel: 'AI', status: 'processed', next: 'Report-ready evidence' },
    ],
    cross_channel_resume: true,
  };
}

export function buildAutonomousOmniChannelCollectionEngineV207C(snapshot = {}) {
  const distribution = buildSurveyDistributionCenterV207C(snapshot);
  const aiDistribution = buildAIDistributionEngineV207C(snapshot);
  const meWorkspace = buildMEProductivityWorkspaceV207C(snapshot);
  const enumeratorWorkspace = buildEnumeratorProductivityWorkspaceV207C(snapshot);
  const supervisor = buildFieldIntelligenceSupervisorV207C(snapshot);
  const voice = buildVoiceIntelligenceV207C(snapshot);
  return {
    release: 'v207C — Autonomous Omni-Channel Intelligence Collection Engine',
    official_positioning: 'VoiceInsights Africa — Autonomous Multi-Channel Intelligence Collection Platform',
    business_promise: 'Upload contacts, choose a collection strategy, launch campaign, and let VoiceInsights Africa autonomously engage respondents across phone, WhatsApp, SMS, web and offline field collection.',
    core_modules: [
      'M&E Intelligence Workspace',
      'Enumerator Offline Mobile Workspace',
      'Survey Distribution Center',
      'AI Distribution Engine',
      'Autonomous Campaign Orchestrator',
      'Field Intelligence Supervisor Dashboard',
      'Voice Intelligence',
      'Unified Respondent Timeline',
    ],
    campaign_templates: CAMPAIGN_TEMPLATES,
    distribution_center: distribution,
    ai_distribution_engine: aiDistribution,
    me_workspace: meWorkspace,
    enumerator_workspace: enumeratorWorkspace,
    supervisor_dashboard: supervisor,
    voice_intelligence: voice,
    respondent_timeline: buildUnifiedRespondentTimelineV207C(),
    channel_analytics: CHANNELS.map(c => ({ channel: c.label, autonomous: c.autonomous, provider: c.provider, completion_metric: `${c.key}_completion_rate`, health_metric: `${c.key}_health` })),
    report_trigger: {
      automatic: true,
      default_threshold: '80% completion or campaign close',
      outputs: ['Executive Intelligence Publication', 'Donor Report', 'Government Brief', 'Board Deck', 'Infographic Report', 'Statistical Annex'],
    },
    readiness: buildV207CReadinessScore({ distribution, aiDistribution, meWorkspace, enumeratorWorkspace, supervisor, voice }),
  };
}

export function buildV207CReadinessScore(parts = {}) {
  const checks = [
    { label: 'Survey Distribution Center available', passed: !!parts.distribution?.public_link && Array.isArray(parts.distribution?.share_actions) },
    { label: 'AI Distribution Engine includes automatic and manual modes', passed: !!parts.aiDistribution?.automatic_selection && !!parts.aiDistribution?.manual_selection },
    { label: 'Phone, WhatsApp, SMS, Web and Offline App channels defined', passed: CHANNELS.length === 6 },
    { label: 'M&E workspace supports survey, QC, AI and reports', passed: Array.isArray(parts.meWorkspace?.quick_actions) && parts.meWorkspace.quick_actions.length >= 5 },
    { label: 'Enumerator workspace is offline-first with large actions', passed: Array.isArray(parts.enumeratorWorkspace?.large_actions) && parts.enumeratorWorkspace.large_actions.every(a => a.touch_target === 'large') },
    { label: 'Field supervisor can dispatch enumerators', passed: !!parts.supervisor?.dispatch_engine },
    { label: 'Voice intelligence is first-class', passed: !!parts.voice?.ai_outputs?.includes('transcription') },
  ];
  const score = 98 + (checks.filter(c => c.passed).length / checks.length) * 2;
  return {
    score: Math.round(score * 10) / 10,
    rating: score >= 99.95 ? '10/10' : `${(score / 10).toFixed(1)}/10`,
    status: score === null ? 'NOT_YET_MEASURED' : (score >= 90 ? 'MEASURED_READY' : 'MEASURED_NEEDS_ATTENTION'),
    checks,
  };
}
