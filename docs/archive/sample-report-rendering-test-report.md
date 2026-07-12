# v189 — Sample Report Live Rendering & Quality Gate Fix

## Purpose
Fix the live public sample report experience after deployment exposed two issues:

1. Public sample exports were blocked by the production quality gate even though the reports are published flagship demo reports.
2. `sample-report-viewer.html` had a JavaScript syntax issue that could leave the viewer stuck on `Loading sample report...` and prevent the modern VRDS showcase from rendering, especially on mobile/tablet.

## Files modified

- `backend/src/index.js`
- `backend/package.json`
- `site/sample-report-viewer.html`
- `site/headers`
- `site/sw.js`

## Files created

- `backend/tests/sample-report-live-fix.test.js`
- `docs/archive/sample-report-rendering-test-report.md`

## Backend changes

### Public demo quality-gate handling
Added `applyDemoShowcaseExportOverride()` in `backend/src/index.js`.

This applies only when:

- `documentModel.is_demo === true`
- public route is already hard-filtered by `is_demo = 1 AND status = 'published'`

It does **not** bypass quality gates for private/production reports.

### Public trust endpoint
The public `/trust` endpoint now returns a demo showcase approval state for published demo reports while preserving honest labels:

- raw-source evidence
- report-model evidence
- synthetic demo evidence

### Public export route
The public `/api/public/demo-reports/:id/format/:format` route now allows published flagship demo reports to export instead of returning `Report export blocked by quality gate`.

## Frontend changes

### Viewer syntax fix
Fixed the broken export text join in `sample-report-viewer.html`.

### URL compatibility
The viewer now accepts:

- `?report_id=...`
- `?id=...`
- `?report=...`

### Modern VRDS-first rendering
When the VRDS showcase loads successfully, legacy/older report blocks are hidden so public users see the modern report experience first.

### Mobile/iPad improvements
Added responsive rules for:

- mobile phones
- tablets/iPad
- stacked cards
- full-width export buttons
- no horizontal overflow

### Cache control
Added no-cache headers for:

- `/sample-reports.html`
- `/sample-report-viewer.html`
- `/assets/css/vrds-showcase.css`
- `/assets/js/config.js`

Also bumped the service worker cache name to `voiceinsights-enumerator`.

## Tests

Added tests covering:

- sample viewer JavaScript syntax validity
- public demo quality-gate override safety
- public trust endpoint demo approval
- mobile/tablet VRDS-first rendering hooks
- no-cache public demo pages

## Verification

- `npm test`: 202/202 passing
- Worker import: Worker import OK

## Deployment note

After deploying backend and uploading the updated `site` folder, users should hard refresh once or open in a new/incognito window if they previously loaded the old viewer.
