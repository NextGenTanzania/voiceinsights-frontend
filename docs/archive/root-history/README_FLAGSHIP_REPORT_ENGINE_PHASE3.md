# VoiceInsights Flagship Report Engine™ v2 — Phase 3

Phase 3 adds Interactive Intelligence on top of the governed Core Engine and Premium Publications.

## Modules
- Evidence Explorer with source, quote, transcript/audio/photo/GPS pointers and verification metadata
- Grounded Report Assistant that answers only from cited evidence
- Privacy-safe Benchmark Engine with minimum-peer suppression
- Knowledge Engine for findings, recommendations, lessons and risks
- Interactive Report model with executive, evidence, statistical, policy and decision drill-downs

## New page
`/app/interactive-intelligence.html`

## New API routes
- `GET /api/reports/flagship/interactive/catalog`
- `POST /api/reports/flagship/interactive/evidence`
- `POST /api/reports/flagship/interactive/ask`
- `POST /api/reports/flagship/interactive/benchmark`
- `POST /api/reports/flagship/interactive/knowledge/extract`
- `POST /api/reports/flagship/interactive/knowledge/search`
- `POST /api/reports/flagship/interactive/build`

## Safety
The assistant does not invent answers. Benchmarks are suppressed below the configured peer threshold. Raw respondent identifiers are excluded from benchmark and public interactive views.

## Migration
Apply `029_flagship_interactive_intelligence.sql` before enabling persistent evidence, knowledge, assistant-session or benchmark-snapshot storage.
