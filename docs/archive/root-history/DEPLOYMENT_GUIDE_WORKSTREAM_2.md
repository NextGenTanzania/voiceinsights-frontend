# Deployment — Collection & Field Operations

From `backend`:

```cmd
npm install
npm test
wrangler d1 export voiceinsights-db --remote --output="backups\before-workstream2.sql"
wrangler d1 migrations apply voiceinsights-db --remote
wrangler deploy
```

Required Twilio secrets can use either naming convention:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` or `TWILIO_SMS_FROM` / `TWILIO_VOICE_FROM`
- `TWILIO_WHATSAPP_NUMBER` or `TWILIO_WHATSAPP_FROM`

Twilio status callbacks must point to the deployed Worker endpoints under `/api/twilio/status/{sms|whatsapp|voice}`. Signature verification uses the exact public callback URL and `TWILIO_AUTH_TOKEN`.

After backend deployment, copy `site/` into the GitHub Pages repository, commit and push. Open `/app/collection-operations.html` with an authorized user.
