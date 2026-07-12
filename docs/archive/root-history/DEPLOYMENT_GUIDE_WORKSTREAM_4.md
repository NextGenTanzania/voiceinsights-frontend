# Deployment Guide

```cmd
cd backend
npm install
npm test
wrangler d1 export voiceinsights-db --remote --output=backups\before-workstream4.sql
wrangler d1 migrations apply voiceinsights-db --remote
wrangler deploy
```

Then copy `site` into the GitHub Pages repository, commit and push. Verify `/sample-reports.html`, `/admin/scale-cloud-intelligence-operations.html`, `/api/health`, and `/api/scale-intelligence/workspace` with an authorized account.
