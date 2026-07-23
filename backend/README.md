# VoiceInsights Africa — Backend (Cloudflare Worker + D1 + R2)

This is the real "brain" of the system: authentication, survey/campaign storage,
and the WhatsApp voice → AI pipeline. It replaces the mock data the frontend
was using.

## What's real vs. what still needs your accounts

| Feature | Status |
|---|---|
| Login (real password check, JWT) | ✅ Fully working once deployed |
| Survey Builder → saves to database | ✅ Fully working once deployed |
| Dashboard, Campaigns, Analytics, Fraud Alerts | ✅ Fully working once deployed (real data) |
| CSV / Excel export (Reports page) | ✅ Fully working once deployed |
| **WhatsApp** — multi-question voice pipeline | ✅ Code complete — needs your Twilio + OpenAI + Anthropic keys |
| **Phone Call** — multi-question IVR with language select | ✅ Code complete — needs your Twilio Voice number |
| **SMS** — feature-phone text fallback, multi-question | ✅ Code complete — needs your Twilio SMS-capable number |
| **Web Link** — multi-question voice recorder, EN/SW toggle | ✅ Code complete — works immediately, no Twilio needed |
| Billing, some Admin Console pages | ⏳ Still mock data — next phase |

All four data-collection channels (WhatsApp, Phone Call, SMS, Web Link) share one
session-based pipeline: a respondent is walked through the survey's questions
**one at a time**, in order — same brain, four doors in.

**Note on languages:** each survey question is authored once, in whichever
language you write it. The Web Link page has an EN/SW toggle for its own UI
text (buttons, labels); Phone Call asks the caller to choose English or
Swahili at the start of the call. Extending this so the *same* question has
translated variants per language is a natural next step — flag it if you want
it built.

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

## 3. Load the schema (creates tables + a demo organization)

```bash
wrangler d1 execute voiceinsights-db --remote --file=./schema.sql
```

This creates tables and a demo organization (`org_demo`). It does **not**
create any user account or password — schema.sql must never contain
credentials, because it's run directly against production (see
`SECURITY_INCIDENT_2026-07-13.md` for why this matters).

To create your first admin login, run:

```bash
ADMIN_EMAIL=you@yourorg.com ADMIN_PASSWORD='choose-a-strong-password' \
  node scripts/bootstrap-admin.js --remote --yes
```

This hashes the password locally (PBKDF2, matching the login path) and
upserts the account directly via `wrangler d1 execute` — the plaintext
password is never written to a file, migration, or git history. See
`scripts/bootstrap-admin.js --help` for all options (org id/name, role,
full name, database name).

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

## 8. Connect Phone Call (Twilio Voice)

1. In the Twilio Console, buy or use an existing **phone number** with Voice capability
   (Phone Numbers → Manage → Buy a number).
2. Open that number's configuration, under **Voice Configuration → A call comes in**, set:
   ```
   https://voiceinsights-api.<your-subdomain>.workers.dev/api/voice/incoming
   ```
   Method: `POST`
3. Call that number — VoiceInsights will ask you to choose a language, then walk
   you through each survey question, recording your answer after each one.

## 9. Connect SMS (feature-phone fallback)

Use the same phone number as Phone Call (most Twilio numbers support both), or a
separate SMS-only number.

1. Under that number's configuration, **Messaging Configuration → A message comes in**, set:
   ```
   https://voiceinsights-api.<your-subdomain>.workers.dev/api/sms/webhook
   ```
   Method: `POST`
2. Text that number — VoiceInsights replies with each survey question in turn;
   the respondent answers by texting back, no smartphone or data plan required.

## 10. Web Link / in-app recorder

No setup needed — this works as soon as the backend is deployed and `config.js`
points to it. Share this link with respondents (optionally tag it to a specific
campaign):
```
https://voiceinsightsafrica.com/respondent.html?campaign=<campaign_id>
```
It walks through every question in the survey, uses the browser's own
microphone (no app install), and has an EN/SW toggle built in.

## 11. Two-Factor Authentication (2FA)

No setup needed — this works immediately after `wrangler d1 execute` +
`wrangler deploy`, using only the `JWT_SECRET` you already set. Any user can
turn it on themselves from **Settings → Security & API → Enable 2FA**, scan
the QR code with Google Authenticator / Authy / 1Password, and confirm with
the 6-digit code. It's fully compatible with real authenticator apps (RFC
6238 TOTP) — verified against the standard `pyotp` library during development.

## 12. Email notifications (Resend)

Optional — the platform works fine without this, notifications just won't send.

1. Create a free account at **resend.com** (no credit card needed).
2. Go to **API Keys → Create API Key**, name it "VoiceInsights", permission
   "Sending access". Copy the key (starts with `re_...`).
