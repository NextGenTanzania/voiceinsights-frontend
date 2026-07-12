# Deployment — Governance, Security, Compliance & Enterprise Workflow
1. Back up D1.
2. From backend: `npm install && npm test`.
3. Apply: `wrangler d1 migrations apply voiceinsights-db --remote`.
4. Deploy Worker: `wrangler deploy`.
5. Copy `site/` into the connected GitHub repository, commit and push.
6. Verify `/api/health`, protected `/api/enterprise-control/workspace`, and the admin Trust Center page.
7. Do not claim SOC 2 or ISO certification; this release reports readiness and evidence only.
