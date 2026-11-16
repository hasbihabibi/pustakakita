'use strict';

const express = require('express');
const { queryOne, withTransaction } = require('../db');
const { verifyPassword, hashPassword } = require('../auth');
const { Validator } = require('../validate');
const { assignMemberNumber } = require('../member-number');
const { setFlash, loginRedirectFor } = require('../helpers');

const router = express.Router();

/** Pembatas percobaan login sederhana (per IP + email) untuk meredam brute force. */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function attemptKey(req, email) {
  return `${req.ip}|${email}`;
}

function tooManyAttempts(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

function safeNext(next) {
  if (typeof next !== 'string') return null;
  if (!next.startsWith('/') || next.startsWith('//')) return null;
  return next;
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
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const nextUrl = safeNext(req.body.next) || '';
  const key = attemptKey(req, email);
  const errors = {};

  try {
    if (!email) errors.email = 'Email wajib diisi.';
    if (!password) errors.password = 'Kata sandi wajib diisi.';

    if (Object.keys(errors).length === 0 && tooManyAttempts(key)) {
      errors.umum = 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.';
    }

    if (Object.keys(errors).length === 0) {
      const user = await queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);

      if (!user || !verifyPassword(password, user.password_hash)) {
        recordFailure(key);
        errors.umum = 'Email atau kata sandi salah.';
      } else if (user.status !== 'aktif') {
        errors.umum = 'Akun Anda sedang dinonaktifkan. Hubungi administrator perpustakaan.';
      } else {
        attempts.delete(key);
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
  const v = new Validator(req.body);
  const nama = v.personName('nama', 'Nama lengkap', { min: 2, max: 120 });
  const email = v.email('email', 'Email');
  const telepon = v.phone('telepon', 'Nomor WhatsApp', { mobile: true });
  const alamat = v.string('alamat', 'Alamat', { min: 0, max: 255, required: false });
  const password = v.password('password', 'Kata sandi', { min: 8, mixed: true });
  const konfirmasi = String(req.body.konfirmasi || '');

  if (!konfirmasi) {
    v.fail('konfirmasi', 'Ulangi kata sandi wajib diisi.');
  } else if (konfirmasi.length > 200) {
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
  req.session.destroy(() => {
    res.clearCookie('pustakakita.sid');
    res.redirect('/login');
  });
});

module.exports = router;
