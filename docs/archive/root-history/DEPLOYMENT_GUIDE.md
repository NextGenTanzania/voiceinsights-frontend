# Deployment

```cmd
cd backend
npm install
npm test
wrangler d1 execute voiceinsights-db --remote --file=schema.sql
wrangler deploy
```

Push the `site` directory to the GitHub repository connected to Cloudflare Pages.
