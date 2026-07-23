// Publication Visual Components — Publication Experience (PX) Release 3,
// Parts 5 and 9.
//
// A small, self-contained library of reusable, HTML-string-returning
// publication components, consumed only by publication-spread-composer.js.
// Deliberately independent from the parallel legacy-renderer component
// families (vrds-report-experience.js, vrds-showcase-experience.js,
// infographic-layout-engine.js, publication-visual-system.js) — those serve
// PPTX/legacy-PDF/HTML-showcase exports and are out of scope for Browser
// Rendering V2; wiring them in here would couple two independent renderer
// families together, which this release explicitly does not do. Concepts
// and naming are shared where sensible; code is not.
//
// Same governing rule as every other file in this family: every rendered
// claim must trace to a real field on the governed model. A component that
// has no real backing field for part of its "ideal" shape (a risk's owner,
// a quantified expected-impact figure) omits that part rather than
// inventing a placeholder value — see the per-component notes below.
import { classifyVRDSConfidence, vrdsTokens } from './vrds-foundation.js';
import { escapeHtml, voiceThreadIcon, riskColorFor, formatStatUnit, robustTakeaway, truncateWords } from './publication-render-utils.js';

export const PUBLICATION_VISUAL_COMPONENTS_VERSION = 'publication-visual-components-v1';

// ------------------------------------------------------------------
// Confidence Meter — a real visual gauge, not just a colored pill. Reuses
// classifyVRDSConfidence()'s banding/labels/colors rather than
// reimplementing them; this component only adds the visual meter shape.
// ------------------------------------------------------------------
export function confidenceMeter(score, label = 'Confidence') {
  const band = classifyVRDSConfidence(score);
  const n = Number(score);
  const pct = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  return `<div class="confidence-meter">
    <div class="confidence-meter-label"><span class="overline">${escapeHtml(label)}</span><span class="confidence-meter-value">${escapeHtml(band.label)}${Number.isFinite(n) ? ` (${escapeHtml(n)}%)` : ''}</span></div>
    <div class="confidence-meter-track"><div class="confidence-meter-fill" style="width:${pct}%;background:${band.color}"></div></div>
  </div>`;
}

// ------------------------------------------------------------------
// Policy Alert — the single most urgent, decision-relevant item, framed so
// it cannot be missed on a 30-60 second scan. Only renders for a genuinely
// CRITICAL-priority recommendation; returns '' otherwise (never manufactures
// urgency that isn't in the governed data).
// ------------------------------------------------------------------
export function policyAlertBox(criticalRecommendation, costOfInactionText) {
  if (!criticalRecommendation) return '';
  return `<div class="policy-alert">
    <div class="policy-alert-kicker">Policy Alert &middot; Requires decision</div>
    <p class="text-bodyLarge" style="margin:0;">${escapeHtml(criticalRecommendation.recommendation)}</p>
    <p class="text-bodySmall">Owner: ${escapeHtml(criticalRecommendation.owner || 'Not assigned')} &middot; By: ${escapeHtml(criticalRecommendation.timeline || 'Not set')}</p>
    ${costOfInactionText ? `<p class="text-bodySmall"><b>If delayed:</b> ${escapeHtml(costOfInactionText)}</p>` : ''}
  </div>`;
}

// ------------------------------------------------------------------
// Critical Finding — a headline finding paired with its interpretation and
// confidence, so a bare claim never appears without the reasoning behind
// it (Part 8: no isolated statistic).
// ------------------------------------------------------------------
export function criticalFindingCard(finding, linkedEvidence) {
  if (!finding) return '';
  return `<div class="critical-finding-card">
    <p class="text-bodyLarge" style="margin:0;">${escapeHtml(finding.text || '')}</p>
    ${finding.interpretation ? `<p class="text-bodySmall">${escapeHtml(finding.interpretation)}</p>` : ''}
    ${confidenceMeter(finding.confidence_score, 'Confidence in this finding')}
    ${linkedEvidence ? `<p class="citation">Evidence ${escapeHtml(linkedEvidence.id)}</p>` : ''}
  </div>`;
}

