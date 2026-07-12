# Release 4 Files Manifest

## Added
- `backend/src/international-research-standards.js` — methodology, OECD-DAC, RBM, SDG, UNEG, World Bank statistics and publication validation.
- `backend/src/procurement-readiness.js` — seven procurement pack completeness evaluator.
- `backend/src/independent-audit.js` — controlled previous-finding re-audit and separate source/live/enterprise scores.
- `backend/src/international-standards-api.js` — authenticated APIs and D1 persistence.
- `backend/migrations/034_international_standards.sql` — standards runs, reviews, procurement packs and audits.
- `backend/tests/international-standards.test.js` — deterministic gate tests.
- `docs/archive/international-standards-implementation.md` — deployment, verification, rollback and external-validation boundary.
- `docs/archive/international-standards-file-manifest.md` — release file inventory.

## Changed
- `backend/src/index.js` — routes v216 requests before legacy route handling.
- `backend/package.json` — version 1.0.2160, Release 4 test script and regression inclusion.
