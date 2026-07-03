/* VoiceInsights Africa — shared app shell + mock data + i18n-aware nav */

const VI = {
  lang: localStorage.getItem('vi_lang') || 'en',
  user: { name: 'Kitentya Msuya', org: 'VoiceInsights Africa', role: 'org_admin', initials: 'KM' },
};

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
  { groupKey: 'app.nav.group.main', group: 'Main', items: [
    { href: '/app/dashboard.html', icon: 'layout-dashboard', key: 'app.nav.dashboard', label: 'Dashboard' },
    { href: '/app/projects.html', icon: 'folder-kanban', key: 'app.nav.projects', label: 'Projects' },
    { href: '/app/surveys.html', icon: 'list-checks', key: 'app.nav.surveys', label: 'Surveys' },
    { href: '/app/campaigns.html', icon: 'megaphone', key: 'app.nav.campaigns', label: 'Campaigns' },
  ]},
  { groupKey: 'app.nav.group.voice', group: 'Voice Data', items: [
    { href: '/app/respondents.html', icon: 'users', key: 'app.nav.respondents', label: 'Respondents' },
    { href: '/app/interviews.html', icon: 'headphones', key: 'app.nav.interviews', label: 'Interviews' },
  ]},
  { groupKey: 'app.nav.group.analytics', group: 'Analytics', items: [
    { href: '/app/analytics.html', icon: 'bar-chart-3', key: 'app.nav.analytics', label: 'Analytics' },
    { href: '/app/reports.html', icon: 'file-text', key: 'app.nav.reports', label: 'Reports' },
    { href: '/app/compliance.html', icon: 'shield-check', key: 'app.nav.compliance', label: 'Compliance' },
  ]},
  { groupKey: 'app.nav.group.account', group: 'Account', items: [
    { href: '/app/billing.html', icon: 'credit-card', key: 'app.nav.billing', label: 'Billing' },
    { href: '/app/settings.html', icon: 'settings', key: 'app.nav.settings', label: 'Settings' },
  ]},
];

const NAV_ADMIN = [
  { groupKey: 'app.nav.group.operations', group: 'Operations', items: [
    { href: '/admin/dashboard.html', icon: 'layout-dashboard', key: 'app.nav.overview', label: 'Overview' },
    { href: '/admin/leads.html', icon: 'inbox', key: 'app.nav.leads', label: 'Leads' },
    { href: '/admin/clients.html', icon: 'building-2', key: 'app.nav.clients', label: 'Clients' },
    { href: '/admin/call-monitoring.html', icon: 'phone-call', key: 'app.nav.call_monitoring', label: 'Call Monitoring' },
  ]},
  { groupKey: 'app.nav.group.quality', group: 'Quality & Safety', items: [
    { href: '/admin/fraud-alerts.html', icon: 'shield-alert', key: 'app.nav.fraud_alerts', label: 'Fraud Alerts' },
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

function renderShell({ role = 'client', active = '', title = '', eyebrow = '' }) {
  const storedUser = JSON.parse(localStorage.getItem('vi_user') || 'null');
  const userRole = storedUser?.role || 'org_admin';

  // Full-access roles see everything; a plain M&E Officer gets a reduced, focused nav
  // (no Billing, no Compliance edit, no Leads) — reflecting real permission differences.
  const RESTRICTED_FOR_ME_OFFICER = ['/app/billing.html', '/app/settings.html', '/admin/leads.html', '/admin/clients.html'];

  let nav = role === 'admin' ? NAV_ADMIN : NAV_APP;
  if (role === 'client' && userRole === 'me_officer') {
    nav = nav.map(g => ({ ...g, items: g.items.filter(it => !RESTRICTED_FOR_ME_OFFICER.includes(it.href)) })).filter(g => g.items.length);
  }

  const brandName = 'VoiceInsights Africa';
  const brandSub = role === 'admin' ? t('app.nav.admin_console', 'Admin Console') : t('app.nav.client_dashboard', 'Client Dashboard');
  const currentLang = getAppLang();

  const navHtml = nav.map(g => `
    <div class="nav-group">
      <div class="nav-label">${t(g.groupKey, g.group)}</div>
      ${g.items.map(it => `
        <a class="nav-item ${active === it.href ? 'active' : ''}" href="${it.href}">
          ${iconSvg(it.icon)} <span>${t(it.key, it.label)}</span>
        </a>`).join('')}
    </div>`).join('');

  const displayName = storedUser?.full_name || VI.user.name;
  const displayInitials = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const displayRole = storedUser?.role === 'me_officer' ? 'M&E Officer' : (role === 'admin' ? 'Super Admin' : 'Org Admin');

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
        <div style="display:flex; align-items:center; gap:.9rem;">
          <button class="btn btn-ghost btn-sm" id="menu-toggle" style="display:none;">${iconSvg('menu')}</button>
          <div>
            ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
            <h1>${title}</h1>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:.9rem;">
          <div class="lang-toggle" id="app-lang-toggle">
            ${APP_LANGS.map(l => `<button class="${currentLang === l.code ? 'active' : ''}" data-lang="${l.code}">${l.label}</button>`).join('')}
          </div>
          <div class="user-chip">
            <div class="avatar">${VI.user.initials}</div>
            <span style="font-size:.85rem; font-weight:600;">${VI.user.name}</span>
            <span class="badge badge-neutral" style="font-size:.62rem;">${userRole === 'me_officer' ? 'M&E Officer' : (role === 'admin' ? 'Super Admin' : 'Org Admin')}</span>
          </div>
        </div>
      </header>`;
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
}

function renderViaAssistant() {
  if (document.getElementById('via-launcher')) return; // already mounted
  const launcher = document.createElement('button');
  launcher.id = 'via-launcher';
  launcher.innerHTML = iconSvg('sparkles');
  launcher.style.cssText = 'position:fixed; bottom:1.75rem; right:1.75rem; width:52px; height:52px; border-radius:50%; background:var(--accent); color:var(--accent-ink); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 10px 30px rgba(0,0,0,.4); z-index:50;';
  document.body.appendChild(launcher);

  const panel = document.createElement('div');
  panel.id = 'via-panel';
  panel.style.cssText = 'position:fixed; bottom:5.5rem; right:1.75rem; width:360px; max-width:88vw; max-height:65vh; background:var(--surface); border:1px solid var(--border-strong); border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.5); display:none; flex-direction:column; z-index:50; overflow:hidden;';
  panel.innerHTML = `
    <div style="padding:.9rem 1rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
      <div><strong style="font-family:var(--font-display);">VIA Assistant</strong><div class="muted-note" style="font-size:.7rem;">${t('via.subtitle', 'Ask about your data')}</div></div>
      <button id="via-close" style="background:none; border:none; color:var(--text-dim); cursor:pointer; font-size:1.1rem;">×</button>
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

function highlightActiveTopNav() {
  const current = window.location.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
  document.querySelectorAll('.pub-nav-links a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const hrefPath = href.split('#')[0].replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
    if (hrefPath && hrefPath === current) a.classList.add('active-nav-link');
  });
}
document.addEventListener('DOMContentLoaded', highlightActiveTopNav);

document.addEventListener('DOMContentLoaded', () => { if (window.lucide) lucide.createIcons(); });
