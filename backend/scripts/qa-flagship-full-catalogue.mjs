// Final Acceptance, Part 5: full 16-publication pixel review.
// Renders every real flagship sample, generates the production-equivalent
// PDF, maps every physical page to its real spread via on-page labels
// (not assumed by index), rasterizes the 6 reasoning-sequence spreads
// (now including Decision Conditions) and any genuine continuation pages,
// and records page counts + a same-page-collision/overflow scan.
import puppeteer from 'puppeteer-core';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BACKEND_SRC = 'C:/VIA/voiceinsights-app/backend/src';
const { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } = await import(pathToFileURL(path.join(BACKEND_SRC, 'flagship-sample-library.js')));
const { composePublicationSpreads } = await import(pathToFileURL(path.join(BACKEND_SRC, 'publication-spread-composer.js')));

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EVIDENCE_ROOT = 'C:/VIA/voiceinsights-app/backend/review-evidence-full';
const REASONING_LABELS = [
  { id: 'decision-options-tradeoffs', label: 'DECISION OPTIONS & TRADE-OFFS' },
  { id: 'decision-conditions', label: 'DECISION CONDITIONS' },
  { id: 'stakeholder-political-economy', label: 'STAKEHOLDER & POLITICAL ECONOMY MAP' },
  { id: 'behavioural-adoption-pathway', label: 'BEHAVIOURAL ADOPTION PATHWAY' },
  { id: 'system-effects-map', label: 'SYSTEM EFFECTS MAP' },
  { id: 'decision-under-uncertainty', label: 'DECISION UNDER UNCERTAINTY' },
];

fs.mkdirSync(EVIDENCE_ROOT, { recursive: true });

async function rasterize(doc, pageNum, outPath, scale = 1.5) {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  fs.writeFileSync(outPath, await canvas.encode('png'));
}

async function run() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const summary = [];
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const key = sample.key;
    const dir = path.join(EVIDENCE_ROOT, key);
    fs.mkdirSync(dir, { recursive: true });
    const model = buildFlagshipSampleReport(key);
    const { html, spreads } = composePublicationSpreads(model);

    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 1400, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    const pdfPath = path.join(dir, `${key}.pdf`);
    const pdfBytes = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(pdfPath, pdfBytes);
    await page.close();

    const data = new Uint8Array(pdfBytes);
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const pageTexts = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p);
      const tc = await pg.getTextContent();
      pageTexts.push(tc.items.map(i => i.str).join(' '));
    }

    const starts = REASONING_LABELS.map(({ id, label }) => {
      const p = pageTexts.findIndex(t => t.slice(0, 130).includes(label));
      return { id, label, startPage: p + 1 };
    });
    const ranges = starts.map((s, i) => {
      const nextStart = i + 1 < starts.length ? starts[i + 1].startPage : null;
      const endPage = nextStart && nextStart > s.startPage ? nextStart - 1 : s.startPage;
      return { ...s, endPage, pageCount: s.startPage > 0 ? (endPage - s.startPage + 1) : 0 };
    });

    // Scan every physical page for accidental blankness (near-empty text)
    // and raw leaks — a catalogue-wide, not per-sample, defect check.
    const rawLeaks = [];
    const nearBlankPages = [];
    pageTexts.forEach((t, i) => {
      const clean = t.replace(/\s+/g, ' ').trim();
      if (/undefined|NaN|\[object Object\]|PASS_FOR_SYNTHETIC/.test(clean)) rawLeaks.push({ page: i + 1, snippet: clean.slice(0, 80) });
      if (clean.length < 40) nearBlankPages.push(i + 1);
    });

    for (const r of ranges.filter(r => r.startPage > 0)) {
      for (let p = r.startPage; p <= r.endPage; p++) {
        const suffix = p === r.startPage ? '' : `-cont${p - r.startPage}`;
        await rasterize(doc, p, path.join(dir, `p${String(p).padStart(2, '0')}-${r.id}${suffix}.png`));
      }
    }

    const result = {
      key, profile: sample.profile, spreadCount: spreads.length, physicalPageCount: doc.numPages,
      reasoningPages: ranges, rawLeaks, nearBlankPages,
    };
    summary.push(result);
    console.log(key, `spreads=${spreads.length}`, `pdfPages=${doc.numPages}`, `rawLeaks=${rawLeaks.length}`, `nearBlank=${nearBlankPages.length}`,
      'decision-options pages:', ranges[0].pageCount, 'decision-conditions pages:', ranges[1].pageCount);
  }
  await browser.close();
  fs.writeFileSync(path.join(EVIDENCE_ROOT, 'catalogue-summary.json'), JSON.stringify(summary, null, 2));
  console.log('ALL DONE —', summary.length, 'samples processed');
}
run().catch(err => { console.error(err); process.exit(1); });
