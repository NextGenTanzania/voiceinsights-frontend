# Deployment

1. `cd backend`
2. `npm install`
3. `npm test`
4. `wrangler deploy`
5. Copy `site/` into the connected GitHub Pages repository and push.
6. Open `/app/presentation-publishing.html`.

No D1 migration is required for Phase 4. Binary PDF/PPTX/DOCX/XLSX exports use the existing Worker-compatible renderers. High-fidelity branded rendering can later use the existing external renderer contract without changing the API.
