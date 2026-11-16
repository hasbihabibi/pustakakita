'use strict';

/**
 * Data contoh (seed) PustakaKita.
 * Semua judul, penulis, dan ulasan bersifat fiktif dan bebas hak cipta.
 * Password di-hash saat proses `npm run db:setup` — file ini tidak menyimpan hash.
 */

const users = [
  {
    nama: 'Sari Wulandari',
    email: 'admin@pustakakita.id',
    password: 'Admin#2026',
    role: 'admin',
    telepon: '081234567890',
    alamat: 'Jl. Malioboro No. 12, Yogyakarta',
  },
  {
    nama: 'Bagas Pratama',
    email: 'petugas@pustakakita.id',
    password: 'Petugas#2026',
    role: 'petugas',
    telepon: '081298765432',
    alamat: 'Jl. Kaliurang Km. 5, Sleman',
  },
  {
    nama: 'Rani Kusuma',
    email: 'rani.petugas@pustakakita.id',
    password: 'Petugas#2026',
    role: 'petugas',
    telepon: '081377712345',
    alamat: 'Jl. Godean No. 44, Sleman',
  },
  {
    nama: 'Dita Larasati',
    email: 'anggota@pustakakita.id',
    password: 'Anggota#2026',
    role: 'anggota',
    telepon: '081255500011',
    alamat: 'Jl. Pogung Raya No. 8, Sleman',
  },
  {
    nama: 'Arif Budiman',
    email: 'arif.anggota@pustakakita.id',
    password: 'Anggota#2026',
    role: 'anggota',
    telepon: '081255500022',
    alamat: 'Jl. Gejayan No. 21, Yogyakarta',
  },
  {
    nama: 'Nadia Safira',
    email: 'nadia.anggota@pustakakita.id',
    password: 'Anggota#2026',
    role: 'anggota',
    telepon: '081255500033',
    alamat: 'Jl. Monjali No. 90, Sleman',
  },
  {
    nama: 'Yoga Prasetyo',
    email: 'yoga.anggota@pustakakita.id',
    password: 'Anggota#2026',
    role: 'anggota',
    telepon: '081255500044',
    alamat: 'Jl. Timoho No. 5, Yogyakarta',
  },
  {
    nama: 'Maya Kirana',
    email: 'maya.anggota@pustakakita.id',
    password: 'Anggota#2026',
    role: 'anggota',
    telepon: '081255500055',
    alamat: 'Jl. Bantul Km. 3, Bantul',
  },
  {
    nama: 'Fikri Ramadhan',
    email: 'fikri.anggota@pustakakita.id',
    password: 'Anggota#2026',
    role: 'anggota',
    telepon: '081255500066',
    alamat: 'Jl. Wates Km. 2, Yogyakarta',
    status: 'nonaktif',
  },
];

const categories = [
  { nama: 'Teknologi & Komputer', deskripsi: 'Pemrograman, algoritma, dan literasi digital.' },
  { nama: 'Sains & Alam', deskripsi: 'Fisika, biologi, astronomi, dan eksplorasi alam.' },
  { nama: 'Sejarah & Biografi', deskripsi: 'Rekam jejak peradaban dan kisah tokoh penting.' },
  { nama: 'Sastra Klasik', deskripsi: 'Novel, puisi, dan karya sastra pilihan.' },
  { nama: 'Ekonomi & Bisnis', deskripsi: 'Keuangan pribadi, usaha kecil, dan manajemen.' },
  { nama: 'Pendidikan & Pengajaran', deskripsi: 'Metode belajar dan praktik mengajar.' },
  { nama: 'Anak & Remaja', deskripsi: 'Bacaan ramah anak dan remaja.' },
  { nama: 'Kesehatan & Gaya Hidup', deskripsi: 'Gizi, kebugaran, dan kesehatan mental.' },
];

