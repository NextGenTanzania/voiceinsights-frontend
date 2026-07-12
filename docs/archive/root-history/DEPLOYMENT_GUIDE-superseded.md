# Deploy v210.6

```cmd
cd backend
npm install
npm test
node -e "import('./src/index.js').then(()=>console.log('Worker import OK')).catch(console.error)"
wrangler deploy
```

Push the `site` directory to the GitHub repository connected to Cloudflare Pages.

Verify:
- `/api/platform/v2106/openapi.json`
- `/developers/index.html`
- `/developers/playground.html`
