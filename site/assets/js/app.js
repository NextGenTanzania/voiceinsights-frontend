/* VoiceInsights — shared app shell + mock data */

const VI = {
  lang: localStorage.getItem('vi_lang') || 'sw',
  user: { name: 'Kitentya Msuya', org: 'NEXT-GEN Holdings', role: 'org_admin', initials: 'KM' },
};

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
  { group: 'Main', items: [
    { href: '/app/dashboard.html', icon: 'layout-dashboard', label: 'Dashboard' },
    { href: '/app/surveys.html', icon: 'list-checks', label: 'Surveys' },
    { href: '/app/campaigns.html', icon: 'megaphone', label: 'Campaigns' },
  ]},
  { group: 'Analytics', items: [
    { href: '/app/analytics.html', icon: 'bar-chart-3', label: 'Analytics' },
    { href: '/app/reports.html', icon: 'file-text', label: 'Reports' },
  ]},
  { group: 'Account', items: [
    { href: '/app/billing.html', icon: 'credit-card', label: 'Billing' },
    { href: '/app/settings.html', icon: 'settings', label: 'Settings' },
  ]},
];

const NAV_ADMIN = [
  { group: 'Operations', items: [
    { href: '/admin/dashboard.html', icon: 'layout-dashboard', label: 'Overview' },
    { href: '/admin/clients.html', icon: 'building-2', label: 'Clients' },
    { href: '/admin/call-monitoring.html', icon: 'phone-call', label: 'Call Monitoring' },
  ]},
  { group: 'Quality & Safety', items: [
    { href: '/admin/fraud-alerts.html', icon: 'shield-alert', label: 'Fraud Alerts' },
    { href: '/admin/model-performance.html', icon: 'cpu', label: 'AI Model Performance' },
    { href: '/admin/audit-logs.html', icon: 'scroll-text', label: 'Audit Logs' },
  ]},
];

function iconSvg(name) {
  return `<i data-lucide="${name}"></i>`;
}

function renderShell({ role = 'client', active = '', title = '', eyebrow = '' }) {
  const nav = role === 'admin' ? NAV_ADMIN : NAV_APP;
  const brandByme = role === 'admin' ? 'VoiceInsights' : 'VoiceInsights';
  const brandSub = role === 'admin' ? 'Admin Console' : VI.user.org;

  const navHtml = nav.map(g => `
    <div class="nav-group">
      <div class="nav-label">${g.group}</div>
      ${g.items.map(it => `
        <a class="nav-item ${active === it.href ? 'active' : ''}" href="${it.href}">
          ${iconSvg(it.icon)} <span>${it.label}</span>
        </a>`).join('')}
    </div>`).join('');

  const sidebarMount = document.getElementById('sidebar-mount');
  if (sidebarMount) {
    sidebarMount.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <div class="mark">V</div>
          <div class="name">${brandByme}<em>${brandSub}</em></div>
        </div>
        <div style="flex:1; display:flex; flex-direction:column; gap:1.5rem;">${navHtml}</div>
        <div class="sidebar-foot">
          <a class="nav-item" href="/index.html">${iconSvg('log-out')} <span>Log Out</span></a>
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
          <div class="lang-toggle">
            <button class="${VI.lang==='sw'?'active':''}" data-lang="en">SW</button>
            <button class="${VI.lang==='en'?'active':''}" data-lang="en">EN</button>
          </div>
          <div class="user-chip">
            <div class="avatar">${VI.user.initials}</div>
            <span style="font-size:.85rem; font-weight:600;">${VI.user.name}</span>
          </div>
        </div>
      </header>`;
  }

  if (window.lucide) lucide.createIcons();

  document.querySelectorAll('.lang-toggle button').forEach(b => {
    b.addEventListener('click', () => {
      VI.lang = b.dataset.lang;
      localStorage.setItem('vi_lang', VI.lang);
      document.querySelectorAll('.lang-toggle button').forEach(x => x.classList.toggle('active', x === b));
    });
  });

  const toggle = document.getElementById('menu-toggle');
  if (toggle) {
    toggle.style.display = 'inline-flex';
    toggle.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  }
}

document.addEventListener('DOMContentLoaded', () => { if (window.lucide) lucide.createIcons(); });
