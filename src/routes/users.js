'use strict';

const express = require('express');
const { pool, query, queryOne, withTransaction } = require('../db');
const { requireRole, hashPassword } = require('../auth');
const { Validator } = require('../validate');
const { assignMemberNumber } = require('../member-number');
const { setFlash, parseId } = require('../helpers');
const { securityLog } = require('../security-log');

const router = express.Router();

const ROLES = ['admin', 'petugas', 'anggota'];
const STATUSES = ['aktif', 'nonaktif'];

router.use('/admin/pengguna', requireRole('admin'));

function emptyUser() {
  return {
    id: null,
    nama: '',
    email: '',
    role: 'anggota',
    no_anggota: '',
    telepon: '',
    alamat: '',
    status: 'aktif',
  };
}

function validateUser(body, { requirePassword }) {
  const v = new Validator(body);
  v.string('nama', 'Nama lengkap', { min: 2, max: 120 });
  v.email('email', 'Email');
  v.enumValue('role', 'Peran', ROLES, { fallback: 'anggota' });
  v.enumValue('status', 'Status akun', STATUSES, { fallback: 'aktif' });

  const telepon = v.phone('telepon', 'Nomor telepon');
  const alamat = v.string('alamat', 'Alamat', { min: 0, max: 255, required: false });

  let password = '';
  if (requirePassword) {
    password = v.password('password', 'Kata sandi', { min: 8 });
  } else if (String(body.password || '').trim()) {
    password = v.password('password', 'Kata sandi baru', { min: 8 });
  }

  return {
    isValid: v.isValid,
    errors: v.errors,
    data: {
      nama: v.values.nama,
      email: v.values.email,
      role: v.values.role,
      status: v.values.status,
      telepon: telepon || null,
      alamat: alamat || null,
      password,
    },
  };
}

async function renderForm(res, { mode, user, errors, status = 200 }) {
  res.status(status);
  return res.render('users/form', {
    title: mode === 'create' ? 'Tambah Pengguna' : 'Edit Pengguna',
    active: 'pengguna',
    mode,
    user,
    errors,
    roles: ROLES,
  });
}

router.get('/admin/pengguna', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 120);
    const role = ROLES.includes(req.query.role) ? req.query.role : '';
    const status = STATUSES.includes(req.query.status) ? req.query.status : '';

    const conditions = [];
    const params = [];
    if (q) {
      conditions.push('(u.nama LIKE ? OR u.email LIKE ? OR u.no_anggota LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (role) {
      conditions.push('u.role = ?');
      params.push(role);
    }
    if (status) {
      conditions.push('u.status = ?');
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [users, summary] = await Promise.all([
      query(
        `SELECT u.*,
                (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id AND l.status = 'dipinjam') AS pinjaman_aktif,
                (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id) AS total_pinjaman
           FROM users u
           ${where}
          ORDER BY FIELD(u.role, 'admin', 'petugas', 'anggota'), u.nama ASC`,
        params,
      ),
      queryOne(
        `SELECT SUM(role = 'admin') AS admin,
                SUM(role = 'petugas') AS petugas,
                SUM(role = 'anggota') AS anggota,
                SUM(status = 'nonaktif') AS nonaktif
           FROM users`,
      ),
    ]);

    res.render('users/index', {
      title: 'Kelola Pengguna',
      active: 'pengguna',
      users,
      summary,
      filters: { q, role, status },
      roles: ROLES,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/pengguna/baru', (req, res) => renderForm(res, { mode: 'create', user: emptyUser(), errors: {} }));

router.post('/admin/pengguna', async (req, res, next) => {
  const { isValid, errors, data } = validateUser(req.body, { requirePassword: true });

  try {
    if (!isValid) return renderForm(res, { mode: 'create', user: { ...emptyUser(), ...req.body }, errors });

    const duplicate = await queryOne('SELECT id FROM users WHERE email = ? LIMIT 1', [data.email]);
    if (duplicate) return renderForm(res, { mode: 'create', user: { ...emptyUser(), ...req.body }, errors: { email: 'Email sudah terdaftar.' } });

    await withTransaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO users (nama, email, password_hash, role, telepon, alamat, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.nama, data.email, hashPassword(data.password), data.role, data.telepon, data.alamat, data.status],
      );
      if (data.role === 'anggota') await assignMemberNumber(connection, result.insertId);
    });

    setFlash(req, 'sukses', `Pengguna "${data.nama}" berhasil ditambahkan.`);
    res.redirect('/admin/pengguna');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return renderForm(res, { mode: 'create', user: { ...emptyUser(), ...req.body }, errors: { email: 'Email sudah terdaftar.' } });
    }
    next(error);
  }
});

