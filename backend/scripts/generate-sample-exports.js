// Sector Intelligence Platform: closes a pre-existing gap identified during
// this migration — no committed script produced the 64 static files in
// site/sample-exports/ that the public Report Library's download buttons
// link to directly (bypassing the live API). Calls the exact same renderer
// functions the real /api/public/flagship-sample-library/:key/export/:format
// route calls for pdf/docx/pptx/xlsx (confirmed by direct read of
// application.js and mirrored by qa-flagship-export-formats.mjs), so a
// downloaded static file is byte-for-byte what the live route would return
// for the same key today.
//
// Usage: node generate-sample-exports.js [outDir] [--keys=key1,key2,...]
// Regenerates only the keys passed via --keys (or all FLAGSHIP_SAMPLE_REPORTS
// if omitted), writing {key}/{key}.{format} plus an updated manifest.json
// that merges with any existing entries for keys not being regenerated.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleReport, buildFlagshipSampleDeck } from '../src/flagship-sample-library.js';
import { renderDocxBinary, renderXlsxBinary } from '../src/office-export-engine.js';
import { buildDocumentComposition } from '../src/document-composer.js';
import { renderPdfBinary, renderPptxBinary } from '../src/dedicated-binary-renderer.js';
import { composePublicationSpreads } from '../src/publication-spread-composer.js';
import { runGovernanceReviews } from '../src/publication-governance-gate.js';

const out = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '../site/sample-exports');
const keysArg = process.argv.find((a) => a.startsWith('--keys='));
const requestedKeys = keysArg ? keysArg.slice('--keys='.length).split(',').filter(Boolean) : null;
const samples = requestedKeys ? FLAGSHIP_SAMPLE_REPORTS.filter((s) => requestedKeys.includes(s.key)) : FLAGSHIP_SAMPLE_REPORTS;

async function renderOne(model, format) {
  const report = model.report;
  if (format === 'docx') return renderDocxBinary(report, { report_id: `flagship-${model.sample.key}` });
  if (format === 'xlsx') return renderXlsxBinary(report, { report_id: `flagship-${model.sample.key}` });
  if (format === 'pptx') return renderPptxBinary({ report_id: `flagship-${model.sample.key}`, metadata: { report_id: `flagship-${model.sample.key}`, title: report.title, organization: 'VoiceInsights Africa' }, artifact: { slides: buildFlagshipSampleDeck(model) } }, { profile: model.sample.style });
  const composition = buildDocumentComposition(report, 'pdf', { tenant_id: 'public-demo' });
  composition.full_report = report;
  return renderPdfBinary(composition, { profile: model.sample.style });
}

async function run() {
  await mkdir(out, { recursive: true });
  let existingManifest = { artifacts: [] };
  try { existingManifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8')); } catch (_) {}
  const regeneratedKeys = new Set(samples.map((s) => s.key));
  const carriedOver = existingManifest.artifacts.filter((a) => !regeneratedKeys.has(a.key));
  const manifest = [...carriedOver];

  for (const sample of samples) {
    const model = buildFlagshipSampleReport(sample.key);
    // Editorial Division Release: the same 9-review governance gate the
    // catalog and view/export API routes enforce — a publication that
    // fails is skipped here too, so no static export file for a failing
    // publication is ever written to disk.
    const { spreads } = composePublicationSpreads(model);
    const reviews = runGovernanceReviews(model, { spreads });
    const failed = reviews.filter((r) => !r.passed);
    if (failed.length) {
      console.log(`Skipped ${sample.key}: failed governance review(s) ${failed.map((r) => r.id).join(', ')}`);
      continue;
    }
    const folder = join(out, sample.key);
    await mkdir(folder, { recursive: true });
    for (const format of ['pdf', 'docx', 'pptx', 'xlsx']) {
      const artifact = await renderOne(model, format);
      const file = join(folder, `${sample.key}.${format}`);
      await writeFile(file, artifact.bytes);
      manifest.push({
        key: sample.key,
        format,
        path: `/sample-exports/${sample.key}/${sample.key}.${format}`,
        bytes: artifact.bytes.length,
        sha256: createHash('sha256').update(artifact.bytes).digest('hex'),
      });
    }
    console.log(`Generated ${sample.key}`);
  }

  await writeFile(join(out, 'manifest.json'), JSON.stringify({ generated_at: new Date().toISOString(), count: manifest.length, artifacts: manifest }, null, 2));
  console.log(`Generated ${samples.length} flagship keys (${samples.length * 4} artifacts); manifest now has ${manifest.length} total entries in ${out}`);
}

run().catch((err) => { console.error(err); process.exit(1); });
