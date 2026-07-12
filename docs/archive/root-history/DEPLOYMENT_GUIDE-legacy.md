# Deployment — v210.9B

```cmd
cd backend
npm install
npm test
wrangler d1 execute voiceinsights-db --remote --file=schema.sql
node -e "import('./src/index.js').then(()=>console.log('Worker import OK')).catch(console.error)"
wrangler deploy
```

Push the `site` directory to the GitHub repository connected to Cloudflare Pages.
