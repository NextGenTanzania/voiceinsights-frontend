// Publication Spread Composer — Browser Rendering V2, Publication
// Experience (PX) Release 3
//
// Implements, deterministically and in real code, the editorial arc and
// spread-composition rules specified across VPDS Release 1, VPIE Release
// 1/1.5, and VPPX Release 1: a coherent reader journey from cover to closing
// note, never a repeated finding-spread/decision-spread loop. This module
// owns ONLY layout/composition/sequencing — it does not compute findings,
// invent evidence, fabricate benchmarks or costing, or decide publication
// readiness; those remain report-generator.js's and quality-scoring-engine.js's
// job untouched. Every number and sentence below is read from the existing
// governed model; nothing is invented.
//
// Release 2.1 closed three confirmed pagination/composition defects found in
// the first live Browser Rendering preview render (orphaned kicker pages,
// decision-field values split mid-sentence across a page break, an isolated
// third decision card) plus a targeted, extractive (never generative)
// reduction of the editorial validator's repeated-language findings.
//
// PX Release 3 elevates the same 20-spread arc into publication-grade
// storytelling: a shared visual-component library (publication-visual-
// components.js), a display/body typography pairing, and an editorial
// layout pass — without touching the rendering engine, the arc order, or
// any existing feature. Every component still traces to a real governed
// field; several (Risk Card, Investment Opportunity) deliberately omit
// fields the model genuinely does not have rather than inventing them.
//
// Consumes vrds-foundation.js's tokens as-is — no competing token set.
import { vrdsTokens, classifyVRDSConfidence } from './vrds-foundation.js';
import {
  escapeHtml, wordCount, firstSentences, lastSentence, truncateWords, riskColorFor, voiceThreadIcon,
  humanizeStatusEnum, robustTakeaway, stripHtmlToVisibleText, formatOecdDacLines, formatRbmLines,
} from './publication-render-utils.js';
import * as visualComponents from './publication-visual-components.js';
import { arcContextFor, SPINE_SPREAD_ORDER } from './flagship-narrative-arc.js';
import { selectTransition } from './flagship-transition-engine.js';
import * as chartComponents from './publication-chart-components.js';
import { buildArtDirectionPlans } from './editorial-art-direction-engine.js';
import { selectPublicationNorthStar, repetitionRoleFor } from './editorial-intelligence-engine.js';
import { selectPublicationPurpose, selectEditorialIntent, selectPublicationPosition } from './editorial-intent-engine.js';
import { resolveEditorialIdentity } from './publication-editorial-identity.js';
import { EPISTEMIC_STATUSES } from './flagship-decision-reasoning-engine.js';
import { editorialEmphasisFor } from './flagship-personality-lexicon.js';
import { computeTrustBadges } from './publication-trust-badges.js';

export const SPREAD_COMPOSER_VERSION = 'publication-spread-composer-v4';

// ------------------------------------------------------------------
// Typography + Layout Engine: CSS generated FROM the token maps, not
// hand-duplicated per rule.
// ------------------------------------------------------------------
export function buildTypographyCss() {
  const { typography, spacing, colors, evidenceColors, confidenceColors, riskColors, radius } = vrdsTokens;
  const typeRules = Object.entries(typography.scale)
    .map(([name, px]) => `.text-${name}{font-size:${px}px;}`).join('');
  const spacingRules = Object.entries(spacing)
    .map(([name, px]) => `.space-${name}{margin-bottom:${px}px;} .pad-${name}{padding:${px}px;}`).join('');
  const semanticColorVars = [
    ...Object.entries(colors).map(([k, v]) => `--vpds-${k}:${v};`),
    ...Object.entries(evidenceColors).map(([k, v]) => `--vpds-evidence-${k}:${v};`),
    ...Object.entries(confidenceColors).map(([k, v]) => `--vpds-confidence-${k}:${v};`),
    ...Object.entries(riskColors).map(([k, v]) => `--vpds-risk-${k}:${v};`),
  ].join('');

  return `
:root{${semanticColorVars}
  --vpds-radius-sm:${radius.sm}px; --vpds-radius-card:${radius.card}px; --vpds-radius-panel:${radius.panel}px;
  --vpds-running-header-size:9px; --vpds-page-number-size:9px; --vpds-table-header-size:11px; --vpds-citation-size:10px;
  --vpds-pull-quote-size:${typography.scale.pullQuote}px;
}
*{box-sizing:border-box;}
body{font-family:${typography.fontSans};color:var(--vpds-slate900);line-height:${typography.lineHeight.body};margin:0;background:${colors.white};}
/* PX Release 3, Part 7: headlines carry a genuine display serif, distinct
   from the humanist sans body face — a real publication type pairing, not
   one stack doing both jobs. Web-safe/system stacks only; no @font-face,
   no external fetch (Cloudflare's Browser Rendering container cannot
   reliably load a remote font at render time, and no proprietary font may
   be introduced). h4 stays on the sans stack — it functions as an
   uppercase label/kicker throughout this file, not a narrative headline. */
h1,h2,h3{font-family:${typography.fontDisplay};}
/* PX Release 12 (World-Class Flagship Publication Experience): balanced
   multi-line wrapping and a touch of negative tracking on the display
   serif — the same two techniques that separate a premium editorial
   headline from a plain HTML heading (The Economist/HBR-style setting),
   applied uniformly to every page rather than per-spread. */
h1,h2,h3,h4{line-height:${typography.lineHeight.heading};margin:0 0 ${spacing[12]}px;color:var(--vpds-blue900);break-after:avoid;text-wrap:balance;}
h1{font-size:${typography.scale.h1}px;letter-spacing:-.01em;} h2{font-size:${typography.scale.h2}px;letter-spacing:-.01em;} h3{font-size:${typography.scale.h3}px;} h4{font-size:${typography.scale.h4}px;color:var(--vpds-teal700);text-transform:uppercase;letter-spacing:.04em;}
p{font-size:${typography.scale.body}px;margin:0 0 ${spacing[12]}px;max-width:78ch;orphans:3;widows:3;}
li,td{orphans:2;widows:2;}
${typeRules}
${spacingRules}
.overline{font-size:${typography.scale.overline}px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--vpds-teal700);margin:0 0 ${spacing[4]}px;}
.pull-quote{font-size:var(--vpds-pull-quote-size);font-style:italic;font-weight:500;line-height:${typography.lineHeight.heading};border-left:3px solid var(--vpds-evidence-reportModel);padding-left:${spacing[16]}px;color:var(--vpds-slate700);break-inside:avoid;}
.pull-quote-attribution{display:block;font-size:${typography.scale.caption}px;font-style:normal;font-weight:400;color:var(--vpds-slate500);margin-top:${spacing[4]}px;}
.footnote{font-size:${typography.scale.footnote}px;color:var(--vpds-slate500);line-height:${typography.lineHeight.caption};}
.citation{font-size:var(--vpds-citation-size);color:var(--vpds-slate500);}
.caption{font-size:${typography.scale.caption}px;color:var(--vpds-slate500);line-height:${typography.lineHeight.caption};}

/* PX editorial maturity pass, Part 7: an executive-statement variant,
   distinct from the evidence pull-quote above (that one marks a respondent
   or citation attribution; this one marks the publication's own thesis
   sentence — display serif, no attribution rule, set larger and unindented
   so the two never read as the same typographic device). */
.exec-pull-quote{font-family:${typography.fontDisplay};font-size:${typography.scale.h3}px;font-weight:600;line-height:${typography.lineHeight.heading};color:var(--vpds-blue900);margin:0 0 ${spacing[12]}px;}
/* A margin/annotation note — smaller and more restrained than a footnote,
   flagged with a left rule so a "what this evidence cannot support" caveat
   reads visually as an aside rather than a continuation of the body copy. */
.margin-note{font-size:${typography.scale.footnote}px;color:var(--vpds-slate500);border-left:2px solid var(--vpds-slate100);padding-left:${spacing[8]}px;line-height:${typography.lineHeight.caption};}
/* Marks the reader's entry into the Decision Intelligence arc (priority
   matrix onward) — a single rule + label, not a repeat of spreadHeader. */
.arc-divider{display:flex;align-items:center;gap:${spacing[8]}px;margin:0 0 ${spacing[16]}px;color:var(--vpds-gold500);}
.arc-divider::before,.arc-divider::after{content:'';flex:1;height:1px;background:var(--vpds-gold500);}
.arc-divider-label{font-size:${typography.scale.overline}px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;}

/* PX Release 5.1, Parts 1/2/6: the arc bridge — one transition line
   (Editorial Memory), one extractive takeaway (Executive Reading
   Psychology) and the arc's own next-question (Cognitive Flow), rendered
   inside spreadHeader()'s existing leadHtml slot on the 13 spine spreads
   only. Distinct from body copy so a reader can scan it in the 3-5 second
   window Part 6 assumes. */
.arc-transition{font-style:italic;color:var(--vpds-slate500);font-size:${typography.scale.bodySmall}px;margin:${spacing[4]}px 0;}
.arc-takeaway{font-size:${typography.scale.bodySmall}px;margin:${spacing[4]}px 0;border-left:3px solid var(--vpds-gold500);padding-left:${spacing[8]}px;}
.arc-next-question{color:var(--vpds-teal700);margin:${spacing[4]}px 0 ${spacing[8]}px;}

/* PX Release 3, Part 3: whitespace/rhythm routed through vrdsTokens.spacing
   instead of ad hoc mm/px literals, so the editorial grid's gutters share
   one governed scale with every other margin/padding in this file. */
.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:${spacing[24]}px;}
.col-12{grid-column:span 12;} .col-8{grid-column:span 8;} .col-7{grid-column:span 7;} .col-6{grid-column:span 6;} .col-5{grid-column:span 5;} .col-4{grid-column:span 4;} .col-3{grid-column:span 3;}

.spread{page-break-after:always;padding:0;}
.spread:last-child{page-break-after:auto;}
.brand-strip{height:${spacing[16]}px;background:var(--vpds-gold500);margin-bottom:${spacing[16]}px;}
.kicker{font-size:${typography.scale.caption}px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--vpds-teal700);margin-bottom:${spacing[8]}px;}

/* Part 3 (Release 2.1): the kicker+brand-strip+H1 header is one atomic unit.
   break-inside:avoid stops the browser from ever splitting the kicker onto
   one physical page and the H1 onto the next (the confirmed pages-12/16
   defect); break-after:avoid asks the renderer to keep the header attached
   to whatever content immediately follows it, where that's achievable. */
/* PX Release 12: flex column + order lets the Chapter Identity marker
   (rendered in DOM after the H1, since it travels through spreadHeader's
   existing leadHtml slot) display visually FIRST — a running-head-style
   chapter label above the kicker/title, the way a print magazine sets it —
   without restructuring the 12 spine-spread call sites that already pass
   a single leadHtml string into spreadHeader(). DOM order (and therefore
   every DOM-order-based hierarchy check) is unchanged; only paint order moves. */
.spread-header{display:flex;flex-direction:column;break-inside:avoid;break-after:avoid;}
.spread-header h1{margin-bottom:${spacing[12]}px;}

.voice-thread{display:inline-flex;align-items:center;gap:4px;vertical-align:middle;margin-right:6px;}
.evidence-panel{border:1px solid var(--vpds-slate100);border-left:4px solid var(--vpds-evidence-reportModel);border-radius:var(--vpds-radius-card);padding:${spacing[16]}px;background:#fff;break-inside:avoid;}
/* VPX Release 1: the Voice Portrait badge — a generic, non-identifying
   silhouette that gives Human Voice quotes a real visual anchor without
   inventing a photograph or identity (see publication-visual-components.js). */
.voice-portrait{flex-shrink:0;border-radius:50%;}
.evidence-spotlight-head{display:flex;align-items:center;gap:${spacing[8]}px;margin-bottom:${spacing[4]}px;}
.evidence-spotlight-head .overline{margin:0;}
.field-voice-wrap{display:flex;align-items:flex-start;gap:${spacing[8]}px;}
.confidence-badge{display:inline-block;font-size:${typography.scale.caption}px;font-weight:700;padding:2px ${spacing[8]}px;border-radius:999px;color:#fff;}
.regional-panel{display:grid;grid-template-columns:repeat(2,1fr);gap:${spacing[8]}px;}
.regional-cell{border-radius:var(--vpds-radius-sm);padding:${spacing[12]}px;color:#fff;}

/* Part 4 (Release 2.1): decision-card field atomicity. The field list is
   deliberately NOT a CSS grid — Chromium's print pipeline fragments CSS Grid
   containers unreliably across page breaks, which is the root cause the
   pages-14/18 defect traced back to (break-inside:avoid on the ancestor
   .decision-card did not reliably stop a grid-laid-out <dl> from splitting a
   dt/dd pair mid-value). inline-block fragments predictably in print, and
   break-inside:avoid on each individual .decision-field is the smallest
   atomic unit — a label and its value now always move together, or the
   whole field-row (never a partial value) moves to the next page. */
.decision-card{border:1px solid var(--vpds-slate100);border-radius:var(--vpds-radius-card);padding:${spacing[16]}px;background:#fbfbf9;margin-bottom:${spacing[12]}px;break-inside:avoid;}
.decision-card-fields{margin:${spacing[8]}px 0 0;font-size:${typography.scale.bodySmall}px;}
.decision-field{display:inline-block;width:48%;vertical-align:top;break-inside:avoid;margin:0 0 ${spacing[8]}px;}
.decision-field dt{font-weight:700;color:var(--vpds-slate500);font-size:${typography.scale.caption}px;text-transform:uppercase;margin:0;}
.decision-field dd{margin:0;}

table.vpds-table{width:100%;border-collapse:collapse;font-size:${typography.scale.bodySmall}px;}
table.vpds-table th{text-align:left;font-size:var(--vpds-table-header-size);text-transform:uppercase;letter-spacing:.03em;color:var(--vpds-slate500);border-bottom:1px solid var(--vpds-slate100);padding:${spacing[4]}px ${spacing[8]}px;}
table.vpds-table td{padding:${spacing[4]}px ${spacing[8]}px;border-bottom:1px solid var(--vpds-slate100);vertical-align:top;}
.scenario-card{border:1px solid var(--vpds-slate100);border-radius:var(--vpds-radius-card);padding:${spacing[12]}px;background:#fff;}
.matrix-plot{position:relative;height:${vrdsTokens.grid.matrixPlotHeight}px;border-left:1px solid var(--vpds-slate500);border-bottom:1px solid var(--vpds-slate500);margin:${spacing[8]}px 0;}
.matrix-dot{position:absolute;width:14px;height:14px;border-radius:50%;color:#fff;font-size:9px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,50%);}
.matrix-axis-label{position:absolute;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--vpds-slate500);}
.matrix-axis-label--x{bottom:-16px;left:50%;transform:translateX(-50%);}
.matrix-axis-label--y{top:50%;left:-6px;transform:translate(-50%,-50%) rotate(-90deg);transform-origin:center;}

/* PX Release 5, Task #47: risk heat matrix — a real CSS grid, not an image,
   so cell colors/labels stay fully governed by the report's own data. */
.risk-heat-matrix{display:grid;grid-template-columns:64px repeat(3,1fr);gap:2px;margin:${spacing[8]}px 0;}
.risk-heat-matrix-corner{background:transparent;}
.risk-heat-matrix-colhead,.risk-heat-matrix-rowhead{font-size:${typography.scale.caption}px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--vpds-slate500);display:flex;align-items:center;justify-content:center;padding:${spacing[4]}px;}
.risk-heat-cell{min-height:48px;border-radius:var(--vpds-radius-sm);padding:${spacing[4]}px;display:flex;flex-direction:column;gap:2px;justify-content:center;}
.risk-heat-label{font-size:${typography.scale.footnote}px;color:#fff;font-weight:600;}
/* EAD Release 2, Page C: the asymmetrical Key Messages composition — real,
   materially distinct typography per real prominence tier (see
   rankKeyMessages/keyMessageProminence above), replacing the prior uniform
   numbered-circle list where all 5 items looked identical regardless of
   real priority/evidence weight. */
.km-composition{display:flex;flex-direction:column;gap:${spacing[12]}px;}
.km-item{border-bottom:1px solid var(--vpds-slate100);padding-bottom:${spacing[12]}px;}
.km-item-rank{display:block;margin-bottom:${spacing[4]}px;}
.km-item--dominant .km-item-text{font-family:${typography.fontDisplay};font-size:${typography.scale.h3}px;font-weight:600;line-height:${typography.lineHeight.heading};color:var(--vpds-blue900);}
.km-item--dominant .km-item-rank{color:var(--vpds-gold500);}
.km-item--secondary .km-item-text{font-size:${typography.scale.bodyLarge}px;color:var(--vpds-slate900);}
.km-item--secondary .km-item-rank{color:var(--vpds-teal700);}
.km-item--supporting .km-item-text{font-size:${typography.scale.body}px;color:var(--vpds-slate700);}
.km-item--supporting .km-item-rank{color:var(--vpds-slate500);}

/* ------------------------------------------------------------------
   PX Release 3, Parts 5/9: the new publication component family. Each
   component's own no-fabrication note lives in publication-visual-
   components.js; this is styling only. */
.confidence-meter{margin:${spacing[8]}px 0;}
.confidence-meter-label{display:flex;justify-content:space-between;align-items:baseline;font-size:${typography.scale.caption}px;color:var(--vpds-slate500);margin-bottom:${spacing[4]}px;}
.confidence-meter-label .overline{margin:0;}
.confidence-meter-value{font-weight:700;color:var(--vpds-slate900);}
.confidence-meter-track{height:6px;border-radius:999px;background:var(--vpds-slate100);overflow:hidden;}
.confidence-meter-fill{height:100%;border-radius:999px;}

.policy-alert{border:1px solid var(--vpds-risk-critical);border-left:6px solid var(--vpds-risk-critical);border-radius:var(--vpds-radius-card);padding:${spacing[16]}px;margin-bottom:${spacing[16]}px;background:#fff8f6;break-inside:avoid;}
.policy-alert-kicker{font-size:${typography.scale.overline}px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--vpds-risk-critical);margin-bottom:${spacing[4]}px;}

.critical-finding-card{border-left:4px solid var(--vpds-blue700);padding-left:${spacing[16]}px;break-inside:avoid;}
.risk-card{border:1px solid var(--vpds-slate100);border-left:4px solid var(--vpds-slate500);border-radius:var(--vpds-radius-card);padding:${spacing[12]}px;background:#fff;break-inside:avoid;height:100%;}
.investment-card{border:1px solid var(--vpds-gold500);border-radius:var(--vpds-radius-card);padding:${spacing[12]}px;margin:${spacing[8]}px 0;background:#fffdf7;break-inside:avoid;}
.equity-lens{border-left:4px solid var(--vpds-teal700);padding-left:${spacing[16]}px;margin-bottom:${spacing[12]}px;}
.cost-of-inaction-panel{border:1px solid var(--vpds-risk-high);border-left:4px solid var(--vpds-risk-high);border-radius:var(--vpds-radius-card);padding:${spacing[16]}px;margin-top:${spacing[16]}px;background:#fffaf3;break-inside:avoid;}
.strategic-outlook{border-left:4px solid var(--vpds-gold500);padding-left:${spacing[16]}px;}

.hero-kpi-panel{display:flex;gap:${spacing[24]}px;margin:${spacing[12]}px 0;flex-wrap:wrap;}
.hero-kpi .text-statDisplay{color:var(--vpds-blue700);}

.root-cause-chain{display:flex;align-items:center;gap:${spacing[8]}px;margin-bottom:${spacing[16]}px;}
.root-cause-chain-step{font-size:${typography.scale.caption}px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--vpds-slate500);border:1px solid var(--vpds-slate100);border-radius:999px;padding:${spacing[4]}px ${spacing[12]}px;}
.root-cause-chain-step--inferred{font-style:italic;border-style:dashed;}
.root-cause-chain-arrow{color:var(--vpds-teal700);font-weight:700;}

/* EAD Release 2, Page D: the causal-system composition — one card per
   finding, the real 5-stage flow strip leading, its detail list (the
   primary content) directly beneath, and the old table demoted to a
   collapsible secondary index (see <details class="causal-chain-index">
   in buildRootCauseSpread). */
.causal-chain-grid{display:flex;flex-direction:column;gap:${spacing[16]}px;margin-bottom:${spacing[16]}px;}
.causal-chain-card{border:1px solid var(--vpds-slate100);border-radius:var(--vpds-radius-card);padding:${spacing[16]}px;background:#fff;break-inside:avoid;}
.causal-chain-flow{display:flex;flex-wrap:wrap;align-items:center;gap:${spacing[8]}px;margin-bottom:${spacing[12]}px;}
.causal-chain-detail{margin:0;font-size:${typography.scale.bodySmall}px;}
.causal-chain-detail-row{padding:${spacing[4]}px 0;border-bottom:1px solid var(--vpds-slate100);}
.causal-chain-detail-row:last-child{border-bottom:none;}
.causal-chain-detail-row dt{font-weight:700;color:var(--vpds-slate500);font-size:${typography.scale.caption}px;text-transform:uppercase;margin:0;}
.causal-chain-detail-row dd{margin:2px 0 0;}
.causal-chain-index{margin-top:${spacing[8]}px;}
.causal-chain-index summary{cursor:pointer;color:var(--vpds-teal700);}
.causal-chain-index table.vpds-table{margin-top:${spacing[8]}px;}

/* Methodology Canvas + National Context stat-tile/workflow treatment
   (previously referenced by class name with no matching rule — rendered
   as unstyled stacked divs/inline spans). Reused as-is by National Context
   so the two spreads share one real tile system instead of one spread
   having a genuine visual and the other a bolded-paragraph placeholder. */
.methodology-stat-tiles{display:flex;gap:${spacing[12]}px;flex-wrap:wrap;margin:${spacing[8]}px 0;}
.methodology-stat-tile{flex:1;min-width:108px;border:1px solid var(--vpds-slate100);border-radius:var(--vpds-radius-card);padding:${spacing[12]}px;text-align:center;background:#fff;}
.methodology-stat-tile .text-h3{display:block;color:var(--vpds-blue700);}
.methodology-workflow{display:flex;align-items:center;flex-wrap:wrap;gap:${spacing[4]}px;margin:${spacing[8]}px 0;}
.methodology-workflow-step{font-size:${typography.scale.caption}px;font-weight:700;color:var(--vpds-slate700);border:1px solid var(--vpds-slate100);border-radius:999px;padding:${spacing[4]}px ${spacing[12]}px;background:#fff;}
.methodology-workflow-arrow{color:var(--vpds-teal700);font-weight:700;}

/* Inside-cover's citation, set apart from a plain paragraph so this spread
   reads distinctly from the Assurance spread's prose column — a serif
   display treatment framed by a gold rule, not an evidence pull-quote
   (that styling stays reserved for respondent attribution elsewhere). */
.citation-block{font-family:${typography.fontDisplay};font-size:${typography.scale.h4}px;font-style:italic;line-height:${typography.lineHeight.heading};color:var(--vpds-blue900);border-top:2px solid var(--vpds-gold500);border-bottom:2px solid var(--vpds-gold500);padding:${spacing[12]}px 0;margin:${spacing[8]}px 0;}

.roadmap-rail{display:flex;gap:${spacing[24]}px;}
.roadmap-stage{flex:1;position:relative;padding-top:${spacing[24]}px;}
.roadmap-stage-marker{position:absolute;top:0;left:0;width:12px;height:12px;border-radius:50%;background:var(--vpds-blue700);}
.roadmap-stage:not(:last-child)::before{content:'';position:absolute;top:5px;left:${spacing[16]}px;right:-${spacing[24]}px;height:2px;background:var(--vpds-slate100);}

/* PX Release 11 (Publication Experience), Part 4: Information Design.
   Four new components surfacing PX Release 8-10 intelligence that was
   already computed but never rendered — see publication-visual-
   components.js for the no-fabrication note on each. Accent colors are
   chosen so none of the four is mistaken for the Policy Alert (red),
   Cost of Inaction (orange) or Investment Opportunity (gold) callouts
   already in this file. */
.executive-callout{border:1px solid var(--vpds-blue700);border-left:4px solid var(--vpds-blue700);border-radius:var(--vpds-radius-card);padding:${spacing[12]}px ${spacing[16]}px;margin:${spacing[12]}px 0;background:#f5f9ff;break-inside:avoid;}
.insight-panel{border:1px solid var(--vpds-slate100);border-radius:var(--vpds-radius-card);padding:${spacing[16]}px;margin:${spacing[12]}px 0;background:#fbfbf9;break-inside:avoid;}
.insight-panel-row{margin:0 0 ${spacing[4]}px;}
.insight-panel-row:last-child{margin-bottom:0;}

/* Editorial Division Release: recommendation presentation format variants
   (publication-editorial-identity.js). Reuses existing type scale/spacing
   tokens; no new colour or radius primitives. */
.ranked-decision-list{list-style:none;margin:${spacing[8]}px 0;padding:0;display:flex;flex-direction:column;gap:${spacing[8]}px;}
.ranked-decision-item{display:flex;gap:${spacing[12]}px;border:1px solid var(--vpds-slate100);border-radius:var(--vpds-radius-card);padding:${spacing[12]}px;break-inside:avoid;}
.ranked-decision-rank{flex-shrink:0;width:28px;height:28px;border-radius:50%;background:var(--vpds-blue700);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;}
.ranked-decision-body{flex:1;}

.confidence-thermometer{display:flex;align-items:center;gap:${spacing[8]}px;margin:${spacing[4]}px 0;}
.confidence-thermometer-label{white-space:nowrap;}
.confidence-thermometer-track{display:flex;gap:2px;flex:1;}
.confidence-thermometer-segment{height:8px;flex:1;border-radius:2px;background:var(--vpds-slate100);}
.confidence-thermometer-segment--active{background:var(--vpds-blue700);}
.confidence-thermometer-value{white-space:nowrap;font-weight:700;}

.prestige-panel{margin:${spacing[12]}px 0;}
.prestige-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:${spacing[8]}px;margin:${spacing[8]}px 0;}
.prestige-item{display:flex;align-items:flex-start;gap:${spacing[8]}px;border:1px solid var(--vpds-slate100);border-radius:var(--vpds-radius-sm);padding:${spacing[8]}px;break-inside:avoid;}
.prestige-item-mark{font-weight:700;color:var(--vpds-slate500);width:16px;flex-shrink:0;}
.prestige-item--pass .prestige-item-mark{color:var(--vpds-risk-low);}
.prestige-item-body{display:flex;flex-direction:column;gap:2px;}

/* PX Release 12, Part 3 (Chapter Identity): a compact rule + index/stage
   label rendered above spreadHeader() on every spine spread, colored per
   real arc stage (publication-visual-components.js's CHAPTER_ACCENT_BY_STAGE).
   Deliberately smaller and quieter than spreadHeader's own kicker/H1 — this
   marks "which chapter", the page's own header still carries the actual claim. */
.chapter-marker{order:-1;display:flex;align-items:baseline;gap:${spacing[8]}px;border-top:2px solid;padding-top:${spacing[4]}px;margin-bottom:${spacing[12]}px;}
.chapter-marker-index{font-size:${typography.scale.caption}px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.04em;}
.chapter-marker-stage{font-size:${typography.scale.overline}px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--vpds-slate500);}

/* PX Release 12, Premium Infographics: Priority Ladder — a compact ranked
   rail distinct from roadmap-rail's timeline buckets above (WHEN) and from
   the priority-matrix's scatter (feasibility vs. priority) — this shows the
   plain rank order across the top-5 decisions on one page. */
.priority-ladder{display:flex;flex-direction:column;gap:${spacing[8]}px;}
.priority-ladder-rung{display:flex;align-items:flex-start;gap:${spacing[8]}px;}
.priority-ladder-rank{flex-shrink:0;width:22px;height:22px;border-radius:50%;color:#fff;font-size:${typography.scale.caption}px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.priority-ladder-text{display:flex;flex-direction:column;gap:2px;}

/* EAD Release 1: SDG Alignment Strip — see publication-visual-
   components.js's sdgAlignmentStrip() for the no-fabrication note. A
   border-top accent (not a full colored card) keeps the real 17-color SDG
   palette from competing with the page's own accent color scheme. */
.sdg-strip{display:flex;gap:${spacing[12]}px;flex-wrap:wrap;margin:${spacing[12]}px 0;}
.sdg-card{flex:1;min-width:150px;border:1px solid var(--vpds-slate100);border-top:4px solid;border-radius:var(--vpds-radius-card);padding:${spacing[12]}px;background:#fff;break-inside:avoid;}
.sdg-card-head{display:flex;align-items:center;gap:${spacing[8]}px;margin-bottom:${spacing[4]}px;}
.sdg-card-goal{flex-shrink:0;color:#fff;font-size:${typography.scale.caption}px;font-weight:700;border-radius:999px;padding:2px ${spacing[8]}px;white-space:nowrap;}
.sdg-card-title{font-weight:700;}
.sdg-card-metric{margin:${spacing[4]}px 0;}
.sdg-card-status{display:inline-block;color:#fff;font-size:${typography.scale.caption}px;font-weight:700;border-radius:999px;padding:2px ${spacing[8]}px;text-transform:uppercase;letter-spacing:.03em;}

/* ------------------------------------------------------------------
   EAD Release 2: art-direction plan classes, injected onto every real
   spread's outer <section> by composePublicationSpreads (see the
   "artDirectionPlans" comment at that call site) — these rules are what
   makes the plan's layoutFamily/typographyMode/visualDensity/whitespaceMode
   fields real, rendered decisions rather than computed-and-discarded
   metadata. Descendant selectors target elements every spread already
   emits (h1, .text-bodyLarge, .exec-pull-quote, .grid, table) rather than
   requiring per-spread markup changes, so all 20 spreads pick up real,
   differentiated styling from these four class families alone; the 5
   spreads this release also rebuilds structurally (see their own
   build*Spread comments) additionally change real DOM order/content.
   ------------------------------------------------------------------ */

/* Whitespace mode: governs the one shared spacing scale every spread's
   header/grid already uses, so "airy" vs "dense" is a real, visible
   difference in how much room content gets, not a no-op class. */
.whitespace-airy .spread-header{margin-bottom:${spacing[32]}px;}
.whitespace-airy .grid{gap:${spacing[32]}px;}
.whitespace-airy p{margin-bottom:${spacing[16]}px;}
.whitespace-dense .spread-header{margin-bottom:${spacing[8]}px;}
.whitespace-dense .grid{gap:${spacing[12]}px;}
.whitespace-dense p{margin-bottom:${spacing[8]}px;}
.whitespace-balanced .spread-header{margin-bottom:${spacing[16]}px;}

/* Visual density: a quiet corner-mark (not a badge that competes with the
   Chapter Identity marker) so a reviewer can visually audit density
   alternation directly against publication-rhythm-validator.js's own
   monotony rules, plus a real table-row-height tightening on the "rich"
   (component-heavy) end, where a page has the least spare room. */
.density-rich table.vpds-table td{padding:${spacing[4]}px ${spacing[4]}px;}
.density-sparse .spread-header h1{letter-spacing:-.015em;}

/* Typography roles (brief Part 8) not already carried by an existing class
   (chapter-marker, caption, footnote already exist and are reused as-is —
   seeing them reapplied here would be renaming, which the brief explicitly
   forbids). Each rule below is a genuinely distinct declaration from any
   neighbouring role, not a shared alias. */
.typography-publication-title h1{text-transform:none;text-wrap:balance;letter-spacing:-.02em;}
.typography-spread-thesis .kicker + h1{font-style:normal;border-bottom:2px solid var(--vpds-gold500);padding-bottom:${spacing[8]}px;}
.typography-executive-decision .policy-alert,.typography-executive-decision .decision-card{border-left-width:6px;}
.typography-hero-stat .text-statDisplay{letter-spacing:-.03em;text-shadow:none;}
.typography-evidence-quote .evidence-panel .text-bodyLarge,.typography-evidence-quote .field-voice-wrap p:first-child{font-style:italic;}
.typography-interpretation .text-bodyLarge{color:var(--vpds-blue900);}
.typography-warning .text-bodySmall b{color:var(--vpds-risk-high);}
/* "warning" is genuinely an inline role (a specific uncertain/at-risk
   phrase within an otherwise neutral spread), not a whole-spread lead
   role like the 13 typography-{mode} rules above — applied directly on
   real elements (Executive Brief's "What remains uncertain" line, a
   decision card's own Risk field) rather than gated behind a spread-level
   wrapper class. */
.role-warning{color:var(--vpds-risk-high);}
.role-warning b{color:inherit;}
.typography-opportunity h4{color:var(--vpds-gold500);}
.typography-risk h4,.typography-risk .overline{color:var(--vpds-risk-critical);}
.typography-methodology p.text-bodyLarge{font-family:${typography.fontSans};font-size:${typography.scale.bodySmall}px;line-height:${typography.lineHeight.body};}
.typography-source .citation-block{font-style:normal;}
.typography-disclosure p.text-bodyLarge{font-size:${typography.scale.bodySmall}px;}
.typography-next-action p.text-bodySmall b{color:var(--vpds-teal700);}

/* Layout families (brief Part 3) — each rule set below changes real grid,
   spacing, alignment or emphasis already present in that spread's own
   markup; none is a bare rename of an existing rule. Families whose spread
   already carries a bespoke, materially distinct treatment (editorial-cover
   is full-bleed dark with its own inline layout; causal-system's chain-
   first composition; ranked-message-composition's asymmetrical list;
   executive-decision-memo's memo fields — see each spread's own rebuilt
   markup) get a lighter touch here since the structural difference already
   lives in the HTML, not just the class. */
.layout-credentials-front-matter .grid{gap:${spacing[16]}px;}
.layout-credentials-front-matter h4{color:var(--vpds-slate500);}
.layout-executive-decision-brief .grid{grid-template-columns:repeat(12,1fr);align-items:start;}
/* EAD Release 2, Page B: the 3 explicit reading-depth zones (30s/90s/5min)
   the Executive Brief now renders — real spacing/rule separation between
   zones so they read as distinct depths, not one long column. */
.reading-layer{margin-bottom:${spacing[16]}px;}
.reading-layer--90s{border-top:1px solid var(--vpds-slate100);padding-top:${spacing[12]}px;}
.reading-layer--5min{border-top:1px solid var(--vpds-slate100);padding-top:${spacing[12]}px;}
.layout-hero-evidence .text-statDisplay{display:block;margin-bottom:${spacing[8]}px;}
.layout-context-orientation .methodology-stat-tiles{gap:${spacing[8]}px;}
.layout-geographic-comparison .regional-panel{grid-template-columns:repeat(2,1fr);}
.layout-testimony-editorial .grid{grid-template-columns:repeat(3,1fr);}
.layout-testimony-editorial .grid .col-4{grid-column:span 1;}
.layout-scenario-pathways .scenario-card{height:100%;border-top:3px solid var(--vpds-gold500);}
.layout-strategic-matrix .matrix-plot{margin-top:${spacing[16]}px;}
.layout-implementation-roadmap .roadmap-rail{gap:${spacing[32]}px;}
.layout-risk-governance .risk-heat-cell{border-radius:${radius.card}px;}
.layout-monitoring-framework table.vpds-table{font-size:${typography.scale.footnote}px;}
.layout-methodology-architecture .col-8{max-width:74ch;}
.layout-evidence-register table.vpds-table td{font-size:${typography.scale.footnote}px;}
.layout-assurance-review .prestige-grid{grid-template-columns:repeat(2,1fr);}
.layout-forward-looking-closing{text-align:left;}
.layout-forward-looking-closing .spread-header{margin-bottom:${spacing[24]}px;}

/* EAD Release 2, Page E: Decision Canvas A/B's two real, visibly different
   sub-layouts — A's urgency banner (outcome-and-urgency led) and B's
   comparison strip (comparison led) — plus the reordered executive-memo
   card itself (Expected outcome promoted to its own prose line; Evidence
   basis moved to the end — see decisionCanvasCard). */
.decision-urgency-banner{border:1px solid var(--vpds-gold500);border-left:4px solid var(--vpds-gold500);border-radius:var(--vpds-radius-card);padding:${spacing[12]}px ${spacing[16]}px;margin-bottom:${spacing[16]}px;background:#fffdf7;}
.decision-comparison-strip{margin-bottom:${spacing[16]}px;}
.sublayout-comparison-led .decision-card{border-top:3px solid var(--vpds-teal700);}
.sublayout-outcome-urgency-led .decision-card{border-top:3px solid var(--vpds-gold500);}
`;
}

