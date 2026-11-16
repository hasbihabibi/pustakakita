'use strict';

require('dotenv').config();

const path = require('node:path');
const express = require('express');
const session = require('express-session');

const { pool } = require('./src/db');
const { MySQLSessionStore } = require('./src/session-store');
const { loadUser, csrfProtection } = require('./src/auth');
const helpers = require('./src/helpers');
const { getSettings } = require('./src/settings');
const { securityLog } = require('./src/security-log');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

/** Tanpa kunci sesi yang kuat, cookie sesi dapat dipalsukan. Gagal cepat di produksi. */
if (isProduction && !process.env.SESSION_SECRET) {
  console.error('[FATAL] SESSION_SECRET wajib diisi saat NODE_ENV=production. Server dihentikan.');
  process.exit(1);
}
if (!isProduction && !process.env.SESSION_SECRET) {
  console.warn('[peringatan] SESSION_SECRET belum diisi; memakai kunci pengembangan. Jangan dipakai di produksi.');
}
const SESSION_SECRET = process.env.SESSION_SECRET || 'pustakakita-development-secret-change-me';

/** PORT=0 atau nilai tidak valid akan membuat server tidak dapat dihubungi, jadi pakai 3000. */
const PORT = (function resolvePort(value) {
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : 3000;
})(process.env.PORT);

/**
 * Di belakang proxy (Vercel, nginx) jumlah hop harus diatur agar req.ip benar.
 * Di mesin lokal tanpa proxy, header X-Forwarded-For tidak boleh dipercaya
 * karena bisa dipakai untuk memalsukan alamat IP dan mengakali rate limit.
 */
function resolveTrustProxy(value) {
  if (value === undefined || value === '') return isProduction ? 1 : false;
  if (value === 'false' || value === '0') return false;
  if (value === 'true') return 1;
  const hops = Number.parseInt(value, 10);
  return Number.isInteger(hops) && hops >= 0 ? hops : isProduction ? 1 : false;
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', resolveTrustProxy(process.env.TRUST_PROXY));
app.disable('x-powered-by');

app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Header keamanan dipasang sebelum aset statis agar CSS/JS juga mendapatkannya.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "script-src 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
].join('; ');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProduction ? '7d' : 0 }));

// Halaman dinamis berisi data pribadi: jangan sampai disimpan cache browser/proxy.
// Aset statis sudah selesai dikirim di middleware sebelumnya sehingga tetap bisa di-cache.
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(
  session({
    name: 'pustakakita.sid',
    secret: SESSION_SECRET,
    store: new MySQLSessionStore({ ttlMs: 1000 * 60 * 60 * 8 }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

app.use(loadUser);

app.use(async (req, res, next) => {
  try {
    res.locals.settings = await getSettings();
    Object.assign(res.locals, helpers);
    helpers.flashMiddleware(req, res, () => {});
    res.locals.currentPath = req.path;
    res.locals.query = req.query;
    next();
  } catch (error) {
    next(error);
  }
});

// CSRF dipasang setelah locals siap agar halaman galat dapat dirender utuh.
app.use(csrfProtection);

app.use(require('./src/routes/auth'));
app.use(require('./src/routes/catalog'));
app.use(require('./src/routes/books'));
app.use(require('./src/routes/categories'));
app.use(require('./src/routes/users'));
app.use(require('./src/routes/dashboard'));

app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Halaman tidak ditemukan', active: '' });
});

app.use((error, req, res, _next) => {
  securityLog('server_error', { path: req.originalUrl, message: error.message });
  res.status(error.status || 500).render('errors/500', {
    title: 'Terjadi kesalahan',
    active: '',
    detail: isProduction ? null : error.message,
  });
});

const server = app.listen(PORT, () => {
  console.log(`PustakaKita berjalan di http://localhost:${PORT}`);
});

// Batasi koneksi lambat (slowloris) tanpa mengganggu permintaan normal.
server.headersTimeout = 15_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;

async function shutdown(signal) {
  console.log(`\n${signal} diterima, menutup server...`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
