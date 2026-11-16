'use strict';

/**
 * Menyiapkan basis data PustakaKita:
 *   1. Membuat database bila belum ada.
 *   2. Menjalankan db/schema.sql.
 *   3. Mengisi data contoh (hanya bila tabel users masih kosong).
 *
 * Pemakaian:
 *   node scripts/db-setup.js           -> buat skema + seed jika kosong
 *   node scripts/db-setup.js --reset   -> hapus semua tabel lalu buat ulang + seed
 */

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const { hashPassword } = require('../src/auth');
const { assignMemberNumber } = require('../src/member-number');
const seed = require('./seed-data');

const DB_NAME = process.env.DB_NAME || 'pustakakita';

const baseConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

const TABLES_IN_DROP_ORDER = ['ratings', 'loans', 'books', 'categories', 'sessions', 'settings', 'users'];

function daysOffset(days, { endOfDay = false } = {}) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(endOfDay ? 23 : 10, endOfDay ? 59 : 0, 0, 0);
  return date;
}

function dateOnly(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate(),
  ).padStart(2, '0')}`;
}

async function run() {
  const reset = process.argv.includes('--reset');
  let connection;

  try {
    connection = await mysql.createConnection(baseConfig);
  } catch (error) {
    console.error('\n[GAGAL] Tidak dapat terhubung ke MySQL.');
    console.error(`Detail: ${error.message}`);
    console.error('\nPastikan server MySQL berjalan, lalu periksa variabel .env:');
    console.error(`  host=${baseConfig.host} port=${baseConfig.port} user=${baseConfig.user}`);
    console.error('\nJika memakai Docker: docker compose up -d\n');
    process.exit(1);
  }

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${DB_NAME}\``);
    console.log(`[OK] Database \`${DB_NAME}\` siap.`);

    if (reset) {
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const table of TABLES_IN_DROP_ORDER) {
        await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
      }
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('[OK] Tabel lama dihapus (mode --reset).');
    }

    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    await connection.query(schemaSql);
    console.log('[OK] Skema tabel dibuat/diperbarui.');

    const [[{ total }]] = await connection.query('SELECT COUNT(*) AS total FROM users');
    if (total > 0 && !reset) {
      console.log(`[LEWATI] Sudah ada ${total} pengguna. Gunakan --reset untuk membangun ulang data contoh.`);
      return;
    }

    await connection.beginTransaction();

    const userIds = new Map();
    for (const user of seed.users) {
      const [result] = await connection.query(
        `INSERT INTO users (nama, email, password_hash, role, telepon, alamat, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          user.nama,
          user.email,
          hashPassword(user.password),
          user.role,
          user.telepon || null,
          user.alamat || null,
          user.status || 'aktif',
        ],
      );
      if (user.role === 'anggota') await assignMemberNumber(connection, result.insertId);
      userIds.set(user.email, result.insertId);
    }

    const categoryIds = new Map();
    for (const category of seed.categories) {
      const [result] = await connection.query('INSERT INTO categories (nama, deskripsi) VALUES (?, ?)', [
        category.nama,
        category.deskripsi,
      ]);
      categoryIds.set(category.nama, result.insertId);
    }

    const petugasId = userIds.get('petugas@pustakakita.id');
    const bookIds = new Map();
    for (const book of seed.books) {
      const [result] = await connection.query(
        `INSERT INTO books
           (kode, judul, penulis, penerbit, tahun_terbit, category_id, deskripsi,
            stok_total, stok_tersedia, cover_theme, unggulan, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          book.kode,
          book.judul,
          book.penulis,
          book.penerbit,
          book.tahun_terbit,
          categoryIds.get(book.kategori),
          book.deskripsi,
          book.stok_total,
          book.stok_total,
          book.cover_theme,
          book.unggulan,
          petugasId,
        ],
      );
      bookIds.set(book.kode, result.insertId);
    }

    const activeLoanCount = new Map();
    for (const loan of seed.loans) {
      const kembali = loan.kembaliHariLalu === undefined || loan.kembaliHariLalu === null ? null : daysOffset(-loan.kembaliHariLalu);
      const status = kembali ? 'dikembalikan' : 'dipinjam';
      await connection.query(
        `INSERT INTO loans (book_id, user_id, tanggal_pinjam, tanggal_jatuh_tempo, tanggal_kembali, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          bookIds.get(loan.kode),
          userIds.get(loan.email),
          daysOffset(-loan.pinjamHariLalu),
          dateOnly(daysOffset(loan.tempoDalamHari)),
          kembali,
          status,
        ],
      );

      if (status === 'dipinjam') {
        activeLoanCount.set(loan.kode, (activeLoanCount.get(loan.kode) || 0) + 1);
      }
    }

    for (const [kode, count] of activeLoanCount) {
      await connection.query(
        'UPDATE books SET stok_tersedia = GREATEST(stok_total - ?, 0) WHERE kode = ?',
        [count, kode],
      );
    }

    for (const rating of seed.ratings) {
      await connection.query(
        'INSERT INTO ratings (book_id, user_id, nilai, ulasan) VALUES (?, ?, ?, ?)',
        [bookIds.get(rating.kode), userIds.get(rating.email), rating.nilai, rating.ulasan],
      );
    }

    for (const [nama, nilai] of Object.entries(seed.settings)) {
      await connection.query('INSERT INTO settings (nama, nilai) VALUES (?, ?)', [nama, nilai]);
    }

    await connection.commit();

    console.log('[OK] Data contoh berhasil dimasukkan:');
    console.log(`     ${seed.users.length} pengguna, ${seed.categories.length} kategori, ${seed.books.length} buku,`);
    console.log(`     ${seed.loans.length} transaksi peminjaman, ${seed.ratings.length} ulasan.`);
    console.log('\nAkun demo:');
    console.log('  Admin   : admin@pustakakita.id   / Admin#2026');
    console.log('  Petugas : petugas@pustakakita.id / Petugas#2026');
    console.log('  Anggota : anggota@pustakakita.id / Anggota#2026\n');
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* tidak ada transaksi aktif */
    }
    console.error('\n[GAGAL] Penyiapan database dibatalkan:', error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

run();
