import { ikmPool } from '../../db/pool.js';
import { usernameConflict } from '../../utils/usernameConflict.js';

const dupMsg = (e) => (e.code === 'ER_DUP_ENTRY' ? 'Username sudah digunakan' : null);

// Hanya ruangan milik RS ini yang boleh di-assign
const validRooms = async (hospitalId, roomIds) => {
  if (!roomIds.length) return [];
  const [r] = await ikmPool.query("SELECT id FROM mst_rooms_rs WHERE hospital_id = ? AND id IN (?)", [hospitalId, roomIds]);
  return r.map(x => x.id);
};

const setRooms = async (conn, userId, roomIds) => {
  await conn.query("DELETE FROM mst_users_rs_rooms WHERE user_id = ?", [userId]);
  if (roomIds.length) await conn.query("INSERT INTO mst_users_rs_rooms (user_id, room_id) VALUES ?", [roomIds.map(r => [userId, r])]);
};

const readBody = (b) => ({
  name: (b.nurse_name || '').trim(),
  phone: (b.phone || '').trim(),
  username: (b.username || '').trim(),
  password: (b.password || '').trim(),
  role: b.role === 'rs' ? 'rs' : 'unit',
  roomIds: Array.isArray(b.room_ids) ? b.room_ids.map(Number).filter(Boolean) : []
});

export const listUnitUsers = async (req, res) => {
  try {
    const hid = req.user.id;
    const [users] = await ikmPool.query(
      "SELECT id, nurse_name, phone, username, password, role, is_active FROM mst_users_rs WHERE hospital_id = ? ORDER BY nurse_name", [hid]);
    const [links] = await ikmPool.query(
      "SELECT ur.user_id, ur.room_id FROM mst_users_rs_rooms ur INNER JOIN mst_users_rs u ON u.id = ur.user_id WHERE u.hospital_id = ?", [hid]);
    const [rooms] = await ikmPool.query("SELECT id, room_name FROM mst_rooms_rs WHERE hospital_id = ? ORDER BY room_name", [hid]);
    res.json({
      success: true,
      rooms,
      users: users.map(u => ({ ...u, room_ids: links.filter(l => l.user_id === u.id).map(l => l.room_id) }))
    });
  } catch (e) {
    console.error('listUnitUsers', e);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

export const createUnitUser = async (req, res) => {
  const { name, phone, username, password, role, roomIds } = readBody(req.body);
  if (!name || !username || !password) {
    return res.status(400).json({ success: false, message: 'Nama, username, dan password wajib diisi' });
  }
  const conn = await ikmPool.getConnection();
  try {
    const clash = await usernameConflict(username);
    if (clash) {
      conn.release();
      return res.status(409).json({ success: false, message: clash });
    }
    const rooms = role === 'rs' ? [] : await validRooms(req.user.id, roomIds);
    await conn.beginTransaction();
    const [r] = await conn.query(
      "INSERT INTO mst_users_rs (hospital_id, nurse_name, phone, username, password, role) VALUES (?,?,?,?,?,?)",
      [req.user.id, name, phone, username, password, role]);
    await setRooms(conn, r.insertId, rooms);
    await conn.commit();
    res.json({ success: true, id: r.insertId });
  } catch (e) {
    await conn.rollback();
    const m = dupMsg(e);
    if (!m) console.error('createUnitUser', e);
    res.status(m ? 409 : 500).json({ success: false, message: m || 'Terjadi kesalahan pada server' });
  } finally {
    conn.release();
  }
};

export const updateUnitUser = async (req, res) => {
  const { name, phone, username, password, role, roomIds } = readBody(req.body);
  if (!name || !username || !password) {
    return res.status(400).json({ success: false, message: 'Nama, username, dan password wajib diisi' });
  }
  const conn = await ikmPool.getConnection();
  try {
    const [cur] = await ikmPool.query("SELECT username FROM mst_users_rs WHERE id=? AND hospital_id=?", [req.params.id, req.user.id]);
    if (!cur.length) {
      conn.release();
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }
    if (cur[0].username.toLowerCase() !== username.toLowerCase()) {
      const clash = await usernameConflict(username);
      if (clash) {
        conn.release();
        return res.status(409).json({ success: false, message: clash });
      }
    }
    const rooms = role === 'rs' ? [] : await validRooms(req.user.id, roomIds);
    await conn.beginTransaction();
    const [r] = await conn.query(
      "UPDATE mst_users_rs SET nurse_name=?, phone=?, username=?, password=?, role=? WHERE id=? AND hospital_id=?",
      [name, phone, username, password, role, req.params.id, req.user.id]);
    if (!r.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }
    await setRooms(conn, req.params.id, rooms);
    await conn.commit();
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    const m = dupMsg(e);
    if (!m) console.error('updateUnitUser', e);
    res.status(m ? 409 : 500).json({ success: false, message: m || 'Terjadi kesalahan pada server' });
  } finally {
    conn.release();
  }
};

export const deleteUnitUser = async (req, res) => {
  const conn = await ikmPool.getConnection();
  try {
    await conn.beginTransaction();
    const [own] = await conn.query("SELECT id FROM mst_users_rs WHERE id=? AND hospital_id=?", [req.params.id, req.user.id]);
    if (!own.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }
    await conn.query("DELETE FROM mst_users_rs_rooms WHERE user_id = ?", [req.params.id]);
    await conn.query("DELETE FROM mst_users_rs WHERE id=? AND hospital_id=?", [req.params.id, req.user.id]);
    await conn.commit();
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    const fk = e.code === 'ER_ROW_IS_REFERENCED_2';
    if (!fk) console.error('deleteUnitUser', e);
    res.status(fk ? 409 : 500).json({ success: false, message: fk ? 'User sudah punya riwayat transaksi, nonaktifkan saja' : 'Terjadi kesalahan pada server' });
  } finally {
    conn.release();
  }
};

export const toggleUnitUser = async (req, res) => {
  try {
    const [r] = await ikmPool.query(
      "UPDATE mst_users_rs SET is_active = IF(is_active=1,0,1) WHERE id=? AND hospital_id=?", [req.params.id, req.user.id]);
    if (!r.affectedRows) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    res.json({ success: true });
  } catch (e) {
    console.error('toggleUnitUser', e);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};
