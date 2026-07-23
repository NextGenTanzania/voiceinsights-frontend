// Publication Rhythm Validator — EAD Release 2, Part 6.
//
// Operates on the real, ordered array of art-direction plans
// (editorial-art-direction-engine.js's buildArtDirectionPlans output, in
// composePublicationSpreads's real render order) plus the real composed
// spreads themselves, and detects publication-level monotony: the same
// layout family, dominant visual type, density, or hierarchy repeating
// often enough that the publication stops reading as art-directed and
// starts reading as one template stamped 20 times.
//
// Deliberately reuses, not duplicates: exact component-signature repetition
// is already detected by editorial-intelligence-validator.js's
// detectRepeatedSpreadStructure — this module does not reimplement that
// check, it re-exports a thin wrapper so a caller can get every rhythm rule
// from one place without this file forking that logic.
import { detectRepeatedSpreadStructure } from './editorial-intelligence-validator.js';

export const PUBLICATION_RHYTHM_VALIDATOR_VERSION = 'publication-rhythm-validator-v1';

function consecutiveRunIssues(plans, keyFn, rule, maxRun = 2) {
  const issues = [];
  let runStart = 0;
  for (let i = 1; i <= plans.length; i++) {
    const same = i < plans.length && keyFn(plans[i]) != null && keyFn(plans[i]) === keyFn(plans[runStart]);
    if (!same) {
      const runLength = i - runStart;
      if (runLength > maxRun && keyFn(plans[runStart]) != null) {
        issues.push({
          rule, value: keyFn(plans[runStart]), spreads: plans.slice(runStart, i).map(p => p.spreadId),
          runLength, severity: runLength >= maxRun + 2 ? 'high' : 'medium',
        });
      }
      runStart = i;
    }
  }
  return issues;
}

// No three consecutive spreads may share a layout family.
export function detectLayoutFamilyMonotony(plans) {
  return consecutiveRunIssues(plans, p => p.layoutFamily, 'layout_family_monotony', 2);
}

// No three consecutive spreads may share a dominant visual type.
export function detectDominantVisualTypeMonotony(plans) {
  return consecutiveRunIssues(plans, p => p.dominantVisualType, 'dominant_visual_type_monotony', 2);
}

// Visual density must deliberately alternate — no 3-in-a-row at the same level.
export function detectVisualDensityMonotony(plans) {
  return consecutiveRunIssues(plans, p => p.visualDensity, 'visual_density_monotony', 2);
}

// Text density must deliberately alternate — no 3-in-a-row at the same level.
export function detectTextDensityMonotony(plans) {
  return consecutiveRunIssues(plans, p => p.textDensity, 'text_density_monotony', 2);
}

// No more than two consecutive table-heavy pages (dominant or any real
// permitted component naming a table).
function isTableHeavy(plan) {
  return /table/i.test(plan.dominantVisualType || '') || (plan.permittedComponents || []).some(c => /table/i.test(c));
}
export function detectTableHeavyRun(plans) {
  const issues = [];
  let runStart = -1;
  for (let i = 0; i <= plans.length; i++) {
    const heavy = i < plans.length && isTableHeavy(plans[i]);
    if (heavy) { if (runStart === -1) runStart = i; }
    else {
      if (runStart !== -1 && i - runStart > 2) {
        issues.push({ rule: 'table_heavy_run', spreads: plans.slice(runStart, i).map(p => p.spreadId), runLength: i - runStart, severity: 'medium' });
      }
      runStart = -1;
    }
  }
  return issues;
}

// No more than two consecutive card-heavy pages.
function isCardHeavy(plan) {
  return /card/i.test(plan.dominantVisualType || '') || (plan.permittedComponents || []).some(c => /card/i.test(c));
}
export function detectCardHeavyRun(plans) {
  const issues = [];
  let runStart = -1;
  for (let i = 0; i <= plans.length; i++) {
    const heavy = i < plans.length && isCardHeavy(plans[i]);
    if (heavy) { if (runStart === -1) runStart = i; }
    else {
      if (runStart !== -1 && i - runStart > 2) {
        issues.push({ rule: 'card_heavy_run', spreads: plans.slice(runStart, i).map(p => p.spreadId), runLength: i - runStart, severity: 'medium' });
      }
      runStart = -1;
    }
  }
  return issues;
}

// No two (or more) consecutive spreads with no real visual anchor at all —
// a real content gap (an all-prose stretch), not a styling defect.
export function detectNoVisualAnchorRun(plans) {
  const issues = [];
  let runStart = -1;
  for (let i = 0; i <= plans.length; i++) {
    const anchorless = i < plans.length && !plans[i].dominantVisualType;
    if (anchorless) { if (runStart === -1) runStart = i; }
    else {
      if (runStart !== -1 && i - runStart > 1) {
        issues.push({ rule: 'no_visual_anchor_run', spreads: plans.slice(runStart, i).map(p => p.spreadId), runLength: i - runStart, severity: 'medium' });
      }
      runStart = -1;
    }
  }
  return issues;
}

