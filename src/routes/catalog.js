'use strict';

const express = require('express');
const { pool, query, queryOne, withTransaction } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { setFlash, whatsappUrl, loanState } = require('../helpers');

const router = express.Router();

const SORTS = {
  unggulan: 'b.unggulan DESC, b.judul ASC',
  terbaru: 'b.created_at DESC',
  judul_asc: 'b.judul ASC',
  judul_desc: 'b.judul DESC',
  stok_desc: 'b.stok_tersedia DESC, b.judul ASC',
  rating_desc: 'rata_rata DESC, jumlah_ulasan DESC, b.judul ASC',
};

const MAKS_PINJAM_AKTIF = 3;
const LAMA_PINJAM_HARI = 7;

function catalogFilters(queryParams) {
  const q = String(queryParams.q || '').trim().slice(0, 120);
  const kategori = Number.parseInt(queryParams.kategori, 10);
  return {
    q,
    kategori: Number.isInteger(kategori) && kategori > 0 ? kategori : null,
    unggulan: queryParams.unggulan === '1',
    tersedia: queryParams.tersedia === '1',
    sort: Object.hasOwn(SORTS, queryParams.sort) ? queryParams.sort : 'unggulan',
  };
}

function buildWhere(filters) {
  const conditions = [];
  const params = [];

  if (filters.q) {
    conditions.push('(b.judul LIKE ? OR b.penulis LIKE ? OR b.kode LIKE ? OR b.deskripsi LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like, like);
  }
  if (filters.kategori) {
    conditions.push('b.category_id = ?');
    params.push(filters.kategori);
  }
  if (filters.unggulan) conditions.push('b.unggulan = 1');
  if (filters.tersedia) conditions.push('b.stok_tersedia > 0');

  return {
    sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

async function listBooks(filters) {
  const where = buildWhere(filters);
  return query(
    `SELECT b.*, c.nama AS kategori,
            COALESCE(AVG(r.nilai), 0) AS rata_rata,
            COUNT(r.id) AS jumlah_ulasan
       FROM books b
       JOIN categories c ON c.id = b.category_id
       LEFT JOIN ratings r ON r.book_id = b.id
       ${where.sql}
      GROUP BY b.id, c.nama
      ORDER BY ${SORTS[filters.sort]}
      LIMIT 200`,
    where.params,
  );
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const filters = catalogFilters(req.query);
    const [books, categories, summary] = await Promise.all([
      listBooks(filters),
      query('SELECT id, nama FROM categories ORDER BY nama ASC'),
      queryOne(
        `SELECT COUNT(*) AS total_judul,
                COALESCE(SUM(stok_total), 0) AS total_eksemplar,
                COALESCE(SUM(stok_tersedia), 0) AS total_tersedia
           FROM books`,
      ),
    ]);

    const myActiveLoans = req.user
      ? await query(
          `SELECT l.book_id, l.id, l.tanggal_jatuh_tempo
             FROM loans l
            WHERE l.user_id = ? AND l.status = 'dipinjam'`,
          [req.user.id],
        )
      : [];

    const activeByBook = new Map(myActiveLoans.map((loan) => [loan.book_id, loan]));

    res.render('catalog/index', {
      title: 'Katalog Buku',
      active: 'katalog',
      books,
      categories,
      filters,
      summary,
      activeByBook,
      sorts: [
        ['unggulan', 'Koleksi Unggulan Teratas'],
        ['terbaru', 'Terbaru Ditambahkan'],
        ['judul_asc', 'Judul Buku (A – Z)'],
        ['judul_desc', 'Judul Buku (Z – A)'],
        ['stok_desc', 'Stok Eksemplar Terbanyak'],
        ['rating_desc', 'Rating Pembaca Tertinggi'],
      ],
    });
  } catch (error) {
    next(error);
  }
});

router.get('/buku/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return next();

    const book = await queryOne(
      `SELECT b.*, c.nama AS kategori,
              COALESCE(AVG(r.nilai), 0) AS rata_rata,
              COUNT(r.id) AS jumlah_ulasan
         FROM books b
         JOIN categories c ON c.id = b.category_id
         LEFT JOIN ratings r ON r.book_id = b.id
        WHERE b.id = ?
        GROUP BY b.id, c.nama`,
      [id],
    );

    if (!book) {
      res.status(404);
      return res.render('errors/404', { title: 'Buku tidak ditemukan', active: 'katalog' });
    }

    const [reviews, myLoans, totalPinjam] = await Promise.all([
      query(
        `SELECT r.nilai, r.ulasan, r.created_at, u.nama
           FROM ratings r
           JOIN users u ON u.id = r.user_id
          WHERE r.book_id = ?
          ORDER BY r.updated_at DESC
          LIMIT 20`,
        [id],
      ),
      query(
        `SELECT * FROM loans WHERE book_id = ? AND user_id = ? ORDER BY id DESC LIMIT 5`,
        [id, req.user.id],
      ),
      queryOne('SELECT COUNT(*) AS total FROM loans WHERE book_id = ?', [id]),
    ]);

    const activeLoan = myLoans.find((loan) => loan.status === 'dipinjam') || null;
    const sudahDibaca = myLoans.some((loan) => loan.status === 'dikembalikan');
    const myRating = await queryOne('SELECT nilai, ulasan FROM ratings WHERE book_id = ? AND user_id = ?', [
      id,
      req.user.id,
    ]);
    const antreanPinjam = await queryOne(
      "SELECT COUNT(*) AS aktif FROM loans WHERE user_id = ? AND status = 'dipinjam'",
      [req.user.id],
    );

    res.render('catalog/detail', {
      title: book.judul,
      active: 'katalog',
      book,
      reviews,
      activeLoan,
      sudahDibaca,
      myRating,
      totalPinjam: totalPinjam.total,
      pinjamanAktif: antreanPinjam.aktif,
      maksPinjaman: MAKS_PINJAM_AKTIF,
      waUrl: whatsappUrl(
        res.locals.settings.admin_whatsapp,
        `Halo Admin PustakaKita, saya ${req.user.nama} ingin menanyakan buku "${book.judul}" (${book.kode}).`,
      ),
    });
  } catch (error) {
    next(error);
  }
});

