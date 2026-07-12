import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductionOrigin, productionUrl, buildDistributionActions, buildCampaignPlan, buildQueueJob, buildApprovalExecution, buildProductionReadiness } from '../src/production-finalization.js';

test('production routing removes pages.dev and localhost',()=>{
  assert.equal(resolveProductionOrigin({site_url:'https://voiceinsights-frontend.pages.dev'}),'https://voiceinsightsafrica.com');
  assert.equal(resolveProductionOrigin({site_url:'http://localhost:8788'}),'https://voiceinsightsafrica.com');
  assert.equal(productionUrl('/s/EYDEMO',{site_url:'https://voiceinsights-frontend.pages.dev'}),'https://voiceinsightsafrica.com/s/EYDEMO');
});

test('distribution actions expose all production workflows',()=>{
  const d=buildDistributionActions({survey_code:'EYDEMO'});
  assert.equal(d.public_link,'https://voiceinsightsafrica.com/s/EYDEMO');
  for(const key of ['copy_link','open_link','whatsapp','sms','whatsapp_voice','phone','offline','embed','qr']) assert.ok(d.actions.some(a=>a.key===key));
});

test('campaign launcher creates independent queue jobs',()=>{
  const p=buildCampaignPlan({channels:['phone','whatsapp','sms','offline','ai','report','export'],contact_count:100});
  assert.equal(p.steps.length,5);
  for(const q of p.channels){const j=buildQueueJob(q,{campaign_id:p.id});assert.equal(j.queue,q);assert.equal(j.status,'queued')}
});

test('Founder approval is role protected',()=>{
  assert.equal(buildApprovalExecution({id:'a1'},{role:'operations_manager'}).ok,false);
  assert.equal(buildApprovalExecution({id:'a1'},{role:'super_admin'}).ok,true);
});

test('readiness distinguishes configured and missing channels',()=>{
  const r=buildProductionReadiness({site_url:'https://voiceinsightsafrica.com',database:true,storage:true,queues:true,approval_engine:true,notifications:true});
  assert.equal(r.ready,true);
  assert.equal(r.checks.twilio_sms,false);
});
