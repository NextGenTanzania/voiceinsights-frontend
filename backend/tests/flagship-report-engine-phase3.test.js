import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getInteractiveIntelligenceCatalog,
  buildEvidenceExplorer,
  answerGroundedReportQuestion,
  buildPrivacySafeBenchmark,
  extractKnowledgeRecords,
  searchKnowledge,
  buildInteractiveReport,
} from '../src/interactive-intelligence.js';

const report={
  id:'report-demo',
  title:'National Youth Employment Intelligence',
  findings:[
    {claim:'Skills-market mismatch affects youth employment.',evidence_id:'EV-1',confidence_score:92,region:'East'},
    {claim:'Rural youth have lower access to job matching.',evidence_id:'EV-2',confidence_score:88,region:'Rural'},
  ],
  evidence:[
    {evidence_id:'EV-1',claim:'Skills-market mismatch affects youth employment.',quote:'Training is not connected to employers.',source:'Youth interview',confidence_score:92,verification_status:'VERIFIED',region:'East'},
    {evidence_id:'EV-2',claim:'Rural youth have lower access to job matching.',quote:'Opportunities are too far away.',source:'Enumerator interview',confidence_score:88,verification_status:'VERIFIED',region:'Rural'},
  ],
  recommendations:[
    {recommendation:'Create employer-linked regional skills pathways.',evidence_id:'EV-1',owner:'Programme Director',timeline:'90 days'},
  ],
  methodology:{sample_design:'Stratified',sample_size:1200,sampling_frame:'Youth register',analysis_plan:'Disaggregated analysis'},
  limitations:['Synthetic demonstration data'],
};

test('catalog exposes five Phase 3 modules',()=>{
  const c=getInteractiveIntelligenceCatalog();
  assert.equal(c.modules.length,5);
  assert.ok(c.modules.some(x=>x.key==='evidence_explorer'));
  assert.ok(c.modules.some(x=>x.key==='interactive_reports'));
});

test('evidence explorer searches governed evidence and hides identifiers',()=>{
  const x=buildEvidenceExplorer(report,'rural');
  assert.ok(x.total>=1);
  assert.equal(x.safety.raw_identifiers_exposed,false);
  assert.equal(x.records[0].verification_status,'VERIFIED');
});

test('assistant returns citations and refuses unsupported questions',()=>{
  const a=answerGroundedReportQuestion(report,'Why is skills mismatch important?');
  assert.equal(a.status,'GROUNDED_ANSWER');
  assert.ok(a.citations.length>0);
  const b=answerGroundedReportQuestion(report,'What is the audited budget variance?');
  assert.equal(b.status,'INSUFFICIENT_EVIDENCE');
});

test('benchmark suppresses small peer groups',()=>{
  const small=buildPrivacySafeBenchmark([{value:1},{value:2}],{minimum_peer_group:5});
  assert.equal(small.status,'SUPPRESSED');
  const full=buildPrivacySafeBenchmark([{value:1},{value:2},{value:3},{value:4},{value:5}],{minimum_peer_group:5});
  assert.equal(full.status,'AVAILABLE');
  assert.equal(full.privacy.raw_data_exposed,false);
});

test('knowledge engine extracts and searches report intelligence',()=>{
  const k=extractKnowledgeRecords(report,{organization_id:'org-1'});
  assert.ok(k.count>=3);
  const s=searchKnowledge(k.records,'employer',{organization_id:'org-1'});
  assert.ok(s.count>=1);
});

test('interactive report includes evidence, knowledge and grounded assistant safety',()=>{
  const x=buildInteractiveReport(report,'un');
  assert.equal(x.engine,'VoiceInsights Interactive Intelligence™');
  assert.ok(x.navigation.length>=8);
  assert.equal(x.public_safety.raw_identifiers,false);
  assert.equal(x.assistant.no_answer_when_evidence_missing,true);
});
