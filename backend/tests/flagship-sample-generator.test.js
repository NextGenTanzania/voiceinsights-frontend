import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleReport, getFlagshipSampleCatalog, SYNTHETIC_NOTICE } from '../src/flagship-sample-library.js';

test('generator exposes exactly sixteen required flagship publications',()=>{
 assert.equal(FLAGSHIP_SAMPLE_REPORTS.length,16);
 assert.deepEqual(FLAGSHIP_SAMPLE_REPORTS.map(x=>x.title),[
  'National Human Development Intelligence Report','Donor Impact Evaluation Report','Government Policy Intelligence Report','Humanitarian Needs Assessment Report','Executive Board Intelligence Report','Customer Experience Intelligence Report','Employee Experience Intelligence Report','Community Scorecard Intelligence Report','Annual Impact Report','Quarterly Performance Intelligence Report','Market Intelligence Report','Technical Research Report','Statistical Intelligence Report','Interactive Intelligence Report','Evidence Explorer Report','SDG Progress Intelligence Report'
 ]);
});

test('every publication is complete, traceable, unique and generated from one governed model',()=>{
 const identities=new Set();
 for(const sample of FLAGSHIP_SAMPLE_REPORTS){
  const model=buildFlagshipSampleReport(sample.key),r=model.report;
  assert.equal(r.branding.synthetic_notice,SYNTHETIC_NOTICE);
  assert.equal(r.findings.length,5); assert.ok(r.evidence.length>=8); assert.equal(r.recommendations.length,5);
  assert.ok(r.findings.every(f=>f.evidence_ids.length>=2));
  assert.ok(r.recommendations.every(x=>x.evidence_used.length && x.owner && x.timeline && x.monitoring_indicator));
  assert.ok(r.visualizations.length>=16); assert.ok(r.visualizations.every(v=>v.interpretation && v.data_source_ids.length));
  assert.equal(r.exports.length,9); assert.equal(r.quality_scores.gate,'PUBLICATION_READY'); assert.equal(r.quality_scores.overall_publication_readiness,100);
  identities.add(`${sample.theme}:${sample.personality}:${sample.cover.motif}`);
 }
 assert.equal(identities.size,16);
});

test('catalog includes required scores, metadata and download paths',()=>{
 const c=getFlagshipSampleCatalog(); assert.equal(c.count,16);
 for(const x of c.reports){assert.ok(x.publication_profile);assert.ok(x.pages_equivalent);assert.equal(x.publication_status,'DEMONSTRATION_READY');assert.ok(x.quality_score>0&&x.quality_score<100);assert.ok(x.evidence_score>=90);assert.ok(x.decision_intelligence_score>=90);assert.match(x.download_base,/\/export$/);}
});
