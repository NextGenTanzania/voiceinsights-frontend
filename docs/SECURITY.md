# Security

Production authentication is fail-closed. Signed JWTs must map to active users, active organizations and active server-side session records. Session-registry failure returns a service-unavailable response rather than authorizing access.

Twilio webhooks are signature-verified before persistence or processing. Secrets belong in Cloudflare secret bindings and must never be committed to configuration files.
