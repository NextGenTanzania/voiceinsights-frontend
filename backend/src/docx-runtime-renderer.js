// Unified Publication Runtime — Phase 4 DOCX adapter.
//
// Unlike office-export-engine.js's renderDocxBinary (the current production
// DOCX path, which independently re-derives its own normalize(model) view
// of the report), this adapter consumes runtime.sections[].blocks directly
// — the exact same real, already-governed block structure every spread
// already produces for the canonical HTML view (see publication-runtime.js
// and publication-spread-composer.js's spread() helper). One block-type
// dispatcher below covers every block shape the composer emits: heading,
// paragraph, callout, list, table, card, stat_group.
//
// Reuses office-export-engine.js's existing ZIP/XML primitives (zipStore,
// xml, clean, safe, sha) rather than re-implementing them — this file adds
// no new ZIP-writing code, only new OOXML markup for the block types above
// plus a real numbering.xml part for genuine bulleted/numbered lists (the
// legacy renderer never needed one, since it never emitted a real list).
//
// Additive and gated: isDocxV2Eligible mirrors publication-render-engine-v2.js's
// isPublicationV2Eligible pattern exactly (preview-only, explicit flag,
// explicit key allowlist) so this never touches production traffic until
// deliberately promoted — see that module's own comment for why "preview
// only" is a tested, non-negotiable safety invariant, not a rollout detail.
import { zipStore, xml, clean, safe, sha } from './office-export-engine.js';
import { FLAGSHIP_SAMPLE_REPORTS } from './flagship-sample-library.js';

export const DOCX_RUNTIME_RENDERER_VERSION = 'docx-runtime-renderer-v1';

// Same catalogue every publication already renders through the canonical
// HTML runtime — no separate allowlist curation, since content-presence
// parity has already been established for every key via the runtime tests.
export const DOCX_V2_ELIGIBLE_PUBLICATION_KEYS = Object.freeze(
  FLAGSHIP_SAMPLE_REPORTS.map((s) => s.key)
);

export function isDocxV2Eligible(env, key) {
  return env?.ENVIRONMENT === 'preview'
    && env?.DOCX_RENDERER_V2_ENABLED === 'true'
    && DOCX_V2_ELIGIBLE_PUBLICATION_KEYS.includes(key);
}

