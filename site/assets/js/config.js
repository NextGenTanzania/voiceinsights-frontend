// assets/js/config.js
// After you deploy the backend (`wrangler deploy` inside /backend), Cloudflare gives you
// a URL like: https://voiceinsights-api.<your-subdomain>.workers.dev
// Paste it below. This is the ONLY line you need to change to connect the frontend
// to your real backend.
const API_BASE_URL = 'https://voiceinsights-api.kitentyatsnp.workers.dev';

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
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function requireLogin() {
  const token = localStorage.getItem('vi_token');
  if (!token) { window.location.href = '/login.html'; return false; }
  return true;
}

function logout() {
  localStorage.removeItem('vi_token');
  localStorage.removeItem('vi_user');
  window.location.href = '/login.html';
}
