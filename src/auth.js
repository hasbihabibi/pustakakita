'use strict';

const crypto = require('node:crypto');
const { queryOne } = require('./db');

const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

/** Hash password dengan scrypt bawaan Node (tanpa dependensi native). */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, expectedHex] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length, SCRYPT_OPTIONS);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** Middleware: muat ulang data pengguna dari DB agar perubahan peran/status langsung berlaku. */
async function loadUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.role = null;
  if (!req.session?.userId) return next();

  try {
    const user = await queryOne(
      'SELECT id, nama, email, role, no_anggota, telepon, alamat, status FROM users WHERE id = ? LIMIT 1',
      [req.session.userId],
    );

    if (!user || user.status !== 'aktif') {
      req.session.destroy(() => {});
      req.flash = null;
      req.session = null;
      res.locals.currentUser = null;
      res.locals.role = null;
      return next();
    }

    req.user = user;
    res.locals.currentUser = user;
    res.locals.role = user.role;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  const target = req.method === 'GET' ? req.originalUrl : '/';
  return res.redirect(`/login?next=${encodeURIComponent(target)}`);
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (!roles.includes(req.user.role)) {
      res.status(403);
      return res.render('errors/403', {
        title: 'Akses ditolak',
        active: '',
      });
    }
    return next();
  };
}

/** CSRF: token per sesi, disisipkan ke semua form lewat res.locals.csrfToken. */
function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const submitted = String(req.body?._csrf || req.get('x-csrf-token') || '');
  const expected = req.session.csrfToken;
  const valid =
    submitted.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(expected));

  if (!valid) {
    res.status(403);
    return res.render('errors/403', {
      title: 'Sesi formulir kedaluwarsa',
      active: '',
      detail: 'Token keamanan formulir tidak cocok. Muat ulang halaman lalu coba lagi.',
    });
  }
  return next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  loadUser,
  requireAuth,
  requireRole,
  csrfProtection,
};
