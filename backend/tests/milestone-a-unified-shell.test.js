import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root = path.resolve('..');
const site = path.join(root, 'site');
const page = (p) => fs.readFileSync(path.join(site, p), 'utf8');

const SHELL_TARGET_PAGES = ['login.html', 'sample-reports.html', 'sample-report-viewer.html', 'flagship-sample-report.html'];

test('tokens.css and components.css exist and are additive, not a redefinition of existing style.css tokens', () => {
  const tokens = fs.readFileSync(path.join(site, 'assets/css/tokens.css'), 'utf8');
  const components = fs.readFileSync(path.join(site, 'assets/css/components.css'), 'utf8');
  assert.match(tokens, /--space-1/);
  assert.match(tokens, /--elevation-1/);
  assert.match(tokens, /--motion-base/);
  assert.match(tokens, /--focus-ring/);
  assert.match(tokens, /--chart-1:\s*var\(--accent\)/, 'chart tokens must alias the existing semantic palette, not invent a new one');
  assert.doesNotMatch(tokens, /--bg:|--surface:|--text:|--accent:\s*#/, 'tokens.css must not redefine style.css color primitives');
  assert.match(components, /\.alert\s*\{/);
  assert.match(components, /\.tabs\s*\{/);
  assert.match(components, /\.modal-overlay\s*\{/);
  assert.match(components, /\.pagination\s*\{/);
  assert.match(components, /\.stepper\s*\{/);
  assert.match(components, /\.timeline\s*\{/);
  assert.match(components, /\.dropdown\s*\{/);
  assert.match(components, /\.evidence-card,\s*\.decision-card,\s*\.recommendation-card/);
});

test('site-search.js indexes only real, verifiable pages and every entry resolves to an existing file', () => {
  const searchJs = fs.readFileSync(path.join(site, 'assets/js/site-search.js'), 'utf8');
  const urlMatches = [...searchJs.matchAll(/url:\s*'(\/[a-z0-9\-\.]+)'/g)].map(m => m[1]);
  assert.ok(urlMatches.length >= 15, 'search index should cover a meaningful slice of the real public site');
  for (const url of urlMatches) {
    const target = path.join(site, url.replace(/^\//, ''));
    assert.ok(fs.existsSync(target), `site-search.js indexes a URL that does not exist: ${url}`);
  }
});

test('all four fragmented pages now share the real pub-nav header and a footer', () => {
  for (const p of SHELL_TARGET_PAGES) {
    const html = page(p);
    assert.match(html, /class="pub-nav(\s|")/, `${p} is missing the shared public header`);
    assert.match(html, /<footer/, `${p} is missing a footer`);
    assert.match(html, /assets\/css\/tokens\.css/, `${p} does not load tokens.css`);
    assert.match(html, /assets\/css\/components\.css/, `${p} does not load components.css`);
    assert.match(html, /assets\/js\/site-search\.js/, `${p} does not load site-search.js`);
  }
});

// Regression guard: a standalone `<script>initSiteSearch(...)</script>` tag
// placed before other `<script src>` tags broke sample-report-live-fix.test.js,
// which assumes exactly one bare inline <script> block sits immediately
// before </body>. The fix folds the init call into the page's existing
// inline script instead of adding a second bare <script> tag.
test('initSiteSearch is called from within an existing inline script, not a new standalone bare <script> tag', () => {
  for (const p of SHELL_TARGET_PAGES) {
    const html = page(p);
    assert.doesNotMatch(html, /<script>initSiteSearch\('site-search-mount'\);<\/script>/, `${p} reintroduced the standalone-script regression`);
    assert.match(html, /initSiteSearch\('site-search-mount'\);/, `${p} never calls initSiteSearch`);
  }
});

test('sample report viewer inline script is still syntactically valid (no new bare <script> tag was introduced)', () => {
  const html = page('sample-report-viewer.html');
  const bareScriptTags = [...html.matchAll(/<script>(?!<\/script>)/g)];
  // Exactly one bare (attribute-less) <script> tag should remain: the
  // original inline logic block, now also housing the search init call.
  assert.equal(bareScriptTags.length, 1, `expected exactly one bare <script> tag, found ${bareScriptTags.length}`);
});

test('login.html preserves its 0B fix and gains real trust-signal content, not another hardcoded credential', () => {
  const html = page('login.html');
  assert.doesNotMatch(html, /DemoLogin2026/i);
  assert.match(html, /Enterprise Application/);
  assert.match(html, /Multi-factor authentication/);
  assert.match(html, /Coming soon/);
  assert.match(html, /apiRequest\('\/api\/auth\/login'/);
});

test('sample-reports.html keeps its real search/sort/filter logic untouched by the shell change', () => {
  const html = page('sample-reports.html');
  assert.match(html, /id="library-search"/);
  assert.match(html, /id="library-sort"/);
  assert.match(html, /function applySearch/);
  assert.match(html, /function applySort/);
});

test('sample-report-viewer.html keeps its report-loading logic and gains real, non-fabricated publication metadata', () => {
  const html = page('sample-report-viewer.html');
  assert.match(html, /const reportId = params\.get\('report_id'\) \|\| params\.get\('id'\) \|\| params\.get\('report'\)/);
  assert.match(html, /function renderPublicationMeta/);
  // Reading time must be derived from a real field (estimated_pages), never a
  // hardcoded constant.
  assert.match(html, /Math\.round\(Number\(estimatedPages \|\| 10\) \* 2\)/);
  assert.match(html, /localStorage\.setItem\(bookmarkKey/);
});

// Unified Publication Runtime, Phase 2: this page's own bespoke citation
// block was deleted along with the rest of the old renderReport() summary
// template — the citation is now real, governed content rendered inside
// the fetched publication itself (buildInsideCoverSpread's citation block,
// composePublicationSpreads.js), not duplicated a second time in the page
// shell. Asserting "Cite this publication" against this raw file would
// therefore fail even though the citation is genuinely present — just one
// layer down, inside the iframe this page now fetches (see
// publication-runtime-view-route.test.js for that layer's coverage).
test('flagship-sample-report.html keeps its report-loading logic, share/bookmark, and fetches the runtime-rendered publication', () => {
  const html = page('flagship-sample-report.html');
  assert.match(html, /function loadReport\(\)/);
  assert.match(html, /function sharePublication/);
  assert.match(html, /function toggleBookmark/);
  assert.match(html, /\/api\/public\/flagship-sample-library\/\$\{encodeURIComponent\(reportKey\)\}\/view/);
  assert.match(html, /iframe\.srcdoc\s*=\s*html/);
});

test('renderShell() gains an additive, backward-compatible breadcrumb param and a real Help link', () => {
  const appJs = fs.readFileSync(path.join(site, 'assets/js/app.js'), 'utf8');
  assert.match(appJs, /function renderShell\(\{ role = 'client', active = '', title = '', eyebrow = '', breadcrumb = null \}\)/);
  assert.match(appJs, /href="\/faq\.html" title="Help"/);
  // Backward compatibility: calling renderShell() without a breadcrumb must
  // still fall back to the original eyebrow rendering, not break.
  assert.match(appJs, /breadcrumb && breadcrumb\.length/);
  assert.match(appJs, /eyebrow \? `<div class="eyebrow">/);
});

test('the universal skip-link auto-injector in app.js is unchanged and still guards against duplicate injection', () => {
  const appJs = fs.readFileSync(path.join(site, 'assets/js/app.js'), 'utf8');
  assert.match(appJs, /if \(mainEl && !document\.getElementById\('skip-to-content'\)\)/);
});

test('the four secondary auth/utility pages now load app.js and expose a real <main> landmark for the skip-link', () => {
  for (const p of ['404.html', 'forgot-password.html', 'reset-password.html', 'status.html']) {
    const html = page(p);
    assert.match(html, /assets\/js\/app\.js/, `${p} does not load app.js`);
  }
  for (const p of ['forgot-password.html', 'reset-password.html']) {
    const html = page(p);
    assert.match(html, /<main id="main-content"/, `${p} has no <main> landmark for the auto skip-link`);
  }
});

test('Milestone A introduced no backend, API, or database changes', () => {
  const backendDiffCandidates = ['src/application.js'];
  for (const rel of backendDiffCandidates) {
    const content = fs.readFileSync(path.join(root, 'backend', rel), 'utf8');
    assert.doesNotMatch(content, /renderShell|pub-nav|site-search/i, `${rel} should have no frontend-shell coupling`);
  }
  const migrationsDir = path.join(root, 'backend/migrations');
  // Program Beta Sprint 1 (a later, separately-scoped release) legitimately
  // added 042_decision_action_lifecycle.sql — real, deliberate backend work
  // outside Milestone A's own frontend-only scope, not a violation of it.
  const KNOWN_LATER_MIGRATIONS = new Set(['042_decision_action_lifecycle.sql', '043_decision_event_foundation.sql', '044_decision_escalation_foundation.sql', '045_decision_projection_layer.sql', '046_expert_feedback_programme.sql']);
  if (fs.existsSync(migrationsDir)) {
    const cutoff = new Date('2026-07-18T00:00:00Z');
    for (const f of fs.readdirSync(migrationsDir)) {
      if (KNOWN_LATER_MIGRATIONS.has(f)) continue;
      const mtime = fs.statSync(path.join(migrationsDir, f)).mtime;
      assert.ok(mtime < cutoff, `unexpected new migration file: ${f}`);
    }
  }
});
