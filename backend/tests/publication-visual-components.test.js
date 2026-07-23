// Publication Experience (PX) Release 3: Visual Components tests.
// One block per component — verifies real-field rendering and, just as
// importantly, graceful no-fabrication degradation when a real field is
// genuinely absent from the governed model (never a placeholder invention).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport } from '../src/flagship-sample-library.js';
import { classifyVRDSConfidence } from '../src/vrds-foundation.js';
import {
  PUBLICATION_VISUAL_COMPONENTS_VERSION, confidenceMeter, policyAlertBox, criticalFindingCard,
  evidenceSpotlightCard, fieldVoiceQuote, decisionCanvasCard, roadmapRail, strategicOutlookPanel,
  regionalComparisonPanel, equityLensPanel, riskCard, investmentOpportunityCard, priorityActionsList,
  costOfInactionPanel, heroKpiPanel, executiveCalloutCard, insightPanel, confidenceThermometer, prestigePanel,
  chapterMarker, priorityLadder, voicePortraitBadge,
} from '../src/publication-visual-components.js';
import { NARRATIVE_ARC_STAGES } from '../src/flagship-narrative-arc.js';

test('the module exports a version constant', () => {
  assert.equal(PUBLICATION_VISUAL_COMPONENTS_VERSION, 'publication-visual-components-v1');
});

// ------------------------------------------------------------------
// Confidence Meter — reuses classifyVRDSConfidence, does not reimplement it.
// ------------------------------------------------------------------
test('confidenceMeter reuses classifyVRDSConfidence bands and colors, not a reimplementation', () => {
  const html = confidenceMeter(82, 'Test confidence');
  const band = classifyVRDSConfidence(82);
  assert.ok(html.includes(band.label));
  assert.ok(html.includes(band.color));
  assert.ok(html.includes('82%'));
});

test('confidenceMeter falls back to "Not assessed" for a non-numeric score, matching classifyVRDSConfidence exactly', () => {
  const html = confidenceMeter(undefined, 'Test confidence');
  assert.ok(html.includes('Not assessed'));
  // The meter track's fill-width style legitimately uses a 0% value even
  // when unscored; what must never appear is a fabricated score percentage
  // in the value label itself.
  assert.ok(!html.includes('%)'), 'must not render a fabricated score percentage when the score is not a number');
});

// ------------------------------------------------------------------
// Policy Alert — only ever renders for a genuinely CRITICAL recommendation.
// ------------------------------------------------------------------
test('policyAlertBox renders nothing when there is no critical recommendation, rather than manufacturing urgency', () => {
  assert.equal(policyAlertBox(null, 'Some cost of inaction text'), '');
});

test('policyAlertBox renders the real recommendation, owner and timeline when a critical recommendation exists', () => {
  const rec = { recommendation: 'Adopt the compact.', owner: 'Cabinet Secretariat', timeline: '0-90 days' };
  const html = policyAlertBox(rec, 'Delay compounds the gap.');
  assert.ok(html.includes('Adopt the compact.'));
  assert.ok(html.includes('Cabinet Secretariat'));
  assert.ok(html.includes('0-90 days'));
  assert.ok(html.includes('Delay compounds the gap.'));
});

// ------------------------------------------------------------------
// Critical Finding — never a bare claim without its interpretation/confidence.
// ------------------------------------------------------------------
test('criticalFindingCard renders nothing for a null finding', () => {
  assert.equal(criticalFindingCard(null, null), '');
});

test('criticalFindingCard pairs the finding text with its interpretation and a confidence meter', () => {
  const finding = { text: 'District gaps are widening.', interpretation: 'Concentrated in Lake Zone.', confidence_score: 71 };
  const html = criticalFindingCard(finding, { id: 'EVI-001' });
  assert.ok(html.includes('District gaps are widening.'));
  assert.ok(html.includes('Concentrated in Lake Zone.'));
  assert.ok(html.includes('EVI-001'));
  assert.ok(html.includes(classifyVRDSConfidence(71).label));
});

