// Sector Intelligence Platform: structural tests for the shared sector-page
// framework, following the exact pattern milestone-a-unified-shell.test.js
// already established (read raw HTML with fs.readFileSync, assert with
// regex/string matches) rather than inventing a new test style.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('..');
const site = path.join(root, 'site');
const page = (p) => fs.readFileSync(path.join(site, p), 'utf8');

const SECTOR_PAGES = ['sectors/health.html', 'sectors/education.html', 'sectors/agriculture.html', 'sectors/humanitarian.html', 'sectors/governance.html', 'sectors/market-research.html', 'sectors/customer-experience.html', 'sectors/employee-experience.html', 'sectors/climate.html', 'sectors/social-protection.html', 'sectors/digital-government.html', 'sectors/wash-access.html', 'sectors/energy-access.html', 'sectors/financial-inclusion.html'];
const FLAGSHIP_PAGES = ['procurement.html', 'mobile-offline.html', 'enterprise-sales.html', 'enterprise-capability-statement.html', 'health-capability-statement.html'];
const ALL_FRAMEWORK_PAGES = [...SECTOR_PAGES, ...FLAGSHIP_PAGES];
// executive-one-pager.html and meeting-leave-behind.html are deliberately
// compact, print-optimized pages (RC1 Part 3) — same renderSectorPage()
// engine, but no site-search mount by design, so they get their own,
// smaller assertion set below rather than joining ALL_FRAMEWORK_PAGES.
const PRINT_FRAMEWORK_PAGES = ['executive-one-pager.html', 'meeting-leave-behind.html'];

