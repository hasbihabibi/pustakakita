'use strict';

const session = require('express-session');
const { pool } = require('./db');

/**
 * Session store berbasis MySQL agar sesi tetap hidup setelah proses restart
 * dan dapat dipakai lebih dari satu instance aplikasi.
 */
class MySQLSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.table = options.table || 'sessions';
    this.ttlMs = options.ttlMs || 1000 * 60 * 60 * 8;
    this.cleanupTimer = setInterval(() => this.cleanup(), 1000 * 60 * 15);
    this.cleanupTimer.unref?.();
  }

  get(sid, callback) {
    pool
      .execute(`SELECT data FROM ${this.table} WHERE session_id = ? AND expires > ?`, [sid, Date.now()])
      .then(([rows]) => {
        if (!rows.length) return callback(null, null);
        try {
          callback(null, JSON.parse(rows[0].data));
        } catch {
          callback(null, null);
        }
      })
      .catch((error) => callback(error));
  }

  set(sid, sessionData, callback = () => {}) {
    const expires = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + this.ttlMs;

    pool
      .execute(
        `INSERT INTO ${this.table} (session_id, expires, data) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)`,
        [sid, expires, JSON.stringify(sessionData)],
      )
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  touch(sid, sessionData, callback = () => {}) {
    const expires = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + this.ttlMs;

    pool
      .execute(`UPDATE ${this.table} SET expires = ? WHERE session_id = ?`, [expires, sid])
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  destroy(sid, callback = () => {}) {
    pool
      .execute(`DELETE FROM ${this.table} WHERE session_id = ?`, [sid])
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  cleanup() {
    pool.execute(`DELETE FROM ${this.table} WHERE expires <= ?`, [Date.now()]).catch((error) => {
      console.error('Gagal membersihkan sesi kedaluwarsa:', error.message);
    });
  }
}

module.exports = { MySQLSessionStore };