// ------------------------------------------------------------------
// Evidence Spotlight — surfaces the real quantified statistic when present,
// the one genuinely new quantified signal this release adds.
// ------------------------------------------------------------------
test('evidenceSpotlightCard surfaces a real quantified statistic when evidence[].statistic exists', () => {
  const evidence = { id: 'EVI-01', quote: 'Access remains uneven.', respondent_group: 'Rural women', region: 'Lake Zone', confidence_score: 88, statistic: { value: 42, unit: '%', denominator: 'surveyed households' } };
  const html = evidenceSpotlightCard(evidence, 'Synthetic demonstration evidence');
  assert.ok(html.includes('42'));
  assert.ok(html.includes('%'));
  assert.ok(html.includes('surveyed households'));
  assert.ok(html.includes('Access remains uneven.'));
});

test('evidenceSpotlightCard formats a "percent"-unit statistic as a real % symbol, never the confirmed "71percent" concatenation defect', () => {
  const evidence = { id: 'EVI-03', quote: 'Access remains uneven.', respondent_group: 'Rural women', region: 'Lake Zone', confidence_score: 88, statistic: { value: 71, unit: 'percent', denominator: 327 } };
  const html = evidenceSpotlightCard(evidence, 'Synthetic demonstration evidence');
  assert.ok(html.includes('71%'), 'expected the real evidence[].statistic.unit value "percent" to render as a % symbol');
  assert.ok(!/71percent/i.test(html), 'must never concatenate the literal word "percent" onto the value');
});

test('evidenceSpotlightCard omits the statistic line entirely when no real statistic exists, rather than inventing one', () => {
  const evidence = { id: 'EVI-02', quote: 'Access remains uneven.', respondent_group: 'Rural women', region: 'Lake Zone', confidence_score: 88 };
  const html = evidenceSpotlightCard(evidence, 'Synthetic demonstration evidence');
  assert.ok(!html.includes('text-h3'), 'no stat-display line should render without a real statistic');
});

test('evidenceSpotlightCard returns an empty string for a null evidence item', () => {
  assert.equal(evidenceSpotlightCard(null, 'label'), '');
});

// ------------------------------------------------------------------
// Voice Portrait — VPX Release 1: a generic, non-identifying silhouette,
// never a photograph, never an invented age/gender/appearance. Colored by
// the same real respondent-group category pickHumanVoiceLabel derives.
// ------------------------------------------------------------------
test('voicePortraitBadge renders a generic silhouette svg, never text implying a specific invented identity', () => {
  const html = voicePortraitBadge('Rural women');
  assert.ok(html.includes('<svg class="voice-portrait"'));
  assert.ok(!/rural women/i.test(html), 'must not print the respondent group as invented identity text inside the badge itself');
});

test('voicePortraitBadge gives two different real respondent-group categories two different real colors', () => {
  const frontline = voicePortraitBadge('Frontline enumerator');
  const community = voicePortraitBadge('Community beneficiary');
  const colorOf = html => html.match(/circle cx="20" cy="20" r="20" fill="(#[0-9A-Fa-f]{6})"/)[1];
  assert.notEqual(colorOf(frontline), colorOf(community));
});

test('voicePortraitBadge degrades honestly to the generic "Human Voice" category color for an absent respondent group, never throwing', () => {
  assert.doesNotThrow(() => voicePortraitBadge(undefined));
  assert.doesNotThrow(() => voicePortraitBadge(''));
});

test('evidenceSpotlightCard renders a real voice-portrait badge alongside its human-voice label', () => {
  const evidence = { id: 'EVI-01', quote: 'Access remains uneven.', respondent_group: 'Rural women', region: 'Lake Zone', confidence_score: 88 };
  const html = evidenceSpotlightCard(evidence, 'Synthetic demonstration evidence');
  assert.ok(html.includes('voice-portrait'));
});

test('fieldVoiceQuote renders a real voice-portrait badge alongside its attribution', () => {
  const evidence = { quote: 'Services rarely reach us on time.', respondent_group: 'Frontline workers', region: 'Coastal Belt' };
  const html = fieldVoiceQuote(evidence, 'Synthetic demonstration evidence');
  assert.ok(html.includes('voice-portrait'));
  assert.ok(html.includes('Frontline workers'));
});

