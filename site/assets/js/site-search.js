// VoiceInsights Africa — real client-side site search (Milestone A, Part 1).
// The index below is a static list of the site's actual public pages, each
// entry copied verbatim from that page's own <title> and meta description —
// not a full-text crawl, and not fabricated content.
const SITE_SEARCH_INDEX = [
  { title: 'Home', url: '/index.html', description: 'Voice intelligence for research and impact teams.' },
  { title: 'Platform', url: '/platform.html', description: "The architecture, AI engine, and integrations behind VoiceInsights Africa's voice intelligence infrastructure." },
  { title: 'Solutions', url: '/solutions.html', description: 'Survey automation, monitoring & evaluation, beneficiary feedback, and grievance systems.' },
  { title: 'Industries', url: '/industries.html', description: 'Mission-critical sectors: agriculture, public health, education, humanitarian response.' },
  { title: 'Security', url: '/security.html', description: 'Technical security details: encryption, infrastructure, access control, and data handling.' },
  { title: 'Safeguarding & Compliance', url: '/safeguarding.html', description: 'How VoiceInsights Africa protects respondents and secures data.' },
  { title: 'About', url: '/about.html', description: "VoiceInsights Africa's mission, vision, and story." },
  { title: 'Contact Us', url: '/contact.html', description: 'Talk to our team about launching voice-powered research at scale.' },
  { title: 'Case Studies', url: '/case-studies.html', description: 'How organizations use VoiceInsights Africa to modernize research and monitoring workflows.' },
  { title: 'FAQ', url: '/faq.html', description: 'Common questions about how VoiceInsights Africa collects, protects, and analyzes voice data.' },
  { title: 'Careers', url: '/careers.html', description: 'Open roles at VoiceInsights Africa.' },
  { title: 'Privacy Policy', url: '/privacy.html', description: 'How VoiceInsights Africa handles personal data.' },
  { title: 'Terms of Service', url: '/terms.html', description: 'Terms governing use of the VoiceInsights Africa platform.' },
  { title: 'API & Integrations', url: '/api.html', description: "Integrate VoiceInsights Africa's voice research data into your own systems." },
  { title: 'System Status', url: '/status.html', description: 'Live status of the VoiceInsights Africa platform — API, database, and storage.' },
  { title: 'For Development Partners', url: '/development-partners.html', description: 'Grant monitoring and multi-country impact measurement infrastructure.' },
  { title: 'For Governments', url: '/government.html', description: 'Citizen feedback and public service monitoring infrastructure.' },
  { title: 'For NGOs', url: '/ngos.html', description: 'Voice-based monitoring, evaluation, and beneficiary feedback for NGOs.' },
  { title: 'For Research Firms', url: '/research-firms.html', description: 'Large-scale voice-based survey infrastructure for research firms.' },
  { title: 'Knowledge Hub', url: '/sample-reports.html', description: 'Explore 33 governed flagship demonstration publications.' },
  { title: 'Enterprise Trust Center', url: '/trust-center.html', description: 'Security, privacy, responsible AI, accessibility, governance, continuity and support assurance.' },
  { title: 'Responsible AI', url: '/responsible-ai.html', description: 'Human oversight, evidence grounding, limitations, review and publication approval.' },
  { title: 'Data Protection', url: '/data-protection.html', description: 'Ownership, consent, retention, deletion, transfers, encryption and audit responsibilities.' },
  { title: 'Compliance Center', url: '/compliance-center.html', description: 'Status-aware assurance across data protection, accessibility, ethics, security and continuity.' },
  { title: 'Enterprise Support', url: '/enterprise-support.html', description: 'Support channels, incident priorities, training and customer success.' },
  { title: 'Service Level Overview', url: '/service-levels.html', description: 'Availability, response targets, maintenance, escalation and shared obligations.' },
  { title: 'Enterprise Architecture', url: '/enterprise-architecture.html', description: 'Public, API, worker, storage, offline, AI, export, authentication and audit relationships.' },
  { title: 'Integrations', url: '/integrations.html', description: 'Current, customer-scoped and planned enterprise integration capabilities.' },
  { title: 'Customer Success', url: '/customer-success.html', description: 'Onboarding, training, operating guidance, releases and continuous adoption support.' },
  { title: 'Request a Demo', url: '/contact.html', description: 'Book a guided walkthrough of the platform.' },
  { title: 'Log In', url: '/login.html', description: 'Sign in to your organization account.' },
  { title: 'Health Intelligence Suite', url: '/sectors/health.html', description: "Africa's Health Intelligence Platform — 25 modules, patient/facility voice collection, governed decision publications." },
  { title: 'Education Intelligence', url: '/sectors/education.html', description: 'Voice-collected evidence on attendance, transition and learning-outcome barriers.' },
  { title: 'Agriculture Intelligence', url: '/sectors/agriculture.html', description: 'Voice-collected evidence on yield stability, climate exposure and smallholder market access.' },
  { title: 'Humanitarian Intelligence', url: '/sectors/humanitarian.html', description: 'Voice-collected evidence on severity, protection and accountability to affected people.' },
  { title: 'Governance Intelligence', url: '/sectors/governance.html', description: 'Voice-collected citizen feedback on public services, policy reach and grievance resolution.' },
  { title: 'Procurement Readiness', url: '/procurement.html', description: 'Enterprise deployment, security, privacy, data governance and honest procurement-readiness evidence.' },
  { title: 'Mobile & Offline Capability', url: '/mobile-offline.html', description: 'Field-ready data collection that works with zero connectivity.' },
  { title: 'Enterprise Sales & Implementation', url: '/enterprise-sales.html', description: 'From pilot to national rollout — implementation journey, training, customer success and deployment options.' },
  { title: 'Enterprise Capability Statement', url: '/enterprise-capability-statement.html', description: 'What VoiceInsights Africa does, how it is deployed, and what evidence supports it.' },
  { title: 'Health Capability Statement', url: '/health-capability-statement.html', description: "Africa's Health Intelligence Platform — capability statement for ministries of health, hospital networks, donors and NGOs." },
  { title: 'Executive One-Pager', url: '/executive-one-pager.html', description: 'VoiceInsights Africa in one page.' },
  { title: 'Meeting Leave-Behind', url: '/meeting-leave-behind.html', description: 'A short recap to keep after meeting with VoiceInsights Africa.' },
  { title: 'Market Research Intelligence', url: '/sectors/market-research.html', description: 'Voice-collected evidence on addressable demand, segment economics and competitive differentiation.' },
  { title: 'Customer Experience Intelligence', url: '/sectors/customer-experience.html', description: 'Voice-collected evidence on journey friction, first-contact resolution and churn.' },
  { title: 'Employee Experience Intelligence', url: '/sectors/employee-experience.html', description: 'Voice-collected evidence on manager effectiveness, psychological safety and retention.' },
  { title: 'Climate Intelligence', url: '/sectors/climate.html', description: 'Voice-collected evidence on adaptive-capacity gaps and resilience-financing priorities.' },
  { title: 'Social Protection Intelligence', url: '/sectors/social-protection.html', description: 'Voice-collected evidence on targeting equity and cash-transfer programme integrity.' },
  { title: 'Digital Government Intelligence', url: '/sectors/digital-government.html', description: 'Voice-collected evidence on citizen digital-service adoption and trust.' },
  { title: 'WASH Access Intelligence', url: '/sectors/wash-access.html', description: 'Voice-collected evidence on water-point functionality and sanitation-access equity.' },
  { title: 'Energy Access Intelligence', url: '/sectors/energy-access.html', description: 'Voice-collected evidence on electrification prioritisation and supply-reliability gaps.' },
  { title: 'Financial Inclusion Intelligence', url: '/sectors/financial-inclusion.html', description: 'Voice-collected evidence on account-usage barriers and agent-network access gaps.' },
];

