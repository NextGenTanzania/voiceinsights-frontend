// src/auth.js — password hashing + JWT using only Web Crypto (works natively in Workers, no npm deps)

const PBKDF2_ITERATIONS = 100000;

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes.buffer;
}

export async function hashPassword(password, saltHex = null) {
  const salt = saltHex ? hexToBuf(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { hash: bufToHex(bits), salt: saltHex ? saltHex : bufToHex(salt) };
}

export async function verifyPassword(password, saltHex, expectedHashHex) {
  const { hash } = await hashPassword(password, saltHex);
  return hash === expectedHashHex;
}

function base64url(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlToBuf(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signJWT(payload, secret, expiresInSeconds = 60 * 60 * 24 * 7) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  const encHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encBody = base64url(new TextEncoder().encode(JSON.stringify(body)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${encHeader}.${encBody}`));
  return `${encHeader}.${encBody}.${base64url(sig)}`;
}

export async function verifyJWT(token, secret) {
  const [encHeader, encBody, encSig] = token.split('.');
  if (!encHeader || !encBody || !encSig) throw new Error('Malformed token');
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, base64urlToBuf(encSig), new TextEncoder().encode(`${encHeader}.${encBody}`));
  if (!valid) throw new Error('Invalid signature');
  const payload = JSON.parse(new TextDecoder().decode(base64urlToBuf(encBody)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

export function newId(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

// ============================================================
// TOTP (RFC 6238) — Time-based One-Time Passwords for 2FA.
// Compatible with Google Authenticator, Authy, 1Password, etc.
// Uses only Web Crypto (HMAC-SHA1) — no npm dependency needed.
// ============================================================

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(20)); // 160-bit secret
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let secret = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) secret += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  return secret;
}

function base32Decode(base32) {
  const clean = base32.toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}

async function hmacSha1(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, msgBytes);
  return new Uint8Array(sig);
}

async function totpAt(secretBase32, timeStepCounter) {
  const keyBytes = base32Decode(secretBase32);
  const counterBytes = new Uint8Array(8);
  let counter = timeStepCounter;
  for (let i = 7; i >= 0; i--) { counterBytes[i] = counter & 0xff; counter = Math.floor(counter / 256); }
  const hmac = await hmacSha1(keyBytes, counterBytes);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (binCode % 1000000).toString().padStart(6, '0');
}

// Verifies a 6-digit code, allowing ±1 time step (30s) of clock drift.
export async function verifyTotpCode(secretBase32, code) {
  const step = Math.floor(Date.now() / 1000 / 30);
  for (const offset of [0, -1, 1]) {
    if (await totpAt(secretBase32, step + offset) === code) return true;
  }
  return false;
}

export function totpAuthUri(secretBase32, accountEmail, issuer = 'VoiceInsights Africa') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountEmail)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
