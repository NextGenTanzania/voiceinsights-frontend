import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('..');
const site = path.join(ROOT, 'site');

test('v205 admin functional QA script exists and provides handlers for common dashboard actions', () => {
  const file = path.join(site, 'assets/js/admin-functional-qa.js');
  const js = fs.readFileSync(file, 'utf8');
  assert.match(js, /VIAdminFunctionalQA/);
  assert.match(js, /export-pdf-btn/);
  assert.match(js, /export-pptx-btn/);
  assert.match(js, /brand-logo-upload-btn/);
  assert.match(js, /l-proposal-link/);
  assert.match(js, /org-invoice-link/);
  assert.match(js, /visibleTableCsv/);
});

test('v205 admin and app pages include the functional QA safety layer', () => {
  const pages = [
    'admin/dashboard.html',
    'admin/organizations.html',
    'admin/lead-profile.html',
    'admin/operations.html',
    'app/dashboard.html',
    'app/report-viewer.html',
    'app/settings.html',
    'app/report-library.html'
  ];
  for (const rel of pages) {
    const html = fs.readFileSync(path.join(site, rel), 'utf8');
    assert.match(html, /admin-functional-qa\.js/, `${rel} must include admin-functional-qa.js`);
  }
});

test('v205 dead admin links are resolved or captured instead of silently doing nothing', () => {
  const js = fs.readFileSync(path.join(site, 'assets/js/admin-functional-qa.js'), 'utf8');
  assert.match(js, /resolveDeadLink/);
  assert.match(js, /This admin link has been captured by QA/);
  assert.match(js, /This button is visible and QA-protected/);
});
