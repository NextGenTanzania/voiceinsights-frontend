# v210.2 Deployment Guide

## Backend
```cmd
cd C:\VIA\voiceinsights-full.2-production-finalization\backend
npm install
npx wrangler d1 execute voiceinsights-db --remote --file=migrations/021_production_finalization.sql
npm test
node -e "import('./src/index.js').then(()=>console.log('Worker import OK')).catch(console.error)"
npx wrangler deploy
curl https://voiceinsights-api.kitentyatsnp.workers.dev/api/health
```

## Required Twilio secrets
```cmd
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_SMS_FROM
npx wrangler secret put TWILIO_WHATSAPP_FROM
npx wrangler secret put TWILIO_VOICE_FROM
```

## Frontend
Copy the contents of `site/` into the GitHub repository connected to Cloudflare Pages, commit and push.

## New pages
- `/admin/operations-manager-dashboard-legacy.html`
- `/admin/founder-dashboard-legacy.html`
- `/app/field-intelligence-workspace.html`

## New API routes
- `GET /api/production-finalization/readiness`
- `GET /api/production-finalization/distribution/actions`
- `POST /api/production-finalization/distribution/event`
- `POST /api/production-finalization/distribution/send-sms`
- `POST /api/production-finalization/distribution/send-whatsapp`
- `POST /api/production-finalization/distribution/launch-call`
- `POST /api/production-finalization/campaigns/launch`
- `GET /api/production-finalization/queues`
- `POST /api/production-finalization/approvals/submit`
- `POST /api/production-finalization/approvals/:id/decision`
- `GET /api/production-finalization/dashboard/operations`
- `GET /api/production-finalization/dashboard/founder`
- `GET /api/production-finalization/notifications`

## v210.3A database update
Before deploying the Worker, apply the updated schema:

```cmd
cd backend
wrangler d1 execute voiceinsights-db --remote --file=schema.sql
npm install
npm test
wrangler deploy
```

Then deploy the `site` directory through the connected GitHub/Cloudflare Pages workflow.
