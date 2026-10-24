import { ikmPool } from '../../db/pool.js';
import { usernameConflict } from '../../utils/usernameConflict.js';

export const getProfile = async (req, res) => {
  try {
    const [u] = await ikmPool.query("SELECT nurse_name, phone, username, password FROM mst_users_rs WHERE id = ?", [req.user.userUnitId]);
    if (!u.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    res.json({ success: true, profile: u[0] });
  } catch (e) {
    console.error('getProfile', e);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

export const updateProfile = async (req, res) => {
  const v = ['nurse_name', 'phone', 'username', 'password'].map(k => (req.body[k] || '').trim());
  if (!v[0] || !v[2] || !v[3]) return res.status(400).json({ success: false, message: 'Nama, username, dan password wajib diisi' });
  try {
    const [cur] = await ikmPool.query("SELECT username FROM mst_users_rs WHERE id = ?", [req.user.userUnitId]);
    if (cur.length && cur[0].username.toLowerCase() !== v[2].toLowerCase()) {
      const clash = await usernameConflict(v[2]);
      if (clash) return res.status(409).json({ success: false, message: clash });
    }
    await ikmPool.query(
      "UPDATE mst_users_rs SET nurse_name=?, phone=?, username=?, password=? WHERE id=?", [...v, req.user.userUnitId]);
    res.json({ success: true, nurseName: v[0], username: v[2] });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Username sudah digunakan' });
    console.error('updateProfile', e);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};
