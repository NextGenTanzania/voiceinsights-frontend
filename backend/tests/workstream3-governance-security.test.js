import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {WORKFLOW_STAGES,validateEnterpriseWorkflow,buildWorkflowTransition,buildMfaPolicy,validateSsoCallback,validateScimUser,redactAuditMetadata,buildProcurementEvidenceChecklist,evaluateAuthenticationJourney,buildEnterpriseControlWorkspace} from '../src/governance-security-workstream3.js';
test('enterprise workflow covers complete commercial-to-campaign lifecycle',()=>{assert.equal(WORKFLOW_STAGES[0],'demo_received');assert.equal(WORKFLOW_STAGES.at(-1),'campaign_ready');assert.ok(WORKFLOW_STAGES.includes('founder_approved'));});
test('approval transition requires founder role',()=>{const r=buildWorkflowTransition({id:'x',stage:'submitted_for_approval',metadata:{approval_id:'a'}},'founder_approved',{role:'operations_manager',approval_id:'a'});assert.equal(r.ok,false);});
test('founder can approve sequential workflow with evidence',()=>{const r=buildWorkflowTransition({id:'x',stage:'submitted_for_approval',metadata:{}},'founder_approved',{role:'founder_executive',approval_id:'a'});assert.equal(r.ok,true);});
test('MFA policy protects privileged roles and sensitive actions',()=>{const p=buildMfaPolicy();assert.ok(p.required_roles.includes('operations_manager'));assert.ok(p.challenge_for.includes('secret.rotate'));});
// Phase 2 Enterprise Acceptance Review, Critical #4: the test above only
// verified buildMfaPolicy()'s own shape — it never verified anything
// actually consulted the policy at login, and nothing did. A privileged
// account with MFA never enabled logged in exactly like any other
// account. This regression guard reads the real login handler's source
// (not a mock) and asserts the policy is now actually enforced, with the
// policy's own declared grace period respected rather than an
// unconditional hard block.
test('the /api/auth/login handler actually enforces buildMfaPolicy() for privileged roles, honoring its grace period', () => {
  const src = fs.readFileSync(new URL('../src/application.js', import.meta.url), 'utf8');
  const start = src.indexOf("path === '/api/auth/login'");
  assert.ok(start > -1, 'login route handler not found');
  const handlerSrc = src.slice(start, src.indexOf('\n      }', start));
  assert.ok(/buildMfaPolicy\(\)/.test(handlerSrc), 'login handler must call buildMfaPolicy()');
  assert.ok(/required_roles\.includes\(user\.role\)/.test(handlerSrc), 'login handler must check the user\'s real role against required_roles');
  assert.ok(/grace_period_hours/.test(handlerSrc), 'login handler must honor the policy\'s own grace period, not an unconditional block');
});
test('SSO callback rejects state and nonce mismatch',()=>{assert.equal(validateSsoCallback({code:'x',state:'a',expected_state:'b',nonce:'n',expected_nonce:'n'}).ok,false);});
test('SCIM validates and normalizes enterprise users',()=>{const r=validateScimUser({userName:'USER@EXAMPLE.COM',active:true});assert.equal(r.ok,true);assert.equal(r.user.email,'user@example.com');});
test('audit metadata recursively redacts credentials',()=>{const x=redactAuditMetadata({token:'x',nested:{password:'y'},safe:'ok'});assert.equal(x.token,'[REDACTED]');assert.equal(x.nested.password,'[REDACTED]');assert.equal(x.safe,'ok');});
test('procurement checklist does not claim certification',()=>{const p=buildProcurementEvidenceChecklist({iam_rbac:'implemented'});assert.equal(p.certification_claim,false);assert.ok(p.controls.some(x=>x.key==='penetration_test'&&x.external_verification_required));});
test('authentication journey score is measurable',()=>{const r=evaluateAuthenticationJourney({valid_login:true});assert.equal(r.total,9);assert.ok(r.score_pct>0&&r.score_pct<100);});
test('workspace exposes governance identity security compliance',()=>{const w=buildEnterpriseControlWorkspace({users:10,mfa_coverage_pct:90});assert.equal(w.identity.users,10);assert.ok(w.workflow&&w.security&&w.compliance);});
test('routes migration and frontend are wired',()=>{const idx=fs.readFileSync(new URL('../src/application.js',import.meta.url),'utf8');const schema=fs.readFileSync(new URL('../migrations/023_governance_security_workstream3.sql',import.meta.url),'utf8');const page=fs.readFileSync(new URL('../../site/admin/enterprise-governance-security-trust.html',import.meta.url),'utf8');assert.match(idx,/\/api\/enterprise-control\/workspace/);assert.match(idx,/\/api\/scim\/v2\/Users/);assert.match(schema,/enterprise_client_workflows/);assert.match(page,/Enterprise Governance, Security & Trust Center/);});
