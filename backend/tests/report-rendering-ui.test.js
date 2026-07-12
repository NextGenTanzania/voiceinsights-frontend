import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const viewer = fs.readFileSync(path.join(root, '..', 'site', 'sample-report-viewer.html'), 'utf8');

test('v202 fixes low-contrast decision chips and mobile report readability', () => {
  assert.match(viewer, /v202 — publication rendering and mobile readability fixes/);
  assert.match(viewer, /\.vrds-evidence-type[\s\S]*color:#f7e7c8!important/);
  assert.match(viewer, /\.v202-chip[\s\S]*color:#f7e7c8!important/);
  assert.match(viewer, /@media\(max-width:760px\)[\s\S]*\.v191-export-grid\{grid-template-columns:1fr!important\}/);
});

test('v202 renders decision and risk cards through the publication card renderer', () => {
  assert.match(viewer, /function renderDecisionMatrixCards/);
  assert.match(viewer, /renderDecisionMatrixCards\(decisions, 'decision'\)/);
  assert.match(viewer, /renderDecisionMatrixCards\(risks, 'risk'\)/);
});

test('v202 visual downloads are HTML publication reports and include the v200 atlas renderer', () => {
  assert.match(viewer, /visualHtmlFromFormat/);
  assert.match(viewer, /type: 'text\/html;charset=utf-8'/);
  assert.match(viewer, /function renderAtlasCards/);
  assert.match(viewer, /Publication Infographic Atlas/);
});
