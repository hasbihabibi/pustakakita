'use strict';

/**
 * Pembatas laju sederhana di memori proses.
 *
 * Bukan pengganti rate limit terdistribusi, tetapi menahan brute force pada
 * satu instance. Kunci utama login adalah email akun, sehingga menukar alamat
 * IP di header X-Forwarded-For tidak cukup untuk mengakalinya.
 */

const MAX_KEYS = 10_000;

const buckets = new Map();

function prune(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size <= MAX_KEYS) return;

  const oldest = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
  const toRemove = oldest.length - Math.floor(MAX_KEYS / 2);
  for (let index = 0; index < toRemove; index += 1) {
    buckets.delete(oldest[index][0]);
  }
}

function activeBucket(key) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= Date.now()) return null;
  return bucket;
}

/** Periksa status tanpa menambah hitungan. */
function check(key, { limit }) {
  const bucket = activeBucket(key);
  if (!bucket) return { blocked: false, count: 0, retryAfterMs: 0 };
  return {
    blocked: bucket.count >= limit,
    count: bucket.count,
    retryAfterMs: Math.max(bucket.resetAt - Date.now(), 0),
  };
}

/** Catat satu percobaan. */
function record(key, { limit, windowMs }) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
    if (buckets.size > MAX_KEYS) prune(now);
  }
  bucket.count += 1;
  return {
    blocked: bucket.count >= limit,
    count: bucket.count,
    retryAfterMs: Math.max(bucket.resetAt - now, 0),
  };
}

function clear(key) {
  buckets.delete(key);
}

module.exports = { check, record, clear, size: () => buckets.size };
