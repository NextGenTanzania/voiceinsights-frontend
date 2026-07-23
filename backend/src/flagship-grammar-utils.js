// Deterministic subject-verb agreement guard for the flagship narrative
// templates. FINDING_FRAMES (flagship-sample-library.js) and
// EDITORIAL_LENSES (flagship-publication-intelligence.js) both assume their
// `subject` argument is a grammatically singular noun phrase ("X is
// reshaping...", "X now drives..."), but several of the 16 real blueprint
// subject lists end in a plural head noun or are a compound "X and Y"
// subject that takes a plural verb regardless of the singular-looking words
// around it.
//
// PLURAL_SUBJECT_HEAD_NOUNS is enumerated from a full audit of the actual 80
// subject phrases across all 16 blueprints (5 subjects x 16 sectors,
// confirmed complete) — not a general grammar/NLP parser. A suffix rule
// ("ends in s") was deliberately rejected: 'segment economics' ends in "s"
// but is a mass noun and stays singular ("economics is"), so a suffix
// heuristic would misfire. Extracted into its own module (rather than
// living in either narrative file) because flagship-sample-library.js
// already imports from flagship-publication-intelligence.js — a shared
// dependency avoids introducing a circular import between the two.
export const FLAGSHIP_GRAMMAR_UTILS_VERSION = 'flagship-grammar-utils-v1';

const PLURAL_SUBJECT_HEAD_NOUNS = new Set(['gaps', 'outcomes', 'co-benefits', 'transitions']);

export function isPluralSubject(subject) {
  const words = String(subject).toLowerCase().trim().split(/\s+/);
  if (words.includes('and')) return true; // compound subject: "trust and transparency are..."
  return PLURAL_SUBJECT_HEAD_NOUNS.has(words[words.length - 1]);
}

export function agree(subject, singular, plural) {
  return isPluralSubject(subject) ? plural : singular;
}

// Several narrative templates append a generic noun after a sector name
// ("${sector} performance", "${sector} delivery"), but 3 of the 16 real
// sector names already end in exactly that word ('Enterprise Performance',
// 'Public Service Delivery', 'Programme Delivery') — producing "Enterprise
// Performance performance" / "Public Service Delivery delivery" duplicates.
// Checked against the sector string itself (not a per-sector exception
// list) so it stays correct for any future sector name too.
export function sectorWith(sectorLower, noun) {
  return new RegExp(`\\b${noun}s?$`, 'i').test(sectorLower) ? sectorLower : `${sectorLower} ${noun}`;
}
