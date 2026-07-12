# v210.7 — VoiceInsights Marketplace

Adds an organization-scoped marketplace for:
- Survey Templates
- AI Prompts
- Dashboards
- Widgets
- Connectors
- Reports

## Pages
- `/app/marketplace.html`

## APIs
- `GET /api/marketplace/v2107/workspace`
- `GET /api/marketplace/v2107/catalog`
- `POST /api/marketplace/v2107/install`
- `POST /api/marketplace/v2107/uninstall`

Connectors are marked configuration-required; the marketplace does not claim external systems are connected until credentials and mappings are configured.
