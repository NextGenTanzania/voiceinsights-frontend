import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {buildSoc2Readiness,buildIsoPack,buildCompliancePack,buildProcurementReadiness} from '../src/compliance-procurement-trust.js';
test('VoiceInsights Cloud consolidated package includes compliance and procurement trust',()=>{const s=buildSoc2Readiness({controls:[{domain:'security',score:95,status:'implemented',evidence_count:2},{domain:'availability',score:90,status:'implemented',evidence_count:1},{domain:'confidentiality',score:90,status:'implemented',evidence_count:1},{domain:'processing_integrity',score:88,status:'implemented',evidence_count:1},{domain:'privacy',score:87,status:'implemented',evidence_count:1}]});assert.ok(s.overall_score>=85);assert.equal(s.certified,false);assert.equal(buildIsoPack([]).frameworks.length,4);assert.ok(buildCompliancePack({controls:[]}).sections.length>=10);assert.ok(buildProcurementReadiness({controls:[],security_score:90,documentation_score:90,evidence_score:90}).score>=67)});
test('customer-facing compliance pages omit internal release labels',()=>{for(const f of ['../../site/admin/compliance/procurement-readiness.html','../../site/admin/compliance/soc2-readiness.html','../../site/admin/compliance/iso-pack.html','../../site/admin/compliance/evidence-export.html','../../site/security/trust-center.html']){const t=fs.readFileSync(new URL(f,import.meta.url),'utf8');assert.ok(!/>\s*v210/i.test(t));}});
test('all consolidated cloud modules and routes are present',()=>{const i=fs.readFileSync(new URL('../src/application.js',import.meta.url),'utf8');for(const p of ['/api/compliance/trust/readiness','/api/compliance/trust/soc2-readiness','/api/compliance/trust/iso-pack','/api/compliance/trust/evidence','/api/compliance/trust/compliance-pack'])assert.ok(i.includes(p));});
// Phase 2 Enterprise Acceptance Review, Critical #1: /api/compliance/trust/readiness
// previously read security_score and documentation_score directly from the
// request's own query string, with no server-side verification, so any
// authenticated caller could set their own procurement-readiness score via
// the URL. This regression guard reads the real handler's source (not a
// mock) and asserts the dangerous pattern is gone and a real, DB-driven
// computation is present instead.
test('the /api/compliance/trust/readiness handler no longer reads security_score or documentation_score from the request query string', () => {
  const src = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
  const start = src.indexOf("path === '/api/compliance/trust/readiness'");
  assert.ok(start > -1, 'route handler not found');
  const handlerSrc = src.slice(start, src.indexOf('\n      }', start));
  assert.ok(!/searchParams\.get\(['"]security_score['"]\)/.test(handlerSrc), 'security_score must not be read from the query string');
  assert.ok(!/searchParams\.get\(['"]documentation_score['"]\)/.test(handlerSrc), 'documentation_score must not be read from the query string');
  assert.ok(/iam_mfa_methods/.test(handlerSrc), 'security_score must be derived from real MFA coverage data');
  assert.ok(/security_audit_events_v2/.test(handlerSrc), 'security_score must account for real recorded critical security events');
  assert.ok(/normalizeControlStatus/.test(handlerSrc), 'documentation_score must be derived from real compliance_controls status');
});
