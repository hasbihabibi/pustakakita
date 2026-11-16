-- PustakaKita — skema basis data MySQL 8
-- Semua tabel memakai InnoDB + utf8mb4 agar mendukung transaksi dan teks Unicode.

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin', 'petugas', 'anggota') NOT NULL DEFAULT 'anggota',
  no_anggota    VARCHAR(20) DEFAULT NULL,
  telepon       VARCHAR(25) DEFAULT NULL,
  alamat        VARCHAR(255) DEFAULT NULL,
  status        ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_no_anggota (no_anggota),
  KEY idx_users_role (role)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama       VARCHAR(60) NOT NULL,
  deskripsi  VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_nama (nama)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS books (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode          VARCHAR(20) NOT NULL,
  judul         VARCHAR(160) NOT NULL,
  penulis       VARCHAR(120) NOT NULL,
  penerbit      VARCHAR(120) DEFAULT NULL,
  tahun_terbit  SMALLINT UNSIGNED DEFAULT NULL,
  category_id   INT UNSIGNED NOT NULL,
  deskripsi     TEXT NOT NULL,
  stok_total    INT UNSIGNED NOT NULL DEFAULT 1,
  stok_tersedia INT UNSIGNED NOT NULL DEFAULT 1,
  cover_theme   ENUM('laut', 'samudra', 'terakota', 'zamrud', 'indigo', 'senja', 'karang') NOT NULL DEFAULT 'laut',
  unggulan      TINYINT(1) NOT NULL DEFAULT 0,
  created_by    INT UNSIGNED DEFAULT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_books_kode (kode),
  KEY idx_books_category (category_id),
  KEY idx_books_judul (judul),
  CONSTRAINT fk_books_category FOREIGN KEY (category_id) REFERENCES categories (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_books_creator FOREIGN KEY (created_by) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_books_stok CHECK (stok_tersedia <= stok_total)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loans (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  book_id             INT UNSIGNED NOT NULL,
  user_id             INT UNSIGNED NOT NULL,
  tanggal_pinjam      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tanggal_jatuh_tempo DATE NOT NULL,
  tanggal_kembali     DATETIME DEFAULT NULL,
  status              ENUM('dipinjam', 'dikembalikan') NOT NULL DEFAULT 'dipinjam',
  PRIMARY KEY (id),
  KEY idx_loans_user (user_id, status),
  KEY idx_loans_book (book_id, status),
  CONSTRAINT fk_loans_book FOREIGN KEY (book_id) REFERENCES books (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ratings (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  book_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  nilai      TINYINT UNSIGNED NOT NULL,
  ulasan     VARCHAR(500) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ratings_book_user (book_id, user_id),
  KEY idx_ratings_book (book_id),
  CONSTRAINT fk_ratings_book FOREIGN KEY (book_id) REFERENCES books (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ratings_user FOREIGN KEY (user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_ratings_nilai CHECK (nilai BETWEEN 1 AND 5)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  nama   VARCHAR(60) NOT NULL,
  nilai  VARCHAR(255) NOT NULL,
  PRIMARY KEY (nama)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL,
  expires    BIGINT UNSIGNED NOT NULL,
  data       MEDIUMTEXT NOT NULL,
  PRIMARY KEY (session_id),
  KEY idx_sessions_expires (expires)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
