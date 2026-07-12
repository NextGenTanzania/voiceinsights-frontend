# Deployment

1. `cd backend`
2. `npm install`
3. `npm test`
4. `wrangler d1 execute voiceinsights-db --remote --file=schema.sql`
5. `node -e "import('./src/index.js').then(()=>console.log('Worker import OK')).catch(e=>{console.error(e);process.exit(1)})"`
6. `wrangler deploy`
7. Push the `site` directory to the GitHub repository connected to Cloudflare Pages.

Do not activate VIN until the Founder Activation Center reports every requirement as passed.
