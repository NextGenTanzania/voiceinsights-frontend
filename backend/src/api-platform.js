// VoiceInsights v210.6 — API Platform
// Developer portal, OpenAPI contract, playground metadata, SDK docs, authentication and rate-limit guidance.

export const API_PLATFORM_V2106_VERSION = 'v210.6.0';

const API_BASE = 'https://voiceinsights-api.kitentyatsnp.workers.dev';

export const API_AUTHENTICATION_MODES = [
  {
    id: 'bearer_session',
    label: 'Bearer session token',
    header: 'Authorization: Bearer <token>',
    use_case: 'Interactive dashboard and first-party applications',
    rotation: 'Short-lived session policy',
  },
  {
    id: 'api_key',
    label: 'Scoped API key',
    header: 'X-API-Key: vi_live_••••',
    use_case: 'Server-to-server integrations and partner applications',
    rotation: 'Rotate regularly and revoke immediately when exposed',
  },
  {
    id: 'webhook_signature',
    label: 'Webhook signature',
    header: 'X-VoiceInsights-Signature: sha256=••••',
    use_case: 'Authenticating outbound VoiceInsights webhook events',
    rotation: 'Versioned signing secret',
  },
];

export const API_RATE_LIMIT_TIERS = [
  { tier: 'Standard', requests_per_minute: 60, burst: 20, audience: 'Evaluation and standard integrations' },
  { tier: 'Professional', requests_per_minute: 300, burst: 100, audience: 'Production organization integrations' },
  { tier: 'Enterprise', requests_per_minute: 1200, burst: 300, audience: 'High-volume and national programmes' },
];

export const API_EXAMPLES = [
  {
    id: 'health',
    title: 'Check platform health',
    method: 'GET',
    path: '/api/health',
    auth: false,
    curl: `curl ${API_BASE}/api/health`,
    javascript: `const response = await fetch('${API_BASE}/api/health');\nconst health = await response.json();`,
  },
  {
    id: 'knowledge-search',
    title: 'Search organization knowledge',
    method: 'GET',
    path: '/api/knowledge/v2105/search?q=health&type=report',
    auth: true,
    scopes: ['knowledge:read'],
    curl: `curl -H "Authorization: Bearer $VOICEINSIGHTS_TOKEN" "${API_BASE}/api/knowledge/v2105/search?q=health&type=report"`,
    javascript: `const response = await fetch('${API_BASE}/api/knowledge/v2105/search?q=health&type=report', {\n  headers: { Authorization: 'Bearer ' + token }\n});`,
  },
  {
    id: 'campaign-launch',
    title: 'Launch a multi-channel campaign',
    method: 'POST',
    path: '/api/production/v2102/campaigns/launch',
    auth: true,
    scopes: ['campaigns:create'],
    curl: `curl -X POST ${API_BASE}/api/production/v2102/campaigns/launch \\\n  -H "Authorization: Bearer $VOICEINSIGHTS_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"survey_id":"survey_123","channels":["web","sms"],"strategy":"hybrid"}'`,
    javascript: `await fetch('${API_BASE}/api/production/v2102/campaigns/launch', {\n  method: 'POST',\n  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },\n  body: JSON.stringify({ survey_id: 'survey_123', channels: ['web','sms'], strategy: 'hybrid' })\n});`,
  },
  {
    id: 'report-workspace',
    title: 'Open Enterprise Reports workspace',
    method: 'GET',
    path: '/api/reports/workspace?sector=health&country=Tanzania',
    auth: true,
    scopes: ['reports:read'],
    curl: `curl -H "Authorization: Bearer $VOICEINSIGHTS_TOKEN" "${API_BASE}/api/reports/workspace?sector=health&country=Tanzania"`,
    javascript: `const reportWorkspace = await fetch('${API_BASE}/api/reports/workspace?sector=health&country=Tanzania', {\n  headers: { Authorization: 'Bearer ' + token }\n}).then(r => r.json());`,
  },
];

