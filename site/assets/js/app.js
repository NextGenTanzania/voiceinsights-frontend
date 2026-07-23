/* VoiceInsights Africa — shared app shell + mock data + i18n-aware nav */

const VI = {
  lang: localStorage.getItem('vi_lang') || 'en',
  user: { name: 'Kitentya Luth', org: 'VoiceInsights Africa', role: 'org_admin', initials: 'KL' },
};

// ---------- Theme (dark/light) — applied immediately to avoid a flash ----------
function getTheme() {
  const saved = localStorage.getItem('vi_theme');
  return saved === 'dark' || saved === 'light' ? saved : 'light';
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  localStorage.setItem('vi_theme', theme);
  document.querySelectorAll('.theme-toggle-btn').forEach((button) => {
    const icon = button.querySelector('.theme-toggle-icon');
    if (icon) icon.textContent = theme === 'light' ? '\u2600\uFE0F' : '\uD83C\uDF19';
    button.setAttribute('aria-label', theme === 'light' ? 'Light mode. Switch to dark mode' : 'Dark mode. Switch to light mode');
    button.setAttribute('title', theme === 'light' ? 'Light mode' : 'Dark mode');
    button.setAttribute('aria-pressed', String(theme === 'dark'));
  });
}
function toggleTheme() {
  const next = getTheme() === 'light' ? 'dark' : 'light';
  applyTheme(next);
}
applyTheme(getTheme()); // run immediately on script load, before DOMContentLoaded, to avoid a flash of the wrong theme

// ---------- App-wide language (separate from the public marketing site toggle) ----------
function getAppLang() {
  return localStorage.getItem('vi_app_lang') || 'en';
}
function setAppLang(lang) {
  localStorage.setItem('vi_app_lang', lang);
  location.reload();
}
// Looks up a translation key; falls back to English, then to the literal fallback text supplied.
function t(key, fallback) {
  const lang = getAppLang();
  if (typeof TRANSLATIONS !== 'undefined') {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    if (dict && dict[key] != null) return dict[key];
    if (TRANSLATIONS.en && TRANSLATIONS.en[key] != null) return TRANSLATIONS.en[key];
  }
  return fallback;
}

// Generates <tr> skeleton-loading rows for a table with `cols` columns, `rows` of them.
function skeletonRows(cols, rows = 4) {
  const cells = Array.from({ length: cols }, () => `<td><div class="skeleton skeleton-text" style="width:${60 + Math.round(Math.random() * 30)}%;"></div></td>`).join('');
  return Array.from({ length: rows }, () => `<tr>${cells}</tr>`).join('');
}

function showToast(message, type = 'info') {
  let stack = document.getElementById('toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toast-stack';
    document.body.appendChild(stack);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 200);
  }, 3800);
}

function makeWaveform(bars = 24, animate = false) {
  let html = '';
  for (let i = 0; i < bars; i++) {
    const h = 20 + Math.round(Math.random() * 80);
    html += `<span style="height:${h}%"></span>`;
  }
  return `<div class="waveform${animate ? ' animate' : ''}">${html}</div>`;
}

function makeDividerWave(bars = 60) {
  let html = '';
  for (let i = 0; i < bars; i++) {
    const h = 10 + Math.round(Math.sin(i / 4) * 20 + 25 + Math.random() * 15);
    html += `<span style="height:${h}%"></span>`;
  }
  return `<div class="divider-wave">${html}</div>`;
}

const NAV_APP = [
  { groupKey: 'app.nav.group.workspace', group: 'Workspace', items: [
    { href: '/app/workspace.html', icon: 'layout-grid', key: 'app.nav.workspace', label: 'Workspace' },
    { href: '/app/dashboard.html', icon: 'home', key: 'app.nav.home', label: 'Dashboard' },
    { href: '/app/industry-library.html', icon: 'library-big', key: 'app.nav.industry_library', label: 'Industry Library' },
    { href: '/app/projects.html', icon: 'folder-kanban', key: 'app.nav.projects', label: 'Projects' },
    { href: '/app/decisions.html', icon: 'check-square', key: 'app.nav.decisions', label: 'Decisions' },
    { href: '/app/executive-intelligence.html', icon: 'compass', key: 'app.nav.executive_intelligence', label: 'Executive Intelligence' },
  ]},
  { groupKey: 'app.nav.group.collection', group: 'Collection', items: [
    { href: '/app/surveys.html', icon: 'list-checks', key: 'app.nav.surveys', label: 'Surveys' },
    { href: '/app/campaigns.html', icon: 'megaphone', key: 'app.nav.campaigns', label: 'Campaigns' },
    { href: '/app/respondents.html', icon: 'users', key: 'app.nav.respondents', label: 'Respondents' },
    { href: '/app/interviews.html', icon: 'headphones', key: 'app.nav.interviews', label: 'Interviews' },
  ]},
  { groupKey: 'app.nav.group.intelligence', group: 'Data & Intelligence', items: [
    { href: '/app/analytics.html', icon: 'bar-chart-3', key: 'app.nav.analytics', label: 'Analytics' },
    { href: '/app/platform-intelligence.html', icon: 'sparkles', key: 'app.nav.platform_intelligence', label: 'Data Intelligence' },
    { href: '/app/reports.html', icon: 'file-pen-line', key: 'app.nav.reports', label: 'Reports' },
    { href: '/app/report-library.html', icon: 'book-copy', key: 'app.nav.publications', label: 'Publications' },
    { href: '/app/knowledge-cloud.html', icon: 'library', key: 'app.nav.knowledge', label: 'Knowledge' },
  ]},
  { groupKey: 'app.nav.group.governance', group: 'Governance', items: [
    { href: '/admin/enumerators.html', icon: 'user-check', key: 'app.nav.enumerators', label: 'Enumerators' },
    { href: '/admin/quality-control.html', icon: 'shield-check', key: 'app.nav.quality_control', label: 'Data Quality' },
    { href: '/app/compliance.html', icon: 'shield-check', key: 'app.nav.compliance', label: 'Compliance' },
    { href: '/app/billing.html', icon: 'credit-card', key: 'app.nav.billing', label: 'Billing' },
    { href: '/app/settings.html', icon: 'settings', key: 'app.nav.administration', label: 'Administration' },
  ]},
];

