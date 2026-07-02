# VoiceInsights Africa — Full Prototype (v2)

Two parts:

- `site/`    — frontend (Cloudflare Pages), now in English, wired to call the real backend
- `backend/` — Cloudflare Worker + D1 database + R2 storage (the real "brain": auth, surveys, WhatsApp AI pipeline)

## Quick start

1. **Frontend only (what you already deployed):** works as a visual demo with mock data, same as before.
2. **Full working system:** follow `backend/README.md` step by step (~15 minutes), then update
   `site/assets/js/config.js` with your Worker URL and push to Git. Login, Dashboard, and Survey
   Builder will then use real data instead of mock data.

See `site/README.md` for frontend deploy details and `backend/README.md` for backend deploy details.
