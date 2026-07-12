# Live Identity Acceptance Checklist

For Microsoft Entra ID, Google Workspace and Okta, record: tenant/provider, issuer, discovery result, redirect URI, state/nonce result, PKCE result, token exchange, issuer/audience/expiry validation, JWKS rotation, allowed-domain enforcement, group/role mapping, session creation, logout and audit event. Never set status ACTIVE from configuration alone.

For SCIM, verify bearer-token hashing, Users create/read/update/deactivate/reactivate, Groups mapping, filters, pagination, duplicate request idempotency, cross-tenant denial and audit events.
