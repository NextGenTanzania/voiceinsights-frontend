// VoiceInsights Africa — Sector Page Framework (Sector Intelligence Platform
// release). One shared render engine for every sector page (site/sectors/*.html)
// and every Parts 9-11 flagship page (procurement.html, mobile-offline.html,
// enterprise-sales.html). A page calling renderSectorPage(config) gets its
// entire #sector-content region built from documented components — there is
// nowhere in a sector page for bespoke markup to live, which is what makes
// "sector pages differ through content, not architecture" true by
// construction, not just by convention. Missing config keys simply produce
// no section; nothing here ever fabricates a value that wasn't supplied.
// Global script, no build step — matches app.js/site-search.js.

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function sectionHead(cfg) {
  if (!cfg) return '';
  return `<div class="sector-section-head">${cfg.eyebrow ? `<span class="eyebrow">${escapeHtml(cfg.eyebrow)}</span>` : ''}<h2>${escapeHtml(cfg.headline)}</h2>${cfg.description ? `<p>${escapeHtml(cfg.description)}</p>` : ''}</div>`;
}

function renderHero(cfg) {
  if (!cfg) return '';
  const stats = (cfg.stats || []).map((s) => `<div class="sector-stat"><span class="sector-stat-value">${escapeHtml(s.value)}</span><span class="sector-stat-label">${escapeHtml(s.label)}</span></div>`).join('');
  return `<header class="pub-hero">
    ${cfg.eyebrow ? `<span class="eyebrow">${escapeHtml(cfg.eyebrow)}</span>` : ''}
    <h1>${escapeHtml(cfg.headline)}</h1>
    ${cfg.subhead ? `<p class="lead">${escapeHtml(cfg.subhead)}</p>` : ''}
    <div style="display:flex;gap:.9rem;flex-wrap:wrap;margin-top:1.6rem;">
      ${cfg.primaryCta ? `<a class="btn btn-primary" href="${escapeHtml(cfg.primaryCta.href)}">${escapeHtml(cfg.primaryCta.label)}</a>` : ''}
      ${cfg.secondaryCta ? `<a class="btn btn-ghost" href="${escapeHtml(cfg.secondaryCta.href)}">${escapeHtml(cfg.secondaryCta.label)}</a>` : ''}
    </div>
    ${stats ? `<div class="sector-stat-row">${stats}</div>` : ''}
  </header>`;
}

function renderExecutiveSummary(cfg) {
  if (!cfg) return '';
  const paragraphs = (cfg.paragraphs || []).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
  const pillars = (cfg.pillars || []).map((p) => `<div class="card">${p.icon ? `<span class="sector-pillar-icon" aria-hidden="true">${p.icon}</span>` : ''}<h3 style="font-size:1rem;margin:0 0 .5rem;">${escapeHtml(p.title)}</h3><p style="margin:0;font-size:.88rem;">${escapeHtml(p.description)}</p></div>`).join('');
  return `<section class="pub-section">${sectionHead(cfg)}${paragraphs}${pillars ? `<div class="grid grid-3" style="margin-top:1.5rem;">${pillars}</div>` : ''}</section>`;
}

function renderChallenges(cfg) {
  if (!cfg) return '';
  const items = (cfg.items || []).map((it) => `<div class="feature-card"><h3 style="font-size:1.05rem;">${escapeHtml(it.title)}</h3><p>${escapeHtml(it.description)}</p></div>`).join('');
  return `<section class="pub-section">${sectionHead(cfg)}<div class="grid grid-3">${items}</div></section>`;
}

function renderWhyVoiceInsights(cfg) {
  if (!cfg) return '';
  const items = (cfg.items || []).map((it) => `<div class="feature-card">${it.icon ? `<span class="sector-pillar-icon" aria-hidden="true">${it.icon}</span>` : ''}<h3 style="font-size:1.05rem;">${escapeHtml(it.title)}</h3><p>${escapeHtml(it.description)}</p></div>`).join('');
  return `<section class="pub-section">${sectionHead(cfg)}<div class="grid grid-3">${items}</div></section>`;
}