router.get('/admin/pengguna/:id/edit', async (req, res, next) => {
  try {
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [parseId(req.params.id)]);
    if (!user) {
      res.status(404);
      return res.render('errors/404', { title: 'Pengguna tidak ditemukan', active: 'pengguna' });
    }
    return renderForm(res, { mode: 'edit', user, errors: {} });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/pengguna/:id', async (req, res, next) => {
  const id = parseId(req.params.id);
  const { isValid, errors, data } = validateUser(req.body, { requirePassword: false });

  try {
    const existing = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      res.status(404);
      return res.render('errors/404', { title: 'Pengguna tidak ditemukan', active: 'pengguna' });
    }

    const isSelf = existing.id === req.user.id;
    if (isSelf && isValid && (data.role !== existing.role || data.status !== 'aktif')) {
      res.status(422);
      return renderForm(res, {
        mode: 'edit',
        user: { ...existing, ...req.body },
        errors: { umum: 'Anda tidak dapat mengubah peran atau menonaktifkan akun sendiri.' },
        status: 422,
      });
    }

    if (!isValid) return renderForm(res, { mode: 'edit', user: { ...existing, ...req.body }, errors });

    const duplicate = await queryOne('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [data.email, id]);
    if (duplicate) {
      return renderForm(res, { mode: 'edit', user: { ...existing, ...req.body }, errors: { email: 'Email sudah dipakai pengguna lain.' } });
    }

    let passwordHash = existing.password_hash;
    if (data.password) passwordHash = hashPassword(data.password);

    const noAnggota = data.role === 'anggota' ? existing.no_anggota : null;

    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE users SET nama = ?, email = ?, password_hash = ?, role = ?, no_anggota = ?, telepon = ?, alamat = ?, status = ?
          WHERE id = ?`,
        [
          data.nama,
          data.email,
          passwordHash,
          data.role,
          noAnggota,
          data.telepon,
          data.alamat,
          data.status,
          id,
        ],
      );
      if (data.role === 'anggota' && !noAnggota) await assignMemberNumber(connection, id);
    });

    if (existing.role !== data.role) {
      securityLog('user_role_changed', { actorId: req.user.id, userId: id, from: existing.role, to: data.role });
    }
    if (existing.status !== data.status) {
      securityLog('user_status_changed', { actorId: req.user.id, userId: id, from: existing.status, to: data.status });
    }

    setFlash(req, 'sukses', `Data pengguna "${data.nama}" berhasil diperbarui.`);
    res.redirect('/admin/pengguna');
  } catch (error) {
    next(error);
  }
});

router.post('/admin/pengguna/:id/status', async (req, res, next) => {
  const id = parseId(req.params.id);

  try {
    const user = await queryOne('SELECT id, nama, role, status FROM users WHERE id = ?', [id]);
    if (!user) {
      setFlash(req, 'galat', 'Pengguna tidak ditemukan.');
      return res.redirect('/admin/pengguna');
    }
    if (user.id === req.user.id) {
      setFlash(req, 'galat', 'Anda tidak dapat menonaktifkan akun sendiri.');
      return res.redirect('/admin/pengguna');
    }

    if (user.role === 'admin' && user.status === 'aktif') {
      const admins = await queryOne("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND status = 'aktif'");
      if (admins.total <= 1) {
        setFlash(req, 'galat', 'Minimal harus ada satu administrator aktif.');
        return res.redirect('/admin/pengguna');
      }
    }

    const newStatus = user.status === 'aktif' ? 'nonaktif' : 'aktif';
    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [newStatus, id]);
    securityLog('user_status_changed', { actorId: req.user.id, userId: id, from: user.status, to: newStatus });
    setFlash(
      req,
      'sukses',
      `Akun "${user.nama}" kini ${newStatus === 'aktif' ? 'aktif' : 'nonaktif'}.`,
    );
    res.redirect('/admin/pengguna');
  } catch (error) {
    next(error);
  }
});

router.post('/admin/pengguna/:id/hapus', async (req, res, next) => {
  const id = parseId(req.params.id);

  try {
    const user = await queryOne('SELECT id, nama, role FROM users WHERE id = ?', [id]);
    if (!user) {
      setFlash(req, 'galat', 'Pengguna tidak ditemukan.');
      return res.redirect('/admin/pengguna');
    }
    if (user.id === req.user.id) {
      setFlash(req, 'galat', 'Anda tidak dapat menghapus akun sendiri.');
      return res.redirect('/admin/pengguna');
    }

    const loans = await queryOne('SELECT COUNT(*) AS total FROM loans WHERE user_id = ?', [id]);
    if (loans.total > 0) {
      setFlash(
        req,
        'galat',
        `"${user.nama}" memiliki ${loans.total} riwayat peminjaman sehingga akun tidak dapat dihapus. Nonaktifkan akun sebagai gantinya.`,
      );
      return res.redirect('/admin/pengguna');
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    securityLog('user_deleted', { actorId: req.user.id, userId: id });
    setFlash(req, 'sukses', `Akun "${user.nama}" telah dihapus.`);
    res.redirect('/admin/pengguna');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
