# Frontend Security and Accessibility Assurance

The repository now distinguishes source automation from live acceptance evidence.

## Automated controls

- `npm run audit:frontend` scans every HTML page for dead links, unwired controls, silent errors, flattering defaults, executable DOM sinks, inline code, semantic structure, accessible names, image alternatives, heading order and table headers.
- CSP is deployed in Report-Only mode. Browser violation reports are persisted through `/api/security/csp-report`.
- `site/assets/js/safe-dom.js` provides text-only DOM construction and a restricted rich-text sanitizer/Trusted Types policy.
- Strict CSP must not be enabled while inline script/style findings remain. The audit output is the migration register, not a false compliance badge.

## WCAG 2.2 AA live acceptance

Automated checks do not prove conformance. Before production declaration, test the primary pages with keyboard-only navigation, visible focus, 200% zoom, 320 CSS-pixel reflow, NVDA, VoiceOver, contrast tooling, reduced motion and mobile touch targets. Record page, browser, assistive technology, tester, date, defects and retest evidence.

## SSO and SCIM

OIDC providers remain `REQUIRES_LIVE_VALIDATION` until discovery, authorization-code/PKCE token exchange, JWKS validation, login, logout and provider-specific domain/group mapping have verified timestamps. SCIM requires a real create/read/update/deactivate/reactivate and pagination test against a provider tenant.
