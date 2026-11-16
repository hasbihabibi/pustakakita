'use strict';

const express = require('express');
const { pool, query, queryOne, withTransaction } = require('../db');
const { requireRole } = require('../auth');
const { Validator } = require('../validate');
const { setFlash, COVER_THEMES } = require('../helpers');

const router = express.Router();

const THEME_KEYS = Object.keys(COVER_THEMES);
const MANAGE_ROLES = ['admin', 'petugas'];

router.use('/kelola/buku', requireRole(...MANAGE_ROLES));

async function loadCategories() {
  return query('SELECT id, nama FROM categories ORDER BY nama ASC');
}

function emptyBook() {
  return {
    id: null,
    kode: '',
    judul: '',
    penulis: '',
    penerbit: '',
    tahun_terbit: '',
    category_id: '',
    deskripsi: '',
    stok_total: 1,
    cover_theme: 'laut',
    unggulan: 0,
  };
}

function validateBook(body) {
  const v = new Validator(body);

  const kodeRaw = v.string('kode', 'Kode buku', { min: 0, max: 20, required: false });
  if (kodeRaw && !/^[A-Z]{2}-\d{2,6}$/.test(kodeRaw.toUpperCase())) {
    v.fail('kode', 'Kode harus berformat PK-123 (2 huruf, tanda hubung, 2–6 angka).');
  }

  const judul = v.string('judul', 'Judul buku', { min: 2, max: 160 });
  const penulis = v.string('penulis', 'Penulis', { min: 2, max: 120 });
  const penerbit = v.string('penerbit', 'Penerbit', { min: 0, max: 120, required: false });
  const tahunRaw = new Validator(body).integer('tahun_terbit', 'Tahun terbit', { min: 1000, max: 2100, required: false });
  const tahun = body.tahun_terbit ? tahunRaw : null;
  if (body.tahun_terbit && (tahun === null || tahun < 1000 || tahun > 2100)) {
    v.fail('tahun_terbit', 'Tahun terbit harus antara 1000 dan 2100.');
  }

  const categoryId = v.integer('category_id', 'Kategori', { min: 1, max: 4_000_000_000, required: true });
  const deskripsi = v.string('deskripsi', 'Deskripsi', { min: 10, max: 2000 });
  const stokTotal = v.integer('stok_total', 'Stok eksemplar', { min: 0, max: 1000 });
  const coverTheme = v.enumValue('cover_theme', 'Tema sampul', THEME_KEYS, { fallback: null });
  const unggulan = v.boolean('unggulan');

  return {
    isValid: v.isValid,
    errors: v.errors,
    data: {
      kode: kodeRaw ? kodeRaw.toUpperCase() : '',
      judul,
      penulis,
      penerbit: penerbit || null,
      tahun_terbit: tahun,
      category_id: categoryId,
      deskripsi,
      stok_total: stokTotal,
      cover_theme: coverTheme || 'laut',
      unggulan: unggulan ? 1 : 0,
    },
  };
}

async function nextKode(connection) {
  const [[row]] = await connection.execute('SELECT COALESCE(MAX(id), 0) + 100 AS nomor FROM books');
  let nomor = row.nomor;
  // Hindari benturan kode bila baris pernah dihapus.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const kode = `PK-${nomor}`;
    const [[existing]] = await connection.execute('SELECT id FROM books WHERE kode = ? LIMIT 1', [kode]);
    if (!existing) return kode;
    nomor += 1;
  }
  throw new Error('Tidak dapat membuat kode buku otomatis. Isi kode secara manual.');
}