test('sector-framework.css exists and defines the documented component class contract', () => {
  const css = fs.readFileSync(path.join(site, 'assets/css/sector-framework.css'), 'utf8');
  for (const cls of ['.sector-stat-row', '.sector-section-head', '.sector-capability-card', '.sector-workflow-steps', '.sector-dashboard-preview-panel', '.sector-pub-grid', '.sector-module-grid', '.sector-integration-grid', '.sector-security-links', '.sector-outcome-card', '.sector-faq-item', '.sector-cta-block', '.sector-related-list']) {
    assert.ok(css.includes(cls), `sector-framework.css is missing ${cls}`);
  }
  // Additive discipline: reuses tokens, never redefines style.css color primitives.
  assert.doesNotMatch(css, /--bg:|--surface:\s*#|--text:\s*#|--accent:\s*#[0-9a-fA-F]/, 'sector-framework.css must not redefine style.css color primitives');
});

test('sector-page.js exports the documented render engine functions', () => {
  const js = fs.readFileSync(path.join(site, 'assets/js/sector-page.js'), 'utf8');
  for (const fn of ['renderSectorPage', 'renderHero', 'renderExecutiveSummary', 'renderChallenges', 'renderWhyVoiceInsights', 'renderAiCapabilities', 'renderWorkflow', 'renderDashboardPreview', 'renderModuleShowcase', 'renderPublicationLibrary', 'renderIntegrations', 'renderSecurityGovernance', 'renderCustomerOutcomes', 'renderFaqSection', 'renderCta', 'renderBookDemo', 'renderRelatedSectors']) {
    assert.match(js, new RegExp(`function ${fn}\\(`), `sector-page.js is missing ${fn}()`);
  }
  // The one async section fetches the real public catalog — never a
  // hand-typed list of titles — and supports filtering by a single domain
  // or an array of domains (Health alone spans six knowledge-router domains).
  assert.match(js, /flagship-sample-library/);
  assert.match(js, /Array\.isArray\(cfg\.domain\)/);
});

test('every sector and flagship page loads the full framework stack and shares the real nav/footer', () => {
  for (const p of ALL_FRAMEWORK_PAGES) {
    const html = page(p);
    assert.match(html, /class="pub-nav(\s|")/, `${p} is missing the shared public nav`);
    assert.match(html, /<footer/, `${p} is missing a footer`);
    assert.match(html, /assets\/css\/tokens\.css/, `${p} does not load tokens.css`);
    assert.match(html, /assets\/css\/components\.css/, `${p} does not load components.css`);
    assert.match(html, /assets\/css\/sector-framework\.css/, `${p} does not load sector-framework.css`);
    assert.match(html, /assets\/js\/sector-page\.js/, `${p} does not load sector-page.js`);
    assert.match(html, /renderSectorPage\(/, `${p} never calls renderSectorPage(`);
    assert.match(html, /initSiteSearch\('site-search-mount'\)/, `${p} does not wire up site search`);
  }
});

test('content lives in each page\'s config object, not hand-written markup — no bespoke h1/h2 in the raw file', () => {
  for (const p of [...ALL_FRAMEWORK_PAGES, ...PRINT_FRAMEWORK_PAGES]) {
    const html = page(p);
    assert.doesNotMatch(html, /<h1[\s>]/, `${p} contains a hand-written <h1> — headings must come from renderSectorPage's config, not bespoke markup`);
    assert.doesNotMatch(html, /<h2[\s>]/, `${p} contains a hand-written <h2> — headings must come from renderSectorPage's config, not bespoke markup`);
  }
});

test('the two print-optimized pages load renderSectorPage() and print CSS, without the site-search mount they deliberately omit', () => {
  for (const p of PRINT_FRAMEWORK_PAGES) {
    const html = page(p);
    assert.match(html, /assets\/js\/sector-page\.js/, `${p} does not load sector-page.js`);
    assert.match(html, /renderSectorPage\(/, `${p} never calls renderSectorPage(`);
    assert.match(html, /@media print/, `${p} is missing print-specific CSS`);
    assert.match(html, /window\.print\(\)/, `${p} is missing a Print / Save as PDF control`);
  }
});

test('site-search.js indexes every new sector and flagship page, and every indexed URL resolves to a real file', () => {
  const searchJs = fs.readFileSync(path.join(site, 'assets/js/site-search.js'), 'utf8');
  for (const p of ALL_FRAMEWORK_PAGES) {
    assert.match(searchJs, new RegExp(`/${p.replace(/\//g, '\\/').replace('.html', '\\.html')}`), `site-search.js does not index ${p}`);
  }
  const urlMatches = [...searchJs.matchAll(/url:\s*'(\/[a-z0-9\-\/\.]+)'/g)].map((m) => m[1]);
  for (const url of urlMatches) {
    const target = path.join(site, url.replace(/^\//, ''));
    assert.ok(fs.existsSync(target), `site-search.js indexes a URL that does not exist: ${url}`);
  }
});

test('industries.html links through to every sector page, including the 6 new Enterprise Market Validation Release sectors', () => {
  const html = page('industries.html');
  for (const p of SECTOR_PAGES) {
    assert.match(html, new RegExp(`/${p.replace(/\//g, '\\/').replace('.html', '\\.html')}`), `industries.html does not link to ${p}`);
  }
});

test('the 5 new Health flagship publications have working static export files with a matching manifest entry', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(site, 'sample-exports/manifest.json'), 'utf8'));
  const NEW_HEALTH_KEYS = ['hospital-performance-intelligence', 'maternal-child-health-intelligence', 'disease-surveillance-intelligence', 'nutrition-security-intelligence', 'health-financing-uhc-intelligence'];
  for (const key of NEW_HEALTH_KEYS) {
    for (const format of ['pdf', 'docx', 'pptx', 'xlsx']) {
      const entry = manifest.artifacts.find((a) => a.key === key && a.format === format);
      assert.ok(entry, `manifest is missing ${key}.${format}`);
      assert.ok(fs.existsSync(path.join(site, entry.path.replace(/^\//, ''))), `static export file missing on disk: ${entry.path}`);
      assert.ok(entry.bytes > 500, `${key}.${format} is suspiciously small`);
    }
  }
});

test('the new Digital Government Services publication has working static export files with a matching manifest entry', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(site, 'sample-exports/manifest.json'), 'utf8'));
  for (const format of ['pdf', 'docx', 'pptx', 'xlsx']) {
    const entry = manifest.artifacts.find((a) => a.key === 'digital-government-services-intelligence' && a.format === format);
    assert.ok(entry, `manifest is missing digital-government-services-intelligence.${format}`);
    assert.ok(fs.existsSync(path.join(site, entry.path.replace(/^\//, ''))), `static export file missing on disk: ${entry.path}`);
    assert.ok(entry.bytes > 500, `digital-government-services-intelligence.${format} is suspiciously small`);
  }
});

test('the 8 new Editorial Division Release publications have working static export files with matching manifest entries', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(site, 'sample-exports/manifest.json'), 'utf8'));
  const NEW_KEYS = ['wash-access-intelligence', 'energy-access-intelligence', 'food-security-intelligence', 'justice-legal-services-intelligence', 'financial-inclusion-intelligence', 'displacement-durable-solutions-intelligence', 'youth-skills-employability-intelligence', 'public-financial-management-intelligence'];
  for (const key of NEW_KEYS) {
    for (const format of ['pdf', 'docx', 'pptx', 'xlsx']) {
      const entry = manifest.artifacts.find((a) => a.key === key && a.format === format);
      assert.ok(entry, `manifest is missing ${key}.${format}`);
      assert.ok(fs.existsSync(path.join(site, entry.path.replace(/^\//, ''))), `static export file missing on disk: ${entry.path}`);
      assert.ok(entry.bytes > 500, `${key}.${format} is suspiciously small`);
    }
  }
});
