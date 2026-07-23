// Flagship Personality Lexicon — PX Release 5.1, Part 3.
//
// Grounded in the real sample.profile field (10 actual values across the
// 16-sample library — confirmed by direct audit: government, donor,
// humanitarian, board, corporate, ngo, research, interactive, evidence,
// un) — not the 16-name list from the request (Government/Donor/Research/
// Board/Humanitarian/Health/Education/Agriculture/Market Research/Customer
// Experience/Citizen Feedback/Employee Engagement/Monitoring/Evaluation/
// Annual Report/SDG Report), which mixes profile-, sector-, and
// report-type concepts that don't exist as one taxonomy in the governed
// model. Using the real field instead of inventing a parallel one that
// doesn't map onto any data.
//
// A light terminology substitution layer over ALREADY-WRITTEN sentences —
// not a new pool per profile. Facts (numbers, findings, evidence) are
// never touched by this module; only the institutional-address terms.
//
// Extensibility note: PERSONALITY_LEXICON is keyed by the real profile
// enum, not hardcoded into prose — a future donor- or government-specific
// publishing variant only needs a new key in this one table, never a
// change to the callers that read personalityFor()/possessiveFor().
export const FLAGSHIP_PERSONALITY_LEXICON_VERSION = 'flagship-personality-lexicon-v1';

export const PERSONALITY_LEXICON = {
  government: { leadershipTerm: 'government leadership', decisionNoun: 'directive' },
  donor: { leadershipTerm: 'donor leadership', decisionNoun: 'commitment' },
  humanitarian: { leadershipTerm: 'the humanitarian coordination team', decisionNoun: 'response decision' },
  board: { leadershipTerm: 'the Board', decisionNoun: 'resolution' },
  corporate: { leadershipTerm: 'corporate leadership', decisionNoun: 'decision' },
  ngo: { leadershipTerm: 'programme leadership', decisionNoun: 'action' },
  research: { leadershipTerm: 'the research team', decisionNoun: 'recommendation' },
  interactive: { leadershipTerm: 'the analytics team', decisionNoun: 'decision' },
  evidence: { leadershipTerm: 'the evidence review team', decisionNoun: 'determination' },
  un: { leadershipTerm: 'the UN coordination team', decisionNoun: 'resolution' },
};

const DEFAULT_ENTRY = { leadershipTerm: 'leadership', decisionNoun: 'decision' };

export function personalityFor(profile) {
  return PERSONALITY_LEXICON[profile] || DEFAULT_ENTRY;
}

// Possessive form of leadershipTerm ("the Board" -> "the Board's"), needed
// wherever a frame modifies a following noun ("X's attention...") rather
// than using the term as a bare subject ("X should protect...").
export function possessiveFor(profile) {
  const term = personalityFor(profile).leadershipTerm;
  return term.endsWith('s') ? `${term}'` : `${term}'s`;
}

// Final Acceptance review, Part 2: "profile-specific editorial emphasis"
// using ONE VoiceInsights design family, not five unrelated ones — so this
// is a hierarchy/ordering lookup, not new prose or new analysis. Grounded
// in the same real sample.profile field as PERSONALITY_LEXICON above; the
// 4 profiles the brief names explicitly (government/donor/humanitarian/
// board) get its own exact emphasis language, the other 6 real profiles
// in the catalogue get a defensible nearest match rather than an invented
// fifth category. `weightKeys` names the real decision_options.weights
// dimensions this profile already weighs highest (confirmed in the
// Decision Reasoning Architecture phase) — used to reorder, not
// fabricate, which real field a reader sees first.
export const EDITORIAL_EMPHASIS_LEXICON = {
  government: { label: 'Government emphasis', focus: 'authority, mandate, fiscal implications and institutional readiness', weightKeys: ['institutional_readiness', 'political_feasibility'] },
  donor: { label: 'Donor emphasis', focus: 'evidence strength, value for money, additionality and sustainability', weightKeys: ['evidence_strength', 'sustainability'] },
  humanitarian: { label: 'Humanitarian emphasis', focus: 'urgency, protection, access and operational speed', weightKeys: ['implementation_speed', 'equity'] },
  board: { label: 'Board emphasis', focus: 'strategic value, execution risk, governance and reversibility', weightKeys: ['risk', 'reversibility'] },
  corporate: { label: 'Board emphasis', focus: 'strategic value, execution risk, governance and reversibility', weightKeys: ['risk', 'reversibility'] },
  ngo: { label: 'Programme emphasis', focus: 'implementation feasibility, accountability and affordability', weightKeys: ['feasibility', 'affordability'] },
  research: { label: 'Research emphasis', focus: 'evidence strength and methodological rigour', weightKeys: ['evidence_strength', 'risk'] },
  interactive: { label: 'Analytical emphasis', focus: 'evidence strength and decision clarity', weightKeys: ['evidence_strength', 'expected_impact'] },
  evidence: { label: 'Evidence emphasis', focus: 'evidence strength and traceability', weightKeys: ['evidence_strength', 'sustainability'] },
  un: { label: 'Coordination emphasis', focus: 'institutional readiness, equity and accountability', weightKeys: ['institutional_readiness', 'equity'] },
};
const DEFAULT_EMPHASIS = { label: 'Editorial emphasis', focus: 'evidence strength and decision clarity', weightKeys: ['evidence_strength', 'expected_impact'] };

export function editorialEmphasisFor(profile) {
  return EDITORIAL_EMPHASIS_LEXICON[profile] || DEFAULT_EMPHASIS;
}
