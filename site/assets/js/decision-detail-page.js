/* VoiceInsights Africa — Action Detail page controller (decision-detail.html)
   Program Beta Sprint 2. */
(function () {
  'use strict';
  if (!requireLogin()) return;

  const storedUser = JSON.parse(localStorage.getItem('vi_user') || 'null');
  const role = storedUser?.role || '';
  const actionId = new URLSearchParams(location.search).get('id');

  if (!DW.roleHasPermission(role, 'action.read')) {
    renderShell({ role: 'client', active: '/app/decisions.html', title: 'Action Detail' });
    document.getElementById('dd-denied').style.display = 'flex';
    return;
  }
  if (!actionId) {
    renderShell({ role: 'client', active: '/app/decisions.html', title: 'Action Detail' });
    document.getElementById('dd-loading').style.display = 'none';
    document.getElementById('dd-error').style.display = 'block';
    document.getElementById('dd-error').textContent = 'No Action ID was supplied.';
    return;
  }

  renderShell({ role: 'client', active: '/app/decisions.html', eyebrow: 'Decision Workspace', title: 'Action Detail', breadcrumb: [{ href: '/app/decisions.html', label: 'Decision Workspace' }, { label: 'Action Detail' }] });

  const canUpdate = DW.roleHasPermission(role, 'action.update');
  const canProgress = DW.roleHasPermission(role, 'action.progress');

  let current = null; // the authoritative action record, refreshed after every mutation
  let staleWarningShown = false;

  const TRANSITION_LABELS = {
    under_review: 'Submit for Review', approved: 'Approve', rejected: 'Reject', needs_clarification: 'Request Clarification',
    assigned: 'Assign', in_progress: 'Start / Resume Progress', completed: 'Mark Complete', verified: 'Verify', cancelled: 'Cancel', draft: 'Return to Draft',
  };
  const HIGH_IMPACT = new Set(['rejected', 'cancelled', 'verified']);
  function labelForTransition(from, to) {
    if (to === 'in_progress' && from === 'completed') return 'Reopen (return to In Progress)';
    return TRANSITION_LABELS[to] || `Move to ${DW.statusLabel(to)}`;
  }

  async function loadDetail(showLoading) {
    if (showLoading) { document.getElementById('dd-loading').style.display = 'block'; document.getElementById('dd-root').style.display = 'none'; document.getElementById('dd-error').style.display = 'none'; }
    try {
      const { action } = await DW.Api.getActionDetail(actionId);
      current = action;
      document.getElementById('dd-loading').style.display = 'none';
      document.getElementById('dd-error').style.display = 'none';
      document.getElementById('dd-stale-banner').style.display = 'none';
      staleWarningShown = false;
      renderDetail(action);
      document.getElementById('dd-root').style.display = 'block';
      loadTimeline();
      loadFreshness();
    } catch (e) {
      document.getElementById('dd-loading').style.display = 'none';
      if (String(e.message).includes('404') || /not found/i.test(e.message)) {
        document.getElementById('dd-error').style.display = 'block';
        document.getElementById('dd-error').textContent = 'This Action was not found, or you do not have access to it.';
      } else {
        document.getElementById('dd-error').style.display = 'block';
        document.getElementById('dd-error').textContent = `Could not load this Action: ${e.message}`;
      }
    }
  }

  async function loadFreshness() {
    try {
      const proj = await DW.Api.getAction(actionId);
      const el = document.getElementById('dd-freshness');
      if (proj.ok && proj.action) el.innerHTML = `<span class="muted-note">Projection last refreshed ${DW.escapeHtml(DW.formatDateTime(proj.action.projected_at))}</span>`;
      else el.innerHTML = `<span class="badge badge-warn">Not yet indexed in the projection layer</span>`;
    } catch (_) { /* freshness is a courtesy note, never blocking */ }
  }

  function textOrDash(v) { return v ? DW.escapeHtml(v) : '—'; }

  function renderDetail(action) {
    document.getElementById('dd-title').textContent = action.recommendation || '(no recommendation text)';
    const statusBadge = document.getElementById('dd-status-badge');
    statusBadge.className = `badge ${DW.statusBadgeClass(action.status)}`;
    statusBadge.textContent = DW.statusLabel(action.status);
    const priorityBadge = document.getElementById('dd-priority-badge');
    priorityBadge.className = `badge ${DW.priorityBadgeClass(action.priority)}`;
    priorityBadge.textContent = `Priority: ${action.priority || 'medium'}`;
    const riskBadge = document.getElementById('dd-risk-badge');
    if (action.risk_level) { riskBadge.style.display = 'inline-flex'; riskBadge.className = `badge ${DW.riskBadgeClass(action.risk_level)}`; riskBadge.textContent = `Risk: ${action.risk_level}`; } else riskBadge.style.display = 'none';
    document.getElementById('dd-overdue-badge').style.display = action.overdue_since ? 'inline-flex' : 'none';
    document.getElementById('dd-escalated-badge').style.display = action.escalated_since ? 'inline-flex' : 'none';
    document.getElementById('dd-legacy-badge').style.display = DW.ACTION_STATUSES.includes(action.status) ? 'none' : 'inline-flex';

    document.getElementById('dd-project').textContent = action.project_id || '—';
    document.getElementById('dd-report').textContent = action.report_id || '—';
    const ownerText = DW.ownerDisplay(action);
    document.getElementById('dd-owner').textContent = ownerText;
    document.getElementById('dd-owner-2').textContent = ownerText;
    document.getElementById('dd-department').textContent = action.department || '—';
    document.getElementById('dd-strategic-priority').textContent = action.strategic_priority || '—';
    document.getElementById('dd-progress').textContent = `${Number(action.progress_pct || 0)}%`;
    document.getElementById('dd-due-date').textContent = DW.formatDate(action.due_date);
    document.getElementById('dd-start-date').textContent = DW.formatDate(action.start_date);
    document.getElementById('dd-completion-date').textContent = DW.formatDate(action.completion_date);
    document.getElementById('dd-verification-status').textContent = action.verification_status || 'unverified';
    document.getElementById('dd-created').textContent = DW.formatDateTime(action.created_at);
    document.getElementById('dd-updated').textContent = DW.formatDateTime(action.updated_at);
    document.getElementById('dd-management-response').textContent = action.management_response || '—';
    document.getElementById('dd-expected-outcome').textContent = action.expected_outcome || '—';
    document.getElementById('dd-success-criteria').textContent = action.success_criteria || '—';
    document.getElementById('dd-monitoring-indicator').textContent = action.monitoring_indicator || '—';

    renderOperations(action);
    renderAssignmentProgress(action);
    renderEvidence(action);
  }

  // ---------- Lifecycle operations ----------
  function renderOperations(action) {
    const panel = document.getElementById('dd-op-panel');
    const nextStatuses = action.next_statuses || DW.nextStatusesFor(action.status);
    if (!nextStatuses.length) { panel.innerHTML = ''; document.getElementById('dd-op-none').style.display = 'block'; return; }
    document.getElementById('dd-op-none').style.display = 'none';
    panel.innerHTML = nextStatuses.map(to => {
      const permission = DW.requiredPermissionForTransition(action.status, to);
      const allowed = !permission || DW.roleHasPermission(role, permission);
      const cls = HIGH_IMPACT.has(to) || (to === 'in_progress' && action.status === 'completed') ? 'btn-danger' : 'btn-primary';
      return `<button class="btn ${cls} btn-sm" data-to="${DW.escapeHtml(to)}" ${allowed ? '' : 'disabled title="Your role does not have permission to make this transition"'}>${DW.escapeHtml(labelForTransition(action.status, to))}</button>`;
    }).join('');
    panel.querySelectorAll('button[data-to]:not([disabled])').forEach(btn => btn.addEventListener('click', () => openTransitionModal(btn.dataset.to)));
  }

  function openTransitionModal(toStatus) {
    const modal = document.getElementById('dd-transition-modal');
    const requiresReason = toStatus === 'in_progress' && current.status === 'completed';
    document.getElementById('dd-transition-modal-title').textContent = labelForTransition(current.status, toStatus);
    document.getElementById('dd-transition-modal-body').textContent = HIGH_IMPACT.has(toStatus)
      ? `This is a high-impact change. Confirm you want to move this Action from "${DW.statusLabel(current.status)}" to "${DW.statusLabel(toStatus)}".`
      : `Move this Action from "${DW.statusLabel(current.status)}" to "${DW.statusLabel(toStatus)}"?`;
    document.getElementById('dd-transition-reason').value = '';
    document.getElementById('dd-transition-reason-field').querySelector('label').textContent = requiresReason ? 'Reason (required — reopening a completed Action)' : 'Reason (optional)';
    document.getElementById('dd-transition-modal-error').style.display = 'none';
    modal.classList.add('open');
    modal.dataset.toStatus = toStatus;
    modal.dataset.requiresReason = requiresReason ? '1' : '';
    document.getElementById('dd-transition-reason').focus();
  }
  function closeTransitionModal() { document.getElementById('dd-transition-modal').classList.remove('open'); }
  document.getElementById('dd-transition-modal-close').addEventListener('click', closeTransitionModal);
  document.getElementById('dd-transition-cancel').addEventListener('click', closeTransitionModal);
  document.getElementById('dd-transition-modal').addEventListener('keydown', e => { if (e.key === 'Escape') closeTransitionModal(); });

  let transitionInFlight = false;
  document.getElementById('dd-transition-confirm').addEventListener('click', async () => {
    if (transitionInFlight) return;
    const modal = document.getElementById('dd-transition-modal');
    const toStatus = modal.dataset.toStatus;
    const reason = document.getElementById('dd-transition-reason').value.trim();
    const errEl = document.getElementById('dd-transition-modal-error');
    if (modal.dataset.requiresReason && !reason) { errEl.style.display = 'block'; errEl.textContent = 'A reason is required to reopen a completed Action.'; return; }
    transitionInFlight = true;
    const confirmBtn = document.getElementById('dd-transition-confirm'); confirmBtn.disabled = true;
    try {
      // Part 20 — re-check authoritative state immediately before mutating,
      // rather than trusting whatever was loaded when the page first opened.
      const fresh = await DW.Api.getActionDetail(actionId);
      if (fresh.action.updated_at !== current.updated_at) {
        current = fresh.action;
        closeTransitionModal();
        showStaleBanner();
        return;
      }
      await DW.Api.transitionAction(actionId, { to_status: toStatus, reason: reason || undefined });
      closeTransitionModal();
      showToast(`Action moved to ${DW.statusLabel(toStatus)}.`, 'success');
      await loadDetail(false);
    } catch (e) {
      errEl.style.display = 'block';
      errEl.textContent = /409|conflict/i.test(e.message) ? 'This Action changed before the transition could be applied. Refresh and try again.' : e.message;
    } finally {
      transitionInFlight = false; confirmBtn.disabled = false;
    }
  });

  function showStaleBanner() {
    if (staleWarningShown) return;
    staleWarningShown = true;
    document.getElementById('dd-stale-banner').style.display = 'flex';
  }
  document.getElementById('dd-refresh-btn').addEventListener('click', () => loadDetail(true));

  // ---------- Assignment & Progress ----------
  function renderAssignmentProgress(action) {
    const reassignBtn = document.getElementById('dd-reassign-btn');
    reassignBtn.style.display = canUpdate ? 'inline-flex' : 'none';
    const progressControl = document.getElementById('dd-progress-control');
    const terminal = action.status === 'verified' || action.status === 'cancelled';
    progressControl.style.display = (canUpdate && !terminal) ? 'block' : 'none';
    document.getElementById('dd-progress-input').value = action.progress_pct ?? 0;
    document.getElementById('dd-edit-btn').style.display = canUpdate ? 'inline-flex' : 'none';
  }
  // RC1 Part 2 — a real Sprint 2.1 UAT session reproduced a silent lost
  // update on this exact field (one user's progress edit overwritten by
  // another's, no warning either way). Every mutation below now sends the
  // `updated_at` it last loaded and treats a 409 the same way the governed
  // transition modal already does: stop, tell the user plainly, refresh.
  function handleConflict(e) {
    if (e.status === 409) { showStaleBanner(); loadDetail(false); return true; }
    return false;
  }
  document.getElementById('dd-progress-save').addEventListener('click', async () => {
    const value = Number(document.getElementById('dd-progress-input').value);
    if (!Number.isFinite(value) || value < 0 || value > 100) { showToast('Progress must be between 0 and 100.', 'error'); return; }
    try {
      await DW.Api.patchAction(actionId, { progress_pct: value, expected_updated_at: current.updated_at });
      showToast('Progress updated.', 'success');
      await loadDetail(false);
    } catch (e) {
      if (handleConflict(e)) return;
      showToast(`Could not update progress: ${e.message}`, 'error');
    }
  });

  // Reassign modal
  function openReassignModal() {
    document.getElementById('dd-reassign-input').value = current.owner || '';
    document.getElementById('dd-reassign-error').style.display = 'none';
    document.getElementById('dd-reassign-modal').classList.add('open');
  }
  function closeReassignModal() { document.getElementById('dd-reassign-modal').classList.remove('open'); }
  document.getElementById('dd-reassign-btn').addEventListener('click', openReassignModal);
  document.getElementById('dd-reassign-close').addEventListener('click', closeReassignModal);
  document.getElementById('dd-reassign-cancel').addEventListener('click', closeReassignModal);
  document.getElementById('dd-reassign-confirm').addEventListener('click', async () => {
    const newOwner = document.getElementById('dd-reassign-input').value.trim();
    const errEl = document.getElementById('dd-reassign-error');
    if (!newOwner) { errEl.style.display = 'block'; errEl.textContent = 'A user ID is required.'; return; }
    try {
      await DW.Api.patchAction(actionId, { owner: newOwner, expected_updated_at: current.updated_at });
      closeReassignModal();
      const canAssignNext = current.status === 'approved' && (current.next_statuses || []).includes('assigned') && DW.roleHasPermission(role, 'action.assign');
      if (canAssignNext) {
        showToast('Owner updated. Opening the Assign transition…', 'success');
        await loadDetail(false);
        openTransitionModal('assigned');
      } else {
        showToast('Owner updated.', 'success');
        await loadDetail(false);
      }
    } catch (e) {
      if (e.status === 409) { closeReassignModal(); handleConflict(e); return; }
      errEl.style.display = 'block'; errEl.textContent = e.message;
    }
  });

  // ---------- Evidence ----------
  function renderEvidence(action) {
    const list = document.getElementById('dd-evidence-list');
    const evidence = action.evidence_after || [];
    document.getElementById('dd-evidence-empty').style.display = evidence.length ? 'none' : 'block';
    list.innerHTML = evidence.map(ev => {
      const href = ev.url ? DW.safeHref(ev.url) : null;
      return `<div class="dw-evidence-item">
        <div><p style="margin:0 0 .3em; font-size:.88rem;">${DW.escapeHtml(ev.description || '(no description)')}</p>
        ${href ? `<a href="${DW.escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="muted-note">${DW.escapeHtml(href)}</a>` : ''}</div>
        <span class="muted-note" style="white-space:nowrap;">${DW.escapeHtml(DW.formatDateTime(ev.added_at))}</span>
      </div>`;
    }).join('');
    document.getElementById('dd-add-evidence-btn').style.display = canProgress ? 'inline-flex' : 'none';
  }
  function openEvidenceModal() {
    document.getElementById('dd-evidence-description').value = '';
    document.getElementById('dd-evidence-url').value = '';
    document.getElementById('dd-evidence-error').style.display = 'none';
    document.getElementById('dd-evidence-modal').classList.add('open');
  }
  function closeEvidenceModal() { document.getElementById('dd-evidence-modal').classList.remove('open'); }
  document.getElementById('dd-add-evidence-btn').addEventListener('click', openEvidenceModal);
  document.getElementById('dd-evidence-close').addEventListener('click', closeEvidenceModal);
  document.getElementById('dd-evidence-cancel').addEventListener('click', closeEvidenceModal);
  document.getElementById('dd-evidence-confirm').addEventListener('click', async () => {
    const description = document.getElementById('dd-evidence-description').value.trim();
    const url = document.getElementById('dd-evidence-url').value.trim();
    const errEl = document.getElementById('dd-evidence-error');
    if (!description && !url) { errEl.style.display = 'block'; errEl.textContent = 'A description or URL is required.'; return; }
    if (url && !DW.safeHref(url)) { errEl.style.display = 'block'; errEl.textContent = 'Only http(s) URLs are supported.'; return; }
    try {
      await DW.Api.addEvidence(actionId, { description: description || undefined, url: url || undefined, expected_updated_at: current.updated_at });
      closeEvidenceModal();
      showToast('Evidence added.', 'success');
      await loadDetail(false);
    } catch (e) {
      if (e.status === 409) { closeEvidenceModal(); handleConflict(e); return; }
      errEl.style.display = 'block'; errEl.textContent = e.message;
    }
  });

  // ---------- Edit Details ----------
  function openEditModal() {
    const a = current;
    document.getElementById('dd-edit-department').value = a.department || '';
    document.getElementById('dd-edit-priority').value = (a.priority || 'medium').toLowerCase();
    document.getElementById('dd-edit-strategic-priority').value = a.strategic_priority || '';
    document.getElementById('dd-edit-risk').value = a.risk_level || '';
    document.getElementById('dd-edit-due-date').value = (a.due_date || '').slice(0, 10);
    document.getElementById('dd-edit-start-date').value = (a.start_date || '').slice(0, 10);
    document.getElementById('dd-edit-budget-estimated').value = a.budget_estimated ?? '';
    document.getElementById('dd-edit-budget-actual').value = a.budget_actual ?? '';
    document.getElementById('dd-edit-expected-outcome').value = a.expected_outcome || '';
    document.getElementById('dd-edit-success-criteria').value = a.success_criteria || '';
    document.getElementById('dd-edit-monitoring-indicator').value = a.monitoring_indicator || '';
    document.getElementById('dd-edit-error').style.display = 'none';
    document.getElementById('dd-edit-modal').classList.add('open');
  }
  function closeEditModal() { document.getElementById('dd-edit-modal').classList.remove('open'); }
  document.getElementById('dd-edit-btn').addEventListener('click', openEditModal);
  document.getElementById('dd-edit-close').addEventListener('click', closeEditModal);
  document.getElementById('dd-edit-cancel').addEventListener('click', closeEditModal);
  document.getElementById('dd-edit-save').addEventListener('click', async () => {
    const body = {
      department: document.getElementById('dd-edit-department').value.trim() || undefined,
      priority: document.getElementById('dd-edit-priority').value,
      strategic_priority: document.getElementById('dd-edit-strategic-priority').value.trim() || undefined,
      risk_level: document.getElementById('dd-edit-risk').value || undefined,
      due_date: document.getElementById('dd-edit-due-date').value || undefined,
      start_date: document.getElementById('dd-edit-start-date').value || undefined,
      budget_estimated: document.getElementById('dd-edit-budget-estimated').value ? Number(document.getElementById('dd-edit-budget-estimated').value) : undefined,
      budget_actual: document.getElementById('dd-edit-budget-actual').value ? Number(document.getElementById('dd-edit-budget-actual').value) : undefined,
      expected_outcome: document.getElementById('dd-edit-expected-outcome').value.trim() || undefined,
      success_criteria: document.getElementById('dd-edit-success-criteria').value.trim() || undefined,
      monitoring_indicator: document.getElementById('dd-edit-monitoring-indicator').value.trim() || undefined,
      expected_updated_at: current.updated_at,
    };
    try {
      await DW.Api.patchAction(actionId, body);
      closeEditModal();
      showToast('Action details updated.', 'success');
      await loadDetail(false);
    } catch (e) {
      if (e.status === 409) { closeEditModal(); handleConflict(e); return; }
      document.getElementById('dd-edit-error').style.display = 'block'; document.getElementById('dd-edit-error').textContent = e.message;
    }
  });

  // ---------- Timeline ----------
  const HISTORY_TYPE_LABEL = { status: 'Status Change', assignment: 'Assignment', review: 'Review', evidence: 'Evidence Added', verification: 'Verification' };
  async function loadTimeline() {
    document.getElementById('dd-timeline-loading').style.display = 'block';
    document.getElementById('dd-timeline-error').style.display = 'none';
    document.getElementById('dd-timeline-empty').style.display = 'none';
    document.getElementById('dd-timeline').style.display = 'none';
    try {
      const { history } = await DW.Api.getActionHistory(actionId);
      document.getElementById('dd-timeline-loading').style.display = 'none';
      if (!history.length) { document.getElementById('dd-timeline-empty').style.display = 'block'; return; }
      const el = document.getElementById('dd-timeline');
      el.innerHTML = history.map(h => {
        const actorText = h.source === 'system' ? 'System' : (h.actor_role ? `${DW.escapeHtml(h.actor_role)}${h.actor_id ? ` (${DW.escapeHtml(h.actor_id.slice(0, 12))}…)` : ''}` : 'Unknown actor');
        const change = (h.from_value || h.to_value) ? `${h.from_value ? DW.escapeHtml(DW.statusLabel(h.from_value)) : '—'} → ${h.to_value ? DW.escapeHtml(DW.statusLabel(h.to_value)) : '—'}` : '';
        return `<div class="timeline-item">
          <div class="timeline-date">${DW.escapeHtml(DW.formatDateTime(h.created_at))}</div>
          <div class="timeline-title">${DW.escapeHtml(HISTORY_TYPE_LABEL[h.history_type] || h.history_type)}${change ? ': ' + change : ''}</div>
          <div class="muted-note" style="font-size:.8rem;">${actorText}${h.reason ? ' — ' + DW.escapeHtml(h.reason) : ''}</div>
        </div>`;
      }).join('');
      el.style.display = 'block';
    } catch (e) {
      document.getElementById('dd-timeline-loading').style.display = 'none';
      document.getElementById('dd-timeline-error').style.display = 'block';
      document.getElementById('dd-timeline-error').textContent = `Could not load history: ${e.message}`;
    }
  }

  loadDetail(true);
})();
