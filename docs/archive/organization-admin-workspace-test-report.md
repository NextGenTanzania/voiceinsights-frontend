# v207B — Organization Admin Workspace Report

## Summary
v207B adds an organization-scoped enterprise workspace for Organization Admin users such as Heads of Programs, Managing Directors and Project Managers.

## Scope
- Organization Home
- Program Management
- Publication Center
- Team & Permissions
- Branding Center
- Organization AI Insights
- Client Success & Procurement
- Role-scoped API route
- Frontend workspace page

## Safety
- Does not redesign homepage
- Does not change auth model
- Does not change database schema
- Does not replace Super Admin, M&E or Enumerator dashboards
- Enforces organization-scoped access through authenticated roles

## Deploy
Deploy backend, then upload the site folder.
