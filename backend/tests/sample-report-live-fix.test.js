import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..', '..');
const backend = resolve(root, 'backend');
const site = resolve(root, 'site');
const src = (p) => readFileSync(resolve(backend, p), 'utf8');
const page = (p) => readFileSync(resolve(site, p), 'utf8');

test('sample report viewer JavaScript is syntactically valid after live loading fix', () => {
  const html = page('sample-report-viewer.html');
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
  assert.ok(script, 'inline viewer script not found');
  const check = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: script, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.match(html, /const reportId = params\.get\('report_id'\) \|\| params\.get\('id'\) \|\| params\.get\('report'\)/);
  assert.match(html, /lines\.join\('\\n'\)/, 'export text join must not contain a raw newline syntax break');
});

test('public showcase exports bypass quality-gate blocks only for published demo reports', () => {
  const index = src('src/application.js');
  assert.match(index, /function applyDemoShowcaseExportOverride/);
  assert.match(index, /if \(!enrichedModel\?\.is_demo\) return verification/);
  assert.match(index, /demo_showcase_override: true/);
  assert.match(index, /verification = applyDemoShowcaseExportOverride\(phase19Model, verification\)/);
  assert.match(index, /WHERE id = \? AND is_demo = 1 AND status = 'published'/);
});

test('public trust endpoint reports demo showcase export approval without raw evidence mislabelling', () => {
  const index = src('src/application.js');
  assert.match(index, /const demoVerification = applyDemoShowcaseExportOverride/);
  assert.match(index, /ai_verification: demoVerification/);
  assert.match(index, /fictional sample data|synthetic demo|report-model evidence/i);
});

test('mobile and tablet report viewer use the modern VRDS showcase instead of legacy report blocks', () => {
  const html = page('sample-report-viewer.html');
  assert.match(html, /@media \(max-width: 900px\)/);
  assert.match(html, /@media \(min-width: 901px\) and \(max-width: 1180px\)/);
  assert.match(html, /vrds-showcase-loaded #report-body\{display:none;\}/);
  assert.match(html, /document\.body\.classList\.add\('vrds-showcase-loaded'\)/);
});

test('public demo pages are marked no-cache so newly deployed report UI is not stuck on old cached versions', () => {
  const headers = page('_headers');
  assert.match(headers, /\/sample-reports\.html[\s\S]*Cache-Control: no-cache, no-store, must-revalidate/);
  assert.match(headers, /\/flagship-sample-report\.html[\s\S]*Cache-Control: no-cache, no-store, must-revalidate/);
  assert.match(page('sw.js'), /voiceinsights-enumerator/);
});