function initSiteSearch(mountId) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  mount.innerHTML = `
    <div class="search-field">
      <input type="search" id="site-search-input" placeholder="Search the site…" aria-label="Search the site" autocomplete="off">
      <div class="dropdown-menu" id="site-search-results" role="listbox"></div>
    </div>`;
  const input = document.getElementById('site-search-input');
  const results = document.getElementById('site-search-results');

  function render(query) {
    const q = query.trim().toLowerCase();
    if (!q) { results.classList.remove('open'); results.innerHTML = ''; return; }
    const matches = SITE_SEARCH_INDEX.filter(item =>
      item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    ).slice(0, 8);
    if (!matches.length) {
      results.innerHTML = '<div class="dropdown-item" style="cursor:default;color:var(--text-dim);">No matching pages</div>';
    } else {
      results.innerHTML = matches.map(item =>
        `<a class="dropdown-item" href="${item.url}" role="option"><b>${item.title}</b><br><span style="color:var(--text-dim);font-size:.78rem;">${item.description}</span></a>`
      ).join('');
    }
    results.classList.add('open');
  }

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => { if (input.value) render(input.value); });
  document.addEventListener('click', (e) => {
    if (!mount.contains(e.target)) results.classList.remove('open');
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { results.classList.remove('open'); input.blur(); }
  });
}
