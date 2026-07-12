# Deployment — Flagship Report Engine Phase 3

1. Back up D1.
2. Run `npm install` and `npm test` inside `backend`.
3. Apply D1 migrations with `wrangler d1 migrations apply voiceinsights-db --remote`.
4. Deploy Worker with `wrangler deploy`.
5. Copy `site` into the GitHub Pages repository and push to `main`.
6. Open `/app/interactive-intelligence.html` using an authorized report role.
7. Verify grounded answers return citations and unsupported questions return `INSUFFICIENT_EVIDENCE`.
8. Verify benchmark output is `SUPPRESSED` below five peers.
