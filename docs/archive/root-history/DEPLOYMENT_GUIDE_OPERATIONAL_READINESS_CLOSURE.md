# Deployment — Operational Readiness Closure

1. Back up D1.
2. From `backend/`, run `wrangler d1 migrations apply voiceinsights-db --remote`.
3. Confirm migration `027_operational_readiness_closure.sql` is applied.
4. Run `npm install` and `npm test`.
5. Deploy Worker with `wrangler deploy`.
6. Copy `site/` into the GitHub Pages repository and push `main`.
7. Test Founder approval using one controlled client workflow. Confirm organization, project and workspace IDs are returned.
8. Test Organization Admin and Program/Project Manager dashboards with the provisioned organization.
9. Download one full offline package and confirm questionnaire, validation and consent content.
10. Create a version conflict and resolve it in `/app/conflict-review.html`.

No dashboard should substitute a positive score when evidence is absent. Missing evidence is shown as Not yet measured or Not configured.
