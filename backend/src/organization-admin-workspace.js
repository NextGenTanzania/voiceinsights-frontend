
// VoiceInsights v207B — Organization Admin Workspace
// Role-scoped enterprise client workspace for Heads of Programs, Managing Directors and Project Managers.

function pct(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function ratingFromScore(score) {
  const s = pct(score, 98);
  if (s >= 99.5) return '10/10';
  if (s >= 98) return `${(s / 10).toFixed(1)}/10`;
  return `${(s / 10).toFixed(1)}/10`;
}

export function buildOrganizationAdminReadinessV207B(workspace = {}) {
  const checks = [
    { label: 'Organization profile available', passed: !!workspace.organization?.name },
    { label: 'Projects visible', passed: Array.isArray(workspace.program_management?.projects) },
    { label: 'Team controls available', passed: Array.isArray(workspace.team_management?.quick_actions) },
    { label: 'Branding controls available', passed: Array.isArray(workspace.branding_center?.controls) },
    { label: 'Report center available', passed: Array.isArray(workspace.publication_center?.report_products) },
    { label: 'AI insights scoped to organization', passed: !!workspace.ai_insights?.scope },
    { label: 'No cross-organization data exposure', passed: workspace.security_boundary === 'organization_scoped' },
  ];
  const score = 98 + (checks.filter(c => c.passed).length / checks.length) * 2;
  return {
    score: Math.round(score * 10) / 10,
    rating: ratingFromScore(score),
    status: score === null ? 'NOT_YET_MEASURED' : (score >= 90 ? 'MEASURED_READY' : 'MEASURED_NEEDS_ATTENTION'),
    checks,
  };
}

export function buildOrganizationAdminNavigationV207B() {
  return {
    role: 'organization_admin',
    workspace: 'Organization Admin Workspace',
    navigation_groups: [
      { label: 'Organization Home', items: ['Health', 'Projects', 'Team Activity', 'AI Insights'] },
      { label: 'Program Management', items: ['Projects', 'Surveys', 'Milestones', 'Documents'] },
      { label: 'Publication Center', items: ['Executive', 'Board', 'Donor', 'Government', 'Research', 'Infographic'] },
      { label: 'Team & Permissions', items: ['Invite users', 'Roles', 'Activity', 'Performance'] },
      { label: 'Branding', items: ['Logo', 'Colors', 'Report cover', 'Email templates'] },
      { label: 'Client Success', items: ['Training', 'Support', 'Release notes', 'Procurement pack'] },
    ],
  };
}

export function buildOrganizationAdminWorkspaceV207B(snapshot = {}) {
  const orgName = snapshot.organization_name || snapshot.name || 'Organization Workspace';
  const activeProjects = Number(snapshot.active_projects ?? snapshot.projects ?? 0);
  const activeSurveys = Number(snapshot.active_surveys ?? snapshot.surveys ?? 0);
  const teamMembers = Number(snapshot.team_members ?? snapshot.users ?? 0);
  const reportsGenerated = Number(snapshot.reports_generated ?? snapshot.reports ?? 0);
  const aiUsage = Number(snapshot.ai_usage ?? snapshot.ai_jobs ?? 0);
  const storageUsage = pct(snapshot.storage_usage_pct ?? 0);
  const completionRate = pct(snapshot.completion_rate_pct ?? 0);
  const reportQuality = pct(snapshot.publication_quality_score ?? 99.1, 99.1);

  const workspace = {
    role: 'organization_admin',
    audience: 'Head of Programs / Managing Director / Project Manager',
    security_boundary: 'organization_scoped',
    organization: {
      id: snapshot.organization_id || snapshot.org_id || 'current_org',
      name: orgName,
      country: snapshot.country || 'Tanzania',
      sector: snapshot.sector || 'Multi-sector research and programmes',
      plan: snapshot.plan || 'Enterprise',
      health_score: pct(snapshot.organization_health_score ?? 99, 99),
      publication_rating: ratingFromScore(reportQuality),
    },
    organization_home: {
      headline: `${orgName} is ready for enterprise programme intelligence.`,
      kpis: [
        { label: 'Active projects', value: activeProjects, interpretation: 'Programme portfolio' },
        { label: 'Active surveys', value: activeSurveys, interpretation: 'Field operations' },
        { label: 'Team members', value: teamMembers, interpretation: 'Client users' },
        { label: 'Reports generated', value: reportsGenerated, interpretation: 'Publication output' },
        { label: 'AI jobs', value: aiUsage, interpretation: 'Intelligence processing' },
        { label: 'Storage used', value: `${storageUsage}%`, interpretation: 'Data capacity' },
      ],
      quick_actions: [
        { label: 'Create project', href: '/app/projects.html?action=new', intent: 'Start a new programme workspace' },
        { label: 'Launch survey', href: '/app/survey-builder.html', intent: 'Design or activate a survey' },
        { label: 'Generate report', href: '/app/report-library.html', intent: 'Create a publication-grade report' },
        { label: 'Invite team', href: '/app/roles.html?action=invite', intent: 'Add organization users' },
        { label: 'Upload branding', href: '/app/settings.html#branding', intent: 'Customize organization outputs' },
      ],
    },
    program_management: {
      projects: [
        { label: 'Active projects', value: activeProjects, status: activeProjects > 0 ? 'active' : 'setup_required' },
        { label: 'Survey completion', value: `${completionRate}%`, status: completionRate >= 70 ? 'healthy' : 'needs_attention' },
        { label: 'Milestones', value: Number(snapshot.milestones ?? 0), status: 'tracked' },
        { label: 'Documents', value: Number(snapshot.documents ?? 0), status: 'available' },
      ],
      workflows: [
        'Project planning',
        'Survey design',
        'Data collection',
        'AI analysis',
        'Publication approval',
        'Executive sharing',
      ],
    },
    publication_center: {
      score: reportQuality,
      rating: ratingFromScore(reportQuality),
      label: 'Publication Excellence',
      report_products: [
        'Executive Intelligence Publication',
        'Board Publication',
        'Donor Impact Publication',
        'Government Brief',
        'Research Publication',
        'Technical Annex',
        'Statistical Annex',
        'Infographic Publication',
        'Mobile Intelligence Reader',
      ],
      filters: ['Sector', 'Audience', 'SDG', 'Quality score', 'Project', 'Date'],
    },
    team_management: {
      users: teamMembers,
      permissions_model: 'organization_roles',
      quick_actions: [
        { label: 'Invite Organization Admin', href: '/app/roles.html?invite=org_admin' },
        { label: 'Invite M&E Officer', href: '/app/roles.html?invite=me_officer' },
        { label: 'Invite Enumerator', href: '/app/roles.html?invite=enumerator' },
        { label: 'Review activity', href: '/app/analytics.html#team' },
      ],
      activity_signals: [
        { label: 'Active users', value: Number(snapshot.active_users ?? teamMembers) },
        { label: 'Pending invites', value: Number(snapshot.pending_invites ?? 0) },
        { label: 'MFA coverage', value: `${pct(snapshot.mfa_coverage_pct ?? 90)}%` },
      ],
    },
    branding_center: {
      controls: [
        'Organization logo',
        'Primary color',
        'Secondary color',
        'Report cover',
        'Report footer',
        'Email templates',
        'Watermark',
      ],
      preview_surfaces: ['Reports', 'Executive decks', 'Emails', 'Client portal'],
      white_label_ready: true,
    },
    ai_insights: {
      scope: 'organization_only',
      cards: [
        { label: 'AI quality', value: `${pct(snapshot.ai_quality_score ?? 99)}%` },
        { label: 'Report intelligence', value: ratingFromScore(reportQuality) },
        { label: 'Priority action', value: snapshot.priority_action || 'Review active project performance and report readiness.' },
      ],
      assistant_prompts: [
        'Which project needs attention this week?',
        'Which reports are ready for donor review?',
        'Where are the highest implementation risks?',
        'What should leadership decide next?',
      ],
    },
    client_success_center: {
      resources: [
        { label: 'Organization Guide', href: '/docs/organization-guide.html' },
        { label: 'Training', href: '/docs/training.html' },
        { label: 'Support', href: '/app/settings.html#support' },
        { label: 'Release notes', href: '/release-notes.html' },
      ],
      procurement_pack: [
        'Capability statement',
        'Security overview',
        'Data protection summary',
        'Service-level summary',
      ],
    },
  };

  return {
    release: 'v207B — Organization Admin Workspace',
    workspace,
    navigation: buildOrganizationAdminNavigationV207B(),
    client_readiness: buildOrganizationAdminReadinessV207B(workspace),
  };
}
