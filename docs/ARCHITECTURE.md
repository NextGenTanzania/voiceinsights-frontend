# Architecture

VoiceInsights Africa runs on Cloudflare Workers with D1 for durable relational state, R2 for media and generated artifacts, and Cloudflare Queues for asynchronous workloads. `backend/src/index.js` is intentionally minimal; the compatibility application is in `backend/src/application.js` while route families are extracted incrementally into `backend/src/routes/`.

Core runtime layers:

- API and authentication
- Collection channels and Twilio integrations
- Queue transport and built-in workload adapters
- Research, evidence and report intelligence
- Rendering and export services
- Operational health, metrics and audit trails

All production queue jobs retain D1 lifecycle records, tenant context, correlation IDs and idempotency keys.