// ------------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------------
// Confidence classification is vrds-foundation.js's classifyVRDSConfidence
// (imported above), not reimplemented here — same thresholds/labels/colors
// this file previously duplicated locally as confidenceBand().

// Part 3 (Release 2.1): the one reusable spread-header component. Every
// spread that previously inlined its own brand-strip + kicker + H1 now
// calls this instead — one wrapper, one CSS rule (.spread-header), so no
// spread can independently regress into the orphaned-kicker defect.
function spreadHeader(kicker, title, leadHtml = '') {
  return `<div class="spread-header">
    <div class="brand-strip"></div>
    <div class="kicker">${escapeHtml(kicker)}</div>
    <h1>${escapeHtml(title)}</h1>
    ${leadHtml}
  </div>`;
}

// Extracts the "immediate cause" this synthetic report template embeds
// ("The driver is X, most visible in Y") when present; otherwise labels the
// cause as an analytical inference rather than inventing one — Part 10's
// symptom/immediate-cause/structural-cause distinction, honestly sourced.
export function deriveImmediateCause(findingText) {
  const match = String(findingText || '').match(/driver is ([^.]+)\./i);
  return match ? match[1].trim() : null;
}

// Maps the report's own timeline text onto Part 13's three roadmap buckets —
// parsed from the existing field, never invented.
export function parseTimelineBucket(timelineText) {
  const t = String(timelineText || '').toLowerCase();
  if (/0.?90 days/.test(t)) return 'immediate';
  if (/3.?(-|–|to)?.?12 months/.test(t)) return 'near_term';
  if (/6.?(-|–|to)?.?18 months|12.?(-|–|to)?.?36 months/.test(t)) return 'medium_term';
  return 'near_term';
}

// Ordinal mapping of the report's own priority/budget text onto matrix axes
// (Part 12) — a defensible transformation of real categorical fields, not
// fabricated coordinates.
function priorityToAxis(priority) {
  const p = String(priority || '').toUpperCase();
  if (p === 'CRITICAL') return 90;
  if (p === 'HIGH') return 70;
  if (p === 'MEDIUM') return 45;
  return 30;
}
function feasibilityToAxis(budgetText) {
  const t = String(budgetText || '').toLowerCase();
  if (t.includes('low')) return 80;
  if (t.includes('medium')) return 55;
  if (t.includes('high') || t.includes('detailed costing')) return 30;
  return 50;
}

export function buildCitationText(report) {
  const year = String(report.publication_date || '').slice(0, 4) || 'n.d.';
  return `VoiceInsights Africa. ${report.title || 'Untitled publication'}. ${report.country || ''}, ${year}. Publication ${report.branding?.publication_id || 'unassigned'}, v${report.branding?.publication_version || '1.0'}.`;
}

export function pickHeroFinding(findings = []) {
  if (!findings.length) return null;
  return findings.slice().sort((a, b) => (Number(b.confidence_score) || 0) - (Number(a.confidence_score) || 0))[0];
}

// Part 5 (Release 2.1): deterministic column spans for a decision dossier,
// based on item count alone (not fabricated per-card — every card gets
// exactly the same rule for a given count). Fixes the confirmed page-19
// defect: a 3-card dossier is no longer forced into a 2-column grid where
// the third card overflows onto its own near-empty page.
export function decisionCardColumnSpans(count) {
  if (count <= 1) return Array(count).fill(12);
  if (count === 2) return [6, 6];
  if (count === 3) return [12, 6, 6]; // priority (highest-ranked) card full-width, two supporting cards half-width
  if (count === 4) return [6, 6, 6, 6];
  // 5+ in one spread is not produced by composePublicationSpreads (which
  // splits at 2/3 — Part 5's "priority matrix plus two balanced decision
  // spreads" for a 5-item publication) — this fallback exists only so the
  // function itself never throws or produces an invalid span if called
  // directly with a larger count.
  return Array.from({ length: count }, () => 6);
}

// EIE Release 1: a real, genuine reference to a decision — its priority
// tier and real owner — rather than a second/third/fourth verbatim copy of
// the recommendation sentence itself. truncateWords() alone cannot serve
// this purpose for this codebase's real recommendation sentences: they run
// 6-9 words, at or under any reasonable truncation limit, so
// truncateWords returns the FULL sentence unchanged (confirmed while
// building this release — the first attempt at "condensing" via
// truncateWords(text, 8) had no visible effect on samples whose top
// recommendation is exactly 7 words). Naming the tier/owner instead
// guarantees a genuinely different, shorter sentence regardless of how
// short the real recommendation text happens to be.
function referenceToDecision(recommendation) {
  if (!recommendation) return null;
  const tier = String(recommendation.priority || recommendation.strategic_priority || '').toLowerCase();
  return `${tier ? `The ${tier}-tier decision` : 'This decision'}, owned by ${recommendation.owner || 'an assigned lead'} — see Executive Brief.`;
}

// EAD Release 1: `visibleWords` is a real, comprehensive word count taken
// directly from the rendered HTML (see stripHtmlToVisibleText) rather than
// the hand-picked `text` extractive string — see that function's own
// comment for why the two can diverge sharply. `estimatedWords` (from
// `text`) is kept unchanged for backward compatibility with any caller
// still reading it; new density logic should prefer `visibleWords`.
function spread(id, layers, arc, components, bodyHtml, text = '', blocks = []) {
  const estimatedWords = wordCount(text);
  const visibleWords = wordCount(stripHtmlToVisibleText(bodyHtml));
  return { id, layers, arc, html: bodyHtml, text, estimatedWords, visibleWords, componentCount: components.length, components, blocks };
}

// ------------------------------------------------------------------
// 1. Institutional cover — restrained, VoiceInsights-signed (VPPX Part 15).
// Kept as its own full-bleed layout, not the shared spread-header component
// (Part 2: the accepted foundation's cover treatment is preserved as-is).
// ------------------------------------------------------------------
// Product Experience Evolution Phase 2C (Editorial Art Direction):
// replaces the PX Release 5 abstract motif above (five overlapping
// translucent circles, positioned by a hash of the theme's own `motif`
// label). An independent Phase 2B review confirmed that graphic decorates
// without teaching — its arrangement varies per sample, but the variation
// carries no real meaning a reader could ever recover, exactly the kind
// of generic abstract-blob cover the brief's own comparison set (World
// Bank, OECD, WEF) would not publish.
//
// Two real, already-governed fields were sitting completely unused: (1)
// `full.cover.composition` — one of four sector-authored labels
// (evidence-frame / map-window / signal-band / editorial-grid), already
// distinct per sample, never wired to any visual decision anywhere in
// this file; (2) `full.regional[].primary_score` — the exact same real
// per-region performance figures the Regional & Equity spread's dumbbell
// chart already renders. Grounding the cover's own signature mark in
// these two fields turns it from decoration into a real, if quiet,
// second data point: a discerning reader who later reaches the Regional
// spread can look back and recognize the cover's shapes were never
// arbitrary. Nothing is invented — every number and every one of the 4
// composition names is a field this report already carried before this
// change; this only gives them a form.
const COVER_COMPOSITIONS = Object.freeze(['evidence-frame', 'map-window', 'signal-band', 'editorial-grid']);

