// Rendered Page QA — Browser Rendering V2, Release 2.1, Part 6.
//
// The lesson this whole arc is built on: composed-spread count and HTML
// structure cannot predict real PDF pagination. The first genuine Browser
// Rendering preview validated cleanly on every HTML-structural editorial
// check (editorial-intelligence-validator.js) and still produced three
// confirmed pagination defects — an orphaned kicker page, a decision field
// split mid-sentence across a page boundary, and an isolated third decision
// card — none of which any HTML-only check could have caught, because they
// only exist once a real browser engine actually paginates the content.
//
// This module is therefore deliberately NOT another HTML heuristic. Its
// input contract is real per-physical-page facts — the same shape of
// information obtained this session by directly inspecting the rendered
// Release 2 PDF page by page. Wiring an automated extractor (parsing a
// generated PDF's per-page text/layout, or per-page screenshots) is future
// work and would require a new PDF-parsing dependency, which Release 2.1 is
// explicitly scoped not to introduce; until that lands, page facts are
// supplied by whatever inspected the actual rendered output — an agent
// reading the PDF, or a future automated extractor emitting this same
// shape. The analysis logic itself does not care which.
export const RENDERED_PAGE_QA_VERSION = 'rendered-page-qa-v1';

// A physical-page fact record, as produced by inspecting one real page of a
// rendered PDF:
//   {
//     pageNumber: 12,
//     composedSpreadIds: ['decisions-a'],   // which composed spread(s) contributed content to this physical page
//     wordCount: 4,                         // real word count of the visible text on this physical page
//     headingCount: 0,                      // number of H1s visible on this physical page
//     kickerPresent: true,                  // a kicker/brand-strip is visible on this physical page
//     headingPresent: false,                // an H1 is visible on this physical page
//     contentAreaFilledRatio: 0.03,         // 0..1, fraction of the printable area actually covered
//     componentBoundaries: [                // components whose box starts or ends on this physical page
//       { type: 'decision_field', label: 'Monitoring', startsHere: false, endsHere: true, valueTruncated: true },
//     ],
//     cardsOnPage: 1,                       // decision-card (or similarly atomic card) count fully or partially on this page
//   }

const NEAR_BLANK_FILL_RATIO = 0.15;
const OVERFLOW_FILL_RATIO = 1.0; // a page whose measured content exceeds the printable area is itself an overflow signal upstream; pages array should never contain one, but guarded defensively below.

function isOrphanKickerPage(pageFact) {
  return Boolean(pageFact.kickerPresent) && !pageFact.headingPresent;
}

function splitComponentsOnPage(pageFact) {
  return (pageFact.componentBoundaries || []).filter(c => c.valueTruncated || (c.startsHere && !c.endsHere) || (!c.startsHere && c.endsHere));
}

// Part 6: the aggregate report. Every count below traces to a specific
// affected physical page number — never a vague "N issues found."
export function analyzeRenderedPages(pageFacts = [], composedSpreadCount = 0) {
  const physicalPageCount = pageFacts.length;
  const pageCountGap = physicalPageCount - composedSpreadCount;

  const overflowPages = [];
  const nearBlankPages = [];
  const orphanHeadingPages = [];
  const isolatedCardPages = [];
  const splitComponentPages = [];

  // A composed spread that spans more than one physical page is an overflow
  // page for every physical page beyond its first.
  const pagesBySpread = new Map();
  for (const page of pageFacts) {
    for (const spreadId of page.composedSpreadIds || []) {
      if (!pagesBySpread.has(spreadId)) pagesBySpread.set(spreadId, []);
      pagesBySpread.get(spreadId).push(page.pageNumber);
    }
  }
  for (const [, pages] of pagesBySpread) {
    if (pages.length > 1) overflowPages.push(...pages.slice(1));
  }

  for (const page of pageFacts) {
    if ((page.contentAreaFilledRatio ?? 1) < NEAR_BLANK_FILL_RATIO) nearBlankPages.push(page.pageNumber);
    if (isOrphanKickerPage(page)) orphanHeadingPages.push(page.pageNumber);
    const splits = splitComponentsOnPage(page);
    if (splits.length) splitComponentPages.push(page.pageNumber);
    // A card is isolated when exactly one card is fully alone on an
    // otherwise low-fill page — the confirmed page-19 shape (a single
    // decision card sharing its page with nothing else).
    if ((page.cardsOnPage || 0) === 1 && (page.contentAreaFilledRatio ?? 1) < 0.6 && (page.composedSpreadIds || []).length === 1) {
      isolatedCardPages.push(page.pageNumber);
    }
  }

  const totalFill = pageFacts.reduce((sum, p) => sum + (p.contentAreaFilledRatio ?? 0), 0);
  const pageFillEstimate = physicalPageCount ? Math.round((totalFill / physicalPageCount) * 100) / 100 : null;

  const affectedPageNumbers = [...new Set([
    ...overflowPages, ...nearBlankPages, ...orphanHeadingPages, ...isolatedCardPages, ...splitComponentPages,
  ])].sort((a, b) => a - b);

  return {
    qa_version: RENDERED_PAGE_QA_VERSION,
    composed_spread_count: composedSpreadCount,
    physical_page_count: physicalPageCount,
    page_count_gap: pageCountGap,
    overflow_page_count: overflowPages.length,
    overflow_pages: overflowPages,
    near_blank_page_count: nearBlankPages.length,
    near_blank_pages: nearBlankPages,
    split_component_count: splitComponentPages.length,
    split_component_pages: splitComponentPages,
    orphan_heading_count: orphanHeadingPages.length,
    orphan_heading_pages: orphanHeadingPages,
    isolated_card_count: isolatedCardPages.length,
    isolated_card_pages: isolatedCardPages,
    page_fill_estimate: pageFillEstimate,
    affected_page_numbers: affectedPageNumbers,
    passed: affectedPageNumbers.length === 0,
  };
}

