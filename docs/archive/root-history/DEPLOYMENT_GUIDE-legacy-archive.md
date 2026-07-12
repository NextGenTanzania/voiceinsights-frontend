# Deployment
1. `cd backend`
2. `npm install`
3. `npm test`
4. `wrangler d1 execute voiceinsights-db --remote --file=schema.sql`
5. `node -e "import('./src/index.js').then(()=>console.log('Worker import OK')).catch(console.error)"`
6. `wrangler deploy`
7. Push the `site` folder to the GitHub repository connected to Cloudflare Pages.