const books = [
  {
    kode: 'PK-101',
    judul: 'Pengantar Logika & Algoritma',
    penulis: 'Rizal Hakim',
    penerbit: 'Nusa Cendekia',
    tahun_terbit: 2021,
    kategori: 'Teknologi & Komputer',
    deskripsi:
      'Panduan fundamental berpikir komputasional, dari logika proposisi hingga penyusunan algoritma dasar dengan contoh latihan bertahap.',
    stok_total: 4,
    cover_theme: 'indigo',
    unggulan: 1,
  },
  {
    kode: 'PK-102',
    judul: 'Dasar Pemrograman Web Modern',
    penulis: 'Nadia Puspita',
    penerbit: 'Media Digital Nusantara',
    tahun_terbit: 2023,
    kategori: 'Teknologi & Komputer',
    deskripsi:
      'Membahas HTML, CSS, dan JavaScript modern beserta praktik terbaik membangun antarmuka web yang aksesibel dan responsif.',
    stok_total: 5,
    cover_theme: 'laut',
    unggulan: 0,
  },
  {
    kode: 'PK-103',
    judul: 'Kecerdasan Artifisial untuk Pemula',
    penulis: 'Adi Nugraha',
    penerbit: 'Cendekia Press',
    tahun_terbit: 2024,
    kategori: 'Teknologi & Komputer',
    deskripsi:
      'Menjelaskan konsep dasar pembelajaran mesin, jaringan saraf, dan etika penggunaan kecerdasan artifisial dengan bahasa yang mudah dipahami.',
    stok_total: 3,
    cover_theme: 'samudra',
    unggulan: 1,
  },
  {
    kode: 'PK-104',
    judul: 'Menjelajah Tata Surya',
    penulis: 'Hadi Santoso',
    penerbit: 'Langit Buku',
    tahun_terbit: 2020,
    kategori: 'Sains & Alam',
    deskripsi:
      'Perjalanan visual menyusuri planet, satelit, dan fenomena antariksa, dilengkapi data observasi terbaru dari misi penjelajahan luar angkasa.',
    stok_total: 2,
    cover_theme: 'senja',
    unggulan: 1,
  },
  {
    kode: 'PK-105',
    judul: 'Biologi Kehidupan Sehari-hari',
    penulis: 'Retno Wulandari',
    penerbit: 'Sains Populer',
    tahun_terbit: 2019,
    kategori: 'Sains & Alam',
    deskripsi:
      'Mengaitkan konsep sel, genetika, dan ekosistem dengan pengalaman sehari-hari seperti fermentasi makanan dan siklus tumbuhan.',
    stok_total: 3,
    cover_theme: 'zamrud',
    unggulan: 0,
  },
  {
    kode: 'PK-106',
    judul: 'Sejarah Nusantara: Jalur Rempah',
    penulis: 'Ki Ageng Wibowo',
    penerbit: 'Arsip Bangsa',
    tahun_terbit: 2018,
    kategori: 'Sejarah & Biografi',
    deskripsi:
      'Menelusuri jaringan perdagangan rempah di Nusantara, peran pelabuhan kuno, serta pertemuan budaya yang membentuk identitas maritim.',
    stok_total: 2,
    cover_theme: 'terakota',
    unggulan: 0,
  },
  {
    kode: 'PK-107',
    judul: 'Biografi Para Penemu Dunia',
    penulis: 'Anisa Rahma',
    penerbit: 'Pustaka Inspirasi',
    tahun_terbit: 2022,
    kategori: 'Sejarah & Biografi',
    deskripsi:
      'Kisah perjuangan para penemu di bidang medis, listrik, dan transportasi, disertai pelajaran tentang kegigihan dan rasa ingin tahu.',
    stok_total: 3,
    cover_theme: 'karang',
    unggulan: 0,
  },
  {
    kode: 'PK-108',
    judul: 'Nyanyian Sunyi di Tepi Pantai',
    penulis: 'Sinta Maharani',
    penerbit: 'Rumah Kata',
    tahun_terbit: 2017,
    kategori: 'Sastra Klasik',
    deskripsi:
      'Novel tentang seorang nelayan muda yang merawat tradisi keluarganya di tengah perubahan wajah pesisir dan modernisasi kampung.',
    stok_total: 2,
    cover_theme: 'senja',
    unggulan: 0,
  },
  {
    kode: 'PK-109',
    judul: 'Antologi Puisi Laut Selatan',
    penulis: 'W.S. Handoko',
    penerbit: 'Rumah Kata',
    tahun_terbit: 2016,
    kategori: 'Sastra Klasik',
    deskripsi:
      'Kumpulan puisi tentang gelombang, karang, dan keheningan malam di pesisir selatan yang ditulis selama dua dekade perjalanan.',
    stok_total: 3,
    cover_theme: 'karang',
    unggulan: 1,
  },
  {
    kode: 'PK-110',
    judul: 'Manajemen Keuangan Keluarga Muda',
    penulis: 'Fajar Ramadhan',
    penerbit: 'Bisnis Cerdas',
    tahun_terbit: 2023,
    kategori: 'Ekonomi & Bisnis',
    deskripsi:
      'Kerangka praktis menyusun anggaran rumah tangga, dana darurat, dan tujuan jangka panjang tanpa menghilangkan kebiasaan menabung.',
    stok_total: 4,
    cover_theme: 'zamrud',
    unggulan: 0,
  },
  {
    kode: 'PK-111',
    judul: 'Kewirausahaan Sosial di Desa',
    penulis: 'Dewi Anggraini',
    penerbit: 'Bisnis Cerdas',
    tahun_terbit: 2021,
    kategori: 'Ekonomi & Bisnis',
    deskripsi:
      'Studi kasus usaha bersama desa yang berhasil memadukan dampak sosial dan keberlanjutan ekonomi melalui koperasi dan produk lokal.',
    stok_total: 2,
    cover_theme: 'terakota',
    unggulan: 0,
  },
  {
    kode: 'PK-112',
    judul: 'Strategi Mengajar Abad 21',
    penulis: 'Budi Setiawan',
    penerbit: 'Edukasi Mandiri',
    tahun_terbit: 2022,
    kategori: 'Pendidikan & Pengajaran',
    deskripsi:
      'Merancang pembelajaran berbasis proyek, asesmen formatif, dan kelas inklusif yang menghargai perbedaan gaya belajar siswa.',
    stok_total: 3,
    cover_theme: 'laut',
    unggulan: 1,
  },
  {
    kode: 'PK-113',
    judul: 'Petualangan Si Kancil Digital',
    penulis: 'Maya Kirana',
    penerbit: 'Ceria Anak',
    tahun_terbit: 2024,
    kategori: 'Anak & Remaja',
    deskripsi:
      'Kumpulan cerita anak tentang kancil yang belajar menjaga privasi, mengenali berita palsu, dan berbuat baik di dunia maya.',
    stok_total: 6,
    cover_theme: 'zamrud',
    unggulan: 0,
  },
  {
    kode: 'PK-114',
    judul: 'Gizi Seimbang & Hidup Sehat',
    penulis: 'Lestari Dewi',
    penerbit: 'Sehat Bersama',
    tahun_terbit: 2020,
    kategori: 'Kesehatan & Gaya Hidup',
    deskripsi:
      'Panduan menyusun menu harian seimbang, memahami label gizi, dan membangun kebiasaan bergerak yang berkelanjutan untuk keluarga.',
    stok_total: 3,
    cover_theme: 'indigo',
    unggulan: 0,
  },
  {
    kode: 'PK-115',
    judul: 'Ensiklopedia Sains Mini',
    penulis: 'Tim Edukasi Nusantara',
    penerbit: 'Cendekia Press',
    tahun_terbit: 2019,
    kategori: 'Sains & Alam',
    deskripsi:
      'Rujukan ringkas berisi 120 entri sains bergambar, cocok untuk pelajar yang ingin memahami istilah ilmiah dengan cepat dan tepat.',
    stok_total: 2,
    cover_theme: 'laut',
    unggulan: 0,
  },
  {
    kode: 'PK-116',
    judul: 'Psikologi Belajar Anak',
    penulis: 'Nadia Safitri',
    penerbit: 'Edukasi Mandiri',
    tahun_terbit: 2021,
    kategori: 'Pendidikan & Pengajaran',
    deskripsi:
      'Membahas tahap perkembangan kognitif anak, motivasi intrinsik, serta cara pendamping belajar yang menumbuhkan rasa percaya diri.',
    stok_total: 2,
    cover_theme: 'senja',
    unggulan: 0,
  },
];