router.get('/kelola/buku', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 120);
    const kategori = Number.parseInt(req.query.kategori, 10);
    const hanyaHabis = req.query.habis === '1';

    const conditions = [];
    const params = [];
    if (q) {
      conditions.push('(b.judul LIKE ? OR b.kode LIKE ? OR b.penulis LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (Number.isInteger(kategori) && kategori > 0) {
      conditions.push('b.category_id = ?');
      params.push(kategori);
    }
    if (hanyaHabis) conditions.push('b.stok_tersedia = 0');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [books, categories, stats] = await Promise.all([
      query(
        `SELECT b.*, c.nama AS kategori,
                (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.status = 'dipinjam') AS dipinjam
           FROM books b
           JOIN categories c ON c.id = b.category_id
           ${where}
          ORDER BY b.judul ASC`,
        params,
      ),
      loadCategories(),
      queryOne(
        `SELECT COUNT(*) AS total_judul,
                COALESCE(SUM(stok_total), 0) AS total_eksemplar,
                COALESCE(SUM(stok_tersedia), 0) AS tersedia
           FROM books`,
      ),
    ]);

    res.render('books/index', {
      title: 'Kelola Buku',
      active: 'buku',
      books,
      categories,
      stats,
      filters: { q, kategori: Number.isInteger(kategori) ? kategori : null, habis: hanyaHabis },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/kelola/buku/baru', async (req, res, next) => {
  try {
    res.render('books/form', {
      title: 'Tambah Buku',
      active: 'buku',
      mode: 'create',
      book: emptyBook(),
      categories: await loadCategories(),
      themes: COVER_THEMES,
      errors: {},
    });
  } catch (error) {
    next(error);
  }
});

router.post('/kelola/buku', async (req, res, next) => {
  const { isValid, errors, data } = validateBook(req.body);

  try {
    if (!isValid) {
      res.status(422);
      return res.render('books/form', {
        title: 'Tambah Buku',
        active: 'buku',
        mode: 'create',
        book: { ...emptyBook(), ...req.body },
        categories: await loadCategories(),
        themes: COVER_THEMES,
        errors,
      });
    }

    const category = await queryOne('SELECT id FROM categories WHERE id = ?', [data.category_id]);
    if (!category) {
      res.status(422);
      return res.render('books/form', {
        title: 'Tambah Buku',
        active: 'buku',
        mode: 'create',
        book: { ...emptyBook(), ...req.body },
        categories: await loadCategories(),
        themes: COVER_THEMES,
        errors: { category_id: 'Kategori yang dipilih tidak ditemukan.' },
      });
    }

    await withTransaction(async (connection) => {
      const kode = data.kode || (await nextKode(connection));
      await connection.execute(
        `INSERT INTO books
           (kode, judul, penulis, penerbit, tahun_terbit, category_id, deskripsi,
            stok_total, stok_tersedia, cover_theme, unggulan, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          kode,
          data.judul,
          data.penulis,
          data.penerbit,
          data.tahun_terbit,
          data.category_id,
          data.deskripsi,
          data.stok_total,
          data.stok_total,
          data.cover_theme,
          data.unggulan,
          req.user.id,
        ],
      );
    });

    setFlash(req, 'sukses', `Buku "${data.judul}" berhasil ditambahkan.`);
    res.redirect('/kelola/buku');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(422);
      return res.render('books/form', {
        title: 'Tambah Buku',
        active: 'buku',
        mode: 'create',
        book: { ...emptyBook(), ...req.body },
        categories: await loadCategories(),
        themes: COVER_THEMES,
        errors: { kode: 'Kode buku tersebut sudah dipakai.' },
      });
    }
    next(error);
  }
});

router.get('/kelola/buku/:id/edit', async (req, res, next) => {
  try {
    const book = await queryOne('SELECT * FROM books WHERE id = ?', [Number.parseInt(req.params.id, 10)]);
    if (!book) {
      res.status(404);
      return res.render('errors/404', { title: 'Buku tidak ditemukan', active: 'buku' });
    }

    res.render('books/form', {
      title: 'Edit Buku',
      active: 'buku',
      mode: 'edit',
      book,
      categories: await loadCategories(),
      themes: COVER_THEMES,
      errors: {},
    });
  } catch (error) {
    next(error);
  }
});

router.post('/kelola/buku/:id', async (req, res, next) => {
  const id = Number.parseInt(req.params.id, 10);
  const { isValid, errors, data } = validateBook(req.body);

  try {
    const existing = await queryOne('SELECT * FROM books WHERE id = ?', [id]);
    if (!existing) {
      res.status(404);
      return res.render('errors/404', { title: 'Buku tidak ditemukan', active: 'buku' });
    }

    const dipinjam = existing.stok_total - existing.stok_tersedia;
    const stokError =
      data.stok_total !== null && data.stok_total < dipinjam
        ? `Stok total tidak boleh lebih kecil dari jumlah yang sedang dipinjam (${dipinjam} eksemplar).`
        : null;

    if (!isValid || stokError) {
      res.status(422);
      return res.render('books/form', {
        title: 'Edit Buku',
        active: 'buku',
        mode: 'edit',
        book: { ...existing, ...req.body, id },
        categories: await loadCategories(),
        themes: COVER_THEMES,
        errors: stokError ? { ...errors, stok_total: stokError } : errors,
      });
    }

    await pool.execute(
      `UPDATE books SET kode = ?, judul = ?, penulis = ?, penerbit = ?, tahun_terbit = ?,
              category_id = ?, deskripsi = ?, stok_total = ?, stok_tersedia = ?,
              cover_theme = ?, unggulan = ?
        WHERE id = ?`,
      [
        data.kode || existing.kode,
        data.judul,
        data.penulis,
        data.penerbit,
        data.tahun_terbit,
        data.category_id,
        data.deskripsi,
        data.stok_total,
        Math.max(data.stok_total - dipinjam, 0),
        data.cover_theme,
        data.unggulan,
        id,
      ],
    );

    setFlash(req, 'sukses', `Buku "${data.judul}" berhasil diperbarui.`);
    res.redirect('/kelola/buku');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(422);
      return res.render('books/form', {
        title: 'Edit Buku',
        active: 'buku',
        mode: 'edit',
        book: { ...req.body, id },
        categories: await loadCategories(),
        themes: COVER_THEMES,
        errors: { kode: 'Kode buku tersebut sudah dipakai buku lain.' },
      });
    }
    next(error);
  }
});

router.post('/kelola/buku/:id/hapus', async (req, res, next) => {
  const id = Number.parseInt(req.params.id, 10);

  try {
    const book = await queryOne('SELECT id, judul FROM books WHERE id = ?', [id]);
    if (!book) {
      setFlash(req, 'galat', 'Buku tidak ditemukan.');
      return res.redirect('/kelola/buku');
    }

    const riwayat = await queryOne('SELECT COUNT(*) AS total FROM loans WHERE book_id = ?', [id]);
    if (riwayat.total > 0) {
      setFlash(
        req,
        'galat',
        `"${book.judul}" tidak dapat dihapus karena memiliki ${riwayat.total} riwayat peminjaman. Set stok menjadi 0 bila buku ditarik dari rak.`,
      );
      return res.redirect('/kelola/buku');
    }

    await pool.execute('DELETE FROM books WHERE id = ?', [id]);
    setFlash(req, 'sukses', `Buku "${book.judul}" telah dihapus.`);
    res.redirect('/kelola/buku');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