// ------------------------------------------------------------------
// Evidence Spotlight — the fuller evidence treatment: quote, who/where,
// confidence, AND (new) the real quantified statistic on the evidence item
// when one exists (evidence[].statistic{value,unit,denominator}) — a real,
// sourced, quantified number this composer previously never surfaced.
// ------------------------------------------------------------------
// PX Release 4, Part 7: Human-Centred Storytelling. Picks a contextual
// editorial label from the real respondent_group field instead of one
// generic "Evidence" label everywhere — a real, deterministic mapping of
// real data to an editorial frame, not an invented classification.
// ------------------------------------------------------------------
export function pickHumanVoiceLabel(respondentGroup = '') {
  const g = String(respondentGroup || '').toLowerCase();
  if (/frontline|enumerator|field staff|service provider/.test(g)) return 'Frontline Reality';
  if (/community|beneficiar/.test(g)) return 'Community Experience';
  if (/private.sector|executive|manager|business/.test(g)) return 'Executive Observation';
  if (/government|official|policy|ministry|public servant/.test(g)) return 'Policy Reflection';
  if (g) return 'Field Perspective';
  return 'Human Voice';
}

// ------------------------------------------------------------------
// Voice Portrait — VPX Release 1. An independent editorial review found
// the Human Voice pages entirely typographic, despite being the one part
// of the publication built around hearing from real people. This is a
// generic, non-identifying silhouette badge — never a photograph, never
// an invented age, gender or appearance — colored by the same real
// respondent-group category pickHumanVoiceLabel already derives, so the
// only "identity" signal it carries is the real category already on the
// model. Exactly the "portrait placeholder... without inventing
// identities" this release calls for.
// ------------------------------------------------------------------
const VOICE_PORTRAIT_COLOR_BY_LABEL = {
  'Frontline Reality': vrdsTokens.colors.teal700,
  'Community Experience': vrdsTokens.colors.gold500,
  'Executive Observation': vrdsTokens.colors.blue700,
  'Policy Reflection': vrdsTokens.colors.blue800,
  'Field Perspective': vrdsTokens.colors.slate500,
  'Human Voice': vrdsTokens.colors.slate500,
};

export function voicePortraitBadge(respondentGroup) {
  const label = pickHumanVoiceLabel(respondentGroup);
  const color = VOICE_PORTRAIT_COLOR_BY_LABEL[label] || vrdsTokens.colors.slate500;
  return `<svg class="voice-portrait" viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
    <circle cx="20" cy="20" r="20" fill="${color}"/>
    <circle cx="20" cy="16" r="7" fill="#fff" fill-opacity="0.92"/>
    <path d="M6 35c0-9.5 6.3-15 14-15s14 5.5 14 15" fill="#fff" fill-opacity="0.92"/>
  </svg>`;
}

export function evidenceSpotlightCard(evidenceItem, evidenceLabel) {
  if (!evidenceItem) return '';
  const stat = evidenceItem.statistic;
  const statLine = stat && stat.value != null
    ? `<p class="text-h3" style="color:var(--vpds-blue700);margin:0;">${escapeHtml(formatStatUnit(stat.value, stat.unit))}${stat.denominator ? `<span class="caption"> / ${escapeHtml(stat.denominator)}</span>` : ''}</p>`
    : '';
  return `<div class="evidence-panel evidence-spotlight">
    <div class="evidence-spotlight-head">${voicePortraitBadge(evidenceItem.respondent_group)}<div class="overline">${escapeHtml(pickHumanVoiceLabel(evidenceItem.respondent_group))}</div></div>
    ${statLine}
    <p class="pull-quote">${voiceThreadIcon()}${escapeHtml(evidenceItem.quote || '')}</p>
    <p class="caption">${escapeHtml(evidenceItem.respondent_group || 'Respondent')} &middot; ${escapeHtml(evidenceItem.region || '')}</p>
    <p class="citation">${escapeHtml(evidenceLabel)} &middot; ${escapeHtml(evidenceItem.id)} &middot; <span class="confidence-badge" style="background:${classifyVRDSConfidence(evidenceItem.confidence_score).color}">${classifyVRDSConfidence(evidenceItem.confidence_score).label}</span></p>
  </div>`;
}

