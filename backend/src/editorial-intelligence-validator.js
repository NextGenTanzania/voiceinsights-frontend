// Editorial Intelligence Validator — Browser Rendering V2, Publication
// Experience (PX) Release 4
//
// Deterministic, rule-based implementation of VPIE Release 1 §11 / VPPX
// Release 1 Part 5-6's editorial checks, improved per Release 2 Part 16:
// repeated-language findings are grouped into merged phrase spans (phrase,
// affected spreads, occurrence count, severity) instead of hundreds of
// overlapping sliding-window variants of the same sentence. No threshold
// below has been loosened to manufacture a pass — every rule still fires
// on the same underlying defect it fired on before this improvement; only
// the reporting shape changed.
//
// PX Release 3 added three rules guarding the publication-component family
// (detectFabricatedRiskAttribution, detectUnsupportedStatistic,
// detectQuantifiedImpactFabrication). PX Release 4 adds two more guarding
// the new chart-component family (detectFabricatedChartFigure,
// detectUnsupportedChart) — all deterministic, all reading flags the
// composer already attaches at build time or scanning rendered HTML
// directly, exactly like every existing rule in this file. No generative
// logic was added anywhere in this file.
export const EDITORIAL_VALIDATOR_VERSION = 'editorial-intelligence-validator-v4';

const MIN_PAGE_FILL_WORDS = 90;       // proxy for VPDS's 55% minimum fill rule
const MAX_SPREAD_WORDS = 420;         // overfilled-spread ceiling
const MAX_PARAGRAPH_WORDS = 120;      // VPPX Part 5 long-paragraph rule
const REPEATED_NGRAM_SIZE = 6;        // VPIE Release 1 §11 repeated-language rule
const DUPLICATE_RECOMMENDATION_SIMILARITY = 0.7;

