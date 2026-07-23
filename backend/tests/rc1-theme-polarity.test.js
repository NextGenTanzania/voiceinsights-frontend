// tests/rc1-theme-polarity.test.js
// RC1 Part 6 (live re-check) — enterprise-dashboard-theme.css defined its
// light/dark --via-* palettes with inverted selector polarity relative to
// the rest of the design system: its :root (default, unmarked) block held
// the LIGHT palette and html[data-theme="dark"] held the dark override, but
// the real toggle (style.css / app.js) makes dark the default and only ever
// sets [data-theme="light"]. That made .table-wrap/.card/.v207b-panel/
// .v207c-card permanently render the light --via-card (#fff) background
// while the surrounding text correctly followed the real (dark-by-default)
// --text token — reproduced live via axe-core (color-contrast, 1.14:1,
// 25 nodes) against the real deployed Preview Pages frontend.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(__dirname, '../../site/assets/css/enterprise-dashboard-theme.css'), 'utf8');

test('enterprise-dashboard-theme.css: the dark --via-* palette is the unmarked :root default, matching the app\'s real dark-by-default convention', () => {
  const rootMatch = css.match(/:root\{([^}]*)\}/);
  assert.ok(rootMatch, ':root block must exist');
  assert.match(rootMatch[1], /--via-card:#13211e/, ':root (default) must hold the dark card color, not the light one');
});

test('enterprise-dashboard-theme.css: the light --via-* palette is scoped to html[data-theme="light"], not html[data-theme="dark"]', () => {
  assert.match(css, /html\[data-theme="light"\]\{[^}]*--via-card:#ffffff/, 'the light palette must be gated behind the light override selector the real toggle actually sets');
  assert.doesNotMatch(css, /html\[data-theme="dark"\]/, 'no rule may gate on data-theme="dark" — the real toggle never sets this attribute value, so any such rule is permanently dead');
});
