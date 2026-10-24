import jwt from 'jsonwebtoken';
import { ikmPool } from '../db/pool.js';

const RELOGIN = "Token tidak valid atau kadaluwarsa. Silakan masuk kembali.";
const DEACTIVATED = "Akun dinonaktifkan. Hubungi Tim Linen Rumah Sakit.";

const sameIds = (a = [], b = []) => {
  const x = [...a].map(Number).sort((p, q) => p - q);
  const y = [...b].map(Number).sort((p, q) => p - q);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Akses ditolak. Token otentikasi tidak ditemukan."
    });
  }

  jwt.verify(token, process.env.SESSION_SECRET || 'ikmsecret', async (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: RELOGIN });
    }

    // Akun perawat/user RS (mst_users_rs): status, role, dan ruangan dicek ulang ke DB
    // supaya nonaktif / ganti role / ganti unit berlaku tanpa menunggu token kadaluwarsa.
    if (user.userUnitId) {
      try {
        const [rows] = await ikmPool.query(
          "SELECT role, is_active FROM mst_users_rs WHERE id = ?", [user.userUnitId]);
        if (!rows.length) {
          return res.status(403).json({ success: false, message: RELOGIN });
        }
        if (!rows[0].is_active) {
          return res.status(403).json({ success: false, message: DEACTIVATED });
        }
        if (rows[0].role !== user.role) {
          return res.status(403).json({ success: false, message: RELOGIN });
        }
        if (user.role === 'unit') {
          const [rr] = await ikmPool.query(
            "SELECT room_id FROM mst_users_rs_rooms WHERE user_id = ?", [user.userUnitId]);
          if (!sameIds(rr.map(r => r.room_id), user.roomIds)) {
            return res.status(403).json({ success: false, message: RELOGIN });
          }
        }
      } catch (e) {
        console.error('authenticateToken:', e);
        return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
      }
    }

    req.user = user;
    next();
  });
};