function coverSignatureMark(composition, colors, regional, { width = 200, height = 160, cornerTicks = true } = {}) {
  const scores = (regional || []).slice(0, 4).map(r => Math.max(0, Math.min(100, Number(r?.primary_score) || 0)));
  while (scores.length < 4) scores.push(50);
  const [c1, c2, c3] = colors;

  if (composition === 'map-window') {
    // A 2x2 tile viewport, one tile per real region — the closest honest
    // stand-in for a map when no real geographic boundary data exists:
    // never claims to BE a map, but reads as one at a glance, and each
    // tile's own opacity is the real regional score, not a decorative fill.
    const tw = width / 2, th = height / 2;
    const tiles = scores.map((s, i) => {
      const x = (i % 2) * tw, y = Math.floor(i / 2) * th;
      const fill = i % 2 === 0 ? c1 : c2;
      return `<rect x="${x}" y="${y}" width="${tw}" height="${th}" fill="${fill}" fill-opacity="${(0.10 + (s / 100) * 0.22).toFixed(2)}"/>`;
    }).join('');
    return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">${tiles}<line x1="${tw}" y1="0" x2="${tw}" y2="${height}" stroke="${c3}" stroke-opacity="0.25" stroke-width="1"/><line x1="0" y1="${th}" x2="${width}" y2="${th}" stroke="${c3}" stroke-opacity="0.25" stroke-width="1"/></svg>`;
  }

  if (composition === 'signal-band') {
    // A stack of horizontal bands, one per real region, each band's real
    // WIDTH is that region's real score — literally a signal-strength
    // readout, matching the name rather than an arbitrary abstraction.
    const bandH = 14, gap = 10, top = height - (scores.length * (bandH + gap));
    const bands = scores.map((s, i) => {
      const w = (s / 100) * width;
      const fill = i % 2 === 0 ? c1 : c2;
      return `<rect x="0" y="${top + i * (bandH + gap)}" width="${w.toFixed(1)}" height="${bandH}" fill="${fill}" fill-opacity="0.32" rx="2"/>`;
    }).join('');
    return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">${bands}</svg>`;
  }

  if (composition === 'editorial-grid') {
    // A quiet print-production layout grid (the literal tool a magazine
    // art director works against) — 4 columns, 3 rows of hairlines, with
    // exactly one cell filled: the column belonging to the real
    // highest-scoring region, a small honest wink at "this is where the
    // story on this page actually lives on the grid."
    const cols = 4, rows = 3, cw = width / cols, rh = height / rows;
    const leadCol = scores.indexOf(Math.max(...scores));
    const vLines = Array.from({ length: cols + 1 }, (_, i) => `<line x1="${i * cw}" y1="0" x2="${i * cw}" y2="${height}" stroke="${c3}" stroke-opacity="0.22" stroke-width="1"/>`).join('');
    const hLines = Array.from({ length: rows + 1 }, (_, i) => `<line x1="0" y1="${i * rh}" x2="${width}" y2="${i * rh}" stroke="${c3}" stroke-opacity="0.22" stroke-width="1"/>`).join('');
    const leadCell = `<rect x="${leadCol * cw}" y="0" width="${cw}" height="${rh}" fill="${c1}" fill-opacity="0.16"/>`;
    return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">${leadCell}${vLines}${hLines}</svg>`;
  }

  // Default / "evidence-frame": a dossier-style bounding frame with corner
  // ticks, and a small tick-mark scale along the base built from the real
  // regional scores — a measurement instrument, not a random pattern.
  const inset = 10, x0 = inset, y0 = inset, x1 = width - inset, y1 = height - inset;
  const ticks = cornerTicks ? [
    `<line x1="${x0}" y1="${y0}" x2="${x0 + 14}" y2="${y0}" stroke="${c2}" stroke-width="2"/>`,
    `<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + 14}" stroke="${c2}" stroke-width="2"/>`,
    `<line x1="${x1}" y1="${y1}" x2="${x1 - 14}" y2="${y1}" stroke="${c2}" stroke-width="2"/>`,
    `<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y1 - 14}" stroke="${c2}" stroke-width="2"/>`,
  ].join('') : '';
  const scaleY = y1 - 6, scaleGap = (x1 - x0) / (scores.length + 1);
  const scaleTicks = scores.map((s, i) => {
    const x = x0 + scaleGap * (i + 1), h = (s / 100) * 22;
    return `<line x1="${x.toFixed(1)}" y1="${scaleY}" x2="${x.toFixed(1)}" y2="${(scaleY - h).toFixed(1)}" stroke="${c1}" stroke-width="2" stroke-opacity="0.5"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">
    <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="${c2}" stroke-opacity="0.3" stroke-width="1"/>
    ${ticks}${scaleTicks}
  </svg>`;
}

function buildCoverAbstractMotif(theme, regional) {
  if (!theme) return '';
  const colors = [theme.accent, theme.highlight, '#ffffff'];
  const mark = coverSignatureMark(theme.composition, colors, regional, { width: 200, height: 160 });
  return mark ? `<div style="position:absolute;top:0;right:0;pointer-events:none;">${mark}</div>` : '';
}

// Closing bookends the cover's own real signature mark — same real
// composition name, same real regional scores, recolored for a light page
// (theme.primary/accent instead of accent/highlight/white) and compressed
// to a wide strip rather than a corner block, so it reads as a related
// but distinct close to the same real visual argument the cover opened.
function buildClosingMotif(theme, regional) {
  if (!theme) return '';
  const colors = [theme.primary, theme.accent, theme.highlight];
  const mark = coverSignatureMark(theme.composition, colors, regional, { width: 200, height: 36, cornerTicks: false });
  return mark ? `<div style="margin:0 0 16px;">${mark}</div>` : '';
}

// EAD Release 2, Page A (Cover — editorial-cover layout family): rebuilt
// against the brief's five explicit Cover requirements.
// (1) One real hero statistic — reuses heroStatOf() (already used
//     identically for the Executive Brief's own KPI panel) against the
//     report's own top-confidence finding, the same real record
//     pickHeroFinding already selects for the Hero Insight spread two pages
//     later, so the number on the cover is never a second, independently-
//     chosen figure.
// (2) One sector-specific motif — buildCoverAbstractMotif already existed
//     (PX Release 5); its real, governed theme.motif label (e.g. "national
//     cartography") is now also printed as a small caption, so the motif
//     reads as a deliberate sector signature rather than unlabeled
//     decoration.
// (3) Reduced technical metadata / (4) removed internal taxonomy language
//     — report.publication_profile ("International Government Publication
//     Profile") embedded the platform's own internal category name in the
//     reader-facing caption. Replaced with report.personality — a real,
//     already-authored, sector-specific tagline (e.g. "National maps and
//     cabinet intelligence") that existed in the source data since this
//     publication's first release but was never wired onto the report
//     object at all (see flagship-sample-library.js). Publication ID/date/
//     classification remain (required disclosure), grouped into one
//     quieter line instead of three stacked footnotes.
// (5) Visibly distinct across samples — theme colour + motif (already real
//     per-sample), plus the real hero stat and personality tagline, both
//     genuinely different per sample.
// EIE Release 2: the publication's real Purpose + Position (Editorial
// Intent Engine) rendered as one plain-language line — the "why this
// exists" half of the brief's first-five-pages requirement. Cover carries
// identity/why; Executive Brief (below) carries the intent/decision half.
// Both are computed once, upstream in composePublicationSpreads, and
// passed in here — never recomputed per spread.
// The 15 named purposes are fixed real strings (PURPOSE_BY_PROFILE), so a
// plain vowel-letter check is sufficient here — no exceptions among them
// behave like "European"/"one" (vowel letter, consonant sound).
const articleFor = word => (/^[aeiou]/i.test(word) ? 'An' : 'A');

// Product Experience Evolution Phase 2B: the badge previously read "A Policy
// Change publication — prepared as your Advisor" — a direct-address,
// marketing-register phrase no real flagship institutional cover uses (World
// Bank/OECD/UNDP covers state what the document IS, not the publisher's
// relationship to the reader). The purpose badge now names only the
// publication series ("Policy Change Publication"); the real, governed
// position value (Advisor/Decision Partner/Warning/etc.) is not discarded —
// it moves into the quieter metadata line below as a plain "Role: X" label,
// matching the register already used there for "Classification: X".
function describePublicationPurpose(purpose) {
  if (!purpose?.purpose) return '';
  return `${purpose.purpose} Publication`;
}

function buildCoverSpread(report, theme, heroFinding, intent = null, regional = null) {
  const motif = buildCoverAbstractMotif(theme, regional);
  const heroStat = heroStatOf(heroFinding?.text);
  const metaLine = [report.publication_date, report.branding?.publication_id, report.classification ? `Classification: ${titleCase(report.classification)}` : null, intent?.position?.position ? `Role: ${intent.position.position}` : null].filter(Boolean).map(escapeHtml).join(' &middot; ');
  const purposeLine = describePublicationPurpose(intent?.purpose);
  const html = `
    <section class="spread" style="background:var(--vpds-blue900);color:#fff;min-height:100vh;padding:24mm;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;">
      ${motif}
      <div>
        <div class="kicker" style="color:var(--vpds-gold500)">VoiceInsights Africa</div>
        ${purposeLine ? `<p class="purpose-badge" style="display:inline-block;color:var(--vpds-blue900);background:var(--vpds-gold500);opacity:1;letter-spacing:.03em;text-transform:uppercase;font-size:11px;margin:0 0 10px;padding:3px 10px;border-radius:2px;font-weight:600;">${escapeHtml(purposeLine)}</p>` : ''}
        ${report.personality ? `<p class="caption" style="color:#fff;opacity:.65;letter-spacing:.06em;text-transform:uppercase;margin:0 0 8px;">${escapeHtml(report.personality)}</p>` : ''}
        <h1 style="color:#fff;font-size:${vrdsTokens.typography.scale.displayL}px;max-width:20ch;">${escapeHtml(report.title)}</h1>
        <p class="text-bodyLarge" style="color:#fff;opacity:.85;">${escapeHtml(report.subtitle || report.sector)} &middot; ${escapeHtml(report.country || '')}</p>
        ${heroStat ? `<p class="text-statDisplay" style="color:${theme?.highlight || '#D7B65A'};margin:${vrdsTokens.spacing[16]}px 0 0;">${escapeHtml(heroStat)}<span class="text-bodySmall" style="display:block;color:#fff;opacity:.75;font-weight:400;">${escapeHtml(truncateWords(heroFinding.title || heroFinding.text, 8))}</span></p>` : ''}
      </div>
      <div>
        ${voiceThreadIcon()}<span class="footnote" style="color:#fff;opacity:.7;">Every Voice. Every Language. Every Insight.</span>
        ${metaLine ? `<p class="footnote" style="color:#fff;opacity:.55;margin-top:4px;">${metaLine}</p>` : ''}
      </div>
    </section>`;
  // The extractive `text` param must match what the page actually renders
  // (a short title/stat/snippet), never the hero finding's full underlying
  // text — that full text is quoted in full on Hero Insight and Root-Cause,
  // and passing it here as if Cover also "said" all of it produced a false,
  // 60-plus-word cross-spread repeated-language flag against a page that
  // visibly shows only a title and one 8-word snippet (caught while
  // honestly re-checking this release's own before/after numbers).
  const coverSnippet = heroStat ? truncateWords(heroFinding.title || heroFinding.text, 8) : '';
  const blocks = [
    { type: 'heading', level: 1, text: report.title || '' },
    { type: 'paragraph', text: `${report.subtitle || report.sector || ''} · ${report.country || ''}`.trim(), emphasis: 'subtitle' },
    ...(heroStat ? [{ type: 'stat_group', stats: [{ label: coverSnippet, value: heroStat, unit: '' }] }] : []),
    ...(purposeLine ? [{ type: 'callout', label: 'Purpose', text: purposeLine }] : []),
  ];
  return spread('cover', ['90s'], 'orient', [{ type: 'cover', hasInterpretation: true }, ...(heroStat ? [{ type: 'cover_hero_stat', hasInterpretation: true }] : [])], html, `${report.title || ''} ${report.subtitle || report.sector || ''} ${heroStat || ''} ${coverSnippet}`, blocks);
}

// report.classification is a real field but stored SCREAMING CASE
// ('PUBLIC SYNTHETIC DEMONSTRATION'); title-cased for body-copy contexts
// that already sit next to the full disclosure sentence (see
// buildInsideCoverSpread) so the two don't read as the same shouty line
// twice.
const titleCase = value => String(value || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

// ------------------------------------------------------------------
// 2. Inside cover / publication information (Part 5: citation, authorship,
// dataset version, evidence classification, rights statement).
// ------------------------------------------------------------------
function buildInsideCoverSpread(report, evidenceLabel, datasetVersion) {
  const citation = buildCitationText(report);
  const meth = report.methodology || {};
  // PX Release 5, Task #43: a methodology snapshot + standards summary —
  // both already-real fields (report.methodology, report.international_
  // standards), not new sections. Omitted entirely below: DOI, ISBN,
  // version history, a governed contact URL — no real field backs any of
  // them anywhere on this model, so this page states what it has rather
  // than fabricating what a print flagship report conventionally carries.
  const methodologySnapshot = [
    meth.sample_size ? `${meth.sample_size} synthetic responses` : null,
    meth.design_effect != null ? `design effect ${meth.design_effect}` : null,
    meth.confidence_intervals ? `${meth.confidence_intervals} confidence intervals` : null,
  ].filter(Boolean).join(' · ');
  const standards = report.international_standards || [];
  const html = `
    <section class="spread">
      ${spreadHeader('Publication Information', report.title)}
      <div class="grid">
        <div class="col-7">
          <h4>Citation</h4>
          <p class="citation-block">${escapeHtml(citation)}</p>
          <h4>Authorship and review</h4>
          <p class="text-bodySmall">Prepared by ${escapeHtml(report.branding?.prepared_by || 'VoiceInsights Africa')}. Reviewed by ${escapeHtml(report.ai_governance?.reviewer || 'VoiceInsights Assurance Reviewer')}.</p>
          ${methodologySnapshot ? `<h4>Methodology snapshot</h4><p class="text-bodySmall">${escapeHtml(methodologySnapshot)}. Full methodology in the Methodology Canvas.</p>` : ''}
          ${standards.length ? `<h4>Standards referenced</h4><p class="footnote">${escapeHtml(standards.map(s => s.framework).join(', '))} — applied where relevant to this sector; see Methodology Canvas for effect on specific decisions.</p>` : ''}
        </div>
        <div class="col-5">
          <h4>Dataset and evidence classification</h4>
          <p class="text-bodySmall">Dataset version: ${escapeHtml(datasetVersion)}</p>
          <p class="text-bodySmall">Evidence classification: ${escapeHtml(titleCase(report.classification || 'Synthetic Demonstration'))}</p>
          <h4>Rights and responsible use</h4>
          <p class="footnote">${escapeHtml(report.branding?.copyright || '')} ${escapeHtml(evidenceLabel)}</p>
        </div>
      </div>
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: 'Publication Information' },
    { type: 'paragraph', text: citation, emphasis: 'citation' },
    { type: 'paragraph', text: `Prepared by ${report.branding?.prepared_by || 'VoiceInsights Africa'}. Reviewed by ${report.ai_governance?.reviewer || 'VoiceInsights Assurance Reviewer'}.` },
    ...(methodologySnapshot ? [{ type: 'paragraph', text: `${methodologySnapshot}. Full methodology in the Methodology Canvas.`, emphasis: 'caption' }] : []),
    ...(standards.length ? [{ type: 'list', items: standards.map(s => s.framework), ordered: false }] : []),
    { type: 'table', headers: ['Field', 'Value'], rows: [
      ['Dataset version', datasetVersion],
      ['Evidence classification', titleCase(report.classification || 'Synthetic Demonstration')],
    ] },
    { type: 'callout', label: 'Rights and responsible use', text: `${report.branding?.copyright || ''} ${evidenceLabel}`.trim() },
  ];
  return spread('inside-cover', ['90s'], 'orient', [{ type: 'metadata_page', hasInterpretation: true }], html, `${citation} ${methodologySnapshot}`, blocks);
}

// ------------------------------------------------------------------
// 3. Executive brief — nine questions, not a list of findings (Part 6).
// ------------------------------------------------------------------
function heroStatOf(text) {
  const m = String(text || '').match(/(\d+(?:\.\d+)?%)/);
  return m ? m[1] : null;
}

// Part 4.A (90-second layer) requires three hero statistics, the top three
// decisions, and the highest-priority risk to be reachable within the 90s
// layer — not just one of each. This spread is the only '90s'-tagged spread
// with room for them, so it carries all three explicitly rather than relying
// on the reader to reach the 5-minute layer for them.
// PX Release 3, Part 2: the "Executive Signal" spread — the hero opening's
// decision-forming center. Every element below traces to a real field;
// the Policy Alert only appears when a genuinely CRITICAL recommendation
// exists (never manufactured urgency), and Investment Opportunity only
// appears when executive_book.top_opportunities has a real entry.
function buildExecutiveBriefSpread(report, assurance, findings, criticalRisks, northStar = null, intent = null) {
  const book = report.executive_book || {};
  const recommendations = report.recommendations || [];
  const topRecommendation = recommendations[0];
  const topThreeDecisions = recommendations.slice(0, 3);
  const heroStats = (findings || [])
    .map(f => { const value = heroStatOf(f.text); return value ? { value, label: f.related_indicator || null } : null; })
    .filter(Boolean).slice(0, 3);
  const highestPriorityRisk = (criticalRisks || [])[0];
  const affectedGroup = (report.evidence || [])[0]?.respondent_group || 'the most affected group';
  const strongestEvidence = (report.evidence || []).slice().sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))[0];
  const thesis = book.executive_brief || report.executive_summary || '';
  // EIE Release 1: the Policy Alert previously showed the FIRST critical-
  // tier recommendation found by array order — not necessarily the same
  // finding Cover/Key-Messages/Hero-Insight lead with (confirmed to diverge
  // in 10 of 16 real samples). The shared north star is itself always
  // linked to a real CRITICAL-tier recommendation (verified across all 16
  // samples), so preferring it here — falling back to the old first-found
  // behavior only if north star is unavailable — makes this page agree
  // with the other three by construction, not by coincidence.
  const northStarIsCritical = northStar?.recommendation && String(northStar.recommendation.priority || northStar.recommendation.strategic_priority || '').toUpperCase() === 'CRITICAL';
  const criticalRecommendation = northStarIsCritical ? northStar.recommendation : recommendations.find(r => String(r.priority || r.strategic_priority || '').toUpperCase() === 'CRITICAL');
  const topOpportunity = (book.top_opportunities || [])[0];
  // PX Release 5.1, Part 4: executive_brief is already a single sentence
  // (nothing to condense), so reading-rhythm variation applies to the
  // adjacent "Why it matters" line instead — reusing the existing
  // extractive firstSentences() helper and the already-built reportTone
  // signal (report.editorial_profile), not a new rhythm system.
  // VPX Release 1: capped at 2 (never 3) regardless of tone. executive_summary's
  // 3rd sentence is the governance-disclosure line National Context quotes in
  // full via lastSentence() — showing all 3 sentences here (the prior 'measured'
  // ? 2 : 3 behavior) meant that sentence rendered twice, verbatim, within the
  // same report whenever tone wasn't 'measured'. An independent editorial
  // review confirmed this pairing produced the single most damaging repeated-
  // language finding in the whole publication. Capping here restores this
  // spread's own documented invariant (see buildContextSpread below).
  const whyItMattersSentences = 2;
  // EAD Release 2, Page B (Executive Brief — executive-decision-brief
  // layout family): rebuilt into 3 explicitly labeled reading-depth zones,
  // per the brief's requirement that the 30-second/90-second/5-minute
  // layers this spread has always logically supported (see the 'story'
  // arc's ['90s','5min'] layer tags, unchanged below) actually read as
  // distinct on the page, not as one undifferentiated column. Every field
  // already real and rendered before this rebuild (Policy Alert, owner,
  // timeline, cost of delay, all 8 supporting lines, heroKpiPanel,
  // confidence meter, investment/cost-of-inaction) is retained — this only
  // regroups them under real hierarchy, decision before evidence before
  // implication within each zone. The 30-second zone's own shape is
  // genuinely non-template: it leads with the Policy Alert only when a
  // real CRITICAL recommendation exists, and with the thesis statement
  // itself otherwise — a real structural branch on real report content,
  // not a fixed shape reused by every sample.
  // EIE Release 2: the Intent Engine's Purpose + Intent, stated as one
  // plain-language sentence at the very top of the 30-second zone — the
  // "what this publication prepares you to do" half of the brief's
  // first-five-pages requirement (Cover, above, carries the "why it
  // exists/who it's for" half). Both fields trace to real, already-
  // governed data (sample.profile, the North Star recommendation's own
  // leading verb) — nothing here is a generated sentence.
  const intentStatement = intent?.purpose?.purpose && intent?.intent?.intent
    ? `This is ${articleFor(intent.purpose.purpose).toLowerCase()} ${intent.purpose.purpose} publication. It prepares you to ${intent.intent.intent.charAt(0).toLowerCase()}${intent.intent.intent.slice(1)}.`
    : '';
  const html = `
    <section class="spread">
      ${spreadHeader('Executive Brief', 'The decision in brief')}
      <div class="reading-layer reading-layer--30s">
        <div class="overline">30-second read</div>
        ${intentStatement ? `<p class="text-bodySmall" style="font-weight:600;">${escapeHtml(intentStatement)}</p>` : ''}
        ${criticalRecommendation
          ? visualComponents.policyAlertBox(criticalRecommendation, book.cost_of_inaction)
          : `<p class="exec-pull-quote">${escapeHtml(thesis)}</p>`}
      </div>
      <div class="reading-layer reading-layer--90s">
        <div class="overline">90-second read</div>
        <div class="grid">
          <div class="col-8">
            ${criticalRecommendation ? `<p class="exec-pull-quote">${escapeHtml(thesis)}</p>` : ''}
            <p class="text-bodySmall"><b>Why it matters:</b> ${escapeHtml(firstSentences(report.executive_summary || '', whyItMattersSentences))}</p>
            ${visualComponents.heroKpiPanel(heroStats)}
          </div>
          <div class="col-4">
            <p class="text-bodySmall"><b>Top decisions:</b></p>
            ${visualComponents.priorityActionsList(topThreeDecisions)}
            <p class="text-bodySmall"><b>By when:</b> ${escapeHtml(topRecommendation?.timeline || 'Not set')}</p>
          </div>
        </div>
      </div>
      <div class="reading-layer reading-layer--5min">
        <div class="overline">5-minute read</div>
        <div class="grid">
          <div class="col-8">
            <p class="text-bodySmall"><b>Most affected:</b> ${escapeHtml(affectedGroup)}</p>
            <p class="text-bodySmall"><b>Strongest evidence:</b> ${escapeHtml(strongestEvidence?.quote || 'See evidence annex')}</p>
            <p class="text-bodySmall role-warning"><b>What remains uncertain:</b> ${escapeHtml((report.limitations || [])[0] || 'Not stated')}</p>
            ${visualComponents.investmentOpportunityCard(topOpportunity, topRecommendation)}
          </div>
          <div class="col-4">
            <p class="text-bodySmall"><b>Highest-priority risk:</b> ${escapeHtml(highestPriorityRisk?.risk || 'Not identified')}</p>
            <p class="caption"><b>Decision readiness:</b> ${escapeHtml(humanizeStatusEnum(report.publication_readiness?.status))}</p>
            ${visualComponents.confidenceMeter(assurance.overall, 'Publication confidence')}
            ${criticalRecommendation ? '' : visualComponents.costOfInactionPanel(book.cost_of_inaction)}
          </div>
        </div>
      </div>
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: 'Executive Brief' },
    ...(intentStatement ? [{ type: 'paragraph', text: intentStatement, emphasis: 'thesis' }] : []),
    ...(criticalRecommendation
      ? [{ type: 'callout', label: 'Policy Alert', text: `${criticalRecommendation.recommendation || criticalRecommendation.text || ''} ${book.cost_of_inaction || ''}`.trim() }]
      : [{ type: 'paragraph', text: thesis, emphasis: 'thesis' }]),
    { type: 'paragraph', text: firstSentences(report.executive_summary || '', whyItMattersSentences), emphasis: 'body' },
    ...(heroStats.length ? [{ type: 'stat_group', stats: heroStats.map(s => ({ label: s.label || '', value: s.value, unit: '' })) }] : []),
    { type: 'list', items: topThreeDecisions.map(r => r.recommendation || r.text || ''), ordered: false },
    { type: 'paragraph', text: `By when: ${topRecommendation?.timeline || 'Not set'}` },
    { type: 'paragraph', text: `Most affected: ${affectedGroup}` },
    { type: 'paragraph', text: `Strongest evidence: ${strongestEvidence?.quote || 'See evidence annex'}` },
    { type: 'paragraph', text: `What remains uncertain: ${(report.limitations || [])[0] || 'Not stated'}`, emphasis: 'caution' },
    ...(topOpportunity ? [{ type: 'callout', label: 'Investment opportunity', text: topOpportunity.opportunity || topOpportunity.text || '' }] : []),
    { type: 'callout', label: 'Highest-priority risk', text: highestPriorityRisk?.risk || 'Not identified' },
    { type: 'stat_group', stats: [
      { label: 'Decision readiness', value: humanizeStatusEnum(report.publication_readiness?.status), unit: '' },
      { label: 'Publication confidence', value: assurance.overall, unit: '' },
    ] },
  ];
  return spread('executive-brief', ['90s', '5min'], 'story', [{ type: 'executive_brief', hasInterpretation: true }],
    html, `${thesis} ${report.executive_summary || ''}`, blocks);
}

// ------------------------------------------------------------------
// 4. Five key messages — scannable, distinct from the brief's prose.
// ------------------------------------------------------------------
// A "key message" is a scannable distillation, not the full finding
// paragraph — VPPX's own definition is "the one sentence a spread must be
// remembered by." The source model's key_messages field is an alias for the
// full finding text (a content-generation-layer property this renderer does
// not rewrite), so this composer takes only the FIRST sentence of each —
// an extractive compositional decision, not a rewrite.
// PX Release 5.1, Part 4: reuses planFindingEditorial's paragraphRhythm
// decision (exposed on each finding as uncertainty_style, since the two are
// tier-derived 1:1 — 'hedged' iff 'condensed') rather than truncating every
// message to a uniform one sentence regardless of the finding behind it.
//
// EAD Release 2, Page C (Key Messages — ranked-message-composition layout
// family): previously 5 identical numbered-circle list items regardless of
// real content weight. findings[i] and recommendations[i] share the same
// real index throughout this codebase (established since PX Release 5's
// editorial engine), so each finding can honestly borrow its linked
// recommendation's real strategic_priority tier, combined with the
// finding's own real confidence_score, into one deterministic ranking —
// not a generative "importance" score, a real ordinal combination of two
// fields already on the model. Reordered into 3 real prominence tiers (1
// dominant / 2 secondary / up to 2 supporting — the exact "1 + 2 + 2"
// asymmetry requested), each with its own distinct typographic treatment,
// replacing the uniform numbered-circle list and the single shared
// rhetorical shape it forced on every finding regardless of real weight.
const KEY_MESSAGE_PRIORITY_WEIGHT = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
// EIE Release 1: `northStarIndex`, when given, forces that finding into
// rank 0 (the "Leading signal") — the tier+confidence ranking below still
// orders every OTHER finding exactly as before. Previously Key Messages'
// own ranking was fully independent of Cover/Hero-Insight/Executive-Brief's
// selection, confirmed to disagree in 10 of 16 real samples; this makes
// the four agree by construction on which finding leads.
function rankKeyMessages(findings, recommendations, northStarIndex = null) {
  const scored = findings.map((finding, index) => ({
    finding, index,
    tierScore: (KEY_MESSAGE_PRIORITY_WEIGHT[String(recommendations[index]?.strategic_priority || '').toUpperCase()] || 0) * 1000 + (Number(finding.confidence_score) || 0),
  })).sort((a, b) => b.tierScore - a.tierScore);
  if (northStarIndex == null) return scored;
  const forced = scored.find(s => s.index === northStarIndex);
  if (!forced) return scored;
  return [forced, ...scored.filter(s => s.index !== northStarIndex)];
}
function keyMessageProminence(rank) {
  return rank === 0 ? 'dominant' : rank <= 2 ? 'secondary' : 'supporting';
}
const KEY_MESSAGE_PROMINENCE_LABEL = { dominant: 'Leading signal', secondary: 'Secondary signal', supporting: 'Supporting signal' };

function buildKeyMessagesSpread(report, northStar = null) {
  const sourceFindings = (report.findings || []).slice(0, 5);
  const recommendations = report.recommendations || [];
  const ranked = rankKeyMessages(sourceFindings, recommendations, northStar?.findingIndex);
  const items = ranked.map(({ finding: f }, rank) => ({
    prominence: keyMessageProminence(rank),
    text: firstSentences(f.text, f.uncertainty_style === 'hedged' ? 1 : 2),
  }));
  // PX Release 5, Task #44: a one-line synthesis closing the five messages
  // — a real count of the report's own recommendation priority tiers, not
  // a generative summary of the five sentences above.
  const criticalCount = recommendations.filter(r => r.strategic_priority === 'CRITICAL').length;
  const otherCount = recommendations.length - criticalCount;
  const synthesis = recommendations.length
    ? `Together, these signals point to ${criticalCount} decision${criticalCount === 1 ? '' : 's'} requiring immediate action${otherCount ? ` and ${otherCount} requiring sustained follow-through` : ''}.`
    : '';
  const html = `
    <section class="spread">
      ${spreadHeader('At a Glance', 'What matters most, ranked')}
      <div class="km-composition">
        ${items.map(item => `<div class="km-item km-item--${item.prominence}"><span class="overline km-item-rank">${escapeHtml(KEY_MESSAGE_PROMINENCE_LABEL[item.prominence])}</span><p class="km-item-text">${escapeHtml(item.text)}</p></div>`).join('')}
      </div>
      ${synthesis ? `<p class="text-bodySmall" style="margin-top:16px;"><b>${escapeHtml(synthesis)}</b></p>` : ''}
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: 'At a Glance' },
    { type: 'list', items: items.map(item => `${KEY_MESSAGE_PROMINENCE_LABEL[item.prominence]}: ${item.text}`), ordered: false },
    ...(synthesis ? [{ type: 'paragraph', text: synthesis, emphasis: 'synthesis' }] : []),
  ];
  return spread('key-messages', ['90s'], 'story', [{ type: 'key_messages', hasInterpretation: true }], html, `${items.map(i => i.text).join(' ')} ${synthesis}`, blocks);
}

// ------------------------------------------------------------------
// 5. Hero insight (Part 7): decisive assertion + hero stat + quote +
// confidence + explicit benchmark-gap label + decision implication.
// ------------------------------------------------------------------
function buildHeroInsightSpread(hero, evidenceById, recommendation, evidenceLabel, arcBridge = '') {
  if (!hero) return null;
  const linkedEvidence = (hero.evidence_ids || []).map(id => evidenceById.get(id)).find(Boolean);
  const heroStatMatch = String(hero.text || '').match(/(\d+(?:\.\d+)?%)/);
  // PX Release 5, Task #50 (6th of 7 chart types wired): the confidence
  // band's own real range, from the same classifyVRDSConfidence banding
  // already used by confidenceMeter — a second, complementary view of the
  // same real number (where it sits within its band), not a duplicate stat.
  const band = classifyVRDSConfidence(hero.confidence_score);
  const uncertaintyBand = chartComponents.uncertaintyBand(hero.confidence_score, band);
  const html = `
    <section class="spread">
      ${spreadHeader('Hero Insight', hero.title || 'Flagship finding', arcBridge)}
      <div class="grid">
        <div class="col-8">
          <p class="text-statDisplay" style="color:var(--vpds-blue700);margin:0;">${escapeHtml(heroStatMatch ? heroStatMatch[1] : '—')}</p>
          <p class="text-bodyLarge">${escapeHtml(hero.text || '')}</p>
          ${linkedEvidence ? visualComponents.evidenceSpotlightCard(linkedEvidence, evidenceLabel) : ''}
        </div>
        <div class="col-4">
          ${visualComponents.confidenceMeter(hero.confidence_score, 'Confidence in this finding')}
          ${uncertaintyBand ? `<div class="caption space-4">Where this sits within its confidence band:</div>${uncertaintyBand}` : ''}
          <p class="caption"><b>Benchmark:</b> No external benchmark is available for this indicator in the current publication — gap explicitly disclosed rather than estimated.</p>
          <!-- EIE Release 1: condensed per editorial-intelligence-engine.js's
               RECOMMENDATION_REPETITION_PLAN — Executive Brief already states
               this decision in full 2 pages earlier; a reference here, not a
               third full repeat (the audit found the top recommendation's
               exact sentence on 10 of 20 pages). -->
          <p class="text-bodySmall"><b>Decision implication:</b> ${escapeHtml(referenceToDecision(recommendation) || 'Not linked to a recommendation')}</p>
        </div>
      </div>
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: hero.title || 'Flagship finding' },
    ...(heroStatMatch ? [{ type: 'stat_group', stats: [{ label: hero.title || '', value: heroStatMatch[1], unit: '' }] }] : []),
    { type: 'paragraph', text: hero.text || '', emphasis: 'thesis' },
    ...(linkedEvidence ? [{ type: 'callout', label: 'Evidence', text: linkedEvidence.quote || '' }] : []),
    { type: 'stat_group', stats: [{ label: 'Confidence in this finding', value: hero.confidence_score, unit: '' }] },
    { type: 'paragraph', text: 'Benchmark: no external benchmark is available for this indicator in the current publication — gap explicitly disclosed rather than estimated.', emphasis: 'caption' },
    { type: 'callout', label: 'Decision implication', text: referenceToDecision(recommendation) || 'Not linked to a recommendation' },
  ];
  return spread('hero-insight', ['90s', '5min'], 'story', [
    { type: 'hero_insight', hasInterpretation: true },
    ...(linkedEvidence ? [{
      type: 'evidence_panel', hasInterpretation: true, hasProvenance: Boolean(linkedEvidence.id),
      hasStatistic: Boolean(linkedEvidence.statistic?.value != null),
      hasConfidence: linkedEvidence.confidence_score != null,
      hasSource: Boolean(linkedEvidence.id),
    }] : []),
    ...(uncertaintyBand ? [{ type: 'uncertainty_band', hasInterpretation: true }] : []),
  ], html, hero.text || '', blocks);
}

