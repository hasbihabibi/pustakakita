'use strict';

const express = require('express');
const { query, queryOne } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { loanState } = require('../helpers');

const router = express.Router();

router.get('/dashboard', requireAuth, async (req, res, next) => {
  if (req.user.role === 'anggota') return res.redirect('/');

  try {
    const [books, categories, users, loans, ratings, recentLoans, topBooks, overdueSoon] = await Promise.all([
      queryOne(
        `SELECT COUNT(*) AS judul,
                COALESCE(SUM(stok_total), 0) AS eksemplar,
                COALESCE(SUM(stok_tersedia), 0) AS tersedia
           FROM books`,
      ),
      queryOne('SELECT COUNT(*) AS total FROM categories'),
      queryOne(
        `SELECT COUNT(*) AS total,
                SUM(role = 'anggota' AND status = 'aktif') AS anggota_aktif
           FROM users`,
      ),
      queryOne(
        `SELECT SUM(status = 'dipinjam') AS aktif,
                SUM(status = 'dipinjam' AND tanggal_jatuh_tempo < CURDATE()) AS terlambat,
                SUM(status = 'dikembalikan') AS selesai,
                COUNT(*) AS total
           FROM loans`,
      ),
      queryOne('SELECT COALESCE(AVG(nilai), 0) AS rata_rata, COUNT(*) AS total FROM ratings'),
      query(
        `SELECT l.id, l.status, l.tanggal_pinjam, l.tanggal_jatuh_tempo, l.tanggal_kembali,
                b.judul, b.kode, u.nama AS peminjam, u.no_anggota
           FROM loans l
           JOIN books b ON b.id = l.book_id
           JOIN users u ON u.id = l.user_id
          ORDER BY l.tanggal_pinjam DESC
          LIMIT 8`,
      ),
      query(
        `SELECT b.judul, b.kode, COUNT(l.id) AS jumlah_pinjam
           FROM loans l
           JOIN books b ON b.id = l.book_id
          GROUP BY b.id
          ORDER BY jumlah_pinjam DESC, b.judul ASC
          LIMIT 5`,
      ),
      query(
        `SELECT l.id, l.tanggal_jatuh_tempo, b.judul, u.nama AS peminjam
           FROM loans l
           JOIN books b ON b.id = l.book_id
           JOIN users u ON u.id = l.user_id
          WHERE l.status = 'dipinjam' AND l.tanggal_jatuh_tempo <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)
          ORDER BY l.tanggal_jatuh_tempo ASC
          LIMIT 5`,
      ),
    ]);

    res.render('dashboard/index', {
      title: 'Dashboard',
      active: 'dashboard',
      books,
      categories,
      users,
      loans,
      ratings,
      recentLoans: recentLoans.map((loan) => ({ ...loan, state: loanState(loan) })),
      topBooks,
      overdueSoon,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/pengaturan', requireRole('admin'), (req, res) => {
  res.render('settings/index', {
    title: 'Pengaturan Perpustakaan',
    active: 'pengaturan',
    errors: {},
    values: res.locals.settings,
  });
});

router.post('/admin/pengaturan', requireRole('admin'), async (req, res, next) => {
  const { Validator } = require('../validate');
  const { invalidateSettingsCache } = require('../settings');

  const v = new Validator(req.body);
  const nama = v.string('nama_perpustakaan', 'Nama perpustakaan', { min: 2, max: 80 });
  const whatsapp = v.string('admin_whatsapp', 'Nomor WhatsApp admin', { min: 8, max: 20 });
  const jam = v.string('jam_layanan', 'Jam layanan', { min: 2, max: 120 });
  const alamat = v.string('alamat', 'Alamat', { min: 2, max: 255 });

  if (whatsapp && !/^[0-9+\-\s()]{8,20}$/.test(whatsapp)) {
    v.fail('admin_whatsapp', 'Nomor WhatsApp hanya boleh berisi angka dan tanda baca nomor telepon.');
  }

  const values = { nama_perpustakaan: nama, admin_whatsapp: whatsapp, jam_layanan: jam, alamat };

  try {
    if (!v.isValid) {
      res.status(422);
      return res.render('settings/index', {
        title: 'Pengaturan Perpustakaan',
        active: 'pengaturan',
        errors: v.errors,
        values: { ...res.locals.settings, ...values },
      });
    }

    const entries = Object.entries(values);
    for (const [key, value] of entries) {
      await query(
        'INSERT INTO settings (nama, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)',
        [key, value],
      );
    }

    invalidateSettingsCache();
    res.locals.settings = await require('../settings').getSettings({ force: true });
    const { setFlash } = require('../helpers');
    setFlash(req, 'sukses', 'Pengaturan perpustakaan berhasil disimpan.');
    res.redirect('/admin/pengaturan');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
