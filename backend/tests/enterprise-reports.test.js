import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnterpriseReportsWorkspace, buildEvidenceExplorer, buildPresentation, answerReportAssistant } from '../src/enterprise-reports.js';
const model={title:'Test Report',sample_size:100,findings:['Finding A'],risks:['Risk A'],recommendations:['Action A'],evidence:[{id:'e1',claim:'Finding A',confidence_score:92}]};
test('v210.4 creates all enterprise report products and export formats',()=>{const w=buildEnterpriseReportsWorkspace(model);assert.equal(w.products.length,5);assert.deepEqual(w.capabilities.includes('PowerPoint'),true);assert.equal(w.export_manifest.word.status,'binary-ready');assert.equal(w.export_manifest.excel.status,'binary-ready')});
test('Evidence Explorer preserves evidence confidence and claim',()=>{const e=buildEvidenceExplorer(model);assert.equal(e.items[0].claim,'Finding A');assert.equal(e.items[0].confidence_score,92)});
test('Presentation Builder creates board-ready slide plan',()=>{const p=buildPresentation(model,'board');assert.ok(p.slides.length>=8);assert.equal(p.audience,'board')});
test('AI Assistant answers risks and actions with citations',()=>{const r=answerReportAssistant(model,'What is the top risk?');assert.match(r.answer,/Risk A/);assert.ok(r.citations.length>0)});
test('Frontend Enterprise Reports Studio exists with required modules',async()=>{const fs=await import('node:fs/promises');const html=await fs.readFile(new URL('../../site/app/enterprise-reports-studio.html',import.meta.url),'utf8');for(const term of ['Evidence Explorer','Report AI Assistant','Presentation Builder','Enterprise Export Center'])assert.ok(html.includes(term))});
