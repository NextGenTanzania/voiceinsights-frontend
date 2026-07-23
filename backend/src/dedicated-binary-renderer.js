// VoiceInsights v187 Dedicated Binary Rendering Worker
// Worker-compatible binary PDF/PPTX generation helpers plus R2 storage adapter.
// This module intentionally avoids heavyweight native dependencies so the
// Cloudflare Worker can produce real binary artifacts for controlled enterprise
// exports while still allowing a dedicated external renderer to replace the
// renderer implementation later without changing API contracts.
//
// Unified Publication Runtime migration status: LEGACY, pending migration.
// renderFullFlagshipPdf is the current production PDF path for the flagship
// catalogue (composePublicationRuntime/Browser Rendering is proven and
// available but still gated to preview via PUBLICATION_RENDERER_V2_ENABLED).
// The PPTX writer (slideXml/renderPptxBinary) is a generic OOXML renderer fed
// by flagship-sample-library.js's buildFlagshipSampleDeck — planned Phase 4
// PPTX migration target: reuse this OOXML writer, replace the slide-content
// deriver with runtime.sections[].blocks. Do not delete either path until its
// replacement has passed the same parity testing this migration has used at
// every prior phase (see backend/tests/publication-runtime-*.test.js).

import { buildDocumentComposition, normalizeRenderFormat, getRendererType } from './document-composer.js';
import { validateRenderedDocument } from './rendering-quality-validator.js';
import { formatOecdDacLines, formatRbmLines } from './publication-render-utils.js';
import { buildSignedDownloadDescriptor, buildDownloadAuditRecord } from './download-infrastructure.js';
import { transitionRenderJob } from './rendering-queue.js';
import { computeTrustBadges } from './publication-trust-badges.js';

export const V187_BINARY_RENDERER_VERSION = 'v187-dedicated-binary-rendering-worker';

const enc = new TextEncoder();

