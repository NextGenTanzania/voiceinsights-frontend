// Browser Rendering V2, Release 2.1, Part 6: Rendered Page QA tests.
// Verifies the physical-page-aware analyzer against synthetic fixtures that
// reproduce the real, confirmed Release 2 defect pattern (25 physical pages
// for 20 composed spreads; defects on pages 12, 14, 16, 18, 19) — not a
// mock, the actual observed shape from the live preview render.
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRenderedPages, release2ConfirmedDefectFixture, RENDERED_PAGE_QA_VERSION } from '../src/rendered-page-qa.js';

test('the Release 2 confirmed-defect fixture pinpoints the exact defect type on each affected physical page', () => {
  const pages = release2ConfirmedDefectFixture();
  const report = analyzeRenderedPages(pages, 20);
  assert.equal(report.qa_version, RENDERED_PAGE_QA_VERSION);
  assert.equal(report.physical_page_count, 25);
  assert.equal(report.composed_spread_count, 20);
  assert.equal(report.page_count_gap, 5);
  assert.equal(report.passed, false);
  // The three confirmed defect types, pinned to their exact real page numbers.
  assert.deepEqual(report.orphan_heading_pages, [12, 16], 'orphaned kicker pages');
  assert.deepEqual(report.split_component_pages, [14, 15, 18], 'decision field split mid-value across a page boundary');
  assert.deepEqual(report.isolated_card_pages, [19], 'the isolated third decision card');
  // decisions-a, roadmap and decisions-b each genuinely spanning more
  // physical pages than one composed spread should (the direct consequence
  // of the defects above) is itself a real, correct overflow signal.
  assert.deepEqual(report.overflow_pages, [13, 14, 15, 17, 19]);
  assert.deepEqual(report.near_blank_pages, [12, 16], 'an orphaned kicker page is also, correctly, a near-blank page');
  assert.deepEqual(report.affected_page_numbers, [12, 13, 14, 15, 16, 17, 18, 19]);
});

test('a clean render (no orphaned kickers, no split fields, no isolated cards) passes with zero affected pages', () => {
  const pages = Array.from({ length: 20 }, (_, i) => ({
    pageNumber: i + 1,
    composedSpreadIds: [`spread-${i + 1}`],
    wordCount: 150,
    headingCount: 1,
    kickerPresent: true,
    headingPresent: true,
    contentAreaFilledRatio: 0.72,
    componentBoundaries: [],
    cardsOnPage: 0,
  }));
  const report = analyzeRenderedPages(pages, 20);
  assert.equal(report.passed, true);
  assert.equal(report.physical_page_count, report.composed_spread_count);
  assert.equal(report.page_count_gap, 0);
  assert.deepEqual(report.affected_page_numbers, []);
});

test('a page with a kicker but no heading is an orphan-heading page even outside the fixture', () => {
  const pages = [{ pageNumber: 1, composedSpreadIds: ['x'], kickerPresent: true, headingPresent: false, contentAreaFilledRatio: 0.1, componentBoundaries: [], cardsOnPage: 0 }];
  const report = analyzeRenderedPages(pages, 1);
  assert.deepEqual(report.orphan_heading_pages, [1]);
});

test('a spread spanning more than one physical page is reported as overflow on every page beyond its first', () => {
  const pages = [
    { pageNumber: 1, composedSpreadIds: ['long-spread'], contentAreaFilledRatio: 1, componentBoundaries: [], cardsOnPage: 0 },
    { pageNumber: 2, composedSpreadIds: ['long-spread'], contentAreaFilledRatio: 0.4, componentBoundaries: [], cardsOnPage: 0 },
  ];
  const report = analyzeRenderedPages(pages, 1);
  assert.deepEqual(report.overflow_pages, [2]);
  assert.equal(report.page_count_gap, 1);
});

test('near-blank pages are flagged by fill ratio alone, independent of other signals', () => {
  const pages = [{ pageNumber: 5, composedSpreadIds: ['x'], contentAreaFilledRatio: 0.02, kickerPresent: false, headingPresent: true, componentBoundaries: [], cardsOnPage: 0 }];
  const report = analyzeRenderedPages(pages, 1);
  assert.deepEqual(report.near_blank_pages, [5]);
});

test('page_fill_estimate is the mean content-area-filled ratio across all physical pages', () => {
  const pages = [
    { pageNumber: 1, composedSpreadIds: ['a'], contentAreaFilledRatio: 1, componentBoundaries: [], cardsOnPage: 0 },
    { pageNumber: 2, composedSpreadIds: ['b'], contentAreaFilledRatio: 0.5, componentBoundaries: [], cardsOnPage: 0 },
  ];
  const report = analyzeRenderedPages(pages, 2);
  assert.equal(report.page_fill_estimate, 0.75);
});

test('analyzeRenderedPages tolerates an empty page list without throwing', () => {
  assert.doesNotThrow(() => analyzeRenderedPages([], 0));
  const report = analyzeRenderedPages([], 0);
  assert.equal(report.physical_page_count, 0);
  assert.equal(report.passed, true);
});
