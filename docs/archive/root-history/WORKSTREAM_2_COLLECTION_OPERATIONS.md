# Collection, Enumerator, Offline & Omni-Channel Operations

This workstream strengthens the production collection lifecycle without redesigning the homepage, public branding, authentication model or existing navigation.

## Implemented

- Production Survey Distribution Center integration and official-domain links.
- Twilio sender-name backward compatibility for existing `TWILIO_PHONE_NUMBER` and `TWILIO_WHATSAPP_NUMBER` secrets.
- Signed Twilio delivery callbacks for SMS, WhatsApp and Voice.
- Delivery-state normalization, bounded exponential retry and dead-letter records.
- Enumerator assignment API and organization-scoped assignment records.
- Offline sync with idempotency, version comparison and explicit conflict records.
- Double Entry Verification: assignment, two submissions, field-by-field comparison, match/conflict scores, critical-field escalation, supervisor/M&E review and audit-ready records.
- Fraud and quality intelligence: interview-speed, GPS, duplicate fingerprint, straight-lining, missing required data and consent validation.
- Unified supervisor and M&E review queue.
- Responsive Collection & Field Operations Center.

## New page

`/app/collection-operations.html`

## New API routes

- `GET /api/collection-operations/readiness`
- `POST/GET /api/collection-operations/assignments`
- `POST /api/collection-operations/offline/sync`
- `POST /api/collection-operations/double-entry/assign`
- `POST /api/collection-operations/double-entry/:id/submit`
- `POST /api/collection-operations/double-entry/:id/review`
- `POST /api/collection-operations/quality/assess`
- `GET /api/collection-operations/review-queue`
- `POST /api/twilio/status/sms`
- `POST /api/twilio/status/whatsapp`
- `POST /api/twilio/status/voice`

## Migration

Apply `migrations/022_collection_operations_workstream2.sql` before deploying the Worker.

## Production acceptance still required

Source-code readiness does not replace live acceptance. Before unrestricted production use, test SMS, WhatsApp and Voice with real Twilio recipients and callbacks; test offline sync on Android/iPhone under network interruption; complete a two-enumerator double-entry case; replay a failed delivery from retry/dead-letter; and have M&E approve/reject a comparison.
