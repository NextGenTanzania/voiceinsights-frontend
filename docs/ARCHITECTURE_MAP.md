# ARCHITECTURE MAP — VoiceInsights API (V212)

Purpose: make the codebase debuggable months from now. Start here, not in the file tree.

## Module map (src/)

| Module | Responsibility |
|---|---|
| `index.js` | Route tree only — every `/api/*` endpoint dispatch (see inventory below) |
| `security-layer.js` | CORS origin allowlist + baseline security headers (single choke point wrapping every response) |
| `utils.js` | `json()/error()` helpers, `requireAuth()` (JWT + live account/org status check), flagship protection |
| `auth.js` | PBKDF2 password hashing, HS256 JWT sign/verify, TOTP 2FA |
| `request-scope.js` | Org/campaign scoping per request, rate limiting, audit logging |
| `channel-pipeline.js` | The ONE shared collection pipeline: Voice, WhatsApp, SMS, web, offline app + Twilio helpers + fraud scoring |
| `notifications.js` | Web-push + transactional email |
| `billing-export.js` | Stripe checkout/webhook + CSV export |
| `ops-cron.js` | Everything the 5-min Cron runs: scheduled reports, health snapshots, vault rotation batches, log retention (TD-001) |
| `secret-vault.js` | Encrypted platform secrets + key rotation |
| `report-generator.js` + `multi-format-renderer.js` + engines | Report document model → all output formats |

Report-engine version modules (`*/v20/v18x/v2xx*.js`) are historical layers kept for
backward compatibility of stored reports. New report work goes in `flagship-report-engine.js`,
`full-flagship-publication.js` and `platinum-*.js`.

## Request lifecycle

1. `index.js → fetch()` (thin wrapper) → `handleRequest()` route tree
2. Protected routes call `requireAuth()` (utils.js) → JWT verify + live user/org status check
3. Data routes scope via `getEffectiveOrgId()` / `getEffectiveCampaignFilter()` (request-scope.js)
4. Every response passes through `applyCorsPolicy()` (security-layer.js)

## Route inventory (258 routes, line numbers in index.js)