// ------------------------------------------------------------------
// Field Voice — the lighter-weight quote treatment for spreads where a
// quote supports rather than headlines the message (regional/context
// spreads), avoiding the repeated full evidence-panel chrome everywhere.
// ------------------------------------------------------------------
export function fieldVoiceQuote(evidenceItem, evidenceLabel) {
  if (!evidenceItem) return '';
  return `<div class="field-voice-wrap">${voicePortraitBadge(evidenceItem.respondent_group)}<p class="pull-quote field-voice">${voiceThreadIcon()}${escapeHtml(evidenceItem.quote || '')}
    <span class="pull-quote-attribution">${escapeHtml(pickHumanVoiceLabel(evidenceItem.respondent_group))} &middot; ${escapeHtml(evidenceItem.respondent_group || 'Respondent')}, ${escapeHtml(evidenceItem.region || '')} &middot; ${escapeHtml(evidenceLabel)}</span></p></div>`;
}

// ------------------------------------------------------------------
// Decision Canvas — the enhanced decision-dossier card. Fixes a confirmed
// bug: the prior implementation read `r.dependency` (singular), a field
// that does not exist on the model; the real field is `r.dependencies`
// (an array) — every card has therefore always rendered the hardcoded
// fallback regardless of real dependency data. Returns {html, text} so the
// composer can keep aggregating richness/repeated-language text the same
// way it already does for every other spread.
//
// EAD Release 1: `condensedRationale` used to be a truncated, ellipsis-cut
// fragment of the SAME finding text already quoted in full on Key Messages
// and Root-Cause — an independent editorial review confirmed the identical
// clipped opening appeared three times across one document. The real fix
// isn't a better truncation, it's a genuinely distinct sentence: this now
// prefers `executiveCommentary` (report.executive_commentary[i], PX Release
// 10 — built specifically to answer "why leadership should care" WITHOUT
// repeating the finding or recommendation sentence, and never wired into
// this card until now). The evidence lineage line is kept, relabelled
// "Evidence basis" per the brief, as its own distinct line rather than
// bundled into the rationale. Falls back to the old extractive behavior
// only when no executiveCommentary is supplied, so this never breaks a
// caller that hasn't been updated to pass it.
// ------------------------------------------------------------------
// EAD Release 2, Page E (Decision Canvas A/B — executive-decision-memo
// layout family): reordered onto the brief's real 10-field executive-memo
// hierarchy (Decision / Why now / Expected outcome / Owner / Timeline /
// Budget / Dependencies / Risk / Monitoring commitment / Evidence basis).
// Two real, structural changes from the prior "form-shaped card": (1)
// Expected outcome is promoted out of the flat field list into its own
// prose line, at the same visual weight as "Why now" — the two together
// now read as the memo's actual argument (why + what changes), not a
// field among fields; (2) Evidence basis moves to the LAST position,
// matching the requested order exactly, instead of interrupting the
// rationale immediately after "Why now."
export function decisionCanvasCard(r, columnSpan, executiveCommentary = null) {
  const rationale = executiveCommentary || truncateWords(robustTakeaway(r.why_this_recommendation_exists, 1), 9);
  const evidenceRefs = (r.evidence_used || []).join(', ') || 'see Evidence Annex';
  const dependencyText = (r.dependencies && r.dependencies.length) ? r.dependencies.join('; ') : 'No blocking dependency identified';
  const fields = [
    ['Owner', r.owner || 'Not assigned'],
    ['Timeline', r.timeline || 'Not set'],
    ['Budget', r.budget_requirement || r.budget_band || 'Requires costing'],
    ['Dependencies', dependencyText],
    ['Risk', r.expected_risk || 'Not stated'],
    ['Monitoring commitment', r.monitoring_indicator || 'Not defined'],
  ];
  const html = `
    <div class="col-${columnSpan}">
      <div class="decision-card decision-canvas">
        <div class="overline">${escapeHtml(r.priority || r.strategic_priority || 'Priority')}</div>
        <p class="text-bodyLarge" style="margin:0;">${escapeHtml(r.recommendation)}</p>
        <p class="text-bodySmall"><b>Why now:</b> ${escapeHtml(rationale)}</p>
        ${r.expected_benefit ? `<p class="text-bodySmall"><b>Expected outcome:</b> ${escapeHtml(r.expected_benefit)}</p>` : ''}
        <dl class="decision-card-fields">
          ${fields.map(([label, value]) => `<div class="decision-field"><dt>${escapeHtml(label)}</dt><dd>${label === 'Risk' ? `<span class="role-warning">${escapeHtml(value)}</span>` : escapeHtml(value)}</dd></div>`).join('')}
        </dl>
        ${r.why_this_recommendation_exists ? `<p class="citation"><b>Evidence basis:</b> Evidence ${escapeHtml(evidenceRefs)} — see Evidence Annex.</p>` : ''}
      </div>
    </div>`;
  const text = `${r.recommendation || ''} ${rationale}`;
  return { html, text };
}

