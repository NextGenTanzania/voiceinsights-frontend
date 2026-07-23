// Program Beta Sprint 3 — Executive Intelligence accessibility regression.
// Found via a real axe-core run against the live Preview Executive
// Intelligence page (all 6 stylesheets injected fresh, cache-busted, to
// rule out staleness as the cause — same rigor as the RC1 theme-polarity
// finding): .badge-danger ("Critical" severity badges, used throughout the
// Leadership Attention Brief) measured 4.01:1 contrast, just under the
// 4.5:1 WCAG AA text threshold. Pre-existing sitewide token, first
// surfaced by this page's density of Critical badges.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(__dirname, '../../site/assets/css/style.css'), 'utf8');

test('style.css: dark-theme --danger is lightened to clear 4.5:1 against badge-danger\'s composited background (was #D9634A at 4.01:1, live axe-core finding)', () => {
  const rootMatch = css.match(/:root\s*\{([^}]*)\}/);
  assert.ok(rootMatch, ':root block must exist');
  assert.match(rootMatch[1], /--danger:\s*#E17A62/, 'the default (dark-theme) --danger token must be the lightened, AA-passing shade');
  assert.doesNotMatch(rootMatch[1], /--danger:\s*#D9634A/, 'the old, under-contrast shade must not remain in the default block');
});

test('style.css: --danger-bg is left unchanged — only the text color was adjusted, not the badge background tint', () => {
  assert.match(css, /--danger-bg:\s*rgba\(217,\s*99,\s*74,\s*0\.12\)/);
});
