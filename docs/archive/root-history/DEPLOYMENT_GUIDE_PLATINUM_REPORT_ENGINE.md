# Deployment — VoiceInsights World-Class Platinum Report Engine™ v1.0

No new D1 migration is required.

1. In `backend`: run `npm install`, `npm test`, then `wrangler deploy`.
2. Copy the final `site` directory into the GitHub Pages repository.
3. Commit and push the `site` directory to the production branch.
4. Wait for Cloudflare Pages deployment success, purge cache, and test `/sample-reports.html` and `/flagship-sample-report.html?key=national_health_access`.
5. Verify PDF, DOCX, PPTX and XLSX exports using a real sample key.

Public flagship reports remain synthetic demonstrations and are not official statistics.