// ------------------------------------------------------------------
// Implementation Roadmap rail — the same three real timeline buckets
// (immediate/near-term/medium-term, already computed by the composer's
// parseTimelineBucket), presented as a connected rail rather than three
// bare columns, so the sequence itself is legible at a glance.
// ------------------------------------------------------------------
export function roadmapRail(buckets, bucketLabels) {
  return `<div class="roadmap-rail">
    ${Object.entries(buckets).map(([key, items]) => `
    <div class="roadmap-stage">
      <div class="roadmap-stage-marker"></div>
      <h4>${escapeHtml(bucketLabels[key])}</h4>
      ${items.map(r => `<p class="text-bodySmall">${escapeHtml(r.recommendation)} <span class="caption">(${escapeHtml(r.owner || 'Not assigned')})</span></p>`).join('') || '<p class="caption">No items in this window.</p>'}
    </div>`).join('')}
  </div>`;
}

// ------------------------------------------------------------------
// Strategic Outlook panel — the closing note's real strategic_outlook text
// (unabridged; this remains the one spread that renders it in full),
// framed as a distinct component rather than a bare paragraph.
// ------------------------------------------------------------------
export function strategicOutlookPanel(text) {
  return `<div class="strategic-outlook">
    <div class="overline">Strategic Outlook</div>
    <p class="text-bodyLarge">${escapeHtml(text || '')}</p>
  </div>`;
}

// ------------------------------------------------------------------
// Regional Comparison panel — the ranked regional cells plus the national
// reference line, extracted from the regional-equity spread so the
// comparison itself (not the equity narrative — see equityLensPanel) is
// its own visual unit.
// ------------------------------------------------------------------
export function regionalComparisonPanel(regional, nationalAvg) {
  return `<div class="regional-panel">
    ${(regional || []).map(r => `<div class="regional-cell" style="background:${riskColorFor(r.primary_score)}"><div class="text-caption">${escapeHtml(r.name)}</div><div class="text-h3">${escapeHtml(r.primary_score)}%</div><div class="text-caption">${escapeHtml(r.responses)} responses &middot; Risk ${escapeHtml(r.risk)}</div></div>`).join('')}
  </div>
  <p class="caption">National reference line: ${escapeHtml(nationalAvg)}%. Ranked panel — not a geographic map; no boundary data is available for this publication.</p>`;
}

