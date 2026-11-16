'use strict';

/**
 * Log peristiwa keamanan dalam satu baris JSON agar mudah dicari di log
 * agregator. Tidak pernah mencatat kata sandi atau token sesi.
 */
function securityLog(event, detail = {}) {
  const entry = { ts: new Date().toISOString(), event, ...detail };
  console.warn(`[security] ${JSON.stringify(entry)}`);
}

module.exports = { securityLog };
