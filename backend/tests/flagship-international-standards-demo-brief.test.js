import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlagshipSampleReport, buildFlagshipSampleDeck } from '../src/flagship-sample-library.js';
import { buildMeDemoBrief } from '../src/me-demo-brief.js';
import { buildDocumentComposition } from '../src/document-composer.js';
import { renderPdfBinary } from '../src/dedicated-binary-renderer.js';
import { renderDocxBinary, renderXlsxBinary } from '../src/office-export-engine.js';

test('all flagship publications include SDG OECD-DAC RBM CHS and standards matrix',()=>{
  for(const key of ['national-human-development','humanitarian-needs-assessment','donor-impact-evaluation','government-policy-intelligence']){
    const m=buildFlagshipSampleReport(key); assert.ok(m);
    const f=m.full_publication;
    assert.ok(f.sdg_alignment.length>=1);
    assert.equal(f.oecd_dac.length,6);
    assert.ok(f.rbm_results_framework.outcomes.length>=2);
    assert.equal(f.chs_commitments.length,9);
    assert.ok(f.standards_compliance_matrix.length>=6);
    assert.equal(f.quality_gate.checks.international_standards,true);
  }
});

test('flagship deck includes standards, OECD-DAC, RBM and CHS slides',()=>{
  const slides=buildFlagshipSampleDeck(buildFlagshipSampleReport('national-human-development'));
  const ids=slides.map(x=>x.id);
  for(const id of ['standards','oecd-dac','rbm','chs']) assert.ok(ids.includes(id));
});

test('M&E demo brief is separate, branded and downloadable as a full PDF',async()=>{
  const m=buildMeDemoBrief();
  assert.equal(m.demo,true); assert.equal(m.prepared_by,'VoiceInsights Africa');
  assert.match(m.full_publication.cover.label,/DEMO BRIEF/);
  assert.ok(m.report.sdg_alignment.length>=1);
  const c=buildDocumentComposition(m.report,'pdf',{tenant_id:'public-demo'}); c.full_report=m.report;
  const pdf=await renderPdfBinary(c,{profile:'un'});
  assert.ok(pdf.bytes.length>15000); assert.ok(pdf.quality.page_count>=18);
  const docx=await renderDocxBinary(m.report,{report_id:'me-demo'}); assert.ok(docx.bytes.length>5000);
  const xlsx=await renderXlsxBinary(m.report,{report_id:'me-demo'}); assert.ok(xlsx.quality.sheet_count>=15);
});
