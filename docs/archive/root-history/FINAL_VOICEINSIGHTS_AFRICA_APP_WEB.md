# Final VoiceInsights Africa App/Web

This consolidated release includes the Flagship Report Engine phases 1-5 plus the VoiceInsights Data Trust & Intelligence Fabric™, secure API public experience, M&E interactive demo login and unified enterprise dashboard visual system.

## M&E interactive demo
- Email: `M&E.demo@voiceinsightsafrica.com`
- PIN: `DemoLogin2026`
- Read-only synthetic demonstration; it never receives a production JWT and cannot mutate production data.

## Data Trust Fabric
1. Data Catalog & Metadata Registry
2. End-to-End Data Lineage
3. Data Quality & Observability Center
4. Privacy & Disclosure Control
5. AI Governance & Model Assurance
6. SDMX/DDI Interoperability
7. Real-Time Decision Signals

## Deployment
Apply migration `030_data_trust_intelligence_fabric.sql`, deploy the Worker, then publish the `site/` directory through the existing GitHub-connected Cloudflare Pages project.
