// assets/js/config.js
// After you deploy the backend (`wrangler deploy` inside /backend), Cloudflare gives you
// a URL like: https://voiceinsights-api.<your-subdomain>.workers.dev
// Paste it below. This is the ONLY line you need to change to connect the frontend
// to your real backend.
const PRODUCTION_API_BASE_URL = 'https://voiceinsights-api.kitentyatsnp.workers.dev';
// Program Beta Sprint 2.1 — this frontend now genuinely gets deployed to a
// dedicated Preview Pages project (voiceinsights-frontend-preview.pages.dev
// / preview.voiceinsightsafrica.com) for live UAT against the Preview
// Worker + Preview D1. Without this, there was no way to point the SAME
// static files at the preview API without hand-editing this file before
// every preview deploy and reverting after — a real, recurring risk of
// accidentally shipping a preview URL to production. Detected purely from
// the browser's own hostname; production is unaffected.
const PREVIEW_API_BASE_URL = 'https://voiceinsights-api-preview.kitentyatsnp.workers.dev';
const API_BASE_URL = (typeof window !== 'undefined' && /(^|\.)voiceinsights-frontend-preview\.pages\.dev$|^preview\.voiceinsightsafrica\.com$/.test(window.location.hostname))
  ? PREVIEW_API_BASE_URL
  : PRODUCTION_API_BASE_URL;

async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = localStorage.getItem('vi_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // RC1 Part 2 — callers that need to distinguish a real conflict (409,
    // e.g. optimistic-concurrency rejection) from any other failure can
    // check err.status/err.data rather than pattern-matching err.message.
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function requireLogin() {
  const token = localStorage.getItem('vi_token');
  if (!token) { window.location.href = '/login.html'; return false; }
  return true;
}

async function logout() {
  // V213: revoke the session server-side first so the token can't be reused,
  // then clear local state. Navigation proceeds even if the call fails
  // (offline / already-expired) — the token is cleared locally regardless.
  try {
    if (localStorage.getItem('vi_token')) {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    }
  } catch (_) { /* proceed to clear + redirect regardless */ }
  localStorage.removeItem('vi_token');
  localStorage.removeItem('vi_user');
  window.location.href = '/login.html';
}
