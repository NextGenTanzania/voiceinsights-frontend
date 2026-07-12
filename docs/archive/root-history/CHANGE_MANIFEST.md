# Change Manifest

## Primary implementation

- `backend/src/flagship-sample-library.js` — governed sixteen-report generator and publication quality rules.
- `backend/scripts/generate-flagship-samples.js` — deterministic sample model generator.
- `backend/tests/flagship-sample-generator.test.js` — flagship completeness, uniqueness and traceability tests.
- `samples/flagship-reports/` — generated catalog and sixteen full report models.
- `site/sample-reports.html` — responsive flagship library powered by the public API.
- `site/flagship-sample-report.html` — interactive governed report viewer.

## Clean-up

All filenames carrying historic `v` release tags were renamed through a collision-safe migration. References, imports and test commands were updated accordingly. Stable route names replace recent version-tagged public routes.