function bytes(text) { return enc.encode(String(text ?? '')); }
function concatBytes(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}
function escapePdfText(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ').slice(0, 110);
}
function stripHtml(value = '') {
  return String(value).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
function sanitizeXml(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function sanitizePath(value = '') { return String(value || 'report').replace(/[^a-zA-Z0-9_.-]/g, '_'); }

export async function sha256Hex(data) {
  const input = typeof data === 'string' ? bytes(data) : data;
  if (globalThis.crypto?.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', input);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(Buffer.from(input)).digest('hex');
}


function pdfColor(hex='#0B2E59') { const h=String(hex).replace('#','').padEnd(6,'0').slice(0,6); return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255].map(x=>x.toFixed(3)).join(' '); }
function wrapPdf(value='', width=78) { const words=String(value).replace(/\s+/g,' ').trim().split(' '); const out=[]; let line=''; for(const w of words){ if((line+' '+w).trim().length>width){if(line)out.push(line);line=w}else line=(line+' '+w).trim()} if(line)out.push(line); return out; }
async function renderFullFlagshipPdf(composition={},options={}) {
  const report=composition.full_report||{}, f=report.full_publication||{}; const cover=f.cover||{}; const title=report.title||'VoiceInsights Flagship Report';
  const pageStreams=[]; const W=595,H=842;
  const addPage=(commands)=>pageStreams.push(commands.join('\n'));
  const coverVariant=Math.max(1,Math.min(16,Number(cover.layout_variant||cover.variant)||1)),bandWidth=105+(coverVariant%4)*14,bandX=W-bandWidth,stripeX=365+(coverVariant*7)%35,stripeWidth=8+(coverVariant%3)*4,topAccentHeight=coverVariant%2?0:70+(coverVariant%4)*10;
  // Cover page with real vector composition.
  addPage([`${pdfColor(cover.primary)} rg`,`0 0 ${W} ${H} re f`,`${pdfColor(cover.accent)} rg`,`${bandX} 0 ${bandWidth} ${H} re f`,...(topAccentHeight?[`0 ${H-topAccentHeight} ${W} ${topAccentHeight} re f`]:[]),`${pdfColor(cover.highlight||'#D4AF37')} rg`,`${stripeX} 0 ${stripeWidth} ${H} re f`,`52 650 96 7 re f`,'0.031 0.533 0.247 rg','52 770 5 18 re f','61 762 5 34 re f','70 752 5 54 re f','79 762 5 34 re f','88 770 5 18 re f','1 1 1 rg','BT','/F2 10 Tf','52 735 Td','(VOICEINSIGHTS AFRICA) Tj','/F1 8 Tf','0 -32 Td','(SYNTHETIC DEMONSTRATION PUBLICATION) Tj','/F2 25 Tf','0 -74 Td',...wrapPdf(title,24).slice(0,5).flatMap((l,i)=>[i?'0 -32 Td':'',`(${escapePdfText(l)}) Tj`]).filter(Boolean),'/F1 11 Tf','0 -42 Td',`(${escapePdfText(`${f.country||''} | ${f.sector||''}`)}) Tj`,'0 -20 Td',`(${escapePdfText(`${Number(f.sample_size||0).toLocaleString()} synthetic responses`)}) Tj`,'/F1 8 Tf','0 -58 Td','(Prepared by VoiceInsights Africa) Tj','0 -17 Td','(Every Voice. Every Language. Every Insight.) Tj','0 -48 Td','(Synthetic demonstration. Not official statistics.) Tj','ET']);
  const sectionPage=(heading,bodyLines=[],chart=null)=>{const cmd=[`${pdfColor(cover.primary)} rg`,`0 790 ${W} 52 re f`,'BT','/F2 18 Tf','42 807 Td',`(${escapePdfText(heading)}) Tj`,'/F1 10 Tf','0 -43 Td']; let y=0; for(const line of bodyLines.flatMap(x=>wrapPdf(x,88)).slice(0,26)){cmd.push(y?'0 -17 Td':'',`(${escapePdfText(line)}) Tj`);y++}cmd.push('ET'); if(chart?.data?.length){const vals=chart.data.slice(0,8), max=Math.max(1,...vals.map(x=>Number(x.value)||0)); let yy=340; vals.forEach((x,i)=>{const v=Number(x.value)||0,w=330*v/max;cmd.push(`${pdfColor(i%2?cover.accent:cover.highlight||'#D4AF37')} rg`,`180 ${yy} ${w.toFixed(1)} 13 re f`,'BT','/F1 8 Tf',`42 ${yy+3} Td`,`(${escapePdfText(String(x.label||'').slice(0,22))}) Tj`,`455 0 Td`,`(${escapePdfText(String(v))}) Tj`,'ET');yy-=27})}cmd.push('BT','/F1 8 Tf','42 28 Td',`(${escapePdfText('VoiceInsights Africa • Full Flagship Demonstration • '+(pageStreams.length+1))}) Tj`,'ET');addPage(cmd)};
  sectionPage('Executive Intelligence',[report.executive_summary||'',`Sample: ${f.sample_size} synthetic responses • ${f.response_rate_pct}% response rate • ${f.regions_covered} regions`,`Publication quality gate: ${String(f.quality_gate?.status||'').replaceAll('_',' ').toLowerCase()||'not assessed'}`],f.visualizations?.[0]);
  sectionPage('Regional Performance & Equity',f.regional?.map(x=>`${x.name}: ${x.primary_score}% performance, ${x.responses} responses, risk ${x.risk}`)||[],f.visualizations?.find(v=>v.id==='VIS-03'));
  sectionPage('Gender, Youth, Disability & Inclusion',[...Object.entries(f.demographics||{}).map(([k,a])=>`${k}: ${(a||[]).map(x=>`${x[0]} ${x[1]}%`).join(' • ')}`)],f.visualizations?.find(v=>v.id==='VIS-04'));
  sectionPage('Indicator Target Gaps',f.indicators?.map(x=>`${x.id} ${x.label}: ${x.value}% vs target ${x.target}% — ${x.status}`)||[],f.visualizations?.find(v=>v.id==='VIS-06'));
  (report.findings||[]).forEach((x,i)=>sectionPage(`Finding ${i+1}: ${x.title||x.id}`,[x.text,`Evidence: ${(x.evidence_ids||[]).join(', ')} • Confidence ${x.confidence_score}%`],null));
  sectionPage('Respondent Voice',f.quotes?.map(q=>`${q.region} — ${q.quote}`)||[],null);
  sectionPage('Risk Matrix & Scenario Outlook',['Risks and alternative trajectories are modelled to show how VoiceInsights translates evidence into prioritised management choices.'],f.visualizations?.find(v=>v.id==='VIS-09'));
  sectionPage('Decision Intelligence',report.recommendations?.map(x=>`${x.id||''} ${x.priority}: ${x.recommendation} Owner: ${x.owner}; Timeline: ${x.timeline}; Indicator: ${x.monitoring_indicator||''}`)||[],f.visualizations?.find(v=>v.id==='VIS-08'));
  (report.recommendations||[]).forEach((x,i)=>sectionPage(`Decision Dossier ${i+1}: ${x.id||x.decision_id||''}`,[x.recommendation||'',`Strategic priority: ${x.strategic_priority||x.priority||''}`,`Evidence used: ${(x.evidence_used||[]).join(', ')}`,`Rationale: ${x.why_this_recommendation_exists||''}`,`Expected benefit: ${x.expected_benefit||''}`,`Expected risk: ${x.expected_risk||''}`,`Dependencies: ${(x.dependencies||[]).join('; ')}`,`Budget requirement: ${x.budget_requirement||''}`,`Owner: ${x.owner||''}`,`Supporting organization: ${x.supporting_organization||''}`,`Timeline: ${x.timeline||''}`,`Monitoring indicator: ${x.monitoring_indicator||''}`,`Success criteria: ${x.success_criteria||''}`,`Management response: ${x.management_response||''}`,`Follow-up: ${(x.follow_up_actions||[]).join('; ')}`],null));
  sectionPage('Methodology & Research Governance',Object.entries(f.methodology||{}).map(([k,v])=>`${k.replaceAll('_',' ')}: ${Array.isArray(v)?v.join('; '):v}`),null);
  sectionPage('Institutional & Methodology Assurance',[`Publication level: ${report.publication_page_equivalent||'Full publication'}`,...Object.entries(report.research_methodology_assurance||{}).map(([k,v])=>`${k.replaceAll('_',' ')}: ${typeof v==='object'?JSON.stringify(v):v}`)],null);
  sectionPage('Analytical Depth & Reproducibility',[...Object.entries(report.analytical_depth||{}).map(([k,v])=>`${k.replaceAll('_',' ')}: ${typeof v==='object'?JSON.stringify(v):v}`)],null);
  sectionPage('Decision Architecture',(report.decision_architecture||[]).map(x=>`${x.decision_id}: ${x.decision} • Owner ${x.owner} • ${x.start_window} • ${x.cost_band} cost • Indicator ${x.monitoring_indicator}`),null);
  sectionPage('Evidence Lineage & Citation Registry',(report.evidence_registry||[]).slice(0,20).map(x=>`${x.evidence_id}: ${x.lineage} • ${x.verification_status} • confidence ${x.confidence_score}%`),null);
  sectionPage('Publication Architecture',(report.publication_architecture||[]).map(x=>`${x.book} (${x.pages}): ${(x.sections||[]).join('; ')}`),null);
  sectionPage('Peer Review & Accessibility',[...Object.entries(report.peer_review||{}).map(([k,v])=>`${k.replaceAll('_',' ')}: ${v}`),...Object.entries(report.accessibility_compliance||{}).map(([k,v])=>`${k.replaceAll('_',' ')}: ${v}`)],null);
  sectionPage('International Standards Alignment',(f.standards_compliance_matrix||[]).map(x=>`${x.standard}: ${x.status} — ${x.evidence}`),null);
  sectionPage('SDG Contribution Framework',(f.sdg_alignment||[]).map(x=>`SDG ${x.goal}: ${x.contribution} contribution — indicators ${(x.indicator_ids||[]).join(', ')} — ${x.note}`),null);
  sectionPage('OECD-DAC Evaluation Criteria',formatOecdDacLines(f.oecd_dac),null);
  sectionPage('Results-Based Management & Theory of Change',formatRbmLines(f.rbm_results_framework),null);
  sectionPage('CHS Accountability Mapping',(f.chs_commitments||[]).map(x=>`Commitment ${x.commitment_number}: ${x.commitment} — ${x.status}. Action: ${x.action}`),null);
  sectionPage('Evidence Register',(report.evidence||[]).slice(0,26).map(x=>`${x.id} • ${x.type} • ${x.region||''} • confidence ${x.confidence_score||''}% • ${x.verification||''}`),null);
  sectionPage('Data Dictionary',(f.data_dictionary||[]).map(x=>`${x[0]}: ${x[1]}`),null);
  sectionPage('Limitations & Responsible Use',[f.integrity_notice||'',...(report.limitations||[])],null);
  const assurance=report.publication_assurance||{};
  // Enterprise Market Validation Release, Part A: this page used to print
  // every internal Quality Gate component as a raw X/100 number — an
  // internal score with no place on a public-facing export. Detailed
  // numeric scores remain internal-only (site/admin/quality-control.html);
  // this page shows only the same pass/fail trust badges the interactive
  // view and other export formats now show.
  const trustBadges=computeTrustBadges({editorialConsensus:report.editorial_consensus,assurance});
  sectionPage('Publication Quality Gate',[`Status: ${assurance.synthetic_status||assurance.status||'NOT ASSESSED'}`,...trustBadges.map(b=>`${b.satisfied?'Passed':'Pending'}: ${b.label}`),`Open gates: ${(assurance.blockers||[]).join(', ')||'None'}`,'Verification checks cover weighted evidence, statistical, visual, accessibility, export and review rules. Synthetic samples are labelled Demonstration Ready.'],null);
  // Build PDF objects.
  const objects=[]; const addObj=b=>{objects.push(b);return objects.length}; const catalogId=addObj(''),pagesId=addObj(''); const fontId=addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); const boldId=addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'); const pageIds=[];
  for(const stream of pageStreams){const taggedStream=`/Sect <</MCID 0>> BDC\n${stream}\nEMC`;const contentId=addObj(`<< /Length ${bytes(taggedStream).length} >>\nstream\n${taggedStream}\nendstream`);pageIds.push(addObj(''))}
  const structTreeId=addObj(''),parentTreeId=addObj('');const structElementIds=pageIds.map((pageId,index)=>addObj(`<< /Type /StructElem /S /Sect /P ${structTreeId} 0 R /Pg ${pageId} 0 R /K 0 /T (Page ${index+1}) >>`));
  pageIds.forEach((pageId,index)=>{const contentId=pageId-1;objects[pageId-1]=`<< /Type /Page /Parent ${pagesId} 0 R /StructParents ${index} /Tabs /S /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`;});
  objects[parentTreeId-1]=`<< /Nums [${structElementIds.map((id,index)=>`${index} [${id} 0 R]`).join(' ')}] >>`;objects[structTreeId-1]=`<< /Type /StructTreeRoot /K [${structElementIds.map(id=>`${id} 0 R`).join(' ')}] /ParentTree ${parentTreeId} 0 R /ParentTreeNextKey ${structElementIds.length} >>`;
  objects[catalogId-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R /Lang (en) /MarkInfo << /Marked true >> /StructTreeRoot ${structTreeId} 0 R >>`;objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const header='%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';let body=header;const offsets=[0];objects.forEach((o,i)=>{offsets.push(bytes(body).length);body+=`${i+1} 0 obj\n${o}\nendobj\n`});const xo=bytes(body).length;body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)body+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;body+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R /Info << /Title (${escapePdfText(title)}) /Producer (VoiceInsights Full Flagship Renderer v4) >> >>\nstartxref\n${xo}\n%%EOF`;const data=bytes(body);return{renderer_version:'flagship-v4',format:'pdf',binary_generated:true,bytes:data,byte_length:data.length,checksum:await sha256Hex(data),content_type:'application/pdf',file_extension:'pdf',filename:`${sanitizePath(report.id||'voiceinsights-full-flagship')}.pdf`,quality:{selectable_text:true,page_count:pageStreams.length,cover_page:true,vector_infographics:true,tagged_pdf:true,language_tag:'en',full_publication:true}};
}

// ------------------------------------------------------------
// Minimal valid PDF writer. It creates selectable-text PDF bytes with
// multiple pages, page numbers, metadata and report sections.
// ------------------------------------------------------------
export async function renderPdfBinary(composition = {}, options = {}) {
  if (composition?.full_report?.full_publication) return renderFullFlagshipPdf(composition, options);
  const layout = composition.layout || {};
  const artifact = composition.artifact || {};
  const metadata = composition.metadata || layout.metadata || {};
  const title = metadata.title || composition.title || 'VoiceInsights Report';
  const sections = Array.isArray(layout.sections) ? layout.sections : [];
  const textSource = stripHtml(artifact.html_document || '');
  const paragraphs = [
    title,
    `Prepared for: ${metadata.organization || metadata.organization_name || 'VoiceInsights Client'}`,
    `Report ID: ${metadata.report_id || composition.report_id || 'report'}`,
    `Evidence standard: ${metadata.evidence_standard || 'Evidence-labelled report'}`,
    ...sections.map(s => `${s.title || s.id}: ${stripHtml(JSON.stringify(s.content || s.summary || '')).slice(0, 420)}`),
    textSource.slice(0, 2200),
  ].filter(Boolean);

  const lines = [];
  for (const para of paragraphs) {
    const words = String(para).split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).length > 86) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    lines.push('');
  }
  if (!lines.some(l => /Methodology/i.test(l))) lines.push('Methodology: Sampling, data quality, confidence and limitations are documented in the report package.');
  if (!lines.some(l => /Evidence/i.test(l))) lines.push('Evidence: Findings are labelled as raw-source, report-model or synthetic demo evidence as applicable.');
  if (!lines.some(l => /Limitations/i.test(l))) lines.push('Limitations: Interpret findings according to the stated sample, channels, confidence level and data quality constraints.');

  const perPage = 34;
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (!pages.length) pages.push([title]);

  const objects = [];
  const addObj = (body) => { objects.push(body); return objects.length; };
  const catalogId = addObj('');
  const pagesId = addObj('');
  const fontId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];

  pages.forEach((pageLines, pageIndex) => {
    const contentLines = [
      'BT',
      '/F1 18 Tf',
      '50 790 Td',
      `(${escapePdfText(title)}) Tj`,
      '/F1 9 Tf',
      '0 -18 Td',
      `(${escapePdfText(`Page ${pageIndex + 1} of ${pages.length} • ${metadata.classification || 'Client report'}`)}) Tj`,
      '/F1 11 Tf',
    ];
    pageLines.forEach(line => {
      contentLines.push('0 -19 Td');
      contentLines.push(`(${escapePdfText(line)}) Tj`);
    });
    contentLines.push('ET');
    const stream = contentLines.join('\n');
    const contentId = addObj(`<< /Length ${bytes(stream).length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObj(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  const header = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
  let body = header;
  const offsets = [0];
  objects.forEach((obj, idx) => {
    offsets.push(bytes(body).length);
    body += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = bytes(body).length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info << /Title (${escapePdfText(title)}) /Producer (VoiceInsights Africa v187 Renderer) >> >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const data = bytes(body);
  const checksum = await sha256Hex(data);
  return {
    renderer_version: V187_BINARY_RENDERER_VERSION,
    format: 'pdf',
    binary_generated: true,
    bytes: data,
    byte_length: data.length,
    checksum,
    content_type: 'application/pdf',
    file_extension: 'pdf',
    filename: `${sanitizePath(metadata.report_id || composition.report_id || 'voiceinsights-report')}.pdf`,
    quality: { selectable_text: true, page_count: pages.length, has_metadata: true, has_page_numbers: true, hasheaders_footers: true },
  };
}

// ------------------------------------------------------------
// Minimal OpenXML PPTX package writer. Slides are editable text boxes.
// ------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(data) {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u16(n) { const a = new Uint8Array(2); a[0] = n & 255; a[1] = (n >>> 8) & 255; return a; }
function u32(n) { const a = new Uint8Array(4); a[0] = n & 255; a[1] = (n >>> 8) & 255; a[2] = (n >>> 16) & 255; a[3] = (n >>> 24) & 255; return a; }
function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const name = bytes(file.name);
    const data = typeof file.data === 'string' ? bytes(file.data) : file.data;
    const crc = crc32(data);
    const local = concatBytes([bytes('PK\x03\x04'), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
    localParts.push(local);
    const central = concatBytes([bytes('PK\x01\x02'), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
    centralParts.push(central);
    offset += local.length;
  }
  const central = concatBytes(centralParts);
  const end = concatBytes([bytes('PK\x05\x06'), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(offset), u16(0)]);
  return concatBytes([...localParts, central, end]);
}
function slideXml(slide, index) {
  let shapeId=1;
  const xmlText=(value='')=>sanitizeXml(String(value).replace(/_/g,' ').replace(/\s+/g,' ').trim());
  const shape=(name,x,y,w,h,fill='FFFFFF',radius=false,line='none')=>`<p:sp><p:nvSpPr><p:cNvPr id="${++shapeId}" name="${sanitizeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="${radius?'roundRect':'rect'}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>${line==='none'?'<a:ln><a:noFill/></a:ln>':`<a:ln w="12700"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>`}</p:spPr></p:sp>`;
  const textBox=(name,text,x,y,w,h,size=1800,color='102A43',bold=false,align='l',valign='t')=>`<p:sp><p:nvSpPr><p:cNvPr id="${++shapeId}" name="${sanitizeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="${valign}" lIns="0" rIns="0" tIns="0" bIns="0"/><a:lstStyle/><a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="en-US" sz="${size}"${bold?' b="1"':''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>${xmlText(text).slice(0,900)}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const statements=[];
  const collect=(value,prefix='')=>{if(value==null)return;if(Array.isArray(value)){value.slice(0,6).forEach(v=>collect(v,prefix));return}if(typeof value==='object'){const preferred=[value.title,value.finding,value.recommendation,value.decision,value.quote,value.statement,value.assessment,value.text].find(v=>typeof v==='string'||typeof v==='number');if(preferred!=null)statements.push(`${prefix}${preferred}`);else Object.entries(value).slice(0,5).forEach(([k,v])=>collect(v,`${k}: `));return}statements.push(`${prefix}${value}`)};
  collect(slide.items||slide.content||{});
  const dark=['cover','close'].includes(slide.kind), bg=dark?'07251D':'F5F8F6', ink=dark?'FFFFFF':'102A43',muted=dark?'C9D9D2':'52667A',green='0B6E4F',gold='D4AF37',navy='0B2E59';
  const parts=[shape('Background',0,0,12192000,6858000,bg),shape('Top rule',0,0,12192000,70000,dark?gold:green)];
  if(dark){parts.push(shape('Accent panel',9300000,0,2892000,6858000,green),shape('Gold rule',8880000,0,120000,6858000,gold));}
  const logoX=640000,logoY=210000,logoHeights=[180000,350000,560000,350000,180000],logoWidths=[90000,110000,125000,110000,90000],logoOffsets=[190000,105000,0,105000,190000];
  let cursor=logoX;logoHeights.forEach((height,i)=>{parts.push(shape(`VoiceInsights logo bar ${i+1}`,cursor,logoY+logoOffsets[i],logoWidths[i],height,green,true));cursor+=logoWidths[i]+70000;});
  parts.push(textBox('Brand','VOICEINSIGHTS AFRICA',1300000,260000,3300000,260000,1050,dark?'FFFFFF':green,true));
  if(slide.kind==='cover'){
    parts.push(textBox('Classification','FLAGSHIP SYNTHETIC DEMONSTRATION PUBLICATION',640000,1160000,7100000,420000,1250,gold,true));
    parts.push(textBox('Title',slide.title,640000,1760000,7600000,1900000,3600,'FFFFFF',true));
    parts.push(textBox('Subtitle',slide.subtitle||'',640000,3900000,6900000,450000,1800,'D8E5DF'));
    parts.push(textBox('Prepared','Prepared by VoiceInsights Africa\nEvery Voice. Every Language. Every Insight.',640000,5000000,6500000,760000,1450,'FFFFFF',false));
    parts.push(textBox('Notice','SYNTHETIC DATA\nNot official statistics',9550000,5260000,2050000,650000,1250,'FFFFFF',true,'c','ctr'));
  }else{
    parts.push(textBox('Section',slide.subtitle||'Decision intelligence',640000,650000,8000000,300000,1150,green,true));
    parts.push(textBox('Title',slide.title,640000,1020000,10600000,700000,2700,ink,true));
    if(slide.kind==='dashboard'){
      (slide.metrics||[]).slice(0,4).forEach((m,i)=>{const x=640000+i*2830000;parts.push(shape(`Metric card ${i+1}`,x,2050000,2580000,1500000,dark?'FFFFFF':'FFFFFF',true,'DCE7E2'));parts.push(textBox(`Metric value ${i+1}`,m.value,x+180000,2300000,2220000,550000,2700,navy,true));parts.push(textBox(`Metric label ${i+1}`,m.label,x+180000,3000000,2220000,380000,1150,muted,true));});
      if(statements[0])parts.push(textBox('Interpretation',statements[0],640000,4080000,10800000,1100000,1750,ink,false));
    }else if(slide.kind==='bars'){
      const rows=(slide.data||[]).slice(0,6),max=Math.max(100,...rows.map(x=>Number(x.target)||Number(x.value)||0));
      rows.forEach((row,i)=>{const y=2050000+i*600000,v=Number(row.value)||0,t=Number(row.target)||0;parts.push(textBox(`Bar label ${i+1}`,row.label||'',640000,y,3100000,300000,1150,ink,true));parts.push(shape(`Bar track ${i+1}`,3600000,y,6500000,260000,'DFE9E4',true));parts.push(shape(`Bar value ${i+1}`,3600000,y,Math.max(90000,Math.round(6500000*v/max)),260000,i%2?gold:green,true));if(t)parts.push(shape(`Target ${i+1}`,3600000+Math.round(6500000*t/max),y-70000,35000,400000,navy));parts.push(textBox(`Bar number ${i+1}`,`${v}${v<=100?'%':''}${t?` / target ${t}%`:''}`,10200000,y-10000,1250000,300000,1100,ink,true,'r'));});
    }else if(slide.kind==='matrix'){
      parts.push(shape('Risk panel',640000,2050000,5200000,3400000,'FFF2F0',true,'E7C5BF'),shape('Opportunity panel',5980000,2050000,5200000,3400000,'ECF7F1',true,'B8DCCB'));
      parts.push(textBox('Risk title','CRITICAL RISKS',940000,2320000,4400000,330000,1350,'A33A2B',true),textBox('Opportunity title','TOP OPPORTUNITIES',6280000,2320000,4400000,330000,1350,green,true));
      const risks=slide.content?.risks||[],opps=slide.content?.opportunities||[];parts.push(textBox('Risks',risks.map((x,i)=>`${i+1}. ${typeof x==='string'?x:(x.risk||x.title||x.description||JSON.stringify(x))}`).join('\n\n'),940000,2850000,4400000,2200000,1450,'532B25'));parts.push(textBox('Opportunities',opps.map((x,i)=>`${i+1}. ${typeof x==='string'?x:(x.opportunity||x.title||x.description||JSON.stringify(x))}`).join('\n\n'),6280000,2850000,4400000,2200000,1450,'164C3A'));
    }else if(slide.kind==='quotes'){
      (slide.items||[]).slice(0,3).forEach((q,i)=>{const x=640000+i*3700000;parts.push(shape(`Quote card ${i+1}`,x,2050000,3400000,3150000,'FFFFFF',true,'DCE7E2'));parts.push(textBox(`Quote ${i+1}`,`“${q.quote||q.text||''}”`,x+240000,2400000,2920000,1650000,1650,ink,true));parts.push(textBox(`Quote source ${i+1}`,`${q.region||'Masked location'} | ${q.respondent_group||'Respondent'}\nEvidence ${q.evidence_id||q.id||''} | Confidence ${q.confidence||q.confidence_score||'—'}%`,x+240000,4450000,2920000,650000,1150,green,true));});
    }else{
      const rows=statements.slice(0,5);rows.forEach((s,i)=>{const y=2000000+i*760000;parts.push(shape(`Number ${i+1}`,640000,y,430000,430000,i===0?gold:green,true));parts.push(textBox(`Number text ${i+1}`,String(i+1),640000,y+75000,430000,220000,1250,i===0?'102A43':'FFFFFF',true,'c'));parts.push(textBox(`Statement ${i+1}`,s,1260000,y,9600000,530000,i===0?1650:1450,ink,i===0));});
    }
    parts.push(textBox('Footer',`VoiceInsights Africa | Synthetic Demonstration Publication | ${String(index).padStart(2,'0')}`,640000,6360000,10700000,250000,900,muted));
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${parts.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}
export async function renderPptxBinary(composition = {}, options = {}) {
  const artifact = composition.artifact || {};
  const metadata = composition.metadata || composition.layout?.metadata || {};
  const slides = Array.isArray(artifact.slides) && artifact.slides.length ? artifact.slides : [
    { id: 'title', title: metadata.title || 'VoiceInsights Report', content: { organization: metadata.organization || 'VoiceInsights Client' } },
    { id: 'summary', title: 'Executive Summary', content: { summary: stripHtml(composition.artifact?.html_document || '').slice(0, 400) } },
  ];
  const slideFiles = slides.map((s, i) => ({ name: `ppt/slides/slide${i + 1}.xml`, data: slideXml(s, i + 1) }));
  const slideRels = slides.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('');
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  const files = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${sanitizeXml(metadata.title || 'VoiceInsights Report')}</dc:title><dc:creator>VoiceInsights Africa</dc:creator></cp:coreProperties>` },
    { name: 'docProps/app.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>VoiceInsights Africa</Application><Slides>${slides.length}</Slides></Properties>` },
    { name: 'ppt/presentation.xml', data: presentation },
    { name: 'ppt/_rels/presentation.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slideRels}</Relationships>` },
    ...slideFiles,
  ];
  const data = zipStore(files);
  const checksum = await sha256Hex(data);
  return {
    renderer_version: V187_BINARY_RENDERER_VERSION,
    format: 'pptx',
    binary_generated: true,
    bytes: data,
    byte_length: data.length,
    checksum,
    content_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    file_extension: 'pptx',
    filename: `${sanitizePath(metadata.report_id || composition.report_id || 'voiceinsights-report')}.pptx`,
    quality: { editable_text: true, slide_count: slides.length, has_metadata: true, has_title_slide: true },
  };
}

export async function renderBinaryArtifact(composition = {}, options = {}) {
  const type = composition.renderer_type || getRendererType(composition.format);
  return type === 'pptx' ? renderPptxBinary(composition, options) : renderPdfBinary(composition, options);
}

export function getRenderingBucket(env = {}) {
  return env.RENDERED_REPORTS_BUCKET || env.DOCUMENTS_BUCKET || env.AUDIO_BUCKET || null;
}

export async function storeBinaryArtifact(env = {}, job = {}, artifact = {}) {
  const bucket = getRenderingBucket(env);
  const objectKey = job.object_key || `rendered/${sanitizePath(job.tenant_id)}/${sanitizePath(job.report_id)}/latest/${artifact.filename}`;
  const metadata = {
    contentType: artifact.content_type || 'application/octet-stream',
    customMetadata: {
      report_id: String(job.report_id || ''),
      tenant_id: String(job.tenant_id || ''),
      format: String(job.format || artifact.format || ''),
      checksum: artifact.checksum || '',
      renderer_version: V187_BINARY_RENDERER_VERSION,
    },
  };
  if (bucket?.put) {
    await bucket.put(objectKey, artifact.bytes, { httpMetadata: { contentType: metadata.contentType }, customMetadata: metadata.customMetadata });
    return { stored: true, object_key: objectKey, content_type: metadata.contentType, checksum: artifact.checksum, byte_length: artifact.byte_length, storage: 'r2' };
  }
  return { stored: false, object_key: objectKey, content_type: metadata.contentType, checksum: artifact.checksum, byte_length: artifact.byte_length, storage: 'r2-binding-missing' };
}

export async function processDedicatedBinaryRenderJob(job, documentModel = {}, env = {}, options = {}) {
  const started = Date.now();
  let current = transitionRenderJob(job, 'processing', { actor: options.actor || 'dedicated-binary-renderer' });
  try {
    const composition = buildDocumentComposition(documentModel, current.format, { tenant_id: current.tenant_id });
    const validation = validateRenderedDocument(composition, composition.artifact);
    if (!validation.release_allowed) {
      current = transitionRenderJob(current, 'failed', { actor: 'rendering-quality-validator', error: validation.issues.join('; ') });
      return { renderer_version: V187_BINARY_RENDERER_VERSION, job: current, validation, released: false };
    }
    const binary = await renderBinaryArtifact(composition, options);
    const storage = await storeBinaryArtifact(env, current, binary);
    const descriptor = buildSignedDownloadDescriptor({ objectKey: storage.object_key, reportId: current.report_id, tenantId: current.tenant_id, format: current.format, checksum: binary.checksum, actor: current.requested_by });
    const audit = buildDownloadAuditRecord({ job: current, descriptor, event: 'render_completed', actor: options.actor || 'dedicated-binary-renderer' });
    current = transitionRenderJob(current, 'completed', { actor: 'dedicated-binary-renderer', durationMs: Date.now() - started, result: { descriptor, storage, checksum: binary.checksum, binary: { content_type: binary.content_type, byte_length: binary.byte_length, checksum: binary.checksum, filename: binary.filename } } });
    return { renderer_version: V187_BINARY_RENDERER_VERSION, job: current, composition, validation, binary: { ...binary, bytes: undefined }, storage, download_descriptor: descriptor, audit, released: true };
  } catch (err) {
    current = transitionRenderJob(current, 'failed', { actor: 'dedicated-binary-renderer', error: err });
    return { renderer_version: V187_BINARY_RENDERER_VERSION, job: current, validation: { release_allowed: false, issues: [current.last_error] }, released: false };
  }
}