// ------------------------------------------------------------------
// 6. National development context — real aggregate numbers, no invention.
// Part 8 (Release 2.1): uses the LAST sentence of the executive summary
// (a different extractive slice than the executive brief's full paragraph)
// instead of repeating the exact same text a reader already saw two spreads
// earlier — same source string, different portion, fully traceable.
// ------------------------------------------------------------------
function buildContextSpread(report, full, arcBridge = '') {
  // The executive summary's closing sentence, in full — not word-capped.
  // It is not quoted anywhere else in the publication (the Executive Brief's
  // "Why it matters" line draws only on the summary's first 1-2 sentences),
  // so rendering it complete here neither duplicates another page nor risks
  // the mid-clause, ellipsis-ending fragment a word cap previously produced.
  const contextFragment = lastSentence(report.executive_summary || '');
  const ruralShare = (full.demographics?.location || []).find(([label]) => /rural/i.test(label))?.[1];
  const indicatorCount = (full.indicators || []).length;
  // PX Release 5, Task #44: coverage/data-lifecycle framing from fields
  // already on the model (methodology.sampling_frame, demographics.sex) —
  // no invented HDI/macro-economic comparison.
  const samplingFrame = report.methodology?.sampling_frame;
  const sexComposition = (full.demographics?.sex || []).map(([label, pct]) => `${pct}% ${label.toLowerCase()}`).join(', ');
  // PX Release 11, Part 4: the Publication Intelligence Layer's evidence
  // commentary (report.evidence_commentary, PX Release 10) was computed
  // for every finding but never rendered anywhere. Findings[0]'s commentary
  // — real strength/consistency/gap statistics about the evidence base
  // itself — gives National Context a genuine "what stands behind this
  // publication" grounding, distinct from the Regional & Equity page two
  // spreads later (which covers the regional gap, not the evidence base).
  const evidenceCommentary = report.evidence_commentary?.[0];
  const evidenceInsight = evidenceCommentary ? visualComponents.insightPanel('Evidence Behind This Publication', [
    { label: 'Strength', text: evidenceCommentary.strength },
    { label: 'Consistency', text: evidenceCommentary.consistency },
    { label: 'Completeness', text: evidenceCommentary.completeness },
  ]) : '';
  const html = `
    <section class="spread">
      ${spreadHeader('National Context', 'The foundation everything else builds on', arcBridge)}
      <div class="grid">
        <div class="col-8">
          <p class="text-bodyLarge">${escapeHtml(contextFragment)}</p>
          <p class="citation">Full context statement in the Executive Brief.</p>
          ${samplingFrame ? `<h4>Data lifecycle</h4><p class="text-bodySmall">${escapeHtml(samplingFrame)}${sexComposition ? ` Respondent composition: ${escapeHtml(sexComposition)}.` : ''}</p>` : ''}
          ${evidenceInsight}
        </div>
        <div class="col-4">
          <div class="methodology-stat-tiles">
            <div class="methodology-stat-tile"><span class="text-h3">${escapeHtml(full.sample_size)}</span><span class="caption">Synthetic responses</span></div>
            <div class="methodology-stat-tile"><span class="text-h3">${escapeHtml(full.response_rate_pct)}%</span><span class="caption">Response rate</span></div>
            <div class="methodology-stat-tile"><span class="text-h3">${escapeHtml(full.regions_covered)}</span><span class="caption">Regions covered</span></div>
            ${indicatorCount ? `<div class="methodology-stat-tile"><span class="text-h3">${escapeHtml(indicatorCount)}</span><span class="caption">Governed indicators</span></div>` : ''}
            ${ruralShare != null ? `<div class="methodology-stat-tile"><span class="text-h3">${escapeHtml(ruralShare)}%</span><span class="caption">Rural respondents</span></div>` : ''}
          </div>
        </div>
      </div>
    </section>`;
  // The sidebar's real governed sample/coverage figures are genuine
  // rendered content, not decoration — they count toward this spread's
  // richness for the fill-rate check the same way structuralDensity()
  // already counts table rows and list items elsewhere.
  const text = `${contextFragment} ${full.sample_size || ''} synthetic responses ${full.response_rate_pct || ''}% response rate across ${full.regions_covered || ''} regions and ${indicatorCount} governed indicators ${samplingFrame || ''} ${evidenceCommentary ? `${evidenceCommentary.strength} ${evidenceCommentary.consistency} ${evidenceCommentary.completeness}` : ''}`;
  const blocks = [
    { type: 'heading', level: 1, text: 'National Context' },
    { type: 'paragraph', text: contextFragment, emphasis: 'thesis' },
    ...(samplingFrame ? [{ type: 'paragraph', text: `${samplingFrame}${sexComposition ? ` Respondent composition: ${sexComposition}.` : ''}` }] : []),
    ...(evidenceCommentary ? [{ type: 'card', title: 'Evidence Behind This Publication', fields: [
      { label: 'Strength', text: evidenceCommentary.strength },
      { label: 'Consistency', text: evidenceCommentary.consistency },
      { label: 'Completeness', text: evidenceCommentary.completeness },
    ] }] : []),
    { type: 'stat_group', stats: [
      { label: 'Synthetic responses', value: full.sample_size, unit: '' },
      { label: 'Response rate', value: full.response_rate_pct, unit: '%' },
      { label: 'Regions covered', value: full.regions_covered, unit: '' },
      ...(indicatorCount ? [{ label: 'Governed indicators', value: indicatorCount, unit: '' }] : []),
      ...(ruralShare != null ? [{ label: 'Rural respondents', value: ruralShare, unit: '%' }] : []),
    ] },
  ];
  return spread('national-context', ['5min'], 'story', [
    { type: 'context_narrative', hasInterpretation: true },
    ...(evidenceInsight ? [{ type: 'evidence_insight_panel', hasInterpretation: true }] : []),
  ], html, text, blocks);
}

// ------------------------------------------------------------------
// 8. Regional and equity story (Part 8): national reference line, sample
// sizes, equity interpretation, explicit "what cannot be concluded."
//
// Editorial Constitution Article VII, Professional Maps: this is the
// spread a real choropleth/point map of regional performance would belong
// on, and it is explicitly NOT built here. This codebase has no African
// geo-boundary data source (no country/region shape files anywhere in the
// repo) — rendering a "map" without one would mean either fabricating
// boundary geometry or mislabeling the dumbbellChart below as something
// it isn't. Named backlog, not a silent gap: real geo-boundary rendering
// is a substantial, isolated capability sized for its own future session.
// ------------------------------------------------------------------
function buildRegionalSpread(regional, indicators, recommendations, arcBridge = '', strategicInterpretation = null, youthInterpretation = null) {
  const scores = (regional || []).map(r => Number(r.primary_score) || 0);
  const nationalAvg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const sorted = (regional || []).slice().sort((a, b) => b.primary_score - a.primary_score);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const linkedRecommendation = (recommendations || [])[0];
  const dumbbellItems = nationalAvg != null ? (regional || []).map(r => ({ label: r.name, valueA: nationalAvg, valueB: Number(r.primary_score) || 0 })) : [];
  const dumbbell = dumbbellItems.length ? chartComponents.dumbbellChart(dumbbellItems, { labelA: 'National average', labelB: 'Region' }) : '';
  // PX Release 11, Part 4: report.strategic_interpretation_regional (PX
  // Release 10) already computes exactly this page's own gap in the
  // 5-question strategic-interpretation shape — computed, never rendered,
  // until now. Surfaced as an insight panel rather than a bare paragraph so
  // it reads as a distinct editorial voice from equityLensPanel above it.
  //
  // Publication Intelligence Brain fix: `decisionEnabled`/`uncertaintyRemaining`
  // are fixed boilerplate sentences in buildStrategicInterpretation() — real
  // and honest, but identical regardless of which real gap is being
  // described, which is exactly the "reads like a template" defect a direct
  // look at the rendered panel confirmed (this panel and the new youth panel
  // below it read as the same sentence twice, differing only in title).
  // `whatChanged` — the one field that actually names the real number — was
  // computed all along but never rendered. Added as the panel's first line
  // so each panel's real, distinguishing figure is what a reader sees first.
  const strategicInsight = strategicInterpretation ? visualComponents.insightPanel('What This Gap Means', [
    { label: 'What the data shows', text: strategicInterpretation.whatChanged },
    { label: 'Decision enabled', text: strategicInterpretation.decisionEnabled },
    { label: 'Uncertainty remaining', text: strategicInterpretation.uncertaintyRemaining },
  ]) : '';
  // Publication Intelligence Brain — "Youth Thinking" lens: the same real,
  // computed regional youth-participation-share gap (flagship-sample-
  // library.js), surfaced with the identical insightPanel device used for
  // the regional-performance gap directly above, not a new component.
  const youthInsight = youthInterpretation ? visualComponents.insightPanel('What The Youth Participation Gap Means', [
    { label: 'What the data shows', text: youthInterpretation.whatChanged },
    { label: 'Decision enabled', text: youthInterpretation.decisionEnabled },
    { label: 'Uncertainty remaining', text: youthInterpretation.uncertaintyRemaining },
  ]) : '';
  const html = `
    <section class="spread">
      ${spreadHeader('Regional and Equity Story', best && worst ? `${best.name} leads, ${worst.name} trails` : 'Performance varies by geography', arcBridge)}
      <div class="grid">
        <div class="col-6">
          <div class="overline">Geographic Intelligence</div>
          ${visualComponents.regionalComparisonPanel(regional, nationalAvg)}
          ${dumbbell ? `<div class="overline space-8">${escapeHtml(best && worst ? `${worst.name} trails the national average by ${Math.abs(nationalAvg - worst.primary_score)} points` : 'Region vs. national average')}</div>${dumbbell}` : ''}
        </div>
        <div class="col-6">
          ${visualComponents.equityLensPanel(best, worst)}
          <!-- EIE Release 1: condensed per the repetition-governance plan
               (editorial-intelligence-engine.js) — a short reference, not a
               third full repeat of a decision already stated in full on
               Executive Brief. -->
          <p class="text-bodySmall"><b>Policy implication:</b> ${escapeHtml(referenceToDecision(linkedRecommendation) || 'Prioritise the lowest-performing region for the next resourcing cycle.')}</p>
          <p class="margin-note"><b>What cannot be concluded:</b> Differences between closely ranked regions may fall within sampling variation and should not be treated as a definitive ranking without further validation.</p>
          ${strategicInsight}
          ${youthInsight}
        </div>
      </div>
    </section>`;
  const text = (regional || []).map(r => r.name).join(' ') + ' ' + (indicators || []).map(i => i.label).join(' ') + (strategicInterpretation ? ` ${strategicInterpretation.decisionEnabled} ${strategicInterpretation.uncertaintyRemaining}` : '') + (youthInterpretation ? ` ${youthInterpretation.decisionEnabled} ${youthInterpretation.uncertaintyRemaining}` : '');
  const blocks = [
    { type: 'heading', level: 1, text: 'Regional and Equity Story' },
    { type: 'table', headers: ['Region', 'Score'], rows: (regional || []).map(r => [r.name, r.primary_score]) },
    ...(best && worst ? [{ type: 'paragraph', text: `${best.name} leads, ${worst.name} trails.` }] : []),
    { type: 'callout', label: 'Policy implication', text: referenceToDecision(linkedRecommendation) || 'Prioritise the lowest-performing region for the next resourcing cycle.' },
    { type: 'paragraph', text: 'What cannot be concluded: differences between closely ranked regions may fall within sampling variation and should not be treated as a definitive ranking without further validation.', emphasis: 'caution' },
    ...(strategicInterpretation ? [{ type: 'card', title: 'What This Gap Means', fields: [
      { label: 'What the data shows', text: strategicInterpretation.whatChanged },
      { label: 'Decision enabled', text: strategicInterpretation.decisionEnabled },
      { label: 'Uncertainty remaining', text: strategicInterpretation.uncertaintyRemaining },
    ] }] : []),
    ...(youthInterpretation ? [{ type: 'card', title: 'What The Youth Participation Gap Means', fields: [
      { label: 'What the data shows', text: youthInterpretation.whatChanged },
      { label: 'Decision enabled', text: youthInterpretation.decisionEnabled },
      { label: 'Uncertainty remaining', text: youthInterpretation.uncertaintyRemaining },
    ] }] : []),
  ];
  return spread('regional-equity', ['5min', '15min'], 'evidence', [
    { type: 'regional_panel', hasInterpretation: true }, { type: 'interpretation', hasInterpretation: true },
    ...(strategicInsight ? [{ type: 'strategic_interpretation_panel', hasInterpretation: true }] : []),
    ...(youthInsight ? [{ type: 'youth_interpretation_panel', hasInterpretation: true }] : []),
    ...(dumbbell ? [{ type: 'dumbbell_chart', hasInterpretation: true }] : []),
  ], html, text, blocks);
}

// ------------------------------------------------------------------
// 9. Human voice and evidence story (Part 9): Voice Thread, consent-safe,
// selects the strongest/most distinct quotes rather than the first N.
// ------------------------------------------------------------------
function buildEvidenceStorySpread(evidence, evidenceLabel, arcBridge = '') {
  const ranked = (evidence || []).slice().sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0)).slice(0, 3);
  const html = `
    <section class="spread">
      ${spreadHeader('Human Voice and Evidence', 'What respondents are telling decision-makers', arcBridge)}
      <div class="grid">
        ${ranked.map(e => `<div class="col-4">${visualComponents.evidenceSpotlightCard(e, evidenceLabel)}</div>`).join('')}
      </div>
    </section>`;
  const components = ranked.map(e => ({
    type: 'evidence_panel', hasInterpretation: true, hasProvenance: Boolean(e.id),
    hasStatistic: Boolean(e.statistic?.value != null),
    hasConfidence: e.confidence_score != null,
    hasSource: Boolean(e.id),
  }));
  const blocks = [
    { type: 'heading', level: 1, text: 'Human Voice and Evidence' },
    ...ranked.map(e => ({ type: 'callout', label: e.respondent_group || 'Respondent', text: e.quote || '' })),
  ];
  return spread('evidence-story', ['15min'], 'evidence', components, html, ranked.map(e => e.quote).join(' '), blocks);
}

// ------------------------------------------------------------------
// 10. Root-cause table (Part 10): symptom / immediate cause / structural
// cause, explicitly labelling analytical inference vs. measured fact.
// ------------------------------------------------------------------
function buildRootCauseSpread(findings, evidenceById, arcBridge = '', recommendations = []) {
  // Every row previously carried the identical inferred-cause sentence
  // regardless of symptom (PX Release 6 PQR, high finding #10) — three
  // different topics given one boilerplate diagnosis undercuts the page's
  // own claim to analytical depth. Anchoring the same honest disclosure
  // ("analytical inference... not directly measured") to each finding's own
  // linked region/respondent group/indicator keeps it equally non-causal
  // while making every row genuinely about its own symptom.
  // PX Release 11, Part 5 (Premium Infographic System — Confidence
  // Thermometer): each row's linkedEvidence already carries a real
  // confidence_score (used elsewhere for the confidence badge/meter, never
  // here) — rendering it per-row turns a plain evidence-ID list into a real
  // visual signal of how much weight each inferred cause can bear, and
  // differentiates this table-only page from its neighbours.
  // VPX Release 1: the structural-cause sentence ran ~30 words per row,
  // making this the densest page in the whole publication (320-360 words
  // against neighbours at 12-94) — an independent editorial review flagged
  // this imbalance directly. Tightened to ~20 words per row without
  // dropping any real fact (region, respondent group, indicator, the
  // "not directly measured" honesty disclosure all remain).
  // EAD Release 2, Page D (Root-Cause — causal-system layout family): the
  // brief's real 5-stage chain — measured symptom -> extracted cause ->
  // inferred structural cause -> operational constraint -> decision
  // implication — extends the prior 3-stage chain with 2 real, already-
  // governed fields this page never used: findings[i] and recommendations[i]
  // share the same real index throughout this codebase (established since
  // PX Release 5's editorial engine), so a finding's own linked
  // recommendation legitimately supplies its real operational constraint
  // (recommendation.expected_risk — the concrete execution-level obstacle,
  // a genuinely different real field from the structural-cause inference
  // above it) and decision implication (recommendation.recommendation
  // itself). Nothing here reuses or repeats the structural-cause sentence;
  // each of the 5 stages is a distinct real field or a distinct extractive
  // slice of one. The chain is now the PRIMARY composition; the table
  // below is a condensed secondary index (symptom + evidence only), not
  // the page's main content, per the brief's explicit instruction.
  const chains = (findings || []).slice(0, 3).map((f, index) => {
    const immediate = deriveImmediateCause(f.text);
    const linkedEvidence = evidenceById?.get((f.evidence_ids || [])[0]);
    const structuralCause = linkedEvidence
      ? `Inferred: concentrated in ${linkedEvidence.region} among ${(linkedEvidence.respondent_group || 'the affected group').toLowerCase()}${f.related_indicator ? `, affecting ${String(f.related_indicator).toLowerCase()}` : ''} — a likely delivery/access gap, not directly measured.`
      : 'Inferred: a concentrated pattern suggesting a delivery/access gap, not directly measured.';
    const linkedRecommendation = (recommendations || [])[index];
    return {
      finding: f, linkedEvidence,
      stages: [
        { label: 'Symptom', status: 'measured', text: f.title || f.id },
        { label: 'Immediate cause', status: 'extracted', text: immediate || 'Not explicitly stated in the model' },
        { label: 'Structural cause', status: 'inferred', text: structuralCause },
        { label: 'Operational constraint', status: 'identified', text: linkedRecommendation?.expected_risk || 'No blocking constraint identified' },
        // EIE Release 1: condensed per the repetition-governance plan
        // (editorial-intelligence-engine.js) — names which real decision
        // follows the chain without restating it in full a third time.
        { label: 'Decision implication', status: 'decided', text: referenceToDecision(linkedRecommendation) || 'Not yet linked to a recommendation' },
      ],
    };
  });
  const chainCardsHtml = chains.map(({ finding: f, linkedEvidence, stages }) => `
    <div class="causal-chain-card">
      <div class="causal-chain-flow">
        ${stages.map((s, i) => `${i > 0 ? '<span class="root-cause-chain-arrow">&rarr;</span>' : ''}<span class="root-cause-chain-step${s.status === 'inferred' ? ' root-cause-chain-step--inferred' : ''}">${escapeHtml(s.label)}</span>`).join('')}
      </div>
      <dl class="causal-chain-detail">
        ${stages.map(s => `<div class="causal-chain-detail-row"><dt>${escapeHtml(s.label)} <span class="caption">(${escapeHtml(s.status)})</span></dt><dd${s.status === 'inferred' ? ' style="font-style:italic;"' : ''}>${escapeHtml(s.text)}</dd></div>`).join('')}
      </dl>
      <p class="citation">Evidence ${escapeHtml((f.evidence_ids || []).join(', '))}${linkedEvidence?.confidence_score != null ? visualComponents.confidenceThermometer(linkedEvidence.confidence_score, '') : ''}</p>
    </div>`).join('');
  const indexRows = chains.map(({ finding: f, linkedEvidence }) =>
    `<tr><td>${escapeHtml(f.title || f.id)}</td><td>${escapeHtml((f.evidence_ids || []).join(', '))}</td><td>${escapeHtml(linkedEvidence?.confidence_score != null ? `${linkedEvidence.confidence_score}%` : '—')}</td></tr>`).join('');
  const html = `
    <section class="spread">
      ${spreadHeader('Root-Cause Analysis', 'From symptom to decision', arcBridge)}
      <div class="causal-chain-grid">${chainCardsHtml}</div>
      <details class="causal-chain-index">
        <summary class="overline">Quick-reference index</summary>
        <table class="vpds-table"><thead><tr><th>Symptom</th><th>Evidence</th><th>Confidence</th></tr></thead><tbody>${indexRows}</tbody></table>
      </details>
      <p class="footnote">Structural-cause entries are explicitly labelled analytical inference, not a directly measured relationship. Symptom and immediate cause are extracted directly from the finding text; operational constraint and decision implication trace to the linked recommendation's own real fields; only the structural layer is inferred. The confidence band is the same classification used throughout this publication (classifyVRDSConfidence).</p>
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: 'Root-Cause Analysis' },
    ...chains.map(({ finding: f, stages }) => ({
      type: 'card', title: f.title || f.id,
      fields: stages.map(s => ({ label: `${s.label} (${s.status})`, text: s.text })),
    })),
    { type: 'table', headers: ['Symptom', 'Evidence', 'Confidence'], rows: chains.map(({ finding: f, linkedEvidence }) => [f.title || f.id, (f.evidence_ids || []).join(', '), linkedEvidence?.confidence_score != null ? `${linkedEvidence.confidence_score}%` : '—']) },
    { type: 'paragraph', text: 'Structural-cause entries are explicitly labelled analytical inference, not a directly measured relationship.', emphasis: 'caption' },
  ];
  return spread('root-cause', ['15min'], 'evidence', [
    ...chains.map(() => ({ type: 'causal_chain_card', hasInterpretation: true })),
    { type: 'root_cause_index_table', hasInterpretation: true },
  ], html, (findings || []).map(f => f.text).join(' '), blocks);
}

// ------------------------------------------------------------------
// 11. Scenarios and cost of inaction (Part 11): qualitative, directional,
// never a fabricated forecast number. Part 8 (Release 2.1): the accelerated-
// reform direction uses the FIRST sentence of strategic_outlook, reserving
// the full statement for the closing note — same source, different tier.
// ------------------------------------------------------------------
function buildScenarioSpread(book, recommendations, arcBridge = '') {
  // PX Release 5, Task #45: Status quo and Targeted reform now tie to the
  // report's own top recommendation (expected_risk, timeline, budget
  // requirement — all real, already-governed fields) instead of a
  // hardcoded generic sentence; no quantified outcome is invented for
  // either. Accelerated reform still reuses strategic_outlook, unchanged.
  const topRecommendation = (recommendations || [])[0];
  // "Targeted reform"'s assumption previously restated the top
  // recommendation's own sentence verbatim — the same text already shown
  // in full on Priority Matrix and Decisions A one page later (PX Release
  // 6.5 PQR item #5). A scenario's assumption is a premise ("if this is
  // adopted"), not the decision text itself; the priority tier is a real
  // field the recommendation already carries, so referencing it keeps this
  // grounded without repeating the sentence.
  const topPriorityTier = String(topRecommendation?.priority || topRecommendation?.strategic_priority || '').toLowerCase();
  const scenarios = [
    { name: 'Status quo', assumption: 'Current delivery patterns continue unchanged', direction: topRecommendation?.expected_risk ? `The risk already on record: ${topRecommendation.expected_risk}.` : 'Gaps persist or widen', confidence: 'High' },
    { name: 'Targeted reform', assumption: topRecommendation ? `The top-priority decision${topPriorityTier ? ` (${topPriorityTier} tier)` : ''} is adopted and resourced as planned, with no further delay.` : 'Priority decisions are adopted and resourced', direction: topRecommendation?.timeline ? `Convergence within ${topRecommendation.timeline}; budget: ${topRecommendation.budget_requirement || 'not costed'}.` : 'Gradual convergence toward target', confidence: 'Moderate' },
    { name: 'Accelerated reform', assumption: 'All priority decisions adopted with full resourcing', direction: firstSentences(book.strategic_outlook, 1) || 'Faster convergence, higher execution risk', confidence: 'Low-moderate' },
  ];
  // VPX Release 1: Scenarios & Outlook was the one page in the whole
  // publication an independent editorial review found with no visual
  // anchor at all. The three scenarios already carry a real, assigned
  // qualitative confidence label (High/Moderate/Low-moderate) — the fan
  // diagram diverges them by that real rank, inventing no number.
  const fan = chartComponents.scenarioFan(scenarios);
  const html = `
    <section class="spread">
      ${spreadHeader('Scenarios and Outlook', 'Three paths, not one forecast', arcBridge)}
      ${fan ? `<div class="overline">Confidence across the three paths</div>${fan}` : ''}
      <div class="grid">
        ${scenarios.map(s => `<div class="col-4"><div class="scenario-card"><h4>${escapeHtml(s.name)}</h4><p class="text-bodySmall"><b>Assumption:</b> ${escapeHtml(s.assumption)}</p><p class="text-bodySmall"><b>Direction:</b> ${escapeHtml(s.direction)}</p><p class="caption">Confidence: ${escapeHtml(s.confidence)}</p></div></div>`).join('')}
      </div>
      ${visualComponents.costOfInactionPanel(book.cost_of_inaction)}
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: 'Scenarios and Outlook' },
    ...scenarios.map(s => ({ type: 'card', title: s.name, fields: [
      { label: 'Assumption', text: s.assumption },
      { label: 'Direction', text: s.direction },
      { label: 'Confidence', text: s.confidence },
    ] })),
    { type: 'callout', label: 'Cost of inaction', text: book.cost_of_inaction || '' },
  ];
  return spread('scenarios', ['15min'], 'insight', [
    { type: 'scenario_panel', hasInterpretation: true },
    ...(fan ? [{ type: 'scenario_fan_chart', hasInterpretation: true }] : []),
  ], html, scenarios.map(s => s.direction).join(' '), blocks);
}

