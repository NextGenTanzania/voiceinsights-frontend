// Final Acceptance, Part 7: export format acceptance across all 16 real
// flagship samples x 5 named formats (Premium PDF, Editable Word, Native
// PowerPoint, Statistical Excel, Interactive HTML). Calls the exact same
// renderer functions the real /api/public/flagship-sample-library/:key/
// export/:format route calls (confirmed by direct read of application.js
// lines ~1495-1520) rather than re-inventing a parallel check — this is
// the production export path, minus the HTTP layer itself.
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleDeck } from '../src/flagship-sample-library.js';
import { renderDocxBinary, renderXlsxBinary } from '../src/office-export-engine.js';
import { composePublicationRuntime } from '../src/publication-runtime.js';
import { buildDocumentComposition } from '../src/document-composer.js';
import { renderPdfBinary, renderPptxBinary } from '../src/dedicated-binary-renderer.js';

const ZIP_MAGIC = 'PK';
const results = [];

function scanForLeaks(text) {
  const leaks = [];
  if (/PASS_FOR_SYNTHETIC_DEMONSTRATION|PUBLICATION_READY|\[object Object\]|undefined|NaN(?!\w)/.test(text)) {
    const m = text.match(/PASS_FOR_SYNTHETIC_DEMONSTRATION|PUBLICATION_READY|\[object Object\]|undefined|NaN(?!\w)/);
    leaks.push(m[0]);
  }
  return leaks;
}

async function checkOne(key, format) {
  const model = buildFlagshipSampleReport(key);
  const report = model.report;
  let artifact, extraChecks = {};
  try {
    if (format === 'docx') {
      artifact = await renderDocxBinary(report, { report_id: `flagship-${key}` });
    } else if (format === 'xlsx') {
      artifact = await renderXlsxBinary(report, { report_id: `flagship-${key}` });
    } else if (format === 'pptx') {
      artifact = await renderPptxBinary({ report_id: `flagship-${key}`, metadata: { report_id: `flagship-${key}`, title: report.title, organization: 'VoiceInsights Africa' }, artifact: { slides: buildFlagshipSampleDeck(model) } }, { profile: model.sample.style });
    } else if (format === 'html') {
      // Unified Publication Runtime, Phase 4 (HTML step): mirrors
      // application.js's html branch — runtime.html directly, not the
      // retired flagship-interactive-html.js summary template.
      const runtime = composePublicationRuntime(model);
      const htmlBytes = new TextEncoder().encode(runtime.html);
      artifact = { bytes: htmlBytes, content_type: 'text/html; charset=utf-8', filename: `flagship-${key}.html` };
      const html = Buffer.isBuffer(artifact.bytes) ? artifact.bytes.toString('utf8') : String(artifact.bytes);
      extraChecks.leaks = scanForLeaks(html);
      extraChecks.hasBranding = /VoiceInsights/i.test(html);
      extraChecks.hasSyntheticDisclosure = /synthetic/i.test(html);
    } else if (format === 'pdf') {
      const composition = buildDocumentComposition(report, 'pdf', { tenant_id: 'public-demo' });
      composition.full_report = report;
      artifact = await renderPdfBinary(composition, { profile: model.sample.style });
    }
  } catch (err) {
    return { key, format, ok: false, error: err.message };
  }
  if (!artifact || !artifact.bytes) return { key, format, ok: false, error: 'no artifact/bytes returned' };
  const bytes = artifact.bytes;
  const byteLength = bytes.length ?? bytes.byteLength ?? 0;
  const magic = Buffer.isBuffer(bytes) ? bytes.slice(0, 4).toString('latin1') : String.fromCharCode(...new Uint8Array(bytes).slice(0, 4));
  const isZipBased = ['docx', 'xlsx', 'pptx'].includes(format);
  const zipOk = isZipBased ? magic.startsWith(ZIP_MAGIC) : true;
  const isPdf = format === 'pdf';
  const pdfOk = isPdf ? magic.startsWith('%PDF') : true;
  return {
    key, format, ok: true,
    byteLength,
    nonEmpty: byteLength > 500,
    filename: artifact.filename || null,
    contentType: artifact.content_type || null,
    zipMagicOk: isZipBased ? zipOk : null,
    pdfMagicOk: isPdf ? pdfOk : null,
    checksum: artifact.checksum || null,
    ...extraChecks,
  };
}

async function run() {
  const formats = ['pdf', 'docx', 'pptx', 'xlsx', 'html'];
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    for (const format of formats) {
      const r = await checkOne(sample.key, format);
      results.push(r);
      const flag = r.ok ? (r.nonEmpty ? 'OK' : 'EMPTY') : 'FAIL';
      console.log(`${sample.key.padEnd(35)} ${format.padEnd(5)} ${flag.padEnd(6)} bytes=${r.byteLength ?? '-'} filename=${r.filename ?? '-'} leaks=${(r.leaks||[]).join(',') || 'none'}`);
    }
  }
  const fails = results.filter(r => !r.ok || !r.nonEmpty || (r.zipMagicOk === false) || (r.pdfMagicOk === false) || (r.leaks && r.leaks.length));
  console.log('\n--- SUMMARY ---');
  console.log('Total checks:', results.length, 'Failures/concerns:', fails.length);
  if (fails.length) console.log(JSON.stringify(fails, null, 2));
  const fs = await import('node:fs');
  fs.writeFileSync('../review-evidence-full/export-format-results.json', JSON.stringify(results, null, 2));
}
run().catch(err => { console.error(err); process.exit(1); });
