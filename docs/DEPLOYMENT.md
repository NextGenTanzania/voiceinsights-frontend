# Deployment

From `backend/`:

```bash
npm ci
npx wrangler d1 migrations apply voiceinsights-db --remote
npm test
npm run check:deploy
npx wrangler deploy
```

Configure required secrets with `wrangler secret put`. Production must keep `ALLOW_LEGACY_SESSIONS=false` unless a documented, time-bounded migration is active.
