# Deployment
1. Back up D1.
2. Run `npm install` and `npm test` in backend.
3. Apply migrations with `wrangler d1 migrations apply voiceinsights-db --remote`.
4. Confirm `028_international_pilot_readiness.sql` applied.
5. Deploy Worker using `wrangler deploy`.
6. Publish `site/` through the connected GitHub/Cloudflare Pages repository.
7. Purge cache and service worker after deployment.
8. Execute live role, Twilio, Android offline, cross-tenant, and report-export acceptance tests.
