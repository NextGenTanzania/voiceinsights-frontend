# Deployment

1. Apply `backend/migrations/024_external_assurance_acceptance.sql`.
2. Deploy the Worker.
3. Deploy the `site` directory.
4. Open `/admin/external-assurance-acceptance.html` with a Founder or Super Admin account.
5. Execute each external test with real provider/auditor/client evidence.
6. Record evidence through `POST /api/enterprise-assurance/evidence`.

External assurance is complete only when all seven register items show `pass` with evidence references.
