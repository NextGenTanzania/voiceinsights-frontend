import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleReport, getFlagshipSampleCatalog, SYNTHETIC_NOTICE } from '../src/flagship-sample-library.js';

test('generator exposes exactly the required flagship publications',()=>{
 assert.equal(FLAGSHIP_SAMPLE_REPORTS.length,33);
 assert.deepEqual(FLAGSHIP_SAMPLE_REPORTS.map(x=>x.title),[
  'National Human Development Intelligence Report','Donor Impact Evaluation Report','Government Policy Intelligence Report','Humanitarian Needs Assessment Report','Executive Board Intelligence Report','Customer Experience Intelligence Report','Employee Experience Intelligence Report','Community Scorecard Intelligence Report','Annual Impact Report','Quarterly Performance Intelligence Report','Market Intelligence Report','Technical Research Report','Statistical Intelligence Report','Interactive Intelligence Report','Evidence Explorer Report','SDG Progress Intelligence Report',
  'Hospital Performance & Patient Safety Intelligence Report','Maternal & Child Health Continuity Intelligence Report','Disease Surveillance & Outbreak Readiness Intelligence Report','Nutrition Security Intelligence Report','Universal Health Coverage and Financing Intelligence Report',
  'Education Access and Learning Quality Intelligence Report','Climate Adaptation Intelligence Report','Social Protection Targeting Intelligence Report',
  'Digital Government Services Intelligence Report',
  'WASH Access Intelligence Report','Energy Access Intelligence Report','Food Security Intelligence Report','Justice and Legal Services Intelligence Report','Financial Inclusion Intelligence Report','Displacement and Durable Solutions Intelligence Report','Youth Skills and Employability Intelligence Report','Public Financial Management Intelligence Report'
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
 assert.equal(identities.size,FLAGSHIP_SAMPLE_REPORTS.length);
});

// Commercial Launch Sprint: publication_status was asserted here as the
// raw 'DEMONSTRATION_READY' enum — itself a confirmed customer-facing
// defect (rendered unhumanized on every card in the live public library).
// Now asserts the humanized value this codebase already has a utility for
// (humanizeStatusEnum), and explicitly guards against a raw enum ever
// leaking to this public catalog again.
// Enterprise Market Validation Release, Part A: quality_score/evidence_score/
// decision_intelligence_score were raw internal 0-100 Quality Gate numbers
// exposed on the public catalog — replaced with pass/fail trust_badges.
// This test now guards both that the badges are present and satisfied
// (preserving the original quality bar) and that the raw fields are gone.
test('catalog includes required trust badges, metadata and download paths',()=>{
 const c=getFlagshipSampleCatalog(); assert.equal(c.count,FLAGSHIP_SAMPLE_REPORTS.length);
 for(const x of c.reports){
  assert.ok(x.publication_profile);assert.ok(x.pages_equivalent);
  assert.ok(/demonstration ready/i.test(x.publication_status));
  assert.ok(!/_/.test(x.publication_status),'publication_status must never leak a raw SCREAMING_SNAKE_CASE enum');
  assert.ok(!('quality_score' in x)&&!('evidence_score' in x)&&!('decision_intelligence_score' in x),'raw internal Quality Gate scores must never be exposed on the public catalog');
  assert.ok(Array.isArray(x.trust_badges)&&x.trust_badges.length>=5,'catalog must expose pass/fail trust badges, not raw scores');
  const badge=id=>x.trust_badges.find(b=>b.id===id);
  assert.equal(badge('evidence_review')?.satisfied,true);
  assert.equal(badge('publication_integrity')?.satisfied,true);
  assert.equal(badge('export_validation')?.satisfied,true);
  assert.match(x.download_base,/\/export$/);
 }
});

// PX Release 6 (Publication Quality Review, critical finding #3): every
// recommendation sentence previously ended with a redundant "for {sector}"
// clause regardless of whether the action already read as a complete
// sentence — confirmed 29 occurrences in one 20-page publication.
test('across all 16 flagship samples, no recommendation sentence carries the redundant "for {sector}" suffix', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    for (const r of model.report.recommendations) {
      assert.ok(!new RegExp(`for ${sample.sector.toLowerCase()}\\.?$`, 'i').test(r.recommendation),
        `${sample.key}: "${r.recommendation}" still carries the redundant sector suffix`);
    }
  }
});

