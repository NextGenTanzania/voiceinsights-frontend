# Deploy v210.5
```cmd
cd backend
npm install
npm test
wrangler d1 execute voiceinsights-db --remote --file=schema.sql
node -e "import('./src/index.js').then(()=>console.log('Worker import OK')).catch(console.error)"
wrangler deploy
```
Then publish the `site` directory through the connected GitHub/Cloudflare Pages project.
