import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileFlagshipReport,
  evaluateFlagshipPublicationQuality,
  buildEvidenceIntelligenceLayer,
  buildStatisticalIntelligenceLayer,
  FLAGSHIP_SAMPLE_REPORTS,
  INTERNATIONAL_PUBLICATION_PROFILES,
} from '../src/flagship-report-engine.js';

const strongReport = {
  title: 'Tanzania National Youth Employment & Livelihood Intelligence Report',
  profile: 'world_bank',
  publication_purpose: 'Support national policy and investment decisions.',
  sector: 'Human Development', country: 'Tanzania', sample_size: 1200, response_rate: 87,
  executive_summary: 'Youth employment outcomes differ materially by region, gender and disability status, requiring targeted skills, finance and market-linkage interventions.',
  findings: [{claim:'Rural young women face the largest employment access gap.'},{claim:'Finance access is the strongest enterprise constraint.'},{claim:'Skills-to-market alignment varies by region.'}],
  risks: [{risk:'Persistent regional inequality'}], opportunities:[{title:'Digital work and local value chains'}],
  recommendations: [{recommendation:'Launch a targeted regional youth transition programme.',priority:'High',owner:'Ministry of Labour',timeline:'0–12 months',impact:'High',cost:'To be costed',monitoring_indicator:'Share of supported youth in sustained employment',evidence_ids:['EV-0001']}],
  evidence: [{evidence_id:'EV-0001',claim:'Rural young women face the largest employment access gap.',response_id:'resp_1',transcript_id:'tr_1',survey_id:'s1',question_id:'q1',enumerator_id:'e1',confidence_score:94,verification_status:'VERIFIED',consent_status:'available',quote:'Transport and care responsibilities limit access to work.'}],
  methodology:{research_questions:['What drives youth employment outcomes?'],sampling_frame:'National youth sampling frame',sample_design:'Stratified multi-stage cluster sample',stratification:'Region, sex, disability',clustering:'District and enumeration area',weights:'Design and non-response weights',confidence_intervals:'95% confidence intervals',analysis_plan:'Pre-specified analysis plan',missing_data:'Multiple imputation and sensitivity checks',outlier_protocol:'Winsorisation only where justified',reliability:'Cronbach alpha for scales',validity:'Construct and content validity review',instrument_version:'v3.2',data_dictionary:'dictionary.xlsx',field_protocol:'Enumerator training and back-check protocol'},
  limitations:['Cross-sectional evidence does not establish causality.'],
  ethics:{consent:true, safeguarding:true}, accessibility:{alt_text_policy:true,reading_order:true,contrast_review:true,mobile_review:true},
  metadata:{language:'English',terminology_review:true,grammar_review:true,publication_purpose:'National policy decisions'},
  geography:{regions:['Dar es Salaam','Arusha','Mwanza','Dodoma','Mbeya']}, demographics:{age:true,gender:true}, sdgs:['SDG 4','SDG 8'],
  sampling_frame:'National youth sampling frame', sample_design:'Stratified multi-stage cluster sample', instrument_version:'v3.2', field_protocol:'protocol', weights_or_justification:'weights', data_quality:'documented', reproducibility:'analysis code',
  cost_of_inaction:'Without targeted action, regional employment gaps are expected to persist and reduce inclusive growth.',
};

test('catalog contains 16 distinctive sample report archetypes',()=>{
  assert.equal(FLAGSHIP_SAMPLE_REPORTS.length,16);
  assert.equal(new Set(FLAGSHIP_SAMPLE_REPORTS.map(r=>r.cover.palette)).size,16);
});

test('international profiles cover priority buyers',()=>{
  for(const key of ['un_agency','world_bank','government','donor','humanitarian','corporate','research']) assert.ok(INTERNATIONAL_PUBLICATION_PROFILES[key]);
});

test('compiler creates five governed intelligence layers',()=>{
  const output=compileFlagshipReport(strongReport);
  assert.ok(output.layers.executive);
  assert.ok(output.layers.evidence);
  assert.ok(output.layers.statistics);
  assert.ok(output.layers.policy);
  assert.ok(output.layers.decisions);
  assert.ok(output.quality_gate);
});

test('evidence layer preserves raw-source pointers and confidence',()=>{
  const layer=buildEvidenceIntelligenceLayer(strongReport);
  assert.equal(layer.source_linked_items,1);
  assert.equal(layer.items[0].confidence_score,94);
  assert.equal(layer.items[0].pointers.transcript_id,'tr_1');
});

test('statistical layer reports gaps rather than inventing values',()=>{
  const layer=buildStatisticalIntelligenceLayer({title:'Thin report'});
  assert.equal(layer.sample_design,'Not documented');
  assert.ok(layer.readiness_score<20);
  assert.ok(layer.blocking_gaps.includes('sample_design'));
});

test('quality gate blocks unsupported thin reports',()=>{
  const gate=evaluateFlagshipPublicationQuality({title:'Thin report', findings:['Claim without evidence']});
  assert.equal(gate.status,'BLOCKED');
  assert.equal(gate.publication_allowed,false);
  assert.ok(gate.hard_blockers.length>=3);
});

test('quality gate scores complete reports using evidence not static labels',()=>{
  const gate=evaluateFlagshipPublicationQuality(strongReport);
  assert.ok(gate.overall_score>=80);
  assert.equal(gate.dimensions.length,10);
  assert.ok(gate.dimensions.every(d=>d.score>=0&&d.score<=100));
});

test('decision output contains owner timeline cost risk and monitoring indicator',()=>{
  const output=compileFlagshipReport(strongReport);
  const d=output.layers.decisions.top_decision;
  assert.equal(d.owner,'Ministry of Labour');
  assert.equal(d.timeline,'0–12 months');
  assert.ok(d.monitoring_indicator);
  assert.ok(d.evidence_ids.length);
});