// ------------------------------------------------------------------
// Equity Lens — the best-vs-worst regional gap, as its own callout rather
// than a plain paragraph, so the equity story reads as a distinct message
// from the raw regional comparison above it.
// ------------------------------------------------------------------
export function equityLensPanel(best, worst) {
  if (!best || !worst) return '<p class="text-bodySmall"><b>Equity lens:</b> Not available</p>';
  const gap = (best.primary_score || 0) - (worst.primary_score || 0);
  return `<div class="equity-lens">
    <div class="overline">Equity Lens</div>
    <p class="text-bodySmall">${escapeHtml(best.name)} (${escapeHtml(best.primary_score)}%) outperforms ${escapeHtml(worst.name)} (${escapeHtml(worst.primary_score)}%) by <b>${escapeHtml(gap)} points</b>.</p>
  </div>`;
}

// ------------------------------------------------------------------
// Risk Card — critical_risks[] on this model has only risk/likelihood/
// impact; there is no owner field and no mitigation field. This component
// deliberately omits an owner/mitigation row rather than rendering a
// fabricated value or a "Not specified" placeholder — an honest,
// intentional gap, not a defect to paper over.
// ------------------------------------------------------------------
export function riskCard(risk) {
  return `<div class="risk-card" style="border-left-color:${riskColorFor(100 - (risk.likelihood === 'High' ? 80 : risk.likelihood === 'Medium' ? 50 : 20))}">
    <p class="text-bodySmall" style="margin:0;"><b>${escapeHtml(risk.risk)}</b></p>
    <p class="caption">Likelihood: ${escapeHtml(risk.likelihood)} &middot; Impact: ${escapeHtml(risk.impact)}</p>
  </div>`;
}

// ------------------------------------------------------------------
// Investment Opportunity — surfaces executive_book.top_opportunities, a
// real governed field never rendered anywhere in the V2 composer before
// PX Release 3. Budget framing stays qualitative (budget_requirement/
// budget_band) — never a fabricated dollar figure or percentage.
// ------------------------------------------------------------------
export function investmentOpportunityCard(opportunityText, relatedRecommendation) {
  if (!opportunityText) return '';
  return `<div class="investment-card">
    <div class="overline">Investment Opportunity</div>
    <p class="text-bodySmall" style="margin:0;">${escapeHtml(opportunityText)}</p>
    ${relatedRecommendation?.budget_requirement || relatedRecommendation?.budget_band
      ? `<p class="caption">Budget band: ${escapeHtml(relatedRecommendation.budget_requirement || relatedRecommendation.budget_band)}</p>` : ''}
  </div>`;
}

// ------------------------------------------------------------------
// Priority Actions — the top decisions, tagged with priority, as a
// distinct scannable list component (used by the executive brief and the
// priority-matrix legend, replacing two separately hand-rolled versions).
// ------------------------------------------------------------------
export function priorityActionsList(recommendations, withIndex = false) {
  return (recommendations || []).map((r, i) => `<p class="text-bodySmall">${withIndex ? `${i + 1}. ` : '&middot; '}${escapeHtml(r.recommendation)}</p>`).join('') || '<p class="text-bodySmall">Not set</p>';
}

// ------------------------------------------------------------------
// Cost of Inaction panel — its own visual identity (distinct border/kicker
// color) so it reads as a deliberate warning, not another generic text box.
// ------------------------------------------------------------------
export function costOfInactionPanel(text) {
  return `<div class="cost-of-inaction-panel">
    <div class="overline">Cost of Inaction</div>
    <p class="text-bodySmall">${escapeHtml(text || 'Requires formal costing.')}</p>
  </div>`;
}

// ------------------------------------------------------------------
// Hero KPI panel — the executive brief's hero statistics, framed as a
// scorecard row rather than bare inline spans. Each stat is `{ value, label }`
// — three bare numbers with no caption told a reader nothing about what any
// of them measured (PX Release 6 PQR, high finding #18); `label` is the
// real finding's own related_indicator, not an invented metric name.
// ------------------------------------------------------------------
export function heroKpiPanel(stats) {
  if (!stats.length) return '';
  return `<div class="hero-kpi-panel">
    ${stats.map(s => `<div class="hero-kpi"><span class="text-statDisplay">${escapeHtml(s.value)}</span>${s.label ? `<div class="caption">${escapeHtml(s.label)}</div>` : ''}</div>`).join('')}
  </div>`;
}