/** Pinjam buku: transaksi dengan penguncian baris agar stok tidak bisa minus. */
router.post('/buku/:id/pinjam', requireRole('anggota'), async (req, res, next) => {
  const bookId = Number.parseInt(req.params.id, 10);
  const backTo = `/buku/${bookId}`;

  try {
    const message = await withTransaction(async (connection) => {
      const [[book]] = await connection.execute(
        'SELECT id, judul, stok_total, stok_tersedia FROM books WHERE id = ? FOR UPDATE',
        [bookId],
      );

      if (!book) throw Object.assign(new Error('Buku tidak ditemukan.'), { status: 404 });
      if (book.stok_tersedia < 1) {
        throw new Error(`Stok "${book.judul}" sedang habis. Silakan hubungi petugas perpustakaan.`);
      }

      const [[aktif]] = await connection.execute(
        "SELECT COUNT(*) AS total FROM loans WHERE user_id = ? AND status = 'dipinjam'",
        [req.user.id],
      );
      if (aktif.total >= MAKS_PINJAM_AKTIF) {
        throw new Error(
          `Anda sudah meminjam ${aktif.total} buku. Kembalikan salah satu buku terlebih dahulu (maksimal ${MAKS_PINJAM_AKTIF} buku).`,
        );
      }

      const [[duplikat]] = await connection.execute(
        "SELECT id FROM loans WHERE user_id = ? AND book_id = ? AND status = 'dipinjam' LIMIT 1",
        [req.user.id, bookId],
      );
      if (duplikat) throw new Error('Anda masih meminjam buku ini.');

      await connection.execute(
        `INSERT INTO loans (book_id, user_id, tanggal_pinjam, tanggal_jatuh_tempo, status)
         VALUES (?, ?, NOW(), DATE_ADD(CURDATE(), INTERVAL ? DAY), 'dipinjam')`,
        [bookId, req.user.id, LAMA_PINJAM_HARI],
      );
      await connection.execute('UPDATE books SET stok_tersedia = stok_tersedia - 1 WHERE id = ?', [bookId]);

      return `"${book.judul}" berhasil dipinjam. Harap kembalikan dalam ${LAMA_PINJAM_HARI} hari.`;
    });

    setFlash(req, 'sukses', message);
    res.redirect('/pinjaman-saya');
  } catch (error) {
    if (error.status === 404) return next(error);
    setFlash(req, 'galat', error.message);
    res.redirect(backTo);
  }
});

