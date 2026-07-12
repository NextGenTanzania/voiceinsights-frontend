# Route architecture

`src/index.js` is the minimal Cloudflare Worker entrypoint. The compatibility
application is currently hosted in `src/application.js` while route families are
migrated incrementally into this directory. New endpoints must be implemented in
one of: `auth`, `collection`, `reports`, `admin`, `data-trust`, `integrations`,
`operations`, or `public`, then registered through the central application.

This layout prevents the Worker entrypoint from becoming a second monolith and
allows safe extraction without breaking established API contracts.
