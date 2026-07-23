// Flagship Narrative Arc — PX Release 5.1, Part 1.
//
// A declared (not computed) classification of every real spread ID
// produced by composePublicationSpreads (publication-spread-composer.js)
// into its logical place in a continuous editorial argument. This module
// classifies only — it renders nothing and does not reorder the physical
// spread sequence, which stays exactly as PX Release 3 established it
// (organized by reading depth: a 90-second executive layer before the
// full-depth body, the way a real flagship publication's executive summary
// precedes its detailed argument).
//
// Three honest categories, not one forced mapping:
//   - "spine"    — a real stage in the Context -> Closing Reflection arc.
//   - "preview"  — compresses the whole spine early (executive-brief,
//                  key-messages), a real editorial device, not a gap.
//   - null       — appendix-tier spreads (cover, inside-cover, methodology,
//                  evidence-annex, quality-gate) that sit outside the
//                  argument entirely, the same way front/back matter does
//                  in a real flagship publication. arcContextFor returns
//                  null for these rather than forcing a stage onto them.
//
// Extensibility note: `stage` is an identifier a caller branches on
// (composer CSS classes, benchmark checks); `priorQuestion`/`nextQuestion`
// are the only user-facing display strings this module carries, kept
// structurally separate from `stage`. That separation is deliberate — a
// future localization layer (multilingual publications) would only need to
// translate the question strings, never touch `stage` or the spread-ID
// keys this table is addressed by. Not building translation now; keeping
// the seam clean so adding it later doesn't require restructuring this table.
export const FLAGSHIP_NARRATIVE_ARC_VERSION = 'flagship-narrative-arc-v1';

// The 12 stages requested, in argument order. Two spread IDs may share a
// stage (decisions-a/decisions-b both develop "Priority Decisions";
// regional-equity joins evidence-story under "Evidence" as its geographic
// dimension) — that reflects the real composer output, not an invented gap.
export const NARRATIVE_ARC_STAGES = [
  { spreadId: 'national-context', stage: 'Context', editorialRole: 'grounds',
    priorQuestion: null, nextQuestion: 'What problem does this evidence point to?' },
  { spreadId: 'root-cause', stage: 'Problem', editorialRole: 'develops',
    priorQuestion: 'What is the real scope and scale of this publication?', nextQuestion: 'What does the evidence show?' },
  { spreadId: 'evidence-story', stage: 'Evidence', editorialRole: 'develops',
    priorQuestion: 'What is driving this problem?', nextQuestion: 'How does this evidence vary by geography?' },
  { spreadId: 'regional-equity', stage: 'Evidence', editorialRole: 'develops',
    priorQuestion: 'What does the evidence show at the national level?', nextQuestion: 'What does this evidence mean for decision-makers?' },
  { spreadId: 'hero-insight', stage: 'Interpretation', editorialRole: 'develops',
    priorQuestion: 'What does the evidence show?', nextQuestion: 'What happens if this goes unaddressed?' },
  { spreadId: 'scenarios', stage: 'Consequences', editorialRole: 'develops',
    priorQuestion: 'What is the central finding this publication rests on?', nextQuestion: 'What are the realistic options from here?' },
  { spreadId: 'priority-matrix', stage: 'Strategic Options', editorialRole: 'develops',
    priorQuestion: 'What happens under each realistic path?', nextQuestion: 'Which decisions should leadership prioritise first?' },
  { spreadId: 'decisions-a', stage: 'Priority Decisions', editorialRole: 'develops',
    priorQuestion: 'Which options carry the most weight?', nextQuestion: 'What do the remaining priority decisions require?' },
  { spreadId: 'decisions-b', stage: 'Priority Decisions', editorialRole: 'develops',
    priorQuestion: 'What do the top priority decisions require?', nextQuestion: 'How will these decisions actually be delivered?' },
  { spreadId: 'roadmap', stage: 'Implementation', editorialRole: 'develops',
    priorQuestion: 'What has leadership decided to prioritise?', nextQuestion: 'What could prevent this from working?' },
  { spreadId: 'risks', stage: 'Risk', editorialRole: 'develops',
    priorQuestion: 'How will these decisions be delivered?', nextQuestion: 'How will progress actually be verified?' },
  { spreadId: 'monitoring', stage: 'Monitoring', editorialRole: 'develops',
    priorQuestion: 'What could prevent delivery?', nextQuestion: 'What does success look like from here?' },
  { spreadId: 'closing', stage: 'Future Outlook & Closing Reflection', editorialRole: 'concludes',
    priorQuestion: 'How will progress be verified?', nextQuestion: null },
];

const PREVIEW_SPREAD_IDS = new Set(['executive-brief', 'key-messages']);
const ARC_BY_SPREAD_ID = new Map(NARRATIVE_ARC_STAGES.map(entry => [entry.spreadId, entry]));

// Ordered list of the arc's own spread IDs — used by the transition engine
// (Part 2) to find "the previous spine spread" for a given spread.
export const SPINE_SPREAD_ORDER = NARRATIVE_ARC_STAGES.map(e => e.spreadId);

export function arcContextFor(spreadId) {
  if (PREVIEW_SPREAD_IDS.has(spreadId)) {
    return { category: 'preview', stage: null, editorialRole: 'previews', priorQuestion: null, nextQuestion: null };
  }
  const spine = ARC_BY_SPREAD_ID.get(spreadId);
  if (!spine) return null; // appendix-tier or the cover — outside the narrative spine, by design
  return { category: 'spine', ...spine };
}
