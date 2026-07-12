# v210.3A — Identity & Access

Implements the first security block for VoiceInsights Cloud:

- Enterprise IAM permission matrix
- TOTP MFA enrollment and verification
- SSO configuration for Microsoft Entra, Google Workspace, Okta, Auth0 and OIDC
- SCIM provisioning token and endpoint contract
- Scoped, hashed API keys shown only once
- Organization isolation and role-gated APIs

## New pages
- `/admin/security/identity-access-center.html`
- `/app/security/mfa.html`
- `/app/security/sso.html`
- `/app/security/scim.html`
- `/app/security/api-keys.html`

## New API routes
- `GET /api/security/v2103a/iam/overview`
- `POST /api/security/v2103a/mfa/enroll`
- `POST /api/security/v2103a/mfa/verify`
- `POST /api/security/v2103a/sso/configure`
- `POST /api/security/v2103a/scim/token`
- `GET|POST /api/security/v2103a/api-keys`
