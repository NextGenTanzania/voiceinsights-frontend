# Deployment Guide — Flagship Report Engine Phase 2

No database migration is required for this phase.

1. Back up the existing deployment.
2. In `backend`, run `npm install` and `npm test`.
3. Deploy the Worker with `wrangler deploy`.
4. Copy `site/` into the connected GitHub repository and push to `main`.
5. Verify `/app/premium-publications.html` after Cloudflare Pages succeeds.
6. Test all three premium publication endpoints with an authorized report role.

Phase 2 composes governed publication models. Final PDF/PPTX/DOCX/XLSX output continues through the existing export infrastructure and remains subject to publication acceptance.
