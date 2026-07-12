# V210 Executive Governance Implementation

## Purpose
This release turns the governance model into a practical implementation layer for the first stage of VoiceInsights Africa business operations.

The principle is simple:

**Operations Manager prepares. Founder authorizes. VoiceInsights Cloud executes.**

## Founder / Executive
The Founder is the final business authority.

Can:
- Approve Client
- Create Organization
- Invite Organization Admin
- Invite Operations Manager
- View all Organizations
- Approve Project Activation
- Suspend Organization
- View Revenue Dashboard
- Platform Settings
- AI/System Settings
- Security & Audit

## Operations Manager
The Operations Manager runs daily delivery preparation.

Can:
- Receive Demo Requests
- Contact Clients
- Schedule Meetings
- Create Client Record
- Upload Proposal
- Upload Contract
- Upload Invoice
- Submit for Approval
- Invite Organization Users after project approval
- Manage Projects
- Assign M&E
- Assign Enumerators
- Monitor Campaigns

Cannot:
- Approve Organization
- Delete Organization
- Change Cloud Settings
- Change AI Settings
- Suspend Platform

## Workflow
Website Request Demo
→ Operations Manager
→ Meeting
→ Proposal
→ Contract
→ Invoice
→ Submit for Approval
→ Founder Approval
→ VoiceInsights Cloud
→ Create Organization
→ Operations Manager invites Organization Admin
→ Project Starts

## Invite Governance
Founder can invite:
- Operations Manager
- Organization Admin
- Super Admin if needed
- Internal Staff

Operations Manager can invite:
- Organization Admin
- M&E Officer
- Data Analyst
- Enumerator

Organization Admin can invite within their organization only:
- M&E Officer
- Data Analyst
- Enumerator

Operations Manager inviting an Organization Admin generates Founder notification, not approval.

## Founder Dashboard Cards
- Pending Approvals
- Recent Invites
- New Organizations
- Projects Starting Today

## Executive Lock
These actions require Founder / Executive authorization:
- Create Organization
- Delete Organization
- Suspend Organization
- Activate Enterprise License
- Change Billing Plan
- Platform-wide AI Settings
- Platform Cloud Settings
- Export all organization data

## Implementation Files
- `backend/src/governance-executive-approval.js`
- `backend/tests/governance-implementation.test.js`
- `site/admin/founder-dashboard-legacy.html`
- `site/admin/operations-manager-dashboard-legacy.html`

## Deployment
Deploy backend and upload the site folder as usual.

## Business Value
This keeps the business lean:
- No complex approval chain.
- Operations Manager handles preparation.
- Founder keeps final control.
- Cloud executes activation automatically.
