'use strict';

/**
 * Satu-satunya sumber format nomor anggota.
 * Nomor diturunkan dari id pengguna (id unik, jadi nomor unik tanpa balapan),
 * dengan cadangan urutan maksimum bila nomor tersebut sudah dipakai akun lain.
 */

const PREFIX = 'AGT-';

function memberNumber(id) {
  return `${PREFIX}${String(id).padStart(3, '0')}`;
}

async function assignMemberNumber(connection, userId) {
  const preferred = memberNumber(userId);
  const [taken] = await connection.execute(
    'SELECT id FROM users WHERE no_anggota = ? AND id <> ? LIMIT 1',
    [preferred, userId],
  );

  let number = preferred;
  if (taken.length > 0) {
    const [[row]] = await connection.execute(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(no_anggota, 5) AS UNSIGNED)), 0) + 1 AS nomor FROM users WHERE no_anggota IS NOT NULL",
    );
    number = memberNumber(row.nomor);
  }

  await connection.execute('UPDATE users SET no_anggota = ? WHERE id = ?', [number, userId]);
  return number;
}

module.exports = { PREFIX, memberNumber, assignMemberNumber };