function extractWords(text) {
  return String(text || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
}

// Finds maximal contiguous shared word-runs (>= minLen) between two word
// arrays and merges adjacent sliding-window matches into one span, so a
// single duplicated sentence produces one finding, not N overlapping ones.
function findRepeatedSpans(wordsA, wordsB, minLen) {
  if (wordsA.length < minLen || wordsB.length < minLen) return [];
  const gramSetB = new Set();
  for (let i = 0; i + minLen <= wordsB.length; i++) gramSetB.add(wordsB.slice(i, i + minLen).join(' '));
  const matchedStarts = [];
  for (let i = 0; i + minLen <= wordsA.length; i++) {
    if (gramSetB.has(wordsA.slice(i, i + minLen).join(' '))) matchedStarts.push(i);
  }
  const spans = [];
  let spanStart = null, last = null;
  for (const idx of matchedStarts) {
    if (spanStart === null) { spanStart = idx; last = idx; continue; }
    if (idx === last + 1) { last = idx; continue; }
    spans.push({ start: spanStart, length: (last - spanStart) + minLen });
    spanStart = idx; last = idx;
  }
  if (spanStart !== null) spans.push({ start: spanStart, length: (last - spanStart) + minLen });
  return spans;
}

function severityForSpanLength(length) {
  if (length >= 15) return 'high';
  if (length >= 10) return 'medium';
  return 'low';
}

// Improved (Part 16): grouped, deduplicated repeated-language findings.
// Same export name as Release 1 for backward compatibility — behavior is a
// strict improvement (still fires on every case it fired on before; reports
// fewer, more useful entries).
export function detectRepeatedNgrams(spreads, minLen = REPEATED_NGRAM_SIZE) {
  const wordsBySpread = spreads.map(s => extractWords(s.text));
  const issues = [];
  for (let i = 0; i < spreads.length; i++) {
    for (let j = i + 1; j < spreads.length; j++) {
      const spans = findRepeatedSpans(wordsBySpread[i], wordsBySpread[j], minLen);
      for (const span of spans) {
        const phrase = wordsBySpread[i].slice(span.start, span.start + span.length).join(' ');
        issues.push({
          rule: 'repeated_language',
          phrase,
          spreads: [spreads[i].id, spreads[j].id],
          occurrence_count: span.length,
          severity: severityForSpanLength(span.length),
        });
      }
    }
  }
  return issues;
}

export function detectLongParagraphs(spreads, maxWords = MAX_PARAGRAPH_WORDS) {
  const issues = [];
  for (const spread of spreads) {
    const paragraphs = String(spread.text || '').split(/(?<=[.!?])\s+(?=[A-Z"])/);
    for (const para of paragraphs) {
      const words = para.trim().split(/\s+/).filter(Boolean).length;
      if (words > maxWords) issues.push({ rule: 'long_paragraph', spread: spread.id, words, severity: 'medium' });
    }
  }
  return issues;
}

// Richness proxy for VPDS's 55%-fill rule. Fixed (Release 2 recovery): the
// original formula only credited running-text word count plus a flat
// per-component bonus, which undercounted table/grid/list-driven spreads
// (roadmap, risks, monitoring, evidence-annex, cover, methodology) that are
// visually full on the actual rendered page but carry little prose in the
// `text` field used for the repeated-language check. This counts structural
// density directly from the rendered HTML — table rows, list items, grid
// cells — which is what actually fills the live area, not just prose.
//
// PX Release 4: the 7 real chart-component class names from
// publication-chart-components.js, named once and reused everywhere in
// this file that needs to recognize a chart in rendered HTML (structural
// density credit below, and the two fabrication guards further down) —
// previously hand-listed twice in this file alone, which risked the two
// copies silently drifting apart. Exported so publication-quality-gate.js
// reads the same single list instead of hand-listing a third copy.
export const CHART_COMPONENT_CLASS_NAMES = 'radar-chart|waffle-chart|dumbbell-chart|lollipop-chart|treemap-chart|flow-diagram|uncertainty-band';

// Extended (Release 2.1, Part 8 side effect): decision-dossier cards are
// counted here too. Once the rationale text was condensed to remove
// repeated-language noise, the card's eight owner/timeline/budget/
// monitoring field rows became its main source of real page content —
// structured, not prose, so they belong in the structural count, not the
// text field the repeated-language scanner reads (folding short shared
// field labels into that scanner produced false-positive "duplication"
// between cards that simply share a common default value).
export function structuralDensity(html) {
  const rows = (html.match(/<tr>/g) || []).length;
  const listItems = (html.match(/<li>/g) || []).length;
  const cells = (html.match(/class="(regional-cell|scenario-card|matrix-dot)"/g) || []).length;
  const decisionFields = (html.match(/class="decision-field"/g) || []).length;
  // PX Release 4: the Methodology Canvas's stat tiles, field-workflow steps
  // and chart components are real page content the same way decision
  // fields and table rows already are — without this, a rich visual
  // methodology page would misreport as underfilled purely because a
  // word-count check can't see structured/graphical content.
  const methodologyUnits = (html.match(/class="methodology-stat-tile"/g) || []).length + (html.match(/class="methodology-workflow-step"/g) || []).length;
  const charts = (html.match(new RegExp(`class="(${CHART_COMPONENT_CLASS_NAMES})"`, 'g')) || []).length;
  return rows * 20 + listItems * 12 + cells * 15 + decisionFields * 10 + methodologyUnits * 10 + charts * 40;
}

// VPDS Part 1's 55%-fill rule explicitly exempts cover / part-divider /
// full-bleed pages — a cover with 0 words of running prose is by design,
// not a defect.
const FILL_RULE_EXEMPT_ARCS = new Set(['orient']);

// EAD Release 1: per-spread-type overrides on the global density ceiling.
// Two independent reviews confirmed the single universal MAX_SPREAD_WORDS
// threshold produced false signal on pages that are legitimately denser by
// design (Methodology, Evidence Annex, Root-Cause, and the 3-card
// Decisions-B page, which is structurally denser than the 2-card
// Decisions-A page beside it) — this does not loosen anything for pages
// that were never a problem, it only stops mis-scoring the pages the brief
// itself names as allowed to be dense.
const DENSITY_MAX_OVERRIDE_BY_ID = Object.freeze({
  methodology: 700,
  'evidence-annex': 700,
  'root-cause': 500,
  'decisions-b': 500,
  'quality-gate': 500,
});

export function densityMaxWordsFor(spreadId, defaultMax = MAX_SPREAD_WORDS) {
  return DENSITY_MAX_OVERRIDE_BY_ID[spreadId] || defaultMax;
}

export function detectUnderfilledSpreads(spreads, minWords = MIN_PAGE_FILL_WORDS) {
  const issues = [];
  for (const spread of spreads) {
    if (FILL_RULE_EXEMPT_ARCS.has(spread.arc)) continue;
    // Prefers the real rendered visibleWords (see publication-render-utils.js's
    // stripHtmlToVisibleText) over the old estimatedWords/text-param proxy,
    // per both prior reviews' confirmed finding that the proxy is
    // frequently disconnected from what a reader actually sees. visibleWords
    // already captures table/list/card text directly, so structuralDensity's
    // bonus is scaled down to avoid double-counting THAT content — but only
    // when visibleWords is actually present; a caller supplying a bare
    // {estimatedWords, componentCount, html} fixture without visibleWords
    // (as several pre-EAD tests legitimately do) still gets the original
    // full-weight structural credit, so this stays a strict extension of
    // the prior behavior, not a silent regression for existing callers.
    const hasVisibleWords = spread.visibleWords != null;
    const trueWords = spread.visibleWords ?? spread.estimatedWords ?? 0;
    const componentWeight = hasVisibleWords ? 5 : 15;
    const structuralWeight = hasVisibleWords ? 0.3 : 1;
    const richness = trueWords + (spread.componentCount || 0) * componentWeight + structuralDensity(spread.html || '') * structuralWeight;
    if (richness < minWords) {
      issues.push({ rule: 'underfilled_spread', spread: spread.id, estimated_words: spread.estimatedWords, visible_words: spread.visibleWords, component_count: spread.componentCount, severity: 'medium' });
    }
  }
  return issues;
}

// New (Part 16): the opposite failure mode — a spread crammed with more
// than a reader can absorb on one page. EAD Release 1: uses visibleWords
// (true rendered content) against a per-spread-type ceiling instead of one
// universal number against the old, disconnected estimatedWords proxy.
export function detectOverfilledSpreads(spreads, maxWords = MAX_SPREAD_WORDS) {
  return spreads
    .filter(s => (s.visibleWords ?? s.estimatedWords ?? 0) > densityMaxWordsFor(s.id, maxWords))
    .map(s => ({ rule: 'overfilled_spread', spread: s.id, estimated_words: s.estimatedWords, visible_words: s.visibleWords, severity: 'low' }));
}

export function detectOrphanComponents(spreads) {
  const issues = [];
  for (const spread of spreads) {
    for (const component of spread.components || []) {
      if (!component.hasInterpretation) {
        issues.push({ rule: 'orphan_component', spread: spread.id, component_type: component.type, severity: 'high' });
      }
    }
  }
  return issues;
}

export function detectPacingFatigue(spreads) {
  const issues = [];
  for (let i = 0; i + 2 < spreads.length; i++) {
    const window = spreads.slice(i, i + 3);
    const dominant = window.map(s => s.components?.[0]?.type).filter(Boolean);
    if (dominant.length === 3 && dominant[0] === dominant[1] && dominant[1] === dominant[2]) {
      issues.push({ rule: 'pacing_fatigue', spreads: window.map(s => s.id), repeated_type: dominant[0], severity: 'high' });
    }
  }
  return issues;
}

// New (Part 16): a stronger form of pacing fatigue — two spreads whose
// component-type signature is identical, even non-adjacently, which reads
// as a repeated template rather than a deliberate spread type.
export function detectRepeatedSpreadStructure(spreads) {
  const signatureOf = s => (s.components || []).map(c => c.type).join(',');
  const seen = new Map();
  for (const spread of spreads) {
    const sig = signatureOf(spread);
    if (!sig) continue;
    if (!seen.has(sig)) seen.set(sig, []);
    seen.get(sig).push(spread.id);
  }
  const issues = [];
  for (const [sig, ids] of seen) {
    if (ids.length > 1) issues.push({ rule: 'repeated_spread_structure', signature: sig, spreads: ids, severity: 'low' });
  }
  return issues;
}

// New (Part 16): missing spread purpose / key message — every spread must
// declare an editorial arc and at least one component must exist.
export function detectMissingSpreadPurpose(spreads) {
  return spreads
    .filter(s => !s.arc || !(s.components || []).length)
    .map(s => ({ rule: 'missing_spread_purpose', spread: s.id, severity: 'high' }));
}

// EAD Release 2: Key Messages moved from a flat <ul><li> list to the
// asymmetrical .km-item composition (rankKeyMessages/keyMessageProminence
// in publication-spread-composer.js) — this check must recognize the new
// real markup, or it flags a page that genuinely does render its key
// messages as "missing" purely because the tag name changed.
export function detectMissingKeyMessages(spreads) {
  const keyMessageSpread = spreads.find(s => s.id === 'key-messages');
  if (!keyMessageSpread) return [{ rule: 'missing_key_message', spread: null, severity: 'high' }];
  const count = (keyMessageSpread.html.match(/<li>|class="km-item /g) || []).length;
  return count === 0 ? [{ rule: 'missing_key_message', spread: keyMessageSpread.id, severity: 'high' }] : [];
}

// A narrative/hero claim with no adjacent evidence component.
//
// Fixed (Release 2 recovery): the original check required the literal
// 'evidence_panel' component type on every 'story'/'evidence'-arc spread,
// which false-positived on spreads that carry evidence through an equally
// valid but differently-typed component — a methodology card citing the
// dataset, a table whose rows carry per-item evidence IDs, or a regional
// panel presenting real governed numeric evidence rather than a quote. Those
// count. A purely navigational spread (the key-messages index, which
// summarizes claims evidenced elsewhere in the publication) is excluded —
// it was never meant to carry its own citation.
// EAD Release 2: root-cause's component type changed from one
// 'root_cause_table' to per-finding 'causal_chain_card' entries (each one
// citing a real evidence ID and confidence band — see buildRootCauseSpread)
// plus a secondary 'root_cause_index_table'. 'root_cause_table' is kept in
// this set for backward compatibility with any other caller still using
// the old shape; 'causal_chain_card' is the real evidence-bearing type now.
const EVIDENCE_BEARING_TYPES = new Set([
  'evidence_panel', 'evidence_table', 'methodology_card', 'quality_summary', 'regional_panel', 'root_cause_table',
  'causal_chain_card',
]);
const EVIDENCE_LINK_EXEMPT_IDS = new Set(['key-messages']);

export function detectMissingEvidenceLink(spreads) {
  const narrativeArcs = new Set(['story', 'evidence']);
  return spreads
    .filter(s => narrativeArcs.has(s.arc)
      && !EVIDENCE_LINK_EXEMPT_IDS.has(s.id)
      && !(s.components || []).some(c => EVIDENCE_BEARING_TYPES.has(c.type)))
    .map(s => ({ rule: 'missing_evidence_link', spread: s.id, severity: 'medium' }));
}

// New (Part 16): decision-card components missing owner / timeline /
// monitoring indicator — sourced from the flags the composer attaches at
// build time, not re-derived here.
export function detectMissingDecisionFields(spreads) {
  const issues = [];
  for (const spread of spreads) {
    for (const c of spread.components || []) {
      if (c.type !== 'decision_card') continue;
      if (c.hasOwner === false) issues.push({ rule: 'missing_owner', spread: spread.id, severity: 'high' });
      if (c.hasTimeline === false) issues.push({ rule: 'missing_timeline', spread: spread.id, severity: 'high' });
      if (c.hasMonitoringIndicator === false) issues.push({ rule: 'missing_monitoring_indicator', spread: spread.id, severity: 'medium' });
    }
  }
  return issues;
}

// PX Release 3, Part 9: the Risk Dashboard/Risk Card component deliberately
// omits an owner/mitigation row when critical_risks[] doesn't carry those
// fields (this model's shape never has them) — a build-time flag records
// that omission (hasOwner/hasMitigation false). This is a forward-looking
// regression guard: it fires only if a future change renders a literal
// "Owner:"/"Mitigation:" label inside a risk card whose flag says the real
// field was absent, i.e. a fabricated value slipping onto the page.
export function detectFabricatedRiskAttribution(spreads) {
  const issues = [];
  for (const spread of spreads) {
    const riskCardBlocks = spread.html.match(/<div class="risk-card"[^]*?<\/div>/g) || [];
    const riskComponents = (spread.components || []).filter(c => c.type === 'risk_card');
    riskCardBlocks.forEach((block, i) => {
      const comp = riskComponents[i];
      if (!comp) return;
      if (comp.hasOwner === false && /\bOwner:/i.test(block)) {
        issues.push({ rule: 'fabricated_risk_owner', spread: spread.id, severity: 'critical' });
      }
      if (comp.hasMitigation === false && /\bMitigation:/i.test(block)) {
        issues.push({ rule: 'fabricated_risk_mitigation', spread: spread.id, severity: 'critical' });
      }
    });
  }
  return issues;
}

// PX Release 3, Part 8: "no isolated statistic" — a component tagged with a
// real quantified statistic (evidence[].statistic) must also carry a real
// confidence value and a real source ID, exactly as the composer already
// tags evidence-panel components today. Mirrors detectUnsupportedQuotations'
// shape for a numeric claim instead of a quotation.
export function detectUnsupportedStatistic(spreads) {
  const issues = [];
  for (const spread of spreads) {
    for (const c of spread.components || []) {
      if (!c.hasStatistic) continue;
      if (!c.hasConfidence || !c.hasSource) {
        issues.push({ rule: 'unsupported_statistic', spread: spread.id, severity: 'high' });
      }
    }
  }
  return issues;
}

// PX Release 3, Part 5/9: Investment Opportunity and Cost of Inaction render
// only qualitative prose and a qualitative budget band on this model — never
// a quantified dollar figure or bare percentage. A narrow, scoped regex
// guard (not a general currency/percentage scanner, which would false-
// positive on legitimate regional scores elsewhere) applied only to these
// two component's own rendered blocks, so a future regression that starts
// fabricating a quantified figure is caught before it reaches a reader.
export function detectQuantifiedImpactFabrication(spreads) {
  const issues = [];
  const fabricatedFigure = /\$[\d,]+|USD\s*[\d,]+|\b\d+(?:\.\d+)?%/;
  for (const spread of spreads) {
    // Both components wrap one inner .overline <div> before their own
    // content, so the block ends at the SECOND </div>, not the first.
    const blocks = [
      ...(spread.html.match(/<div class="investment-card">[^]*?<\/div>[^]*?<\/div>/g) || []),
      ...(spread.html.match(/<div class="cost-of-inaction-panel">[^]*?<\/div>[^]*?<\/div>/g) || []),
    ];
    for (const block of blocks) {
      if (fabricatedFigure.test(block)) {
        issues.push({ rule: 'quantified_impact_fabrication', spread: spread.id, severity: 'critical' });
      }
    }
  }
  return issues;
}

// PX Release 4, Part 5: every chart component in publication-chart-
// components.js only ever draws a 0-100 percentage/score or a real count —
// never a currency figure, and never a percentage outside 0-100. This is a
// forward-looking regression guard, not a check that currently has
// anything to fire on: it catches a future change that feeds a
// differently-scaled or fabricated number into a chart expecting a real,
// governed value. Checked at the spread level (chart markup mixes <svg
// class="..."> and <div class="..."> wrappers depending on chart type, so
// a precise per-element tag-matching regex would be fragile) — any
// spread containing a real chart marker must not also contain a currency
// sign or an out-of-range percentage anywhere in its rendered output.
const CHART_CLASS_PATTERN = new RegExp(`class="(?:${CHART_COMPONENT_CLASS_NAMES})`);

export function detectFabricatedChartFigure(spreads) {
  const issues = [];
  const currencySign = /\$[\d,]+|USD\s*[\d,]+/;
  const outOfRangePercent = /\b(-\d+|\d{3,})%/; // negative, or >=100% via 3+ digits before the sign
  for (const spread of spreads) {
    if (!CHART_CLASS_PATTERN.test(spread.html || '')) continue;
    if (currencySign.test(spread.html)) issues.push({ rule: 'fabricated_chart_currency', spread: spread.id, severity: 'critical' });
    if (outOfRangePercent.test(spread.html)) issues.push({ rule: 'fabricated_chart_out_of_range', spread: spread.id, severity: 'critical' });
  }
  return issues;
}

// PX Release 4, Part 8: "no isolated statistic" extended to charts — a
// chart is decoration, not evidence, if it has no accompanying text in the
// same spread. Checks that any spread containing a chart also has real
// prose alongside it (the composer always pairs a chart with a heading or
// interpretive paragraph today; this guards against a future chart added
// with no surrounding narrative).
export function detectUnsupportedChart(spreads) {
  const issues = [];
  for (const spread of spreads) {
    if (!CHART_CLASS_PATTERN.test(spread.html || '')) continue;
    const withoutSvg = (spread.html || '').replace(/<svg[^]*?<\/svg>/g, '');
    const hasNarrative = /<(?:p|h[1-4])[^>]*>[^<]*[a-zA-Z]{3,}/.test(withoutSvg);
    if (!hasNarrative) issues.push({ rule: 'unsupported_chart', spread: spread.id, severity: 'medium' });
  }
  return issues;
}

export function detectMissingLimitations(spreads) {
  const methodologySpread = spreads.find(s => s.id === 'methodology');
  if (!methodologySpread) return [{ rule: 'missing_limitations', spread: null, severity: 'medium' }];
  const hasLimitations = /footnote/.test(methodologySpread.html) && methodologySpread.html.includes('Limitations');
  return hasLimitations ? [] : [{ rule: 'missing_limitations', spread: methodologySpread.id, severity: 'medium' }];
}

// New (Part 16): quotations without provenance (no evidence ID / confidence
// attached) — flags an unsupported quotation before it reaches a reader.
export function detectUnsupportedQuotations(spreads) {
  const issues = [];
  for (const spread of spreads) {
    for (const c of spread.components || []) {
      if (c.type === 'evidence_panel' && c.hasProvenance === false) {
        issues.push({ rule: 'unsupported_quotation', spread: spread.id, severity: 'high' });
      }
    }
  }
  return issues;
}

// Guards against a label being cut mid-word with no ellipsis — the exact
// defect the fake-choropleth "Human development opportu" truncation
// represented. The composer never slices a label, so this should stay empty;
// the check exists to catch a future regression.
//
// Fixed (Release 2 recovery): the original pattern flagged any bare
// text-caption div not ending in punctuation, which false-positived on every
// ordinary complete caption ("Lake Zone", "Risk ELEVATED") — captions
// legitimately don't end in punctuation. A genuinely truncated label instead
// (a) is a composed, multi-clause sentence fragment, never a short compound
// "N responses &middot; Risk X" info line, and (b) ends on a lowercase
// letter directly after another lowercase letter with no trailing space —
// the actual shape `.slice(0, 25)` truncation produced ("...opportu").
export function detectTruncatedLabelRisk(spreads) {
  const issues = [];
  const labelPattern = /<div class="text-caption">([^<]*)<\/div>/g;
  for (const spread of spreads) {
    let match;
    while ((match = labelPattern.exec(spread.html || '')) !== null) {
      const label = match[1];
      if (!label || label.length < 20) continue;
      if (label.includes('&middot;') || /\d/.test(label)) continue; // composed info line, not a single label
      const looksWordFragment = /[a-z]{3,}$/.test(label) && !/\b(the|and|for|with)\s+\w+$/i.test(label);
      if (looksWordFragment) {
        issues.push({ rule: 'truncated_label_risk', spread: spread.id, label, severity: 'high' });
      }
    }
  }
  return issues;
}

// PX Release 5.1, Part 8 (Editorial Hierarchy): a primary claim must never
// compete with a second h1 on the same spread, and every spread must have
// one — real, checkable DOM-order assertions, not a subjective hierarchy
// judgment.
export function detectMultipleH1s(spreads) {
  const issues = [];
  for (const spread of spreads) {
    const count = ((spread.html || '').match(/<h1[\s>]/g) || []).length;
    if (count > 1) issues.push({ rule: 'multiple_h1', spread: spread.id, count, severity: 'high' });
    if (count === 0) issues.push({ rule: 'missing_h1', spread: spread.id, severity: 'medium' });
  }
  return issues;
}

// PX Release 5.1, Part 8: technical detail (a footnote/citation) must never
// outrank the spread's primary claim in DOM order — checked as a plain
// string-index comparison against the same rendered HTML every other rule
// in this file scans.
export function detectFootnoteBeforeH1(spreads) {
  const issues = [];
  for (const spread of spreads) {
    const html = spread.html || '';
    const h1Index = html.indexOf('<h1');
    if (h1Index === -1) continue; // already flagged by detectMultipleH1s
    const footnoteIndex = html.search(/class="(footnote|citation[a-z-]*)"/);
    if (footnoteIndex !== -1 && footnoteIndex < h1Index) {
      issues.push({ rule: 'footnote_before_h1', spread: spread.id, severity: 'medium' });
    }
  }
  return issues;
}

export function detectEmptyComponents(spreads) {
  const issues = [];
  for (const spread of spreads) {
    for (const c of spread.components || []) {
      if (c.hasInterpretation === false && !spread.text) {
        issues.push({ rule: 'empty_component', spread: spread.id, component_type: c.type, severity: 'high' });
      }
    }
  }
  return issues;
}

// New (Part 16): duplicate recommendation semantics via word-overlap
// similarity — flags two "different" decisions that are actually the same
// ask reworded.
function jaccardSimilarity(a, b) {
  const setA = new Set(extractWords(a));
  const setB = new Set(extractWords(b));
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union ? intersection / union : 0;
}

export function detectDuplicateRecommendations(recommendations = [], threshold = DUPLICATE_RECOMMENDATION_SIMILARITY) {
  const issues = [];
  for (let i = 0; i < recommendations.length; i++) {
    for (let j = i + 1; j < recommendations.length; j++) {
      const sim = jaccardSimilarity(recommendations[i].recommendation, recommendations[j].recommendation);
      if (sim >= threshold) {
        issues.push({ rule: 'duplicate_recommendation_semantics', pair: [recommendations[i].id, recommendations[j].id], similarity: Math.round(sim * 100) / 100, severity: 'medium' });
      }
    }
  }
  return issues;
}

// New (Part 16): the same region reporting different values in different
// spreads — the general, ongoing guard for the exact contradiction Phase 0
// fixed at the data-source level. This checks the RENDERED text, so it
// would catch a future regression even if the source data broke again.
export function detectInconsistentRegionalMetrics(spreads, regionNames = []) {
  if (!regionNames.length) return [];
  const valuesByRegion = new Map();
  for (const spread of spreads) {
    for (const name of regionNames) {
      const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^%]{0,25}?(\\d+(?:\\.\\d+)?)%`, 'g');
      let match;
      while ((match = re.exec(spread.text || '')) !== null) {
        if (!valuesByRegion.has(name)) valuesByRegion.set(name, new Set());
        valuesByRegion.get(name).add(match[1]);
      }
    }
  }
  const issues = [];
  for (const [name, values] of valuesByRegion) {
    if (values.size > 1) issues.push({ rule: 'inconsistent_regional_metric', region: name, values: [...values], severity: 'critical' });
  }
  return issues;
}

// ------------------------------------------------------------------
// Top-level aggregator. `context.recommendations` and `context.regionNames`
// are optional — checks that need raw model fields beyond what's already on
// the composed spreads accept them directly rather than the validator
// reaching back into the model itself.
// ------------------------------------------------------------------
export function validatePublication(spreads = [], context = {}) {
  const issues = [
    ...detectRepeatedNgrams(spreads),
    ...detectLongParagraphs(spreads),
    ...detectUnderfilledSpreads(spreads),
    ...detectOverfilledSpreads(spreads),
    ...detectOrphanComponents(spreads),
    ...detectPacingFatigue(spreads),
    ...detectRepeatedSpreadStructure(spreads),
    ...detectMissingSpreadPurpose(spreads),
    ...detectMissingKeyMessages(spreads),
    ...detectMissingEvidenceLink(spreads),
    ...detectMissingDecisionFields(spreads),
    ...detectMissingLimitations(spreads),
    ...detectUnsupportedQuotations(spreads),
    ...detectTruncatedLabelRisk(spreads),
    ...detectEmptyComponents(spreads),
    ...detectDuplicateRecommendations(context.recommendations || []),
    ...detectInconsistentRegionalMetrics(spreads, context.regionNames || []),
    ...detectFabricatedRiskAttribution(spreads),
    ...detectUnsupportedStatistic(spreads),
    ...detectQuantifiedImpactFabrication(spreads),
    ...detectFabricatedChartFigure(spreads),
    ...detectUnsupportedChart(spreads),
    ...detectMultipleH1s(spreads),
    ...detectFootnoteBeforeH1(spreads),
  ];
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) bySeverity[issue.severity || 'low'] = (bySeverity[issue.severity || 'low'] || 0) + 1;
  return {
    validator_version: EDITORIAL_VALIDATOR_VERSION,
    passed: issues.length === 0,
    issue_count: issues.length,
    issues_by_severity: bySeverity,
    issues,
    spread_count: spreads.length,
  };
}