// Reproduces the exact, real Release 2 defect pattern found this session by
// directly reading the rendered PDF (25 physical pages for 20 composed
// spreads; confirmed defects on pages 12, 14, 16, 18, 19) as a fixture other
// code (and tests) can reuse without re-deriving it by hand.
export function release2ConfirmedDefectFixture() {
  const blank = (pageNumber, composedSpreadIds, overrides = {}) => ({
    pageNumber, composedSpreadIds, wordCount: 120, headingCount: 1, kickerPresent: true, headingPresent: true,
    contentAreaFilledRatio: 0.7, componentBoundaries: [], cardsOnPage: 0, ...overrides,
  });
  return [
    blank(1, ['cover'], { kickerPresent: true, headingPresent: true, contentAreaFilledRatio: 0.9 }),
    blank(2, ['inside-cover']),
    blank(3, ['executive-brief']),
    blank(4, ['key-messages']),
    blank(5, ['hero-insight']),
    blank(6, ['national-context']),
    blank(7, ['regional-equity']),
    blank(8, ['evidence-story']),
    blank(9, ['root-cause']),
    blank(10, ['scenarios']),
    blank(11, ['priority-matrix']),
    // Page 12 (confirmed): orphaned kicker — only the Decision Intelligence
    // brand-strip/kicker rendered, the H1 fell to the next physical page.
    blank(12, ['decisions-a'], { kickerPresent: true, headingPresent: false, wordCount: 4, contentAreaFilledRatio: 0.03 }),
    blank(13, ['decisions-a'], { kickerPresent: false, headingPresent: true }),
    // Page 14 (confirmed): a decision field's value split mid-sentence.
    blank(14, ['decisions-a'], {
      componentBoundaries: [{ type: 'decision_field', label: 'Monitoring', startsHere: true, endsHere: false, valueTruncated: true }],
    }),
    blank(15, ['decisions-a'], {
      componentBoundaries: [{ type: 'decision_field', label: 'Monitoring', startsHere: false, endsHere: true, valueTruncated: true }],
    }),
    // Page 16 (confirmed): second orphaned kicker.
    blank(16, ['roadmap'], { kickerPresent: true, headingPresent: false, wordCount: 3, contentAreaFilledRatio: 0.02 }),
    blank(17, ['roadmap'], { kickerPresent: false, headingPresent: true }),
    // Page 18 (confirmed): another split decision field.
    blank(18, ['decisions-b'], {
      componentBoundaries: [{ type: 'decision_field', label: 'Dependency', startsHere: true, endsHere: false, valueTruncated: true }],
    }),
    // Page 19 (confirmed): the isolated third decision card.
    blank(19, ['decisions-b'], { cardsOnPage: 1, contentAreaFilledRatio: 0.31 }),
    blank(20, ['risks']),
    blank(21, ['monitoring']),
    blank(22, ['methodology']),
    blank(23, ['evidence-annex']),
    blank(24, ['quality-gate']),
    blank(25, ['closing']),
  ];
}