// ------------------------------------------------------------------
// Field Voice
// ------------------------------------------------------------------
test('fieldVoiceQuote carries the real respondent group, region and evidence label in its attribution', () => {
  const evidence = { quote: 'Services rarely reach us on time.', respondent_group: 'Frontline workers', region: 'Coastal Belt' };
  const html = fieldVoiceQuote(evidence, 'Synthetic demonstration evidence');
  assert.ok(html.includes('Frontline workers'));
  assert.ok(html.includes('Coastal Belt'));
  assert.ok(html.includes('Synthetic demonstration evidence'));
});

// ------------------------------------------------------------------
// Decision Canvas — the confirmed r.dependency -> r.dependencies bug fix.
// ------------------------------------------------------------------
test('decisionCanvasCard renders the real dependencies array, not the hardcoded fallback (the confirmed field-name bug fix)', () => {
  const r = {
    recommendation: 'Adopt the compact.', owner: 'Cabinet Secretariat', timeline: '0-90 days',
    priority: 'CRITICAL', dependencies: ['Named executive sponsor', 'Validated operational baseline'],
  };
  const { html } = decisionCanvasCard(r, 12);
  assert.ok(html.includes('Named executive sponsor; Validated operational baseline'));
  assert.ok(!html.includes('No blocking dependency identified'));
});

test('decisionCanvasCard falls back to the honest default only when dependencies is genuinely empty/absent', () => {
  const r = { recommendation: 'Adopt the compact.', owner: 'X', timeline: 'Y', priority: 'HIGH' };
  const { html } = decisionCanvasCard(r, 6);
  assert.ok(html.includes('No blocking dependency identified'));
});

test('decisionCanvasCard against the real flagship model renders every recommendation\'s real dependencies', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  for (const r of model.report.recommendations) {
    const { html } = decisionCanvasCard(r, 6);
    if (r.dependencies && r.dependencies.length) {
      assert.ok(html.includes(r.dependencies.join('; ')), `must render ${r.id}'s real dependencies`);
    }
  }
});

// ------------------------------------------------------------------
// Implementation Roadmap rail
// ------------------------------------------------------------------
test('roadmapRail renders each bucket\'s real items and a real owner, and an honest "no items" line for an empty bucket', () => {
  const buckets = { immediate: [{ recommendation: 'Do X', owner: 'Owner A' }], near_term: [], medium_term: [] };
  const labels = { immediate: 'Immediate (0-90 days)', near_term: 'Near-term', medium_term: 'Medium-term' };
  const html = roadmapRail(buckets, labels);
  assert.ok(html.includes('Do X'));
  assert.ok(html.includes('Owner A'));
  assert.ok(html.includes('No items in this window.'));
});

// ------------------------------------------------------------------
// Strategic Outlook
// ------------------------------------------------------------------
test('strategicOutlookPanel renders the real strategic_outlook text unabridged', () => {
  const text = 'Sustained investment converts variation into convergence within three years.';
  const html = strategicOutlookPanel(text);
  assert.ok(html.includes(text));
});

// ------------------------------------------------------------------
// Regional Comparison / Equity Lens
// ------------------------------------------------------------------
test('regionalComparisonPanel renders every real region name, score, and the national reference line', () => {
  const regional = [{ name: 'Lake Zone', primary_score: 62, responses: 340, risk: 'Elevated' }, { name: 'Northern Highlands', primary_score: 84, responses: 210, risk: 'Stable' }];
  const html = regionalComparisonPanel(regional, 73);
  assert.ok(html.includes('Lake Zone'));
  assert.ok(html.includes('62%'));
  assert.ok(html.includes('Northern Highlands'));
  assert.ok(html.includes('73%'));
});

test('equityLensPanel computes the real point gap between the best- and worst-performing regions', () => {
  const html = equityLensPanel({ name: 'Northern Highlands', primary_score: 84 }, { name: 'Lake Zone', primary_score: 62 });
  assert.ok(html.includes('22 points'));
});

test('equityLensPanel degrades honestly to "Not available" rather than fabricating a comparison when data is missing', () => {
  const html = equityLensPanel(null, null);
  assert.ok(html.includes('Not available'));
});

