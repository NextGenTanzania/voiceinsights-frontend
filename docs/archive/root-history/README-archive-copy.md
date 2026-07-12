# VoiceInsights Africa v210.3B — Data Protection & Security Operations

This release extends v210.3A with five production security modules:

1. Audit Center
2. Secrets Manager metadata and rotation governance
3. Consent Vault
4. Encryption Center
5. Security Dashboard

## Production principles

- No plaintext secrets are stored in D1 or returned to the browser.
- Secret values remain in Cloudflare Secrets; the app stores metadata only.
- Audit metadata is sanitized and excludes tokens, passwords, authorization data, respondent answers, transcripts and phone/email fields.
- Consent records preserve channel, version, purpose, language, proof reference and withdrawal status.
- Security scores are calculated from measurable controls and risks rather than static labels.
- All security APIs are authenticated and tenant-scoped.

## New pages

- `/admin/security-dashboard.html`
- `/admin/security/audit-center.html`
- `/admin/security/secrets-manager.html`
- `/app/compliance/consent-vault.html`
- `/admin/security/encryption-center.html`

## New APIs

- `GET /api/security/v2103b/dashboard`
- `GET|POST /api/security/v2103b/audit-events`
- `GET|POST /api/security/v2103b/secrets`
- `GET|POST /api/security/v2103b/consents`
- `POST /api/security/v2103b/consents/:id/withdraw`
- `GET /api/security/v2103b/encryption`

## Verification

- Tests: 301/301 passing
- Worker import: OK