// ------------------------------------------------------------------
// PX Release 11 (Publication Experience), Part 4: Information Design —
// a small family of callout/insight components that surface intelligence
// PX Releases 8-10 already computed onto the model (executive_commentary,
// so_what, evidence_commentary, strategic_interpretation_regional,
// publication_prestige) but never rendered anywhere. These four components
// add no new claim — every value passed in is read directly off the
// already-tested report fields at the call site; a missing field renders
// nothing rather than a fabricated placeholder.
// ------------------------------------------------------------------

// Executive Callout — one short, high-priority insight framed as a
// standalone card, distinct in shape and accent from the Policy Alert
// (reserved for a CRITICAL recommendation) and Cost of Inaction (reserved
// for the scenarios panel) so a reader never confuses the three.
export function executiveCalloutCard(label, text) {
  if (!text) return '';
  return `<div class="executive-callout">
    <div class="overline">${escapeHtml(label)}</div>
    <p class="text-bodySmall" style="margin:0;">${escapeHtml(text)}</p>
  </div>`;
}

// Insight Panel — a labelled box holding 2-4 short label:text pairs. Used
// wherever a page has more than one real, already-computed dimension worth
// surfacing at once (evidence commentary, strategic interpretation, "so
// what" framing) rather than one bare callout per dimension.
export function insightPanel(title, items) {
  const rows = (items || []).filter(i => i && i.text);
  if (!rows.length) return '';
  return `<div class="insight-panel">
    <div class="overline">${escapeHtml(title)}</div>
    ${rows.map(i => `<p class="text-bodySmall insight-panel-row"><b>${escapeHtml(i.label)}:</b> ${escapeHtml(i.text)}</p>`).join('')}
  </div>`;
}

// Confidence Thermometer — a discrete-band gauge, visually distinct from
// the continuous confidenceMeter() fill bar above: five fixed bands
// (Insufficient/Low/Moderate/Strong/Excellent, the same classifyVRDSConfidence
// thresholds already governing every other confidence readout in this
// codebase) with the real score's band highlighted, so a reader sees WHICH
// band a finding falls in at a glance rather than reading a percentage.
const CONFIDENCE_BANDS = ['insufficient', 'low', 'moderate', 'strong', 'excellent'];
export function confidenceThermometer(score, label = 'Confidence') {
  const band = classifyVRDSConfidence(score);
  return `<div class="confidence-thermometer">
    <span class="confidence-thermometer-label caption">${escapeHtml(label)}</span>
    <div class="confidence-thermometer-track">
      ${CONFIDENCE_BANDS.map(b => `<span class="confidence-thermometer-segment${b === band.level ? ' confidence-thermometer-segment--active' : ''}" style="${b === band.level ? `background:${band.color}` : ''}"></span>`).join('')}
    </div>
    <span class="confidence-thermometer-value caption">${escapeHtml(band.label)}</span>
  </div>`;
}

// Publication Prestige panel — the 8 named-reviewer verdicts PX Release 10
// already computes (report.publication_prestige) but never renders. Every
// verdict already carries `satisfied` and a `rationale` naming the real
// underlying signal (editorial_consensus, donor_intelligence, etc.) — this
// component only lays that out, it does not decide anything new.
export function prestigePanel(prestige) {
  if (!prestige || !prestige.verdicts?.length) return '';
  return `<div class="prestige-panel">
    <div class="overline">Publication Prestige Review</div>
    <div class="prestige-grid">
      ${prestige.verdicts.map(v => `<div class="prestige-item${v.satisfied ? ' prestige-item--pass' : ''}">
        <span class="prestige-item-mark">${v.satisfied ? '✓' : '—'}</span>
        <span class="prestige-item-body"><b class="text-bodySmall">${escapeHtml(v.reviewer)}</b><span class="caption">${escapeHtml(v.rationale)}</span></span>
      </div>`).join('')}
    </div>
    <p class="caption">${prestige.overallReady ? 'Every reviewer verdict above is satisfied by this publication’s own real signals.' : `${prestige.weaknesses.length} of ${prestige.verdicts.length} reviewer verdicts are not yet satisfied by this publication’s own real signals — see the unmarked rows above.`}</p>
  </div>`;
}

