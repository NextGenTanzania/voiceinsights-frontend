/* VoiceInsights Africa — Create Action page controller (decision-create.html)
   Program Beta Sprint 2. */
(function () {
  'use strict';
  if (!requireLogin()) return;

  const storedUser = JSON.parse(localStorage.getItem('vi_user') || 'null');
  const role = storedUser?.role || '';

  renderShell({ role: 'client', active: '/app/decisions.html', eyebrow: 'Decision Workspace', title: 'New Action', breadcrumb: [{ href: '/app/decisions.html', label: 'Decision Workspace' }, { label: 'New Action' }] });

  if (!DW.roleHasPermission(role, 'action.create')) {
    document.getElementById('dc-denied').style.display = 'flex';
    return;
  }
  document.getElementById('dc-form').style.display = 'block';

  // ---------- Unsaved-changes warning ----------
  let dirty = false;
  document.getElementById('dc-form').addEventListener('input', () => { dirty = true; });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.getElementById('dc-cancel-btn').addEventListener('click', () => {
    if (dirty && !confirm('Discard this unsaved Action?')) return;
    location.href = '/app/decisions.html';
  });

  function clearFieldErrors() {
    ['recommendation', 'project', 'owner', 'due'].forEach(k => { const el = document.getElementById(`dc-err-${k}`); if (el) el.style.display = 'none'; });
    document.getElementById('dc-submit-error').style.display = 'none';
  }

  // Mirrors validateActionCreate()'s real backend rules (international-
  // programme-lifecycle.js) so the user sees the same errors before
  // submitting, not just after a round trip.
  function validate() {
    clearFieldErrors();
    let ok = true;
    if (!document.getElementById('dc-recommendation').value.trim()) { document.getElementById('dc-err-recommendation').style.display = 'block'; ok = false; }
    if (!document.getElementById('dc-project-id').value.trim()) { document.getElementById('dc-err-project').style.display = 'block'; ok = false; }
    if (!document.getElementById('dc-owner').value.trim()) { document.getElementById('dc-err-owner').style.display = 'block'; ok = false; }
    if (!document.getElementById('dc-due-date').value) { document.getElementById('dc-err-due').style.display = 'block'; ok = false; }
    return ok;
  }

  let submitting = false;
  document.getElementById('dc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    submitting = true;
    const btn = document.getElementById('dc-submit-btn');
    btn.disabled = true; btn.textContent = 'Creating…';
    const dependenciesRaw = document.getElementById('dc-dependencies').value.split('\n').map(s => s.trim()).filter(Boolean);
    const body = {
      recommendation: document.getElementById('dc-recommendation').value.trim(),
      project_id: document.getElementById('dc-project-id').value.trim(),
      owner: document.getElementById('dc-owner').value.trim(),
      due_date: document.getElementById('dc-due-date').value,
      start_date: document.getElementById('dc-start-date').value || undefined,
      department: document.getElementById('dc-department').value.trim() || undefined,
      priority: document.getElementById('dc-priority').value,
      strategic_priority: document.getElementById('dc-strategic-priority').value.trim() || undefined,
      risk_level: document.getElementById('dc-risk').value || undefined,
      budget_estimated: document.getElementById('dc-budget-estimated').value ? Number(document.getElementById('dc-budget-estimated').value) : undefined,
      monitoring_indicator: document.getElementById('dc-monitoring-indicator').value.trim() || undefined,
      management_response: document.getElementById('dc-management-response').value.trim() || undefined,
      expected_outcome: document.getElementById('dc-expected-outcome').value.trim() || undefined,
      success_criteria: document.getElementById('dc-success-criteria').value.trim() || undefined,
      dependencies: dependenciesRaw.length ? dependenciesRaw : undefined,
    };
    try {
      const result = await DW.Api.createAction(body);
      dirty = false;
      location.href = `/app/decision-detail.html?id=${encodeURIComponent(result.id)}`;
    } catch (err) {
      const errEl = document.getElementById('dc-submit-error');
      errEl.style.display = 'block';
      errEl.textContent = err.message || 'Could not create this Action.';
      submitting = false; btn.disabled = false; btn.textContent = 'Create Action';
    }
  });
})();
