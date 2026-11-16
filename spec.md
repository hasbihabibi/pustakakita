# Dokumen Spesifikasi Teknis & Produk (SPEC.md)
**Nama Proyek:** PustakaKita — Katalog dan Dashboard Perpustakaan Mini Berbasis Web  
**Lingkup Pengembangan:** Latihan Intensif 1 Hari (MVP Single-Device)  
**Prinsip Utama:** Layanan Perpustakaan Murni — **100% Tanpa Biaya Pinjam / Tanpa Atribut Harga**

---

## 1. Tujuan (Objectives)
1. Menyediakan aplikasi katalog buku dan manajemen sirkulasi perpustakaan mini berbasis web yang dapat dijalankan langsung di peramban (*browser*) tanpa ketergantungan *backend* eksternal.
2. Memfasilitasi pencarian koleksi bacaan, pemeriksaan ketersediaan stok eksemplar secara *real-time*, dan pemesanan peminjaman cepat via WhatsApp.
3. Memberikan sarana latihan rekayasa perangkat lunak terstruktur dalam waktu 1 hari yang mencakup manipulasi DOM, manajemen *state* lokal (`localStorage`), validasi input, dan pengujian penerimaan manual.
4. Menjaga kemurnian fungsi perpustakaan komunitas dengan **menghilangkan seluruh atribut biaya sewa/harga** dari model data dan antarmuka pengguna.

---

## 2. Pengguna (Target Users)
Aplikasi beroperasi pada **satu perangkat yang sama** (*kiosk* perpustakaan mini atau perangkat pustakawan) dengan dua peran pengguna yang dapat berpindah mode tampilan secara instan tanpa *login* palsu:

1. **Peminjam Buku (Anggota/Pengunjung):**
   - Menjelajahi katalog buku, mencari topik bacaan, memfilter kategori atau koleksi unggulan, mengurutkan daftar buku, serta mengajukan peminjaman melalui tombol pesan WhatsApp.
2. **Pengelola Perpustakaan (Pustakawan):**
   - Memantau ringkasan statistik inventaris, menambah buku baru, memperbarui detail buku, menghapus koleksi, serta melakukan simulasi sirkulasi peminjaman/pengembalian cepat (`-1` / `+1` stok).

---

## 3. Daftar Fitur MVP (Feature List)
1. **Pengalih Mode Instan (Tanpa Login Palsu):** Navigasi *tab* di bagian atas untuk berpindah antara **Katalog Peminjam** dan **Dashboard Pengelola**.
2. **8 Buku Contoh Awal (Seed Data):** Data awal bertema edukasi, sains, sejarah, dan sastra klasik yang bersifat nonpribadi.
3. **Generator Sampul SVG Lokal:** Pembuat sampul buku berbasis *SVG Data URI* otomatis dengan 7 pilihan tema warna, menjamin aplikasi bebas pelanggaran hak cipta dan tetap tampil utuh saat luring (*offline*).
4. **Katalog & Kartu Informasi Buku:** Menampilkan ID Buku, Sampul, Kategori, Judul, Deskripsi Singkat, Lencana "Koleksi Unggulan", Status Ketersediaan Stok (`Tersedia: X eks` atau `Stok Habis`), dan tombol **Pinjam via WhatsApp**.
5. **Pencarian, Filter & Pengurutan (Tanpa Urutan Harga):**
   - Pencarian *real-time* berdasarkan judul, deskripsi, atau ID koleksi.
   - Filter dropdown kategori dinamis + *checkbox* "Hanya Koleksi Unggulan" & "Hanya yang Tersedia".
   - Pengurutan berdasarkan: *Koleksi Unggulan Teratas*, *Judul (A-Z)*, *Judul (Z-A)*, *Stok Terbanyak*, dan *Stok Tersedikit*.