const NAV_ADMIN = [
  { groupKey: 'app.nav.group.platform', group: 'Platform', items: [
    { href: '/admin/organizations.html', icon: 'globe', key: 'app.nav.organizations', label: 'Organizations', superAdminOnly: true },
  ]},
  { groupKey: 'app.nav.group.operations', group: 'Operations', items: [
    { href: '/admin/dashboard.html', icon: 'layout-dashboard', key: 'app.nav.overview', label: 'Overview' },
    { href: '/admin/leads.html', icon: 'inbox', key: 'app.nav.leads', label: 'Business Inquiries', superAdminOnly: true },
    { href: '/admin/call-monitoring.html', icon: 'phone-call', key: 'app.nav.call_monitoring', label: 'Call Monitoring' },
  ]},
  { groupKey: 'app.nav.group.quality', group: 'Quality & Safety', items: [
    { href: '/admin/fraud-alerts.html', icon: 'shield-alert', key: 'app.nav.fraud_alerts', label: 'Fraud Alerts' },
    { href: '/admin/system-health.html', icon: 'heart-pulse', key: 'app.nav.system_health', label: 'System Health', superAdminOnly: true },
    { href: '/admin/audit-center.html', icon: 'scroll-text', key: 'app.nav.audit_center', label: 'Audit Center', superAdminOnly: true },
    { href: '/admin/diagnostics.html', icon: 'stethoscope', key: 'app.nav.diagnostics', label: 'Diagnostics Center', superAdminOnly: true },
    { href: '/admin/production-readiness.html', icon: 'clipboard-check', key: 'app.nav.production_readiness', label: 'Production Readiness', superAdminOnly: true },
    { href: '/admin/ai-center.html', icon: 'cpu', key: 'app.nav.ai_center', label: 'AI Center', superAdminOnly: true },
    { href: '/admin/vault-health.html', icon: 'shield', key: 'app.nav.vault_health', label: 'Vault Health', superAdminOnly: true },
    { href: '/admin/ai-retry-health.html', icon: 'activity', key: 'app.nav.ai_retry_health', label: 'AI Retry Health', superAdminOnly: true },
    { href: '/admin/model-performance.html', icon: 'cpu', key: 'app.nav.model_performance', label: 'AI Model Performance' },
    { href: '/admin/audit-logs.html', icon: 'scroll-text', key: 'app.nav.audit_logs', label: 'Audit Logs' },
  ]},
];

function iconSvg(name) {
  return `<i data-lucide="${name}"></i>`;
}

const APP_LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'pt', label: 'PT' },
  { code: 'sw', label: 'SW' },
];

