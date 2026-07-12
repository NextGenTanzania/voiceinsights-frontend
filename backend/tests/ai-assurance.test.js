import test from 'node:test';
import assert from 'node:assert/strict';
import { detectHallucinations, detectContradictions, runAIAssurancePipeline, INSUFFICIENT_EVIDENCE, buildEvidenceTrace } from '../src/ai-assurance-pipeline.js';
import { generatePublicationReadyReport, validateReportExport, SUPPORTED_REPORT_TYPES } from '../src/report-intelligence.js';
import { buildVisualSpec } from '../src/visual-intelligence.js';
import { buildAIGovernanceRecord, approveAIRun } from '../src/ai-governance.js';

const evidence = [{ evidence_id:'ev1', source_interview_id:'int1', dataset_id:'ds1', dataset_version:'2026.07', question_id:'q1', question_text:'Are services accessible?', respondent_group:'Women 18-35', quote:'Service access improved to 62%', statistic:'62%', sample_size:100, consent_verified:true, source_verified:true }];
const governance = { model:'claude-test', prompt_version:'p3', temperature:0, approval_status:'APPROVED', reviewer:'reviewer-1' };

test('fabricated percentages are blocked', () => {
  const x = detectHallucinations({ claim:'Access reached 99%', evidence, citation_ids:['ev1'] });
  assert.equal(x.detected, true); assert.deepEqual(x.flags.fabricated_statistics, ['99%']);
});

test('uncited claims return INSUFFICIENT_EVIDENCE', () => {
  const x = detectHallucinations({ claim:'Access improved', evidence, citation_ids:[] });
  assert.equal(x.status, INSUFFICIENT_EVIDENCE);
});

test('invented quotes are blocked', () => {
  const x = detectHallucinations({ claim:'A respondent said “We never received any service”', evidence, citation_ids:['ev1'] });
  assert.equal(x.flags.invented_quotes.length, 1);
});

test('directional contradictions are detected', () => {
  const x = detectContradictions(['Access increased substantially','Access decreased substantially']);
  assert.equal(x.detected, true);
});

test('verified claims pass only with citations, evidence and approval', () => {
  const x = runAIAssurancePipeline({ report_id:'r1', dataset:{dataset_id:'ds1',version:'2026.07',evidence}, claims:[{id:'c1',claim:'Service access improved to 62%',citation_ids:['ev1']}], recommendations:[{id:'r1',recommendation:'Prioritize service access improvements',citation_ids:['ev1']}], governance });
  assert.equal(x.claims[0].verified, true); assert.equal(x.publication_gate.publication_allowed, true); assert.equal(x.assurance_score, 100);
});

test('human approval is mandatory', () => {
  const x = runAIAssurancePipeline({ report_id:'r1', dataset:{dataset_id:'ds1',version:'1',evidence}, claims:[{claim:'Service access improved to 62%',citation_ids:['ev1']}], governance:{...governance,approval_status:'PENDING'} });
  assert.equal(x.publication_gate.status, 'BLOCKED');
});

test('evidence trace exposes mandatory fields', () => {
  const x = runAIAssurancePipeline({ dataset:{dataset_id:'ds1',version:'1',evidence}, claims:[{id:'c1',claim:'Service access improved to 62%',citation_ids:['ev1']}], governance });
  const t = buildEvidenceTrace(x.claims[0])[0];
  assert.equal(t.source_interview,'int1'); assert.equal(t.dataset_version,'2026.07'); assert.equal(t.question.id,'q1'); assert.equal(t.respondent_group,'Women 18-35'); assert.equal(t.verification_status,'VERIFIED');
});

test('all nine report types are supported', () => assert.equal(SUPPORTED_REPORT_TYPES.length,9));

test('report export is blocked until publication gate passes', () => {
  const report = generatePublicationReadyReport({ report_id:'r2', report_type:'executive', dataset:{dataset_id:'ds1',version:'1',evidence:[]}, claims:[{claim:'Unsupported 80%',citation_ids:[]}], governance });
  assert.equal(report.publication_ready,false); assert.equal(validateReportExport(report,'pdf').allowed,false);
});

test('publication-ready report includes executive intelligence', () => {
  const report = generatePublicationReadyReport({ report_id:'r3', report_type:'donor', dataset:{dataset_id:'ds1',version:'1',evidence}, claims:[{claim:'Service access improved to 62%',citation_ids:['ev1']}], recommendations:[{recommendation:'Prioritize service access improvements',citation_ids:['ev1']}], governance });
  assert.equal(report.publication_ready,true); assert.ok(report.sections.executive_intelligence.decision_matrix.length);
});

test('visual intelligence requires complete source metadata', () => {
  assert.equal(buildVisualSpec({type:'trend',title:'Trend',data:[{x:1,y:2}],source:{}}).render_allowed,false);
  assert.equal(buildVisualSpec({type:'trend',title:'Trend',data:[{x:1,y:2}],source:{dataset_id:'d',dataset_version:'1',evidence_ids:['e']}}).render_allowed,true);
});

test('AI governance records model, prompt, dataset, cost and approval', () => {
  const record=buildAIGovernanceRecord({run_id:'a1',model:'m',prompt_version:'p',dataset_id:'d',dataset_version:'1',cost:1.2});
  const approved=approveAIRun(record,{reviewer:'u1',decision:'APPROVED'});
  assert.equal(record.valid,true); assert.equal(approved.publication_eligible,true); assert.equal(approved.cost,1.2);
});
