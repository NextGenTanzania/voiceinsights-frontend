// Unified Publication Runtime, Phase 4 DOCX adapter — content-presence
// verification. This deliberately does NOT score visual/pixel parity (no
// such tooling exists in this environment, and claiming one would be exactly
// the kind of fabricated result this engagement's own discipline forbids).
// Instead it proves a real, checkable fact: every text/label/value the
// canonical runtime's blocks[] actually carry is present, verbatim, inside
// the generated word/document.xml — i.e. no block's content is silently
// dropped by the block-type dispatcher, for every one of the 33 real
// flagship publications, not just a hand-picked sample.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport, FLAGSHIP_SAMPLE_REPORTS } from '../src/flagship-sample-library.js';
import { composePublicationRuntime } from '../src/publication-runtime.js';
import {
  renderDocxFromRuntime,
  isDocxV2Eligible,
  DOCX_V2_ELIGIBLE_PUBLICATION_KEYS,
  DOCX_RUNTIME_RENDERER_VERSION,
} from '../src/docx-runtime-renderer.js';

// Minimal reader for the exact STORED-only, no-compression ZIP layout
// office-export-engine.js's zipStore() writes (confirmed by direct read of
// its source) — sufficient to extract word/document.xml's raw bytes without
// needing a real inflate implementation, since nothing here is compressed.
function extractZipEntry(zipBytes, entryName) {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  let offset = 0;
  const decoder = new TextDecoder();
  while (offset + 4 <= zipBytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // not a local file header — central directory reached
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = decoder.decode(zipBytes.slice(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    if (name === entryName) {
      return decoder.decode(zipBytes.slice(dataStart, dataStart + compressedSize));
    }
    offset = dataStart + compressedSize;
  }
  return null;
}

test('DOCX_V2_ELIGIBLE_PUBLICATION_KEYS covers exactly the live flagship catalogue', () => {
  assert.equal(DOCX_V2_ELIGIBLE_PUBLICATION_KEYS.length, FLAGSHIP_SAMPLE_REPORTS.length);
  assert.deepEqual(new Set(DOCX_V2_ELIGIBLE_PUBLICATION_KEYS), new Set(FLAGSHIP_SAMPLE_REPORTS.map((s) => s.key)));
});

test('isDocxV2Eligible mirrors the PDF V2 gate\'s safety invariants', () => {
  assert.equal(isDocxV2Eligible({ ENVIRONMENT: 'production', DOCX_RENDERER_V2_ENABLED: 'true' }, 'hospital-performance-intelligence'), false, 'production must never be eligible, even with the flag on');
  assert.equal(isDocxV2Eligible({ ENVIRONMENT: 'preview', DOCX_RENDERER_V2_ENABLED: 'false' }, 'hospital-performance-intelligence'), false, 'flag off must never be eligible, even in preview');
  assert.equal(isDocxV2Eligible({ ENVIRONMENT: 'preview', DOCX_RENDERER_V2_ENABLED: 'true' }, 'some-unknown-key'), false, 'an unlisted key must never be eligible');
  assert.equal(isDocxV2Eligible({ ENVIRONMENT: 'preview', DOCX_RENDERER_V2_ENABLED: 'true' }, 'hospital-performance-intelligence'), true);
});

function collectBlockStrings(blocks) {
  const strings = [];
  for (const block of blocks || []) {
    if (block.text) strings.push(block.text);
    if (block.label) strings.push(block.label);
    if (Array.isArray(block.items)) strings.push(...block.items);
    if (Array.isArray(block.rows)) for (const row of block.rows) strings.push(...row.map(String));
    if (Array.isArray(block.headers)) strings.push(...block.headers);
    if (block.title) strings.push(block.title);
    if (Array.isArray(block.fields)) for (const f of block.fields) { if (f.label) strings.push(f.label); if (f.text) strings.push(f.text); }
    if (Array.isArray(block.stats)) for (const s of block.stats) { if (s.label) strings.push(s.label); if (s.value != null) strings.push(String(s.value)); }
  }
  return strings;
}

// XML-escapes the same way the renderer does, so a raw block string
// containing &, <, >, ", or ' is compared against its escaped form — the
// actual bytes present in word/document.xml — not the pre-escape original.
function xmlEscape(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// clean() (office-export-engine.js) strips markup and collapses whitespace
// before a paragraph/callout/list/card/stat_group run is written — table
// cells go through the same clean() call in tableXml. Headings do not.
function cleanText(v) {
  return String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

test('every real flagship publication renders a real DOCX whose document.xml contains every block\'s real text/label/value', async () => {
  for (const sample of FLAGSHIP_SAMPLE_REPORTS) {
    const model = buildFlagshipSampleReport(sample.key);
    const runtime = composePublicationRuntime(model);
    const result = await renderDocxFromRuntime(runtime, { report_id: `flagship-${sample.key}` });

    assert.equal(result.format, 'docx', `${sample.key}: format`);
    assert.equal(result.renderer, DOCX_RUNTIME_RENDERER_VERSION, `${sample.key}: renderer version`);
    assert.ok(result.byte_length > 0, `${sample.key}: non-empty artifact`);

    const documentXml = extractZipEntry(result.bytes, 'word/document.xml');
    assert.ok(documentXml, `${sample.key}: word/document.xml must be present in the generated zip`);

    let checkedStrings = 0;
    for (const section of runtime.sections) {
      const strings = collectBlockStrings(section.blocks);
      for (const raw of strings) {
        if (typeof raw !== 'string' || !raw.trim()) continue;
        // A heading/label/list-item/table-cell string is written through
        // clean() then xml()-escaped (paragraph/callout/list/card/stat_group/
        // table paths) — check for that exact escaped substring, tolerant of
        // either transform since headings skip clean().
        const candidates = [xmlEscape(raw), xmlEscape(cleanText(raw))];
        const found = candidates.some((c) => c && documentXml.includes(c));
        assert.ok(found, `${sample.key}: block text "${raw.slice(0, 60)}" missing from word/document.xml`);
        checkedStrings++;
      }
    }
    assert.ok(checkedStrings > 0, `${sample.key}: expected at least one real block string to check`);
  }
});

test('DOCX renderer never throws on a malformed/near-empty runtime', async () => {
  const result = await renderDocxFromRuntime({ metadata: {}, sections: [] }, { report_id: 'empty-runtime' });
  assert.equal(result.format, 'docx');
  assert.ok(result.byte_length > 0);
});
