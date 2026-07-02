# VoiceInsights Africa — Backend (Cloudflare Worker + D1 + R2)

This is the real "brain" of the system: authentication, survey/campaign storage,
and the WhatsApp voice → AI pipeline. It replaces the mock data the frontend
was using.

## What's real vs. what still needs your accounts

| Feature | Status |
|---|---|
| Login (real password check, JWT) | ✅ Fully working once deployed |
| Survey Builder → saves to database | ✅ Fully working once deployed |
| Dashboard live counts | ✅ Fully working once deployed |
| WhatsApp voice pipeline (transcription + AI analysis) | ✅ Code complete — **requires your own Twilio + OpenAI + Anthropic API keys** |
| Billing, Admin Console pages | ⏳ Still mock data — not wired yet (next phase) |

## 1. Install prerequisites

```bash
npm install -g wrangler
wrangler login          # opens a browser to log into YOUR Cloudflare account
```

## 2. Create the database and storage bucket

```bash
cd backend
wrangler d1 create voiceinsights-db
```
Copy the `database_id` it prints out, and paste it into `wrangler.toml` under
`[[d1_databases]]`.

```bash
wrangler r2 bucket create voiceinsights-audio
```

## 3. Load the schema (creates tables + a demo login)

```bash
wrangler d1 execute voiceinsights-db --remote --file=./schema.sql
```

This creates a demo organization and a working login:
- **Email:** `admin@nextgentanzania.com`
- **Password:** `VoiceInsights2026!`

(Change this password once you're using this for real — see "Next steps" below.)

## 4. Set your secrets

```bash
wrangler secret put JWT_SECRET
# paste any long random string, e.g. output of: openssl rand -hex 32

wrangler secret put OPENAI_API_KEY
# needed for Whisper transcription — https://platform.openai.com/api-keys

wrangler secret put ANTHROPIC_API_KEY
# needed for AI analysis (sentiment/topics/summary) — https://console.anthropic.com

wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
# both from https://console.twilio.com — needed for WhatsApp voice notes
```

## 5. Deploy

```bash
wrangler deploy
```

Wrangler will print a URL like:
```
https://voiceinsights-api.<your-subdomain>.workers.dev
```

## 6. Connect the frontend to this backend

Open `site/assets/js/config.js` and replace the placeholder:

```js
const API_BASE_URL = 'https://voiceinsights-api.<your-subdomain>.workers.dev';
```

Commit and push — Cloudflare Pages will redeploy automatically, and
**Login, Dashboard, and Survey Builder will now use real data.**

## 7. Connect WhatsApp (Twilio)

1. In the Twilio Console, open **Messaging → Try it out → WhatsApp Sandbox** (or your approved WhatsApp Business number).
2. Set the **"When a message comes in"** webhook to:
   ```
   https://voiceinsights-api.<your-subdomain>.workers.dev/api/whatsapp/webhook
   ```
   Method: `POST`
3. Send a voice note to the Sandbox number from your phone — it will be
   transcribed, analyzed, and stored automatically, and you'll get an
   automatic WhatsApp reply confirming receipt.

## API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | No | Returns JWT + user |
| GET | `/api/auth/me` | Yes | Current user |
| GET | `/api/surveys` | Yes | List surveys for your org |
| POST | `/api/surveys` | Yes | Create a survey |
| GET | `/api/surveys/:id` | Yes | Survey + its questions |
| POST | `/api/surveys/:id/questions` | Yes | Add a question |
| GET/POST | `/api/campaigns` | Yes | List / create campaigns |
| GET | `/api/dashboard/stats` | Yes | Live counts for the dashboard |
| POST | `/api/whatsapp/webhook` | No (Twilio-signed) | Inbound WhatsApp voice notes |

## Next steps (not built yet)

- Wire Billing and Admin Console pages to real data (currently still mock)
- Enumerator mobile app (offline-first sync)
- Fraud Engine scoring logic (currently only the AI sentiment/summary step runs)
- Change/reset password flow
- Role-based permission checks (currently any logged-in user of an org can do anything in that org)
