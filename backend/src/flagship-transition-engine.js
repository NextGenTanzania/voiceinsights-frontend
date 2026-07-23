// Flagship Transition Engine — PX Release 5.1, Part 2 (Editorial Memory).
//
// Selects one short bridge line between consecutive spine spreads, grounded
// in real, checkable linkage between them (does this spread share the same
// region as the previous one? the same recommendation priority tier?) —
// never a flat hash pick, and never quoting more than a name/number from
// the prior spread (a region name, a priority word), so it can't restate a
// prior sentence and trip the editorial validator's repeated-language rule.
//
// Pure and deterministic: the caller (publication-spread-composer.js)
// extracts the real linkage values (region, priority tier) for the current
// and previous spine spread — that extraction is composer business logic,
// not this module's concern — and this module only decides which of the
// three linkage types applies and which already-written phrasing to use.
//
// Extensibility note: selectTransition() returns { linkageType, index, text }
// — the decision (which linkage type, which pool index) is already separate
// from the rendered English sentence. A future localization layer could
// swap the 3 phrasing pools for translated ones keyed by the same
// (linkageType, index) pair without touching the selection logic at all.
export const FLAGSHIP_TRANSITION_ENGINE_VERSION = 'flagship-transition-engine-v1';

// Product Experience Evolution Phase 2 (World-Class Publications): every
// pool entry now carries a `shape` label alongside its `render` function —
// a real, checkable classification of the sentence's rhetorical
// construction (does it lead with a callback verb? a negation? a
// conditional?), used below to stop two CONSECUTIVE picks from sharing one
// shape even when their exact wording differs. This is what an Editorial
// Board Release review found missing: no two of the original 6
// priority-tier variants repeated verbatim, but all 6 shared one shape —
// "[refer back to the tier] + [transition verb] + [this section]" — which
// a careful reader noticed as a pattern in its own right across a run of
// consecutive same-priority-tier pages.

// 6 variants each (not 4): several spine spreads legitimately share the
// SAME linked recommendation (recommendations[0], always CRITICAL by
// construction) — confirmed by direct render check that 5 spine spreads in
// one report can share one priority tier, which pigeonholes a 4-item pool
// into a guaranteed repeat despite the anti-repeat/dedup logic below.
const REGION_TRANSITIONS = [
  { shape: 'callback-verb', render: region => `This pattern is reinforced in ${region}, examined in more depth here.` },
  { shape: 'callback-verb', render: region => `Building on what ${region} already showed, this section develops the point further.` },
  { shape: 'callback-verb', render: region => `The ${region} signal introduced earlier resurfaces here, now with its fuller implications.` },
  { shape: 'callback-verb', render: region => `Returning to ${region}: the same divide carries through into what follows.` },
  { shape: 'subject-first', render: region => `${region} carries the thread forward here, not as a new example but a continuation of the same one.` },
  { shape: 'callback-verb', render: region => `The distance already measured in ${region} is what this section now works through in full.` },
];

// Editorial Board Release follow-up: the 10 variants below are deliberately
// built from distinct sentence shapes (a conditional, a negation, a direct
// address to the reader, a consequence-first framing, a contrast, and the
// original callback-verb form), not just re-worded synonyms of the same
// template, so the *shape* varies across a run of consecutive pages, not
// only the wording. See selectTransition()'s shape-diversity check below
// for how this is enforced, not merely offered.
const PRIORITY_TRANSITIONS = [
  { shape: 'callback-verb', render: tier => `The same ${tier.toLowerCase()}-tier urgency established earlier carries into this section.` },
  { shape: 'callback-verb', render: tier => `This section addresses another ${tier.toLowerCase()}-priority thread raised previously.` },
  { shape: 'callback-verb', render: tier => `Consistent with the ${tier.toLowerCase()} priority already established, this builds directly on it.` },
  { shape: 'callback-verb', render: tier => `The ${tier.toLowerCase()}-tier stakes introduced earlier extend into what follows here.` },
  // VPX Release 1: the prior wording ("Nothing about the [tier] priority
  // changes here — only how directly it is addressed") was named directly
  // in an independent editorial review as content-free meta-commentary.
  // Reworded to state what actually changes page to page: the decision
  // itself stays fixed; what changes is what this specific page does with it.
  { shape: 'contrast', render: tier => `The ${tier.toLowerCase()}-tier decision itself does not change here — what changes is what this page does with it.` },
  { shape: 'callback-verb', render: tier => `This section stays with the ${tier.toLowerCase()}-tier decision already on the table, carried through in more detail.` },
  // Conditional opening — addresses the reader's own reasoning rather than
  // narrating the document's structure.
  { shape: 'conditional', render: tier => `If the ${tier.toLowerCase()}-tier decision above still stands, this is what it looks like applied in practice.` },
  // Negation-first — states what this page is NOT before what it is.
  { shape: 'negation', render: tier => `Nothing new is being raised here — this is the same ${tier.toLowerCase()}-tier item, examined from a different angle.` },
  // Consequence-first — leads with what remains true rather than a
  // backward-looking callback verb.
  { shape: 'consequence', render: tier => `The ${tier.toLowerCase()}-tier exposure already on record is not reduced by anything in this section — only made more specific.` },
  // Direct address — speaks to the reader/leadership directly rather than
  // describing the publication's own movement.
  { shape: 'direct-address', render: tier => `Leadership already has the ${tier.toLowerCase()}-tier signal; what follows is what it means in operational terms.` },
];