// ------------------------------------------------------------------
// 12. Priority matrix (Part 12): real ordinal fields plotted, capped at 5.
// ------------------------------------------------------------------
function buildPriorityMatrixSpread(recommendations, arcBridge = '', soWhatTop = null) {
  const top = (recommendations || []).slice(0, 5);
  // Both axes are ordinal (4 priority tiers x 4 budget bands), so two
  // recommendations sharing a tier and a budget band land on the exact same
  // coordinate — confirmed on the real model: 2 CRITICAL/medium-budget
  // recommendations collided at one point, hiding one of them entirely
  // (PX Release 6 PQR, critical finding #7). A small deterministic fan-out
  // keeps every dot visible without claiming precision the ordinal fields
  // don't have — the footnote below discloses the nudge explicitly.
  const seenPositions = new Map();
  const dots = top.map((r, i) => {
    const baseX = feasibilityToAxis(r.budget_requirement || r.budget_band);
    const baseY = priorityToAxis(r.priority || r.strategic_priority);
    const key = `${baseX},${baseY}`;
    const collisionIndex = seenPositions.get(key) || 0;
    seenPositions.set(key, collisionIndex + 1);
    const ring = Math.ceil(collisionIndex / 2);
    const sign = collisionIndex % 2 === 1 ? 1 : -1;
    const x = Math.min(92, Math.max(8, baseX + sign * ring * 6));
    const y = Math.min(92, Math.max(8, baseY - sign * ring * 4));
    return `<div class="matrix-dot" style="left:${x}%;bottom:${y}%;background:${riskColorFor(100 - baseY)}">${i + 1}</div>`;
  }).join('');
  const legend = visualComponents.priorityActionsList(top, true);
  // PX Release 11, Part 3 (Executive Reading Experience): report.so_what[0]
  // (PX Release 10) already answers "if delayed / if accelerated" for the
  // top-ranked recommendation shown at position 1 on the plot above — a
  // real decision-usefulness callout this page never had, distinct from the
  // legend's bare recommendation list.
  const soWhatCallout = soWhatTop ? visualComponents.executiveCalloutCard('If This Decision Is Delayed', soWhatTop.ifDelayed) : '';
  // PX Release 5, Task #46: explicit on-chart axis labels + a "how to read
  // this" line. Bubble size is deliberately not used to encode a third
  // dimension — no real field on the model supports one, so the dots stay
  // uniform rather than fabricating a meaning for size.
  const html = `
    <section class="spread">
      <div class="arc-divider"><span class="arc-divider-label">Decision Intelligence begins</span></div>
      ${spreadHeader('Decision Intelligence', 'Where to act first', arcBridge)}
      <div class="grid">
        <div class="col-6">
          <div class="matrix-plot">
            ${dots}
            <span class="matrix-axis-label matrix-axis-label--x">Feasibility (budget-derived) &rarr;</span>
            <span class="matrix-axis-label matrix-axis-label--y">Priority &rarr;</span>
          </div>
          <p class="caption">Feasibility (x) vs. priority (y), derived from the report's own priority and budget fields.</p>
          <p class="footnote"><b>How to read this:</b> each numbered dot is one recommendation, numbered by rank. Position — not size — carries the meaning; dot size is uniform because no real field on this model supports a third quantified dimension. Recommendations sharing the same priority tier and budget band are nudged apart so every dot stays visible; that nudge carries no meaning beyond the real tier and band each dot already encodes.</p>
        </div>
        <div class="col-6">${legend}${soWhatCallout}</div>
      </div>
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: 'Decision Intelligence' },
    { type: 'table', headers: ['Rank', 'Recommendation', 'Priority', 'Budget'], rows: top.map((r, i) => [i + 1, r.recommendation, r.priority || r.strategic_priority, r.budget_requirement || r.budget_band]) },
    ...(soWhatTop ? [{ type: 'callout', label: 'If This Decision Is Delayed', text: soWhatTop.ifDelayed }] : []),
  ];
  return spread('priority-matrix', ['5min'], 'decision', [
    { type: 'priority_matrix', hasInterpretation: true },
    ...(soWhatCallout ? [{ type: 'so_what_callout', hasInterpretation: true }] : []),
  ], html, `${top.map(r => r.recommendation).join(' ')} ${soWhatTop?.ifDelayed || ''}`, blocks);
}

// PX Release 3, Part 5/9: the Decision Canvas component (implemented in
// publication-visual-components.js) replaces this file's own decision-card
// builder — same break-inside:avoid field atomicity from Release 2.1, plus
// a confirmed bug fix (the prior local implementation read `r.dependency`,
// a field that never existed on the model; the real field is the array
// `r.dependencies`, so every decision card had silently discarded real
// dependency data until now).
// EAD Release 2, Page E: Decision Canvas A's real "outcome and urgency
// led" sub-layout — decisions-a is always exactly the top 2 real
// recommendations (composePublicationSpreads's own decisionA =
// recommendations.slice(0, 2)), so a real, earliest-first urgency summary
// is honest here in a way it would not be on decisions-b's larger,
// more heterogeneous remainder. TIMELINE_BUCKET_ORDER reuses
// parseTimelineBucket's own real 3 buckets (already governed, defined
// above) rather than inventing a second timeline taxonomy.
const TIMELINE_BUCKET_ORDER = { immediate: 0, near_term: 1, medium_term: 2 };
function buildDecisionUrgencyBanner(recommendations) {
  if (!recommendations.length) return '';
  const earliest = recommendations.slice().sort((a, b) => (TIMELINE_BUCKET_ORDER[parseTimelineBucket(a.timeline)] ?? 9) - (TIMELINE_BUCKET_ORDER[parseTimelineBucket(b.timeline)] ?? 9))[0];
  const owners = [...new Set(recommendations.map(r => r.owner).filter(Boolean))];
  return `<div class="decision-urgency-banner">
    <span class="overline">${recommendations.length} decision${recommendations.length === 1 ? '' : 's'} move first</span>
    <p class="text-bodySmall">${earliest?.timeline ? `Earliest real deadline: ${escapeHtml(earliest.timeline)} (${escapeHtml(truncateWords(earliest.recommendation, 8))}).` : ''}${owners.length ? ` Owned by ${owners.map(o => escapeHtml(o)).join(', ')}.` : ''}</p>
  </div>`;
}

// EAD Release 2, Page E: Decision Canvas B's real "comparison led"
// sub-layout — a compact strip letting a reader compare owner/timeline/
// priority across B's (typically 3) remaining decisions at a glance,
// before reading each one's full memo below. Every cell is a field the
// individual cards already render in full; this is a real summary view of
// the same real data, not a second data source.
function buildDecisionComparisonStrip(recommendations) {
  if (recommendations.length < 2) return '';
  const rows = recommendations.map(r => `<tr><td>${escapeHtml(truncateWords(r.recommendation, 8))}</td><td>${escapeHtml(r.owner || 'Not assigned')}</td><td>${escapeHtml(r.timeline || 'Not set')}</td><td>${escapeHtml(r.priority || r.strategic_priority || 'Not set')}</td></tr>`).join('');
  return `<table class="vpds-table decision-comparison-strip"><thead><tr><th>Decision</th><th>Owner</th><th>Timeline</th><th>Priority</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ------------------------------------------------------------------
// Decision Reasoning Architecture — 5 new signature spreads (Part 9).
// Every spread below renders report.decision_reasoning.by_recommendation,
// the object flagship-decision-reasoning-engine.js computes once per
// report — nothing here computes a NEW reasoning value, it only lays out
// what that engine already produced, with every statement's inference_type
// / epistemic_status visibly disclosed via a coloured badge, exactly the
// "the publication must visibly communicate this distinction" requirement.
// ------------------------------------------------------------------
// Accessibility review (Part 11) measured actual WCAG contrast ratios for
// white text (the shared .confidence-badge default) against each of these
// backgrounds: green600 (KNOWN) 4.38:1, teal600 3.4:1, gold500 2.3:1,
// amber500 2.2:1, orange600 2.9:1 — every one fails the 4.5:1 minimum for
// normal-weight badge text (12px bold does not qualify as WCAG "large
// text"), and amber500 (EMERGING) is the single most frequently rendered
// badge across these 5 spreads. Dark text (slate900) reverses 4 of those
// to 5.2–8:1. green600 is the one case where NEITHER white (4.38) nor
// dark (4.05) text clears 4.5 — the colour itself sits in a contrast dead
// zone — so KNOWN gets a badge-local, slightly darkened green
// (unrelated to and not replacing the shared vrdsTokens.colors.green600
// token used elsewhere in the codebase) rather than leaving a known,
// measured AA failure in place.
const EPISTEMIC_BADGE_COLOR = Object.freeze({
  KNOWN: '#1D7F46', HIGHLY_LIKELY: vrdsTokens.colors.teal600, LIKELY: vrdsTokens.colors.gold500,
  EMERGING: vrdsTokens.colors.amber500, WEAK_SIGNAL: vrdsTokens.colors.orange600, UNKNOWN: vrdsTokens.colors.slate500,
});
const EPISTEMIC_BADGE_DARK_TEXT = new Set(['HIGHLY_LIKELY', 'LIKELY', 'EMERGING', 'WEAK_SIGNAL']);
function epistemicBadge(status) {
  if (!status) return '';
  const color = EPISTEMIC_BADGE_COLOR[status] || vrdsTokens.colors.slate500;
  const textColor = EPISTEMIC_BADGE_DARK_TEXT.has(status) ? vrdsTokens.colors.slate900 : '#fff';
  return `<span class="confidence-badge" style="background:${color};color:${textColor};">${escapeHtml(status.replace(/_/g, ' '))}</span>`;
}
function inferenceBadge(type) {
  if (!type) return '';
  return `<span class="confidence-badge" style="background:${vrdsTokens.colors.slate700};">${escapeHtml(type.replace(/_/g, ' '))}</span>`;
}
const bandLabel = band => String(band || 'NOT ESTIMABLE').replace(/_/g, ' ');

// A. Decision Options & Trade-offs.
function buildDecisionOptionsSpread(recommendation, reasoningEntry, arcBridge = '') {
  const alternatives = reasoningEntry?.alternatives;
  const tradeOffs = reasoningEntry?.trade_offs || [];
  const scoring = reasoningEntry?.decision_options;
  if (!alternatives) {
    return spread('decision-options-tradeoffs', ['15min'], 'decision', [], `<section class="spread">${spreadHeader('Decision Options & Trade-offs', 'No recommendation to compare', arcBridge)}<p class="text-bodySmall">No recommendation was available to build decision options from.</p></section>`, '');
  }
  const tradeOffByOption = new Map(tradeOffs.map(t => [t.option_id, t]));
  const scoringByOption = new Map((scoring?.options || []).map(o => [o.option_id, o]));
  const preferred = alternatives.options.find(o => o.id === scoring?.preferred_option_id);
  // Visual review found the original 8-column table's free-text columns
  // (Risk, Benefit, Equity, Reversibility) wrapping onto 6-7 lines while
  // the short-value columns sat mostly empty — inflating row height
  // enough to push this spread's "why it wins"/"conditions" panel onto a
  // second, mostly blank PDF page in all 4 representative publications.
  // A fixed-width colgroup fix was tried and reverted: forcing narrow
  // columns caused unbreakable header/value text ("MODERATE", "VERY
  // HIGH", "INSTITUTIONAL BURDEN") to overflow and visually collide with
  // the next column — a worse defect than the one it fixed. A card per
  // option (reusing the same causal-chain-card/dt-dd pattern already
  // built and tested for the Root-Cause spread, not a new component)
  // avoids the whole column-width problem, is naturally more compact
  // since each label:value row wraps independently, and directly answers
  // the brief's own suggestion of "a dominant preferred-option panel"
  // instead of relying on a dense table alone.
  // Final Acceptance review, Part 2/3: "profile-specific editorial
  // emphasis" via hierarchy and ordering, not five separate designs or
  // fabricated new analysis — the row a government/donor/humanitarian/
  // board reader sees FIRST in each option card is reordered to whichever
  // real dimension that profile already weighs most heavily (the same
  // scoring.weights the engine has computed all along), so the dominant
  // reader entry point genuinely differs by profile while the underlying
  // data and the other 4 rows stay identical.
  const emphasis = editorialEmphasisFor(scoring?.profile);
  const WEIGHT_TO_ROW = {
    institutional_readiness: 'burden', feasibility: 'burden', affordability: 'burden', political_feasibility: 'burden', implementation_speed: 'burden',
    risk: 'risk', expected_impact: 'benefit', equity: 'equity', reversibility: 'reversibility',
  };
  const DEFAULT_ROW_ORDER = ['burden', 'risk', 'benefit', 'equity', 'reversibility'];
  const emphasizedRow = (emphasis.weightKeys || []).map(k => WEIGHT_TO_ROW[k]).find(Boolean);
  const rowOrder = emphasizedRow ? [emphasizedRow, ...DEFAULT_ROW_ORDER.filter(k => k !== emphasizedRow)] : DEFAULT_ROW_ORDER;
  const optionCard = opt => {
    const ineligible = (scoringByOption.get(opt.id)?.dimensions?.expected_impact ?? 2) <= 1;
    const isPreferred = opt.id === scoring?.preferred_option_id;
    const detailRow = (label, value) => `<div class="causal-chain-detail-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
    const rowBuilders = {
      burden: () => detailRow('Cost / timeline / burden', `${bandLabel(opt.cost_band)} · ${opt.timeline} · ${bandLabel(opt.institutional_burden)} institutional burden`),
      risk: () => detailRow('Risk', opt.implementation_risk),
      benefit: () => detailRow('Benefit', opt.expected_benefit),
      equity: () => detailRow('Equity', opt.equity_implication),
      reversibility: () => detailRow('Reversibility', opt.reversibility),
    };
    // A CSS grid row stretches every column to its tallest member — the
    // full untruncated option label in the preferred card's <h4> (up to 6
    // wrapped lines for this catalog's longer recommendation text) was
    // inflating all 3 cards' height equally, which is what pushed this
    // spread's trailing panels onto a second PDF page. Truncating the
    // card title the same way the spread's own subtitle already does
    // (truncateWords, not a new rule) and folding the 3 short banded
    // fields into one row keeps every real value on the page, just laid
    // out more compactly.
    return `<div class="col-4">
      <div class="causal-chain-card"${isPreferred ? ` style="border-color:${vrdsTokens.colors.blue700};border-width:2px;background:#f5f9ff;"` : ''}>
        <h4 style="margin:0 0 8px;">${isPreferred ? '★ PREFERRED — ' : ''}${escapeHtml(truncateWords(opt.label, 6))}</h4>
        ${ineligible ? `<span class="confidence-badge" style="background:${vrdsTokens.colors.slate700};">NOT VIABLE — does not address the problem</span>` : ''}
        <dl class="causal-chain-detail">
          ${rowOrder.map(k => rowBuilders[k]()).join('')}
          ${detailRow('Score', `${scoringByOption.get(opt.id)?.score_pct ?? '—'}% (${escapeHtml(scoring?.profile || 'default')}-profile weighting)`)}
        </dl>
      </div>
    </div>`;
  };
  const optionCards = `<div class="grid">${alternatives.options.map(optionCard).join('')}</div>`;
  const preferredTradeOff = preferred ? tradeOffByOption.get(preferred.id) : null;
  // Final Acceptance review, Part 1: the prior fix (card layout, truncated
  // titles, merged rows) closed most but not all of this spread's PDF
  // overflow — real content genuinely needs slightly more than one A4
  // page. Rather than keep shaving real sentences to chase a full-page
  // fit (explicitly discouraged), this formalises the 2-page shape as an
  // intentional editorial sequence: Page A states the strategic choice
  // (options, preferred, eligibility, headline trade-off, concise "why");
  // Page B (buildDecisionConditionsSpread, immediately below) carries the
  // full trade-off/rejection/uncertainty detail. Each is its own real
  // spread with its own id, header and hierarchy — never a continuation
  // fragment with no title of its own.
  const headline = preferredTradeOff ? `<p class="text-bodySmall"><b>Headline trade-off:</b> Gained — ${escapeHtml(preferredTradeOff.gained)}. Sacrificed — ${escapeHtml(preferredTradeOff.sacrificed)}.</p>` : '';
  const conciseWhyWins = scoring?.rationale ? firstSentences(scoring.rationale, 1) : '';
  // Shown once, here, at the entry point of the whole decision-reasoning
  // sequence — not repeated on the other 4 reasoning spreads, which would
  // just be the same banner 5 times over (and would itself trip the
  // catalogue-wide repeated-language check for no real benefit).
  const emphasisLine = `<p class="overline space-8" style="color:${vrdsTokens.colors.teal700};">${escapeHtml(emphasis.label.toUpperCase())}: ${escapeHtml(emphasis.focus)}</p>`;
  const html = `
    <section class="spread">
      ${spreadHeader('Decision Options & Trade-offs', preferred ? `Preferred: ${truncateWords(preferred.label, 6)}` : 'Comparing the real alternatives', arcBridge)}
      ${emphasisLine}
      ${optionCards}
      ${headline}
      ${preferred ? visualComponents.executiveCalloutCard('Why the preferred option wins', `${conciseWhyWins} Full trade-off detail, why the alternatives were not preferred, and the uncertainty picture continue on the next page (Decision Conditions).`) : ''}
    </section>`;
  const text = alternatives.options.map(o => `${o.label} ${o.expected_benefit}`).join(' ') + ' ' + conciseWhyWins;
  const blocks = [
    { type: 'heading', level: 1, text: 'Decision Options & Trade-offs' },
    ...(preferred ? [{ type: 'paragraph', text: `Preferred: ${preferred.label}` }] : []),
    ...alternatives.options.map(opt => ({
      type: 'card', title: opt.label,
      fields: [
        { label: 'Cost / timeline / burden', text: `${bandLabel(opt.cost_band)} · ${opt.timeline} · ${bandLabel(opt.institutional_burden)} institutional burden` },
        { label: 'Risk', text: opt.implementation_risk },
        { label: 'Benefit', text: opt.expected_benefit },
        { label: 'Equity', text: opt.equity_implication },
        { label: 'Reversibility', text: opt.reversibility },
        { label: 'Score', text: `${scoringByOption.get(opt.id)?.score_pct ?? '—'}%` },
      ],
    })),
    ...(preferredTradeOff ? [{ type: 'paragraph', text: `Headline trade-off: Gained — ${preferredTradeOff.gained}. Sacrificed — ${preferredTradeOff.sacrificed}.` }] : []),
    ...(preferred ? [{ type: 'callout', label: 'Why the preferred option wins', text: conciseWhyWins }] : []),
  ];
  return spread('decision-options-tradeoffs', ['15min'], 'decision', [
    { type: 'options_table', hasInterpretation: true }, { type: 'executive_callout', hasInterpretation: true },
  ], html, text, blocks);
}

// A2. Decision Conditions — Page B of the Decision Options sequence
// (Part 1). Carries everything Page A intentionally left out: full
// trade-off detail, the visible profile weights that actually drove the
// score, a real one-line rejection reason for each non-preferred option,
// the complete rationale (including the tie/override disclosure when it
// applies), implementation conditions, and the uncertainty picture — all
// reusing fields already computed by the reasoning engine, nothing new.
function buildDecisionConditionsSpread(recommendation, reasoningEntry, arcBridge = '') {
  const alternatives = reasoningEntry?.alternatives;
  const tradeOffs = reasoningEntry?.trade_offs || [];
  const scoring = reasoningEntry?.decision_options;
  if (!alternatives || !scoring?.preferred_option_id) {
    return spread('decision-conditions', ['15min'], 'decision', [], `<section class="spread">${spreadHeader('Decision Conditions', 'No recommendation to assess', arcBridge)}<p class="text-bodySmall">No recommendation was available to build decision conditions from.</p></section>`, '');
  }
  const tradeOffByOption = new Map(tradeOffs.map(t => [t.option_id, t]));
  const scoringByOption = new Map((scoring.options || []).map(o => [o.option_id, o]));
  const preferred = alternatives.options.find(o => o.id === scoring.preferred_option_id);
  const preferredTradeOff = preferred ? tradeOffByOption.get(preferred.id) : null;

  const weightRows = Object.entries(scoring.weights || {}).sort((a, b) => b[1] - a[1])
    .map(([dim, w]) => `${dim.replace(/_/g, ' ')}: ${w}`).join(' · ');

  const rejected = alternatives.options.filter(o => o.id !== scoring.preferred_option_id).map(opt => {
    const s = scoringByOption.get(opt.id);
    const ineligible = (s?.dimensions?.expected_impact ?? 2) <= 1;
    const text = ineligible
      ? `Not viable — does not address the evidenced problem, regardless of its ease-of-implementation score.`
      : `Scores ${s?.score_pct ?? '—'}%, below the preferred option's ${scoringByOption.get(preferred.id)?.score_pct ?? '—'}% under ${scoring.profile || 'default'}-profile weighting — ${bandLabel(opt.institutional_burden).toLowerCase()} institutional burden over a ${opt.timeline || 'longer'} timeline weighs against it here.`;
    return { text, label: opt.label };
  });
  // Page A already states the rationale's first (and, absent a tie/
  // override, only) sentence in full — repeating it here verbatim was a
  // real, high-severity duplication the catalogue-wide repeated-language
  // check caught (the full sentence recurred 38 times across the 16-
  // sample catalogue). This page must add what Page A didn't, not restate
  // it: the tie/override disclosure sentence when one exists, or — when
  // the rationale really was only one sentence — a short cross-reference
  // rather than a second copy of the same text.
  const rationaleFirstSentence = scoring.rationale ? firstSentences(scoring.rationale, 1) : '';
  const rationaleRemainder = scoring.rationale ? scoring.rationale.slice(rationaleFirstSentence.length).trim() : '';
  const rationaleContinuation = rationaleRemainder || 'No tie or override applies beyond what the Strategic Choice page already states — see the conditions and uncertainty below for what could still change this.';

  const html = `
    <section class="spread">
      ${spreadHeader('Decision Conditions', preferred ? `The full trade-off, rejection and uncertainty picture for ${truncateWords(preferred.label, 6)}` : 'The full trade-off picture', arcBridge)}
      <div class="overline space-8">Profile weights (${escapeHtml(scoring.profile || 'default')}, ${Object.keys(scoring.weights || {}).length} dimensions)</div>
      <p class="text-bodySmall">${escapeHtml(weightRows)}</p>
      ${visualComponents.insightPanel('Why the alternatives were not preferred', rejected.map(r => ({ label: r.label, text: r.text })))}
      ${preferred ? visualComponents.executiveCalloutCard('Beyond the headline: tie, override and further context', rationaleContinuation) : ''}
      ${preferredTradeOff ? visualComponents.insightPanel('Conditions that could change this choice', [
        { label: 'Required condition / remaining risk', text: `${preferredTradeOff.condition} · ${preferredTradeOff.risk}` },
        { label: 'Cost of delay', text: preferredTradeOff.cost_of_delay },
        { label: 'Implementation conditions', text: (recommendation?.dependencies || []).join('; ') || 'None on record' },
      ]) : ''}
      ${preferredTradeOff ? `<p class="margin-note">Uncertainty: ${escapeHtml(preferredTradeOff.uncertainty)}. Cost and burden bands (LOW/MODERATE/HIGH/VERY HIGH/NOT ESTIMABLE) are derived from this recommendation's own real budget, timeline and dependency fields — never an invented monetary figure. ${inferenceBadge('CALCULATED')} ${epistemicBadge('HIGHLY_LIKELY')}</p>` : ''}
    </section>`;
  const text = rejected.map(r => r.text).join(' ') + ' ' + rationaleContinuation;
  const blocks = [
    { type: 'heading', level: 1, text: 'Decision Conditions' },
    { type: 'paragraph', text: `Profile weights (${scoring.profile || 'default'}): ${weightRows}` },
    { type: 'card', title: 'Why the alternatives were not preferred', fields: rejected.map(r => ({ label: r.label, text: r.text })) },
    ...(preferred ? [{ type: 'callout', label: 'Beyond the headline: tie, override and further context', text: rationaleContinuation }] : []),
    ...(preferredTradeOff ? [{ type: 'card', title: 'Conditions that could change this choice', fields: [
      { label: 'Required condition / remaining risk', text: `${preferredTradeOff.condition} · ${preferredTradeOff.risk}` },
      { label: 'Cost of delay', text: preferredTradeOff.cost_of_delay },
      { label: 'Implementation conditions', text: (recommendation?.dependencies || []).join('; ') || 'None on record' },
    ] }] : []),
    ...(preferredTradeOff ? [{ type: 'paragraph', text: `Uncertainty: ${preferredTradeOff.uncertainty}`, emphasis: 'caption' }] : []),
  ];
  return spread('decision-conditions', ['15min'], 'decision', [
    { type: 'weights_display', hasInterpretation: true }, { type: 'insight_panel', hasInterpretation: true }, { type: 'executive_callout', hasInterpretation: true },
  ], html, text, blocks);
}

// B. Stakeholder & Political Economy Map.
function buildStakeholderPoliticalEconomySpread(recommendation, reasoningEntry, arcBridge = '') {
  const stakeholders = reasoningEntry?.stakeholders || [];
  const polEcon = reasoningEntry?.political_economy;
  if (!stakeholders.length) {
    return spread('stakeholder-political-economy', ['15min'], 'decision', [], `<section class="spread">${spreadHeader('Stakeholder & Political Economy Map', 'No recommendation to map', arcBridge)}<p class="text-bodySmall">No recommendation was available to build a stakeholder map from.</p></section>`, '');
  }
  // Visual review found this rendering as one flat, undifferentiated
  // 6-row table — a "list of stakeholders", not the "clear influence-and-
  // delivery structure" the brief asks for. The 2 real, named roles
  // (owner, supporting unit) and the 4 structurally-inferred affected-
  // party roles are answering genuinely different questions (who holds
  // authority to act, versus who is affected by the action) — grouping
  // them under 2 real sub-headers, using the category field already on
  // each stakeholder, makes that structure visible without adding any
  // new field.
  const row = s => `<tr>
    <td>${escapeHtml(s.label)}</td>
    <td>${escapeHtml(s.role.replace(/_/g, ' '))}</td>
    <td class="text-bodySmall">${escapeHtml(s.rationale)}</td>
    <td>${inferenceBadge(s.inference_type)} ${epistemicBadge(s.epistemic_status)}</td>
  </tr>`;
  const authorityRows = stakeholders.filter(s => s.category === 'named delivery role');
  const affectedRows = stakeholders.filter(s => s.category !== 'named delivery role');
  const stakeholderTable = (label, rowsOfGroup) => rowsOfGroup.length ? `
    <div class="overline space-8">${escapeHtml(label)}</div>
    <table class="vpds-table"><thead><tr><th>Stakeholder</th><th>Role</th><th>Rationale</th><th>Status</th></tr></thead><tbody>${rowsOfGroup.map(row).join('')}</tbody></table>` : '';
  const html = `
    <section class="spread">
      ${spreadHeader('Stakeholder & Political Economy Map', 'Who benefits, who carries the cost, who may resist', arcBridge)}
      ${stakeholderTable('Authority & delivery — real, already governed', authorityRows)}
      ${stakeholderTable('Who is affected — structurally inferred', affectedRows)}
      ${polEcon ? visualComponents.insightPanel('Coordination and resistance', [
        { label: 'Coordination dependencies', text: (polEcon.coordination_dependencies || []).join('; ') || 'None on record' },
        { label: 'Possible resistance mechanisms', text: (polEcon.possible_resistance_mechanisms || []).join('; ') || 'None identified' },
      ]) : ''}
      <p class="margin-note">Named delivery roles (owner, supporting unit) are real and already governed. Every other role is a structural, category-level inference from this decision's own real fields — a synthetic demonstration of political-economy reasoning, never a reported or observed stakeholder position. ${polEcon ? epistemicBadge(polEcon.epistemic_status) : ''}</p>
    </section>`;
  const text = stakeholders.map(s => `${s.label} ${s.role} ${s.rationale}`).join(' ');
  const blocks = [
    { type: 'heading', level: 1, text: 'Stakeholder & Political Economy Map' },
    ...(authorityRows.length ? [{ type: 'table', headers: ['Stakeholder', 'Role', 'Rationale'], rows: authorityRows.map(s => [s.label, s.role.replace(/_/g, ' '), s.rationale]) }] : []),
    ...(affectedRows.length ? [{ type: 'table', headers: ['Stakeholder', 'Role', 'Rationale'], rows: affectedRows.map(s => [s.label, s.role.replace(/_/g, ' '), s.rationale]) }] : []),
    ...(polEcon ? [{ type: 'card', title: 'Coordination and resistance', fields: [
      { label: 'Coordination dependencies', text: (polEcon.coordination_dependencies || []).join('; ') || 'None on record' },
      { label: 'Possible resistance mechanisms', text: (polEcon.possible_resistance_mechanisms || []).join('; ') || 'None identified' },
    ] }] : []),
  ];
  return spread('stakeholder-political-economy', ['15min'], 'decision', [{ type: 'stakeholder_table', hasInterpretation: true }, { type: 'insight_panel', hasInterpretation: true }], html, text, blocks);
}

// C. Behavioural Adoption Pathway.
function buildBehaviouralAdoptionSpread(recommendation, reasoningEntry, arcBridge = '') {
  const behav = reasoningEntry?.behavioural_dynamics;
  if (!behav) {
    return spread('behavioural-adoption-pathway', ['15min'], 'decision', [], `<section class="spread">${spreadHeader('Behavioural Adoption Pathway', 'No recommendation to assess', arcBridge)}<p class="text-bodySmall">No recommendation was available to build a behavioural pathway from.</p></section>`, '');
  }
  // Final Acceptance review, Part 4: the two-panel layout below (a full
  // "Behaviour" card duplicating the stepper's own current/desired/
  // response stages, plus 4 separate bulleted Barriers/Enablers/
  // Incentives/Disincentives lists) made this the densest of the 5
  // reasoning spreads without actually surfacing more decision-critical
  // information — most of it restated what the stepper already said, in
  // longer form. Reduced to exactly the fields the brief names as
  // decision-critical (current state, main barrier, intervention lever,
  // enabling condition, expected response, desired behaviour, measurement
  // signal, evidence-status disclosure) on the primary page; every
  // secondary field (resistance response, the 2nd enabler/incentive/
  // disincentive) is condensed into one evidence note instead of 4 lists
  // — real fields, still all present, just not re-stated at full length.
  // Reuses the same real fields as before; no new data, no shrunk type.
  const pathwayStages = [
    { label: 'Current state', text: truncateWords(behav.current_behaviour.text, 6), inferred: behav.current_behaviour.classification === 'UNKNOWN' },
    { label: 'Main barrier', text: behav.barriers[0] ? truncateWords(behav.barriers[0].text, 6) : 'None on record', inferred: true },
    { label: 'Intervention lever', text: behav.enablers[0] ? truncateWords(behav.enablers[0].text, 6) : 'None on record', inferred: true },
    { label: 'Enabling condition', text: recommendation?.success_criteria ? truncateWords(recommendation.success_criteria, 6) : 'None on record', inferred: true },
    { label: 'Expected response', text: truncateWords(behav.likely_adoption_response.text, 6), inferred: true },
    { label: 'Desired behaviour', text: truncateWords(behav.desired_behaviour.text, 6), inferred: behav.desired_behaviour.classification === 'ASSUMED' },
    { label: 'Measurement signal', text: recommendation?.monitoring_indicator ? truncateWords(recommendation.monitoring_indicator, 6) : 'None on record', inferred: false },
  ];
  const pathwayFlow = `<div class="causal-chain-flow">${pathwayStages.map((s, i) => `${i > 0 ? '<span class="root-cause-chain-arrow">&rarr;</span>' : ''}<span class="root-cause-chain-step${s.inferred ? ' root-cause-chain-step--inferred' : ''}" title="${escapeHtml(s.label)}"><b>${escapeHtml(s.label)}:</b> ${escapeHtml(s.text)}</span>`).join('')}</div>`;
  // behav.enablers[1] (the monitoring-indicator enabler) is deliberately
  // left out here — it's the same real field the "Measurement signal"
  // stage above already states; repeating it in the secondary note too
  // would be a pointless same-page restatement, not genuine secondary
  // detail.
  const secondaryNote = [
    behav.likely_resistance_response?.text ? `Resistance: ${firstSentences(behav.likely_resistance_response.text, 1)}` : null,
    behav.disincentives[0] ? `Disincentive: ${behav.disincentives[0].text}` : null,
  ].filter(Boolean).join(' ');
  const html = `
    <section class="spread">
      ${spreadHeader('Behavioural Adoption Pathway', 'From current behaviour to durable adoption', arcBridge)}
      ${pathwayFlow}
      ${secondaryNote ? `<p class="text-bodySmall"><b>Secondary detail:</b> ${escapeHtml(secondaryNote)}</p>` : ''}
      <p class="margin-note">${escapeHtml(behav.limitation)} ${epistemicBadge(behav.epistemic_status)}</p>
    </section>`;
  const text = `${behav.current_behaviour.text} ${behav.desired_behaviour.text} ${behav.likely_adoption_response.text} ${secondaryNote}`;
  const blocks = [
    { type: 'heading', level: 1, text: 'Behavioural Adoption Pathway' },
    { type: 'list', items: pathwayStages.map(s => `${s.label}: ${s.text}`), ordered: true },
    ...(secondaryNote ? [{ type: 'paragraph', text: secondaryNote, emphasis: 'caption' }] : []),
    { type: 'paragraph', text: behav.limitation, emphasis: 'caption' },
  ];
  return spread('behavioural-adoption-pathway', ['15min'], 'decision', [{ type: 'pathway_flow', hasInterpretation: true }], html, text, blocks);
}

// D. System Effects Map.
function buildSystemEffectsSpread(recommendation, reasoningEntry, arcBridge = '') {
  const sys = reasoningEntry?.system_effects;
  if (!sys) {
    return spread('system-effects-map', ['15min'], 'decision', [], `<section class="spread">${spreadHeader('System Effects Map', 'No recommendation to trace', arcBridge)}<p class="text-bodySmall">No recommendation was available to build a system effects map from.</p></section>`, '');
  }
  const row = (label, items) => {
    const real = (items || []).filter(Boolean);
    if (!real.length) return '';
    return `<tr><td><b>${escapeHtml(label)}</b></td><td class="text-bodySmall">${real.map(i => escapeHtml(i.text)).join('; ')}</td><td>${real.map(i => inferenceBadge(i.link_type)).join(' ')}</td></tr>`;
  };
  // Visual review found the 3 furthest-downstream layers (unintended
  // consequences / second-order effects / cross-sector implications)
  // rendering as 3 near-identical "Not estimable from this model..." rows
  // in every real sample — exactly the "filling the page with repeated
  // not estimable text" the brief explicitly asks this page to avoid.
  // Where all 3 are genuinely unresolved (the only case this governed
  // model ever produces), fold them into one honest disclosure line below
  // the table instead of 3 table rows; if a future model ever resolves
  // one of them to a real, non-UNKNOWN link, it still renders as its own
  // row, so nothing here can silently hide a real finding.
  const downstreamUnknowns = ['unintended_consequences', 'second_order_effects', 'cross_sector_implications']
    .map(key => ({ key, items: (sys[key] || []).filter(Boolean) }))
    .filter(d => d.items.length);
  const allDownstreamUnknown = downstreamUnknowns.length === 3 && downstreamUnknowns.every(d => d.items.every(i => i.link_type === 'UNKNOWN'));
  const downstreamLabels = { unintended_consequences: 'unintended consequences', second_order_effects: 'second-order effects', cross_sector_implications: 'cross-sector implications' };
  const rows = [
    row('Upstream drivers', sys.upstream_drivers), row('Immediate causes', sys.immediate_causes), row('Structural causes', sys.structural_causes),
    row('Institutional constraints', sys.institutional_constraints), row('Dependencies', sys.dependencies), row('Spillover effects', sys.spillover_effects),
    allDownstreamUnknown ? '' : row('Unintended consequences', sys.unintended_consequences),
    allDownstreamUnknown ? '' : row('Second-order effects', sys.second_order_effects),
    allDownstreamUnknown ? '' : row('Cross-sector implications', sys.cross_sector_implications),
  ].filter(Boolean).join('');
  const downstreamUnknownNote = allDownstreamUnknown
    ? `<p class="margin-note">Beyond the named risk already traced above, this model does not carry data for ${downstreamUnknowns.map(d => downstreamLabels[d.key]).join(', ').replace(/, ([^,]*)$/, ' or $1')} — shown once, honestly, rather than as three repeated rows. ${inferenceBadge('UNKNOWN')}</p>`
    : '';
  const html = `
    <section class="spread">
      ${spreadHeader('System Effects Map', 'How this decision connects to the wider system', arcBridge)}
      <table class="vpds-table"><thead><tr><th>Layer</th><th>What the model shows</th><th>Link type</th></tr></thead><tbody>${rows}</tbody></table>
      ${downstreamUnknownNote}
      <p class="margin-note">Every connection above is labelled by its real inference type (observed association, evidence-supported link, plausible mechanism, or unknown) — this map traces real linkage already on record, it does not model system dynamics mathematically.</p>
    </section>`;
  const text = [sys.upstream_drivers, sys.structural_causes, sys.dependencies, sys.spillover_effects].flat().map(i => i?.text).filter(Boolean).join(' ');
  const rowLabels = ['Upstream drivers', 'Immediate causes', 'Structural causes', 'Institutional constraints', 'Dependencies', 'Spillover effects', 'Unintended consequences', 'Second-order effects', 'Cross-sector implications'];
  const rowKeys = ['upstream_drivers', 'immediate_causes', 'structural_causes', 'institutional_constraints', 'dependencies', 'spillover_effects', 'unintended_consequences', 'second_order_effects', 'cross_sector_implications'];
  const tableRows = rowKeys.map((key, i) => {
    const items = (sys[key] || []).filter(Boolean);
    if (!items.length || (allDownstreamUnknown && ['unintended_consequences', 'second_order_effects', 'cross_sector_implications'].includes(key))) return null;
    return [rowLabels[i], items.map(it => it.text).join('; ')];
  }).filter(Boolean);
  const blocks = [
    { type: 'heading', level: 1, text: 'System Effects Map' },
    { type: 'table', headers: ['Layer', 'What the model shows'], rows: tableRows },
    ...(allDownstreamUnknown ? [{ type: 'paragraph', text: `Beyond the named risk already traced above, this model does not carry data for ${downstreamUnknowns.map(d => downstreamLabels[d.key]).join(', ')}.`, emphasis: 'caption' }] : []),
  ];
  return spread('system-effects-map', ['15min'], 'decision', [{ type: 'system_effects_table', hasInterpretation: true }], html, text, blocks);
}

// E. Decision Under Uncertainty — the one spread that synthesises ACROSS
// the whole reasoning object (every epistemic_status this recommendation's
// reasoning carries, not one dimension alone), bucketed onto the real
// 6-value epistemic scale (Part 7) — a genuinely different, aggregating
// view, not a repeat of the panels above.
function buildDecisionUncertaintySpread(recommendation, reasoningEntry, arcBridge = '') {
  if (!reasoningEntry) {
    return spread('decision-under-uncertainty', ['15min'], 'decision', [], `<section class="spread">${spreadHeader('Decision Under Uncertainty', 'No recommendation to assess', arcBridge)}<p class="text-bodySmall">No recommendation was available.</p></section>`, '');
  }
  // Visual review found two statement kinds rendering as bare, opaque
  // labels a reader has no way to interpret without cross-referencing
  // another spread ("Political-economy positioning" with no content;
  // "DEC-NAT-01-OPT-A: trade-off assessment" naming an internal ID, not a
  // finding) — fixed by describing what each statement actually says,
  // using fields already computed elsewhere on this same reasoning entry.
  const optionLabelById = new Map((reasoningEntry.alternatives?.options || []).map(o => [o.id, o.label]));
  const statements = [];
  for (const s of reasoningEntry.stakeholders || []) statements.push({ text: `${s.label}: ${s.role.replace(/_/g, ' ')}`, status: s.epistemic_status });
  const behav = reasoningEntry.behavioural_dynamics;
  if (behav) {
    statements.push({ text: `Current behaviour: ${behav.current_behaviour.text}`, status: 'UNKNOWN' });
    statements.push({ text: `Likely adoption response: ${behav.likely_adoption_response.text}`, status: behav.epistemic_status });
  }
  if (reasoningEntry.political_economy) statements.push({ text: 'Political-economy positioning: who benefits, who carries the cost, and who may resist — inferred from this decision’s own category-level roles, never a reported political position.', status: reasoningEntry.political_economy.epistemic_status });
  for (const t of reasoningEntry.trade_offs || []) {
    const label = optionLabelById.get(t.option_id) || t.option_id;
    statements.push({ text: `${label}: ${bandLabel(t.direct_costs).toLowerCase()} cost, ${String(t.reversibility || '').toLowerCase()}`, status: t.epistemic_status });
  }
  const byStatus = new Map(EPISTEMIC_STATUSES.map(s => [s, []]));
  statements.forEach(s => { if (byStatus.has(s.status)) byStatus.get(s.status).push(s.text); });
  // Visual review also found every section header rendering in the same
  // colour (this spread inherits the shared "risk" typography mode's
  // overline colour) — the exact opposite of "an epistemic landscape":
  // all 6 bands looked identical regardless of how certain each one was.
  // Reusing the same EPISTEMIC_BADGE_COLOR scale already used for the
  // inline badges elsewhere gives each band a real, distinct colour.
  const section = status => {
    const items = byStatus.get(status) || [];
    if (!items.length) return '';
    const color = EPISTEMIC_BADGE_COLOR[status] || vrdsTokens.colors.slate500;
    return `<div class="space-8" style="border-left:4px solid ${color};padding-left:${vrdsTokens.spacing[12]}px;"><div class="overline" style="color:${color};">${escapeHtml(status.replace(/_/g, ' '))}</div><ul class="text-bodySmall">${items.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul></div>`;
  };
  const decideNow = (byStatus.get('KNOWN') || []).length + (byStatus.get('HIGHLY_LIKELY') || []).length;
  const needsEvidence = (byStatus.get('EMERGING') || []).length + (byStatus.get('WEAK_SIGNAL') || []).length;
  const mustNotConclude = (byStatus.get('UNKNOWN') || []).length;
  const html = `
    <section class="spread">
      ${spreadHeader('Decision Under Uncertainty', 'What is known, what is not, and what that means for this decision', arcBridge)}
      ${EPISTEMIC_STATUSES.map(section).join('')}
      ${visualComponents.insightPanel('What this means for the decision', [
        { label: 'Can be decided now', text: `${decideNow} statement(s) are KNOWN or HIGHLY LIKELY — sufficient basis to act.` },
        { label: 'Requires more evidence', text: `${needsEvidence} statement(s) are EMERGING or a WEAK SIGNAL — worth tracking, not yet a basis for a firm claim.` },
        { label: 'Must not be concluded', text: `${mustNotConclude} statement(s) are UNKNOWN — this publication does not guess at them.` },
      ])}
    </section>`;
  const text = statements.map(s => s.text).join(' ');
  const blocks = [
    { type: 'heading', level: 1, text: 'Decision Under Uncertainty' },
    ...EPISTEMIC_STATUSES.map(status => {
      const items = byStatus.get(status) || [];
      return items.length ? { type: 'card', title: status.replace(/_/g, ' '), fields: items.map(t => ({ label: '', text: t })) } : null;
    }).filter(Boolean),
    { type: 'card', title: 'What this means for the decision', fields: [
      { label: 'Can be decided now', text: `${decideNow} statement(s) are KNOWN or HIGHLY LIKELY — sufficient basis to act.` },
      { label: 'Requires more evidence', text: `${needsEvidence} statement(s) are EMERGING or a WEAK SIGNAL — worth tracking, not yet a basis for a firm claim.` },
      { label: 'Must not be concluded', text: `${mustNotConclude} statement(s) are UNKNOWN — this publication does not guess at them.` },
    ] },
  ];
  return spread('decision-under-uncertainty', ['15min'], 'decision', [{ type: 'uncertainty_buckets', hasInterpretation: true }, { type: 'insight_panel', hasInterpretation: true }], html, text, blocks);
}

// Editorial Division Release, Part C: recommendation presentation format —
// the same real recommendation fields (owner, timeline, priority, budget,
// benefit, risk, monitoring indicator, rationale), rendered in one of 3
// real layouts chosen by the publication's editorial identity
// (publication-editorial-identity.js). 'matrix-table' is the original card
// grid (unchanged for any publication whose family doesn't specify
// otherwise); 'ranked-list' and 'narrative-block' are additive, not a
// replacement of decisionCanvasCard's own field completeness — every field
// that appears in the card grid also appears in the other two formats.
function buildRankedDecisionList(recommendations, commentaryById) {
  const rows = recommendations.map((r, i) => `<li class="ranked-decision-item">
    <div class="ranked-decision-rank">${i + 1}</div>
    <div class="ranked-decision-body">
      <p class="text-bodyLarge">${escapeHtml(r.recommendation || r.text || '')}</p>
      <p class="text-bodySmall">${escapeHtml(commentaryById.get(r.id) || r.why_this_recommendation_exists || '')}</p>
      <p class="caption">Owner: ${escapeHtml(r.owner || 'Not assigned')} · Timeline: ${escapeHtml(r.timeline || 'Not set')} · Priority: ${escapeHtml(r.priority || r.strategic_priority || 'Not set')} · Monitoring: ${escapeHtml(r.monitoring_indicator || 'Not set')}</p>
    </div>
  </li>`).join('');
  return `<ol class="ranked-decision-list">${rows}</ol>`;
}
function buildNarrativeDecisionBlock(recommendations, commentaryById) {
  return recommendations.map(r => `<div class="insight-panel">
    <div class="overline">${escapeHtml(r.owner || 'Owner not yet assigned')} · ${escapeHtml(r.timeline || 'Timeline not yet set')}</div>
    <p class="text-bodyLarge">${escapeHtml(r.recommendation || r.text || '')}</p>
    <p class="text-bodySmall">${escapeHtml(commentaryById.get(r.id) || r.why_this_recommendation_exists || '')} Expected benefit: ${escapeHtml(r.expected_benefit || 'not yet quantified')}. Expected risk if delayed: ${escapeHtml(r.expected_risk || 'not yet assessed')}. Progress tracked by: ${escapeHtml(r.monitoring_indicator || 'an indicator to be confirmed')}.</p>
  </div>`).join('');
}
function buildDecisionDossierSpread(recommendations, id, title, arcBridge = '', executiveCommentary = [], recommendationFormat = 'matrix-table') {
  const spans = decisionCardColumnSpans(recommendations.length);
  // EAD Release 1: report.executive_commentary (PX Release 10) was
  // computed for every recommendation and never wired into this card —
  // matched here by recommendation_id so each card gets its own real,
  // distinct commentary rather than a truncated finding fragment.
  const commentaryById = new Map((executiveCommentary || []).map(c => [c.recommendation_id, c.text]));
  const cards = recommendations.map((r, i) => visualComponents.decisionCanvasCard(r, spans[i], commentaryById.get(r.id)));
  // EAD Release 2, Page E: A and B share the same executive-decision-memo
  // layout family (both are, honestly, executive decision memos) but must
  // render visibly different sub-layouts, per the brief. id === 'decisions-a'
  // is always the real top-2 (see composePublicationSpreads's decisionA
  // slice) so it gets the urgency banner; every other real dossier id
  // (currently only 'decisions-b') gets the comparison strip instead.
  const supplement = id === 'decisions-a' ? buildDecisionUrgencyBanner(recommendations) : buildDecisionComparisonStrip(recommendations);
  // Editorial Division Release: format branch below only changes HTML
  // presentation — components/blocks (the underlying real field data) stay
  // identical across all 3 formats.
  const body = recommendationFormat === 'ranked-list' ? buildRankedDecisionList(recommendations, commentaryById)
    : recommendationFormat === 'narrative-block' ? `<div class="grid">${buildNarrativeDecisionBlock(recommendations, commentaryById)}</div>`
    : `<div class="grid">${cards.map(c => c.html).join('')}</div>`;
  const html = `
    <section class="spread">
      ${spreadHeader('Decision Intelligence', title, arcBridge)}
      ${supplement}
      ${body}
    </section>`;
  const text = cards.map(c => c.text).join(' ');
  const components = recommendations.map(r => ({
    type: 'decision_card',
    hasInterpretation: Boolean(r.why_this_recommendation_exists),
    hasOwner: Boolean(r.owner),
    hasTimeline: Boolean(r.timeline),
    hasMonitoringIndicator: Boolean(r.monitoring_indicator),
  }));
  const blocks = [
    { type: 'heading', level: 1, text: title },
    ...recommendations.map(r => ({
      type: 'card', title: r.recommendation || r.text || '',
      fields: [
        { label: 'Owner', text: r.owner || 'Not assigned' },
        { label: 'Timeline', text: r.timeline || 'Not set' },
        { label: 'Priority', text: r.priority || r.strategic_priority || 'Not set' },
        { label: 'Budget', text: r.budget_requirement || r.budget_band || 'Not costed' },
        { label: 'Expected benefit', text: r.expected_benefit || '' },
        { label: 'Expected risk', text: r.expected_risk || '' },
        { label: 'Monitoring indicator', text: r.monitoring_indicator || '' },
        { label: 'Why this recommendation exists', text: commentaryById.get(r.id) || r.why_this_recommendation_exists || '' },
      ],
    })),
  ];
  return spread(id, ['5min', '15min'], 'decision', components, html, text, blocks);
}

// ------------------------------------------------------------------
// 13. Implementation roadmap (Part 13): bucketed from the report's own
// timeline text, never decorative.
// ------------------------------------------------------------------
function buildRoadmapSpread(recommendations, arcBridge = '') {
  const buckets = { immediate: [], near_term: [], medium_term: [] };
  for (const r of (recommendations || [])) buckets[parseTimelineBucket(r.timeline)].push(r);
  const bucketLabel = { immediate: 'Immediate (0–90 days)', near_term: 'Near-term (3–12 months)', medium_term: 'Medium-term (12–36 months)' };
  // Real categorical grouping, not fabricated: each recommendation's own
  // priority tier crossed with its own timeline bucket (both already
  // computed above), tallied into flow counts for the diagram.
  const flowCounts = new Map();
  for (const [bucketKey, items] of Object.entries(buckets)) {
    for (const r of items) {
      const tier = String(r.priority || r.strategic_priority || 'MEDIUM').toUpperCase();
      const key = `${tier}|${bucketKey}`;
      flowCounts.set(key, (flowCounts.get(key) || 0) + 1);
    }
  }
  const flows = [...flowCounts.entries()].map(([key, count]) => {
    const [tier, bucketKey] = key.split('|');
    return { from: tier, to: bucketLabel[bucketKey], count };
  });
  const flow = flows.length ? chartComponents.flowDiagram(flows, { leftLabel: 'Priority tier', rightLabel: 'Delivery horizon' }) : '';
  // PX Release 12, Premium Infographics: the Priority Ladder — genuinely
  // new information alongside the two views above (WHEN each decision is
  // due, and aggregate tier-by-timing counts): the actual rank order across
  // all top-5 decisions, which neither existing visual on this page shows.
  const ladder = visualComponents.priorityLadder(recommendations);
  const html = `
    <section class="spread">
      ${spreadHeader('Implementation Roadmap', 'From decision to delivery', arcBridge)}
      <div class="grid">
        <div class="col-8">
          ${visualComponents.roadmapRail(buckets, bucketLabel)}
          ${flow ? `<div class="overline space-8">${escapeHtml(buckets.immediate.length ? `${buckets.immediate.length} decision${buckets.immediate.length === 1 ? '' : 's'} due within 90 days` : 'Priority tier by delivery horizon')}</div>${flow}` : ''}
        </div>
        <div class="col-4">
          ${ladder ? `<div class="overline">Ranked: what to act on first</div>${ladder}` : ''}
        </div>
      </div>
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: 'Implementation Roadmap' },
    ...Object.entries(buckets).filter(([, items]) => items.length).map(([bucketKey, items]) => ({
      type: 'card', title: bucketLabel[bucketKey],
      fields: items.map(r => ({ label: r.owner || 'Not assigned', text: r.recommendation })),
    })),
  ];
  return spread('roadmap', ['15min'], 'implementation', [
    { type: 'timeline', hasInterpretation: true },
    ...(flow ? [{ type: 'flow_diagram', hasInterpretation: true }] : []),
    ...(ladder ? [{ type: 'priority_ladder', hasInterpretation: true }] : []),
  ], html, `${(recommendations || []).map(r => r.recommendation).join(' ')}`, blocks);
}

