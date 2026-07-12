# Live Acceptance Checklist

A source-code pass is not a live-production pass. Record an evidence reference and reviewer for every item.

- Twilio signs and successfully reaches WhatsApp, SMS, Voice and delivery/status callbacks through the real public URL.
- Invalid, missing, modified and replayed Twilio requests cause no respondent or delivery-state write.
- Each Cloudflare Queue producer and consumer processes a real staging job; transient failures retry and terminal failures reach the DLQ.
- Manual DLQ replay is authorization-tested and audited.
- Logout, logout-all, password reset, suspension and organization deactivation invalidate active sessions.
- Microsoft Entra ID, Google Workspace and Okta complete live OIDC code-flow tests before their status is marked active.
- SCIM create, update, deactivate, reactivate, filtering and pagination pass against a live identity provider.
- Empty and adversarial datasets cannot publish AI findings; human approval is required for external high-risk outputs.
- Offline Android and iOS tests cover package expiry, interrupted interviews, media capture, duplicate sync, conflicts, merge and supervisor approval.
- WCAG automated checks and manual keyboard/screen-reader checks pass for the listed primary pages.
- CSP report-only telemetry is reviewed before enforcement.
- D1, R2, queue, Twilio, AI, export, sync, notification and authentication metrics show observed events rather than defaults.
- External penetration testing, statistical replication, privacy review and procurement due diligence are complete or explicitly recorded as dependencies.
