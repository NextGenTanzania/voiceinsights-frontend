// VoiceInsights Cloud v210.1 — Executive Governance & Operations Control
// Founder-controlled governance for early-stage enterprise delivery.

export const V210_GOVERNANCE_VERSION = 'v210.1-executive-governance-operations-control';

export const GOVERNANCE_ROLES = Object.freeze({
  FOUNDER_EXECUTIVE: 'founder_executive',
  OPERATIONS_MANAGER: 'operations_manager',
  ORGANIZATION_ADMIN: 'organization_admin',
  ME_OFFICER: 'me_officer',
  DATA_ANALYST: 'data_analyst',
  ENUMERATOR: 'enumerator',
  INTERNAL_STAFF: 'internal_staff',
  SUPER_ADMIN: 'super_admin'
});

export const EXECUTIVE_LOCKED_ACTIONS = Object.freeze([
  'create_organization',
  'delete_organization',
  'suspend_organization',
  'activate_enterprise_license',
  'change_billing_plan',
  'platform_ai_settings',
  'platform_cloud_settings',
  'export_all_organization_data',
  'invite_operations_manager',
  'replace_operations_manager',
  'remove_operations_manager',
  'suspend_operations_manager',
  'transfer_operations_manager_role'
]);

export const OPERATIONS_MANAGER_LIFECYCLE_ACTIONS = Object.freeze([
  'invite_operations_manager',
  'replace_operations_manager',
  'remove_operations_manager',
  'suspend_operations_manager',
  'transfer_operations_manager_role'
]);

export function canManageOperationsManager(role) {
  return [GOVERNANCE_ROLES.FOUNDER_EXECUTIVE, GOVERNANCE_ROLES.SUPER_ADMIN].includes(String(role || '').trim());
}

export function canInvite(inviterRole, targetRole) {
  const role = String(inviterRole || '').trim();
  const target = String(targetRole || '').trim();
  if (role === GOVERNANCE_ROLES.FOUNDER_EXECUTIVE || role === GOVERNANCE_ROLES.SUPER_ADMIN) {
    return [
      GOVERNANCE_ROLES.OPERATIONS_MANAGER,
      GOVERNANCE_ROLES.ORGANIZATION_ADMIN,
      GOVERNANCE_ROLES.INTERNAL_STAFF,
      GOVERNANCE_ROLES.ME_OFFICER,
      GOVERNANCE_ROLES.DATA_ANALYST,
      GOVERNANCE_ROLES.ENUMERATOR,
      GOVERNANCE_ROLES.SUPER_ADMIN
    ].includes(target);
  }
  if (role === GOVERNANCE_ROLES.OPERATIONS_MANAGER) {
    return [
      GOVERNANCE_ROLES.ORGANIZATION_ADMIN,
      GOVERNANCE_ROLES.ME_OFFICER,
      GOVERNANCE_ROLES.DATA_ANALYST,
      GOVERNANCE_ROLES.ENUMERATOR
    ].includes(target);
  }
  if (role === GOVERNANCE_ROLES.ORGANIZATION_ADMIN) {
    return [
      GOVERNANCE_ROLES.ME_OFFICER,
      GOVERNANCE_ROLES.DATA_ANALYST,
      GOVERNANCE_ROLES.ENUMERATOR
    ].includes(target);
  }
  return false;
}

export function requiresExecutiveLock(action) {
  return EXECUTIVE_LOCKED_ACTIONS.includes(String(action || '').trim());
}

export function canPerformGovernanceAction(role, action) {
  const r = String(role || '').trim();
  const a = String(action || '').trim();
  if (requiresExecutiveLock(a)) {
    return r === GOVERNANCE_ROLES.FOUNDER_EXECUTIVE || r === GOVERNANCE_ROLES.SUPER_ADMIN;
  }
  if (r === GOVERNANCE_ROLES.FOUNDER_EXECUTIVE || r === GOVERNANCE_ROLES.SUPER_ADMIN) return true;
  if (r === GOVERNANCE_ROLES.OPERATIONS_MANAGER) {
    return [
      'receive_demo_request',
      'contact_client',
      'schedule_meeting',
      'create_client_record',
      'upload_proposal',
      'upload_contract',
      'upload_invoice',
      'submit_for_approval',
      'invite_organization_users',
      'manage_projects',
      'assign_me_officer',
      'assign_enumerators',
      'monitor_campaigns'
    ].includes(a);
  }
  return false;
}

