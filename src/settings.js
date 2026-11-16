'use strict';

const { query } = require('./db');
const { DEFAULT_SETTINGS } = require('./helpers');

let cache = { data: null, at: 0 };
const TTL_MS = 30_000;

/** Pengaturan perpustakaan dibaca dari tabel settings dengan cache singkat. */
async function getSettings({ force = false } = {}) {
  if (!force && cache.data && Date.now() - cache.at < TTL_MS) return cache.data;

  try {
    const rows = await query('SELECT nama, nilai FROM settings');
    const data = { ...DEFAULT_SETTINGS };
    for (const row of rows) data[row.nama] = row.nilai;
    cache = { data, at: Date.now() };
    return data;
  } catch (error) {
    console.error('Gagal membaca pengaturan, memakai nilai bawaan:', error.message);
    return { ...DEFAULT_SETTINGS };
  }
}

function invalidateSettingsCache() {
  cache = { data: null, at: 0 };
}

module.exports = { getSettings, invalidateSettingsCache };
