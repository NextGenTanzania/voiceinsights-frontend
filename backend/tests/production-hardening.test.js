import test from 'node:test';
import assert from 'node:assert/strict';
import { isTwilioWebhookPath } from '../src/twilio-security.js';
import { validateEnvironment } from '../src/environment-validation.js';
import { executeQueueAdapter } from '../src/queue-adapters.js';
import { QUEUE_BINDING_BY_JOB_TYPE, buildQueueMessage } from '../src/cloudflare-queue-platform.js';
import {
  evaluateMethodologyGate, displayMetric, buildSignedOfflinePackage,
  resolveOfflineConflict, compareDoubleEntryRecords, detectPlaceholderContent,
  auditAccessibilityHtml, calculateReadiness
} from '../src/production-hardening.js';

test('Twilio matcher guards dynamic voice and all Twilio callback families', () => {
  assert.equal(isTwilioWebhookPath('/api/voice/status/completed'), true);
  assert.equal(isTwilioWebhookPath('/api/twilio/callback/voice'), true);
  assert.equal(isTwilioWebhookPath('/api/twilio/delivery/sms'), true);
  assert.equal(isTwilioWebhookPath('/api/public/report'), false);
});

test('production environment rejects demo tenant defaults and missing workload queues', () => {
  const r = validateEnvironment({ ENVIRONMENT:'production', DB:{}, AUDIO_BUCKET:{}, OPERATIONS_QUEUE:{}, JWT_SECRET:'x', STRICT_CORS:'true', SITE_URL:'https://voiceinsightsafrica.com', DEFAULT_ORG_ID:'org_demo' }, 'production');
  assert.equal(r.valid, false);
  assert.ok(r.missing_critical.some(x => x.includes('DEFAULT_ORG_ID')));
  assert.ok(r.missing_critical.includes('AI_QUEUE'));
});

test('all production job types route to explicit Cloudflare bindings', () => {
  for (const type of ['ai.processing','audio.transcription','translation','whatsapp.delivery','sms.delivery','voice.processing','report.generation','export.pdf','notification.delivery','offline.sync']) {
    assert.ok(QUEUE_BINDING_BY_JOB_TYPE[type], `${type} must map to a queue`);
  }
});

test('built-in queue adapter validates its production payload contract', async () => {
  await assert.rejects(executeQueueAdapter({ job_type:'ai.processing', payload:{} }, {}), e => e.code === 'INVALID_JOB_PAYLOAD' && e.retryable === false);
});

test('queue adapter only succeeds when the injected adapter confirms ok', async () => {
  const result = await executeQueueAdapter({ job_type:'ai.processing' }, { JOB_ADAPTERS:{ 'ai.processing': async () => ({ ok:true, output_ref:'r2://result' }) } });
  assert.equal(result.ok, true);
});

test('queue message preserves tenant, idempotency and correlation context', () => {
  const m = buildQueueMessage({ jobType:'offline.sync', tenantId:'org-1', projectId:'p-1', idempotencyKey:'idem-1' });
  assert.equal(m.tenant_id, 'org-1');
  assert.equal(m.idempotency_key, 'idem-1');
  assert.ok(m.correlation_id);
});

test('methodology gate cannot reach publication without all required evidence', () => {
  const partial = evaluateMethodologyGate({ research_objectives:['x'], evaluation_questions:['q'] });
  assert.equal(partial.publication_allowed, false);
  const complete = Object.fromEntries([
    'research_objectives','evaluation_questions','sampling_frame','sample_size_calculation','consent','ethics',
    'analysis_plan','weights','missing_data_treatment','data_dictionary','reproducibility','confidence_intervals',
    'reliability','validity','limitations','evidence_lineage','disclosure_control','quality_statement'
  ].map(k => [k, k === 'weights' ? [1] : { documented:true }]));
  assert.equal(evaluateMethodologyGate(complete).state, 'READY_FOR_PUBLICATION');
});

test('unobserved metrics remain unmeasured rather than zero or operational', () => {
  assert.equal(displayMetric(null).status, 'NOT_YET_MEASURED');
  assert.equal(displayMetric(null,{configured:false}).status, 'NOT_CONFIGURED');
  assert.equal(displayMetric(0,{observed:true}).status, 'MEASURED');
});

test('offline package requires governed assignment and survey metadata', () => {
  assert.equal(buildSignedOfflinePackage({ assignment_id:'a' }).valid, false);
  const r = buildSignedOfflinePackage({ assignment_id:'a',organization_id:'o',project_id:'p',survey_id:'s',survey_version:'2',questions:[{id:'q'}],consent_scripts:['c'],expires_at:'2030-01-01' });
  assert.equal(r.valid, true);
  assert.equal(r.package.signature_required, true);
});

test('offline conflicts expose field-level values and governed actions', () => {
  const r = resolveOfflineConflict({ local:{age:22,name:'A'},server:{age:23,name:'A'},local_timestamp:'1',server_timestamp:'2' });
  assert.equal(r.conflicts.length, 1);
  assert.ok(r.permitted_actions.includes('MERGE'));
  assert.equal(r.me_approval_required, true);
});

test('double entry mismatch requires supervisor review', () => {
  assert.equal(compareDoubleEntryRecords({a:1},{a:2}).status, 'MISMATCH_REVIEW_REQUIRED');
  assert.equal(compareDoubleEntryRecords({a:1},{a:1}).status, 'MATCHED');
});

test('placeholder detector catches dead production interactions but exempts labelled synthetic demos', () => {
  assert.deepEqual(detectPlaceholderContent('<a href="#">Coming soon</a>'), ['COMING_SOON','DEAD_HREF']);
  assert.deepEqual(detectPlaceholderContent('<a href="#">Coming soon</a>',{syntheticDemo:true}), []);
});

test('accessibility audit detects primary structural violations', () => {
  const bad = auditAccessibilityHtml('<html><body><img src="x"><input></body></html>');
  assert.equal(bad.compliant, false);
  assert.ok(bad.issues.includes('MISSING_LANGUAGE_METADATA'));
  assert.ok(bad.issues.includes('IMAGE_WITHOUT_ALT'));
  const good = auditAccessibilityHtml('<html lang="en"><body><a href="#main">Skip</a><main id="main"><img src="x" alt=""><label>Name<input></label></main></body></html>');
  assert.equal(good.compliant, true);
});

test('readiness separates source-code completeness from externally verified live readiness', () => {
  const r = calculateReadiness([{id:'queue',implemented:true,secured:true,persisted:true,ui:true,tested:true,monitored:true,error_handling:true,external_validation:false}]);
  assert.equal(r.source_code_readiness, 100);
  assert.equal(r.verified_live_production_readiness, 0);
});
