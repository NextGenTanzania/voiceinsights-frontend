# CRITICAL FIX REGRESSION EVIDENCE — requireAuth() account-status check
Executed via real `wrangler dev --local` + real local D1 (this check is
inherently D1-dependent, so a pure in-memory unit test cannot fully
substitute for this — same honest limitation disclosed since Task 1.2.2).

Fix: backend/src/utils.js `requireAuth()` now performs one lightweight
JOIN query after JWT signature/expiry verification, confirming
`users.is_active = 1` AND `organizations.status != 'suspended'` for the
token's subject, before returning claims. Returns the SAME generic
"Invalid or expired token" 401 message as a bad signature would (a
deliberate security choice — never reveal to a caller whether a token
failed due to signature, expiry, or account deactivation, since that
distinction is itself information an attacker could use).

## Test Results (real wrangler dev + real D1, this session)

| TC | Case | Expected | Actual | Result |
|----|------|----------|--------|--------|
| TC-01 | Active org_admin | 200 | 200 (real dashboard data) | PASS |
| TC-02 | Inactive user (is_active=0) | 401 | 401 "Invalid or expired token" | PASS |
| TC-03 | Deleted/never-existed user (valid signature, no matching users row) | 401 | 401 "Invalid or expired token" | PASS |
| TC-04 | Expired JWT (signed with -3600s expiry) | 401 | 401 "Invalid or expired token" | PASS |
| TC-05 | Tampered JWT (role escalated enumerator->super_admin, signature NOT re-signed) | 401 | 401 "Invalid or expired token" | PASS |
| TC-06 | Valid Super Admin | 200 | 200 (real dashboard data) | PASS |
| TC-07 | Valid Org Admin (repeat, confirms consistency) | 200 | 200 (real dashboard data) | PASS |
| TC-08 | Valid Enumerator (role-appropriate endpoint /api/my-work) | 200 | 200 {"assigned":false} | PASS |

**8/8 PASS.** No breaking changes: JWT format unchanged, no new tables,
no API contract changes (401 response shape identical to the pre-fix
"Invalid or expired token" for every other failure mode).

## Regression Confirmation
Full automated suite re-run after the fix: 71/71 passing (no existing
test touched or broken by this change).
