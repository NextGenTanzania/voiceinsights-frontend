import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExternalEvidence,buildSsoLiveTestPlan,applyScimLifecycle,evaluateMfaRecoveryChallenge,buildExternalAssuranceRegister,evaluateClientJourneyAcceptance} from '../src/external-assurance-acceptance.js';

test('passing external evidence requires evidence reference',()=>assert.equal(validateExternalEvidence({type:'penetration_test',provider_or_auditor:'Firm',executed_at:'2026-01-01',result:'pass'}).ok,false));
test('SSO plan distinguishes configuration from live execution',()=>{const p=buildSsoLiveTestPlan('okta',{client_id:'x',issuer:'https://idp',redirect_uri:'https://app/cb'});assert.equal(p.status,'ready_to_execute');assert.equal(p.live_execution_required,true)});
test('SCIM lifecycle supports create update suspend restore',()=>{let r=applyScimLifecycle({},'create',{email:'a@b.com'});assert.equal(r.ok,true);r=applyScimLifecycle(r.user,'suspend');assert.equal(r.user.active,false);r=applyScimLifecycle(r.user,'restore');assert.equal(r.user.active,true)});
test('MFA recovery needs all controls',()=>assert.equal(evaluateMfaRecoveryChallenge({recovery_code_single_use:true}).status,'remediation_required'));
test('external assurance register never claims certification',()=>assert.equal(buildExternalAssuranceRegister([]).certification_claim,false));
test('client journey requires all eleven stages',()=>{const r=evaluateClientJourneyAcceptance({demo:true});assert.equal(r.status,'incomplete');assert.equal(r.total,11)});
