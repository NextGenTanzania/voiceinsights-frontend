// Final Acceptance, Parts 6/8: full 26-spread physical-page mapping for all
// 16 samples, reusing the PDFs qa-full-catalogue.mjs already rendered (no
// re-render needed). Matches each spread's real spreadHeader() overline
// label sequentially (cursor advances forward after each match) rather
// than globally, because 3 real spread ids — priority-matrix, decisions-a,
// decisions-b — all render the identical overline "DECISION INTELLIGENCE"
// (confirmed by direct source read of publication-spread-composer.js) and
// a global first-match search would misattribute all three to one page.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BACKEND_SRC = 'C:/VIA/voiceinsights-app/backend/src';
const { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } = await import(pathToFileURL(path.join(BACKEND_SRC, 'flagship-sample-library.js')));
const { composePublicationSpreads } = await import(pathToFileURL(path.join(BACKEND_SRC, 'publication-spread-composer.js')));

const EVIDENCE_ROOT = 'C:/VIA/voiceinsights-app/backend/review-evidence-full';

// Ordered list of {id, label} exactly as composePublicationSpreads builds
// them (verified against the array literal at publication-spread-composer.js
// line ~2453). 'cover' has no spreadHeader overline (confirmed by source
// read) so it is matched positionally (always physical page 1) instead.
const SPREAD_LABELS = [
  { id: 'cover', label: null },
  { id: 'inside-cover', label: 'PUBLICATION INFORMATION' },
  { id: 'executive-brief', label: 'EXECUTIVE BRIEF' },
  { id: 'key-messages', label: 'AT A GLANCE' },
  { id: 'hero-insight', label: 'HERO INSIGHT' },
  { id: 'national-context', label: 'NATIONAL CONTEXT' },
  { id: 'regional-equity', label: 'REGIONAL AND EQUITY STORY' },
  { id: 'evidence-story', label: 'HUMAN VOICE AND EVIDENCE' },
  { id: 'root-cause', label: 'ROOT-CAUSE ANALYSIS' },
  { id: 'scenarios', label: 'SCENARIOS AND OUTLOOK' },
  { id: 'priority-matrix', label: 'DECISION INTELLIGENCE' },
  { id: 'decision-options-tradeoffs', label: 'DECISION OPTIONS & TRADE-OFFS' },
  { id: 'decision-conditions', label: 'DECISION CONDITIONS' },
  { id: 'stakeholder-political-economy', label: 'STAKEHOLDER & POLITICAL ECONOMY MAP' },
  { id: 'behavioural-adoption-pathway', label: 'BEHAVIOURAL ADOPTION PATHWAY' },
  { id: 'system-effects-map', label: 'SYSTEM EFFECTS MAP' },
  { id: 'decision-under-uncertainty', label: 'DECISION UNDER UNCERTAINTY' },
  { id: 'decisions-a', label: 'DECISION INTELLIGENCE' },
  { id: 'roadmap', label: 'IMPLEMENTATION ROADMAP' },
  { id: 'decisions-b', label: 'DECISION INTELLIGENCE' },
  { id: 'risks', label: 'RISKS AND DEPENDENCIES' },
  { id: 'monitoring', label: 'MONITORING AND ACCOUNTABILITY' },
  { id: 'methodology', label: 'METHODOLOGY CANVAS' },
  { id: 'evidence-annex', label: 'EVIDENCE ANNEX' },
  { id: 'quality-gate', label: 'ASSURANCE' },
  { id: 'closing', label: 'CLOSING NOTE' },
];

// Spreads where the brief itself explicitly allows a real 2-physical-page
// shape (Part 1's formalized Decision Options A/B sequence is 2 SEPARATE
// spread ids, not counted here; this is about a single spread id spanning
// 2+ physical pages): Methodology may split into Research Design + Data
// Quality (Release 5 Part 3), Evidence Annex may paginate across 2 pages
// if the real evidence count requires it (same source). Any other spread
// showing pageCount > 1 is a candidate accidental-continuation defect.
const INTENTIONALLY_SPLITTABLE = new Set(['methodology', 'evidence-annex']);

async function run() {
  const summary = [];
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const key = sample.key;
    const pdfPath = path.join(EVIDENCE_ROOT, key, `${key}.pdf`);
    if (!fs.existsSync(pdfPath)) { console.error('MISSING PDF for', key); continue; }
    const model = buildFlagshipSampleReport(key);
    const { spreads } = composePublicationSpreads(model);
    const realIds = new Set(spreads.map(s => s.id));

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const pageTexts = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p);
      const tc = await pg.getTextContent();
      pageTexts.push(tc.items.map(i => i.str).join(' '));
    }

    const activeLabels = SPREAD_LABELS.filter(s => realIds.has(s.id));
    let cursor = 0; // 0-based page index to search from
    const starts = [];
    for (const { id, label } of activeLabels) {
      if (label === null) { starts.push({ id, startPage: 1 }); cursor = 1; continue; }
      const idx = pageTexts.findIndex((t, i) => i >= cursor && t.slice(0, 130).includes(label));
      if (idx === -1) { starts.push({ id, startPage: -1 }); continue; }
      starts.push({ id, startPage: idx + 1 });
      cursor = idx + 1;
    }
    const ranges = starts.map((s, i) => {
      const next = starts.slice(i + 1).find(x => x.startPage > 0);
      const endPage = (s.startPage > 0 && next) ? next.startPage - 1 : s.startPage;
      const pageCount = s.startPage > 0 ? (endPage - s.startPage + 1) : 0;
      return { ...s, endPage, pageCount, intentionalSplit: INTENTIONALLY_SPLITTABLE.has(s.id) };
    });

    const unaccountedOverflow = ranges.filter(r => r.pageCount > 1 && !r.intentionalSplit);
    const unmatched = ranges.filter(r => r.startPage === -1);
    summary.push({ key, profile: sample.profile, physicalPageCount: doc.numPages, spreadCount: spreads.length, ranges, unaccountedOverflow, unmatched });
    console.log(key, 'pdfPages=' + doc.numPages, 'spreads=' + spreads.length,
      'unaccountedOverflow=' + unaccountedOverflow.map(r => `${r.id}(${r.pageCount}p)`).join(',') || 'none',
      'unmatched=' + unmatched.map(r => r.id).join(',') || 'none');
  }
  fs.writeFileSync(path.join(EVIDENCE_ROOT, 'pagination-map.json'), JSON.stringify(summary, null, 2));
  console.log('ALL DONE —', summary.length, 'samples mapped');
}
run().catch(err => { console.error(err); process.exit(1); });
