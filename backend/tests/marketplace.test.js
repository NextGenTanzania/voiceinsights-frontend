import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKETPLACE_CATALOG, searchMarketplace, buildMarketplaceWorkspace, validateMarketplaceInstall } from '../src/marketplace.js';

test('v210.7 marketplace includes all requested categories',()=>{
  const types=new Set(MARKETPLACE_CATALOG.map(x=>x.type));
  for(const t of ['survey_template','ai_prompt','dashboard','widget','connector','report_template']) assert.ok(types.has(t));
});
test('marketplace search filters by type and query',()=>{
  assert.ok(searchMarketplace({type:'connector'}).every(x=>x.type==='connector'));
  assert.ok(searchMarketplace({q:'health'}).some(x=>x.sector==='health'));
});
test('workspace calculates real catalog and install counts',()=>{
  const w=buildMarketplaceWorkspace([{item_id:'survey-post-activity',status:'installed'}]);
  assert.equal(w.overview.installed,1); assert.equal(w.overview.catalog_items,MARKETPLACE_CATALOG.length);
});
test('connector install reports configuration required',()=>{
  const r=validateMarketplaceInstall('connector-dhis2'); assert.equal(r.ok,true); assert.equal(r.configuration_required,true);
});