6. **Integrasi Pesan WhatsApp:** Membuat tautan `https://wa.me/` otomatis berisi template pesan peminjaman (Judul, ID Koleksi, dan Kategori). Tombol otomatis dinonaktifkan apabila `stok === 0`.
7. **Dashboard Statistik Ringkas:** 3 kartu indikator utama (*Total Judul Buku*, *Total Eksemplar Stok*, dan *Total Kategori Aktif*).
8. **Manajemen Inventaris (CRUD) & Sirkulasi Cepat:**
   - Form Tambah/Edit Buku dengan validasi ketat.
   - Tombol aksi cepat `-1` dan `+1` stok pada tabel untuk simulasi peminjaman/pengembalian buku.
   - Tombol **Reset Data Contoh** untuk memulihkan 8 buku awal ke `localStorage`.

---

## 4. Model Data (Data Model)
Penyimpanan menggunakan `localStorage` dengan kunci: `pustakakita_books_v1`.  
**Catatan Penting:** Sesuai aturan perpustakaan murni, atribut `biayaPinjam` atau `harga` **dihapus sepenuhnya** dari skema data.

| Atribut | Tipe Data | Aturan & Validasi | Contoh Nilai |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Unik, dibuat otomatis dengan prefiks `PK-` | `"PK-101"` |
| `judul` | `string` | Wajib diisi, panjang 2–120 karakter | `"Pengantar Logika & Algoritma"` |
| `kategori` | `string` | Wajib diisi, panjang 2–50 karakter | `"Teknologi & Komputer"` |
| `stok` | `integer` | Wajib bilangan bulat non-negatif (`stok >= 0`) | `4` |
| `deskripsi` | `string` | Wajib diisi, panjang 10–400 karakter | `"Panduan fundamental..."` |
| `coverTheme` | `string` | Tema palet SVG lokal (`emerald`, `indigo`, dll.) | `"indigo"` |
| `imageUrl` | `string` | Data URI SVG lokal otomatis atau URL opsional | `"data:image/svg+xml;utf8,..."` |
| `unggulan` | `boolean` | Status koleksi pilihan (`true` / `false`) | `true` |

---

## 5. Kebutuhan Non-Fungsional (Non-Functional Requirements)
1. **Keamanan & Privasi:**
   - Tidak menyimpan *API Key*, kredensial rahasia, atau data pribadi (PII) di dalam kode maupun `localStorage`.
   - Seluruh input teks pengguna wajib di-*escape* sebelum dirender ke HTML untuk mencegah celah XSS (*Cross-Site Scripting*).
2. **Kepatuhan Hak Cipta:**
   - Seluruh sampul buku contoh menggunakan SVG terprogram secara lokal sehingga 100% bebas hak cipta.
3. **Kinerja & Responsivitas:**
   - Pencarian dan pemfilteran katalog merespons secara instan (< 50ms untuk < 200 item).
   - Antarmuka responsif di layar ponsel (lebar 360px), tablet, hingga desktop.
4. **Ketahanan Data Lokal:**
   - Jika data pada `localStorage` rusak (*corrupt JSON*), aplikasi otomatis melakukan *fallback* ke 8 buku contoh awal tanpa mengalami *crash*.

---

## 6. Risiko & Mitigasi (Risk Analysis)
| ID | Risiko | Dampak | Strategi Mitigasi |
| :--- | :--- | :--- | :--- |
| **R-01** | Data `localStorage` terhapus atau rusak karena modifikasi manual di DevTools. | Aplikasi gagal memuat daftar buku. | Bungkus `JSON.parse` dalam `try/catch` dan sediakan fungsi sanitasi objek serta tombol *Reset Data Contoh*. |
| **R-02** | URL gambar eksternal yang dimasukkan pengelola mati (*broken link*). | Tampilan kartu katalog rusak. | Tambahkan atribut `onerror` pada elemen `<img>` yang langsung mengalihkan sumber gambar ke generator SVG lokal. |
| **R-03** | Input stok berupa angka negatif atau desimal. | Logika ketersediaan buku menjadi tidak valid. | Validasi ketat menggunakan `Number.isInteger(stok) && stok >= 0` sebelum data disimpan. |

---

## 7. Di Luar Cakupan (Out-of-Scope)
Fitur-fitur berikut **tidak** termasuk dalam lingkup latihan 1 hari ini:
1. Segala bentuk perhitungan biaya sewa, denda keterlambatan dalam Rupiah, atau integrasi pembayaran.
2. Sistem autentikasi/login, manajemen akun anggota, atau *role-based access control* berbasis server.
3. Basis data *cloud* / *backend API* multi-perangkat.
4. Riwayat transaksi peminjaman per nama peminjam dan kalender jatuh tempo.

