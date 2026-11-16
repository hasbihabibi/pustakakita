# PustakaKita — Aplikasi Perpustakaan dengan Tiga Peran

Aplikasi web perpustakaan mini yang dikembangkan dari prototipe `spec.md` menjadi aplikasi
server-side production: autentikasi berbasis sesi, kontrol akses per peran, dan basis data MySQL.

## Peran pengguna

| Peran | Kemampuan |
| :--- | :--- |
| **Admin** | Dashboard, kelola pengguna (tambah/edit/nonaktifkan/hapus, reset kata sandi), pengaturan perpustakaan & nomor WhatsApp, serta akses penuh ke manajemen koleksi. |
| **Petugas** | Dashboard, kelola buku (CRUD + stok), kelola kategori (CRUD). |
| **Anggota** | Katalog dengan pencarian/filter/sort, meminjam buku (maks. 3 aktif, 7 hari), mengembalikan buku, memberi rating + ulasan untuk buku yang sudah selesai dibaca, dan menghubungi admin via WhatsApp. |

Pendaftaran mandiri tersedia di `/daftar`: pengunjung dapat membuat akun anggota dan nomor anggota (`AGT-xxx`) dibuat otomatis oleh sistem. Validasi formulir mewajibkan nama berisi huruf tanpa angka, nomor WhatsApp seluler Indonesia (8–15 digit), serta kata sandi minimal 8 karakter yang memuat huruf dan angka. Peran akun hasil pendaftaran selalu `anggota`.
Peran admin dan petugas hanya dapat dibuat oleh administrator melalui menu Kelola Pengguna.

Aturan bisnis penting:

- Peminjaman dan pengembalian dijalankan dalam transaksi MySQL dengan `SELECT ... FOR UPDATE`
  sehingga stok tidak dapat menjadi negatif walau ada permintaan bersamaan.
- Rating hanya dapat diberikan bila anggota memiliki riwayat peminjaman berstatus
  `dikembalikan` untuk buku tersebut. Satu anggota = satu rating per buku (bisa diperbarui).
- Kategori yang masih dipakai buku dan buku yang memiliki riwayat peminjaman tidak dapat dihapus.
- Minimal harus ada satu administrator aktif; admin tidak dapat menonaktifkan/menghapus akunnya sendiri.

## Teknologi

- Node.js 20+ dengan Express 4 (server-side rendering, tanpa build step)
- EJS sebagai template engine
- MySQL 8 (mysql2/promise) — semua query memakai prepared statement
- Sesi tersimpan di tabel MySQL (`sessions`), bukan di memori proses
- Kata sandi di-hash dengan `scrypt` (modul `crypto` bawaan Node)
- CSRF token per sesi untuk seluruh form POST, cookie `HttpOnly` + `SameSite=Lax`

## Menjalankan

1. **Siapkan MySQL.** Cara termudah memakai Docker:

   ```bash
   docker compose up -d      # MySQL 8.4 pada port host 3307
   ```

   Atau gunakan server MySQL yang sudah ada, lalu sesuaikan `DB_*` pada `.env`.
   Nomor port default compose sengaja `3307` agar tidak bentrok dengan MySQL lokal.

2. **Konfigurasi:**

   ```bash
   cp .env.example .env      # lalu sesuaikan DB_* dan SESSION_SECRET
   ```

3. **Pasang dependensi & siapkan database + data dummy:**

   ```bash
   npm install
   npm run db:setup          # membuat database, tabel, dan data contoh
   # npm run db:reset        # membangun ulang total (DROP + seed)
   ```

4. **Jalankan:**

   ```bash
   npm start                 # http://localhost:3000
   ```

## Akun demo

| Peran | Email | Kata sandi |
| :--- | :--- | :--- |
| Admin | `admin@pustakakita.id` | `Admin#2026` |
| Petugas | `petugas@pustakakita.id` | `Petugas#2026` |
| Anggota | `anggota@pustakakita.id` | `Anggota#2026` |

Data dummy lain: 9 pengguna, 8 kategori, 16 buku, 12 transaksi peminjaman (aktif, selesai,
dan terlambat), serta 5 ulasan. Anggota demo sudah memiliki riwayat selesai baca sehingga
bisa langsung mencoba fitur rating.

## Struktur proyek

```
server.js                 Aplikasi Express (sesi, middleware, routing)
src/
  db.js                   Connection pool + helper transaksi
  auth.js                 Hash scrypt, middleware sesi/peran, CSRF
  session-store.js        Session store berbasis MySQL
  validate.js             Validator form
  helpers.js              Format tanggal, sampul, tautan WhatsApp, flash
  settings.js             Pengaturan perpustakaan (cache 30 detik)
  routes/                 auth, catalog, books, categories, users, dashboard
db/schema.sql             Skema tabel MySQL
scripts/db-setup.js       Pembuat database + seed data
scripts/seed-data.js      Data dummy (buku, kategori, pengguna, pinjaman, ulasan)
views/                    Template EJS (layout, katalog, kelola, admin)
public/                   styles.css, app.js
```

## Catatan produksi

- Set `NODE_ENV=production` agar cookie sesi memakai flag `Secure` (jalankan di belakang HTTPS).
- Ganti `SESSION_SECRET` dengan nilai acak panjang, dan ganti kata sandi akun demo.
- Backup rutin database; seluruh data aplikasi berada di MySQL.
- `npm run db:setup` tidak menimpa data yang sudah ada; gunakan `db:reset` secara sadar.
