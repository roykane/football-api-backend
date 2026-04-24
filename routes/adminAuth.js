/**
 * Admin auth — single-user, cookie-based session.
 *
 * Flow:
 *   POST /api/admin/login    { password }          → 200 + Set-Cookie
 *   POST /api/admin/logout                         → clears cookie
 *   GET  /api/admin/me                             → { authed: true } or 401
 *
 * No user DB. Password is whatever process.env.ADMIN_PASSWORD is set to.
 * Session token is a self-contained HMAC — no server-side store, survives
 * restarts as long as ADMIN_SECRET stays stable.
 *
 * Cookie: admin_session=<exp>.<hmac>, HttpOnly, SameSite=Lax, 7d TTL.
 */

const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days

function getSecret() {
  // Prefer a dedicated secret; fall back to ADMIN_PASSWORD so a fresh setup
  // still works. If neither is set, return null — all endpoints will 503.
  return process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || null;
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function buildToken(expMs) {
  const secret = getSecret();
  if (!secret) return null;
  const payload = String(expMs);
  return `${payload}.${sign(payload, secret)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [expStr, sig] = token.split('.');
  if (!expStr || !sig) return false;
  const secret = getSecret();
  if (!secret) return false;
  const expected = sign(expStr, secret);
  // Constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp)) return false;
  return exp > Date.now();
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  });
  return out;
}

function setSessionCookie(res, token, maxAgeSec) {
  const secureFlag = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly;${secureFlag} SameSite=Lax; Max-Age=${maxAgeSec}`
  );
}

function clearSessionCookie(res) {
  const secureFlag = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly;${secureFlag} SameSite=Lax; Max-Age=0`
  );
}

/** Middleware — attaches req.isAdmin, sends 401 if not authenticated. */
function requireAdmin(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!verifyToken(token)) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
  req.isAdmin = true;
  next();
}

// ─── Routes ──────────────────────────────────────────────────────────

router.post('/login', (req, res) => {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) {
    return res.status(503).json({ success: false, error: 'ADMIN_PASSWORD not set on server' });
  }
  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'missing password' });
  }

  // Constant-time compare to shave off timing side-channels.
  const a = Buffer.from(password);
  const b = Buffer.from(configured);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    return res.status(401).json({ success: false, error: 'wrong password' });
  }

  const exp = Date.now() + SESSION_TTL_MS;
  const token = buildToken(exp);
  if (!token) {
    return res.status(503).json({ success: false, error: 'server secret missing' });
  }
  setSessionCookie(res, token, Math.floor(SESSION_TTL_MS / 1000));
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!verifyToken(token)) {
    return res.status(401).json({ success: false, authed: false });
  }
  res.json({ success: true, authed: true });
});

module.exports = { router, requireAdmin };
