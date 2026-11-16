'use strict';

const express = require('express');
const { queryOne, withTransaction } = require('../db');
const { hashPassword, verifyPasswordForUser } = require('../auth');
const { Validator } = require('../validate');
const { assignMemberNumber } = require('../member-number');
const { setFlash, loginRedirectFor } = require('../helpers');
const rateLimit = require('../rate-limit');
const { securityLog } = require('../security-log');

const router = express.Router();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_IP_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_IP_MAX_ATTEMPTS = 40;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_MAX_ATTEMPTS = 10;
const MAX_PASSWORD_LENGTH = 200;

/**
 * Hanya izinkan path internal sederhana.
 * Menolak "//host", backslash (browser dapat menormalkannya menjadi "//host"),
 * karakter kontrol, dan nilai yang terlalu panjang.
 */
function safeNext(next) {
  if (typeof next !== 'string') return null;
  const value = next.trim();
  if (!value || value.length > 512) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (/[\\\u0000-\u001F\u007F]/.test(value)) return null;
  return value;
}

router.get('/login', (req, res) => {
  if (req.user) return res.redirect(loginRedirectFor(req.user.role));
  res.render('auth/login', {
    title: 'Masuk',
    active: 'login',
    errors: {},
    values: {},
    next: safeNext(req.query.next) || '',
  });
});

router.post('/login', async (req, res, next) => {
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 160);
  const password = String(req.body.password || '');
  const nextUrl = safeNext(req.body.next) || '';
  const errors = {};

  const emailKey = `login:${email}`;
  const ipKey = `login-ip:${req.ip}`;
  const emailGate = rateLimit.check(emailKey, { limit: LOGIN_MAX_ATTEMPTS });
  const ipGate = rateLimit.check(ipKey, { limit: LOGIN_IP_MAX_ATTEMPTS });

  try {
    if (!email) errors.email = 'Email wajib diisi.';
    if (!password) errors.password = 'Kata sandi wajib diisi.';
    if (password.length > MAX_PASSWORD_LENGTH) errors.password = 'Kata sandi tidak valid.';

    if (Object.keys(errors).length === 0 && (emailGate.blocked || ipGate.blocked)) {
      securityLog('login_blocked', {
        email,
        ip: req.ip,
        retryAfterMs: Math.max(emailGate.retryAfterMs, ipGate.retryAfterMs),
      });
      errors.umum = 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.';
    }

    if (Object.keys(errors).length === 0) {
      const user = await queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);

      // Verifikasi tetap dijalankan walau email tidak ada agar waktu respons serupa
      // dan tidak bisa dipakai menebak email terdaftar.
      if (!verifyPasswordForUser(password, user)) {
        rateLimit.record(emailKey, { limit: LOGIN_MAX_ATTEMPTS, windowMs: LOGIN_WINDOW_MS });
        rateLimit.record(ipKey, { limit: LOGIN_IP_MAX_ATTEMPTS, windowMs: LOGIN_IP_WINDOW_MS });
        securityLog('login_failed', { email, ip: req.ip });
        errors.umum = 'Email atau kata sandi salah.';
      } else if (user.status !== 'aktif') {
        securityLog('login_inactive_account', { email, ip: req.ip });
        errors.umum = 'Akun Anda sedang dinonaktifkan. Hubungi administrator perpustakaan.';
      } else {
        rateLimit.clear(emailKey);
        rateLimit.clear(ipKey);
        req.session.regenerate((regenerateError) => {
          if (regenerateError) return next(regenerateError);
          req.session.userId = user.id;
          req.session.role = user.role;
          req.session.save((saveError) => {
            if (saveError) return next(saveError);
            setFlash(req, 'sukses', `Selamat datang, ${user.nama}.`);
            res.redirect(nextUrl || loginRedirectFor(user.role));
          });
        });
        return;
      }
    }

    res.status(422).render('auth/login', {
      title: 'Masuk',
      active: 'login',
      errors,
      values: { email },
      next: nextUrl,
    });
  } catch (error) {
    next(error);
  }
});

function renderRegister(res, { errors = {}, values = {}, status = 200 } = {}) {
  res.status(status);
  return res.render('auth/register', {
    title: 'Daftar Akun',
    active: 'daftar',
    errors,
    values,
  });
}

router.get('/daftar', (req, res) => {
  if (req.user) return res.redirect(loginRedirectFor(req.user.role));
  return renderRegister(res);
});

/** Pendaftaran mandiri khusus peran anggota; peran admin/petugas hanya dibuat oleh admin. */
router.post('/daftar', async (req, res, next) => {
  const registerKey = `daftar:${req.ip}`;
  const gate = rateLimit.check(registerKey, { limit: REGISTER_MAX_ATTEMPTS });
  if (gate.blocked) {
    securityLog('register_blocked', { ip: req.ip });
    return renderRegister(res, {
      errors: { umum: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.' },
      status: 429,
    });
  }
  rateLimit.record(registerKey, { limit: REGISTER_MAX_ATTEMPTS, windowMs: REGISTER_WINDOW_MS });

  const v = new Validator(req.body);
  const nama = v.personName('nama', 'Nama lengkap', { min: 2, max: 120 });
  const email = v.email('email', 'Email');
  const telepon = v.phone('telepon', 'Nomor WhatsApp', { mobile: true });
  const alamat = v.string('alamat', 'Alamat', { min: 0, max: 255, required: false });
  const password = v.password('password', 'Kata sandi', { min: 8, mixed: true });
  const konfirmasi = String(req.body.konfirmasi || '');

  if (!konfirmasi) {
    v.fail('konfirmasi', 'Ulangi kata sandi wajib diisi.');
  } else if (konfirmasi.length > MAX_PASSWORD_LENGTH) {
    v.fail('konfirmasi', 'Ulangi kata sandi maksimal 200 karakter.');
  } else if (password && konfirmasi !== password) {
    v.fail('konfirmasi', 'Kata sandi dan ulangannya tidak cocok.');
  }

  const values = { nama, email, telepon, alamat };

  try {
    if (!v.isValid) return renderRegister(res, { errors: v.errors, values, status: 422 });

    const existing = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing) {
      return renderRegister(res, { errors: { email: 'Email ini sudah terdaftar. Silakan masuk.' }, values, status: 422 });
    }

    const userId = await withTransaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO users (nama, email, password_hash, role, telepon, alamat, status)
         VALUES (?, ?, ?, 'anggota', ?, ?, 'aktif')`,
        [nama, email, hashPassword(password), telepon || null, alamat || null],
      );
      await assignMemberNumber(connection, result.insertId);
      return result.insertId;
    });

    securityLog('register_success', { userId, email });

    req.session.regenerate((regenerateError) => {
      if (regenerateError) return next(regenerateError);
      req.session.userId = userId;
      req.session.role = 'anggota';
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        setFlash(req, 'sukses', 'Pendaftaran berhasil. Selamat datang di PustakaKita!');
        res.redirect('/');
      });
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return renderRegister(res, { errors: { email: 'Email ini sudah terdaftar. Silakan masuk.' }, values, status: 422 });
    }
    next(error);
  }
});

router.post('/logout', (req, res) => {
  const userId = req.user?.id;
  req.session.destroy(() => {
    res.clearCookie('pustakakita.sid');
    if (userId) securityLog('logout', { userId });
    res.redirect('/login');
  });
});

module.exports = router;