function endpoint(method, path, summary, tag, options = {}) {
  return {
    [method.toLowerCase()]: {
      tags: [tag],
      summary,
      operationId: options.operationId || `${method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
      security: options.public ? [] : [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      parameters: options.parameters || [],
      requestBody: options.requestBody,
      responses: options.responses || {
        200: { description: 'Successful response', content: { 'application/json': { schema: { type: 'object' } } } },
        401: { description: 'Authentication required' },
        403: { description: 'Permission or scope denied' },
        429: { description: 'Rate limit exceeded' },
      },
    },
  };
}

export function buildOpenApiSpec(origin = API_BASE) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'VoiceInsights Africa Public API',
      version: API_PLATFORM_V2106_VERSION,
      description: 'APIs for autonomous multi-channel collection, organization knowledge, enterprise reports, security and integrations.',
      contact: { name: 'VoiceInsights Africa API Support', email: 'info@voiceinsightsafrica.com' },
    },
    servers: [{ url: origin, description: 'Production API' }],
    tags: [
      { name: 'Platform', description: 'Health and platform information' },
      { name: 'Knowledge', description: 'Organization-scoped institutional knowledge' },
      { name: 'Reports', description: 'Enterprise reports and presentation services' },
      { name: 'Campaigns', description: 'Campaign launch and orchestration' },
      { name: 'Security', description: 'Identity and API key services' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: { error: { type: 'string' }, correlation_id: { type: 'string' } },
        },
      },
    },
    paths: {
      '/api/health': endpoint('GET', '/api/health', 'Check API, database and storage health', 'Platform', { public: true }),
      '/api/knowledge/v2105/workspace': endpoint('GET', '/api/knowledge/v2105/workspace', 'Get Knowledge Cloud workspace', 'Knowledge'),
      '/api/knowledge/v2105/search': endpoint('GET', '/api/knowledge/v2105/search', 'Search reports, evidence, recommendations and lessons', 'Knowledge', {
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['report','recommendation','lesson','evidence','knowledge_note'] } },
          { name: 'sector', in: 'query', schema: { type: 'string' } },
        ],
      }),
      '/api/reports/workspace': endpoint('GET', '/api/reports/workspace', 'Build Enterprise Reports workspace', 'Reports'),
      '/api/reports/assistant': endpoint('POST', '/api/reports/assistant', 'Ask the report assistant a grounded question', 'Reports', {
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['question'], properties: { question: { type: 'string' }, report: { type: 'object' } } } } } },
      }),
      '/api/production/v2102/campaigns/launch': endpoint('POST', '/api/production/v2102/campaigns/launch', 'Launch an approved multi-channel campaign', 'Campaigns'),
      '/api/security/v2103a/api-keys': {
        ...endpoint('GET', '/api/security/v2103a/api-keys', 'List scoped API keys', 'Security'),
        ...endpoint('POST', '/api/security/v2103a/api-keys', 'Create a scoped API key', 'Security'),
      },
    },
  };
}

export function buildSdkDocumentation() {
  return {
    javascript: {
      package: '@voiceinsights/sdk',
      install: 'npm install @voiceinsights/sdk',
      quickstart: `import { VoiceInsights } from '@voiceinsights/sdk';\n\nconst vi = new VoiceInsights({ apiKey: process.env.VOICEINSIGHTS_API_KEY });\nconst health = await vi.health.check();`,
      modules: ['health','campaigns','surveys','responses','reports','knowledge','webhooks'],
    },
    rest: {
      base_url: API_BASE,
      content_type: 'application/json',
      authentication: 'Bearer token or X-API-Key',
    },
    webhook_events: [
      'campaign.created','campaign.launched','response.completed','ai.processing.completed','report.generated','export.ready','consent.withdrawn',
    ],
  };
}

export function buildApiPlatformWorkspace(options = {}) {
  const apiKeys = Array.isArray(options.apiKeys) ? options.apiKeys : [];
  return {
    version: API_PLATFORM_V2106_VERSION,
    label: 'VoiceInsights API Platform',
    mission: 'Give partners and developers secure, documented and testable access to VoiceInsights Cloud™.',
    modules: ['Developer Portal','Swagger / OpenAPI','API Playground','SDK Docs','Authentication','Rate Limits','API Keys','Examples'],
    production_api: API_BASE,
    openapi_url: '/api/platform/v2106/openapi.json',
    authentication: API_AUTHENTICATION_MODES,
    rate_limits: API_RATE_LIMIT_TIERS,
    sdk: buildSdkDocumentation(),
    examples: API_EXAMPLES,
    api_key_summary: {
      active: apiKeys.filter(k => k.status === 'active' && !k.revoked_at).length,
      expiring_soon: apiKeys.filter(k => k.expires_at && new Date(k.expires_at).getTime() - Date.now() < 30 * 86400000).length,
      total: apiKeys.length,
    },
    security: {
      raw_keys_returned_after_creation: false,
      organization_scoped: true,
      scopes_required: true,
      rate_limits_enforced_at_gateway: true,
      audit_key_lifecycle: true,
    },
  };
}

export function validatePlaygroundRequest(input = {}) {
  const method = String(input.method || 'GET').toUpperCase();
  const path = String(input.path || '');
  const allowedMethods = ['GET','POST','PUT','PATCH','DELETE'];
  const allowedPrefixes = ['/api/health','/api/knowledge/','/api/reports/','/api/production/','/api/security/'];
  if (!allowedMethods.includes(method)) return { ok: false, error: 'Unsupported HTTP method' };
  if (!path.startsWith('/') || !allowedPrefixes.some(p => path.startsWith(p))) return { ok: false, error: 'Only approved VoiceInsights API paths are allowed' };
  if (/https?:\/\//i.test(path)) return { ok: false, error: 'Absolute external URLs are not allowed' };
  return { ok: true, method, path };
}