// PX Release 6 (PQR, critical findings #1/#2/#4): the evidence-quote
// template used one fixed sentence shape for every quote in every report
// (14 identical-shaped instances in one publication) and never ran its
// subject through the grammar guard, producing a confirmed "gaps shapes"
// error wherever a plural-head-noun subject landed in that template.
test('across all 16 flagship samples, evidence quotes use more than one sentence shape and never disagree in number', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const quotes = model.report.evidence.map(e => e.quote);
    // At least 2 distinct opening words across a 10-quote sample confirms
    // more than one template is in play, not a reshuffled single sentence.
    const openings = new Set(quotes.map(q => q.replace(/^“/, '').split(' ').slice(0, 2).join(' ')));
    assert.ok(openings.size >= 2, `${sample.key}: all evidence quotes open the same way`);
    assert.ok(!quotes.some(q => /\bgaps shapes\b|\btransitions shapes\b|\boutcomes shapes\b/i.test(q)),
      `${sample.key}: a plural subject still disagrees with a singular verb in an evidence quote`);
  }
});

// PX Release 6 (PQR, high finding #19): ai_governance.model was a hardcoded
// literal ("Configured report intelligence model") that named nothing real
// and read like an unfilled configuration default.
test('ai_governance.model never renders the confirmed placeholder-sounding string, and honestly discloses no LLM is used', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  assert.notEqual(model.report.ai_governance.model, 'Configured report intelligence model');
  assert.match(model.report.ai_governance.model, /no generative or llm model/i);
});

// PX Release 6.5 (Publication Quality Review, top critical issue #1):
// critical_risks, top_opportunities, and every recommendation's
// dependencies were hardcoded constants, byte-identical across all 16
// flagship samples — invisible reading one report, glaring reading two
// side by side (a humanitarian assessment and a corporate board report
// listed the exact same two risks).
test('critical_risks and top_opportunities genuinely vary across all 16 flagship samples', () => {
  const riskSets = new Set();
  const opportunitySets = new Set();
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    riskSets.add(model.report.executive_book.critical_risks.map(r => r.risk).slice().sort().join('|'));
    opportunitySets.add(model.report.executive_book.top_opportunities.slice().sort().join('|'));
  }
  assert.ok(riskSets.size >= 10, `only ${riskSets.size}/16 distinct critical_risks sets`);
  assert.ok(opportunitySets.size >= 10, `only ${opportunitySets.size}/16 distinct top_opportunities sets`);
});

test('recommendation dependencies genuinely vary, both within one report and across the 16-sample catalog', () => {
  const allSets = new Set();
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const withinReport = new Set(model.report.recommendations.map(r => r.dependencies.slice().sort().join('|')));
    assert.ok(withinReport.size >= 3, `${sample.key}: recommendation dependencies barely vary within the report`);
    for (const set of withinReport) allSets.add(set);
  }
  assert.ok(allSets.size >= 10, `only ${allSets.size} distinct dependency combinations across the whole catalog`);
});

// Same confirmed catalog-wide genericness defect for the remaining 3
// fields: budget_implications and executive_confidence (report-level), and
// success_criteria (on every one of 80 real recommendations).
test('budget_implications, executive_confidence and success_criteria all vary across the catalog', () => {
  const budgetSet = new Set(), confidenceSet = new Set(), successSet = new Set();
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    budgetSet.add(model.report.executive_book.budget_implications);
    confidenceSet.add(model.report.executive_book.executive_confidence);
    for (const r of model.report.recommendations) successSet.add(r.success_criteria);
    // executive_confidence must always keep its mandatory real-world-use
    // disclosure regardless of which pool variant was picked.
    assert.match(model.report.executive_book.executive_confidence, /not valid for real-world decision use/i);
  }
  assert.ok(budgetSet.size >= 10, `only ${budgetSet.size}/16 distinct budget_implications`);
  assert.ok(confidenceSet.size >= 2, `only ${confidenceSet.size}/16 distinct executive_confidence`);
  assert.ok(successSet.size >= 2, `only ${successSet.size} distinct success_criteria across 80 recommendations`);
});

// VPX Release 1: monitoring_indicator was a single fixed template
// ("Percentage of agreed milestones completed for {id}") on every one of
// the 80 real recommendations in the catalog — an independent editorial
// review flagged this as immediately recognizable to any M&E professional.
test('monitoring_indicator varies within a report and across the catalog, never the same fixed template on every recommendation', () => {
  const allTemplateShapes = new Set();
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const withinReport = new Set(model.report.recommendations.map(r => r.monitoring_indicator.replace(/DEC-[A-Z0-9-]+/g, '{id}')));
    assert.ok(withinReport.size >= 2, `${sample.key}: monitoring_indicator barely varies within the report`);
    for (const shape of withinReport) allTemplateShapes.add(shape);
  }
  assert.ok(allTemplateShapes.size >= 2, `only ${allTemplateShapes.size} distinct monitoring_indicator template shapes across the whole catalog`);
});