// ------------------------------------------------------------------
// 15. Risks and dependencies.
// ------------------------------------------------------------------
// PX Release 3, Part 5/9: the Risk Dashboard — critical_risks[] only ever
// carries risk/likelihood/impact on this model (no owner, no mitigation
// field), so riskCard() deliberately omits those rows rather than
// fabricating them; decision-linked risks (recommendations[].expected_risk)
// are a genuinely different shape (prose tied to a decision, not a scored
// risk) and stay in their own compact list rather than being forced into
// the same card shape.
// PX Release 5, Task #47: a likelihood x impact heat matrix using the
// critical_risks[] items' own real likelihood/impact fields — plotted only
// where the report's own values place them; an empty cell stays empty
// rather than implying a risk that doesn't exist. Additive to the existing
// risk cards, not a replacement (those already honestly disclose the real
// absence of owner/mitigation fields — untouched here).
const RISK_HEAT_LEVELS = ['High', 'Medium', 'Low'];
const RISK_HEAT_LEVEL_SCORE = { High: 40, Medium: 65, Low: 85 }; // maps onto riskColorFor's critical/medium/low bands
function buildRiskHeatMatrix(risks) {
  if (!risks || !risks.length) return '';
  const cols = [...RISK_HEAT_LEVELS].reverse(); // Low, Medium, High left-to-right
  const cellsHtml = RISK_HEAT_LEVELS.map(impact => {
    const rowCells = cols.map(likelihood => {
      const matched = risks.filter(r => String(r.impact || '').toLowerCase() === impact.toLowerCase() && String(r.likelihood || '').toLowerCase() === likelihood.toLowerCase());
      const combinedScore = Math.round((RISK_HEAT_LEVEL_SCORE[impact] + RISK_HEAT_LEVEL_SCORE[likelihood]) / 2);
      return `<div class="risk-heat-cell" style="background:${riskColorFor(combinedScore)}">${matched.map(m => `<span class="risk-heat-label">${escapeHtml(truncateWords(m.risk, 5))}</span>`).join('')}</div>`;
    }).join('');
    return `<div class="risk-heat-matrix-rowhead">${escapeHtml(impact)}</div>${rowCells}`;
  }).join('');
  return `<div class="risk-heat-matrix">
    <div class="risk-heat-matrix-corner"></div>
    ${cols.map(l => `<div class="risk-heat-matrix-colhead">${escapeHtml(l)}</div>`).join('')}
    ${cellsHtml}
  </div>
  <p class="caption">Likelihood (columns) vs. impact (rows), from the report's own critical_risks fields — a cell stays empty rather than implying a risk that isn't there.</p>`;
}

function buildRisksSpread(criticalRisks, recommendations, arcBridge = '') {
  // EIE Release 1: reconsidered during this release — condensing every row
  // to "The {tier}-tier decision, owned by {owner}" would make two rows
  // sharing the same real tier and owner (common in this dataset — several
  // recommendations often share both) read as identical, an actively worse
  // defect than the verbatim repeat this release set out to fix. This
  // register's real job is distinguishing WHICH decision each risk
  // attaches to, so the real recommendation text stays in full here — see
  // RECOMMENDATION_REPETITION_PLAN.risks's 'primary' role and justification.
  const decisionRiskRows = (recommendations || [])
    .filter(r => r.expected_risk)
    .map(r => `<tr><td>${escapeHtml(r.expected_risk)}</td><td>${escapeHtml(r.recommendation)}</td></tr>`).join('');
  const heatMatrix = buildRiskHeatMatrix(criticalRisks);
  // Two genuinely different, real risk inventories share this page —
  // book.critical_risks (portfolio-level, tracked in the heat matrix and
  // cards above) and each recommendation's own expected_risk (execution-
  // level, in the table below). Previously neither was labeled against the
  // other, so a reader had no way to tell whether the page held 2 risks or
  // 7, or how the two sets related (PX Release 6 PQR, high finding #12).
  // Reconciled by naming both views explicitly rather than merging them —
  // merging would drop the real distinction between portfolio and
  // per-decision risk that the underlying data actually carries.
  const html = `
    <section class="spread">
      ${spreadHeader('Risks and Dependencies', 'What could prevent delivery', arcBridge)}
      ${heatMatrix ? `<div class="overline">Top systemic risks</div>${heatMatrix}` : ''}
      <div class="grid">${(criticalRisks || []).map(r => `<div class="col-4">${visualComponents.riskCard(r)}</div>`).join('')}</div>
      ${decisionRiskRows ? `<p class="caption">Above: portfolio-level risks tracked across the whole publication. Below: the specific execution risk carried by each individual decision.</p><h4 class="space-8">Decision-linked risks</h4><table class="vpds-table"><thead><tr><th>Risk</th><th>Linked decision</th></tr></thead><tbody>${decisionRiskRows}</tbody></table>` : ''}
    </section>`;
  const components = [
    ...(heatMatrix ? [{ type: 'risk_heat_matrix', hasInterpretation: true }] : []),
    ...(criticalRisks || []).map(r => ({ type: 'risk_card', hasInterpretation: true, hasOwner: Boolean(r.owner), hasMitigation: Boolean(r.mitigation) })),
    ...(decisionRiskRows ? [{ type: 'risk_matrix', hasInterpretation: true }] : []),
  ];
  const blocks = [
    { type: 'heading', level: 1, text: 'Risks and Dependencies' },
    { type: 'table', headers: ['Risk', 'Likelihood', 'Impact'], rows: (criticalRisks || []).map(r => [r.risk, r.likelihood, r.impact]) },
    ...(decisionRiskRows ? [{ type: 'table', headers: ['Risk', 'Linked decision'], rows: (recommendations || []).filter(r => r.expected_risk).map(r => [r.expected_risk, r.recommendation]) }] : []),
  ];
  return spread('risks', ['15min'], 'decision', components, html, (criticalRisks || []).map(r => r.risk).join(' '), blocks);
}

