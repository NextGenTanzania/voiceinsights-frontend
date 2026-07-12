# Deployment Guide — VoiceInsights Cloud™

## Backend
```cmd
cd backend
npm install
npm test
wrangler d1 execute voiceinsights-db --remote --file=schema.sql
node -e "import('./src/index.js').then(()=>console.log('Worker import OK')).catch(e=>{console.error(e);process.exit(1)})"
wrangler deploy
```

## Frontend
Commit the contents of `site/` to the GitHub directory used by Cloudflare Pages. Do not upload `node_modules`.

## Required production validation
- Twilio Voice, SMS and WhatsApp credentials
- SSO identity-provider test
- MFA enrollment test
- D1 migration verification
- R2 signed-download verification
- Mobile and tablet smoke tests
- Backup restore and failover drill
- Independent penetration test
