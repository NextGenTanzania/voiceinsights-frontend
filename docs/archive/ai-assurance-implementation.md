# VoiceInsights Africa Enterprise Release 3— v215

## Verdict

**RELEASE 3 VERIFIED — READY FOR STAGING DEPLOYMENT**

This verdict covers deterministic code, D1 schema, API wiring, regression tests and Worker dry-run. It does not claim that live AI provider output or live external review has been verified in production.

## Implemented

- Evidence retrieval and normalized evidence registry
- Citation validation and missing-citation rejection
- Fabricated statistic and unsupported percentage detection
- Invented quote and empty-evidence detection
- Duplicate finding and contradiction checks
- Evidence-based confidence calculation
- Human approval and publication gate
- Evidence trace: interview, dataset version, question, respondent group, quote, confidence and verification status
- Nine report types: Executive, Donor, Government, Policy Brief, Board, Technical, Statistical Annex, Research and Impact
- Executive intelligence: summary, key insights, action/decision/risk/opportunity matrices, root-cause guard, cost-of-inaction guard and roadmap
- Evidence-aware consulting visual specifications
- AI governance metadata: model, provider, prompt version, temperature, dataset, latency, token use, cost, reviewer and approval
- D1 persistence and secured internal APIs

## New APIs

- `POST /api/ai-assurance/verify`
- `GET /api/ai-assurance/runs/:id`
- `POST /api/ai-assurance/runs/:id/approval`
- `POST /api/reports/generate`
- `POST /api/reports/visuals`
- `POST /api/reports/:id/export-check`

Detailed operations require authenticated, tenant-scoped roles. Approval requires a reviewer-capable role.

## Migration

```bash
cd backend
npx wrangler d1 migrations apply voiceinsights-db --local
npx wrangler d1 migrations apply voiceinsights-db --remote
```

Migration: `migrations/033_ai_assurance.sql`

## Tests

```bash
npm run test:release3
npm test
npx wrangler deploy --dry-run
```

## Publication safety

A report is not publication-ready unless all claims and recommendations have valid citations, evidence is traceable, contradictions are resolved, confidence is adequate, and human approval is `APPROVED`. Otherwise the engine returns `INSUFFICIENT_EVIDENCE` and blocks export.

## Rollback

1. Deploy the previous v214 Worker bundle.
2. Stop calling `/api/ai-assurance/*` and `/api/reports/*`.
3. Retain migration 033 tables for audit history; they are additive and do not alter legacy report tables.
4. If physical removal is required, export assurance/audit data first, then drop v215 tables in reverse dependency order.

## Honest limitations

- “Big Four comparable” visual quality requires live PDF/DOCX/PPTX rendering review by qualified human reviewers; code-level chart specs alone cannot prove visual parity.
- Live provider hallucination performance requires an evaluation dataset and production/staging model runs.
- Cost is recorded only when the provider or caller supplies it; it is never invented.