export function buildExecutiveApprovalRequest(input = {}) {
  const now = input.requested_at || new Date().toISOString();
  return {
    id: input.id || `approval_${Math.random().toString(36).slice(2, 10)}`,
    type: input.type || 'client_activation',
    status: 'awaiting_executive_approval',
    requested_by: input.requested_by || 'operations_manager',
    requested_at: now,
    client: {
      organization_name: input.organization_name || input.client_name || 'New Client',
      contact_person: input.contact_person || 'Client Contact',
      sector: input.sector || 'General',
      country: input.country || 'Tanzania'
    },
    commercial: {
      project_name: input.project_name || 'New Project',
      value: input.value || null,
      currency: input.currency || 'USD',
      contract_uploaded: Boolean(input.contract_uploaded),
      invoice_uploaded: Boolean(input.invoice_uploaded),
      payment_status: input.payment_status || 'pending_verification'
    },
    executive_decision: {
      required_role: GOVERNANCE_ROLES.FOUNDER_EXECUTIVE,
      actions: ['approve', 'reject', 'request_changes'],
      lock_reason: 'New client and project activation require Founder authorization.'
    }
  };
}

export function approveExecutiveRequest(request = {}, approvedBy = GOVERNANCE_ROLES.FOUNDER_EXECUTIVE) {
  if (![GOVERNANCE_ROLES.FOUNDER_EXECUTIVE, GOVERNANCE_ROLES.SUPER_ADMIN].includes(approvedBy)) {
    return { ok: false, status: 'rejected_by_policy', message: 'Only Founder / Executive can approve this request.' };
  }
  return {
    ok: true,
    status: 'approved',
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
    cloud_actions: [
      'create_organization',
      'create_project_workspace',
      'assign_operations_manager',
      'enable_invites',
      'notify_operations_manager',
      'mark_project_ready_to_start'
    ],
    source_request_id: request.id || null
  };
}

export function buildOperationsManagerAppointment(input = {}) {
  const action = input.action || (input.current_manager_email ? 'replace_operations_manager' : 'invite_operations_manager');
  const now = input.requested_at || new Date().toISOString();
  return {
    id: input.id || `ops_manager_${Math.random().toString(36).slice(2, 10)}`,
    version: V210_GOVERNANCE_VERSION,
    action,
    status: 'founder_controlled',
    requested_at: now,
    current_manager: input.current_manager_email ? {
      name: input.current_manager_name || 'Current Operations Manager',
      email: input.current_manager_email,
      transition: action === 'replace_operations_manager' ? 'downgrade_after_new_acceptance' : 'none'
    } : null,
    new_manager: {
      name: input.new_manager_name || 'New Operations Manager',
      email: input.new_manager_email || 'operations@example.com',
      role: GOVERNANCE_ROLES.OPERATIONS_MANAGER,
      invite_required: true,
      activation_condition: 'New Operations Manager accepts invitation'
    },
    founder_only: true,
    blocked_for_operations_manager: true,
    audit_events: [
      'operations_manager_invite_created',
      'new_manager_acceptance_required',
      'old_manager_downgrade_scheduled',
      'founder_notification_required'
    ]
  };
}

export function executeOperationsManagerAppointment(appointment = {}, actorRole = GOVERNANCE_ROLES.FOUNDER_EXECUTIVE) {
  if (!canManageOperationsManager(actorRole)) {
    return { ok: false, status: 'rejected_by_policy', message: 'Only Founder / Executive can appoint, replace, suspend or remove Operations Manager.' };
  }
  return {
    ok: true,
    status: 'operations_manager_appointment_authorized',
    authorized_by: actorRole,
    authorized_at: new Date().toISOString(),
    source_appointment_id: appointment.id || null,
    cloud_actions: [
      'send_operations_manager_invitation',
      'wait_for_invite_acceptance',
      'activate_new_operations_manager_role',
      appointment.current_manager ? 'downgrade_previous_operations_manager' : 'record_first_operations_manager',
      'write_governance_audit_log',
      'notify_founder',
      'notify_operations_manager'
    ].filter(Boolean)
  };
}