function renderShell({ role = 'client', active = '', title = '', eyebrow = '', breadcrumb = null }) {
  const storedUser = JSON.parse(localStorage.getItem('vi_user') || 'null');
  document.title = `${title || 'Home'} — VoiceInsights Workspace`;
  const userRole = storedUser?.role || 'org_admin';

  // Full-access roles see everything; a plain M&E Officer or Enumerator gets a
  // reduced, focused nav (no Billing, no Compliance edit, no Leads) — reflecting
  // real permission differences. Enumerators additionally don't manage surveys.
  const RESTRICTED_FOR_ME_OFFICER = ['/app/billing.html', '/app/settings.html', '/admin/leads.html'];
  const RESTRICTED_FOR_ENUMERATOR = [...RESTRICTED_FOR_ME_OFFICER, '/app/surveys.html', '/app/campaigns.html', '/app/compliance.html'];

  let nav = role === 'admin' ? NAV_ADMIN : NAV_APP;
  if (role === 'admin' && userRole !== 'super_admin') {
    nav = nav.map(g => ({ ...g, items: g.items.filter(it => !it.superAdminOnly) })).filter(g => g.items.length);
  }
  if (role === 'client' && userRole === 'me_officer') {
    nav = nav.map(g => ({ ...g, items: g.items.filter(it => !RESTRICTED_FOR_ME_OFFICER.includes(it.href)) })).filter(g => g.items.length);
  } else if (role === 'client' && userRole === 'enumerator') {
    // Blueprint calls for a deliberately minimal interface for Enumerators —
    // just their work, not the full client dashboard.
    nav = [{ group: 'Today', groupKey: 'app.nav.group_today', items: [
      { href: '/app/my-work.html', icon: 'clipboard-check', key: 'app.nav.my_work', label: 'My Work' },
    ] }];
  }

  const brandName = 'VoiceInsights';
  const brandSub = role === 'admin' ? t('app.nav.platform_operations', 'Platform Operations') : t('app.nav.workspace', 'Workspace');
  const currentLang = getAppLang();

  // While a Super Admin is viewing a specific client organization's data
  // (?org_id=... in the URL), every nav link must carry that same org_id
  // forward — otherwise clicking from Dashboard to Respondents would
  // silently drop back to the Super Admin's own organization.
  const viewingOrgId = new URLSearchParams(window.location.search).get('org_id');
  function withOrgId(href) {
    return viewingOrgId ? `${href}?org_id=${viewingOrgId}` : href;
  }

  const navHtml = nav.map(g => `
    <div class="nav-group">
      <div class="nav-label">${t(g.groupKey, g.group)}</div>
      ${g.items.map(it => `
        <a class="nav-item ${active === it.href ? 'active' : ''}" href="${withOrgId(it.href)}">
          ${iconSvg(it.icon)} <span>${t(it.key, it.label)}</span>
        </a>`).join('')}
    </div>`).join('');

  const ROLE_DISPLAY = { me_officer: 'M&E Officer', enumerator: 'Enumerator', super_admin: 'Super Admin', org_admin: 'Org Admin', founder_executive: 'Founder Executive', head_of_programs: 'Head of Programs', project_manager: 'Project Manager', operations_manager: 'Operations Manager', data_analyst: 'Data Analyst' };
  const displayName = storedUser?.full_name || VI.user.name;
  const displayInitials = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const displayRole = ROLE_DISPLAY[storedUser?.role] || (role === 'admin' ? 'Super Admin' : 'Org Admin');

  const sidebarMount = document.getElementById('sidebar-mount');
  if (sidebarMount) {
    sidebarMount.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <img src="/assets/img/logo-icon.png" alt="VoiceInsights Africa" style="height:32px; width:auto;">
          <div class="name">${brandName}<em>${brandSub}</em></div>
        </div>
        <div style="flex:1; display:flex; flex-direction:column; gap:1.5rem;">${navHtml}</div>
        <div class="sidebar-foot">
          <div class="sidebar-user-card">
            <div class="avatar">${displayInitials}</div>
            <div class="info">
              <div class="name">${displayName}</div>
              <div class="role">${displayRole}</div>
            </div>
          </div>
          <a class="nav-item" href="/index.html">${iconSvg('log-out')} <span>${t('app.nav.logout', 'Log Out')}</span></a>
        </div>
      </aside>`;
  }

  const topbarMount = document.getElementById('topbar-mount');
  if (topbarMount) {
    topbarMount.innerHTML = `
      <header class="topbar">
        <div class="topbar-primary" style="display:flex; align-items:center; gap:.9rem;">
          <button class="btn btn-ghost btn-sm" id="menu-toggle" aria-label="Open menu" style="display:none;">${iconSvg('menu')}</button>
          <div>
            ${breadcrumb && breadcrumb.length ? `<nav aria-label="Breadcrumb" style="font-size:.76rem; color:var(--text-dim); margin-bottom:.2rem;">${breadcrumb.map((crumb, i) => i < breadcrumb.length - 1 ? `<a href="${crumb.href}" style="color:var(--text-dim);">${crumb.label}</a> › ` : `<span style="color:var(--text-muted);">${crumb.label}</span>`).join('')}</nav>` : (eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : '')}
            <h1>${title}</h1>
          </div>
        </div>
        <div class="topbar-actions" style="display:flex; align-items:center; gap:.9rem;">
          <a class="btn btn-ghost btn-sm topbar-help" href="/faq.html" title="Help" aria-label="Help" style="padding:.5em .7em;">${iconSvg('help-circle')}</a>
          <span class="workspace-context" title="Current organization">${storedUser?.organization_name || storedUser?.organization || VI.user.org}</span>
          <div style="position:relative;">
            <button class="btn btn-ghost btn-sm" id="notif-bell-btn" title="Notifications" aria-label="Notifications" style="padding:.5em .7em; position:relative;">🔔<span id="notif-badge" style="display:none; position:absolute; top:2px; right:2px; width:8px; height:8px; border-radius:50%; background:var(--danger);"></span></button>
            <div id="notif-dropdown" style="display:none; position:absolute; top:110%; right:0; width:320px; max-height:400px; overflow-y:auto; background:var(--surface); border:1px solid var(--border); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.3); z-index:400; padding:.5rem;"></div>
          </div>
          <button class="btn btn-ghost btn-sm" id="cmdk-hint-btn" title="Quick jump" aria-label="Open quick navigation search" style="padding:.5em .8em; font-size:.72rem; color:var(--text-dim);">⌘K</button>
          <button class="btn btn-ghost btn-sm theme-toggle-btn" id="theme-toggle-btn" title="Current colour theme" aria-label="Current colour theme" style="padding:.5em .7em;"><span class="theme-toggle-icon">${getTheme() === 'light' ? '\u2600\uFE0F' : '\uD83C\uDF19'}</span></button>
          <div class="lang-toggle" id="app-lang-toggle">
            ${APP_LANGS.map(l => `<button class="${currentLang === l.code ? 'active' : ''}" data-lang="${l.code}">${l.label}</button>`).join('')}
          </div>
          <div class="user-chip">
            <div class="avatar">${displayInitials}</div>
            <span style="font-size:.85rem; font-weight:600;">${displayName}</span>
            <span class="badge badge-neutral" style="font-size:.62rem;">${ROLE_DISPLAY[userRole] || (role === 'admin' ? 'Super Admin' : 'Org Admin')}</span>
          </div>
        </div>
      </header>`;
    document.querySelectorAll('[data-shell-heading-fallback]').forEach((heading) => heading.remove());
  }

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn && !themeToggleBtn.dataset.bound) { themeToggleBtn.dataset.bound = '1'; themeToggleBtn.addEventListener('click', toggleTheme); }
  const cmdkHintBtn = document.getElementById('cmdk-hint-btn');
  if (cmdkHintBtn && !cmdkHintBtn.dataset.bound) { cmdkHintBtn.dataset.bound = '1'; cmdkHintBtn.addEventListener('click', () => { if (window.__openCmdK) window.__openCmdK(); }); }

  const notifBellBtn = document.getElementById('notif-bell-btn');
  if (notifBellBtn && !notifBellBtn.dataset.bound) {
    notifBellBtn.dataset.bound = '1';
    const dropdown = document.getElementById('notif-dropdown');
    let lastNotifications = [];

    function renderDropdown() {
      dropdown.innerHTML = lastNotifications.length
        ? `<div style="display:flex; justify-content:flex-end; padding:.3rem .5rem;"><button id="notif-mark-all-btn" style="background:none; border:none; color:var(--accent-2); font-size:.72rem; cursor:pointer;">Mark all read</button></div>` +
          lastNotifications.map(n => `<a href="${n.link}" data-key="${n.key}" class="notif-item" style="display:block; padding:.6rem .5rem; border-bottom:1px solid var(--border); text-decoration:none; color:inherit; font-size:.82rem; ${n.is_read ? 'opacity:.55;' : ''}">${n.is_read ? '' : '<span style="color:var(--accent-2);">●</span> '}${n.icon} ${n.message}<div class="muted-note" style="font-size:.68rem; margin-top:.2rem;">${new Date(n.created_at).toLocaleString()}</div></a>`).join('')
        : '<p class="muted-note" style="padding:1rem; font-size:.82rem;">No notifications right now.</p>';

      document.querySelectorAll('.notif-item').forEach(el => {
        el.addEventListener('click', () => { apiRequest(`/api/notifications/${encodeURIComponent(el.dataset.key)}/read`, { method: 'POST' }).catch(() => {}); });
      });
      const markAllBtn = document.getElementById('notif-mark-all-btn');
      if (markAllBtn) {
        markAllBtn.addEventListener('click', async (e) => {
          e.preventDefault(); e.stopPropagation();
          try {
            await apiRequest('/api/notifications/mark-all-read', { method: 'POST', body: { keys: lastNotifications.map(n => n.key) } });
            lastNotifications.forEach(n => n.is_read = true);
            renderDropdown();
            document.getElementById('notif-badge').style.display = 'none';
          } catch (err) { /* silent — not critical */ }
        });
      }
    }

    notifBellBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display === 'block';
      dropdown.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        dropdown.innerHTML = '<p class="muted-note" style="padding:1rem; font-size:.82rem;">Loading…</p>';
        try {
          const qs = new URLSearchParams(window.location.search).get('org_id');
          const { notifications } = await apiRequest(`/api/notifications${qs ? '?org_id=' + qs : ''}`);
          lastNotifications = notifications;
          renderDropdown();
        } catch (err) {
          dropdown.innerHTML = `<p class="muted-note" style="padding:1rem; font-size:.82rem; color:var(--danger);">Could not load notifications.</p>`;
        }
      }
    });
    document.addEventListener('click', () => { dropdown.style.display = 'none'; });
    (async () => {
      try {
        const qs = new URLSearchParams(window.location.search).get('org_id');
        const { unread_count } = await apiRequest(`/api/notifications${qs ? '?org_id=' + qs : ''}`);
        if (unread_count > 0) document.getElementById('notif-badge').style.display = 'block';
      } catch (e) { /* silent — badge just stays hidden */ }
    })();
  }

  if (window.lucide) lucide.createIcons();

  document.querySelectorAll('#app-lang-toggle button').forEach(b => {
    b.addEventListener('click', () => setAppLang(b.dataset.lang));
  });

  const toggle = document.getElementById('menu-toggle');
  if (toggle) {
    toggle.style.display = 'inline-flex';
    toggle.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  }

  renderViaAssistant();
  renderCommandPalette(nav);
}

const ALL_NAV_ITEMS = [
  { href: '/app/dashboard.html', label: 'Dashboard', icon: 'layout-dashboard' },
  { href: '/app/executive-intelligence.html', label: 'Executive Intelligence', icon: 'compass' },
  { href: '/app/platform-intelligence.html', label: 'Platform Intelligence', icon: 'sparkles' },
  { href: '/app/decisions.html', label: 'Decision Workspace', icon: 'check-square' },
  { href: '/app/projects.html', label: 'Projects', icon: 'folder-kanban' },
  { href: '/app/surveys.html', label: 'Surveys', icon: 'list-checks' },
  { href: '/app/campaigns.html', label: 'Campaigns', icon: 'megaphone' },
  { href: '/app/respondents.html', label: 'Respondents', icon: 'users' },
  { href: '/app/interviews.html', label: 'Interviews', icon: 'headphones' },
  { href: '/app/analytics.html', label: 'Analytics', icon: 'bar-chart-3' },
  { href: '/app/data-trust-intelligence-fabric.html', label: 'Data Trust Fabric', icon: 'network' },
  { href: '/app/reports.html', label: 'Reports', icon: 'file-text' },
  { href: '/app/compliance.html', label: 'Compliance', icon: 'shield-check' },
  { href: '/app/billing.html', label: 'Billing', icon: 'credit-card' },
  { href: '/app/settings.html', label: 'Settings', icon: 'settings' },
  { href: '/app/report.html', label: 'Generate: Executive Report', icon: 'file-text' },
  { href: '/app/report-donor.html', label: 'Generate: Donor Impact Report', icon: 'file-text' },
  { href: '/app/survey-builder.html', label: 'New Survey', icon: 'plus-circle' },
];

function renderCommandPalette() {
  if (document.getElementById('cmdk-backdrop')) return; // already mounted
  const backdrop = document.createElement('div');
  backdrop.id = 'cmdk-backdrop';
  backdrop.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:400; align-items:flex-start; justify-content:center; padding-top:12vh;';
  backdrop.innerHTML = `
    <div style="width:100%; max-width:520px; background:var(--surface); border:1px solid var(--border-strong); border-radius:12px; box-shadow:0 30px 80px rgba(0,0,0,.5); overflow:hidden;">
      <input id="cmdk-input" placeholder="Jump to… (Dashboard, Reports, Surveys)" style="width:100%; border:none; background:none; padding:1rem 1.2rem; font-size:1rem; color:var(--text); outline:none; border-bottom:1px solid var(--border);">
      <div id="cmdk-results" style="max-height:50vh; overflow-y:auto; padding:.5rem;"></div>
    </div>`;
  document.body.appendChild(backdrop);

  const input = backdrop.querySelector('#cmdk-input');
  const resultsEl = backdrop.querySelector('#cmdk-results');
  let activeIndex = 0;

  function renderResults(query) {
    const q = query.trim().toLowerCase();
    const matches = ALL_NAV_ITEMS.filter(it => it.label.toLowerCase().includes(q));
    activeIndex = 0;
    resultsEl.innerHTML = matches.length
      ? matches.map((it, i) => `
        <a href="${it.href}" class="cmdk-item ${i === 0 ? 'active' : ''}" data-index="${i}" style="display:flex; align-items:center; gap:.7rem; padding:.7rem .9rem; border-radius:8px; text-decoration:none; color:var(--text); font-size:.9rem;">
          ${iconSvg(it.icon)} <span>${it.label}</span>
        </a>`).join('')
      : '<div class="muted-note" style="padding:.9rem;">No matches.</div>';
    if (window.lucide) lucide.createIcons();
    highlightActive();
  }

  function highlightActive() {
    resultsEl.querySelectorAll('.cmdk-item').forEach((el, i) => {
      el.style.background = i === activeIndex ? 'var(--surface-2)' : 'none';
    });
  }

  function open() {
    backdrop.style.display = 'flex';
    input.value = '';
    renderResults('');
    setTimeout(() => input.focus(), 30);
  }
  function close() { backdrop.style.display = 'none'; }
  window.__openCmdK = open;

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); open(); }
    if (e.key === 'Escape') close();
  });
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  input.addEventListener('input', () => renderResults(input.value));
  input.addEventListener('keydown', (e) => {
    const items = resultsEl.querySelectorAll('.cmdk-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); highlightActive(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); highlightActive(); }
    if (e.key === 'Enter' && items[activeIndex]) { window.location.href = items[activeIndex].getAttribute('href'); }
  });
}

function renderViaAssistant() {
  if (document.getElementById('via-launcher')) return; // already mounted
  const launcher = document.createElement('button');
  launcher.id = 'via-launcher';
  launcher.setAttribute('aria-label', t('via.launcher', 'Open VIA Assistant'));
  launcher.innerHTML = iconSvg('sparkles');
  launcher.style.cssText = 'position:fixed; bottom:1.75rem; right:1.75rem; width:52px; height:52px; border-radius:50%; background:var(--accent); color:var(--accent-ink); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 10px 30px rgba(0,0,0,.4); z-index:50;';
  document.body.appendChild(launcher);

  const panel = document.createElement('div');
  panel.id = 'via-panel';
  panel.style.cssText = 'position:fixed; bottom:5.5rem; right:1.75rem; width:360px; max-width:88vw; max-height:65vh; background:var(--surface); border:1px solid var(--border-strong); border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.5); display:none; flex-direction:column; z-index:50; overflow:hidden;';
  panel.innerHTML = `
    <div style="padding:.9rem 1rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
      <div><strong style="font-family:var(--font-display);">VIA Assistant</strong><div class="muted-note" style="font-size:.7rem;">${t('via.subtitle', 'Ask about your data')}</div></div>
      <button id="via-close" aria-label="Close" style="background:none; border:none; color:var(--text-dim); cursor:pointer; font-size:1.1rem;">×</button>
    </div>
    <div id="via-messages" style="flex:1; overflow-y:auto; padding:1rem; display:flex; flex-direction:column; gap:.7rem; min-height:200px;">
      <div class="muted-note">${t('via.hint', "Try: \"What's the overall sentiment so far?\" or \"Summarize recent responses.\"")}</div>
    </div>
    <div style="padding:.75rem; border-top:1px solid var(--border); display:flex; gap:.5rem;">
      <input id="via-input" placeholder="${t('via.placeholder', 'Ask a question…')}" style="flex:1;">
      <button id="via-send" class="btn btn-primary btn-sm">${t('via.ask', 'Ask')}</button>
    </div>`;
  document.body.appendChild(panel);

  launcher.addEventListener('click', () => { panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'; });
  document.getElementById('via-close').addEventListener('click', () => { panel.style.display = 'none'; });

  const messagesEl = document.getElementById('via-messages');
  const inputEl = document.getElementById('via-input');
  const sendBtn = document.getElementById('via-send');

  function addMessage(text, who) {
    const bubble = document.createElement('div');
    bubble.style.cssText = who === 'user'
      ? 'align-self:flex-end; background:var(--accent); color:var(--accent-ink); padding:.6rem .8rem; border-radius:10px 10px 2px 10px; max-width:85%; font-size:.85rem;'
      : 'align-self:flex-start; background:var(--surface-2); padding:.6rem .8rem; border-radius:10px 10px 10px 2px; max-width:85%; font-size:.85rem; color:var(--text);';
    bubble.textContent = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function ask() {
    const q = inputEl.value.trim();
    if (!q) return;
    addMessage(q, 'user');
    inputEl.value = '';
    sendBtn.disabled = true;
    const thinking = document.createElement('div');
    thinking.className = 'muted-note';
    thinking.textContent = t('via.thinking', 'VIA is thinking…');
    messagesEl.appendChild(thinking);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    try {
      const { answer } = await apiRequest('/api/assistant/ask', { method: 'POST', body: { question: q } });
      thinking.remove();
      addMessage(answer, 'assistant');
    } catch (e) {
      thinking.remove();
      addMessage(t('via.error', 'Sorry, I could not process that:') + ' ' + e.message, 'assistant');
    } finally {
      sendBtn.disabled = false;
    }
  }
  sendBtn.addEventListener('click', ask);
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(); });
}

function normalizeNavPath(p) {
  // Strips .html generally (Cloudflare Pages often serves clean URLs without
  // the extension), then collapses a trailing "/index" and trailing slash —
  // makes the comparison work whether the live URL has .html or not.
  return p.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/\/$/, '') || '/';
}
function highlightActiveTopNav() {
  const currentPath = normalizeNavPath(window.location.pathname);
  const currentHash = window.location.hash;
  document.querySelectorAll('.pub-nav-links a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const hasHash = href.includes('#');
    const hrefPathRaw = hasHash ? href.split('#')[0] : href;
    const hrefHash = hasHash ? '#' + href.split('#')[1] : '';
    const hrefPath = normalizeNavPath(hrefPathRaw);
    // Anchor links (e.g. Pricing → /index.html#pricing) only light up when the
    // hash itself matches — otherwise they'd falsely activate on every homepage visit.
    const isMatch = hasHash ? (hrefPath === currentPath && hrefHash === currentHash) : (hrefPath === currentPath);
    if (isMatch) a.classList.add('active-nav-link');
  });
}
const CANONICAL_PUBLIC_NAVIGATION = [
  ['/solutions.html', 'solutions'],
  ['/industries.html', 'industries'],
  ['/platform.html', 'platform'],
  ['/sample-reports.html', 'reportLibrary'],
  ['/procurement.html', 'pricing'],
  ['/about.html', 'about'],
  ['/contact.html', 'contact'],
];

const PUBLIC_SHELL_LANGUAGES = [
  { code: 'en', nativeName: 'English' },
  { code: 'sw', nativeName: 'Kiswahili' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'pt', nativeName: 'Português' },
  { code: 'ar', nativeName: 'العربية' },
  { code: 'es', nativeName: 'Español' },
  { code: 'de', nativeName: 'Deutsch' },
];

const PUBLIC_SHELL_COPY = {
  en: { solutions: 'Solutions', industries: 'Industries', platform: 'Platform', reportLibrary: 'Knowledge Hub', pricing: 'Pricing', about: 'About', contact: 'Contact', login: 'Login', demo: 'Request Demo', language: 'Language', theme: 'Theme', openNav: 'Open navigation', closeNav: 'Close navigation' },
  sw: { solutions: 'Suluhisho', industries: 'Sekta', platform: 'Jukwaa', reportLibrary: 'Kitovu cha Maarifa', pricing: 'Bei', about: 'Kuhusu', contact: 'Mawasiliano', login: 'Ingia', demo: 'Omba Onyesho', language: 'Lugha', theme: 'Mandhari', openNav: 'Fungua urambazaji', closeNav: 'Funga urambazaji' },
  fr: { solutions: 'Solutions', industries: 'Secteurs', platform: 'Plateforme', reportLibrary: 'Centre de connaissances', pricing: 'Tarifs', about: 'À propos', contact: 'Contact', login: 'Connexion', demo: 'Demander une démonstration', language: 'Langue', theme: 'Thème', openNav: 'Ouvrir la navigation', closeNav: 'Fermer la navigation' },
  pt: { solutions: 'Soluções', industries: 'Setores', platform: 'Plataforma', reportLibrary: 'Centro de Conhecimento', pricing: 'Preços', about: 'Sobre', contact: 'Contacto', login: 'Entrar', demo: 'Solicitar demonstração', language: 'Idioma', theme: 'Tema', openNav: 'Abrir navegação', closeNav: 'Fechar navegação' },
  ar: { solutions: 'الحلول', industries: 'القطاعات', platform: 'المنصة', reportLibrary: 'مركز المعرفة', pricing: 'الأسعار', about: 'من نحن', contact: 'اتصل بنا', login: 'تسجيل الدخول', demo: 'اطلب عرضاً', language: 'اللغة', theme: 'المظهر', openNav: 'فتح التنقل', closeNav: 'إغلاق التنقل' },
  es: { solutions: 'Soluciones', industries: 'Sectores', platform: 'Plataforma', reportLibrary: 'Centro de conocimiento', pricing: 'Precios', about: 'Acerca de', contact: 'Contacto', login: 'Iniciar sesión', demo: 'Solicitar demostración', language: 'Idioma', theme: 'Tema', openNav: 'Abrir navegación', closeNav: 'Cerrar navegación' },
  de: { solutions: 'Lösungen', industries: 'Branchen', platform: 'Plattform', reportLibrary: 'Wissenszentrum', pricing: 'Preise', about: 'Über uns', contact: 'Kontakt', login: 'Anmelden', demo: 'Demo anfordern', language: 'Sprache', theme: 'Darstellung', openNav: 'Navigation öffnen', closeNav: 'Navigation schließen' },
};

function getPublicLanguage() {
  const saved = localStorage.getItem('vi_app_lang');
  return PUBLIC_SHELL_LANGUAGES.some((language) => language.code === saved) ? saved : 'en';
}

function publicLanguageMarkup(language) {
  const copy = PUBLIC_SHELL_COPY[language] || PUBLIC_SHELL_COPY.en;
  return `<div class="public-language-control">
    <button type="button" class="public-language-trigger" id="public-language-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="public-language-menu" aria-label="${copy.language}: ${PUBLIC_SHELL_LANGUAGES.find(item => item.code === language).nativeName}">
      <span aria-hidden="true">${language.toUpperCase()}</span><span class="public-language-chevron" aria-hidden="true">⌄</span>
    </button>
    <div class="public-language-menu" id="public-language-menu" role="listbox" aria-label="${copy.language}" tabindex="-1" hidden>
      <strong class="public-language-heading">${copy.language}</strong>
      ${PUBLIC_SHELL_LANGUAGES.map((item) => `<button type="button" role="option" data-language="${item.code}" aria-selected="${item.code === language}" tabindex="${item.code === language ? '0' : '-1'}"><span class="public-language-check" aria-hidden="true">${item.code === language ? '✓' : ''}</span><span lang="${item.code}" dir="${item.code === 'ar' ? 'rtl' : 'ltr'}">${item.nativeName}</span></button>`).join('')}
    </div>
  </div>`;
}

function applyPublicShellLanguage(language) {
  const lang = PUBLIC_SHELL_LANGUAGES.some(item => item.code === language) ? language : 'en';
  localStorage.setItem('vi_app_lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  if (typeof applySiteLanguage === 'function') applySiteLanguage(lang);
  normalizePublicNavigation();
  highlightActiveTopNav();
}

function bindPublicLanguageControl() {
  const control = document.querySelector('.public-language-control');
  const trigger = control?.querySelector('.public-language-trigger');
  const menu = control?.querySelector('.public-language-menu');
  if (!control || !trigger || !menu || control.dataset.bound) return;
  control.dataset.bound = '1';
  const options = [...menu.querySelectorAll('[role="option"]')];
  const setOpen = (open, returnFocus = false) => {
    trigger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    control.classList.toggle('open', open);
    if (open) (options.find(option => option.getAttribute('aria-selected') === 'true') || options[0])?.focus();
    else if (returnFocus) trigger.focus();
  };
  trigger.addEventListener('click', () => setOpen(menu.hidden));
  options.forEach(option => option.addEventListener('click', () => applyPublicShellLanguage(option.dataset.language)));
  menu.addEventListener('keydown', (event) => {
    const current = options.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false, true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next].focus();
  });
  document.addEventListener('click', event => { if (!control.contains(event.target)) setOpen(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) setOpen(false, true); });
}

function normalizePublicNavigation() {
  const language = getPublicLanguage();
  const copy = PUBLIC_SHELL_COPY[language] || PUBLIC_SHELL_COPY.en;
  document.querySelectorAll('.pub-nav').forEach((nav) => {
    const logo = nav.querySelector('.pub-nav-logo')?.outerHTML || '<a href="/index.html" class="pub-nav-logo">VoiceInsights Africa</a>';
    nav.innerHTML = `<div class="pub-nav-row1">
      ${logo}
      <div class="pub-nav-collapse pub-nav-row1-right">
        <a href="/login.html" class="btn btn-ghost btn-sm pub-nav-login">${copy.login}</a>
        ${publicLanguageMarkup(language)}
        <button type="button" class="btn btn-ghost btn-sm theme-toggle-btn public-theme-toggle" id="theme-toggle-btn" aria-label="${copy.theme}"><span class="theme-toggle-icon" aria-hidden="true">${getTheme() === 'light' ? '\u2600\uFE0F' : '\uD83C\uDF19'}</span></button>
        <a href="/contact.html?request=demo" class="btn btn-primary btn-sm pub-nav-demo">${copy.demo}</a>
      </div>
      <button type="button" class="mobile-nav-toggle" id="mobile-nav-toggle" aria-label="${copy.openNav}" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
    <div class="pub-nav-collapse pub-nav-links">${CANONICAL_PUBLIC_NAVIGATION.map(([href, key]) => `<a href="${href}">${copy[key]}</a>`).join('')}</div>`;
    const previous = nav.previousElementSibling;
    if (previous?.textContent?.includes('Trusted Voice Research Infrastructure')) previous.classList.add('public-trust-strip');
    else {
      const strip = document.createElement('div');
      strip.className = 'public-trust-strip';
      strip.textContent = 'Trusted Voice Research Infrastructure for NGOs, Governments & Global Development Partners';
      nav.before(strip);
    }
  });
  applyTheme(getTheme());
  bindPublicLanguageControl();
  bindPublicNavigationInteractions();
  syncPublicBrandAnchor();
}

function syncPublicBrandAnchor() {
  document.querySelectorAll('.pub-nav').forEach((nav) => {
    const logo = nav.querySelector('.pub-nav-logo');
    if (!logo) return;
    const update = () => nav.style.setProperty('--public-brand-end', `${Math.ceil(logo.getBoundingClientRect().width)}px`);
    update();
    if (!nav._brandResizeObserver && typeof ResizeObserver !== 'undefined') {
      nav._brandResizeObserver = new ResizeObserver(update);
      nav._brandResizeObserver.observe(logo);
    }
    if (document.fonts?.ready) document.fonts.ready.then(update);
  });
}

function canonicalPublicFooterMarkup() {
  return `<footer class="pub-footer enterprise-footer" aria-labelledby="footer-brand-title">
    <div class="footer-primary">
      <section class="footer-brand">
        <div class="footer-brand-heading"><img src="/assets/img/logo-icon.png" alt=""><h2 id="footer-brand-title">VOICEINSIGHTS AFRICA</h2></div>
        <p>VoiceInsights Africa is an enterprise data intelligence and publication platform helping organizations collect, understand and transform multilingual data into dashboards, reports, datasets, publications and decision-ready evidence.</p>
        <p class="footer-company">VoiceInsights Africa Ltd — Registered in Tanzania.</p>
        <div class="footer-emails"><a href="mailto:partnerships@voiceinsightsafrica.com">partnerships@voiceinsightsafrica.com</a><a href="mailto:hello@voiceinsightsafrica.com">hello@voiceinsightsafrica.com</a></div>
        <a class="btn btn-primary" href="/contact.html?request=demo">Request Demo</a>
      </section>
      <nav class="footer-links" aria-label="Footer navigation">
        <section><h2>Company</h2><a href="/about.html">About</a><a href="/contact.html">Contact</a><a href="/careers.html">Careers</a><a href="/safeguarding.html">Safeguarding</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></section>
        <section><h2>Enterprise</h2><a href="/trust-center.html">Trust Center</a><a href="/security.html">Security</a><a href="/compliance-center.html">Compliance</a><a href="/responsible-ai.html">Responsible AI</a><a href="/data-protection.html">Data Protection</a><a href="/service-levels.html">Business Continuity</a><a href="/status.html">Status</a></section>
        <section><h2>Developers &amp; Support</h2><a href="/developers/index.html">API Documentation</a><a href="/integrations.html">Integrations</a><a href="/enterprise-architecture.html">Architecture</a><a href="/enterprise-support.html">Support</a><a href="/procurement.html">Procurement</a></section>
        <section><h2>Knowledge</h2><a href="/sample-reports.html">Knowledge Hub</a><a href="/sample-reports.html">Collections</a><a href="/sample-reports.html">Publications</a><a href="/sample-reports.html">Methodologies</a><a href="/case-studies.html">Case Studies</a><a href="/customer-success.html">Release Notes</a></section>
      </nav>
    </div>
    <div class="footer-legal"><span>© 2026 VoiceInsights Africa. All rights reserved.</span><span>VoiceInsights Africa™ and VIA Intelligence Engine™ are proprietary trademarks of VoiceInsights Africa Ltd.</span></div>
  </footer>`;
}

function normalizePublicFooter() {
  const publicNav = document.querySelector('.pub-nav');
  if (!publicNav) return;
  document.body.classList.add('public-page-shell');
  const existingFooters = [...document.querySelectorAll('footer.pub-footer')];
  const template = document.createElement('template');
  template.innerHTML = canonicalPublicFooterMarkup().trim();
  const canonicalFooter = template.content.firstElementChild;
  if (existingFooters.length) {
    existingFooters[0].replaceWith(canonicalFooter);
    existingFooters.slice(1).forEach(footer => footer.remove());
  } else document.body.appendChild(canonicalFooter);
}
document.addEventListener('DOMContentLoaded', () => {
  if (typeof applySiteLanguage === 'function') applySiteLanguage(getPublicLanguage());
  normalizePublicNavigation();
  normalizePublicFooter();
  highlightActiveTopNav();
});

document.addEventListener('DOMContentLoaded', () => {
  // Accessibility: inject a "Skip to main content" link as the very first
  // focusable element, for keyboard and screen-reader users — works on any
  // page without needing every page edited individually.
  const nav = document.querySelector('.pub-nav');
  const mainEl = document.querySelector('main') || document.querySelector('.pub-hero') || document.querySelector('.content');
  if (mainEl && !document.getElementById('skip-to-content')) {
    if (!mainEl.id) mainEl.id = 'main-content-auto';
    const skip = document.createElement('a');
    skip.href = '#' + mainEl.id;
    skip.id = 'skip-to-content';
    skip.className = 'skip-link';
    skip.textContent = 'Skip to main content';
    document.body.insertBefore(skip, document.body.firstChild);
  }
});

function bindPublicNavigationInteractions() {
  const toggle = document.getElementById('mobile-nav-toggle');
  const panels = document.querySelectorAll('.pub-nav-collapse');
  if (toggle && panels.length && !toggle.dataset.bound) {
    toggle.dataset.bound = '1';
    const setMobileMenuState = (open) => {
      toggle.classList.toggle('open', open);
      panels.forEach(panel => panel.classList.toggle('open', open));
      document.body.classList.toggle('public-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      const copy = PUBLIC_SHELL_COPY[getPublicLanguage()] || PUBLIC_SHELL_COPY.en;
      toggle.setAttribute('aria-label', open ? copy.closeNav : copy.openNav);
    };
    toggle.addEventListener('click', () => {
      setMobileMenuState(!toggle.classList.contains('open'));
    });
    // Close the mobile menu after tapping any link inside it.
    panels.forEach(panel => panel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      setMobileMenuState(false);
    })));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.classList.contains('open')) {
        setMobileMenuState(false);
        toggle.focus();
      }
    });
  }

  // Public-site theme toggle button (app pages get their own handler in renderShell()).
  const publicThemeBtn = document.getElementById('theme-toggle-btn');
  if (publicThemeBtn && !publicThemeBtn.dataset.bound) {
    publicThemeBtn.dataset.bound = '1';
    applyTheme(getTheme());
    publicThemeBtn.addEventListener('click', toggleTheme);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindPublicNavigationInteractions();
});

document.addEventListener('DOMContentLoaded', () => { if (window.lucide) lucide.createIcons(); });

// Accessible, local-only product-story tabs used by the flagship homepage.
function initProductStoryTabs() {
  document.querySelectorAll('[role="tablist"]').forEach((tablist) => {
    const tabs = [...tablist.querySelectorAll(':scope > [role="tab"]')];
    if (!tabs.length || tabs.some(tab => !tab.getAttribute('aria-controls'))) return;
    const activate = (tab, moveFocus = true) => {
      tabs.forEach((item) => {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(item.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      });
      if (moveFocus) tab.focus();
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab, false));
      tab.addEventListener('keydown', (event) => {
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        activate(tabs[next]);
      });
    });
  });
}
document.addEventListener('DOMContentLoaded', initProductStoryTabs);

// Keep the homepage source components canonical while presenting one deliberate
// enterprise story. The proof strip remains directly after the hero; each
// subsequent section is moved once into the approved narrative order.
function orderHomepageStory() {
  const main = document.getElementById('main-content');
  if (!main || !document.querySelector('.phase1-hero')) return;
  [
    'story-problem',
    'story-channels',
    'story-lifecycle',
    'story-workspace',
    'story-products',
    'story-example',
    'story-buyers',
    'story-knowledge',
    'story-trust',
    'story-implementation',
    'story-faq',
    'story-final'
  ].forEach((id) => {
    const section = document.getElementById(id);
    if (section) main.append(section);
  });
}
document.addEventListener('DOMContentLoaded', orderHomepageStory);

// ============================================================
// PUSH NOTIFICATIONS (Task 6.2) — registration helper.
// ------------------------------------------------------------
// REQUIRES: the Firebase Web SDK loaded via <script> tag on the calling
// page, and window.__FIREBASE_CONFIG__ set to your REAL project config
// (apiKey, projectId, messagingSenderId, appId) plus a REAL VAPID key —
// none of these are secret (Firebase web config is meant to be public),
// but they must be your actual project's values, which this codebase does
// not have access to. Call this function from any page that should offer
// push notifications (wired into Enumerator/Admin pages in Tasks 6.3/6.4).
// ============================================================
async function registerForPushNotifications() {
  if (!window.firebase || !window.__FIREBASE_CONFIG__) {
    console.warn('Push notifications: Firebase SDK or config not present on this page — skipping.');
    return false;
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications: not supported in this browser.');
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    if (!firebase.apps?.length) firebase.initializeApp(window.__FIREBASE_CONFIG__);
    const messaging = firebase.messaging();
    const registration = await navigator.serviceWorker.ready;
    const token = await messaging.getToken({ vapidKey: window.__FIREBASE_VAPID_KEY__, serviceWorkerRegistration: registration });
    if (!token) return false;

    await apiRequest('/api/push/register', { method: 'POST', body: { token, device_type: 'web' } });
    return true;
  } catch (e) {
    console.error('Push registration failed:', e.message);
    return false;
  }
}
