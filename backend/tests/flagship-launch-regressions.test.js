import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FLAGSHIP_SAMPLE_REPORTS, buildFlagshipSampleReport } from '../src/flagship-sample-library.js';
import { buildDocumentComposition } from '../src/document-composer.js';
import { renderPdfBinary } from '../src/dedicated-binary-renderer.js';
import application from '../src/application.js';

test('interactive report viewer avoids the initialization crash and fails safely on missing fields',()=>{
  const viewer=fs.readFileSync(new URL('../../site/flagship-sample-report.html',import.meta.url),'utf8');
  assert.doesNotMatch(viewer,/map\(\(\[k,v\]\)/);
  assert.doesNotMatch(viewer,/function chart\(v\)/);
  assert.match(viewer,/const formatNumber=/);
  assert.match(viewer,/publication\.sample_size\?\?statistics\.sample_size/);
  assert.match(viewer,/Evidence Explorer &amp; Lineage/);
});

test('sample library uses responsive card widths without forced word splitting',()=>{
  const library=fs.readFileSync(new URL('../../site/sample-reports.html',import.meta.url),'utf8');
  assert.match(library,/auto-fit,minmax\(min\(100%,340px\),1fr\)/);
  assert.match(library,/word-break:normal/);
  assert.doesNotMatch(library,/overflow-wrap:anywhere/);
  assert.match(library,/pages_equivalent/);
});

test('all sixteen reports contain sector-specific evidence, chart data and consistent totals',()=>{
  const firstFindingTexts=new Set();const firstQuotes=new Set();const coverLayouts=new Set();
  for(const sample of FLAGSHIP_SAMPLE_REPORTS){
    const model=buildFlagshipSampleReport(sample.key);const report=model.report;const publication=model.full_publication;
    assert.equal(report.full_publication,publication);
    assert.equal(report.publication_page_equivalent,'34 generated publication pages');
    assert.ok(report.evidence.length>=10);
    assert.ok(report.evidence.every(item=>item.survey_question&&item.indicator&&item.gps&&item.audio_reference&&item.photo_reference&&item.approval));
    assert.ok(report.visualizations.every(visual=>visual.data.length===4&&visual.interpretation&&visual.accessibility.alt_text));
    assert.equal(publication.regional.reduce((sum,row)=>sum+row.responses,0),report.statistical_intelligence.sample_size);
    assert.ok(publication.indicators.every(item=>item.value>=0&&item.value<=100&&item.target>=0&&item.target<=100));
    assert.equal(report.quality_scores.gate,'PUBLICATION_READY');
    assert.equal(report.export_manifest.length,9);coverLayouts.add(sample.cover.layout_variant);
    firstFindingTexts.add(report.findings[0].text);firstQuotes.add(report.evidence[0].quote);
  }
  assert.equal(firstFindingTexts.size,16);assert.equal(firstQuotes.size,16);assert.equal(coverLayouts.size,16);
});

test('flagship PDF is a tagged 34-page publication generated from full report model',async()=>{
  const model=buildFlagshipSampleReport('humanitarian-needs-assessment');
  const composition=buildDocumentComposition(model.report,'pdf',{tenant_id:'public-demo'});composition.full_report=model.report;
  const artifact=await renderPdfBinary(composition);
  const text=new TextDecoder().decode(artifact.bytes);
  assert.equal(artifact.quality.page_count,34);assert.equal(artifact.quality.tagged_pdf,true);
  assert.match(text,/\/StructTreeRoot/);assert.match(text,/\/Marked true/);assert.ok(artifact.byte_length>40000);
});

test('public sample exports are blocked unless deterministic publication gate passes',()=>{
  const application=fs.readFileSync(new URL('../src/application.js',import.meta.url),'utf8');
  assert.match(application,/quality_scores\?\.gate!==\'PUBLICATION_READY\'/);
  assert.match(application,/Publication quality gate blocked export/);
});

test('all nine governed sample publication products return real artifacts',async()=>{
  for(const format of ['pdf','docx','pptx','xlsx','board-deck','policy-brief','cabinet-memo','investor-deck','html']){
    const response=await application.fetch(new Request(`https://api.example/api/public/flagship-sample-library/donor-impact-evaluation/export/${format}`),{});
    const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(response.status,200,format);assert.ok(bytes.length>500,format);assert.ok(response.headers.get('x-artifact-checksum'),format);
  }
});

test('public web collection fails closed on consent and inactive campaigns',()=>{
  const pipeline=fs.readFileSync(new URL('../src/channel-pipeline.js',import.meta.url),'utf8');
  const application=fs.readFileSync(new URL('../src/application.js',import.meta.url),'utf8');
  assert.match(pipeline,/const consentGiven = form\.get\('consent'\) === '1'/);
  assert.match(pipeline,/campaign\.status !== 'active'/);
  assert.match(application,/Campaign not found or inactive/);
});

test('deployment contains recognized headers, crawler files and honest telemetry fallbacks',()=>{
  const headers=fs.readFileSync(new URL('../../site/_headers',import.meta.url),'utf8');
  const admin=fs.readFileSync(new URL('../../site/assets/js/super-admin-workspace.js',import.meta.url),'utf8');
  assert.match(headers,/Strict-Transport-Security/);assert.match(headers,/Content-Security-Policy/);
  assert.doesNotMatch(admin,/enterprise_readiness_score:99/);assert.match(admin,/telemetry_unavailable/);
  assert.ok(fs.existsSync(new URL('../../site/robots.txt',import.meta.url)));assert.ok(fs.existsSync(new URL('../../site/sitemap.xml',import.meta.url)));
});