// Trust badge strip — Enterprise Market Validation Release, Part A. Reuses
// the prestige-panel's exact grid/item CSS (same pass/fail visual language,
// no new stylesheet needed) to replace the raw "Overall readiness: XX/100"
// line this spread used to print. Detailed numeric scores stay internal
// (site/admin/quality-control.html); this renders only the pass/fail badge.
export function trustBadgeStrip(badges) {
  if (!badges?.length) return '';
  const passedCount = badges.filter(b => b.satisfied).length;
  return `<div class="prestige-panel">
    <div class="overline">Publication Trust Verification</div>
    <div class="prestige-grid">
      ${badges.map(b => `<div class="prestige-item${b.satisfied ? ' prestige-item--pass' : ''}">
        <span class="prestige-item-mark">${b.satisfied ? '✓' : '—'}</span>
        <span class="prestige-item-body"><b class="text-bodySmall">${escapeHtml(b.label)}</b></span>
      </div>`).join('')}
    </div>
    <p class="caption">${passedCount} of ${badges.length} verification checks passed. Detailed scoring is available internally on request.</p>
  </div>`;
}

// ------------------------------------------------------------------
// PX Release 12 (World-Class Flagship Publication Experience), Part 3
// ("no two consecutive pages should feel alike") — Chapter Identity.
// flagship-narrative-arc.js already classifies every spine spread into one
// of 12 real argument stages (Context, Problem, Evidence, Interpretation,
// Consequences, Strategic Options, Priority Decisions, Implementation,
// Risk, Monitoring, Future Outlook & Closing Reflection) — a real,
// already-computed value, never rendered. This marker surfaces it so a
// reader can immediately tell they have entered a new chapter, without
// touching the 20-spread physical order or inventing a stage that isn't
// real. The accent color is a deterministic lookup over the SAME governed
// color palette (vrdsTokens.colors) every other component in this file
// already draws from — no new hex value is introduced anywhere.
// ------------------------------------------------------------------
const CHAPTER_ACCENT_BY_STAGE = Object.freeze({
  'Context': vrdsTokens.colors.teal700,
  'Problem': vrdsTokens.colors.orange600,
  'Evidence': vrdsTokens.colors.blue700,
  'Interpretation': vrdsTokens.colors.gold500,
  'Consequences': vrdsTokens.colors.amber500,
  'Strategic Options': vrdsTokens.colors.teal600,
  'Priority Decisions': vrdsTokens.colors.blue800,
  'Implementation': vrdsTokens.colors.green600,
  'Risk': vrdsTokens.colors.red600,
  'Monitoring': vrdsTokens.colors.slate700,
  'Future Outlook & Closing Reflection': vrdsTokens.colors.blue900,
});

export function chapterMarker(stage, index, total) {
  if (!stage) return '';
  const accent = CHAPTER_ACCENT_BY_STAGE[stage] || vrdsTokens.colors.blue700;
  const positionLabel = (index != null && total != null) ? `${String(index).padStart(2, '0')}/${String(total).padStart(2, '0')}` : null;
  return `<div class="chapter-marker" style="border-color:${accent}">
    ${positionLabel ? `<span class="chapter-marker-index" style="color:${accent}">${escapeHtml(positionLabel)}</span>` : ''}
    <span class="chapter-marker-stage">${escapeHtml(stage)}</span>
  </div>`;
}

