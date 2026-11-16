'use strict';

/** Validator ringkas untuk form server-rendered. Nilai yang gagal validasi tidak pernah disimpan. */
class Validator {
  constructor(body = {}) {
    this.body = body;
    this.errors = {};
    this.values = {};
  }

  raw(field, fallback = '') {
    const value = this.body[field];
    if (value === undefined || value === null) return fallback;
    return String(value);
  }

  string(field, label, { min = 1, max = 255, required = true } = {}) {
    const value = this.raw(field).trim();
    this.values[field] = value;

    if (!value) {
      if (required) this.fail(field, `${label} wajib diisi.`);
      return value;
    }
    if (value.length < min) this.fail(field, `${label} minimal ${min} karakter.`);
    if (value.length > max) this.fail(field, `${label} maksimal ${max} karakter.`);
    return value;
  }

  integer(field, label, { min = 0, max = 1_000_000, required = true } = {}) {
    const raw = this.raw(field).trim();
    this.values[field] = raw;

    if (!raw) {
      if (required) this.fail(field, `${label} wajib diisi.`);
      return null;
    }
    if (!/^\d+$/.test(raw)) {
      this.fail(field, `${label} harus berupa bilangan bulat non-negatif.`);
      return null;
    }
    const value = Number(raw);
    if (value < min) this.fail(field, `${label} minimal ${min}.`);
    if (value > max) this.fail(field, `${label} maksimal ${max}.`);
    return value;
  }

  email(field, label) {
    const value = this.raw(field).trim().toLowerCase();
    this.values[field] = value;

    if (!value) {
      this.fail(field, `${label} wajib diisi.`);
      return value;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      this.fail(field, `${label} tidak valid.`);
    }
    if (value.length > 160) this.fail(field, `${label} terlalu panjang.`);
    return value;
  }

  password(field, label, { min = 8, mixed = false } = {}) {
    const value = this.raw(field);
    this.values[field] = '';

    if (!value) {
      this.fail(field, `${label} wajib diisi.`);
      return '';
    }
    if (value.length < min) this.fail(field, `${label} minimal ${min} karakter.`);
    if (value.length > 200) this.fail(field, `${label} maksimal 200 karakter.`);
    if (mixed && !(value.length > 0 && /[A-Za-z]/.test(value) && /\d/.test(value))) {
      this.fail(field, `${label} harus memuat huruf dan angka.`);
    }
    return value;
  }

  /** Nama orang: spasi dirapikan, wajib ada huruf, angka dan simbol aneh ditolak. */
  personName(field, label, { min = 2, max = 120 } = {}) {
    const value = this.raw(field).replace(/\s+/g, ' ').trim();
    this.values[field] = value;

    if (!value) {
      this.fail(field, `${label} wajib diisi.`);
      return value;
    }
    if (value.length < min) this.fail(field, `${label} minimal ${min} karakter.`);
    if (value.length > max) this.fail(field, `${label} maksimal ${max} karakter.`);
    if (!/\p{L}/u.test(value)) this.fail(field, `${label} harus mengandung huruf.`);
    if (/\d/.test(value)) this.fail(field, `${label} tidak boleh mengandung angka.`);
    if (!/^[\p{L}\p{M} .,'’\-]+$/u.test(value)) {
      this.fail(field, `${label} hanya boleh berisi huruf, spasi, titik, koma, apostrof, dan tanda hubung.`);
    }
    return value;
  }

  /** Nomor telepon: format penyimpanan dipertahankan, isi dan panjang digit diperiksa. */
  phone(field, label, { required = false, mobile = false } = {}) {
    const value = this.raw(field).trim();
    this.values[field] = value;

    if (!value) {
      if (required) this.fail(field, `${label} wajib diisi.`);
      return '';
    }

    const digits = value.replace(/\D/g, '');
    if (!/^[0-9+\-().\s]+$/.test(value)) {
      this.fail(field, `${label} hanya boleh berisi angka, spasi, tanda +, -, titik, atau ().`);
    } else if (digits.length < 8 || digits.length > 15) {
      this.fail(field, `${label} harus berisi 8–15 digit angka.`);
    } else if (mobile && !/^(?:62|0)?8\d{7,11}$/.test(digits)) {
      this.fail(field, `${label} harus nomor seluler Indonesia, misalnya 081234567890.`);
    }
    return value;
  }

  enumValue(field, label, allowed, { required = true, fallback = null } = {}) {
    const value = this.raw(field).trim();
    this.values[field] = value;

    if (!value && !required) return fallback;
    if (!allowed.includes(value)) {
      this.fail(field, `${label} tidak valid.`);
      return fallback;
    }
    return value;
  }

  boolean(field) {
    const value = ['1', 'on', 'true', 'ya'].includes(this.raw(field).toLowerCase());
    this.values[field] = value;
    return value;
  }

  fail(field, message) {
    if (!this.errors[field]) this.errors[field] = message;
  }

  get isValid() {
    return Object.keys(this.errors).length === 0;
  }
}

module.exports = { Validator };
