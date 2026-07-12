// VoiceInsights v187 Dedicated Binary Rendering Worker
// Worker-compatible binary PDF/PPTX generation helpers plus R2 storage adapter.
// This module intentionally avoids heavyweight native dependencies so the
// Cloudflare Worker can produce real binary artifacts for controlled enterprise
// exports while still allowing a dedicated external renderer to replace the
// renderer implementation later without changing API contracts.

import { buildDocumentComposition, normalizeRenderFormat, getRendererType } from './document-composer.js';
import { validateRenderedDocument } from './rendering-quality-validator.js';
import { buildSignedDownloadDescriptor, buildDownloadAuditRecord } from './download-infrastructure.js';
import { transitionRenderJob } from './rendering-queue.js';

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
  const coverVariant=Math.max(1,Math.min(16,Number(cover.layout_variant)||1)),bandWidth=135+(coverVariant%4)*24,bandX=W-bandWidth,stripeX=310+(coverVariant*17)%115,stripeWidth=10+(coverVariant%3)*6,topAccentHeight=coverVariant%2?0:78+(coverVariant%4)*12;
  // Cover page with real vector composition.
  addPage([`${pdfColor(cover.primary)} rg`,`0 0 ${W} ${H} re f`,`${pdfColor(cover.accent)} rg`,`${bandX} 0 ${bandWidth} ${H} re f`,...(topAccentHeight?[`0 ${H-topAccentHeight} ${W} ${topAccentHeight} re f`]:[]),`${pdfColor(cover.highlight||'#D4AF37')} rg`,`${stripeX} 0 ${stripeWidth} ${H} re f`,`${40+(coverVariant%5)*13} ${690-(coverVariant%4)*18} ${80+(coverVariant%3)*20} ${6+(coverVariant%2)*4} re f`,'0.110 0.620 0.330 rg',`${42+(coverVariant%3)*6} 782 5 20 re f`,`${51+(coverVariant%3)*6} 774 5 36 re f`,`${60+(coverVariant%3)*6} 766 5 52 re f`,`${69+(coverVariant%3)*6} 774 5 36 re f`,`${78+(coverVariant%3)*6} 782 5 20 re f`,'BT','/F2 11 Tf','52 755 Td','(VOICEINSIGHTS AFRICA) Tj','/F1 10 Tf','0 -28 Td',`(${escapePdfText(`FULL SYNTHETIC DEMONSTRATION PUBLICATION • COVER ${coverVariant}`)}) Tj`,'/F2 31 Tf','0 -70 Td',...wrapPdf(title,31).slice(0,5).flatMap((l,i)=>[i?'0 -38 Td':'',`(${escapePdfText(l)}) Tj`]).filter(Boolean),'/F1 14 Tf','0 -45 Td',`(${escapePdfText(`${f.country||''} • ${f.sector||''} • ${Number(f.sample_size||0).toLocaleString()} synthetic responses`)}) Tj`,'/F1 9 Tf','0 -55 Td','(Synthetic demonstration data. Not official statistics or real population findings.) Tj','ET']);
  const sectionPage=(heading,bodyLines=[],chart=null)=>{const cmd=[`${pdfColor(cover.primary)} rg`,`0 790 ${W} 52 re f`,'BT','/F2 18 Tf','42 807 Td',`(${escapePdfText(heading)}) Tj`,'/F1 10 Tf','0 -43 Td']; let y=0; for(const line of bodyLines.flatMap(x=>wrapPdf(x,88)).slice(0,26)){cmd.push(y?'0 -17 Td':'',`(${escapePdfText(line)}) Tj`);y++}cmd.push('ET'); if(chart?.data?.length){const vals=chart.data.slice(0,8), max=Math.max(1,...vals.map(x=>Number(x.value)||0)); let yy=340; vals.forEach((x,i)=>{const v=Number(x.value)||0,w=330*v/max;cmd.push(`${pdfColor(i%2?cover.accent:cover.highlight||'#D4AF37')} rg`,`180 ${yy} ${w.toFixed(1)} 13 re f`,'BT','/F1 8 Tf',`42 ${yy+3} Td`,`(${escapePdfText(String(x.label||'').slice(0,22))}) Tj`,`455 0 Td`,`(${escapePdfText(String(v))}) Tj`,'ET');yy-=27})}cmd.push('BT','/F1 8 Tf','42 28 Td',`(${escapePdfText('VoiceInsights Africa • Full Flagship Demonstration • '+(pageStreams.length+1))}) Tj`,'ET');addPage(cmd)};
  sectionPage('Executive Intelligence',[report.executive_summary||'',`Sample: ${f.sample_size} synthetic responses • ${f.response_rate_pct}% response rate • ${f.regions_covered} regions`,`Overall score: ${f.overall_score}% • Publication quality gate: ${f.quality_gate?.score||''}/100`],f.visualizations?.[0]);
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
  sectionPage('OECD-DAC Evaluation Criteria',(f.oecd_dac||[]).map(x=>`${x.criterion}: ${x.assessment} (${x.score}/100). ${x.management_implication}`),null);
  sectionPage('Results-Based Management & Theory of Change',[`Impact: ${f.rbm_results_framework?.impact||''}`,...(f.rbm_results_framework?.outcomes||[]).map(x=>`${x.id}: ${x.statement} — indicators ${(x.indicators||[]).join(', ')}`),...(f.rbm_results_framework?.outputs||[]).map(x=>`${x.id}: ${x.statement}`),`Assumptions: ${(f.rbm_results_framework?.assumptions||[]).join('; ')}`,`Means of verification: ${(f.rbm_results_framework?.means_of_verification||[]).join('; ')}`],null);
  sectionPage('CHS Accountability Mapping',(f.chs_commitments||[]).map(x=>`Commitment ${x.commitment_number}: ${x.commitment} — ${x.status}. Action: ${x.action}`),null);
  sectionPage('Evidence Register',(report.evidence||[]).slice(0,26).map(x=>`${x.id} • ${x.type} • ${x.region||''} • confidence ${x.confidence_score||''}% • ${x.verification||''}`),null);
  sectionPage('Data Dictionary',(f.data_dictionary||[]).map(x=>`${x[0]}: ${x[1]}`),null);
  sectionPage('Limitations & Responsible Use',[f.integrity_notice||'',...(report.limitations||[])],null);
  sectionPage('Publication Quality Gate',[`Gate: ${report.quality_scores?.gate||'NOT ASSESSED'}`,`Publication quality: ${report.quality_scores?.publication_quality||0}/100`,`Evidence quality: ${report.quality_scores?.evidence_quality||0}/100`,`Statistical quality: ${report.quality_scores?.statistical_quality||0}/100`,`Visualization quality: ${report.quality_scores?.visualization_quality||0}/100`,`Storytelling quality: ${report.quality_scores?.storytelling_quality||0}/100`,`Accessibility: ${report.quality_scores?.accessibility||0}/100`,`Decision support: ${report.quality_scores?.decision_support||0}/100`,`Overall publication readiness: ${report.quality_scores?.overall_publication_readiness||0}/100`,'Scores are generated from deterministic completeness and traceability rules; they are not manually assigned marketing values.'],null);
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
  const title = sanitizeXml(slide.title || `Slide ${index}`);
  const bullets = [];
  const content = slide.content || {};
  for (const [key, value] of Object.entries(content)) {
    if (Array.isArray(value)) value.slice(0, 6).forEach(v => bullets.push(typeof v === 'string' ? v : Object.values(v || {}).join(' — ')));
    else if (value && typeof value === 'object') bullets.push(`${key}: ${Object.values(value).slice(0, 4).join(' • ')}`);
    else if (value != null) bullets.push(`${key}: ${value}`);
  }
  const body = bullets.length ? bullets : [slide.speaker_notes || 'VoiceInsights Africa executive intelligence slide.'];
  const paragraphs = body.slice(0, 7).map((b, i) => `<a:p><a:r><a:rPr lang="en-US" sz="${i === 0 ? 2200 : 1800}"/><a:t>${sanitizeXml(String(b).slice(0, 180))}</a:t></a:r></a:p>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="457200"/><a:ext cx="7772400" cy="685800"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="3200" b="1"/><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1371600"/><a:ext cx="7772400" cy="4572000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
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