// ------------------------------------------------------------------
// PX Release 12, Premium Infographics: Priority Ladder — the real top-5
// recommendations ranked by priority tier, cutting across the Roadmap
// page's existing timeline-bucket grouping (which shows WHEN each
// decision is due, not WHERE it ranks against the others). Rank is the
// array's own real order (already priority-sorted upstream in
// composePublicationSpreads). Tier color is a direct, correct mapping onto
// vrdsTokens.riskColors — riskColorFor() itself is unsuitable here (it
// classifies a PERFORMANCE score, where LOW means critical risk; feeding it
// an inverted priority score collapsed CRITICAL/HIGH/MEDIUM to the same red
// during this component's own build, caught by rendering a real sample
// before shipping it — never repeat that inversion trick here).
// ------------------------------------------------------------------
const PRIORITY_LADDER_COLOR_BY_TIER = Object.freeze({
  CRITICAL: vrdsTokens.riskColors.critical, HIGH: vrdsTokens.riskColors.high,
  MEDIUM: vrdsTokens.riskColors.medium, LOW: vrdsTokens.riskColors.low,
});
export function priorityLadder(recommendations) {
  const items = (recommendations || []).filter(r => r.recommendation);
  if (!items.length) return '';
  return `<div class="priority-ladder">
    ${items.map((r, i) => {
      const tier = String(r.priority || r.strategic_priority || '').toUpperCase();
      const color = PRIORITY_LADDER_COLOR_BY_TIER[tier] || vrdsTokens.colors.slate500;
      return `<div class="priority-ladder-rung">
        <span class="priority-ladder-rank" style="background:${color}">${i + 1}</span>
        <span class="priority-ladder-text"><b class="text-bodySmall">${escapeHtml(truncateWords(r.recommendation, 10))}</b><span class="caption">${escapeHtml(tier || 'Priority not set')}${r.timeline ? ` &middot; ${escapeHtml(r.timeline)}` : ''}</span></span>
      </div>`;
    }).join('')}
  </div>`;
}

// ------------------------------------------------------------------
// EAD Release 1: SDG Alignment Strip. report.full_publication.sdg_cards
// (flagship-publication-intelligence.js's buildSdgCards) has carried real
// decision-grade fields — target, indicator_code, baseline/current/
// target_value/gap, trend, status, confidence, disaggregation,
// interpretation, evidence_ids, decision_id — since PX Release 6, but no
// spread has ever rendered it; three independent editorial reviews (PX13,
// VPX1, and the full review) each flagged this as computed-but-invisible
// intelligence. Status color reuses the existing riskColors scale (ON
// TRACK -> low/green, ACCELERATION REQUIRED -> medium/amber, OFF TRACK ->
// critical/red) rather than inventing a fourth palette.
// ------------------------------------------------------------------
const SDG_STATUS_COLOR = Object.freeze({
  'ON TRACK': vrdsTokens.riskColors.low,
  'ACCELERATION REQUIRED': vrdsTokens.riskColors.medium,
  'OFF TRACK': vrdsTokens.riskColors.critical,
});
export function sdgAlignmentStrip(cards) {
  const items = (cards || []).filter(c => c && c.goal && c.indicator);
  if (!items.length) return '';
  return `<div class="sdg-strip">
    ${items.map(c => `<div class="sdg-card" style="border-top-color:${c.colour || vrdsTokens.colors.slate500}">
      <div class="sdg-card-head">
        <span class="sdg-card-goal" style="background:${c.colour || vrdsTokens.colors.slate500}">SDG ${escapeHtml(c.goal)}</span>
        <span class="sdg-card-title text-bodySmall">${escapeHtml(c.title || '')}</span>
      </div>
      <div class="caption">${escapeHtml(c.indicator || '')}${c.indicator_code ? ` (${escapeHtml(c.indicator_code)})` : ''}</div>
      <div class="sdg-card-metric text-bodySmall"><b>${escapeHtml(c.current)}%</b> of ${escapeHtml(c.target_value)}% target &middot; ${escapeHtml(c.gap)}-pt gap</div>
      ${c.status ? `<span class="sdg-card-status" style="background:${SDG_STATUS_COLOR[c.status] || vrdsTokens.colors.slate500}">${escapeHtml(c.status)}</span>` : ''}
    </div>`).join('')}
  </div>`;
}
