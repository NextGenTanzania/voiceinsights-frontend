import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('..'); const site=path.join(root,'site');
function files(dir,re){const out=[];(function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){if(e.isDirectory()&&(e.name==='node_modules'||e.name==='.git'))continue;const f=path.join(p,e.name);e.isDirectory()?walk(f):re.test(e.name)&&out.push(f);}})(dir);return out;}
const CRED_PATTERN=/DemoLogin2026|M&E\.demo@voiceinsightsafrica\.com/i;

// Release 0B, Part 1: a reusable demo password and a matching email were
// visible in login.html's rendered HTML and duplicated in a client-side JS
// string comparison that bypassed /api/auth/login entirely. Both are removed;
// this scans every publicly-servable file under site/, not just login.html.
test('no publicly-servable file under site/ contains the removed demo credential', () => {
  const offenders = [];
  for (const f of files(site, /\.(html|js|json|txt|xml|md|css)$/i)) {
    const content = fs.readFileSync(f, 'utf8');
    if (CRED_PATTERN.test(content)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `credential exposure found in: ${offenders.join(', ')}`);
});

test('login.html no longer contains a client-side auth bypass, and submits normally to /api/auth/login', () => {
  const login = fs.readFileSync(path.join(site, 'login.html'), 'utf8');
  assert.doesNotMatch(login, /demo-creds-toggle|demo-creds-detail/);
  assert.doesNotMatch(login, /vi_demo_mode/);
  assert.match(login, /apiRequest\('\/api\/auth\/login'/);
  assert.match(login, /method:\s*'POST'/);
  // The replacement area still exists and offers real, working destinations —
  // not another hardcoded credential and not a dead end.
  assert.match(login, /Interactive product demonstration is being prepared/);
  assert.match(login, /href="\/contact\.html"[^>]*>Request Demo/);
  assert.match(login, /href="\/contact\.html"[^>]*>Contact Sales/);
  assert.match(login, /href="\/index\.html"[^>]*>Return to Website/);
});

test('demo/me-dashboard.html still exists, unreached by any login path, and still self-gates on vi_demo_mode', () => {
  // "Do not delete files yet" — the file is preserved; it is simply no longer
  // reachable through any real navigation path now that login.html's bypass
  // is gone. It still bounces to /login.html if visited directly without the
  // session flag, which nothing can set anymore.
  const demoDash = path.join(site, 'demo', 'me-dashboard.html');
  assert.equal(fs.existsSync(demoDash), true);
  const content = fs.readFileSync(demoDash, 'utf8');
  assert.match(content, /sessionStorage\.getItem\('vi_demo_mode'\)!=='me'/);
  for (const f of files(site, /\.html$/i)) {
    if (f === demoDash) continue;
    const c = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(c, /demo\/me-dashboard\.html/, `${f} still links to the orphaned demo dashboard`);
  }
});

// Part 2: dashboard.html, collection-operations.html and enumerator-workspace.html
// previously linked directly into two broken chains
// (organization-admin-workspace -> organization-operational-dashboard, and
// field-intelligence-workspace -> me-operational-dashboard), both of which
// call backend routes confirmed absent from application.js.
test('no active customer navigation links to the confirmed-broken workspace chains', () => {
  const BROKEN_TARGETS = /organization-admin-workspace\.html|field-intelligence-workspace\.html/;
  const ACTIVE_NAV_PAGES = [
    'app/dashboard.html',
    'app/collection-operations.html',
    'app/enumerator-workspace.html',
  ];
  for (const rel of ACTIVE_NAV_PAGES) {
    const content = fs.readFileSync(path.join(site, rel), 'utf8');
    assert.doesNotMatch(content, BROKEN_TARGETS, `${rel} still links into a broken workspace chain`);
  }
  // The redirect stub files themselves are preserved (legacy URLs kept alive)
  // but no longer have any inbound link from real navigation.
  assert.equal(fs.existsSync(path.join(site, 'app/organization-admin-workspace.html')), true);
  assert.equal(fs.existsSync(path.join(site, 'app/field-intelligence-workspace.html')), true);
});

test('the working enumerator workspace link is preserved on dashboard.html even though its broken sibling was removed', () => {
  const content = fs.readFileSync(path.join(site, 'app/dashboard.html'), 'utf8');
  assert.match(content, /href="\/app\/enumerator-workspace\.html"/);
});

test('direct access to the legacy dashboard URLs shows a professional message, not raw JSON or a raw HTTP error', () => {
  for (const rel of ['app/organization-operational-dashboard.html', 'app/me-operational-dashboard.html']) {
    const content = fs.readFileSync(path.join(site, rel), 'utf8');
    // The real API call is still attempted first — no fake data is invented —
    // but the catch path no longer renders e.message (a raw "HTTP 404" or
    // backend error string) directly into the page.
    assert.match(content, /catch\(e\)/);
    assert.doesNotMatch(content, /content'\)\.textContent=e\.message/);
    assert.match(content, /temporarily unavailable/i);
    assert.match(content, /href="\/app\/dashboard\.html"/);
  }
});

test('the two dependent backend routes remain undeclared (no fake route was invented to paper over the gap)', () => {
  const appSrc = fs.readFileSync(path.join(root, 'backend/src/application.js'), 'utf8');
  assert.doesNotMatch(appSrc, /['"]\/api\/operational-readiness\/organization-dashboard['"]/);
  assert.doesNotMatch(appSrc, /['"]\/api\/field-intelligence['"]/);
});

test('Release 0B introduced no database migration', () => {
  const migrationsDir = path.join(root, 'backend/migrations');
  if (!fs.existsSync(migrationsDir)) return;
  const stat = fs.statSync(migrationsDir);
  const cutoff = new Date('2026-07-18T00:00:00Z');
  // Program Beta Sprint 1 (a later, separately-scoped release) legitimately
  // added 042_decision_action_lifecycle.sql — real, deliberate backend work
  // outside Release 0B's own hotfix-only scope, not a violation of it.
  const KNOWN_LATER_MIGRATIONS = new Set(['042_decision_action_lifecycle.sql', '043_decision_event_foundation.sql', '044_decision_escalation_foundation.sql', '045_decision_projection_layer.sql', '046_expert_feedback_programme.sql']);
  for (const f of fs.readdirSync(migrationsDir)) {
    if (KNOWN_LATER_MIGRATIONS.has(f)) continue;
    const mtime = fs.statSync(path.join(migrationsDir, f)).mtime;
    assert.ok(mtime < cutoff, `unexpected new migration file: ${f}`);
  }
});

test('the Sample Report Library and static exports are unchanged by this hotfix', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(site, 'sample-exports/manifest.json'), 'utf8'));
  // Sector Intelligence Platform: 64 -> 84 (16 original flagship keys x 4
  // formats -> 21, after backend/scripts/generate-sample-exports.js closed
  // the pre-existing "no committed script produces these" gap and was run
  // for the 5 new Health publications). RC1: 84 -> 96, generate-sample-exports.js
  // run again for the 3 new MSL-gap publications (Education, Climate, Social Protection).
  // Enterprise Market Validation Release: 96 -> 100, run again for the one
  // genuinely new publication (Digital Government Services) — the other 3
  // new sector pages reuse already-exported, re-sectored publications.
  // Editorial Division Release: 100 -> 132, run again for the 8 new
  // publications (32 new artifacts: 8 keys x 4 formats).
  assert.equal(manifest.count, 132);
  const library = fs.readFileSync(path.join(site, 'sample-reports.html'), 'utf8');
  assert.match(library, /library-search/);
  assert.match(library, /library-sort/);
});
