import test from 'node:test';
import assert from 'node:assert/strict';
import {FLAGSHIP_SAMPLE_REPORTS,buildFlagshipSampleReport} from '../src/flagship-sample-library.js';

test('all real flagship reports pass the v3 anti-generic publication intelligence gate',()=>{
  assert.equal(FLAGSHIP_SAMPLE_REPORTS.length,33);
  const openingParagraphs=new Set();
  for(const sample of FLAGSHIP_SAMPLE_REPORTS){
    const model=buildFlagshipSampleReport(sample.key);
    assert.equal(model.publication_intelligence_gate.status,'PASS',`${sample.key}: ${model.publication_intelligence_gate.issues.join(', ')}`);
    assert.ok(model.report.full_publication.sdg_cards.length>=3);
    assert.ok(model.report.full_publication.sdg_cards.every(card=>card.target&&card.indicator_code&&card.interpretation&&card.evidence_ids.length));
    assert.ok(model.report.findings.every(finding=>!/^Critical finding/i.test(finding.title)));
    assert.ok(new Set(model.report.findings.map(finding=>finding.editorial_lens)).size>=4);
    openingParagraphs.add(model.report.findings[0].text);
  }
  assert.equal(openingParagraphs.size,FLAGSHIP_SAMPLE_REPORTS.length,'each publication requires a sector-specific opening finding');
});

test('SDG cards expose decision-grade fields instead of decorative badges',()=>{
  const model=buildFlagshipSampleReport('national-human-development');
  const card=model.report.full_publication.sdg_cards.find(item=>item.goal===3);
  assert.equal(card.title,'Good Health and Well-being');
  for(const field of ['target','indicator_code','baseline','current','target_value','gap','trend','status','confidence','disaggregation','interpretation','decision_id'])assert.notEqual(card[field],undefined,field);
});

// PX Release 6 (Publication Quality Review, high finding #13): polishFindings
// re-injected each finding's own title-case subject into EDITORIAL_LENSES
// sentence templates. 7 of the 9 lenses use the subject mid-sentence, and
// previously received that same capitalized form — a confirmed defect
// ("...That is the Multidimensional poverty transitions signal...") on the
// report's own hero page. Only the 2 lenses that genuinely open a sentence
// with the subject should ever capitalize it.
test('across all 16 flagship samples, no finding mid-sentence-embeds its subject with a capital letter', () => {
  const MID_SENTENCE_MARKERS = [
    / signal for ([A-Z])/,          // lens 1 — subject after "signal for" must be lowercase
    /Progress on ([A-Z])/,          // lens 2
    /'s ([A-Z][a-z]+ ){0,3}signal shows/, // lens 4
    /What would it take to fix ([A-Z])/,  // lens 5
    /That is the ([A-Z])/,          // lens 6 — the confirmed PQR defect
    /true at once about ([A-Z])/,   // lens 7
    /consequence of ([A-Z])/,       // lens 8
  ];
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    for (const finding of model.report.findings) {
      for (const marker of MID_SENTENCE_MARKERS) {
        assert.ok(!marker.test(finding.text), `${sample.key}: "${finding.text}" still capitalizes its subject mid-sentence (matched ${marker})`);
      }
    }
  }
});

// ------------------------------------------------------------------
// EAD Release 1: which of the 9 editorial lenses opens a finding was
// previously (index + hash(country)) % 9 — no relationship to the
// finding's own content. Each finding now carries a real, already-computed
// narrative_mode (from flagship-editorial-engine.js's real priority-tier-
// driven decision), and polishFindings maps it onto the matching lens.
// ------------------------------------------------------------------
test('every real finding\'s editorial_lens is genuinely derived from its own real narrative_mode, not an arbitrary rotation', () => {
  const LENS_BY_MODE = {
    'risk-led': 'binding constraint', geographic: 'implementation divide', contextual: 'implementation divide',
    'uncertainty-led': 'durability', 'decision-led': 'accountability', 'opportunity-led': 'scalable opportunity',
    analytical: 'root-cause diagnosis', 'evidence-led': 'stark statistic', 'contrast-led': 'divergent trajectory',
    'human-impact': 'lived consequence',
  };
  let checkedAtLeastOne = false;
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    // Finding 0 is never subject to the report-level anti-repeat scan (it
    // is always the first lens claimed in the report), so its lens must
    // match the direct mode->lens mapping exactly — the cleanest possible
    // proof this is a real classification, not a coincidence.
    const first = model.report.findings[0];
    const expectedLens = LENS_BY_MODE[first.narrative_mode];
    assert.ok(expectedLens, `${sample.key}: unrecognized narrative_mode "${first.narrative_mode}"`);
    assert.equal(first.editorial_lens, expectedLens, `${sample.key}: finding 0's lens does not match its own real narrative_mode`);
    checkedAtLeastOne = true;
  }
  assert.ok(checkedAtLeastOne);
});

// Regression: two non-adjacent findings sharing a narrative_mode (real,
// confirmed on government-policy-intelligence: findings 0 and 4 both
// 'geographic') previously produced the identical opening sentence twice
// in the same report, once LENS_INDEX_BY_NARRATIVE_MODE was introduced —
// caught by the arc-takeaway verbatim-repeat test, fixed with a report-
// level anti-repeat scan.
test('no two findings in the same real report share the identical editorial_lens, across all 16 samples', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const lenses = model.report.findings.map(f => f.editorial_lens);
    assert.equal(new Set(lenses).size, lenses.length, `${sample.key}: two findings share the identical editorial_lens (${lenses.join(', ')})`);
  }
});

// Regression: lens 2 ("durability") previously read "Progress on ${s} is
// visible..." — grammatically correct (agrees with "Progress"), but sat
// directly adjacent to a plural subject often enough to trip the
// catalog-wide grammar-defect guard once this lens started being selected
// deterministically by mode rather than by chance.
test('the "durability" lens never renders "${subject} is" directly adjacent, regardless of the subject\'s real grammatical number', () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    for (const finding of model.report.findings) {
      if (finding.editorial_lens === 'durability') {
        assert.ok(!/Progress on .+ is visible/.test(finding.text), `${sample.key}: "${finding.text}" still uses the confirmed-problematic adjacency`);
      }
    }
  }
});
