import { mainPool, ikmPool } from '../db/pool.js';

// Login memeriksa banyak tabel berurutan (valet -> mst_users_rs -> akun umum RS -> akun umum unit),
// jadi username di mst_users_rs tidak boleh sama dengan username di tabel lain.
// Keunikan di dalam mst_users_rs sendiri dijaga oleh unique key (ER_DUP_ENTRY).
export async function usernameConflict(username) {
  const [valet] = await mainPool.query(
    "SELECT 1 FROM users WHERE username = ? OR email = ? LIMIT 1", [username, username]);
  if (valet.length) return 'Username sudah digunakan akun lain';

  const [hosp] = await ikmPool.query(
    "SELECT 1 FROM mst_hospital WHERE username = ? OR username_unit = ? LIMIT 1", [username, username]);
  if (hosp.length) return 'Username sudah digunakan akun lain';

  return null;
}
