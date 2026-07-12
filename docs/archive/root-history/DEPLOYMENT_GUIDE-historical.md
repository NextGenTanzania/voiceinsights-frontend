# Deployment — v210.8

```cmd
cd backend
npm install
npm test
wrangler d1 execute voiceinsights-db --remote --file=schema.sql
wrangler deploy
```

Then deploy the `site` directory through the connected GitHub/Cloudflare Pages project.
