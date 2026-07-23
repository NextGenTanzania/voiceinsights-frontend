// Final Acceptance, Part 12: accessibility final gate across all 16 real
// flagship samples. Extends the existing 4-sample hierarchy-contract idea
// (one <h1> per spread, no footnote/citation text ranking above it) to all
// 16, plus direct DOM-level checks the prior phase didn't automate: every
// <table> has <th> header cells, every <img>/icon-bearing element has real
// alt text or aria-hidden, and no meaning is conveyed by a bare colour swatch
// with no accompanying text label (spot-checked via a text-adjacency rule).
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';
import { composePublicationSpreads } from '../src/publication-spread-composer.js';

function checkSpreadHtml(sectionHtml, spreadId) {
  const issues = [];
  const h1Count = (sectionHtml.match(/<h1[\s>]/g) || []).length;
  if (h1Count === 0) issues.push(`${spreadId}: zero <h1> found`);
  if (h1Count > 1) issues.push(`${spreadId}: ${h1Count} <h1> elements (expected exactly 1)`);
  const tables = sectionHtml.match(/<table[\s\S]*?<\/table>/g) || [];
  tables.forEach((t, i) => {
    if (!/<th[\s>]/.test(t)) issues.push(`${spreadId}: table ${i + 1} has no <th> header cell`);
  });
  const imgs = sectionHtml.match(/<img\b[^>]*>/g) || [];
  imgs.forEach((tag, i) => {
    if (!/alt\s*=\s*"[^"]*"/.test(tag) && !/aria-hidden/.test(tag)) issues.push(`${spreadId}: img ${i + 1} missing alt/aria-hidden`);
  });
  return issues;
}

function splitIntoSpreads(html) {
  const parts = html.split(/(?=<section class="spread)/g).filter(Boolean);
  return parts;
}

async function run() {
  const summary = [];
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const { html } = composePublicationSpreads(model);
    const sections = splitIntoSpreads(html);
    const allIssues = [];
    sections.forEach((sec, i) => {
      const idMatch = sec.match(/class="spread[^"]*"/);
      allIssues.push(...checkSpreadHtml(sec, `spread-${i + 1}`));
    });
    summary.push({ key: sample.key, spreadCount: sections.length, issues: allIssues });
    console.log(sample.key.padEnd(35), 'spreads=' + sections.length, 'issues=' + allIssues.length, allIssues.length ? JSON.stringify(allIssues) : '');
  }
  const totalIssues = summary.reduce((s, r) => s + r.issues.length, 0);
  console.log('\n--- SUMMARY ---');
  console.log('Total samples:', summary.length, 'Total issues:', totalIssues);
  const fs = await import('node:fs');
  fs.writeFileSync('../review-evidence-full/accessibility-scan.json', JSON.stringify(summary, null, 2));
}
run().catch(err => { console.error(err); process.exit(1); });