/** pinjamHariLalu: berapa hari lalu dipinjam. kembaliHariLalu: null = masih dipinjam. */
const loans = [
  { email: 'anggota@pustakakita.id', kode: 'PK-104', pinjamHariLalu: 5, tempoDalamHari: 2 },
  { email: 'anggota@pustakakita.id', kode: 'PK-113', pinjamHariLalu: 24, tempoDalamHari: -10, kembaliHariLalu: 16 },
  { email: 'anggota@pustakakita.id', kode: 'PK-101', pinjamHariLalu: 40, tempoDalamHari: -26, kembaliHariLalu: 28 },
  { email: 'arif.anggota@pustakakita.id', kode: 'PK-105', pinjamHariLalu: 3, tempoDalamHari: 4 },
  { email: 'arif.anggota@pustakakita.id', kode: 'PK-106', pinjamHariLalu: 30, tempoDalamHari: -18, kembaliHariLalu: 20 },
  { email: 'nadia.anggota@pustakakita.id', kode: 'PK-102', pinjamHariLalu: 15, tempoDalamHari: -8 },
  { email: 'yoga.anggota@pustakakita.id', kode: 'PK-110', pinjamHariLalu: 2, tempoDalamHari: 5 },
  { email: 'yoga.anggota@pustakakita.id', kode: 'PK-108', pinjamHariLalu: 26, tempoDalamHari: -14, kembaliHariLalu: 15 },
  { email: 'maya.anggota@pustakakita.id', kode: 'PK-109', pinjamHariLalu: 22, tempoDalamHari: -12, kembaliHariLalu: 13 },
  { email: 'maya.anggota@pustakakita.id', kode: 'PK-114', pinjamHariLalu: 1, tempoDalamHari: 6 },
  { email: 'fikri.anggota@pustakakita.id', kode: 'PK-112', pinjamHariLalu: 35, tempoDalamHari: -25, kembaliHariLalu: 26 },
  { email: 'anggota@pustakakita.id', kode: 'PK-115', pinjamHariLalu: 9, tempoDalamHari: -2 },
  { email: 'arif.anggota@pustakakita.id', kode: 'PK-115', pinjamHariLalu: 7, tempoDalamHari: 0 },
];

