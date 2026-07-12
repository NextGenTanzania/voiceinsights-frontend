# FINAL DEPLOYMENT / TEST CHECKLIST — Enterprise Report Showcase
Pre-requisite for Full Module-by-Module Testing. Run in this exact order — each step depends on the previous one.

---

## 1. Running the Demo Showcase Seed

- [ ] Deploy schema to production D1: `wrangler d1 execute voiceinsights-db --remote --file=./schema.sql`
- [ ] Confirm the 4 new columns exist: `wrangler d1 execute voiceinsights-db --remote --command="PRAGMA table_info(generated_reports)"` → confirm `is_demo`, `demo_country`, `demo_language`, `demo_downloads` present
- [ ] Regenerate the seed SQL fresh (don't reuse the sandbox copy blindly — confirms the generator itself still runs clean): `node scripts/generate-demo-showcase-seed-legacy.js > tests/demo-showcase-seed-legacy.sql`
- [ ] Sanity-check the output before loading: `grep -c "INSERT INTO campaigns" tests/demo-showcase-seed-legacy.sql` → expect **16**
- [ ] Load into production: `wrangler d1 execute voiceinsights-db --remote --file=./tests/demo-showcase-seed-legacy.sql`
- [ ] Verify row counts landed correctly:
  - `SELECT COUNT(*) FROM campaigns WHERE organization_id='demo_org_showcase'` → **16**
  - `SELECT COUNT(*) FROM responses r JOIN campaigns c ON r.campaign_id=c.id WHERE c.organization_id='demo_org_showcase'` → **4,850**
  - `SELECT COUNT(*) FROM ai_insights WHERE response_id LIKE 'demo_response_%'` → **240**
- [ ] Create the `demo_admin` user row (needed for `generated_by` FK) if not already present — check first: `SELECT id FROM users WHERE id='demo_admin'`

## 2. Generating the 16 Demo Reports

- [ ] Obtain a real Super Admin JWT for `demo_admin` (log in normally, or issue one server-side)
- [ ] Run: `node scripts/generate-demo-reports.js https://voiceinsights-api.kitentyatsnp.workers.dev "<REAL_TOKEN>"`
- [ ] Confirm all 16 lines print `OK <template> -> report_...` — **zero `FAILED` lines**
- [ ] Copy the printed `UPDATE generated_reports SET is_demo = 1...` block and run it against production D1 (mark all 16 as demo + published)
- [ ] Verify: `SELECT COUNT(*) FROM generated_reports WHERE is_demo=1` → **16**
- [ ] Spot-check 3 reports' KPIs directly in D1 to confirm real, non-zero data (e.g. Health Survey should show ~420 responses)

## 3. AI Narrative Generation (Real ANTHROPIC_API_KEY Required)

- [ ] Confirm `ANTHROPIC_API_KEY` is set as a real Worker Secret in production (not the sandbox's fake key)
- [ ] For each of the 16 report IDs printed in Step 2, call: `POST /api/reports/:id/narrative` (authenticated as `demo_admin` or any Super Admin)
- [ ] Confirm each call returns **HTTP 200**, not 502 — a 502 means the real key is missing/invalid and must be fixed before continuing
- [ ] Spot-check 2-3 reports' returned `narrative.executive_summary` — confirm it reads as real, coherent prose (not the "Not enough data" placeholder, which would indicate the seed data didn't attach correctly)
- [ ] Re-run `GET /api/reports/:id/quality-score` (internal, authenticated) on the same 2-3 reports — `narrative_coverage` and `recommendation_quality` should now read **100**, not 0 (this is the definitive proof narrative generation succeeded)
- [ ] Optional but recommended: also populate the richer Phase 9 layers for at least a few flagship demo reports (Health Survey, Baseline, Annual Impact) so prospects see the full capability: `GET /reports/:id/style/:styleId`, `/tiered-recommendations`, `/citations`, `/benchmark`, `/roadmap`

## 4. Verifying sample-reports.html

- [ ] Load `https://voiceinsightsafrica.com/sample-reports.html` **while logged out** (private/incognito window) — confirms no login-wall accidentally applies
- [ ] Confirm all 16 report cards render with real sector/country/page/standards badges (not blank or "undefined")
- [ ] Test each filter independently: Search, Sector, Country, Standard, Length — confirm result count updates correctly and never shows 0 when a valid combination should match
- [ ] Test all 3 sort tabs (Featured / Recently Generated / Most Downloaded) — confirm order visibly changes
- [ ] Confirm the "Demonstration Report" disclosure text is visible near the top of the page without scrolling on both desktop and mobile widths

## 5. Verifying sample-report-viewer.html

- [ ] Click "View Interactive Report" on at least 3 different cards (different sectors) — confirm each loads its own distinct, correct data (not a cached/stale previous report)
- [ ] Confirm the "📋 Demonstration Report" banner is visible immediately on page load, above the fold, on both desktop and mobile
- [ ] Confirm Executive Summary and Key Findings now show real AI-written text (post Step 3) — if still showing "Not enough data", Step 3 was not completed for that report
- [ ] Confirm representative quotes render and read as plausible for that sector
- [ ] Test on a mobile viewport (375px width) — confirm KPI cards and buttons don't overflow or overlap

## 6. Verifying All Downloads/Exports

- [ ] Click "🖨 Sample PDF" — confirm the browser print dialog opens with a clean, complete-looking layout (no cut-off sections, nav bar hidden via print CSS)
- [ ] Click "📊 Sample PPT" — confirm a real `.pptx` file downloads and opens correctly in PowerPoint/Google Slides, showing Cover + KPIs + Key Findings slides with real data
- [ ] Click "Executive Summary" — confirm a `.txt` file downloads containing the real (post-Step-3) executive summary and key findings, not the placeholder
- [ ] Confirm each download/export click increments `demo_downloads` for that report: check `SELECT demo_downloads FROM generated_reports WHERE id=...` before and after clicking
- [ ] Confirm the "Most Downloaded" sort tab on `sample-reports.html` reflects the updated counts after a few real test downloads

## 7. Verifying No Real Client Reports Are Publicly Accessible

- [ ] Identify (or create as a throwaway test) one **real, non-demo** report ID belonging to any actual/test client organization
- [ ] Attempt `GET https://voiceinsights-api.../api/public/demo-reports/<real_report_id>` with **no Authorization header at all** — must return **HTTP 404** (already verified once in the sandbox; re-verify against real production data as a final gate, since this is the single most important security check in this whole checklist)
- [ ] Attempt the same against `GET /api/public/demo-reports` (the list endpoint) and manually confirm the real client's report ID/name never appears anywhere in the response
- [ ] Confirm `sample-report-viewer.html?report_id=<real_report_id>` renders a "Could not load sample report" error, not the real client's data
- [ ] As a final sweep, run: `SELECT id, organization_id FROM generated_reports WHERE is_demo = 1` and manually confirm every single row's `organization_id` is `demo_org_showcase` — **zero exceptions**

## 8. Verifying Every Demo Report Clearly Shows "Demonstration Report — Demo Data Only"

- [ ] On `sample-reports.html`: confirm every card shows the "Demonstration Report" label (not just some)
- [ ] On `sample-report-viewer.html`: confirm the orange/highlighted demonstration banner appears for **all 16** report IDs, not just the ones tested in Steps 4-6
- [ ] Confirm the in-report disclaimer text (footer of the rendered report body) explicitly states this is fictional demonstration data, not the platform-default "real survey data" disclaimer (this was specifically overridden in Task 8.10 — verify the override is actually taking effect in production, not just in the sandbox test)
- [ ] Confirm the downloaded PPTX title slide also says "Demonstration Report" (not just the on-screen HTML)
- [ ] Confirm the downloaded Executive Summary `.txt` file does NOT need to say it (it's just narrative text) but the page it was downloaded from clearly did

---

## Sign-Off

This checklist should be run **once, in full, immediately after production deployment**, before announcing the Report Library publicly or including it in any sales outreach. Item 7 is the single highest-priority check — if it fails, do not proceed with any of the others until fixed.

**No code was modified in preparing this checklist**, per your instruction — a quick re-review of the `is_demo` filtering in `src/index.js` was performed and confirmed unchanged and correct (3 hard SQL-level filters, as previously tested).
