import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTwilioSenders, mapTwilioStatus, decideDeliveryRetry, buildOfflineSyncDecision, compareDoubleEntries, selectVerificationMode, scoreFraudAndQuality, validateAssignment, buildOperationsReadiness } from '../src/collection-operations-workstream2.js';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);

test('Twilio sender compatibility supports existing and new secret names', () => {
  assert.deepEqual(resolveTwilioSenders({TWILIO_PHONE_NUMBER:'+2551',TWILIO_WHATSAPP_NUMBER:'whatsapp:+2552'}), {sms:'+2551',whatsapp:'whatsapp:+2552',voice:'+2551'});
  assert.equal(resolveTwilioSenders({TWILIO_SMS_FROM:'+1'}).sms,'+1');
});

test('delivery statuses normalize and failures enter retry then dead-letter', () => {
  assert.equal(mapTwilioStatus('delivered'),'delivered');
  assert.equal(decideDeliveryRetry({providerStatus:'failed',attempts:0,maxAttempts:5}).status,'retry_scheduled');
  assert.equal(decideDeliveryRetry({providerStatus:'undelivered',attempts:4,maxAttempts:5}).status,'dead_letter');
});

test('offline synchronization detects duplicate and version conflicts', () => {
  assert.equal(buildOfflineSyncDecision({clientVersion:2,serverVersion:1}).action,'accept_client');
  assert.equal(buildOfflineSyncDecision({clientVersion:1,serverVersion:2}).conflict,true);
  assert.equal(buildOfflineSyncDecision({clientVersion:1,serverVersion:1,clientUpdatedAt:'2026-01-01',serverUpdatedAt:'2026-01-01'}).action,'duplicate');
});

test('double-entry comparison produces field-level match and escalation', () => {
  const ok=compareDoubleEntries({age:30,consent:true,region:'Dar'}, {age:30,consent:true,region:'dar'});
  assert.equal(ok.match_score,100); assert.equal(ok.status,'verified');
  const bad=compareDoubleEntries({age:30,consent:true}, {age:31,consent:false},{criticalFields:['consent']});
  assert.equal(bad.status,'needs_me_review'); assert.equal(bad.conflicts.length,2);
});

test('adaptive verification responds to risk and critical indicators', () => {
  assert.equal(selectVerificationMode({riskScore:90}),'full_double_entry');
  assert.equal(selectVerificationMode({riskScore:55}),'supervisor_verification');
  assert.equal(selectVerificationMode({riskScore:10,randomValue:0.01,randomRate:0.1}),'random_double_entry');
});

test('fraud and quality engine flags fast, duplicate and invalid-consent records', () => {
  const x=scoreFraudAndQuality({duration_seconds:20,minimum_duration_seconds:60,duplicate_fingerprint:true,consent_valid:false});
  assert.ok(x.fraud_risk_score>=80); assert.ok(x.quality_score<50); assert.equal(x.verification_mode,'full_double_entry');
});

test('assignment validation and readiness are measurable', () => {
  assert.equal(validateAssignment({}).valid,false);
  assert.equal(validateAssignment({organization_id:'o',project_id:'p',survey_id:'s',enumerator_id:'e'}).valid,true);
  const readiness=buildOperationsReadiness({distribution_center:true,web_collection:true,offline_sync:true,enumerator_assignments:true,double_entry:true,supervisor_review:true,fraud_quality:true,twilio_sms:true,twilio_whatsapp:true,twilio_voice:true,callbacks:true,retry_dead_letter:true});
  assert.equal(readiness.readiness_score,100); assert.equal(readiness.ready_for_controlled_pilot,true);
});

test('routes, schema and frontend operations center are wired', () => {
  const index=fs.readFileSync(new URL('../src/application.js',import.meta.url),'utf8');
  const schema=fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8');
  const page=fs.readFileSync(new URL('../../site/app/collection-operations.html',import.meta.url),'utf8');
  for (const route of ['/api/collection-operations/readiness','/api/collection-operations/offline/sync','/api/collection-operations/double-entry/assign','/api/collection-operations/quality/assess','/api/twilio/status/']) assert.match(index,new RegExp(route.replaceAll('/','\\/')));
  for (const table of ['channel_delivery_events','channel_dead_letters','enumerator_assignments_v2','offline_sync_items_v2','double_entry_assignments','double_entry_submissions','double_entry_comparisons','field_quality_assessments']) assert.match(schema,new RegExp(table));
  assert.match(page,/Collection & Field Operations/); assert.match(page,/Supervisor & M&E Review Queue/);
});
