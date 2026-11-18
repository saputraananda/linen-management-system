// Pencatatan perubahan Terpakai / Dirty Utility per linen-ruangan ke tr_unit_activity_log.
// Semua jalur yang mengubah mst_hospital_linen_rooms (perawat, Tim Linen RS, IKM, pengambilan kotor,
// koreksi kotor) memakai pola yang sama: potret sebelum -> ubah -> potret sesudah -> catat selisihnya.
// Hanya perubahan bersih yang dicatat, jadi simpan ulang tanpa perubahan tidak menghasilkan log.

const keyOf = (hospitalLinenId, roomId) => `${Number(hospitalLinenId)}:${Number(roomId)}`;

/** Ambil Terpakai & Dirty untuk pasangan linen-ruangan. pairs: [{ hospitalLinenId, roomId }] */
export const snapshotRoomStock = async (conn, pairs) => {
  const uniq = new Map();
  for (const p of pairs || []) {
    if (!p?.hospitalLinenId || !p?.roomId) continue;
    uniq.set(keyOf(p.hospitalLinenId, p.roomId), [Number(p.hospitalLinenId), Number(p.roomId)]);
  }
  const snap = new Map();
  if (!uniq.size) return snap;
  const [rows] = await conn.query(
    `SELECT hospital_linen_id, room_id, qty_terpakai, qty_dirty
       FROM mst_hospital_linen_rooms
      WHERE (hospital_linen_id, room_id) IN (?)`,
    [[...uniq.values()]]
  );
  for (const [k] of uniq) snap.set(k, { terpakai: 0, dirty: 0, exists: false });
  rows.forEach(r => snap.set(keyOf(r.hospital_linen_id, r.room_id), {
    terpakai: Number(r.qty_terpakai || 0), dirty: Number(r.qty_dirty || 0), exists: true
  }));
  return snap;
};

/**
 * Catat selisih antara dua potret.
 * prefix: awalan action_type, mis. 'RS_UPDATE' -> RS_UPDATE_TERPAKAI / RS_UPDATE_DIRTY
 * actor : nama pelaku (kolom nurse_name, maks 150 karakter)
 */
export const logRoomStockChanges = async (conn, before, after, { prefix, actor }) => {
  const name = String(actor || 'Sistem').slice(0, 150);
  const values = [];
  for (const [k, aft] of after) {
    const bef = before.get(k) || { terpakai: 0, dirty: 0 };
    const [hospitalLinenId, roomId] = k.split(':').map(Number);
    if (bef.terpakai !== aft.terpakai) values.push([hospitalLinenId, roomId, name, `${prefix}_TERPAKAI`, bef.terpakai, aft.terpakai]);
    if (bef.dirty !== aft.dirty) values.push([hospitalLinenId, roomId, name, `${prefix}_DIRTY`, bef.dirty, aft.dirty]);
  }
  if (!values.length) return 0;
  await conn.query(
    `INSERT INTO tr_unit_activity_log (hospital_linen_id, room_id, nurse_name, action_type, old_value, new_value) VALUES ?`,
    [values]
  );
  return values.length;
};

/** Nama pelaku dari token login */
export const actorName = (user, fallback = 'Sistem') =>
  user?.nurseName || user?.fullName || user?.username || fallback;
