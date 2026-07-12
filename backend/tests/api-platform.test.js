import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenApiSpec, buildApiPlatformWorkspace, validatePlaygroundRequest, API_AUTHENTICATION_MODES, API_RATE_LIMIT_TIERS } from '../src/api-platform.js';

test('v210.6 exposes every requested API Platform module', () => {
  const w = buildApiPlatformWorkspace();
  for (const module of ['Developer Portal','Swagger / OpenAPI','API Playground','SDK Docs','Authentication','Rate Limits','API Keys','Examples']) assert.ok(w.modules.includes(module));
});

test('OpenAPI contract declares authentication and core endpoints', () => {
  const spec = buildOpenApiSpec();
  assert.equal(spec.openapi, '3.1.0');
  assert.ok(spec.components.securitySchemes.bearerAuth);
  assert.ok(spec.components.securitySchemes.apiKeyAuth);
  assert.ok(spec.paths['/api/health']);
  assert.ok(spec.paths['/api/knowledge/v2105/search']);
  assert.ok(spec.paths['/api/reports/assistant']);
});

test('API Platform documents scoped auth and rate limit tiers', () => {
  assert.ok(API_AUTHENTICATION_MODES.some(x => x.id === 'api_key'));
  assert.ok(API_RATE_LIMIT_TIERS.some(x => x.tier === 'Enterprise'));
});

test('playground request validation blocks external URLs and allows approved API paths', () => {
  assert.equal(validatePlaygroundRequest({method:'GET',path:'/api/health'}).ok, true);
  assert.equal(validatePlaygroundRequest({method:'POST',path:'/api/reports/assistant'}).ok, true);
  assert.equal(validatePlaygroundRequest({method:'GET',path:'https://evil.example'}).ok, false);
  assert.equal(validatePlaygroundRequest({method:'TRACE',path:'/api/health'}).ok, false);
});

test('API key summary is derived from actual key records', () => {
  const w = buildApiPlatformWorkspace({apiKeys:[{status:'active',revoked_at:null},{status:'revoked',revoked_at:'2026-01-01'}]});
  assert.equal(w.api_key_summary.total,2);
  assert.equal(w.api_key_summary.active,1);
});
