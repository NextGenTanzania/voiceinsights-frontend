/* VoiceInsights Africa — Decision Workspace shared module (Program Beta Sprint 2)
   Wraps the real Sprint 1 / 1.5 / 1.6 Decision APIs via the existing
   apiRequest() helper (config.js) and provides pure, unit-testable
   formatting/permission-hint helpers. Exposed as a global `DW` namespace,
   matching the existing VISafeDOM convention (safe-dom.js) rather than
   introducing ES modules into a codebase that doesn't use them.

   IMPORTANT: every "permission hint" function here is DISPLAY-ONLY. The
   real authorization check happens server-side (assertPermission() in
   backend/src/application.js) on every mutating request regardless of
   what this file decides to show or hide. A drift or bug in the tables
   below can only ever produce a wrong hint (a button shown that the
   server then correctly rejects, or hidden when it would have been
   allowed) — never an unauthorized mutation. */
(function (global) {
  'use strict';

  // ============================================================
  // Real backend contracts, mirrored here ONLY for display decisions.
  // Kept in exact sync with:
  //   backend/src/international-programme-lifecycle.js (ACTION_STATUSES, ACTION_TRANSITIONS)
  //   backend/src/enterprise-identity-access.js (ACTION_PERMISSIONS_* per role)
  // A dedicated test (tests/decision-workspace.test.js) deep-compares these
  // constants against the real backend source so drift is caught, not
  // silently shipped.
  // ============================================================
  const ACTION_STATUSES = Object.freeze([
    'draft', 'under_review', 'needs_clarification', 'approved', 'rejected',
    'assigned', 'in_progress', 'completed', 'verified', 'cancelled',
  ]);

  // Mirrors ACTION_TRANSITIONS exactly — from -> { to: requiredPermission }.
  const ACTION_TRANSITIONS = Object.freeze({
    draft: { under_review: 'action.submit', cancelled: 'action.cancel' },
    under_review: { approved: 'action.review', rejected: 'action.review', needs_clarification: 'action.review', cancelled: 'action.cancel' },
    needs_clarification: { under_review: 'action.submit', cancelled: 'action.cancel' },
    approved: { assigned: 'action.assign', cancelled: 'action.cancel' },
    rejected: { draft: 'action.submit' },
    assigned: { in_progress: 'action.progress', cancelled: 'action.cancel' },
    in_progress: { completed: 'action.progress', cancelled: 'action.cancel' },
    completed: { verified: 'action.verify', in_progress: 'action.verify' },
    verified: {},
    cancelled: {},
  });

  // Mirrors ROLE_PERMISSIONS' action.* subset exactly (verified by audit
  // against the real backend module — founder_executive and enumerator
  // genuinely hold no action.* permission today; that is not an omission
  // here, it reflects real backend behavior).
  const ROLE_ACTION_PERMISSIONS = Object.freeze({
    super_admin: ['action.create', 'action.read', 'action.update', 'action.submit', 'action.review', 'action.assign', 'action.progress', 'action.verify', 'action.cancel'],
    org_admin: ['action.create', 'action.read', 'action.update', 'action.submit', 'action.review', 'action.assign', 'action.progress', 'action.verify', 'action.cancel'],
    head_of_programs: ['action.create', 'action.read', 'action.update', 'action.submit', 'action.review', 'action.assign', 'action.progress', 'action.verify', 'action.cancel'],
    operations_manager: ['action.create', 'action.read', 'action.update', 'action.submit', 'action.progress'],
    project_manager: ['action.create', 'action.read', 'action.update', 'action.submit', 'action.progress'],
    me_officer: ['action.create', 'action.read', 'action.update', 'action.submit', 'action.progress'],
    data_analyst: ['action.read'],
    // Sprint 2.1 correction: a real, live-Preview UAT run against the
    // deployed backend caught this — founder_executive holds the literal
    // string '*' in the real ROLE_PERMISSIONS object (enterprise-identity-
    // access.js), which hasPermission() there treats as a genuine wildcard
    // ("permissions.includes('*') || permissions.includes(permission)").
    // Sprint 2's original static audit filtered for `p.startsWith('action.')`,
    // which never matches the literal '*' — so it wrongly concluded
    // founder_executive had no action.* access at all. That was a bug in
    // the audit, not the backend: this founder_executive account correctly
    // received 200/201 on every real live-Preview API call in Sprint 2.1.
    founder_executive: ['*'],
    enumerator: [],
  });

  // Mirrors the real backend's hasPermission() semantics exactly, including
  // its wildcard rule — never independently invented.
  function roleHasPermission(role, permission) {
    const perms = ROLE_ACTION_PERMISSIONS[role] || [];
    return perms.includes('*') || perms.includes(permission);
  }

  function nextStatusesFor(status) {
    return Object.keys(ACTION_TRANSITIONS[status] || {});
  }

  function requiredPermissionForTransition(fromStatus, toStatus) {
    return (ACTION_TRANSITIONS[fromStatus] || {})[toStatus] || null;
  }

  // ============================================================
  // Formatting / labeling (pure — unit tested)
  // ============================================================
  const STATUS_LABELS = Object.freeze({
    draft: 'Draft', under_review: 'Under Review', needs_clarification: 'Needs Clarification',
    approved: 'Approved', rejected: 'Rejected', assigned: 'Assigned', in_progress: 'In Progress',
    completed: 'Completed — Awaiting Verification', verified: 'Verified', cancelled: 'Cancelled',
    legacy_unknown: 'Legacy (Unmigrated)',
  });
  function statusLabel(status) { return STATUS_LABELS[status] || status || 'Unknown'; }

  const STATUS_BADGE_CLASS = Object.freeze({
    draft: 'badge-neutral', under_review: 'badge-accent', needs_clarification: 'badge-warn',
    approved: 'badge-success', rejected: 'badge-danger', assigned: 'badge-accent', in_progress: 'badge-accent',
    completed: 'badge-warn', verified: 'badge-success', cancelled: 'badge-neutral', legacy_unknown: 'badge-neutral',
  });
  function statusBadgeClass(status) { return STATUS_BADGE_CLASS[status] || 'badge-neutral'; }

  function priorityBadgeClass(priority) {
    const p = String(priority || '').toLowerCase();
    if (p === 'critical') return 'badge-danger';
    if (p === 'high') return 'badge-warn';
    if (p === 'low') return 'badge-neutral';
    return 'badge-accent'; // medium / unset
  }
  function riskBadgeClass(riskLevel) {
    const r = String(riskLevel || '').toLowerCase();
    if (r === 'critical' || r === 'high') return 'badge-danger';
    if (r === 'medium') return 'badge-warn';
    if (r === 'low') return 'badge-success';
    return 'badge-neutral'; // unset/free-text value outside the expected set
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  // Whole days between an ISO timestamp and now — used for "days overdue" /
  // "age" displays. Always non-negative; never assumes a specific timezone
  // beyond what the platform's own Date parsing already establishes.
  function daysSince(iso) {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return null;
    return Math.max(0, Math.floor((Date.now() - then) / 86400000));
  }

  const FRESHNESS_LABELS = Object.freeze({ current: 'Up to date', lagging: 'Refreshing…', unknown: 'Not yet available', rebuilding: 'Rebuilding', failed: 'Refresh failed' });
  function freshnessLabel(status) { return FRESHNESS_LABELS[status] || 'Unknown'; }
  function freshnessBadgeClass(status) {
    if (status === 'current') return 'badge-success';
    if (status === 'lagging' || status === 'rebuilding') return 'badge-warn';
    if (status === 'failed') return 'badge-danger';
    return 'badge-neutral';
  }

  // Never claims a person's identity from a raw owner string that doesn't
  // resolve to a real, active, same-organization user (Part 18: "Do not
  // guess a person's identity").
  function ownerDisplay(action) {
    if (action.owner_display_name) return action.owner_display_name;
    return action.owner ? `${action.owner} (unresolved)` : 'Unassigned';
  }

  function isOwnedByCurrentUser(action, currentUserId) {
    return !!currentUserId && !!action?.owner && action.owner === currentUserId;
  }

  // ============================================================
  // Query-string helpers (pure — unit tested). Used to keep filter state
  // in the URL (Part 4: "stable URL query parameters", "browser back/
  // forward support").
  // ============================================================
  function buildQueryString(params) {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === '' || value === false) continue;
      usp.set(key, String(value));
    }
    const qs = usp.toString();
    return qs ? `?${qs}` : '';
  }
  function parseQueryString(search) {
    const usp = new URLSearchParams(search || '');
    const out = {};
    for (const [key, value] of usp.entries()) out[key] = value;
    return out;
  }

  // ============================================================
  // API wrappers — thin, so the real contract (paths, methods, payload
  // shape) lives in one place and every page uses the same call. Reuses
  // the existing global apiRequest() (config.js) for auth/headers/error
  // handling — no second fetch convention introduced.
  // ============================================================
  function api(path, options) { return global.apiRequest(path, options); }

  const Api = {
    listActions(params) { return api(`/api/decisions/projections/actions${buildQueryString(params)}`); },
    getAction(id) { return api(`/api/decisions/projections/actions/${encodeURIComponent(id)}`); },
    getOrganizationPortfolio() { return api('/api/decisions/projections/organization'); },
    getProjectPortfolio(projectId) { return api(`/api/decisions/projections/projects/${encodeURIComponent(projectId)}`); },
    listOwners(params) { return api(`/api/decisions/projections/owners${buildQueryString(params)}`); },
    getReviewQueue(projectId) { return api(`/api/decisions/projections/reviewers${buildQueryString({ project: projectId })}`); },
    getExecutive() { return api('/api/decisions/projections/executive'); },
    getHealth() { return api('/api/decisions/projections/health'); },

    // Program Beta Sprint 3 — Executive Intelligence Command Center.
    getExecutiveCommandCenter() { return api('/api/decisions/executive/command-center'); },
    getExecutiveAttentionBrief() { return api('/api/decisions/executive/attention-brief'); },
    getExecutiveDecisionsRequired() { return api('/api/decisions/executive/decisions-required'); },
    getExecutiveTimeline(params) { return api(`/api/decisions/executive/timeline${buildQueryString(params)}`); },

    // Product Experience Evolution Phase 1 — Platform Intelligence™.
    askCopilot(question) { return api('/api/decisions/intelligence/copilot', { method: 'POST', body: { question } }); },
    getRootCause(actionId) { return api(`/api/decisions/intelligence/root-cause${buildQueryString({ action_id: actionId })}`); },
    simulateScenario(body) { return api('/api/decisions/intelligence/simulate', { method: 'POST', body }); },
    getForecast(params) { return api(`/api/decisions/intelligence/forecast${buildQueryString(params)}`); },
    getSimilarActions(actionId) { return api(`/api/decisions/intelligence/similar${buildQueryString({ action_id: actionId })}`); },
    getKnowledgeGraph(actionId) { return api(`/api/decisions/intelligence/knowledge-graph${buildQueryString({ action_id: actionId })}`); },
    getRecommendations() { return api('/api/decisions/intelligence/recommendations'); },
    getNarrative(audience) { return api(`/api/decisions/intelligence/narrative${buildQueryString({ audience })}`); },

    // Authoritative write-side (Sprint 1/1.5) — never the projection tables.
    createAction(body) { return api('/api/decisions/actions', { method: 'POST', body }); },
    getActionDetail(id) { return api(`/api/decisions/actions/${encodeURIComponent(id)}`); },
    getActionHistory(id) { return api(`/api/decisions/actions/${encodeURIComponent(id)}/history`); },
    patchAction(id, body) { return api(`/api/decisions/actions/${encodeURIComponent(id)}`, { method: 'PATCH', body }); },
    transitionAction(id, body) { return api(`/api/decisions/actions/${encodeURIComponent(id)}/transition`, { method: 'POST', body }); },
    addEvidence(id, body) { return api(`/api/decisions/actions/${encodeURIComponent(id)}/evidence`, { method: 'POST', body }); },
  };

  // ============================================================
  // Safe rendering helpers — every user-controlled string (recommendation
  // text, reasons, evidence descriptions) must go through these, never raw
  // template-literal interpolation into innerHTML (Part 26).
  // ============================================================
  function escapeHtml(value) {
    if (global.VISafeDOM && global.VISafeDOM.escapeHtml) return global.VISafeDOM.escapeHtml(value);
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }
  // Only a genuinely absolute http(s) URL is ever rendered as a clickable
  // evidence link — no javascript:/data:/vbscript: schemes, and no bare
  // text silently resolved as a relative path against our own origin
  // (new URL(x, base) resolves almost anything, which would otherwise
  // turn a typo like "not a url" into a misleading same-origin link).
  // Deliberately called WITHOUT a base argument so anything that isn't
  // already absolute throws and is rejected (Part 15/26).
  function safeHref(url) {
    try {
      const u = new URL(url);
      return /^https?:$/.test(u.protocol) ? u.href : null;
    } catch (_) { return null; }
  }

  global.DW = Object.freeze({
    ACTION_STATUSES, ACTION_TRANSITIONS, ROLE_ACTION_PERMISSIONS,
    roleHasPermission, nextStatusesFor, requiredPermissionForTransition,
    statusLabel, statusBadgeClass, priorityBadgeClass, riskBadgeClass,
    formatDate, formatDateTime, daysSince, freshnessLabel, freshnessBadgeClass,
    ownerDisplay, isOwnedByCurrentUser, buildQueryString, parseQueryString,
    escapeHtml, safeHref, Api,
  });
})(typeof window !== 'undefined' ? window : globalThis);
