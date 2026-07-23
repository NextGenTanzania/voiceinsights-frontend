import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleReport, buildFlagshipSampleDeck } from '../src/flagship-sample-library.js';
import { buildMeDemoBrief } from '../src/me-demo-brief.js';

test('all real flagship samples expose full platinum institutional publication depth',()=>{
 assert.equal(FLAGSHIP_SAMPLE_REPORTS.length,33);
 for(const s of FLAGSHIP_SAMPLE_REPORTS){
  const m=buildFlagshipSampleReport(s.key), r=m.report;
  assert.equal(r.publication_page_equivalent,'34 generated publication pages');
  assert.equal(r.full_publication.sample_size,r.statistical_intelligence.sample_size);
  assert.equal(r.full_publication.regional.reduce((sum,row)=>sum+row.responses,0),r.statistical_intelligence.sample_size);
  assert.ok(r.publication_architecture.length>=5);
  assert.ok(r.research_methodology_assurance.protocol);
  assert.ok(r.analytical_depth.inferential_statistics);
  assert.ok(r.decision_architecture.length>=3);
  assert.ok(r.evidence_registry.length>=4);
  assert.ok(r.citation_registry.length>=4);
  assert.equal(r.publication_readiness.status,'PASS_FOR_SYNTHETIC_DEMONSTRATION');
  assert.ok(buildFlagshipSampleDeck(m).length>=29);
 }
});

test('M&E demo brief is separate, branded and platinum enhanced',()=>{
 const d=buildMeDemoBrief();
 assert.equal(d.demo,true);
 assert.equal(d.report.prepared_by,'VoiceInsights Africa');
 assert.ok(d.report.demo_workflow.length>=6);
 assert.ok(d.report.publication_architecture.length>=5);
 assert.ok(d.report.platinum.publication_quality_gate_2.release_allowed);
});
