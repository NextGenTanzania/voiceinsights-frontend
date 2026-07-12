import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAuditMetadata, buildAuditEvent, validateConsentRecord, calculateConsentCoverage, buildSecretMetadata, buildEncryptionPosture, buildSecurityDashboard } from '../src/data-protection-security-operations.js';
import fs from 'node:fs';

test('audit metadata removes secrets and respondent-sensitive fields',()=>{const x=sanitizeAuditMetadata({action:'ok',token:'bad',password:'bad',phone:'+255',count:2});assert.deepEqual(x,{action:'ok',count:2})});
test('audit event has correlation and risk contract',()=>{const e=buildAuditEvent({action:'report.publish',risk_level:'high'});assert.equal(e.risk_level,'high');assert.ok(e.correlation_id)});
test('consent validation requires complete lineage',()=>{assert.equal(validateConsentRecord({}).ok,false);assert.equal(validateConsentRecord({respondent_reference:'r',project_id:'p',campaign_id:'c',channel:'web',consent_version:'1',language:'sw',purpose:'research',status:'accepted'}).ok,true)});
test('consent coverage is measurable and honest',()=>{assert.equal(calculateConsentCoverage({total:100,accepted:94,missing:6}).coverage_pct,94)});
test('secrets manager exposes metadata only and calculates rotation due',()=>{const s=buildSecretMetadata({name:'TWILIO_AUTH_TOKEN',secret_reference:'cf:TWILIO_AUTH_TOKEN',next_rotation_at:'2020-01-01T00:00:00Z'});assert.equal(s.status,'rotation_due');assert.equal(s.masked_value,'••••••••')});
test('encryption center measures eight required controls',()=>{const p=buildEncryptionPosture({});assert.equal(p.checks.length,8);assert.equal(p.score,100)});
test('security dashboard score responds to real risks',()=>{const good=buildSecurityDashboard({});const bad=buildSecurityDashboard({critical_incidents:2,users_without_mfa:5,consent:{total:10,accepted:5,missing:5}});assert.ok(good.security_posture_score>bad.security_posture_score)});
test('routes and pages are wired',()=>{const i=fs.readFileSync(new URL('../src/application.js',import.meta.url),'utf8');for(const r of ['/api/security/v2103b/dashboard','/api/security/v2103b/audit-events','/api/security/v2103b/secrets','/api/security/v2103b/consents','/api/security/v2103b/encryption'])assert.ok(i.includes(r));for(const p of ['../../site/admin/security-dashboard.html','../../site/admin/security/audit-center.html','../../site/admin/security/secrets-manager.html','../../site/app/compliance/consent-vault.html','../../site/admin/security/encryption-center.html'])assert.ok(fs.existsSync(new URL(p,import.meta.url)))});