function renderAiCapabilities(cfg) {
  if (!cfg) return '';
  const items = (cfg.items || []).map((it) => {
    const isLive = it.status === 'Live';
    return `<div class="card sector-capability-card"><div class="sector-capability-top"><h3>${escapeHtml(it.name)}</h3><span class="badge ${isLive ? 'badge-success' : 'badge-neutral'}">${isLive ? 'Live' : 'Roadmap'}</span></div><p style="margin:0;font-size:.88rem;">${escapeHtml(it.description)}</p></div>`;
  }).join('');
  return `<section class="pub-section">${sectionHead(cfg)}<div class="grid grid-3">${items}</div></section>`;
}

function renderWorkflow(cfg) {
  if (!cfg) return '';
  const steps = (cfg.steps || []).map((s) => `<div class="sector-workflow-step"><span class="step-index">${escapeHtml(s.index)}</span><div><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.description)}</p></div></div>`).join('');
  return `<section class="pub-section">${sectionHead(cfg)}<div class="sector-workflow-steps">${steps}</div></section>`;
}

function renderDashboardPreview(cfg) {
  if (!cfg) return '';
  const tiles = (cfg.tiles || []).map((t) => `<div class="sector-dashboard-tile"><div class="sector-dashboard-tile-value">${escapeHtml(t.value)}</div><div class="sector-dashboard-tile-label">${escapeHtml(t.label)}</div>${t.trend ? `<div class="sector-dashboard-tile-trend ${t.trendDirection || 'flat'}">${escapeHtml(t.trend)}</div>` : ''}</div>`).join('');
  return `<section class="pub-section">${sectionHead(cfg)}<div class="sector-dashboard-preview-panel"><div class="sector-dashboard-preview-label">Illustrative preview — not live data</div><div class="sector-dashboard-tiles">${tiles}</div></div></section>`;
}

function moduleCardHtml(m) {
  const isLive = m.status === 'Live sample';
  const link = isLive && m.linkedSampleKey ? `<a class="sector-module-link" href="/flagship-sample-report.html?key=${encodeURIComponent(m.linkedSampleKey)}">View sample publication →</a>` : '';
  return `<div class="card sector-module-card"><div class="sector-module-top"><h3>${escapeHtml(m.name)}</h3><span class="badge ${isLive ? 'badge-success' : 'badge-neutral'}">${isLive ? 'Live' : 'Roadmap'}</span></div><p><b>Decision:</b> ${escapeHtml(m.decisionProblem)}</p>${m.aiCapability ? `<p><b>AI capability:</b> ${escapeHtml(m.aiCapability)}</p>` : ''}${link}</div>`;
}

// Progressive disclosure: "Live sample" modules — the ones a visitor can
// actually open and read — are shown immediately; "Roadmap" modules (often
// the majority, e.g. Health's 18-of-25) collapse behind a native
// <details>/<summary> disclosure so the page doesn't force a long scroll
// past unbuilt modules to reach the CTA. No new JS dependency — the
// browser's own disclosure semantics handle keyboard/screen-reader support.
function renderModuleShowcase(cfg) {
  if (!cfg) return '';
  const all = cfg.modules || [];
  const live = all.filter((m) => m.status === 'Live sample');
  const roadmap = all.filter((m) => m.status !== 'Live sample');
  const liveGrid = live.length ? `<div class="sector-module-grid">${live.map(moduleCardHtml).join('')}</div>` : '';
  const roadmapGrid = roadmap.length
    ? `<details class="sector-module-roadmap"><summary>Show ${roadmap.length} roadmap module${roadmap.length === 1 ? '' : 's'}</summary><div class="sector-module-grid" style="margin-top:1rem;">${roadmap.map(moduleCardHtml).join('')}</div></details>`
    : '';
  return `<section class="pub-section">${sectionHead(cfg)}${liveGrid}${roadmapGrid}</section>`;
}

function renderIntegrations(cfg) {
  if (!cfg) return '';
  const items = (cfg.items || []).map((it) => `<div class="card sector-integration-card"><strong>${escapeHtml(it.name)}</strong><span>${escapeHtml(it.description)}</span></div>`).join('');
  return `<section class="pub-section">${sectionHead(cfg)}<div class="sector-integration-grid">${items}</div></section>`;
}