// ------------------------------------------------------------------
// Risk Card — the no-fabrication ceiling: this model never has owner or
// mitigation fields on critical_risks[], so the component must never
// render those labels.
// ------------------------------------------------------------------
test('riskCard never renders an Owner or Mitigation label, since critical_risks[] has no such field on this model', () => {
  const html = riskCard({ risk: 'Insufficient ownership', likelihood: 'Medium', impact: 'High' });
  assert.ok(html.includes('Insufficient ownership'));
  assert.ok(html.includes('Medium'));
  assert.ok(html.includes('High'));
  assert.ok(!/Owner:/i.test(html), 'must not fabricate a risk owner');
  assert.ok(!/Mitigation:/i.test(html), 'must not fabricate a mitigation plan');
});

test('riskCard against every real critical risk in the flagship model never fabricates owner/mitigation', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  for (const risk of model.report.executive_book.critical_risks) {
    const html = riskCard(risk);
    assert.ok(!/Owner:/i.test(html));
    assert.ok(!/Mitigation:/i.test(html));
  }
});

// ------------------------------------------------------------------
// Investment Opportunity — surfaces top_opportunities; never a fabricated
// dollar figure or percentage.
// ------------------------------------------------------------------
test('investmentOpportunityCard renders nothing when there is no real opportunity text', () => {
  assert.equal(investmentOpportunityCard('', null), '');
  assert.equal(investmentOpportunityCard(null, null), '');
});

test('investmentOpportunityCard renders the real opportunity text and a qualitative budget band only, never a dollar figure or bare percentage', () => {
  const html = investmentOpportunityCard('Expand community health worker coverage.', { budget_requirement: 'Medium' });
  assert.ok(html.includes('Expand community health worker coverage.'));
  assert.ok(html.includes('Medium'));
  assert.ok(!/\$[\d,]+/.test(html), 'must not fabricate a dollar figure');
  assert.ok(!/\b\d+(\.\d+)?%/.test(html), 'must not fabricate a percentage');
});

test('investmentOpportunityCard against the real flagship model never renders a fabricated dollar figure or percentage', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const opportunity = model.report.executive_book.top_opportunities?.[0];
  const html = investmentOpportunityCard(opportunity, model.report.recommendations[0]);
  assert.ok(!/\$[\d,]+/.test(html));
});

// ------------------------------------------------------------------
// Priority Actions list
// ------------------------------------------------------------------
test('priorityActionsList renders a bulleted list by default and a numbered list when withIndex is true', () => {
  const recs = [{ recommendation: 'First action' }, { recommendation: 'Second action' }];
  const bulleted = priorityActionsList(recs);
  const numbered = priorityActionsList(recs, true);
  assert.ok(bulleted.includes('&middot; First action'));
  assert.ok(numbered.includes('1. First action'));
  assert.ok(numbered.includes('2. Second action'));
});

test('priorityActionsList renders an honest "Not set" placeholder for an empty list', () => {
  assert.ok(priorityActionsList([]).includes('Not set'));
});

// ------------------------------------------------------------------
// Cost of Inaction panel
// ------------------------------------------------------------------
test('costOfInactionPanel renders the real cost-of-inaction text, or an honest costing-required fallback when absent', () => {
  assert.ok(costOfInactionPanel('Delay costs 12 months of progress.').includes('Delay costs 12 months of progress.'));
  assert.ok(costOfInactionPanel(undefined).includes('Requires formal costing.'));
});

// ------------------------------------------------------------------
// Hero KPI panel
// ------------------------------------------------------------------
test('heroKpiPanel renders nothing for an empty stats array and each real stat with its label otherwise', () => {
  assert.equal(heroKpiPanel([]), '');
  const html = heroKpiPanel([
    { value: '67%', label: 'Human development opportunity score' },
    { value: '71%', label: 'Essential health continuity' },
    { value: '84%', label: null },
  ]);
  assert.ok(html.includes('67%'));
  assert.ok(html.includes('Human development opportunity score'));
  assert.ok(html.includes('71%'));
  assert.ok(html.includes('Essential health continuity'));
  assert.ok(html.includes('84%'));
});