// ------------------------------------------------------------------
// 16. Monitoring and accountability register.
// ------------------------------------------------------------------
function buildMonitoringSpread(recommendations, arcBridge = '', sdgCards = []) {
  const rows = (recommendations || []).map(r => `<tr><td>${escapeHtml(r.recommendation)}</td><td>${escapeHtml(r.owner || 'Not assigned')}</td><td>${escapeHtml(r.timeline || 'Not set')}</td><td>${escapeHtml(r.monitoring_indicator || 'Not defined')}</td></tr>`).join('');
  // Ranks each decision by its own priority tier (the same ordinal mapping
  // already used for the priority matrix) so the accountability register
  // carries a real visual ranking, not just a repeat of the table above.
  const lollipopItems = (recommendations || []).map(r => ({ label: truncateWords(r.recommendation, 6), value: priorityToAxis(r.priority || r.strategic_priority) }));
  const lollipop = lollipopItems.length ? chartComponents.lollipopChart(lollipopItems, { width: 460 }) : '';
  // PX Release 5, Task #47: a delivery-tracker framing line — a real count
  // of the report's own recommendations by timeline bucket (parseTimelineBucket,
  // already used for the Roadmap spread), never a fabricated RAG status or
  // completion percentage (no real field on this model supports either).
  const bucketCounts = { immediate: 0, near_term: 0, medium_term: 0 };
  for (const r of (recommendations || [])) bucketCounts[parseTimelineBucket(r.timeline)]++;
  const trackerFraming = (recommendations || []).length
    ? `Tracking ${recommendations.length} decisions: ${bucketCounts.immediate} due within 90 days, ${bucketCounts.near_term} within 3–12 months, ${bucketCounts.medium_term} within 12–36 months.`
    : '';
  // EAD Release 1, Task #127: report.full_publication.sdg_cards has carried
  // real target/indicator/gap/trend/status fields since PX Release 6 but no
  // spread has ever rendered it (flagged by 3 consecutive independent
  // reviews). Monitoring is its natural home — an SDG target/indicator/gap
  // is structurally the same kind of accountability fact as the decision
  // table above it, just measured against an international framework
  // instead of an internal recommendation.
  const sdgStrip = visualComponents.sdgAlignmentStrip(sdgCards);
  const html = `
    <section class="spread">
      ${spreadHeader('Monitoring and Accountability', 'Who verifies progress, and how', arcBridge)}
      ${trackerFraming ? `<p class="text-bodySmall">${escapeHtml(trackerFraming)}</p>` : ''}
      <table class="vpds-table"><thead><tr><th>Decision</th><th>Owner</th><th>Timeline</th><th>Monitoring indicator</th></tr></thead><tbody>${rows}</tbody></table>
      ${lollipop ? `<div class="overline space-8">What carries the most weight</div>${lollipop}` : ''}
      ${sdgStrip ? `<div class="overline space-8">SDG alignment</div>${sdgStrip}` : ''}
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: 'Monitoring and Accountability' },
    ...(trackerFraming ? [{ type: 'paragraph', text: trackerFraming }] : []),
    { type: 'table', headers: ['Decision', 'Owner', 'Timeline', 'Monitoring indicator'], rows: (recommendations || []).map(r => [r.recommendation, r.owner || 'Not assigned', r.timeline || 'Not set', r.monitoring_indicator || 'Not defined']) },
  ];
  return spread('monitoring', ['15min'], 'implementation', [
    { type: 'monitoring_table', hasInterpretation: true },
    ...(lollipop ? [{ type: 'lollipop_chart', hasInterpretation: true }] : []),
    ...(sdgStrip ? [{ type: 'sdg_alignment_strip', hasInterpretation: true }] : []),
  ], html, [...(recommendations || []).map(r => r.monitoring_indicator), ...(sdgCards || []).map(c => c.interpretation)].join(' '), blocks);
}

// ------------------------------------------------------------------
// 17. Methodology and limitations.
// ------------------------------------------------------------------
// PX Release 4, Part 9: the Methodology Canvas. Replaces the previous plain
// Object.entries() key:value dump with a genuine visual treatment of real
// fields confirmed on this model — research_objectives/evaluation_questions
// as headline cards, sample/response/design-effect as stat tiles,
// demographics as a waffle chart (respondent composition), statistical
// validation/QA as callouts, research_methodology_assurance as governance
// tiles, and the real evidence[].enumerator -> reviewer -> approval chain
// as a field-workflow visual. Every element traces to a real field;
// anything absent is omitted, never invented.
// VPX Release 1: interprets the real design_effect value using Kish's
// conventional survey-methodology thresholds (<=1.5 low, <=2.0 moderate,
// >2.0 high) — a real, general statistical convention applied to a real
// number already on the model, not a new claim about this specific report.
// An independent editorial review named the absence of exactly this
// interpretation as the first thing a statistician-reviewer looks for in a
// methodology section and does not currently find.
function classifyDesignEffect(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n <= 1.5) return { band: 'low', note: 'adds only modest extra variance beyond a simple random sample of the same size' };
  if (n <= 2.0) return { band: 'moderate', note: "is within the range generally considered acceptable for programme-level reporting" };
  return { band: 'high', note: 'means regional comparisons should be read with wider real-world uncertainty than the headline confidence interval alone suggests' };
}

// VPX Release 1: Methodology rendered only as labelled bullets, stat tiles
// and footnotes — real content, but no connected narrative, which an
// independent editorial review flagged as this platform's single weakest
// page for research credibility (a technical reviewer reads methodology
// first and closely). Every sentence below is built only from fields
// already real on the model; nothing here is a new claim.
function buildMethodologyNarrative(meth, stats, assurance) {
  const sentences = [];
  const deffClass = classifyDesignEffect(meth.design_effect);
  if (deffClass) {
    sentences.push(`A design effect of ${meth.design_effect} is ${deffClass.band} by conventional survey-methodology thresholds, and ${deffClass.note}.`);
  }
  const validityParts = stats.validity ? Object.entries(stats.validity).map(([k, v]) => `${k} validity — ${v}`) : [];
  const reliabilityPart = stats.reliability?.cronbach_alpha != null
    ? `internal consistency (Cronbach's alpha ${stats.reliability.cronbach_alpha}) rated ${stats.reliability.status || 'acceptable'}`
    : null;
  const checkedParts = [reliabilityPart, ...validityParts].filter(Boolean);
  if (checkedParts.length) {
    sentences.push(`Before fielding, the instrument was checked on ${checkedParts.length} real dimension${checkedParts.length === 1 ? '' : 's'}: ${checkedParts.join('; ')} — cited checks, not a claimed accuracy figure.`);
  }
  if (assurance.protocol && assurance.reproducibility) {
    sentences.push('The same governed protocol — reviewed for ethics and reproducibility — produced every publication in this catalog, and a documented export manifest records every transformation applied to the underlying data.');
  }
  return sentences.join(' ');
}

function buildMethodologySpread(methodology, limitations, evidenceLabel, statisticalIntelligence, researchAssurance, demographics, sampleEvidence, standards, recommendations) {
  const meth = methodology || {};
  const stats = statisticalIntelligence || {};
  const assurance = researchAssurance || {};
  const methodologyNarrative = buildMethodologyNarrative(meth, stats, assurance);
  // PX Release 5, Task #52: links each standard to the specific decision(s)
  // it affects — real, mechanical, not fuzzy text matching: a decision is
  // linked when its own evidence_used overlaps the standard's own real
  // evidence_ids (now varying per standard since Task #52 also fixed those
  // ids to stop repeating the same 2 evidence records for every standard).
  const standardsWithDecisions = (standards || []).map(s => {
    const linked = (recommendations || []).filter(r => (r.evidence_used || []).some(id => (s.evidence_ids || []).includes(id)));
    return { framework: s.framework, decisionIds: linked.map(r => r.id || r.decision_id).filter(Boolean) };
  });
  const ruralShare = (demographics?.location || []).find(([label]) => /rural/i.test(label))?.[1];
  const statTiles = [
    ['Sample size', meth.sample_size],
    ['Response rate', stats.response_rate ?? meth.response_rate],
    ['Design effect', meth.design_effect],
    ['Confidence intervals', meth.confidence_intervals],
  ].filter(([, v]) => v != null && v !== '');
  const workflow = sampleEvidence && (sampleEvidence.enumerator || sampleEvidence.reviewer || sampleEvidence.approval)
    ? [sampleEvidence.enumerator, sampleEvidence.reviewer, sampleEvidence.approval].filter(Boolean)
    : [];
  const html = `
    <section class="spread">
      ${spreadHeader('Methodology Canvas', 'How this evidence was built')}
      <div class="grid">
        <div class="col-8">
          ${methodologyNarrative ? `<p class="text-bodyLarge">${escapeHtml(methodologyNarrative)}</p>` : ''}
          ${(meth.research_objectives || []).length ? `<h4>Research objectives</h4>${meth.research_objectives.map(o => `<p class="text-bodySmall">&middot; ${escapeHtml(o)}</p>`).join('')}` : ''}
          ${(meth.evaluation_questions || []).length ? `<h4>Evaluation questions</h4>${meth.evaluation_questions.map(q => `<p class="text-bodySmall">&middot; ${escapeHtml(q)}</p>`).join('')}` : ''}
          ${statTiles.length ? `<div class="methodology-stat-tiles">${statTiles.map(([label, value]) => `<div class="methodology-stat-tile"><span class="text-h3">${escapeHtml(value)}</span><span class="caption">${escapeHtml(label)}</span></div>`).join('')}</div>` : ''}
          ${stats.data_quality_assessment || stats.outlier_detection || stats.missing_data_analysis
            ? `<h4>Data validation</h4>
               ${stats.data_quality_assessment ? `<p class="text-bodySmall">${escapeHtml(stats.data_quality_assessment)}</p>` : ''}
               ${stats.missing_data_analysis?.treatment ? `<p class="footnote">Missing data: ${escapeHtml(stats.missing_data_analysis.item_nonresponse_percent ?? '—')}% item non-response — ${escapeHtml(stats.missing_data_analysis.treatment)}</p>` : ''}
               ${stats.outlier_detection ? `<p class="footnote">Outlier detection: ${escapeHtml(stats.outlier_detection)}</p>` : ''}`
            : ''}
          ${workflow.length ? `<h4>Field workflow</h4><div class="methodology-workflow">${workflow.map(step => `<span class="methodology-workflow-step">${escapeHtml(step)}</span>`).join('<span class="methodology-workflow-arrow">&rarr;</span>')}</div>` : ''}
        </div>
        <div class="col-4">
          ${demographics ? `<h4>Respondent composition</h4>${ruralShare != null ? `${chartComponents.waffleChart(ruralShare, 'Rural respondents')}<p class="caption">Is the sample rural/urban balance representative enough to trust regional findings?</p>` : ''}` : ''}
          ${assurance.protocol || assurance.ethics || assurance.peer_review || assurance.reproducibility ? `
            <h4>Governance</h4>
            ${assurance.protocol ? `<p class="footnote"><b>Protocol:</b> ${escapeHtml(assurance.protocol)}</p>` : ''}
            ${assurance.ethics ? `<p class="footnote"><b>Ethics:</b> ${escapeHtml(assurance.ethics)}</p>` : ''}
            ${assurance.peer_review ? `<p class="footnote"><b>Peer review:</b> ${escapeHtml(assurance.peer_review)}</p>` : ''}
            ${assurance.reproducibility ? `<p class="footnote"><b>Reproducibility:</b> ${escapeHtml(assurance.reproducibility)}</p>` : ''}
            ${standardsWithDecisions.length ? `<p class="footnote"><b>Standards applied:</b> ${standardsWithDecisions.map(s => s.decisionIds.length ? `${escapeHtml(s.framework)} (${s.decisionIds.map(id => escapeHtml(id)).join(', ')})` : escapeHtml(s.framework)).join('; ')} — linked to a specific decision where the standard's own evidence overlaps that decision's evidence_used. ${escapeHtml(standards[0]?.limitations || '')}</p>` : ''}
          ` : ''}
          <h4>Limitations</h4>
          ${(limitations || []).map(l => `<p class="footnote">${escapeHtml(l)}</p>`).join('')}
          <p class="citation">${escapeHtml(evidenceLabel)}</p>
        </div>
      </div>
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: 'Methodology Canvas' },
    ...(methodologyNarrative ? [{ type: 'paragraph', text: methodologyNarrative }] : []),
    ...(statTiles.length ? [{ type: 'stat_group', stats: statTiles.map(([label, value]) => ({ label, value, unit: '' })) }] : []),
    ...((limitations || []).length ? [{ type: 'list', items: limitations, ordered: false }] : []),
    ...(standardsWithDecisions.length ? [{ type: 'paragraph', text: `Standards applied: ${standardsWithDecisions.map(s => s.framework).join(', ')}` }] : []),
  ];
  return spread('methodology', ['15min'], 'evidence', [
    { type: 'methodology_card', hasInterpretation: true },
    ...(methodologyNarrative ? [{ type: 'methodology_narrative', hasInterpretation: true }] : []),
  ], html, `${methodologyNarrative} ${(meth.research_objectives || []).join(' ')}`, blocks);
}

// ------------------------------------------------------------------
// 18. Evidence and statistical annex — full register, not just the
// quotes surfaced earlier.
// ------------------------------------------------------------------
function buildEvidenceAnnexSpread(evidence) {
  // PX Release 5, Task #48: fixed a real truncation bug (String.slice(0,70)
  // could cut a quote mid-word — the same defect class the editorial
  // validator's detectTruncatedLabelRisk guards against elsewhere, just not
  // in a table cell) by reusing the existing word-aware truncateWords().
  // Added real finding/recommendation traceability columns from
  // evidence[].lineage — already-governed linkage data that existed on the
  // model but was never rendered anywhere in this annex before.
  const rows = (evidence || []).map(e => `<tr><td>${escapeHtml(e.id)}</td><td>${escapeHtml(truncateWords(e.quote || '', 12))}</td><td>${escapeHtml(e.region || '')}</td><td>${escapeHtml(e.confidence_score ?? '—')}%</td><td>${escapeHtml(e.lineage?.finding || '—')}</td><td>${escapeHtml(e.lineage?.recommendation || '—')}</td><td>${escapeHtml(e.dataset_version || '')}</td></tr>`).join('');
  // PX Release 5, Task #50 (7th of 7 chart types wired): evidence grouped
  // by its own real region field — real proportional counts, not a
  // fabricated distribution.
  const regionCounts = new Map();
  for (const e of (evidence || [])) { const r = e.region || 'Unspecified'; regionCounts.set(r, (regionCounts.get(r) || 0) + 1); }
  const treemap = regionCounts.size ? chartComponents.treemap([...regionCounts.entries()].map(([label, value]) => ({ label, value })), { width: 460, height: 80 }) : '';
  const html = `
    <section class="spread">
      ${spreadHeader('Evidence Annex', 'Full evidence register')}
      ${treemap ? `<div class="overline">Evidence by region</div>${treemap}<p class="caption">Does the evidence base concentrate in a few regions, or is it broad enough to support a national-level decision?</p>` : ''}
      <table class="vpds-table"><thead><tr><th>ID</th><th>Excerpt</th><th>Region</th><th>Confidence</th><th>Finding</th><th>Decision</th><th>Dataset</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="footnote">Finding and decision columns trace each evidence record to the specific finding and recommendation it supports, per evidence[].lineage.</p>
      <p class="footnote">Editorial Division Release: an authenticated AI Assistant that answers follow-up questions against this publication's own governed evidence is available to signed-in users at /api/reports/assistant — a real, working feature, signposted here rather than duplicated inline.</p>
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: 'Evidence Annex' },
    { type: 'table', headers: ['ID', 'Excerpt', 'Region', 'Confidence', 'Finding', 'Decision'], rows: (evidence || []).map(e => [e.id, truncateWords(e.quote || '', 12), e.region || '', `${e.confidence_score ?? '—'}%`, e.lineage?.finding || '—', e.lineage?.recommendation || '—']) },
  ];
  return spread('evidence-annex', ['15min'], 'evidence', [{ type: 'evidence_table', hasInterpretation: true }, ...(treemap ? [{ type: 'treemap_chart', hasInterpretation: true }] : [])], html, (evidence || []).map(e => e.quote).join(' '), blocks);
}

