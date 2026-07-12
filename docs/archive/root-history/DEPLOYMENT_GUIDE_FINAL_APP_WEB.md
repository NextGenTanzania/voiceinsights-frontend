# Deployment Guide - Final VoiceInsights Africa App/Web

1. Back up D1.
2. Run `npm install` and `npm test` in `backend/`.
3. Apply remote D1 migrations with Wrangler.
4. Deploy the Worker with `wrangler deploy`.
5. Copy `site/` to the GitHub Pages repository and push `main`.
6. Purge Cloudflare cache and unregister any stale service worker if Report Library assets are cached.
7. Verify `/login.html`, `/demo/me-dashboard.html`, `/app/data-trust-intelligence-fabric.html`, `/api.html`, `/sample-reports.html` and all role dashboards.