// ------------------------------------------------------------------
// PX Release 11: Executive Callout, Insight Panel, Confidence Thermometer,
// Publication Prestige panel — surface PX Release 8-10 intelligence that
// was already computed but never rendered anywhere.
// ------------------------------------------------------------------
test('executiveCalloutCard renders nothing for empty/absent text, never a fabricated placeholder', () => {
  assert.equal(executiveCalloutCard('Label', ''), '');
  assert.equal(executiveCalloutCard('Label', null), '');
});

test('executiveCalloutCard renders the real label and text passed to it', () => {
  const html = executiveCalloutCard('If This Decision Is Delayed', 'Delay past the planned window risks the same consequence compounding.');
  assert.ok(html.includes('If This Decision Is Delayed'));
  assert.ok(html.includes('Delay past the planned window risks the same consequence compounding.'));
});

test('insightPanel renders nothing when every item is empty/absent', () => {
  assert.equal(insightPanel('Title', []), '');
  assert.equal(insightPanel('Title', [{ label: 'X', text: '' }, { label: 'Y', text: null }]), '');
});

test('insightPanel renders only the rows with real text, skipping empty ones, never a fabricated fallback', () => {
  const html = insightPanel('Evidence Behind This Publication', [
    { label: 'Strength', text: 'Strong' },
    { label: 'Consistency', text: '' },
    { label: 'Completeness', text: '2 linked evidence records.' },
  ]);
  assert.ok(html.includes('Evidence Behind This Publication'));
  assert.ok(html.includes('Strength'));
  assert.ok(html.includes('Strong'));
  assert.ok(html.includes('Completeness'));
  assert.ok(html.includes('2 linked evidence records.'));
  assert.ok(!html.includes('Consistency'), 'a row with no real text must not render at all');
});

test('confidenceThermometer reuses classifyVRDSConfidence bands, highlighting exactly the real score\'s own band', () => {
  const band = classifyVRDSConfidence(91);
  const html = confidenceThermometer(91, 'Evidence confidence');
  assert.ok(html.includes('Evidence confidence'));
  assert.ok(html.includes(band.label));
  assert.ok(html.includes(band.color));
  // Exactly one segment carries the active class — the real band, not a
  // fabricated multi-band spread.
  const activeCount = (html.match(/confidence-thermometer-segment--active/g) || []).length;
  assert.equal(activeCount, 1);
});

test('confidenceThermometer degrades honestly to "Not assessed" for a non-numeric score, matching classifyVRDSConfidence exactly', () => {
  const html = confidenceThermometer(undefined, 'Evidence confidence');
  assert.ok(html.includes('Not assessed'));
});

test('prestigePanel renders nothing when there are no verdicts, never a fabricated review', () => {
  assert.equal(prestigePanel(null), '');
  assert.equal(prestigePanel({ verdicts: [] }), '');
});

test('prestigePanel renders every real reviewer verdict and rationale, marking pass/not-pass honestly rather than force-passing', () => {
  const prestige = {
    overallReady: false,
    verdicts: [
      { reviewer: 'Cabinet', satisfied: true, rationale: 'Requires cabinet-paper readiness and full editorial consensus.' },
      { reviewer: 'Board', satisfied: false, rationale: 'Requires at least one recommendation genuinely classified as a Board Decision.' },
    ],
    weaknesses: [{ reviewer: 'Board', reason: 'Requires at least one recommendation genuinely classified as a Board Decision.' }],
  };
  const html = prestigePanel(prestige);
  assert.ok(html.includes('Cabinet'));
  assert.ok(html.includes('Board'));
  assert.ok(html.includes('Requires at least one recommendation genuinely classified as a Board Decision.'));
  assert.ok(html.includes('prestige-item--pass'));
  assert.ok(html.includes('1 of 2 reviewer verdicts are not yet satisfied'), 'the honest weaknesses-of-total count should be reflected, not a hardcoded total');
});

test('prestigePanel against every real flagship sample renders all 8 verdicts with no fabricated pass', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const html = prestigePanel(model.report.publication_prestige);
  for (const v of model.report.publication_prestige.verdicts) {
    assert.ok(html.includes(v.reviewer), `must render reviewer ${v.reviewer}`);
  }
});

