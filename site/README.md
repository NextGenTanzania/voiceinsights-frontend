# VoiceInsights Africa — Frontend Prototype (v1)

Static prototype (HTML/CSS/JS, hakuna build step) ya jukwaa la VoiceInsights Africa —
inaonyesha Portals A–D kutoka kwenye architecture doc.

## Pages (18)

**Marketing / Public**
- `index.html` — Landing page ya kujitangaza
- `login.html` — Kuingia
- `respondent.html` — Portal B: mhojiwa anajibu bila akaunti
- `enumerator.html` — Portal D (Phase 2 preview): field worker mobile app

**Portal A — Client Dashboard** (`/app/`)
- `dashboard.html`, `surveys.html`, `survey-builder.html`, `campaigns.html`,
  `analytics.html`, `reports.html`, `billing.html`, `settings.html`

**Portal C — Admin Console** (`/admin/`)
- `dashboard.html`, `clients.html`, `call-monitoring.html`,
  `fraud-alerts.html`, `model-performance.html`, `audit-logs.html`

Data yote ni **mock data** — bado hakuna backend halisi imeunganishwa.
Lengo la toleo hili: kuona "picha" nzima na kuwa na kitu cha ku-demo.

## Jinsi ya ku-deploy Cloudflare Pages kupitia Git

1. Tengeneza repo mpya GitHub (mf. `voiceinsights-frontend`) na u-push folder hii:
   ```bash
   git init
   git add .
   git commit -m "VoiceInsights Africa - frontend prototype v1"
   git branch -M main
   git remote add origin https://github.com/<username>/voiceinsights-frontend.git
   git push -u origin main
   ```

2. Nenda Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → chagua repo hii.

3. Build settings (kwa static site hii, HAKUNA build step):
   - **Framework preset**: `None`
   - **Build command**: (acha wazi)
   - **Build output directory**: `/` (root)

4. Bonyeza **Save and Deploy**. Cloudflare itakupa URL ya aina
   `https://voiceinsightsafrica.com` ndani ya dakika chache.

5. (Hiari) Unganisha domain yako mwenyewe kwenye tab ya **Custom domains**.

## Muundo wa faili

```
site/
├── index.html
├── login.html
├── respondent.html
├── enumerator.html
├── app/          → Portal A (Client Dashboard)
├── admin/        → Portal C (Admin Console)
└── assets/
    ├── css/style.css   → design system (rangi, fonts, components)
    └── js/app.js       → sidebar/topbar injection + mock data + waveform generator
```

## Hatua zinazofuata (baada ya kuona "picha")

- Unganisha na Auth Worker halisi (badala ya `onsubmit` ya login.html)
- Badilisha mock data na fetch calls kwenda backend API (FastAPI/Workers)
- Ongeza Portal B ya WhatsApp webhook (respondent.html sasa ni web-only demo)
