# Deployment — Workstream 1
1. Run `cd backend && npm install && npm test`.
2. Deploy backend with `wrangler deploy`. No new D1 migration is required.
3. Copy `site/` into the connected GitHub repository and push `main`.
4. Verify `/sample-reports.html`, the Enterprise Reports Studio, and protected DOCX/XLSX endpoints.
5. Run one real-project acceptance test using a completed project report model.