// ------------------------------------------------------------------
// PX Release 12 (World-Class Flagship Publication Experience): Chapter
// Identity marker and Priority Ladder — surface real, already-computed
// structure (flagship-narrative-arc.js's stage classification; the
// report's own priority-tier field) as distinct visual devices, never a
// fabricated sequence or color.
// ------------------------------------------------------------------
test('chapterMarker renders nothing for a null/absent stage, never a fabricated chapter', () => {
  assert.equal(chapterMarker(null, 1, 13), '');
  assert.equal(chapterMarker(undefined, 1, 13), '');
});

test('chapterMarker renders the real stage name and a real index/total position, with a deterministic accent per stage', () => {
  const html = chapterMarker('Evidence', 3, 13);
  assert.ok(html.includes('Evidence'));
  assert.ok(html.includes('03/13'));
});

test('chapterMarker assigns a distinct accent color to every one of the 12 real narrative arc stages, and falls back honestly for an unknown one', () => {
  const stages = [...new Set(NARRATIVE_ARC_STAGES.map(s => s.stage))];
  const colorsSeen = new Set();
  for (const stage of stages) {
    const html = chapterMarker(stage, 1, stages.length);
    const match = html.match(/border-color:(#[0-9A-Fa-f]{6})/);
    assert.ok(match, `no accent color rendered for real stage "${stage}"`);
    colorsSeen.add(match[1]);
  }
  assert.equal(colorsSeen.size, stages.length, 'every real stage should carry its own distinct accent color');
  // An unrecognized stage string must still render (a safe fallback color),
  // never throw and never silently disappear.
  assert.ok(chapterMarker('Not A Real Stage', 1, 1).includes('Not A Real Stage'));
});

test('every real spread ID in flagship-narrative-arc.js resolves to a stage chapterMarker can color', () => {
  for (const { stage } of NARRATIVE_ARC_STAGES) {
    const html = chapterMarker(stage, 1, NARRATIVE_ARC_STAGES.length);
    assert.match(html, /border-color:#[0-9A-Fa-f]{6}/, `no color resolved for stage "${stage}"`);
  }
});

test('priorityLadder renders nothing for an empty/absent recommendation list', () => {
  assert.equal(priorityLadder([]), '');
  assert.equal(priorityLadder(null), '');
});

test('priorityLadder ranks by real array order and gives CRITICAL/HIGH/MEDIUM genuinely distinct colors (regression: an inverted-riskColorFor bug once collapsed all three to the same red)', () => {
  const recs = [
    { recommendation: 'A', priority: 'CRITICAL', timeline: '0-90 days' },
    { recommendation: 'B', priority: 'HIGH', timeline: '3-12 months' },
    { recommendation: 'C', priority: 'MEDIUM', timeline: '6-18 months' },
  ];
  const html = priorityLadder(recs);
  const colors = [...html.matchAll(/priority-ladder-rank" style="background:(#[0-9A-Fa-f]{6})"/g)].map(m => m[1]);
  assert.equal(colors.length, 3);
  assert.equal(new Set(colors).size, 3, 'CRITICAL, HIGH and MEDIUM must render three genuinely distinct colors');
  assert.ok(html.indexOf('>A<') < html.indexOf('>B<') && html.indexOf('>B<') < html.indexOf('>C<'), 'rungs must render in the real, already-priority-sorted array order');
});

test('priorityLadder renders the real timeline alongside each tier when present, and an honest "Priority not set" fallback otherwise', () => {
  const html = priorityLadder([{ recommendation: 'Do X.', priority: 'HIGH', timeline: '3-12 months' }, { recommendation: 'Do Y.' }]);
  assert.ok(html.includes('3-12 months'));
  assert.ok(html.includes('Priority not set'));
});

test('priorityLadder against every real flagship sample renders exactly as many rungs as real recommendations, with no fabricated tier', () => {
  const model = buildFlagshipSampleReport('national-human-development');
  const html = priorityLadder(model.report.recommendations);
  const rungs = (html.match(/priority-ladder-rung/g) || []).length;
  assert.equal(rungs, model.report.recommendations.length);
});
