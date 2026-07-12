import test from 'node:test';
import assert from 'node:assert/strict';
import { vrdsTokens, vrdsExportTokens, vrdsComponents, classifyVRDSConfidence, getVRDSEvidenceStyle, getVRDSComponentSpec, VRDS_VERSION } from '../src/vrds-foundation.js';

test('VRDS foundation exposes versioned design tokens without runtime dependencies', () => {
  assert.equal(VRDS_VERSION, '1.0.0-phase-a');
  assert.equal(vrdsTokens.colors.blue900, '#071A33');
  assert.equal(vrdsTokens.evidenceColors.raw, '#1F8A4C');
  assert.equal(vrdsTokens.spacing[24], 24);
  assert.equal(vrdsTokens.radius.card, 16);
  assert.equal(vrdsTokens.grid.htmlColumns, 12);
});

test('VRDS export tokens define HTML, PDF and PowerPoint foundations', () => {
  assert.equal(vrdsExportTokens.pdf.pageSize, 'A4');
  assert.equal(vrdsExportTokens.pdf.marginMm, 18);
  assert.equal(vrdsExportTokens.pptx.layout, 'LAYOUT_WIDE');
  assert.equal(vrdsExportTokens.pptx.maxWordsPerSlide, 45);
  assert.equal(vrdsExportTokens.html.evidencePanelWidth, 360);
});

test('VRDS reusable component registry contains required Phase A components', () => {
  const required = ['cover','executiveSnapshot','executiveBrief','kpiCard','insightCard','evidenceCard','recommendationCard','riskCard','opportunityCard','methodologyCard','qualityCard','sdgCard','timeline','decisionMatrix','riskMatrix','confidenceBadge','navigationSidebar','assistantPanel'];
  for (const component of required) assert.ok(vrdsComponents.includes(component), component);
});

test('VRDS confidence classification follows manual bands', () => {
  assert.equal(classifyVRDSConfidence(94).label, 'Excellent');
  assert.equal(classifyVRDSConfidence(82).label, 'Strong');
  assert.equal(classifyVRDSConfidence(68).label, 'Moderate');
  assert.equal(classifyVRDSConfidence(50).label, 'Low');
  assert.equal(classifyVRDSConfidence(20).label, 'Insufficient');
});

test('VRDS evidence styles do not mislabel evidence classes', () => {
  assert.equal(getVRDSEvidenceStyle('raw response evidence').label, 'Raw-source evidence');
  assert.equal(getVRDSEvidenceStyle('report-model evidence').label, 'Report-model evidence');
  assert.equal(getVRDSEvidenceStyle('synthetic demo evidence').label, 'Synthetic demo evidence');
  assert.equal(getVRDSEvidenceStyle('insufficient verified evidence').label, 'Insufficient verified evidence');
});

test('VRDS component specs define required fields for implementation teams', () => {
  assert.deepEqual(getVRDSComponentSpec('cover').required, ['title', 'reportType', 'organization', 'country', 'date', 'status']);
  assert.ok(getVRDSComponentSpec('evidenceCard').required.includes('evidenceType'));
  assert.ok(getVRDSComponentSpec('recommendationCard').required.includes('owner'));
  assert.equal(getVRDSComponentSpec('unknown'), null);
});
