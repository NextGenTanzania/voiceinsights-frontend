// Publication Render Utils — shared string/formatting primitives for the
// Browser Rendering V2 publication family (publication-spread-composer.js
// and publication-visual-components.js). Extracted in PX Release 3 so both
// modules share one copy of escapeHtml et al. instead of risking two copies
// drifting apart. Pure functions only — no HTML composition, no model
// knowledge, no fabrication of any kind.
import { vrdsTokens } from './vrds-foundation.js';

export const escapeHtml = v => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const wordCount = text => String(text ?? '').trim().split(/\s+/).filter(Boolean).length;

// EAD Release 1: strips tags from a REAL rendered spread's HTML to recover
// what a reader actually sees, for density measurement. Distinct from the
// `text` parameter every spread() call already carries (a hand-picked
// extractive string used for the repeated-language scanner) — two prior
// independent reviews confirmed that string is frequently a small fraction
// of what a page actually renders (Methodology's `text` was historically
// just its research_objectives array, while the true rendered page carried
// 300+ words across stat tiles, workflow chips and governance footnotes).
// This function is the true-content side of that gap; wordCount(text)
// remains available unchanged for anything that still needs the old signal.
export function stripHtmlToVisibleText(html) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&middot;|&mdash;|&ndash;|&rarr;|&amp;|&quot;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extractive-only text condensation — never generative, never invents
// wording. Returns the first N sentences of the SAME source string; the
// full string remains available (and rendered in full) elsewhere in the
// publication (annex/evidence tiers).
export function firstSentences(text, count = 1) {
  const matches = String(text || '').match(/[^.!?]+[.!?]/g);
  if (!matches || !matches.length) return String(text || '').trim();
  // Every match after the first retains its leading inter-sentence space
  // (the regex's [^.!?]+ consumes it), so joining with an added ' ' on top
  // produced a real double space between sentences (PX Release 6 PQR,
  // high-severity finding #13) — trim each match before joining.
  return matches.slice(0, count).map(s => s.trim()).join(' ').trim();
}

export function lastSentence(text) {
  const matches = String(text || '').match(/[^.!?]+[.!?]/g);
  if (!matches || !matches.length) return String(text || '').trim();
  return matches[matches.length - 1].trim();
}

// Caps an extractive fragment at maxWords, so a short cited fragment stays
// well under the editorial validator's repeated-language high-severity
// span length even when its source sentence is quoted in full elsewhere.
export function truncateWords(text, maxWords) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}…`;
}

// Extractive takeaway text, robust to a frame that opens with a short
// fragment like "67%." (firstSentences treats the period after a bare
// percentage as a sentence boundary) — still purely extractive, just reads
// more sentences when the first is too short to stand alone as a takeaway.
// Shared by publication-spread-composer.js (arc-takeaway lines) and
// publication-visual-components.js (decision-card rationale) — both call
// sites hit the same bare-fragment failure mode against the same real
// finding text, so the fix lives once, here, rather than in either caller.
export function robustTakeaway(text, sentenceCount = 1) {
  const result = firstSentences(text, sentenceCount);
  if (result.replace(/[^a-zA-Z]/g, '').length < 12 && sentenceCount < 3) return robustTakeaway(text, sentenceCount + 1);
  return result;
}

// PX Release 5, Part 3 (confirmed defect): evidence[].statistic.unit is the
// literal word 'percent' (not the symbol '%'), and the renderer previously
// concatenated value+unit with no separator or symbol conversion —
// producing "71percent" in the rendered publication. This formats any
// recognised unit properly (percent -> "71%") and falls back to a spaced
// literal unit for anything else, rather than raw concatenation.
export function formatStatUnit(value, unit) {
  if (value == null || value === '') return '';
  const u = String(unit || '').trim().toLowerCase();
  if (u === 'percent' || u === '%') return `${value}%`;
  if (!u) return `${value}`;
  return `${value} ${unit}`;
}

// PX Release 5, Part 3 (confirmed defect): report.publication_readiness.status
// and report.ai_governance.approval are raw internal enums
// ('PASS_FOR_SYNTHETIC_DEMONSTRATION', 'APPROVED_SYNTHETIC_DEMONSTRATION')
// that were being interpolated straight into the Executive Brief and
// Assurance spreads. This labels the real, existing status in reader
// language rather than inventing a new field — the known map covers the
// real values these fields carry today; the fallback converts any future
// SCREAMING_SNAKE_CASE status into a sentence-case label so a raw enum can
// never reach the rendered page again.
const KNOWN_STATUS_ENUMS = {
  PASS_FOR_SYNTHETIC_DEMONSTRATION: 'Approved for synthetic demonstration use',
  APPROVED_SYNTHETIC_DEMONSTRATION: 'Approved for synthetic demonstration use',
};
export function humanizeStatusEnum(status, fallback = 'Not assessed') {
  if (!status) return fallback;
  if (KNOWN_STATUS_ENUMS[status]) return KNOWN_STATUS_ENUMS[status];
  return String(status).toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
}

export function riskColorFor(score) {
  const n = Number(score) || 0;
  if (n < 58) return vrdsTokens.riskColors.critical;
  if (n < 70) return vrdsTokens.riskColors.medium;
  return vrdsTokens.riskColors.low;
}

// Voice Thread: the VoiceInsights signature device (VPPX Release 1 Part 15) —
// a small five-bar waveform, matching the existing brand mark
// (branding.logo_mark: "five-bar-voice-wave"), placed beside every direct
// respondent quotation and nowhere else.
export function voiceThreadIcon() {
  const bars = [6, 12, 16, 10, 5];
  const x = bars.map((h, i) => `<rect x="${i * 5}" y="${16 - h}" width="3" height="${h}" rx="1" fill="var(--vpds-gold500)"/>`).join('');
  return `<svg class="voice-thread" width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">${x}</svg>`;
}

// Editorial Division Release — OECD-DAC / Theory-of-Change shaping helpers.
// dedicated-binary-renderer.js's PDF export already formats full.oecd_dac
// and full.rbm_results_framework into plain text lines; the interactive HTML
// spine never rendered them at all (Editorial Constitution Article VI). Both
// paths now shape the SAME real computed data through these two functions,
// so the office export and the page itself can never drift onto different
// wording for the same underlying figures.
export function formatOecdDacLines(oecdDac) {
  return (oecdDac || []).map(x => `${x.criterion}: ${x.assessment} (${x.score}/100). ${x.management_implication}`);
}
export function formatRbmLines(rbm) {
  if (!rbm) return [];
  return [
    `Impact: ${rbm.impact || ''}`,
    ...(rbm.outcomes || []).map(x => `${x.id}: ${x.statement} — indicators ${(x.indicators || []).join(', ')}`),
    ...(rbm.outputs || []).map(x => `${x.id}: ${x.statement}`),
    `Assumptions: ${(rbm.assumptions || []).join('; ')}`,
    `Means of verification: ${(rbm.means_of_verification || []).join('; ')}`,
  ];
}
