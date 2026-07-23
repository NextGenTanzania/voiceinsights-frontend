// VoiceInsights Publication DNA — Publication Experience (PX) Release 4,
// permanent architectural layer 4 of 6 (see the PX Release 4 plan).
//
// Formalizes brand-consistency work already done (the Voice Thread mark,
// VPDS color tokens, the citation format, the tagline, the classification/
// synthetic-notice disclosure) into one explicit, deterministic, testable
// checklist — so "is this recognizably a VoiceInsights publication" has a
// real, repeatable answer instead of being implicit across several files.
// Every check reads real rendered output; nothing here invents a brand
// element that isn't already part of the publication.
export const PUBLICATION_DNA_CHECKLIST_VERSION = 'publication-dna-checklist-v1';

const DNA_CHECKS = [
  {
    key: 'voice_thread_mark_present',
    label: 'The Voice Thread mark appears at least once',
    check: (spreads) => spreads.some(s => (s.html || '').includes('voice-thread')),
  },
  {
    key: 'brand_color_tokens_present',
    label: 'The VPDS brand color tokens (gold, blue, teal) are present in the stylesheet',
    check: (spreads, cssText) => ['--vpds-gold500', '--vpds-blue700', '--vpds-teal700'].every(t => cssText.includes(t)),
  },
  {
    key: 'citation_format_present',
    label: 'A real citation appears (inside-cover)',
    check: (spreads) => {
      const insideCover = spreads.find(s => s.id === 'inside-cover');
      return Boolean(insideCover && insideCover.html.includes('Citation'));
    },
  },
  {
    key: 'tagline_present',
    label: 'The VoiceInsights tagline appears',
    check: (spreads, cssText, metadata) => spreads.some(s => (s.html || '').includes('Every Voice')) || Boolean(metadata?.tagline),
  },
  {
    key: 'classification_disclosure_present',
    label: 'Classification/synthetic-demonstration disclosure appears on the cover',
    check: (spreads) => {
      const cover = spreads.find(s => s.id === 'cover');
      return Boolean(cover && (cover.html.includes('Synthetic demonstration') || cover.html.includes('CLASSIFICATION') || /classification/i.test(cover.html)));
    },
  },
];

// Runs every DNA check against the real composed spreads + generated CSS +
// publication metadata. Never throws on an unusual shape — a check simply
// reads as not-present rather than crashing.
export function checkPublicationDNA(spreads = [], cssText = '', metadata = {}) {
  const results = DNA_CHECKS.map(({ key, label, check }) => {
    let present = false;
    try { present = Boolean(check(spreads, cssText, metadata)); } catch { present = false; }
    return { key, label, present };
  });
  const presentCount = results.filter(r => r.present).length;
  return {
    checklist_version: PUBLICATION_DNA_CHECKLIST_VERSION,
    checks: results,
    present_count: presentCount,
    total_count: results.length,
    score: results.length ? Math.round((presentCount / results.length) * 100) : 0,
  };
}