export function buildFounderDashboardSnapshot(data = {}) {
  const pending = data.pending_approvals ?? 0;
  const invites = data.recent_invites ?? 0;
  const orgs = data.new_organizations ?? 0;
  const projects = data.projects_starting_today ?? 0;
  const currentOps = data.current_operations_manager || { name: 'Not assigned', email: null, status: 'not_assigned' };
  return {
    title: 'Founder Dashboard™',
    cards: [
      { label: 'Pending Approvals', value: pending, action: 'Review requests' },
      { label: 'Recent Invites', value: invites, action: 'View invite activity' },
      { label: 'New Organizations', value: orgs, action: 'Open organizations' },
      { label: 'Projects Starting Today', value: projects, action: 'Review delivery plan' },
      { label: 'Operations Manager', value: currentOps.name, action: 'Invite, replace, suspend or remove Operations Manager', status: currentOps.status || 'active' }
    ],
    operations_manager_control: {
      founder_can_invite: true,
      founder_can_replace: true,
      founder_can_suspend: true,
      founder_can_remove: true,
      operations_manager_can_invite_peer: false,
      single_manager_default: true,
      actions: ['invite_operations_manager', 'replace_operations_manager', 'suspend_operations_manager', 'remove_operations_manager']
    },
    executive_lock: EXECUTIVE_LOCKED_ACTIONS,
    governance_principle: 'Operations Manager prepares. Founder appoints and authorizes. VoiceInsights Cloud executes.'
  };
}

export function buildOperationsManagerWorkspace(data = {}) {
  return {
    title: 'Operations Manager Workspace',
    mission: 'Prepare client engagements and submit them for Founder approval.',
    appointment_rule: 'Operations Manager is appointed by Founder and cannot create, replace or remove another Operations Manager.',
    quick_actions: [
      'Receive Demo Request',
      'Create Client Record',
      'Upload Proposal',
      'Upload Contract',
      'Upload Invoice',
      'Submit for Approval',
      'Invite Organization Users',
      'Monitor Campaigns'
    ],
    permissions: {
      can_approve_organization: false,
      can_delete_organization: false,
      can_change_cloud_settings: false,
      can_change_ai_settings: false,
      can_suspend_platform: false,
      can_invite_operations_manager: false,
      can_replace_operations_manager: false,
      can_remove_operations_manager: false
    },
    pipeline: data.pipeline || [
      'Demo Request',
      'Meeting',
      'Proposal',
      'Contract',
      'Invoice',
      'Submit for Approval',
      'Founder Approval',
      'Project Starts'
    ]
  };
}

export function buildGovernanceImplementationPackage() {
  return {
    version: V210_GOVERNANCE_VERSION,
    release_name: 'v210.1 — Executive Governance & Operations Control',
    positioning: 'Founder-light governance for early enterprise delivery with Founder-controlled Operations Manager appointment.',
    workflow: [
      'Website Request Demo',
      'Operations Manager prepares client record',
      'Proposal, contract and invoice attached',
      'Submit for Approval',
      'Founder Approve / Reject',
      'VoiceInsights Cloud creates organization and project workspace',
      'Operations Manager invites organization users',
      'Project starts'
    ],
    founder_dashboard: buildFounderDashboardSnapshot({ pending_approvals: 2, recent_invites: 5, new_organizations: 1, projects_starting_today: 3, current_operations_manager: { name: 'Operations Manager', email: 'operations@voiceinsightsafrica.com', status: 'active' } }),
    operations_manager_workspace: buildOperationsManagerWorkspace(),
    operations_manager_governance: {
      appointment_owner: 'Founder / Executive only',
      founder_can: ['Invite Operations Manager', 'Replace Operations Manager', 'Suspend Operations Manager', 'Remove Operations Manager', 'Transfer Operations Manager role'],
      operations_manager_cannot: ['Invite Founder', 'Invite another Operations Manager', 'Replace Founder', 'Remove Founder', 'Change Executive Lock', 'Create another Operations Manager'],
      replacement_flow: [
        'Founder opens Operations Manager card',
        'Founder clicks Replace',
        'Founder enters new manager details',
        'Cloud sends invite',
        'New manager accepts',
        'Old manager is automatically downgraded or disabled according to Founder choice',
        'Audit log saved and notifications sent'
      ]
    },
    invite_governance: {
      founder_can_invite: ['Operations Manager', 'Organization Admin', 'Super Admin', 'Internal Staff'],
      operations_manager_can_invite: ['Organization Admin', 'M&E Officer', 'Data Analyst', 'Enumerator'],
      organization_admin_can_invite: ['M&E Officer', 'Data Analyst', 'Enumerator'],
      operations_manager_org_admin_invite_rule: 'Notify Founder, approval not required.',
      operations_manager_peer_invite_rule: 'Blocked. Only Founder can invite or replace Operations Manager.'
    },
    executive_lock: EXECUTIVE_LOCKED_ACTIONS
  };
}