// VPX Release 1: the previous 6 variants never actually used the real
// priorQuestion string an independent editorial review confirmed was
// available but silently ignored — every fallback transition was pure
// commentary about the document's own structure ("this section turns to
// X", "the argument now moves to X") rather than substance. priorQuestion
// (flagship-narrative-arc.js, NARRATIVE_ARC_STAGES) is a real, already-
// declared question the prior spine spread answered; quoting it directly
// gives the reader something concrete to carry forward instead of meta-
// narration. Only the very first spine spread (national-context) has no
// real priorQuestion (nothing precedes it) — each variant below degrades
// honestly to a plain scene-setting line in that one case, never inventing
// a question that doesn't exist.
const GENERIC_TRANSITIONS = [
  { shape: 'question-callback', render: (priorQuestion, stage) => priorQuestion
    ? `The previous page left one real question open — ${priorQuestion} — and ${stage.toLowerCase()} is where this publication answers it.`
    : `This publication opens by establishing ${stage.toLowerCase()}, the ground everything else builds on.` },
  { shape: 'question-quote', render: (priorQuestion, stage) => priorQuestion
    ? `"${priorQuestion}" is the question ${stage.toLowerCase()} exists to answer.`
    : `Before anything else, this publication has to establish ${stage.toLowerCase()}.` },
  { shape: 'question-callback', render: (priorQuestion, stage) => priorQuestion
    ? `Rather than move past it, this section stays with the last question raised — ${priorQuestion} — by working through ${stage.toLowerCase()}.`
    : `${stage} is the starting point the rest of this publication is built on.` },
  { shape: 'stage-first', render: (priorQuestion, stage) => priorQuestion
    ? `${stage} picks up exactly where the last page left off: ${priorQuestion}`
    : `This publication begins with ${stage.toLowerCase()}, before any finding or decision is introduced.` },
  { shape: 'question-callback', render: (priorQuestion, stage) => priorQuestion
    ? `The last page's open question — ${priorQuestion} — gets its answer here, in ${stage.toLowerCase()}.`
    : `${stage} comes first because everything that follows depends on it.` },
  { shape: 'question-quote', render: (priorQuestion, stage) => priorQuestion
    ? `That unresolved question — ${priorQuestion} — is exactly what ${stage.toLowerCase()} was built to close.`
    : `This section establishes ${stage.toLowerCase()}, ahead of everything the rest of the publication will argue.` },
];

// Deterministic modulo that never goes negative, matching the pattern
// already used in flagship-editorial-engine.js.
const wrap = (n, len) => ((n % len) + len) % len;

// { region, priorityTier } describe what the CURRENT spine spread is
// substantively about; `previous` describes the same for the immediately
// preceding spine spread. `seedIndex` is caller-supplied (the composer
// already has a deterministic per-spread seed available). `previousKey` is
// the {linkageType, index, shape} this function returned for the previous
// spine spread — used for the anti-repeat rule below.
export function selectTransition({ current, previous, currentArc, seedIndex, previousKey }) {
  let linkageType;
  if (current.region && previous.region && current.region === previous.region) linkageType = 'region';
  else if (current.priorityTier && previous.priorityTier && current.priorityTier === previous.priorityTier) linkageType = 'priority';
  else linkageType = 'generic';

  const pool = linkageType === 'region' ? REGION_TRANSITIONS : linkageType === 'priority' ? PRIORITY_TRANSITIONS : GENERIC_TRANSITIONS;
  let index = wrap(seedIndex, pool.length);

  // Same-index anti-repeat (Release 5.1 original rule): never re-render the
  // exact same pool entry immediately after itself.
  if (previousKey && previousKey.linkageType === linkageType && previousKey.index === index && pool.length > 1) {
    index = wrap(index + 1, pool.length);
  }

  // Same-SHAPE anti-repeat (Phase 2 addition): even a different index can
  // still share the previous pick's rhetorical shape. If it does, and the
  // pool actually contains an entry with a different shape, advance
  // (bounded by pool length so this can never loop forever) until a
  // different shape is found. If every entry in this pool shares one shape
  // (true of most of GENERIC_TRANSITIONS today), this is a safe no-op —
  // never fabricates a shape that doesn't exist in the pool.
  if (previousKey && previousKey.linkageType === linkageType && previousKey.shape === pool[index].shape) {
    const hasAlternateShape = pool.some(entry => entry.shape !== pool[index].shape);
    if (hasAlternateShape) {
      for (let guard = 0; guard < pool.length && pool[index].shape === previousKey.shape; guard++) {
        index = wrap(index + 1, pool.length);
      }
    }
  }

  const entry = pool[index];
  const text = linkageType === 'region' ? entry.render(current.region)
    : linkageType === 'priority' ? entry.render(current.priorityTier)
    : entry.render(currentArc?.priorQuestion, currentArc?.stage || 'this section');

  return { linkageType, index, shape: entry.shape, text };
}

export { REGION_TRANSITIONS, PRIORITY_TRANSITIONS, GENERIC_TRANSITIONS };