// Excessive reuse of one real column-grid split (col-8/col-4 or col-6/
// col-6), read directly from each spread's own rendered HTML — a real
// signal, not part of the plan schema, since grid usage is a layout detail
// individual build*Spread functions already choose per real content shape.
// "Excessive" is judged two ways: any single split used on more than half
// of the spreads that use a two-column split at all, or 3+ consecutive
// spreads sharing the identical split.
function gridSplitOf(html) {
  const cols = [...String(html).matchAll(/class="col-(\d+)"/g)].map(m => Number(m[1]));
  if (cols.length !== 2) return null;
  const [a, b] = cols.slice().sort((x, y) => y - x);
  if (a === 8 && b === 4) return '8/4';
  if (a === 6 && b === 6) return '6/6';
  return null;
}
export function detectGridSplitOveruse(spreads) {
  const splits = spreads.map(s => ({ id: s.id, split: gridSplitOf(s.html) }));
  const used = splits.filter(s => s.split);
  const issues = [];
  if (used.length >= 3) {
    const counts = new Map();
    for (const { split } of used) counts.set(split, (counts.get(split) || 0) + 1);
    for (const [split, count] of counts) {
      if (count > used.length / 2) {
        issues.push({ rule: 'grid_split_overuse', split, count, of: used.length, spreads: used.filter(s => s.split === split).map(s => s.id), severity: 'low' });
      }
    }
  }
  const runIssues = consecutiveRunIssues(splits, s => s.split, 'grid_split_consecutive_run', 2)
    .map(issue => ({ ...issue, spreads: issue.spreads }));
  return [...issues, ...runIssues];
}

// No 3 consecutive spreads share the same hierarchyStrategy (their opening
// content-priority pattern) — real content variety in what leads each page.
export function detectRepeatedOpeningHierarchy(plans) {
  return consecutiveRunIssues(plans, p => p.hierarchyStrategy, 'repeated_opening_hierarchy', 2);
}

// "Closing hierarchy" proxy: the last real component type each spread
// actually renders (spread.components, real render order) — a defensible,
// simple, real stand-in for "what a reader sees right before leaving this
// page," not a fabricated second taxonomy.
export function detectRepeatedClosingHierarchy(spreads) {
  const lastType = s => (s.components || []).length ? s.components[s.components.length - 1].type : null;
  const proxies = spreads.map(s => ({ spreadId: s.id, value: lastType(s) }));
  return consecutiveRunIssues(proxies.map(p => ({ spreadId: p.spreadId, hierarchyStrategy: p.value })), p => p.hierarchyStrategy, 'repeated_closing_hierarchy', 2);
}

// Decision Canvas A and B: related but visibly different. Checked two real
// ways — their plans must carry two different, real, non-null subLayout
// values, and their rendered HTML must not be byte-identical (a defensive
// regression guard; identical HTML here would mean the two spreads render
// the exact same recommendations, which decisionA/decisionB's own slicing
// in composePublicationSpreads should already prevent).
export function detectDecisionCanvasSimilarity(plans, spreads) {
  const issues = [];
  const planA = plans.find(p => p.spreadId === 'decisions-a');
  const planB = plans.find(p => p.spreadId === 'decisions-b');
  if (planA && planB) {
    if (!planA.subLayout || !planB.subLayout || planA.subLayout === planB.subLayout) {
      issues.push({ rule: 'decision_canvas_sublayout_not_distinct', subLayoutA: planA.subLayout, subLayoutB: planB.subLayout, severity: 'high' });
    }
  }
  const spreadA = spreads.find(s => s.id === 'decisions-a');
  const spreadB = spreads.find(s => s.id === 'decisions-b');
  if (spreadA && spreadB && spreadA.html === spreadB.html) {
    issues.push({ rule: 'decision_canvas_identical_render', severity: 'high' });
  }
  return issues;
}

// ------------------------------------------------------------------
// Aggregate entry point — every rhythm rule from one call, matching the
// house style of editorial-intelligence-validator.js's validatePublication.
// ------------------------------------------------------------------
export function validatePublicationRhythm(plans = [], spreads = []) {
  const issues = [
    ...detectLayoutFamilyMonotony(plans),
    ...detectDominantVisualTypeMonotony(plans),
    ...detectVisualDensityMonotony(plans),
    ...detectTextDensityMonotony(plans),
    ...detectTableHeavyRun(plans),
    ...detectCardHeavyRun(plans),
    ...detectNoVisualAnchorRun(plans),
    ...detectGridSplitOveruse(spreads),
    ...detectRepeatedOpeningHierarchy(plans),
    ...detectRepeatedClosingHierarchy(spreads),
    ...detectDecisionCanvasSimilarity(plans, spreads),
    ...detectRepeatedSpreadStructure(spreads),
  ];
  const bySeverity = { high: 0, medium: 0, low: 0 };
  for (const issue of issues) bySeverity[issue.severity || 'low'] = (bySeverity[issue.severity || 'low'] || 0) + 1;
  return { validator_version: PUBLICATION_RHYTHM_VALIDATOR_VERSION, passed: issues.length === 0, issue_count: issues.length, issues_by_severity: bySeverity, issues };
}