function renderSecurityGovernance(cfg) {
  if (!cfg) return '';
  const points = (cfg.summaryPoints || []).map((p) => `<li>${escapeHtml(p)}</li>`).join('');
  const links = (cfg.links || []).map((l) => `<a class="btn btn-ghost btn-sm" href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`).join('');
  return `<section class="pub-section">${sectionHead(cfg)}${points ? `<ul style="margin:0 0 0 1.2rem;padding:0;color:var(--text-muted);">${points}</ul>` : ''}<div class="sector-security-links">${links}</div></section>`;
}

function renderCustomerOutcomes(cfg) {
  if (!cfg) return '';
  const items = (cfg.items || []).map((it) => `<div class="card sector-outcome-card"><span class="sector-outcome-label">${escapeHtml(it.label || 'Synthetic demonstration scenario')}</span><p class="sector-outcome-quote">&ldquo;${escapeHtml(it.quote)}&rdquo;</p><div class="sector-outcome-context">${escapeHtml(it.context)}</div></div>`).join('');
  return `<section class="pub-section">${sectionHead(cfg)}<div class="grid grid-3">${items}</div></section>`;
}

function renderFaqSection(cfg) {
  if (!cfg) return '';
  const items = (cfg.items || []).map((it) => `<div class="sector-faq-item"><h3>${escapeHtml(it.q)}</h3><p>${it.a}</p></div>`).join('');
  return `<section class="pub-section" style="max-width:820px;">${sectionHead(cfg)}${items}</section>`;
}

function renderCta(cfg) {
  if (!cfg) return '';
  return `<section class="pub-section sector-cta-block" style="background:var(--surface);border-radius:20px;">
    <h2>${escapeHtml(cfg.headline)}</h2>
    ${cfg.description ? `<p style="max-width:55ch;margin:1rem auto;">${escapeHtml(cfg.description)}</p>` : ''}
    ${cfg.primary ? `<a class="btn btn-primary" href="${escapeHtml(cfg.primary.href)}">${escapeHtml(cfg.primary.label)}</a>` : ''}
    ${cfg.secondary ? `<a class="btn btn-ghost" href="${escapeHtml(cfg.secondary.href)}">${escapeHtml(cfg.secondary.label)}</a>` : ''}
  </section>`;
}

function renderBookDemo(cfg) {
  if (!cfg) return '';
  return `<section class="pub-section sector-cta-block">
    <h2>${escapeHtml(cfg.headline)}</h2>
    ${cfg.description ? `<p style="max-width:55ch;margin:1rem auto;">${escapeHtml(cfg.description)}</p>` : ''}
    <a class="btn btn-primary" href="${escapeHtml(cfg.formHref)}">Book a demo</a>
  </section>`;
}

function renderRelatedSectors(cfg) {
  if (!cfg || !cfg.length) return '';
  const links = cfg.map((r) => `<a href="${escapeHtml(r.href)}">${escapeHtml(r.label)}</a>`).join('');
  return `<section class="pub-section"><div class="sector-section-head"><h2>Related sectors</h2></div><div class="sector-related-list">${links}</div></section>`;
}

