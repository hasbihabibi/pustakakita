'use strict';

const express = require('express');
const { pool, query, queryOne } = require('../db');
const { requireRole } = require('../auth');
const { Validator } = require('../validate');
const { setFlash } = require('../helpers');

const router = express.Router();

router.use('/kelola/kategori', requireRole('admin', 'petugas'));

router.get('/kelola/kategori', async (req, res, next) => {
  try {
    const categories = await query(
      `SELECT c.*, COUNT(b.id) AS jumlah_buku, COALESCE(SUM(b.stok_total), 0) AS total_eksemplar
         FROM categories c
         LEFT JOIN books b ON b.category_id = c.id
        GROUP BY c.id
        ORDER BY c.nama ASC`,
    );

    res.render('categories/index', {
      title: 'Kelola Kategori',
      active: 'kategori',
      categories,
      errors: {},
      values: {},
      editId: null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/kelola/kategori', async (req, res, next) => {
  const v = new Validator(req.body);
  const nama = v.string('nama', 'Nama kategori', { min: 2, max: 60 });
  const deskripsi = v.string('deskripsi', 'Deskripsi', { min: 0, max: 255, required: false });

  try {
    if (!v.isValid) {
      const categories = await query(
        `SELECT c.*, COUNT(b.id) AS jumlah_buku, COALESCE(SUM(b.stok_total), 0) AS total_eksemplar
           FROM categories c LEFT JOIN books b ON b.category_id = c.id
          GROUP BY c.id ORDER BY c.nama ASC`,
      );
      res.status(422);
      return res.render('categories/index', {
        title: 'Kelola Kategori',
        active: 'kategori',
        categories,
        errors: v.errors,
        values: { nama, deskripsi },
        editId: null,
      });
    }

    await pool.execute('INSERT INTO categories (nama, deskripsi) VALUES (?, ?)', [nama, deskripsi || null]);
    setFlash(req, 'sukses', `Kategori "${nama}" berhasil ditambahkan.`);
    res.redirect('/kelola/kategori');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      setFlash(req, 'galat', `Kategori "${nama}" sudah ada.`);
      return res.redirect('/kelola/kategori');
    }
    next(error);
  }
});

router.post('/kelola/kategori/:id', async (req, res, next) => {
  const id = Number.parseInt(req.params.id, 10);
  const v = new Validator(req.body);
  const nama = v.string('nama', 'Nama kategori', { min: 2, max: 60 });
  const deskripsi = v.string('deskripsi', 'Deskripsi', { min: 0, max: 255, required: false });

  try {
    const existing = await queryOne('SELECT id FROM categories WHERE id = ?', [id]);
    if (!existing) {
      setFlash(req, 'galat', 'Kategori tidak ditemukan.');
      return res.redirect('/kelola/kategori');
    }

    if (!v.isValid) {
      setFlash(req, 'galat', v.errors.nama || v.errors.deskripsi);
      return res.redirect('/kelola/kategori');
    }

    await pool.execute('UPDATE categories SET nama = ?, deskripsi = ? WHERE id = ?', [nama, deskripsi || null, id]);
    setFlash(req, 'sukses', `Kategori "${nama}" berhasil diperbarui.`);
    res.redirect('/kelola/kategori');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      setFlash(req, 'galat', `Nama kategori "${nama}" sudah dipakai.`);
      return res.redirect('/kelola/kategori');
    }
    next(error);
  }
});

router.post('/kelola/kategori/:id/hapus', async (req, res, next) => {
  const id = Number.parseInt(req.params.id, 10);

  try {
    const category = await queryOne('SELECT id, nama FROM categories WHERE id = ?', [id]);
    if (!category) {
      setFlash(req, 'galat', 'Kategori tidak ditemukan.');
      return res.redirect('/kelola/kategori');
    }

    const dipakai = await queryOne('SELECT COUNT(*) AS total FROM books WHERE category_id = ?', [id]);
    if (dipakai.total > 0) {
      setFlash(
        req,
        'galat',
        `Kategori "${category.nama}" masih dipakai oleh ${dipakai.total} buku. Pindahkan buku tersebut ke kategori lain terlebih dahulu.`,
      );
      return res.redirect('/kelola/kategori');
    }

    await pool.execute('DELETE FROM categories WHERE id = ?', [id]);
    setFlash(req, 'sukses', `Kategori "${category.nama}" telah dihapus.`);
    res.redirect('/kelola/kategori');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
