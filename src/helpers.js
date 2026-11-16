'use strict';

const COVER_THEMES = {
  laut: { dari: '#12324F', ke: '#0B1F3A', label: 'Navy Laut' },
  samudra: { dari: '#1B4173', ke: '#0D2340', label: 'Navy Samudra' },
  terakota: { dari: '#C2185B', ke: '#7A0C38', label: 'Raspberry' },
  zamrud: { dari: '#0F5E58', ke: '#0A3330', label: 'Teal Gelap' },
  indigo: { dari: '#3B2F6B', ke: '#1C1440', label: 'Violet Malam' },
  senja: { dari: '#8E1B5B', ke: '#44092B', label: 'Wine' },
  karang: { dari: '#243B57', ke: '#0B1F3A', label: 'Navy Karang' },
};

const DEFAULT_SETTINGS = {
  nama_perpustakaan: 'PustakaKita',
  admin_whatsapp: '6281234567890',
  jam_layanan: 'Senin – Sabtu, 08.00 – 16.00 WIB',
  alamat: 'Jl. Pendidikan No. 17, Yogyakarta',
};

function coverTheme(name) {
  return COVER_THEMES[name] || COVER_THEMES.laut;
}

function coverStyle(name) {
  const theme = coverTheme(name);
  return `background-image: linear-gradient(140deg, ${theme.dari} 0%, ${theme.ke} 100%);`;
}

function formatDate(value, { withTime = false } = {}) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

function toDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Sisa hari sampai jatuh tempo; negatif berarti terlambat. */
function daysUntil(dueDate) {
  const due = toDateOnly(dueDate);
  if (!due) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due.getTime() - todayUtc) / 86_400_000);
}

function loanState(loan) {
  if (loan.status === 'dikembalikan') return { code: 'selesai', label: 'Dikembalikan', tone: 'netral' };
  const remaining = daysUntil(loan.tanggal_jatuh_tempo);
  if (remaining !== null && remaining < 0) return { code: 'terlambat', label: 'Terlambat', tone: 'bahaya' };
  if (remaining !== null && remaining <= 2) {
    return { code: 'segera', label: 'Jatuh tempo dekat', tone: 'peringatan' };
  }
  return { code: 'dipinjam', label: 'Sedang dipinjam', tone: 'info' };
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

function whatsappUrl(phone, message) {
  const target = normalizePhone(phone);
  if (!target) return '';
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}

function setFlash(req, type, message) {
  if (!req.session) return;
  req.session.flash = { type, message };
}

function flashMiddleware(req, res, next) {
  res.locals.flash = req.session?.flash || null;
  if (req.session) req.session.flash = null;
  next();
}

function loginRedirectFor(role) {
  if (role === 'admin') return '/dashboard';
  if (role === 'petugas') return '/kelola/buku';
  return '/';
}

function roleLabel(role) {
  return { admin: 'Administrator', petugas: 'Petugas Perpustakaan', anggota: 'Anggota' }[role] || role;
}

function stars(nilai) {
  const rounded = Math.round(Number(nilai) || 0);
  return '★★★★★'.slice(0, rounded) + '☆☆☆☆☆'.slice(0, 5 - rounded);
}

module.exports = {
  COVER_THEMES,
  DEFAULT_SETTINGS,
  coverTheme,
  coverStyle,
  formatDate,
  daysUntil,
  loanState,
  normalizePhone,
  whatsappUrl,
  setFlash,
  flashMiddleware,
  loginRedirectFor,
  roleLabel,
  stars,
};