3. Run:
   ```
   wrangler secret put RESEND_API_KEY
   ```
   and paste it.
4. That's it — `wrangler.toml` already has `NOTIFY_FROM_EMAIL` set to
   Resend's shared test address (`onboarding@resend.dev`, no domain setup
   needed) and `NOTIFY_TO_EMAIL` set to your inbox. You'll get an email when:
   - A high-confidence fraud alert (score ≥ 0.7) is detected
   - A new project/survey is created
   - Someone submits the website Contact form
5. When you're ready to send from your own domain
   (`notifications@voiceinsightsafrica.com`), verify that domain in Resend
   (Domains → Add Domain, then add the DNS records they give you), then
   update `NOTIFY_FROM_EMAIL` in `wrangler.toml` and redeploy.

## 13. Real subscriptions (Stripe)

1. Create a free account at **dashboard.stripe.com** (start in **Test mode** first).
2. Go to **Product catalog → Add product**. Create three products — Starter,
   Professional, Enterprise — each with a **recurring yearly price**. Copy each
   product's **Price ID** (starts with `price_...`).
3. Open `wrangler.toml` and paste those three Price IDs into:
   ```
   STRIPE_PRICE_STARTER = "price_..."
   STRIPE_PRICE_PROFESSIONAL = "price_..."
   STRIPE_PRICE_ENTERPRISE = "price_..."
   ```
4. In the Stripe Dashboard, go to **Developers → API keys**, copy the
   **Secret key**, then run:
   ```
   wrangler secret put STRIPE_SECRET_KEY
   ```
5. Go to **Developers → Webhooks → Add endpoint**. Set the URL to:
   ```
   https://voiceinsights-api.<your-subdomain>.workers.dev/api/billing/webhook
   ```
   Select the event **`checkout.session.completed`** (and optionally
   `customer.subscription.deleted`, `invoice.payment_failed`). Copy the
   **Signing secret** (`whsec_...`) it gives you, then run:
   ```
   wrangler secret put STRIPE_WEBHOOK_SECRET
   ```
6. `wrangler deploy` to pick up the Price IDs from `wrangler.toml`.
7. Test it: log in, go to **Billing**, click a plan — you'll be redirected to a
   real Stripe Checkout page. Use Stripe's test card `4242 4242 4242 4242`,
   any future expiry, any CVC. After paying, you're redirected back and the
   organization's plan updates automatically via the webhook.
8. When ready for real payments, switch Stripe out of Test mode and repeat
   steps 2–5 with your **live** keys and Price IDs.

## API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | No | Returns JWT + user |
| GET | `/api/auth/me` | Yes | Current user |
| GET | `/api/surveys` | Yes | List surveys for your org |
| POST | `/api/surveys` | Yes | Create a survey |
| GET | `/api/surveys/:id` | Yes | Survey + its questions |
| POST | `/api/surveys/:id/questions` | Yes | Add a question |
| GET/POST | `/api/campaigns` | Yes | List / create campaigns (with reached counts) |
| GET | `/api/dashboard/stats` | Yes | Live counts for the dashboard, by channel |
| GET | `/api/analytics/summary` | Yes | Real sentiment/topics/quotes |
| GET | `/api/fraud/alerts` | Yes | Real fraud-flagged responses |
| GET | `/api/reports/csv?campaign_id=` | Yes | Excel-compatible export of every answer |
| GET | `/api/organizations/me` | Yes | Current org's plan and status |
| POST | `/api/billing/create-checkout-session` | Yes | Starts a real Stripe subscription checkout |
| POST | `/api/billing/webhook` | No (Stripe-signed) | Activates the plan after payment |
| GET | `/api/public/campaigns/:id/questions` | No (public) | Question list for the web widget |
| POST | `/api/whatsapp/webhook` | No (Twilio-signed) | Inbound WhatsApp — multi-question |
| POST | `/api/voice/incoming` | No (Twilio-signed) | Inbound call — language select |
| POST | `/api/voice/language` | No (Twilio-signed) | Asks Q1, starts recording |
| POST | `/api/voice/recording` | No (Twilio-signed) | Recording callback, loops questions |
| POST | `/api/sms/webhook` | No (Twilio-signed) | Inbound SMS — feature-phone fallback |
| POST | `/api/web/submit` | No (public) | Web-link / in-app recorder, multi-question |

## Next steps (not built yet)

- Wire Billing and Admin Console pages to real data (currently still mock)
- Enumerator mobile app (offline-first sync)
- Fraud Engine scoring logic (currently only the AI sentiment/summary step runs)
- Change/reset password flow
- Role-based permission checks (currently any logged-in user of an org can do anything in that org)
