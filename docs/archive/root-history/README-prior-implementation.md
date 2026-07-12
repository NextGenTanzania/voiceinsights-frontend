# v210.5 — VoiceInsights Knowledge Cloud™

Adds an organization-scoped institutional memory layer across previous reports, recommendations, lessons learned and evidence.

## Capabilities
- Knowledge Search with relevance ranking and filters
- Previous Reports registry
- Organization Knowledge overview
- Recommendations repository
- Lessons Learned repository
- Evidence Search preserving evidence classification and confidence
- Report-to-knowledge ingestion

## Security model
Knowledge is tenant-scoped. Raw respondent data is excluded by default. Evidence classifications and confidence scores remain visible. Protected APIs require authenticated roles.

## UI
`/app/knowledge-cloud.html`

## APIs
- `GET /api/knowledge/v2105/workspace`
- `GET /api/knowledge/v2105/search?q=`
- `POST /api/knowledge/v2105/items`
- `POST /api/knowledge/v2105/ingest-report`
