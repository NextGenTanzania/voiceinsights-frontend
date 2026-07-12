# Phase 19 Production Safety Patch — v178.1

## Scope
Production safety patch only. No homepage, brand identity, navigation, dashboard redesign, or core architecture changes were made.

## Files modified
- `backend/src/report-trust.js`
- `backend/src/multi-format-renderer.js`
- `backend/src/decision-intelligence-engine.js`
- `backend/src/ai-narrative-engine.js`
- `backend/src/recommendations-engine.js`
- `backend/tests/report-trust.test.js`
- `site/sample-report-viewer.html`
- `site/app/report-viewer.html`

## Exact changes made
1. Evidence traceability wording now distinguishes:
   - `raw_response_evidence` / `Raw response evidence` only when a quote/transcript plus raw pointer exists.
   - `report_model_evidence` / `Report-model evidence` when evidence is derived from report summary/model data.
2. Evidence objects now include:
   - `evidence_type`
   - `evidence_label`
   - `raw_response_evidence`
3. Report-model evidence no longer exposes a quote/transcript field as if it were raw evidence.
4. Public/client-side export flows now check `/trust` before browser-triggered exports:
   - sample viewer print/PPTX/format downloads
   - authenticated viewer PDF/JSON/CSV/Excel/Word/PPTX/format downloads/technical print
5. Public fallback wording was changed from “Not enough data...” to professional verified-evidence wording in report rendering paths.
6. SDG cards now use `sdg_aligned_label` and `visual_system_note` instead of implying official logo assets.
7. Verified the reported public demo export route has no `INSERT INTO generated_reports` dead code inside the route block in this ZIP.

## Tests added/updated
Added tests for:
- Raw evidence labels only when raw pointers exist.
- Report-model evidence labels when raw pointers are absent.
- SDG cards do not claim official logo assets.

## Test result
`npm test` result: 90/90 passing.

## Remaining risks
- Browser visual QA is still required after deployment for PDF/print/PPTX/download outputs.
- End-to-end Worker route tests were not run against a deployed Cloudflare environment in this local patch.
- Official UN SDG logo assets are not included; cards are SDG-aligned metadata/visual cards only.

## Deployment command
```bash
cd C:\Users\Administrator\Downloads\backend
npm test
wrangler deploy
node scripts\enrich-demo-reports-legacy.js https://voiceinsights-api.kitentyatsnp.workers.dev "VI_TOKEN_YA_SHOWCASE_ADMIN"
```

## Post-deploy verification checklist
1. `curl https://voiceinsights-api.kitentyatsnp.workers.dev/api/health`
2. Verify public demo trust endpoint returns only demo/published data.
3. Verify non-demo report returns 404 via public endpoint.
4. Open `sample-report-viewer.html` and confirm all export buttons check v19 gate.
5. Open authenticated `site/app/report-viewer.html` and confirm PDF/JSON/CSV/Excel/Word/PPTX exports check v19 gate.
6. Download Executive, Donor, Policy, Infographic, Statistical Annex, Dataset Appendix and AI Talking Points.
7. Generate Board PPT and confirm no “Not enough data...” text appears.
8. Confirm evidence labels show raw evidence only where raw transcript/audio/consent pointers exist; otherwise report-model evidence.