| Method | Path | Line |
|---|---|---|
| GET | `/api/public/demo-reports` | 208 |
| GET | `/api/security/v2103a/iam/overview` | 626 |
| POST | `/api/security/v2103a/mfa/enroll` | 638 |
| POST | `/api/security/v2103a/mfa/verify` | 648 |
| POST | `/api/security/v2103a/sso/configure` | 656 |
| POST | `/api/security/v2103a/scim/token` | 665 |
| POST | `/api/security/v2103a/api-keys` | 672 |
| GET | `/api/security/v2103a/api-keys` | 681 |
| GET | `/api/security/v2103b/dashboard` | 689 |
| GET | `/api/security/v2103b/audit-events` | 705 |
| POST | `/api/security/v2103b/audit-events` | 713 |
| GET | `/api/security/v2103b/secrets` | 720 |
| POST | `/api/security/v2103b/secrets` | 726 |
| GET | `/api/security/v2103b/consents` | 734 |
| POST | `/api/security/v2103b/consents` | 740 |
| GET | `/api/security/v2103b/encryption` | 753 |
| GET | `/api/compliance/trust/readiness` | 767 |
| GET | `/api/compliance/trust/soc2-readiness` | 777 |
| GET | `/api/compliance/trust/iso-pack` | 782 |
| GET | `/api/compliance/trust/evidence` | 787 |
| POST | `/api/compliance/trust/evidence` | 792 |
| POST | `/api/compliance/trust/compliance-pack` | 798 |
| GET | `/api/enterprise-control/workspace` | 807 |
| GET | `/api/enterprise-control/workflows` | 825 |
| POST | `/api/enterprise-control/workflows` | 863 |
| GET | `/api/enterprise-control/mfa-policy` | 883 |
| POST | `/api/enterprise-control/sso/authorize` | 887 |
| POST | `/api/enterprise-control/sso/callback/validate` | 893 |
| POST | `/api/scim/v2/Users` | 897 |
| POST | `/api/enterprise-control/auth-journey/evaluate` | 903 |
| POST | `/api/enterprise-control/procurement-evidence` | 908 |
| GET | `/api/enterprise-assurance/register` | 917 |
| POST | `/api/enterprise-assurance/evidence` | 923 |
| POST | `/api/enterprise-assurance/sso/test-plan` | 930 |
| POST | `/api/enterprise-assurance/scim/lifecycle/validate` | 934 |
| POST | `/api/enterprise-assurance/mfa/recovery-evaluate` | 938 |
| POST | `/api/enterprise-assurance/client-journey` | 942 |
| GET | `/api/scale-intelligence/workspace` | 951 |
| POST | `/api/scale-intelligence/queue/jobs` | 961 |
| POST | `/api/scale-intelligence/acceptance` | 975 |
| GET | `/api/customer-success/v2109c/renewals` | 984 |
| POST | `/api/customer-success/v2109c/renewals` | 990 |
| GET | `/api/customer-success/v2109c/expansion` | 995 |
| POST | `/api/customer-success/v2109c/forecast` | 1002 |
| POST | `/api/customer-success/v2109c/assistant` | 1005 |
| GET | `/api/customer-success/v2109c/dashboard` | 1008 |
| GET | `/api/customer-success/v2109b/training/workspace` | 1021 |
| POST | `/api/customer-success/v2109b/training/courses` | 1028 |
| GET | `/api/customer-success/v2109b/support/workspace` | 1033 |
| POST | `/api/customer-success/v2109b/support/tickets` | 1036 |
| GET | `/api/customer-success/v2109b/adoption/workspace` | 1040 |
| POST | `/api/customer-success/v2109b/adoption/events` | 1043 |
| GET | `/api/customer-success/v2109b/sla/summary` | 1046 |
| GET | `/api/customer-success/v2109a/pilots` | 1051 |
| POST | `/api/customer-success/v2109a/pilots` | 1058 |
| GET | `/api/customer-success/v2109a/workspace` | 1066 |
| GET | `/api/customer-success/v2109a/founder-dashboard` | 1075 |
| GET | `/api/customer-success/v2109a/operations-dashboard` | 1081 |
| GET | `/api/benchmarks/v2108/workspace` | 1088 |
| GET | `/api/benchmarks/v2108/snapshots` | 1099 |
| POST | `/api/benchmarks/v2108/snapshots` | 1104 |
| POST | `/api/benchmarks/v2108/compare` | 1112 |
| GET | `/api/benchmarks/v2108/metrics` | 1117 |
| GET | `/api/marketplace/v2107/workspace` | 1123 |
| GET | `/api/marketplace/v2107/catalog` | 1130 |
| POST | `/api/marketplace/v2107/install` | 1135 |
| POST | `/api/marketplace/v2107/uninstall` | 1143 |
| GET | `/api/platform/v2106/openapi.json` | 1152 |
| GET | `/api/platform/v2106/examples` | 1156 |
| GET | `/api/platform/v2106/workspace` | 1159 |
| POST | `/api/platform/v2106/playground/validate` | 1166 |
| GET | `/api/knowledge/v2105/workspace` | 1176 |
| GET | `/api/knowledge/v2105/search` | 1184 |
| POST | `/api/knowledge/v2105/items` | 1192 |
| POST | `/api/knowledge/v2105/ingest-report` | 1198 |
| GET | `/api/reports/workspace` | 1206 |
| POST | `/api/reports/assistant` | 1219 |
| POST | `/api/reports/presentation` | 1226 |
| POST | `/api/reports/exports` | 1233 |
| GET | `/api/reports/flagship/catalog` | 1242 |
| POST | `/api/reports/flagship/compile` | 1248 |
| POST | `/api/reports/flagship/quality-gate` | 1256 |
| GET | `/api/reports/flagship/premium/styles` | 1264 |
| POST | `/api/reports/flagship/premium/compose` | 1270 |
| POST | `/api/reports/flagship/premium/manifest` | 1278 |
| GET | `/api/reports/flagship/interactive/catalog` | 1286 |
| POST | `/api/reports/flagship/interactive/evidence` | 1292 |
| POST | `/api/reports/flagship/interactive/ask` | 1299 |
| POST | `/api/reports/flagship/interactive/benchmark` | 1306 |
| POST | `/api/reports/flagship/interactive/knowledge/extract` | 1313 |
| POST | `/api/reports/flagship/interactive/knowledge/search` | 1320 |
| POST | `/api/reports/flagship/interactive/build` | 1327 |
| POST | `/api/reports/enterprise/acceptance` | 1334 |
| POST | `/api/reports/enterprise/docx` | 1341 |
| GET | `/api/reports/flagship/publishing/catalog` | 1352 |
| POST | `/api/reports/flagship/publishing/compose` | 1356 |
| POST | `/api/reports/flagship/publishing/quality-gate` | 1362 |
| POST | `/api/reports/flagship/publishing/export` | 1368 |
| GET | `/api/public/flagship-sample-library` | 1392 |
| GET | `/api/public/demo/me-brief` | 1414 |
| GET | `/api/public/demo/me-brief/export/pdf` | 1417 |
| GET | `/api/data-trust/workspace` | 1426 |
| POST | `/api/data-trust/catalog/assets` | 1444 |
| POST | `/api/data-trust/lineage/edges` | 1449 |
| POST | `/api/data-trust/quality/runs` | 1453 |
| POST | `/api/data-trust/privacy/assess` | 1456 |
| POST | `/api/data-trust/ai/models` | 1459 |
| POST | `/api/data-trust/interoperability/contracts` | 1462 |
| POST | `/api/data-trust/signals/evaluate` | 1465 |
| GET | `/api/data-trust/signals` | 1468 |
| GET | `/api/programme-lifecycle/workspace` | 1473 |
| POST | `/api/programme-lifecycle/results-framework` | 1484 |
| POST | `/api/programme-lifecycle/methodology/readiness` | 1490 |
| POST | `/api/programme-lifecycle/management-response` | 1493 |
| POST | `/api/programme-lifecycle/role-acceptance` | 1497 |
| GET | `/api/collection-operations/readiness` | 1502 |
| POST | `/api/collection-operations/assignments` | 1543 |
| GET | `/api/collection-operations/assignments` | 1556 |
| POST | `/api/collection-operations/offline/sync` | 1563 |
| POST | `/api/collection-operations/issues` | 1579 |
| POST | `/api/collection-operations/double-entry/assign` | 1589 |
| POST | `/api/collection-operations/quality/assess` | 1633 |
| GET | `/api/collection-operations/review-queue` | 1644 |
| GET | `/api/production-finalization/readiness` | 1655 |
| GET | `/api/production-finalization/distribution/actions` | 1668 |
| POST | `/api/production-finalization/distribution/event` | 1675 |
| POST | `/api/production-finalization/distribution/send-sms` | 1685 |
| POST | `/api/production-finalization/distribution/send-whatsapp` | 1695 |
| POST | `/api/production-finalization/distribution/launch-call` | 1705 |
| POST | `/api/production-finalization/campaigns/launch` | 1714 |
| GET | `/api/production-finalization/queues` | 1728 |
| GET | `/api/production-finalization/approvals` | 1737 |
| POST | `/api/production-finalization/operations-manager/control` | 1756 |
| POST | `/api/production-finalization/approvals/submit` | 1768 |
| GET | `/api/production-finalization/dashboard/operations` | 1816 |
| GET | `/api/production-finalization/dashboard/founder` | 1834 |
| GET | `/api/organization/operational-dashboard` | 1850 |
| GET | `/api/projects/manager-dashboard` | 1866 |
| GET | `/api/collection-operations/conflicts` | 1885 |
| GET | `/api/collection-operations/provider-health` | 1902 |
| GET | `/api/production-finalization/notifications` | 1908 |
| GET | `/api/health` | 2037 |
| GET | `/api/status-history` | 2055 |
| POST | `/api/auth/login` | 2065 |
| POST | `/api/auth/verify-2fa` | 2090 |
| GET | `/api/2fa/status` | 2110 |
| POST | `/api/2fa/setup` | 2116 |
| POST | `/api/2fa/verify-setup` | 2127 |
| POST | `/api/2fa/disable` | 2140 |
| GET | `/api/auth/me` | 2147 |
| POST | `/api/auth/change-password` | 2154 |
| POST | `/api/auth/forgot-password` | 2168 |
| POST | `/api/auth/reset-password` | 2196 |
| GET | `/api/users` | 2212 |
| GET | `/api/enumerators` | 2224 |
| GET | `/api/communications` | 2244 |
| GET | `/api/quality-control` | 2280 |
| POST | `/api/users/invite` | 2319 |
| GET | `/api/report-templates` | 2440 |
| GET | `/api/organizations/branding` | 2465 |
| PUT | `/api/organizations/branding` | 2472 |
| POST | `/api/organizations/branding/logo` | 2496 |
| GET | `/api/reports/compare` | 2875 |
| GET | `/api/report-styles` | 2923 |
| GET | `/api/reports` | 2995 |
| GET | `/api/report-schedules` | 3096 |
| POST | `/api/report-schedules` | 3109 |
| POST | `/api/reports/generate` | 3139 |
| GET | `/api/surveys` | 3312 |
| POST | `/api/surveys` | 3318 |
| GET | `/api/campaigns` | 3390 |
| POST | `/api/campaigns` | 3402 |
| POST | `/api/reports/email` | 3605 |
| GET | `/api/enumerators/leaderboard` | 3625 |
| GET | `/api/compliance/consent-export` | 3700 |
| POST | `/api/public/satisfaction` | 3717 |
| GET | `/api/campaigns/satisfaction-summary` | 3723 |
| POST | `/api/my-work/device-status` | 3832 |
| GET | `/api/my-work` | 3842 |
| GET | `/api/my-work/completed` | 3863 |
| GET | `/api/my-work/training` | 3878 |
| GET | `/api/my-work/messages` | 3908 |
| GET | `/api/security-dashboard` | 3946 |
| GET | `/api/dashboard/stats` | 3974 |
| GET | `/api/analytics/summary` | 4018 |
| GET | `/api/ops/health-center` | 4065 |
| GET | `/api/ops/dashboard` | 4072 |
| GET | `/api/ops/alerts` | 4079 |
| GET | `/api/ops/capacity` | 4087 |
| GET | `/api/ops/disaster-recovery` | 4093 |
| GET | `/api/ops/observability-contract` | 4099 |
| POST | `/api/ops/incident-packet` | 4105 |
| GET | `/api/fraud/alerts` | 4113 |
| GET | `/api/reports/csv` | 4132 |
| GET | `/api/superadmin/organizations` | 4143 |
| GET | `/api/superadmin/compare` | 4157 |
| GET | `/api/superadmin/mission-control` | 4178 |
| GET | `/api/notifications` | 4219 |
| POST | `/api/notifications/mark-all-read` | 4288 |
| POST | `/api/push/register` | 4303 |
| POST | `/api/push/unregister` | 4314 |
| GET | `/api/superadmin/ai-health` | 4324 |
| POST | `/api/superadmin/mission-control/summary` | 4376 |
| POST | `/api/superadmin/organizations` | 4410 |
| GET | `/api/organizations/health` | 4455 |
| GET | `/api/organizations/me` | 4488 |
| POST | `/api/organizations/regenerate-key` | 4497 |
| POST | `/api/billing/create-checkout-session` | 4513 |
| POST | `/api/billing/webhook` | 4517 |
| POST | `/api/contact/submit` | 4522 |
| GET | `/api/leads` | 4563 |
| POST | `/api/campaigns/import-csv` | 4716 |
| GET | `/api/respondents` | 4759 |
| GET | `/api/interviews` | 4785 |
| GET | `/api/dhis2/config` | 4867 |
| PUT | `/api/dhis2/config` | 4874 |
| POST | `/api/superadmin/vault/rotate` | 4909 |
| POST | `/api/superadmin/vault/rotate/process-batch` | 4930 |
| GET | `/api/superadmin/ai-retry-dead-letter` | 4944 |
| GET | `/api/superadmin/ai-retry-health` | 4997 |
| GET | `/api/superadmin/production-readiness` | 5078 |
| GET | `/api/superadmin/diagnostics` | 5119 |
| GET | `/api/superadmin/communications-health` | 5177 |
| GET | `/api/superadmin/system-health` | 5220 |
| GET | `/api/superadmin/vault-health` | 5257 |
| POST | `/api/external/responses` | 5300 |
| POST | `/api/superadmin/vault/migrate-dhis2` | 5377 |
| POST | `/api/dhis2/push` | 5420 |
| GET | `/api/dhis2/push-log` | 5477 |
| GET | `/api/oecd-dac-assessment` | 5485 |
| PUT | `/api/oecd-dac-assessment` | 5491 |
| GET | `/api/compliance` | 5522 |
| GET | `/api/consent-logs` | 5557 |
| POST | `/api/assistant/ask` | 5566 |
| GET | `/api/reports/intelligence` | 5602 |
| GET | `/api/indicators` | 5733 |
| POST | `/api/indicators` | 5743 |
| GET | `/api/admin/model-stats` | 5771 |
| GET | `/api/superadmin/audit-center` | 5857 |
| GET | `/api/audit-logs` | 5888 |
| POST | `/api/whatsapp/webhook` | 5913 |
| POST | `/api/voice/incoming` | 5916 |
| POST | `/api/voice/language` | 5917 |
| POST | `/api/voice/code` | 5918 |
| POST | `/api/voice/outbound-connected` | 5919 |
| POST | `/api/voice/recording` | 5920 |
| POST | `/api/sms/webhook` | 5923 |
| POST | `/api/web/submit` | 5926 |
| GET | `/api/intelligence-network/workspace` | 5930 |
| GET | `/api/intelligence-network/readiness` | 5941 |
| GET | `/api/intelligence-network/consent` | 5946 |
| POST | `/api/intelligence-network/consent` | 5949 |
| POST | `/api/intelligence-network/register` | 5954 |
| POST | `/api/intelligence-network/snapshots` | 5958 |
| POST | `/api/intelligence-network/activate` | 5961 |
| GET | `/api/intelligence-network/collaboration` | 5964 |
| POST | `/api/intelligence-network/collaboration` | 5967 |
| GET | `/api/public/intelligence-network/status` | 5970 |