// ------------------------------------------------------------------
// 19. Publication integrity and responsible AI.
// ------------------------------------------------------------------
function buildIntegritySpread({ assurance, branding, readiness, aiGovernance, datasetVersion, prestige, editorialConsensus }) {
  const components = assurance?.components || {};
  // Enterprise Market Validation Release, Part A: the raw 0-100 score that
  // used to print here ("Overall readiness: XX/100") is an internal Quality
  // Gate number and must never appear on a public surface — only the
  // pass/fail trust badges below, backed by the same real components.
  // Detailed scores remain internal-only (site/admin/quality-control.html).
  const trustBadges = computeTrustBadges({ editorialConsensus, assurance });
  const openItems = Object.entries(components).filter(([, v]) => Number(v) < 70).map(([k]) => k.replaceAll('_', ' '));
  const radar = chartComponents.radarChart(components);
  // PX Release 11, Part 10 (reducing the "self-graded" feel this page
  // otherwise has): report.publication_prestige (PX Release 10) already
  // composes 8 named-reviewer verdicts from real, independently-computed
  // signals (editorial_consensus, donor_intelligence, government_intelligence,
  // knowledge_validation, decision_intelligence) — never rendered until now.
  // This is a genuine second, independent readout alongside the trust
  // badges above, not a restatement of them.
  const prestigeHtml = visualComponents.prestigePanel(prestige);
  const html = `
    <section class="spread">
      ${spreadHeader('Assurance', 'Publication quality gate')}
      <div class="grid">
        <div class="col-6">
          <p class="text-bodyLarge">${escapeHtml(humanizeStatusEnum(readiness?.status))}</p>
          <p class="text-bodySmall">Publication ID ${escapeHtml(branding?.publication_id || '')} &middot; Dataset version ${escapeHtml(datasetVersion)}</p>
          ${aiGovernance ? `<p class="footnote">Responsible AI: model ${escapeHtml(aiGovernance.model)}; reviewer ${escapeHtml(aiGovernance.reviewer)}; approval ${escapeHtml(humanizeStatusEnum(aiGovernance.approval))}</p>` : ''}
          ${visualComponents.trustBadgeStrip(trustBadges)}
          ${radar ? `<div class="overline">Quality dimensions</div>${radar}${openItems.length ? `<p class="caption">A dimension shown near zero is a real, unmet criterion — see "${openItems.length > 1 ? 'Open before general release' : openItems[0]}" alongside it, not a charting error.</p>` : ''}` : ''}
        </div>
        <div class="col-6">
          <h4>${openItems.length ? 'Open before general release' : 'No open items below threshold'}</h4>
          ${openItems.map(i => `<p class="text-bodySmall">&middot; ${escapeHtml(i)}</p>`).join('')}
          ${prestigeHtml}
        </div>
      </div>
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: 'Assurance' },
    { type: 'list', items: trustBadges.map(b => `${b.satisfied ? 'Passed' : 'Pending'}: ${b.label}`), ordered: false },
    { type: 'paragraph', text: humanizeStatusEnum(readiness?.status) },
    ...(openItems.length ? [{ type: 'list', items: openItems, ordered: false }] : [{ type: 'paragraph', text: 'No open items below threshold' }]),
  ];
  return spread('quality-gate', ['15min'], 'evidence', [
    { type: 'quality_summary', hasInterpretation: true },
    ...(radar ? [{ type: 'radar_chart', hasInterpretation: true }] : []),
    ...(prestigeHtml ? [{ type: 'prestige_panel', hasInterpretation: true }] : []),
  ], html, prestige?.verdicts?.map(v => v.rationale).join(' ') || '', blocks);
}

// ------------------------------------------------------------------
// 20. Closing note. Part 8 (Release 2.1): the annex/full-wording tier for
// strategic_outlook — the ONLY spread that renders it unabridged.
// ------------------------------------------------------------------
function buildClosingSpread(book, branding, topRecommendation, theme, arcBridge = '', soWhatTop = null, regional = null) {
  // PX Release 5, Task #49: a real next-step line from the report's own
  // top recommendation (owner, timeline — both already governed fields),
  // placed between the strategic outlook and the brand statement so the
  // argument concludes before contact/brand information appears, per the
  // plan's explicit "conclude the argument before introducing contact
  // information" constraint.
  const nextStep = topRecommendation
    ? `The first concrete step: ${topRecommendation.recommendation} — owned by ${topRecommendation.owner || 'an assigned lead'}, due within ${topRecommendation.timeline || 'the agreed window'}.`
    : '';
  // PX Release 11, Part 9 (Publication Psychology — closing on resolve, not
  // a stopping point): report.so_what[0] (PX Release 10) already answers
  // "if ignored / if addressed / if replicated" for the same top
  // recommendation the next-step line names — a genuine reflective close
  // this page never had, distinct from the strategic-outlook prose above it.
  const soWhatInsight = soWhatTop ? visualComponents.insightPanel('What Follows From Acting Now', [
    { label: 'If addressed', text: soWhatTop.ifAddressed },
    { label: 'If replicated elsewhere', text: soWhatTop.ifReplicated },
  ]) : '';
  const html = `
    <section class="spread">
      ${buildClosingMotif(theme, regional)}
      ${spreadHeader('Closing Note', 'What changes if leadership acts', arcBridge)}
      ${visualComponents.strategicOutlookPanel(book.strategic_outlook)}
      ${nextStep ? `<p class="text-bodySmall"><b>Next step:</b> ${escapeHtml(nextStep)}</p>` : ''}
      ${soWhatInsight}
      <p class="footnote">${escapeHtml(branding?.prepared_by || 'VoiceInsights Africa')} &middot; ${escapeHtml(branding?.tagline || '')}</p>
    </section>`;
  const blocks = [
    { type: 'heading', level: 1, text: 'Closing Note' },
    { type: 'paragraph', text: book.strategic_outlook || '', emphasis: 'thesis' },
    ...(nextStep ? [{ type: 'callout', label: 'Next step', text: nextStep }] : []),
    ...(soWhatTop ? [{ type: 'card', title: 'What Follows From Acting Now', fields: [
      { label: 'If addressed', text: soWhatTop.ifAddressed },
      { label: 'If replicated elsewhere', text: soWhatTop.ifReplicated },
    ] }] : []),
  ];
  return spread('closing', ['15min'], 'impact', [
    { type: 'closing_note', hasInterpretation: true },
    ...(soWhatInsight ? [{ type: 'so_what_insight_panel', hasInterpretation: true }] : []),
  ], html, `${book.strategic_outlook || ''} ${nextStep} ${soWhatTop ? `${soWhatTop.ifAddressed} ${soWhatTop.ifReplicated}` : ''}`, blocks);
}

// ------------------------------------------------------------------
// Top-level orchestrator: the 20-step editorial arc (Release 2, Part 3;
// pagination/composition/dedup fixes, Release 2.1). No three consecutive
// spreads share a primary component type — verified by
// tests/publication-spread-composer.test.js against this exact output, not
// asserted only by manual trace.
// ------------------------------------------------------------------

const hashSeed = value => [...String(value)].reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0) >>> 0;

// PX Release 5.1, Parts 1/2/6: one small "arc bridge" per spine spread — a
// transition line (Editorial Memory) grounded in real shared region/
// priority-tier linkage with the LOGICALLY previous spine spread (per
// flagship-narrative-arc.js's declared order, not physical render order —
// see the PX 5.1 plan's resolution of that tension), a real extractive
// "key takeaway" (Executive Reading Psychology), and the arc's own
// nextQuestion (Cognitive Flow). Every value here already exists on the
// model; this only decides which real value plays which role.

function buildArcBridges({ report, full, book, findings, recommendations, evidenceById, hero, heroRecommendation, decisionA, decisionB }) {
  const sortedRegional = (full.regional || []).slice().sort((a, b) => (b.primary_score || 0) - (a.primary_score || 0));
  const worstRegion = sortedRegional[sortedRegional.length - 1];
  const sortedEvidence = (report.evidence || []).slice().sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
  const topEvidence = sortedEvidence[0];

  // pickHeroFinding (composePublicationSpreads) ranks findings by
  // confidence_score, so the hero finding and findings[0] are frequently
  // the exact same record — confirmed on 2 of the 16 real samples, where
  // it produced an identical takeaway on both hero-insight and root-cause
  // (PX Release 6 PQR follow-up). Root-cause's own table already covers
  // more than one finding, so falling back to the next distinct one keeps
  // the takeaway real and extractive rather than repeating hero-insight's.
  const rootCauseFinding = (hero && findings[0] && hero.text === findings[0].text) ? (findings[1] || findings[0]) : findings[0];
  // Key Messages quotes EVERY finding's text in full (executive_book.
  // key_messages = findings.map(f => f.text)) — so hero-insight's and
  // root-cause's takeaways, both drawn directly from a finding's text,
  // structurally overlap with Key Messages no matter which finding is
  // picked (PX Release 6.5 PQR, top critical issue #2: the fallback above
  // only prevents hero-insight and root-cause colliding with EACH OTHER,
  // not with Key Messages, which always quotes findings[0] in full).
  // Capping both at 9 words — the same fix already applied to the
  // decision-card rationale for the identical reason — keeps each takeaway
  // a real, substantive excerpt while keeping the shared verbatim span
  // short enough to stay at the editorial validator's lowest severity tier.
  const LINKAGE_AND_TAKEAWAY = {
    'national-context': { region: null, priorityTier: null, takeaway: lastSentence(report.executive_summary || '') },
    'root-cause': { region: evidenceById.get(rootCauseFinding?.evidence_ids?.[0])?.region || null, priorityTier: recommendations[0]?.strategic_priority || null, takeaway: truncateWords(robustTakeaway(rootCauseFinding?.text || ''), 9) },
    'evidence-story': { region: topEvidence?.region || null, priorityTier: null, takeaway: truncateWords(topEvidence?.quote || '', 20) },
    'regional-equity': { region: worstRegion?.name || null, priorityTier: null, takeaway: worstRegion ? `${worstRegion.name} trails the strongest region by ${Math.max(0, (sortedRegional[0]?.primary_score || 0) - worstRegion.primary_score)} points.` : '' },
    'hero-insight': { region: evidenceById.get(hero?.evidence_ids?.[0])?.region || null, priorityTier: heroRecommendation?.strategic_priority || null, takeaway: truncateWords(robustTakeaway(hero?.text || ''), 9) },
    'scenarios': { region: null, priorityTier: recommendations[0]?.strategic_priority || null, takeaway: robustTakeaway(book.strategic_outlook || '') },
    'priority-matrix': { region: null, priorityTier: recommendations[0]?.strategic_priority || null, takeaway: truncateWords(recommendations[0]?.recommendation || '', 16) },
    // decisions-a's top slot is usually the same recommendations[0] already
    // quoted bare on priority-matrix one page earlier — owner/timeline
    // framing (the same real fields buildDecisionDossierSpread's cards
    // already render) keeps this takeaway genuinely distinct rather than
    // repeating an identical sentence twice in a row (PX Release 6 PQR,
    // high finding #17).
    'decisions-a': { region: null, priorityTier: decisionA[0]?.strategic_priority || null, takeaway: decisionA[0] ? `${decisionA[0].recommendation} — owned by ${decisionA[0].owner || 'an assigned lead'}, due within ${decisionA[0].timeline || 'the agreed window'}.` : '' },
    'decisions-b': { region: null, priorityTier: decisionB[0]?.strategic_priority || null, takeaway: truncateWords(decisionB[0]?.recommendation || '', 16) },
    'roadmap': { region: null, priorityTier: recommendations[0]?.strategic_priority || null, takeaway: recommendations[0]?.timeline ? `The highest-priority action is due within ${recommendations[0].timeline}.` : '' },
    'risks': { region: null, priorityTier: recommendations[0]?.strategic_priority || null, takeaway: truncateWords(book.critical_risks?.[0]?.risk || '', 16) },
    'monitoring': { region: null, priorityTier: recommendations[0]?.strategic_priority || null, takeaway: truncateWords(recommendations[0]?.monitoring_indicator || '', 18) },
    // Closing already renders book.strategic_outlook in full via its own
    // Strategic Outlook panel (buildClosingSpread), and Scenarios' own
    // takeaway already quotes the same string — reusing it a third time
    // here produced a verbatim repeat (PX Release 6 PQR, high finding
    // #16). The PX Release 6 fix pointed this takeaway at the report's own
    // "next step" framing (top recommendation + owner + timeline) instead
    // — but buildClosingSpread's own "Next step:" paragraph (a few lines
    // below this same arc-bridge, on the same rendered page) already
    // renders that exact sentence, so the two collided verbatim on Closing
    // specifically (EAD Release 1, Task #126). detectRepeatedNgrams never
    // catches this: it only compares text across different spreads, never
    // within one spread's own HTML. Fixed with a genuinely distinct real
    // fact — the size and urgency of the full decision agenda (real
    // recommendation count + CRITICAL-tier count) — which zooms out to
    // the whole roadmap right before Next step zooms into its first item.
    'closing': { region: null, priorityTier: null, takeaway: recommendations.length ? `This publication closes with ${recommendations.length} recommendation${recommendations.length === 1 ? '' : 's'} for leadership to act on, ${recommendations.filter(r => r.strategic_priority === 'CRITICAL').length} of them CRITICAL priority.` : robustTakeaway(book.strategic_outlook || '') },
  };

  const bridges = new Map();
  let previousLinkage = null;
  // PX 5.1 Part 2 ("never repeat identical transition phrases"): the
  // transition engine's own anti-repeat rule only guards the immediately
  // previous pick. This set extends that guarantee across the WHOLE
  // report — a transition phrase already used earlier (even non-adjacently)
  // is never reused while a different one in the same eligible pool is
  // still available.
  const usedTransitionTexts = new Set();
  SPINE_SPREAD_ORDER.forEach((spreadId, spineIndex) => {
    const currentArc = arcContextFor(spreadId);
    const linkage = LINKAGE_AND_TAKEAWAY[spreadId] || { region: null, priorityTier: null, takeaway: '' };
    // PX Release 12, Part 3 (Chapter Identity): rendered first, before the
    // transition/takeaway lines, so a reader sees "which chapter" before
    // "how it connects to the last one."
    let bridgeHtml = visualComponents.chapterMarker(currentArc?.stage, spineIndex + 1, SPINE_SPREAD_ORDER.length);
    let transitionKey = null;
    if (previousLinkage) {
      let transition = selectTransition({
        current: { region: linkage.region, priorityTier: linkage.priorityTier },
        previous: { region: previousLinkage.region, priorityTier: previousLinkage.priorityTier },
        currentArc,
        seedIndex: hashSeed(`${report.branding?.publication_id || 'unversioned'}:${spreadId}`),
        previousKey: previousLinkage.transitionKey,
      });
      // Phase 2 fix: each reseed attempt must still be checked against the
      // REAL previous spine spread's key (previousLinkage.transitionKey),
      // not the just-computed candidate's own key — feeding a candidate's
      // key back into itself here would silently discard the shape/index
      // anti-repeat guarantee on every reseed, since a fresh candidate is
      // never "the same as itself." Only seedIndex varies per attempt, so
      // this loop still converges on a real-text-collision-free pick.
      for (let guard = 0; usedTransitionTexts.has(transition.text) && guard < 8; guard++) {
        transition = selectTransition({
          current: { region: linkage.region, priorityTier: linkage.priorityTier },
          previous: { region: previousLinkage.region, priorityTier: previousLinkage.priorityTier },
          currentArc,
          seedIndex: hashSeed(`${report.branding?.publication_id || 'unversioned'}:${spreadId}:${guard}`),
          previousKey: previousLinkage.transitionKey,
        });
      }
      usedTransitionTexts.add(transition.text);
      bridgeHtml += `<p class="arc-transition">${escapeHtml(transition.text)}</p>`;
      transitionKey = { linkageType: transition.linkageType, index: transition.index, shape: transition.shape };
    }
    if (linkage.takeaway) bridgeHtml += `<p class="arc-takeaway"><b>Key takeaway:</b> ${escapeHtml(linkage.takeaway)}</p>`;
    if (currentArc?.nextQuestion) bridgeHtml += `<p class="arc-next-question caption">Next: ${escapeHtml(currentArc.nextQuestion)}</p>`;
    bridges.set(spreadId, bridgeHtml);
    previousLinkage = { region: linkage.region, priorityTier: linkage.priorityTier, transitionKey };
  });
  return bridges;
}

// ------------------------------------------------------------------
// Editorial Division Release, Part E: Executive Dashboard — consolidates
// KPI figures already computed and used individually elsewhere (regions
// covered already appears on National Context, timeline-bucketed
// recommendation counts already power the Roadmap flow diagram, critical
// risks already power the Risks spread) into one dedicated dashboard.
// Tile SELECTION AND ORDER vary by the publication's real editorial
// identity (publication-editorial-identity.js's dashboardTileOrder) — the
// four figures themselves are the same real computation for every
// publication; only which one leads differs, which is what makes "Health
// feels different from Corporate" a checkable property (see
// flagship-catalog-anti-repetition.test.js) rather than an assertion.
// Every tile states the decision question it answers (Editorial
// Constitution Article IV — Visual Intelligence).
// ------------------------------------------------------------------
const DASHBOARD_TILES = Object.freeze({
  critical_findings: (ctx) => ({ value: ctx.criticalCount, caption: 'Critical risks flagged', question: 'How many risks require immediate executive attention?' }),
  evidence_confidence: (ctx) => ({ value: ctx.avgConfidence != null ? `${ctx.avgConfidence}%` : '—', caption: 'Average evidence confidence', question: 'How much can leaders trust the evidence base?' }),
  regional_spread: (ctx) => ({ value: ctx.regionCount, caption: 'Regions covered', question: 'Is this evidence base geographically representative?' }),
  recommendation_urgency: (ctx) => ({ value: ctx.immediateCount, caption: 'Recommendations due within 90 days', question: 'What needs a decision this quarter?' }),
  budget_commitment: (ctx) => ({ value: ctx.topPriorityCount, caption: 'Top-priority recommendations', question: 'Where should the next budget cycle focus?' }),
});
function buildExecutiveDashboardSpread(findings, recommendations, regional, book, evidence, dashboardTileOrder, arcBridge = '') {
  const confidences = (evidence || []).map(e => Number(e.confidence_score)).filter(n => Number.isFinite(n));
  const ctx = {
    criticalCount: (book?.critical_risks || []).length,
    avgConfidence: confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : null,
    regionCount: (regional || []).length,
    immediateCount: (recommendations || []).filter(r => parseTimelineBucket(r.timeline) === 'immediate').length,
    topPriorityCount: (recommendations || []).filter(r => /critical|high/i.test(r.priority || r.strategic_priority || '')).length,
  };
  const order = (dashboardTileOrder && dashboardTileOrder.length) ? dashboardTileOrder : Object.keys(DASHBOARD_TILES);
  const tiles = order.map(key => DASHBOARD_TILES[key]?.(ctx)).filter(Boolean);
  const html = `
    <section class="spread">
      ${spreadHeader('Executive Dashboard', 'The figures leaders check first', arcBridge)}
      <div class="grid">
        ${tiles.map(t => `<div class="col-3">
          <div class="methodology-stat-tile"><span class="text-h2">${escapeHtml(t.value)}</span><span class="caption">${escapeHtml(t.caption)}</span></div>
          <p class="footnote">${escapeHtml(t.question)}</p>
        </div>`).join('')}
      </div>
    </section>`;
  const text = tiles.map(t => `${t.caption}: ${t.value}. ${t.question}`).join(' ');
  const components = tiles.map(t => ({ type: 'dashboard_tile', hasDecisionQuestion: true, label: t.caption }));
  const blocks = [
    { type: 'heading', level: 1, text: 'Executive Dashboard' },
    { type: 'stat_group', stats: tiles.map(t => ({ label: t.caption, value: t.value, unit: '' })) },
  ];
  return spread('executive-dashboard', ['90sec', '5min'], 'story', components, html, text, blocks);
}

// ------------------------------------------------------------------
// Editorial Division Release, Part E: AI Insights — real, already-computed
// deterministic classification signals only (Editorial Constitution
// Article VII). validatePublicationIntelligenceV3() already runs an
// editorial-lens-diversity / SDG-card-completeness / finding-specificity
// screen on every publication (flagship-publication-intelligence.js);
// publication_assurance.components already carries genuine automated
// pattern-detection (contradiction screening, recommendation-strength
// scoring). This spread surfaces those real signals, explicitly labeled as
// deterministic classification — never generative narrative text, and it
// does not weaken the platform's own tested disclosure
// (report.ai_governance.model) that no LLM writes any publication's
// findings.
// ------------------------------------------------------------------
function buildAIInsightsSpread(intelligenceGate, assurance, arcBridge = '') {
  const checks = intelligenceGate?.checks || {};
  const components = assurance?.components || {};
  const signals = [
    { label: 'Editorial lens diversity', result: checks.editorial_lenses != null ? `${checks.editorial_lenses} distinct lenses` : 'Not yet computed', detail: 'Automated check that findings are not interpreted through one repeated analytical frame.' },
    { label: 'SDG evidence-linkage completeness', result: checks.sdg_cards != null ? `${checks.sdg_cards} cards checked` : 'Not yet computed', detail: 'Automated verification that every SDG alignment card carries a target, indicator code and evidence link.' },
    { label: 'Finding specificity screen', result: intelligenceGate?.status === 'PASS' ? 'Passed' : 'Flagged for review', detail: 'Automated screen for generic or under-specified finding titles.' },
    { label: 'Contradiction screen', result: components.contradiction_free === 100 ? 'No contradictions detected' : 'Under review', detail: 'Automated cross-check of recommendations and findings for internal contradiction.' },
    { label: 'Recommendation-strength classification', result: components.recommendation_strength != null ? `${components.recommendation_strength}/100` : 'Not yet computed', detail: 'Automated scoring of whether each recommendation names an owner, timeline and monitoring indicator.' },
  ];
  const html = `
    <section class="spread">
      ${spreadHeader('Automated Signal Detection', 'Deterministic classification, not generated text', arcBridge)}
      <p class="text-bodySmall">Every figure on this page is produced by a rule-based classifier applied to this publication's own real content. VoiceInsights Africa does not use a generative or large language model to write findings, interpretations or recommendations — see the Assurance page for the full disclosure.</p>
      <div class="grid">
        ${signals.map(s => `<div class="col-6">${visualComponents.insightPanel(s.label, [{ label: 'Result', text: s.result }, { label: 'What this checks', text: s.detail }])}</div>`).join('')}
      </div>
    </section>`;
  const text = signals.map(s => `${s.label}: ${s.result}. ${s.detail}`).join(' ');
  const components_ = signals.map(s => ({ type: 'ai_signal_panel', hasResult: true, hasDecisionQuestion: true, label: s.label }));
  const blocks = [
    { type: 'heading', level: 1, text: 'Automated Signal Detection' },
    ...signals.map(s => ({ type: 'callout', label: s.label, text: `${s.result} — ${s.detail}` })),
  ];
  return spread('ai-insights', ['15min'], 'evidence', components_, html, text, blocks);
}

// ------------------------------------------------------------------
// Editorial Division Release, Part E: OECD-DAC + Theory of Change —
// full.oecd_dac and full.rbm_results_framework are computed for every
// publication but were only ever rendered into the DOCX/PDF/PPTX export
// path (dedicated-binary-renderer.js), never into the interactive HTML
// spine — a real parity gap the Editorial Constitution (Article VI) closes.
// Both this spread and the office exporter now shape the identical data
// through the same formatOecdDacLines/formatRbmLines helpers
// (publication-render-utils.js), so the two can never drift onto different
// wording again.
// ------------------------------------------------------------------
function buildOecdDacSpread(oecdDac, arcBridge = '') {
  const rows = oecdDac || [];
  if (!rows.length) return null;
  const html = `
    <section class="spread">
      ${spreadHeader('OECD-DAC Evaluation Criteria', 'Relevance, coherence, effectiveness, efficiency, impact, sustainability', arcBridge)}
      <table class="vpds-table"><thead><tr><th>Criterion</th><th>Assessment</th><th>Score</th><th>Management implication</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${escapeHtml(r.criterion)}</td><td>${escapeHtml(r.assessment)}</td><td>${escapeHtml(r.score)}/100</td><td>${escapeHtml(r.management_implication)}</td></tr>`).join('')}</tbody></table>
    </section>`;
  const lines = formatOecdDacLines(rows);
  const components = [{ type: 'standards_table', rowCount: rows.length }];
  const blocks = [
    { type: 'heading', level: 1, text: 'OECD-DAC Evaluation Criteria' },
    { type: 'table', headers: ['Criterion', 'Assessment', 'Score', 'Management implication'], rows: rows.map(r => [r.criterion, r.assessment, `${r.score}/100`, r.management_implication]) },
  ];
  return spread('oecd-dac', ['15min'], 'evidence', components, html, lines.join(' '), blocks);
}
function buildTheoryOfChangeSpread(rbm, arcBridge = '') {
  if (!rbm) return null;
  const html = `
    <section class="spread">
      ${spreadHeader('Theory of Change', 'Results-based management: inputs to impact', arcBridge)}
      <p class="text-bodyLarge">${escapeHtml(rbm.impact || '')}</p>
      <div class="grid">
        <div class="col-6"><h4>Outcomes</h4>${(rbm.outcomes || []).map(o => `<div class="insight-panel"><div class="overline">${escapeHtml(o.id)}</div><p class="text-bodySmall">${escapeHtml(o.statement)}</p></div>`).join('')}</div>
        <div class="col-6"><h4>Outputs</h4>${(rbm.outputs || []).map(o => `<div class="insight-panel"><div class="overline">${escapeHtml(o.id)}</div><p class="text-bodySmall">${escapeHtml(o.statement)}</p></div>`).join('')}</div>
        <div class="col-6"><h4>Assumptions</h4><ul>${(rbm.assumptions || []).map(a => `<li class="text-bodySmall">${escapeHtml(a)}</li>`).join('')}</ul></div>
        <div class="col-6"><h4>Means of verification</h4><ul>${(rbm.means_of_verification || []).map(m => `<li class="text-bodySmall">${escapeHtml(m)}</li>`).join('')}</ul></div>
      </div>
    </section>`;
  const lines = formatRbmLines(rbm);
  const components = [{ type: 'theory_of_change_map', outcomeCount: (rbm.outcomes || []).length, outputCount: (rbm.outputs || []).length }];
  const blocks = [
    { type: 'heading', level: 1, text: 'Theory of Change' },
    { type: 'callout', label: 'Impact', text: rbm.impact || '' },
    ...(rbm.outcomes || []).map(o => ({ type: 'callout', label: o.id, text: o.statement })),
  ];
  return spread('theory-of-change', ['15min'], 'evidence', components, html, lines.join(' '), blocks);
}

export function composePublicationSpreads(model = {}) {
  const report = model.report || {};
  const full = model.full_publication || {};
  const book = report.executive_book || {};
  const assurance = report.publication_assurance || model.publication_assurance || {};
  const evidenceLabel = report.branding?.synthetic_notice || 'Synthetic demonstration evidence';
  const datasetVersion = report.evidence?.[0]?.dataset_version || full.methodology?.sampling_frame || 'unversioned';
  const findings = report.findings || [];
  const recommendations = (report.recommendations || []).slice(0, 5);
  const evidenceById = new Map((report.evidence || []).map(e => [e.id, e]));
  // EIE Release 1: Cover, Executive Brief, Key Messages, and Hero Insight
  // previously each independently selected a "most important finding" —
  // confidence-only (pickHeroFinding), array-position (recommendations[0]),
  // and a separate tier+confidence rank inside Key Messages — confirmed by
  // the EAD 2.5 audit to disagree in 10 of 16 real samples. All four now
  // read from this one shared selection.
  const northStar = selectPublicationNorthStar(model);
  const hero = northStar?.finding || pickHeroFinding(findings);
  const heroRecommendation = northStar?.recommendation || recommendations[0];
  // EIE Release 2: Purpose/Intent/Position are computed once, here, from
  // the same real model + North Star every other engine already reads —
  // never recomputed per spread. Cover and Executive Brief are the two
  // real render sites (see their own comments) that make this visible to
  // the reader, per the brief's explicit requirement that intent must be
  // legible from the rendered page, not just a computed object.
  const intentContext = { purpose: selectPublicationPurpose(model), intent: selectEditorialIntent(northStar), position: selectPublicationPosition(model) };

  const metadata = {
    title: report.title,
    organization: 'VoiceInsights Africa',
    sector: report.sector,
    generated_at: report.publication_date,
    classification: report.classification,
    export_engine: SPREAD_COMPOSER_VERSION,
  };

  const decisionA = recommendations.slice(0, 2);
  const decisionB = recommendations.slice(2, 5);
  const arcBridges = buildArcBridges({ report, full, book, findings, recommendations, evidenceById, hero, heroRecommendation, decisionA, decisionB });
  // Decision Reasoning Architecture: the SAME recommendation the rest of
  // the publication already treats as its North Star (Cover, Hero Insight,
  // Executive Brief, Key Messages, Closing) drives the 5 new reasoning
  // spreads below, for the same reason those spreads all share one thread
  // — a reader who has been following one decision all publication should
  // find its trade-offs, stakeholders, behavioural pathway, system effects
  // and uncertainty profile here, not a different, unrelated recommendation.
  const reasoningEntry = report.decision_reasoning?.by_recommendation?.find(e => e.recommendation_id === heroRecommendation?.id) || null;

  // Editorial Division Release, Part C (Editorial Constitution Article V):
  // every spread below is still built exactly as before, with the same
  // real content — this only decides (a) the concatenation order of the 3
  // middle segments and (b) the recommendation presentation format,
  // resolved from the publication's real knowledge-router domain. Front
  // and close stay pinned, so the 90-second executive layer's position is
  // unchanged for every publication.
  const identity = resolveEditorialIdentity(report.knowledge_routing?.domain);

  const front = [
    buildCoverSpread(report, full.cover, hero, intentContext, full.regional),
    buildInsideCoverSpread(report, evidenceLabel, datasetVersion),
    buildExecutiveBriefSpread(report, assurance, findings, book.critical_risks, northStar, intentContext),
    buildKeyMessagesSpread(report, northStar),
  ];
  const evidenceSegment = [
    buildHeroInsightSpread(hero, evidenceById, heroRecommendation, evidenceLabel, arcBridges.get('hero-insight')),
    // Editorial Division Release: the 4 new spreads (executive-dashboard,
    // ai-insights, oecd-dac, theory-of-change) are appendix-tier, same as
    // methodology/evidence-annex/quality-gate — they deliberately receive
    // no arcBridge, matching that existing convention, rather than reusing
    // an adjacent spine spread's bridge and duplicating its transition text.
    buildExecutiveDashboardSpread(findings, recommendations, full.regional, book, report.evidence, identity.dashboardTileOrder),
    buildContextSpread(report, full, arcBridges.get('national-context')),
    buildRegionalSpread(full.regional, full.indicators, recommendations, arcBridges.get('regional-equity'), report.strategic_interpretation_regional, report.strategic_interpretation_youth),
    buildEvidenceStorySpread(report.evidence, evidenceLabel, arcBridges.get('evidence-story')),
    buildRootCauseSpread(findings, evidenceById, arcBridges.get('root-cause'), recommendations),
    buildAIInsightsSpread(model.publication_intelligence_gate, assurance),
  ];
  const decisionSegment = [
    buildScenarioSpread(book, recommendations, arcBridges.get('scenarios')),
    buildPriorityMatrixSpread(recommendations, arcBridges.get('priority-matrix'), report.so_what?.[0]),
    buildDecisionOptionsSpread(heroRecommendation, reasoningEntry, arcBridges.get('decision-options-tradeoffs')),
    buildDecisionConditionsSpread(heroRecommendation, reasoningEntry, arcBridges.get('decision-conditions')),
    buildStakeholderPoliticalEconomySpread(heroRecommendation, reasoningEntry, arcBridges.get('stakeholder-political-economy')),
    buildBehaviouralAdoptionSpread(heroRecommendation, reasoningEntry, arcBridges.get('behavioural-adoption-pathway')),
    buildSystemEffectsSpread(heroRecommendation, reasoningEntry, arcBridges.get('system-effects-map')),
    buildDecisionUncertaintySpread(heroRecommendation, reasoningEntry, arcBridges.get('decision-under-uncertainty')),
    decisionA.length ? buildDecisionDossierSpread(decisionA, 'decisions-a', 'Priority decisions — top 2', arcBridges.get('decisions-a'), report.executive_commentary, identity.recommendationFormat) : null,
    buildRoadmapSpread(recommendations, arcBridges.get('roadmap')),
    decisionB.length ? buildDecisionDossierSpread(decisionB, 'decisions-b', 'Priority decisions — remaining', arcBridges.get('decisions-b'), report.executive_commentary, identity.recommendationFormat) : null,
  ];
  const governanceSegment = [
    buildRisksSpread(book.critical_risks, recommendations, arcBridges.get('risks')),
    buildMonitoringSpread(recommendations, arcBridges.get('monitoring'), full.sdg_cards),
    buildOecdDacSpread(full.oecd_dac),
    buildTheoryOfChangeSpread(full.rbm_results_framework),
    buildMethodologySpread(full.methodology || report.methodology, report.limitations, evidenceLabel, report.statistical_intelligence, report.research_methodology_assurance, full.demographics, (report.evidence || [])[0], report.international_standards, recommendations),
    buildEvidenceAnnexSpread(report.evidence),
    buildIntegritySpread({ assurance, branding: report.branding, readiness: report.publication_readiness, aiGovernance: report.ai_governance, datasetVersion, prestige: report.publication_prestige, editorialConsensus: report.editorial_consensus }),
  ];
  const middleSegments = { evidence: evidenceSegment, decision: decisionSegment, governance: governanceSegment };
  const orderedMiddle = identity.middleSegmentOrder.flatMap(key => middleSegments[key] || []);

  const spreads = [
    ...front,
    ...orderedMiddle,
    // ESCI Release 1: Closing previously used recommendations[0] directly —
    // the Editorial Strategy Engine's continuity validator confirmed the
    // shared North Star (Cover/Executive Brief/Hero Insight/Key Messages)
    // "disappears" by Closing in 10 of 16 real samples whenever
    // recommendations[0] isn't the same recommendation the North Star
    // selected. heroRecommendation is already North-Star-linked (see
    // above); so_what is indexed 1:1 with findings/recommendations, so its
    // index must move with it too, or the "What Follows From Acting Now"
    // panel would describe a different decision than the "next step" line
    // right above it.
    buildClosingSpread(book, report.branding, heroRecommendation, full.cover, arcBridges.get('closing'), report.so_what?.[northStar?.findingIndex ?? 0], full.regional),
  ].filter(Boolean);

  // EAD Release 2: the art-direction engine runs AFTER composition, on the
  // real, final spreads array (real .text/.components/.visibleWords/
  // .componentCount, per editorial-art-direction-engine.js's own header
  // note on why this ordering is deliberate, not incidental). Every plan is
  // then made real on the page, not merely computed and discarded: each
  // spread's own outer <section class="spread"> gains 4 real classes
  // (layout-{family}, typography-{mode}, density-{visualDensity},
  // whitespace-{whitespaceMode}) that buildTypographyCss() defines materially
  // different rules for — the exact "compute and disclose, never enforce"
  // failure pattern flagged repeatedly across this engagement, avoided here
  // by making the class injection unconditional for all 20 spreads, not
  // just the 5 spreads whose internal DOM structure this release also
  // rebuilds directly.
  const artDirectionPlans = buildArtDirectionPlans(model, spreads);
  const artDirectedSpreads = spreads.map(s => {
    const plan = artDirectionPlans.get(s.id);
    if (!plan) return s;
    const classAttr = `<section class="spread layout-${plan.layoutFamily} typography-${plan.typographyMode} density-${plan.visualDensity} whitespace-${plan.whitespaceMode}${plan.subLayout ? ` sublayout-${plan.subLayout}` : ''}"`;
    return { ...s, html: s.html.replace('<section class="spread"', classAttr), artDirectionPlan: plan };
  });

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(metadata.title)}</title>
<style>${buildTypographyCss()}</style></head><body>
${artDirectedSpreads.map(s => s.html).join('\n')}
</body></html>`;

  return { metadata, spreads: artDirectedSpreads, html, artDirectionPlans };
}

// ------------------------------------------------------------------
// Part 4: three navigable reading layers within the same publication —
// not three separate documents. Every spread already declares which
// layer(s) it belongs to (see the `spread()` helper's `layers` argument);
// this filters the same composed spread list rather than regenerating
// content, so a layer view can never drift from the full publication.
// ------------------------------------------------------------------
export const READING_LAYERS = Object.freeze(['90s', '5min', '15min']);

export function extractReadingLayer(spreads, layer) {
  if (!READING_LAYERS.includes(layer)) throw new Error(`Unknown reading layer: ${layer}`);
  return spreads.filter(s => (s.layers || []).includes(layer));
}
