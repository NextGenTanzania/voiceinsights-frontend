# VoiceInsights Africa — Enterprise Release 4

## International Research Standards, Methodology & Procurement Readiness

Release 4 adds a deterministic, fail-closed standards layer above the v215 AI Assurance publication gate. It does not claim that source code alone proves acceptance by the World Bank, UN, UNDP, UNICEF, WHO, AfDB, governments, INGOs or research firms. Client procurement, independent methodology review, penetration testing, legal review and live production evidence remain external acceptance activities.

## Implemented

- Research Methodology validation: objectives, evaluation questions, sampling frame, sample-size calculation, stratification, weights, confidence intervals, design effect, missing data, reliability, validity, limitations and metadata.
- OECD-DAC evidence requirements for Relevance, Coherence, Effectiveness, Efficiency, Impact and Sustainability.
- Results-Based Management chain and indicator completeness.
- SDG goal/target/indicator/contribution/evidence/limitations validation.
- UNEG evaluation matrix, ethics, independence, evidence-backed recommendations, management response and disclosure.
- World Bank-oriented statistical documentation for sampling, weighting, uncertainty, reproducibility, metadata and microdata governance.
- Publication quality gate for methodology, limitations, confidence, citations, data dictionary, appendices and quality statement.
- Procurement packs: Compliance, Security, Methodology, Evidence, Technical Architecture, Operational Manual and Administrator Guide.
- Independent audit register with only FIXED, PARTIALLY_FIXED, NOT_FIXED and REQUIRES_EXTERNAL_VALIDATION states.

## New API endpoints

- `POST /api/standards/evaluate`
- `GET /api/standards/runs/:id`
- `POST /api/procurement/generate`
- `POST /api/audit/run`

All endpoints require authenticated organization context. Audit endpoints require reviewer/administrator roles.

## Migration

```bash
cd backend
npx wrangler d1 migrations apply voiceinsights-db --local
npx wrangler d1 migrations apply voiceinsights-db --remote
```

Migration: `034_international_standards.sql`.

## Verification

```bash
cd backend
npm install
npm run test:release4
npm test
npx wrangler deploy --dry-run
```

## Rollback

1. Deploy the prior v215 Worker bundle.
2. Stop calling `/api/standards/v216`, `/api/procurement/v216` and `/api/audit/v216`.
3. The migration is additive; tables may safely remain. Do not drop them until records are exported and retention requirements are checked.
4. To remove after approval, export the four v216 tables, then drop indexes and tables in reverse dependency order.

## Honest readiness boundary

The implementation can verify repository behavior and deterministic standards completeness. It cannot self-certify institutional acceptance, independence, live production resilience, ethical compliance in fieldwork, external penetration testing or statistical replication. Those are explicitly returned as external-validation requirements.
