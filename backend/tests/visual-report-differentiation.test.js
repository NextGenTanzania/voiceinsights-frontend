import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const viewerSource = fs.readFileSync(new URL('../../site/sample-report-viewer.html', import.meta.url), 'utf8');

test('v191 visual downloads use HTML report documents rather than plain text previews', () => {
  assert.match(viewerSource, /function visualHtmlFromFormat/);
  assert.match(viewerSource, /type: 'text\/html;charset=utf-8'/);
  assert.match(viewerSource, /visual-report-\$\{reportId\}\.html/);
  assert.match(viewerSource, /Visual Report Downloads/);
});

test('v191 viewer exposes SDG-aligned visual badges with colors and numbers', () => {
  assert.match(viewerSource, /SDG_VISUALS/);
  assert.match(viewerSource, /v191-sdg-badge/);
  assert.match(viewerSource, /SDG-aligned visual badges/);
  assert.match(viewerSource, /Official UN SDG logo assets are not claimed/);
});

test('report views are differentiated by sector and audience', () => {
  assert.match(viewerSource, /Distinct report brain/);
  assert.match(viewerSource, /reportTheme/);
  assert.match(viewerSource, /Government Cabinet Brief/);
  assert.match(viewerSource, /Donor Impact Report/);
  assert.match(viewerSource, /Presentation-ready Board Deck/);
});

test('v191 visual report documents include infographic sections for all key decisions', () => {
  assert.match(viewerSource, /Publication Infographics/);
  assert.match(viewerSource, /Regional Intelligence/);
  assert.match(viewerSource, /Gender & Inclusion/);
  assert.match(viewerSource, /Risk & Decision Matrix/);
  assert.match(viewerSource, /Recommendation Priority Timeline/);
});