const ratings = [
  {
    email: 'anggota@pustakakita.id',
    kode: 'PK-101',
    nilai: 5,
    ulasan: 'Penjelasan algoritmanya runtut dan latihan di tiap bab sangat membantu pemula.',
  },
  {
    email: 'anggota@pustakakita.id',
    kode: 'PK-113',
    nilai: 4,
    ulasan: 'Ceritanya ringan, cocok dibacakan untuk adik sebelum tidur.',
  },
  {
    email: 'arif.anggota@pustakakita.id',
    kode: 'PK-106',
    nilai: 4,
    ulasan: 'Peta jalur rempahnya jelas, saya jadi paham konteks pelabuhan kuno.',
  },
  {
    email: 'yoga.anggota@pustakakita.id',
    kode: 'PK-108',
    nilai: 3,
    ulasan: 'Alurnya lambat di tengah, tetapi bagian akhirnya menyentuh.',
  },
  {
    email: 'maya.anggota@pustakakita.id',
    kode: 'PK-109',
    nilai: 5,
    ulasan: 'Puisi-puisinya tenang dan atmosfernya terasa sekali.',
  },
];

const settings = {
  nama_perpustakaan: 'PustakaKita',
  admin_whatsapp: '6281234567890',
  jam_layanan: 'Senin – Sabtu, 08.00 – 16.00 WIB',
  alamat: 'Jl. Pendidikan No. 17, Yogyakarta',
};

module.exports = { users, categories, books, loans, ratings, settings };
