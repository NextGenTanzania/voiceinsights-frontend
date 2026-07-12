# v203 — Mobile Infographic Intelligence Reader

## Status
Patch only. No deployment performed.

## Files modified
- site/sample-report-viewer.html
- backend/package.json
- README-historical-copy.md

## Files created
- backend/tests/mobile-infographic-reader.test.js
- docs/archive/mobile-infographic-reader-test-report.md

## What changed
- Added mobile-first infographic tabs: KPI, Regions, SDG, Risks, Decisions, Timeline.
- Added readable SDG scroller for phones.
- Added slide/card style board view for tablet/mobile.
- Added read-more behavior for long executive text.
- Improved mobile export readability so HTML reports do not look like compressed notepad text.
- Preserved desktop v200 publication report layout.

## Device strategy
- Desktop: publication report.
- Tablet/iPad: board/presentation view.
- Phone: interactive mobile intelligence reader.
