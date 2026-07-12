# V213 — Critical Security Remediation (2026-07-11)

- CRIT-1 FIXED: every inbound + callback Twilio webhook now signature-verified (constant-time) before any handler runs, via centralized `src/twilio-security.js` — URL reconstruction, replay protection (twilio_event_registry), redacted audit on failure, fails closed without TWILIO_AUTH_TOKEN. No DB write on failed verification.
- HIGH-3 FIXED: real server-side logout/revocation. New `src/session-registry.js`, tokens carry a hashed session id, requireAuth rejects revoked sessions. Endpoints: /api/auth/logout, /api/auth/logout-all, /api/auth/sessions (GET), /api/auth/sessions/:id (DELETE). Password reset revokes all sessions. Client logout() now calls the server. Backward compatible with pre tokens.
- Added: GET /api/ops/production-readiness (real binding/secret check, honest labels, launch blockers vs optional).
- Migration 031_security_hardening.sql: user_sessions, twilio_event_registry, security_audit_log.
- wrangler.toml: TWILIO_PUBLIC_BASE_URL var.
- Tests: +17 (security-remediation.test.js). Suite 491/491.
- Docs: docs/REMEDIATION.md (matrix + honest two-score verdict: CONTROLLED PILOT).

# V212 — Security Hardening & Maintainability (2026-07-11)

- CORS: wildcard `*` replaced with an origin allowlist (`security-layer.js`; new `ALLOWED_ORIGINS` + `STRICT_CORS` vars).
- Auth: `?token=` query-string tokens restricted to `/api/audio|photos|documents/` only.
- Site: security headers added site-wide (`headers`): CSP (script-src locked to self + unpkg + jsdelivr), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy. Zero visual change.
- TD-001 closed: operational log retention cleanup on every Cron tick.
- Refactor: `index.js` 7,319 → 5,947 lines; extracted `request-scope.js`, `notifications.js`, `channel-pipeline.js`, `billing-export.js`, `ops-cron.js`. Behavior unchanged.
- Docs: `docs/ARCHITECTURE_MAP.md` (module map + all 258 routes with line numbers), `docs/SECURITY_HARDENING.md`.
- Tests: +18 (`security-hardening.test.js`) — suite now 474/474 passing.

# Changelog

## v210 — VoiceInsights Cloud™
- Added VoiceInsights Cloud architecture module.
- Added 18 cloud platform modules.
- Added Automation Hub, Marketplace Layer and Cloud Event Bus.
- Added `/api/voiceinsights-cloud`.
- Added `/app/voiceinsights-cloud.html`.


## v210.1 — Executive Governance & Operations Control

- Added Founder-controlled Operations Manager appointment model.
- Founder can invite, replace, suspend, remove or transfer the Operations Manager role.
- Operations Manager cannot invite another Operations Manager or change executive governance.
- Executive Lock now protects Operations Manager lifecycle actions.
- Founder Dashboard includes Operations Manager control card.
- Operations Manager Dashboard clarifies its limits and daily operating role.
- Added governance implementation document: `docs/archive/executive-governance-operations-control.md`.

## v210.3A — Identity & Access
- Added enterprise IAM permission matrix and Executive Lock visibility.
- Added working TOTP MFA enrollment and verification contracts.
- Added SSO configuration storage for Entra, Google Workspace, Okta, Auth0 and OIDC.
- Added SCIM provisioning token lifecycle contract.
- Added hashed, scoped, organization-bound API keys shown once.
- Added Identity & Access Center and responsive security pages.


## v210.6
- Added Developer Portal and API Playground.
- Added OpenAPI 3.1 contract and SDK documentation.
- Added authentication and rate-limit guidance.
- Connected scoped API key inventory from v210.3A.

## v210.7 — Marketplace
- Added survey templates, AI prompts, dashboards, widgets, connectors and report products.
- Added organization-scoped marketplace installation registry.
- Added Marketplace UI and protected APIs.

## External Assurance & Live Acceptance
- Added external assurance evidence registry.
- Added SSO live-test plans for Entra ID, Google Workspace and Okta.
- Added SCIM lifecycle validation for create/update/suspend/restore.
- Added MFA recovery and privileged-action challenge evaluation.
- Added client journey acceptance recording from Demo to Campaign.
- Added independent penetration-test and SOC 2/ISO evidence tracking without certification claims.
