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

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

/** PORT=0 atau nilai tidak valid akan membuat server tidak dapat dihubungi, jadi pakai 3000. */
const PORT = (function resolvePort(value) {
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : 3000;
})(process.env.PORT);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProduction ? '7d' : 0 }));

app.use(
  session({
    name: 'pustakakita.sid',
    secret: process.env.SESSION_SECRET || 'pustakakita-development-secret-change-me',
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

// Keamanan dasar untuk semua respons.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; form-action 'self'; frame-ancestors 'self'; base-uri 'self'",
  );
  next();
});

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
  console.error('Kesalahan server:', error);
  res.status(error.status || 500).render('errors/500', {
    title: 'Terjadi kesalahan',
    active: '',
    detail: isProduction ? null : error.message,
  });
});

const server = app.listen(PORT, () => {
  console.log(`PustakaKita berjalan di http://localhost:${PORT}`);
});

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