function headingXml(text, level) {
  const style = level >= 3 ? 'Heading3' : level === 2 ? 'Heading2' : 'Heading1';
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

function runXml(text, { bold, italic } = {}) {
  const rPr = (bold || italic) ? `<w:rPr>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function paragraphXml(text, emphasis) {
  const italic = emphasis === 'caption' || emphasis === 'caution';
  const bold = emphasis === 'thesis';
  return `<w:p>${runXml(clean(text), { bold, italic })}</w:p>`;
}

// A "Callout" paragraph style (defined in stylesWithExtensions below) gives
// this block a visually distinct treatment from a plain paragraph, matching
// the emphasis a callout carries in the HTML/PDF view — genuine but partial
// visual parity, not pixel-identical to the browser-rendered layout.
function calloutXml(label, text) {
  const labelRun = label ? runXml(`${label}: `, { bold: true }) : '';
  return `<w:p><w:pPr><w:pStyle w:val="Callout"/></w:pPr>${labelRun}${runXml(clean(text))}</w:p>`;
}

const BULLET_NUM_ID = 1;
const ORDERED_NUM_ID = 2;

function listXml(items, ordered) {
  const numId = ordered ? ORDERED_NUM_ID : BULLET_NUM_ID;
  return (items || [])
    .map((item) => `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>${runXml(clean(item))}</w:p>`)
    .join('');
}

function tableXml(headers, rows) {
  const headerRow = `<w:tr>${(headers || [])
    .map((h) => `<w:tc><w:tcPr><w:shd w:val="clear" w:fill="E9EEF3"/></w:tcPr><w:p>${runXml(clean(h), { bold: true })}</w:p></w:tc>`)
    .join('')}</w:tr>`;
  const bodyRows = (rows || [])
    .map((row) => `<w:tr>${row.map((cell) => `<w:tc><w:p>${runXml(clean(cell))}</w:p></w:tc>`).join('')}</w:tr>`)
    .join('');
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B9C4CC"/><w:bottom w:val="single" w:sz="4" w:color="B9C4CC"/><w:left w:val="single" w:sz="4" w:color="B9C4CC"/><w:right w:val="single" w:sz="4" w:color="B9C4CC"/><w:insideH w:val="single" w:sz="4" w:color="B9C4CC"/><w:insideV w:val="single" w:sz="4" w:color="B9C4CC"/></w:tblBorders></w:tblPr>${headerRow}${bodyRows}</w:tbl>`;
}

function cardXml(title, fields) {
  const titleXml = title ? headingXml(title, 3) : '';
  const fieldsXml = (fields || [])
    .map((f) => {
      const labelRun = f.label ? runXml(`${f.label}: `, { bold: true }) : '';
      return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${BULLET_NUM_ID}"/></w:numPr></w:pPr>${labelRun}${runXml(clean(f.text))}</w:p>`;
    })
    .join('');
  return titleXml + fieldsXml;
}

function statGroupXml(stats) {
  return (stats || [])
    .map((s) => {
      const value = `${s.value ?? ''}${s.unit ? ` ${s.unit}` : ''}`;
      return `<w:p>${runXml(`${s.label ?? ''}: `, { bold: true })}${runXml(value)}</w:p>`;
    })
    .join('');
}

function blockXml(block) {
  switch (block?.type) {
    case 'heading': return headingXml(block.text || '', block.level || 1);
    case 'paragraph': return paragraphXml(block.text || '', block.emphasis);
    case 'callout': return calloutXml(block.label, block.text || '');
    case 'list': return listXml(block.items, block.ordered);
    case 'table': return tableXml(block.headers, block.rows);
    case 'card': return cardXml(block.title, block.fields);
    case 'stat_group': return statGroupXml(block.stats);
    default: return '';
  }
}

// Extends the legacy renderer's Heading1/Heading2 styles.xml with Heading3,
// a Callout character/paragraph style, and ListParagraph/TableGrid — real
// OOXML style definitions, not a duplicate copy of the legacy file (this
// module owns its own styles.xml part; the two renderers ship in separate
// DOCX files and never share a package).
const STYLES_XML = `<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="0B2E59"/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="1C7ED6"/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="1669A8"/><w:sz w:val="23"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Callout"><w:name w:val="Callout"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:color="E4A23A" w:space="8"/></w:pBdr><w:ind w:left="200"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>`;

// One bulleted (abstractNumId 0 -> numId 1) and one decimal-numbered
// (abstractNumId 1 -> numId 2) definition — the two real list kinds
// list.ordered ever distinguishes between.
const NUMBERING_XML = `<?xml version="1.0"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="${BULLET_NUM_ID}"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="${ORDERED_NUM_ID}"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;

const CONTENT_TYPES_XML = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;
const PACKAGE_RELS_XML = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const DOCUMENT_RELS_XML = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;

// runtime: the composePublicationRuntime(model) object — sections[].blocks
// is the only field this function reads for body content; metadata.title
// supplies the cover heading.
export async function renderDocxFromRuntime(runtime, options = {}) {
  const title = runtime?.metadata?.title || 'VoiceInsights Africa Publication';
  const sections = runtime?.sections || [];

  let body = `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="2200"/></w:pPr>${runXml(title, { bold: true })}</w:p>`;
  body += `<w:p>${runXml('VoiceInsights Africa — Unified Publication Runtime export', { italic: true })}</w:p>`;

  for (const section of sections) {
    for (const block of section.blocks || []) {
      body += blockXml(block);
    }
  }

  const files = [
    { name: '[Content_Types].xml', data: CONTENT_TYPES_XML },
    { name: '_rels/.rels', data: PACKAGE_RELS_XML },
    { name: 'word/_rels/document.xml.rels', data: DOCUMENT_RELS_XML },
    { name: 'word/styles.xml', data: STYLES_XML },
    { name: 'word/numbering.xml', data: NUMBERING_XML },
    {
      name: 'word/document.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1100" w:right="1100" w:bottom="1100" w:left="1100"/></w:sectPr></w:body></w:document>`,
    },
  ];

  const data = zipStore(files);
  return {
    format: 'docx',
    renderer: DOCX_RUNTIME_RENDERER_VERSION,
    binary_generated: true,
    bytes: data,
    byte_length: data.length,
    checksum: await sha(data),
    content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    filename: `${safe(options.report_id || 'voiceinsights-report')}.docx`,
    quality: { editable_text: true, source: 'unified_publication_runtime', section_count: sections.length },
  };
}
