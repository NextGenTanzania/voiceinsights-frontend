import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalogAsset, validateLineageEdge, computeQualityStatus, assessDisclosureRisk, evaluateModelAssurance, validateInteroperabilityContract, buildDecisionSignals, buildDataTrustWorkspace } from '../src/data-trust-intelligence-fabric.js';

test('Data Trust catalog validates governed assets',()=>{
 assert.equal(validateCatalogAsset({asset_type:'dataset',name:'Baseline',owner_user_id:'u1',classification:'confidential'}).ok,true);
 assert.equal(validateCatalogAsset({}).ok,false);
});
test('Lineage rejects self references and accepts valid trust chains',()=>{
 assert.equal(validateLineageEdge({from_asset_id:'a',to_asset_id:'b',relationship_type:'derived_from'}).ok,true);
 assert.equal(validateLineageEdge({from_asset_id:'a',to_asset_id:'a',relationship_type:'derived_from'}).ok,false);
});
test('Quality status is evidence based and never invents a score',()=>{
 assert.deepEqual(computeQualityStatus([]),{status:'NOT_MEASURED',score:null,failed:0,warnings:0});
 assert.equal(computeQualityStatus([{status:'PASS',score:96},{status:'PASS',score:94}]).status,'HEALTHY');
 assert.equal(computeQualityStatus([{status:'FAIL',score:20}]).status,'BLOCKED');
});
test('Disclosure control suppresses small groups and direct identifiers',()=>{
 const r=assessDisclosureRisk({group_size:3,minimum_group_size:5,has_direct_identifiers:true});
 assert.equal(r.risk,'HIGH'); assert.equal(r.decision,'REVIEW_REQUIRED');
});
test('AI assurance requires evaluation, citations, review and rollback',()=>{
 const r=evaluateModelAssurance({model_name:'x',model_version:'1',task_type:'summarisation'});
 assert.equal(r.status,'NOT_READY');
 const p=evaluateModelAssurance({model_name:'x',model_version:'1',task_type:'summarisation',prompt_version:'p1',evaluation_dataset_id:'d1',citations_required:true,human_review_required:true,rollback_version:'0',bias_reviewed_at:'now',privacy_reviewed_at:'now'});
 assert.equal(p.status,'APPROVED');
});
test('Interoperability validates SDMX/DDI contracts',()=>{
 assert.equal(validateInteroperabilityContract({standard:'SDMX',contract_version:'3.1',fields:[{name:'OBS_VALUE'}],owner_user_id:'u'}).ok,true);
});
test('Decision signals are emitted from measurable thresholds',()=>{
 const r=buildDecisionSignals({response_quality_drop_pct:18,provider_error_rate_pct:8,emerging_theme:'medicine shortages'});
 assert.equal(r.length,3); assert.ok(r.some(x=>x.type==='QUALITY_DROP'));
});
test('Workspace uses Not yet measured instead of fabricated metrics',()=>{
 const w=buildDataTrustWorkspace({catalog_assets:null,lineage_edges:4});
 assert.equal(w.metrics.catalog_assets.label,'Not yet measured'); assert.equal(w.metrics.lineage_edges.value,4);
});