router.get('/pinjaman-saya', requireAuth, async (req, res, next) => {
  try {
    const loans = await query(
      `SELECT l.*, b.judul, b.kode, b.cover_theme, b.penulis, c.nama AS kategori,
              r.nilai AS rating_nilai,
              (SELECT COUNT(*) FROM ratings rt WHERE rt.book_id = b.id AND rt.user_id = l.user_id) AS sudah_dinilai
         FROM loans l
         JOIN books b ON b.id = l.book_id
         JOIN categories c ON c.id = b.category_id
         LEFT JOIN ratings r ON r.book_id = b.id AND r.user_id = l.user_id
        WHERE l.user_id = ?
        ORDER BY l.status = 'dipinjam' DESC, l.tanggal_pinjam DESC`,
      [req.user.id],
    );

    const enriched = loans.map((loan) => ({ ...loan, state: loanState(loan) }));
    const aktif = enriched.filter((loan) => loan.status === 'dipinjam');
    const selesai = enriched.filter((loan) => loan.status === 'dikembalikan');

    res.render('loans/mine', {
      title: 'Pinjaman Saya',
      active: 'pinjaman',
      aktif,
      selesai,
      maksPinjaman: MAKS_PINJAM_AKTIF,
      waUrl: whatsappUrl(
        res.locals.settings.admin_whatsapp,
        `Halo Admin PustakaKita, saya ${req.user.nama} (${req.user.no_anggota || '-'}) ingin menanyakan status pinjaman saya.`,
      ),
    });
  } catch (error) {
    next(error);
  }
});

/** Kembalikan buku milik sendiri (atau oleh petugas/admin melalui rute yang sama). */
router.post('/pinjaman/:id/kembalikan', requireAuth, async (req, res, next) => {
  const loanId = Number.parseInt(req.params.id, 10);

  try {
    const result = await withTransaction(async (connection) => {
      const [[loan]] = await connection.execute(
        `SELECT l.id, l.user_id, l.status, b.judul, b.stok_tersedia, b.stok_total
           FROM loans l
           JOIN books b ON b.id = l.book_id
          WHERE l.id = ? FOR UPDATE`,
        [loanId],
      );

      if (!loan) throw Object.assign(new Error('Data peminjaman tidak ditemukan.'), { status: 404 });
      if (loan.user_id !== req.user.id) {
        throw Object.assign(new Error('Anda tidak berhak mengembalikan pinjaman ini.'), { status: 403 });
      }
      if (loan.status !== 'dipinjam') throw new Error('Buku ini sudah dikembalikan sebelumnya.');

      await connection.execute(
        "UPDATE loans SET status = 'dikembalikan', tanggal_kembali = NOW() WHERE id = ?",
        [loanId],
      );
      await connection.execute(
        'UPDATE books SET stok_tersedia = LEAST(stok_tersedia + 1, stok_total) WHERE id = (SELECT book_id FROM loans WHERE id = ?)',
        [loanId],
      );

      return loan;
    });

    setFlash(req, 'sukses', `"${result.judul}" telah dikembalikan. Terima kasih!`);
    res.redirect('/pinjaman-saya');
  } catch (error) {
    if (error.status) {
      setFlash(req, 'galat', error.message);
      return res.redirect('/pinjaman-saya');
    }
    next(error);
  }
});

router.post('/buku/:id/ulasan', requireAuth, async (req, res, next) => {
  const bookId = Number.parseInt(req.params.id, 10);
  const nilai = Number.parseInt(req.body.nilai, 10);
  const ulasan = String(req.body.ulasan || '').trim();

  try {
    const book = await queryOne('SELECT id FROM books WHERE id = ?', [bookId]);
    if (!book) return next();

    if (!Number.isInteger(nilai) || nilai < 1 || nilai > 5) {
      setFlash(req, 'galat', 'Pilih rating antara 1 sampai 5 bintang.');
      return res.redirect(`/buku/${bookId}#ulasan`);
    }
    if (ulasan.length > 500) {
      setFlash(req, 'galat', 'Ulasan maksimal 500 karakter.');
      return res.redirect(`/buku/${bookId}#ulasan`);
    }

    const sudahSelesai = await queryOne(
      "SELECT id FROM loans WHERE book_id = ? AND user_id = ? AND status = 'dikembalikan' LIMIT 1",
      [bookId, req.user.id],
    );
    if (!sudahSelesai) {
      setFlash(req, 'galat', 'Rating hanya dapat diberikan untuk buku yang sudah selesai Anda baca (dikembalikan).');
      return res.redirect(`/buku/${bookId}#ulasan`);
    }

    await pool.execute(
      `INSERT INTO ratings (book_id, user_id, nilai, ulasan) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nilai = VALUES(nilai), ulasan = VALUES(ulasan)`,
      [bookId, req.user.id, nilai, ulasan || null],
    );

    setFlash(req, 'sukses', 'Terima kasih, rating dan ulasan Anda tersimpan.');
    res.redirect(`/buku/${bookId}#ulasan`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
