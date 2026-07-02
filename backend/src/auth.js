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
