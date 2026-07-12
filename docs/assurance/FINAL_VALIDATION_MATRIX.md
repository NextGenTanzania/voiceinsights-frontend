# Final Validation Matrix

| Area | Automated evidence | Live evidence required | Current status |
|---|---|---|---|
| Queue contracts and bindings | Full regression, binding consistency, dry-run | Cloudflare staging burst and DLQ exercise | Source verified |
| Session revocation | Unit and regression tests | Staging D1 outage and stolen-token drill | Source verified |
| Twilio security | Cryptographic signature and D1 outage tests | Live SMS, WhatsApp, Voice and callbacks | Requires live validation |
| CSP | Report-only headers, reporting persistence, source inventory | Browser violation burn-down and strict enforcement | Partially complete |
| WCAG 2.2 AA | Full-site static checks | Keyboard, NVDA, VoiceOver, contrast and mobile testing | Partially complete |
| OIDC and SCIM | Discovery, PKCE, token and bearer tests | Entra, Google, Okta and SCIM tenants | Requires live validation |
| Offline workflow | Contract and regression tests | Android/iOS no-network field test | Requires live validation |
| Reports | Assurance, methodology and export regression | Visual QA of all binary exports | Source verified, live QA required |
| Performance | 100,000-event local serialization benchmark, k6 plan | Staging 10k–100k workload and provider limits | Requires live validation |
| Procurement | Evidence index and gap register | External due diligence and certifications | Conditional |