// Publication Library is the one async section: it fetches the REAL public
// catalog (never a hand-typed list of titles) and filters by cfg.domain —
// the same real knowledge-router domain every flagship publication already
// discloses via report.knowledge_routing.domain (see
// getFlagshipSampleCatalog()'s additive `domain` field).
async function renderPublicationLibrary(cfg, mountEl) {
  if (!cfg || !mountEl) return;
  mountEl.innerHTML = `<section class="pub-section">${sectionHead(cfg)}<div class="sector-pub-loading">Loading flagship publications…</div></section>`;
  try {
    const endpoint = cfg.catalogEndpoint || `${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : ''}/api/public/flagship-sample-library`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Publication service returned HTTP ${response.status}`);
    const payload = await response.json();
    const allReports = payload?.catalog?.reports || [];
    // cfg.domain accepts either a single domain string or an array — a
    // sector often maps to more than one knowledge-router domain (Health
    // alone spans six: Health Intelligence plus five new sub-domains), so
    // filtering must support "any of these domains," not just one exact match.
    const domainList = Array.isArray(cfg.domain) ? cfg.domain : cfg.domain ? [cfg.domain] : null;
    const matches = domainList ? allReports.filter((r) => domainList.includes(r.domain)) : allReports;
    if (!matches.length) {
      mountEl.innerHTML = `<section class="pub-section">${sectionHead(cfg)}<div class="sector-pub-empty">${escapeHtml(cfg.emptyStateText || 'No flagship publications for this sector yet — check back soon.')}</div></section>`;
      return;
    }
    const cards = matches.map((r) => `<article class="sector-pub-card"><div class="sector-pub-cover" style="background:linear-gradient(135deg,${escapeHtml(r.cover?.primary || '#082B55')},${escapeHtml(r.cover?.accent || '#1669A8')})"><span class="eyebrow">${escapeHtml(r.category)}</span><h3>${escapeHtml(r.title)}</h3></div><div class="sector-pub-body"><p>${escapeHtml(r.executive_story || '')}</p><a class="btn btn-primary btn-sm" href="${escapeHtml(r.viewer_url)}">View publication</a></div></article>`).join('');
    mountEl.innerHTML = `<section class="pub-section">${sectionHead(cfg)}<div class="sector-pub-grid">${cards}</div></section>`;
  } catch (error) {
    mountEl.innerHTML = `<section class="pub-section">${sectionHead(cfg)}<div class="sector-pub-error">The publication library is temporarily unavailable. ${escapeHtml(error.message)}</div></section>`;
  }
}

// Orchestrator — the only function a sector page's inline <script> calls.
// Renders every synchronous section in order, inserts a mount point for the
// one async section (Publication Library) at the right position, then kicks
// off its fetch. Sections whose config key is absent are simply skipped.
function renderSectorPage(config) {
  const root = document.getElementById('sector-content');
  if (!root || !config) return;

  if (config.meta) {
    if (config.meta.title) document.title = config.meta.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && config.meta.description) metaDesc.setAttribute('content', config.meta.description);
  }

  const PUB_LIBRARY_MOUNT = '<div id="sector-publication-library-mount"></div>';

  const sections = [
    renderHero(config.hero),
    renderExecutiveSummary(config.executiveSummary),
    renderChallenges(config.challenges),
    renderWhyVoiceInsights(config.whyVoiceInsights),
    renderAiCapabilities(config.aiCapabilities),
    renderWorkflow(config.workflow),
    renderDashboardPreview(config.dashboardPreview),
    renderModuleShowcase(config.moduleShowcase),
    config.publicationLibrary ? PUB_LIBRARY_MOUNT : '',
    renderIntegrations(config.integrations),
    renderSecurityGovernance(config.securityGovernance),
    renderCustomerOutcomes(config.customerOutcomes),
    renderFaqSection(config.faqs),
    renderCta(config.cta),
    renderBookDemo(config.bookDemo),
    renderRelatedSectors(config.relatedSectors),
  ];

  root.innerHTML = sections.join('');

  if (config.publicationLibrary) {
    renderPublicationLibrary(config.publicationLibrary, document.getElementById('sector-publication-library-mount'));
  }
}

// Generic .tabs/.tab-panel toggler — components.css already defines the CSS
// for these classes but no shared JS wires them up anywhere public-facing.
// Not used by Health's module showcase (a plain grid reads better at 25
// items) but available to any future sector-framework page that needs
// tabbed content, matching the framework's own "configurable, not
// duplicated" rule.
function initTabs(rootEl) {
  if (!rootEl) return;
  rootEl.querySelectorAll('.tabs').forEach((tabs) => {
    tabs.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const panelId = tab.dataset.tabTarget;
        tabs.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const panelGroup = tabs.closest('[data-tab-group]') || rootEl;
        panelGroup.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === panelId));
      });
    });
  });
}
