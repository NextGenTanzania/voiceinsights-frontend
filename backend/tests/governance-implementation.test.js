import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOVERNANCE_ROLES,
  canInvite,
  requiresExecutiveLock,
  canPerformGovernanceAction,
  buildExecutiveApprovalRequest,
  approveExecutiveRequest,
  buildFounderDashboardSnapshot,
  buildOperationsManagerWorkspace,
  buildOperationsManagerAppointment,
  executeOperationsManagerAppointment,
  canManageOperationsManager,
  buildGovernanceImplementationPackage
} from '../src/governance-executive-approval.js';

test('Founder and Operations Manager invite permissions follow the agreed governance model', () => {
  assert.equal(canInvite(GOVERNANCE_ROLES.FOUNDER_EXECUTIVE, GOVERNANCE_ROLES.OPERATIONS_MANAGER), true);
  assert.equal(canInvite(GOVERNANCE_ROLES.OPERATIONS_MANAGER, GOVERNANCE_ROLES.ORGANIZATION_ADMIN), true);
  assert.equal(canInvite(GOVERNANCE_ROLES.OPERATIONS_MANAGER, GOVERNANCE_ROLES.FOUNDER_EXECUTIVE), false);
  assert.equal(canInvite(GOVERNANCE_ROLES.OPERATIONS_MANAGER, GOVERNANCE_ROLES.OPERATIONS_MANAGER), false);
  assert.equal(canInvite(GOVERNANCE_ROLES.ORGANIZATION_ADMIN, GOVERNANCE_ROLES.ENUMERATOR), true);
  assert.equal(canInvite(GOVERNANCE_ROLES.ENUMERATOR, GOVERNANCE_ROLES.ME_OFFICER), false);
});

test('Executive Lock protects high-risk platform actions', () => {
  assert.equal(requiresExecutiveLock('create_organization'), true);
  assert.equal(requiresExecutiveLock('platform_ai_settings'), true);
  assert.equal(canPerformGovernanceAction(GOVERNANCE_ROLES.OPERATIONS_MANAGER, 'create_organization'), false);
  assert.equal(canPerformGovernanceAction(GOVERNANCE_ROLES.FOUNDER_EXECUTIVE, 'create_organization'), true);
  assert.equal(canPerformGovernanceAction(GOVERNANCE_ROLES.OPERATIONS_MANAGER, 'submit_for_approval'), true);
  assert.equal(canPerformGovernanceAction(GOVERNANCE_ROLES.OPERATIONS_MANAGER, 'replace_operations_manager'), false);
  assert.equal(canPerformGovernanceAction(GOVERNANCE_ROLES.FOUNDER_EXECUTIVE, 'replace_operations_manager'), true);
});

test('Executive approval request and approval handoff create Cloud execution actions', () => {
  const request = buildExecutiveApprovalRequest({ organization_name: 'UNICEF', project_name: 'Health Baseline', contract_uploaded: true, invoice_uploaded: true });
  assert.equal(request.status, 'awaiting_executive_approval');
  assert.equal(request.executive_decision.required_role, GOVERNANCE_ROLES.FOUNDER_EXECUTIVE);
  const denied = approveExecutiveRequest(request, GOVERNANCE_ROLES.OPERATIONS_MANAGER);
  assert.equal(denied.ok, false);
  const approved = approveExecutiveRequest(request, GOVERNANCE_ROLES.FOUNDER_EXECUTIVE);
  assert.equal(approved.ok, true);
  assert.ok(approved.cloud_actions.includes('create_organization'));
  assert.ok(approved.cloud_actions.includes('create_project_workspace'));
});

test('Founder Dashboard and Operations Manager Workspace expose the requested cards and workflow', () => {
  const founder = buildFounderDashboardSnapshot({ pending_approvals: 2, recent_invites: 5, new_organizations: 1, projects_starting_today: 3 });
  assert.deepEqual(founder.cards.map(c => c.label), ['Pending Approvals', 'Recent Invites', 'New Organizations', 'Projects Starting Today', 'Operations Manager']);
  const ops = buildOperationsManagerWorkspace();
  assert.equal(ops.permissions.can_approve_organization, false);
  assert.equal(ops.permissions.can_invite_operations_manager, false);
  assert.equal(ops.permissions.can_replace_operations_manager, false);
  assert.ok(ops.quick_actions.includes('Submit for Approval'));
  assert.ok(ops.pipeline.includes('Founder Approval'));
});

test('Governance implementation package contains Founder, Operations Manager, invite governance and Executive Lock', () => {
  const pkg = buildGovernanceImplementationPackage();
  assert.equal(pkg.version, 'v210.1-executive-governance-operations-control');
  assert.ok(pkg.workflow.includes('Submit for Approval'));
  assert.ok(pkg.workflow.includes('Founder Approve / Reject'));
  assert.ok(pkg.executive_lock.includes('export_all_organization_data'));
  assert.equal(pkg.invite_governance.operations_manager_org_admin_invite_rule, 'Notify Founder, approval not required.');
  assert.equal(pkg.operations_manager_governance.appointment_owner, 'Founder / Executive only');
  assert.equal(pkg.invite_governance.operations_manager_peer_invite_rule, 'Blocked. Only Founder can invite or replace Operations Manager.');
});


test('Founder exclusively controls Operations Manager appointment and replacement', () => {
  assert.equal(canManageOperationsManager(GOVERNANCE_ROLES.FOUNDER_EXECUTIVE), true);
  assert.equal(canManageOperationsManager(GOVERNANCE_ROLES.OPERATIONS_MANAGER), false);
  const appointment = buildOperationsManagerAppointment({
    current_manager_email: 'old@voiceinsightsafrica.com',
    new_manager_name: 'New Ops Manager',
    new_manager_email: 'new@voiceinsightsafrica.com'
  });
  assert.equal(appointment.action, 'replace_operations_manager');
  assert.equal(appointment.founder_only, true);
  assert.equal(appointment.blocked_for_operations_manager, true);
  const denied = executeOperationsManagerAppointment(appointment, GOVERNANCE_ROLES.OPERATIONS_MANAGER);
  assert.equal(denied.ok, false);
  const approved = executeOperationsManagerAppointment(appointment, GOVERNANCE_ROLES.FOUNDER_EXECUTIVE);
  assert.equal(approved.ok, true);
  assert.ok(approved.cloud_actions.includes('send_operations_manager_invitation'));
  assert.ok(approved.cloud_actions.includes('downgrade_previous_operations_manager'));
});