---

## 8. Kriteria Penerimaan Manual (Acceptance Criteria)
Seluruh poin di bawah ini dapat diuji dan diverifikasi secara manual melalui peramban:

- [ ] **AC-01 (Bebas Harga):** Tidak ditemukan teks `Rp`, `Rupiah`, `Harga`, atau `Biaya Pinjam` di seluruh kartu katalog, opsi pengurutan, form input, maupun tabel inventaris.
- [ ] **AC-02 (Data Awal & Sampul Lokal):** Saat aplikasi dibuka pertama kali, tampil 8 buku contoh dengan sampul SVG lokal yang rapi tanpa koneksi ke gambar berhak cipta.
- [ ] **AC-03 (Pencarian & Filter):** Mengetik kata kunci di kolom pencarian dan memilih kategori langsung menyaring daftar kartu buku secara *real-time*.
- [ ] **AC-04 (Sorting Valid):** Mengubah urutan ke *Judul (A-Z)*, *Stok Terbanyak*, atau *Unggulan Teratas* menyusun ulang kartu buku dengan benar.
- [ ] **AC-05 (Aturan WhatsApp & Stok Habis):** Buku dengan `stok > 0` memiliki tombol *Pinjam via WhatsApp* yang aktif dan mengarah ke `wa.me` dengan teks judul & ID buku. Buku dengan `stok === 0` menampilkan status *Stok Habis* dan tombol dinonaktifkan.
- [ ] **AC-06 (CRUD & Validasi):** Menambahkan buku dengan judul kosong atau stok `-2` akan ditolak dengan pesan kesalahan yang jelas. Buku yang valid langsung tampil di tabel dan katalog, serta bertahan setelah halaman di-*refresh*.
- [ ] **AC-07 (Sirkulasi Cepat & Statistik):** Menekan tombol `+1` atau `-1` stok pada tabel langsung memperbarui angka *Total Eksemplar Stok* di kartu ringkasan atas.

---

## 9. Rencana Implementasi 1 Hari (Implementation Plan per Iterasi)
Untuk pengerjaan dengan **Vite + Vanilla JavaScript** (atau prototipe *Single-File HTML*), berikut pembagian iterasi kerja selama 1 hari (8 jam kerja):

### Iterasi 1: Fondasi Data & Utilitas Sampul Lokal (Jam 1 – 2)
- Inisialisasi proyek (`npm create vite@latest pustakakita -- --template vanilla` atau kerangka HTML tunggal).
- Menyusun konstanta 8 buku awal (`INITIAL_SEED_BOOKS`) tanpa atribut harga.
- Membuat fungsi `generateLocalBookCoverDataUri()` dan modul penyimpanan `localStorage` (`pustakakita_books_v1`).

### Iterasi 2: Antarmuka Katalog Peminjam & Integrasi WhatsApp (Jam 3 – 4)
- Membangun *header* navigasi mode tampilan dan tata letak responsif *Katalog Peminjam*.
- Mengimplementasikan fungsi render kartu buku, pencari *real-time*, filter kategori dinamis, dan *sorting* 5 opsi.
- Membuat generator tautan `createWhatsAppBorrowUrl()` beserta logika *disabled state* saat stok = 0.

### Iterasi 3: Dashboard Pengelola, Statistik & CRUD (Jam 5 – 6)
- Membangun 3 kartu ringkasan statistik yang dihitung secara reaktif dari `booksState`.
- Membuat tabel inventaris lengkap dengan tombol sirkulasi cepat (`-1` / `+1` stok), tombol *Edit*, dan *Hapus*.
- Mengimplementasikan form Tambah/Edit Buku beserta validasi input ketat.

### Iterasi 4: Dialog Konfirmasi Kustom, Poles UI & Uji Manual (Jam 7 – 8)
- Menambahkan modal konfirmasi kustom (untuk aksi Hapus dan Reset Data Contoh) serta notifikasi *toast*.
- Melakukan pengujian manual menyeluruh terhadap daftar *Acceptance Criteria* (AC-01 s.d. AC-07).