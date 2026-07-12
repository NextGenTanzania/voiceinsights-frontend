# VoiceInsights Africa — Enterprise Production Hardening

## What this remediation changes

This package hardens high-risk foundations without claiming that external systems have been live-certified.

- Twilio protection now covers the declared exact endpoints plus controlled Voice and Twilio callback route families. Signature validation remains centralized and occurs before business processing.
- Production environment validation fails closed when workload queue bindings are absent or demo/default tenant identifiers are configured.
- Cloudflare Queue transport is split into explicit workload bindings for AI, transcription, translation, WhatsApp, SMS, voice, reports, exports, notifications and offline synchronization.
- Queue processing no longer marks an unconfigured provider adapter as completed. Missing adapters become terminal, auditable failures and enter dead-letter handling.
- Methodology readiness uses four explicit states and cannot reach publication readiness without fieldwork, analysis and publication evidence.
- Offline packages, conflict review and double-entry comparison now have deterministic governed contracts.
- Operational metrics represent missing observations as unmeasured, not zero or healthy.
- CI helpers detect common production placeholders and basic WCAG structural failures.

## Required secrets

Use `wrangler secret put` for: `JWT_SECRET`, enabled AI-provider keys, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, Twilio sender numbers, and `RESEND_API_KEY`. SSO/SCIM secrets remain organization-specific and must be configured through the encrypted secret-vault workflow.

## Queue resources

Create the queues named in `backend/wrangler.toml` and the shared `voiceinsights-operations-dlq` before deployment. Bindings are configuration contracts; live operation must be verified in staging with provider adapters enabled.

## Deployment order

1. Back up D1 and record the deployed Worker revision.
2. Create queues and DLQ.
3. Apply migration `035_production_hardening.sql` in staging.
4. Configure secrets and non-demo production identifiers.
5. Run `npm test` and `npm run check:deploy` from `backend/`.
6. Deploy to staging and execute the live acceptance checklist.
7. Enable one producer/consumer workload at a time.
8. Promote only after queue, Twilio, session, evidence, export and tenant-isolation evidence is captured.

## Rollback

Disable new producers first, allow in-flight messages to drain or quarantine them, then restore the previous Worker deployment. Do not drop hardening tables during an emergency rollback. Retain audit, session, DLQ and conflict records. Restore producer traffic only after idempotency state has been checked.
