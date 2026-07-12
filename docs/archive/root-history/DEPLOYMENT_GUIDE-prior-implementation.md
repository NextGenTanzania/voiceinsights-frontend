# Deployment Guide — v210.3B

## Backend

```cmd
cd "C:\VIA\voiceinsights-full.3b-data-protection-security-operations\backend"
npm install
npm test
node -e "import('./src/index.js').then(()=>console.log('Worker import OK')).catch(console.error)"
wrangler d1 execute voiceinsights-db --remote --file=schema.sql
wrangler deploy
curl https://voiceinsights-api.kitentyatsnp.workers.dev/api/health
```

## Frontend

Push the contents of the `site` folder to the GitHub repository connected to Cloudflare Pages. Do not upload `backend` or `node_modules` to Pages.

## Important security note

The Secrets Manager screen registers metadata only. Store or rotate actual provider secrets with Cloudflare commands such as:

```cmd
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_ACCOUNT_SID
```
