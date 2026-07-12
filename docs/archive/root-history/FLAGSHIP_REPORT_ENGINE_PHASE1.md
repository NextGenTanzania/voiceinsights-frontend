# VoiceInsights Flagship Report Engine™ v2 — Phase 1

This release introduces the governed core of the next-generation report engine:

1. Executive Intelligence Layer
2. Evidence Intelligence Layer
3. Statistical Intelligence Layer
4. Policy Intelligence Layer
5. Decision Intelligence Layer
6. Publication Quality Gate

## International publication profiles

- UN Agency
- World Bank
- Government / Cabinet
- Donor / INGO
- Humanitarian
- Corporate / Board
- Technical Research

## Core safety rules

- No evidence, statistic, cost, confidence or policy claim is invented.
- Missing information is returned as `Not documented`, `Not measured`, or a publication blocker.
- Raw-source claims require source pointers.
- Publication is blocked when evidence, methodology, limitations or decision accountability are materially incomplete.
- Scenarios and forecasts must be labelled and include assumptions.

## API

- `GET /api/reports/flagship/catalog`
- `POST /api/reports/flagship/compile`
- `POST /api/reports/flagship/quality-gate`

All endpoints require an authenticated report-authoring role.

## UI

- `/app/flagship-report-engine.html`

## Sample library architecture

The engine includes 16 distinct report archetypes across flagship, enterprise and technical tiers. Each has a different cover personality, palette, visual emphasis and publication profile. This catalogue is the foundation for Phase 2 premium publications and the regenerated public Sample Report Library.

## Acceptance

Phase 1 source-code acceptance requires:

- all tests pass;
- thin/unsupported reports are blocked;
- evidence pointers are preserved;
- statistical gaps are disclosed rather than invented;
- decisions include evidence, owner, timeline and monitoring indicator;
- 16 distinctive sample report archetypes are present.
