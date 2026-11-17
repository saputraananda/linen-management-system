import { ikmPool } from '../db/pool.js';
import { getSignatureUrl } from '../middleware/upload.js';

// ───────────────────────── TTD Serah Terima per Unit (ruangan) ─────────────────────────
// Bila RS mengaktifkan mst_hospital.require_unit_signature, setiap ruangan yang menurunkan linen kotor
// wajib TTD Valet + Perawat Unit (saat pickup dan saat delivery) sebelum TTD akhir Tim Linen RS + Valet.
// Ruangan Gudang Linen (is_gudang_linen = 1) dikecualikan.
// Aturan hanya berlaku untuk transaksi yang dibuat setelah fitur aktif (tr_linen_transaction.unit_sign_required).

// Dibuat otomatis saat server start (idempotent), sama seperti skema komplain.
const ensureRoomSignSchema = async () => {
  try {
    await ikmPool.query(`
      CREATE TABLE IF NOT EXISTS tr_linen_transaction_room_sign (
        id bigint unsigned NOT NULL AUTO_INCREMENT,
        transaction_id bigint unsigned NOT NULL,
        room_id bigint unsigned NOT NULL,
        nurse_name_pickup varchar(255) DEFAULT NULL,
        signature_nurse_pickup varchar(255) DEFAULT NULL,
        signature_valet_pickup varchar(255) DEFAULT NULL,
        valet_pickup_id int unsigned DEFAULT NULL,
        signed_pickup_at datetime DEFAULT NULL,
        nurse_name_delivery varchar(255) DEFAULT NULL,
        signature_nurse_delivery varchar(255) DEFAULT NULL,
        signature_valet_delivery varchar(255) DEFAULT NULL,
        valet_delivery_id int unsigned DEFAULT NULL,
        signed_delivery_at datetime DEFAULT NULL,
        created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_room_sign_tx_room (transaction_id, room_id),
        KEY idx_room_sign_room (room_id),
        CONSTRAINT fk_room_sign_transaction FOREIGN KEY (transaction_id) REFERENCES tr_linen_transaction (id) ON DELETE CASCADE,
        CONSTRAINT fk_room_sign_room FOREIGN KEY (room_id) REFERENCES mst_rooms_rs (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

    const addColumnIfMissing = async (table, column, ddl) => {
      const [[col]] = await ikmPool.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, column]);
      if (!Number(col.n)) await ikmPool.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    };
    // Saklar per RS (default nonaktif)
    await addColumnIfMissing('mst_hospital', 'require_unit_signature',
      'require_unit_signature tinyint(1) NOT NULL DEFAULT 0');
    // Ditetapkan saat transaksi dibuat, supaya transaksi lama tidak ikut aturan baru
    await addColumnIfMissing('tr_linen_transaction', 'unit_sign_required',
      'unit_sign_required tinyint(1) NOT NULL DEFAULT 0');
  } catch (e) {
    console.error('ensureRoomSignSchema:', e.message);
  }
};
ensureRoomSignSchema();

/** Transaksi baru wajib TTD unit bila saklar RS aktif dan RS punya ruangan selain Gudang Linen */
export const hospitalRequiresUnitSign = async (conn, hospitalId) => {
  const [[row]] = await conn.query(
    `SELECT h.require_unit_signature AS flag,
            (SELECT COUNT(*) FROM mst_rooms_rs r WHERE r.hospital_id = h.id AND COALESCE(r.is_gudang_linen, 0) = 0) AS rooms
       FROM mst_hospital h WHERE h.id = ?`, [hospitalId]);
  return !!row && Number(row.flag) === 1 && Number(row.rooms) > 0;
};

const stageOf = (row, stage) => {
  if (!row) return null;
  const nurseSig = row[`signature_nurse_${stage}`];
  const valetSig = row[`signature_valet_${stage}`];
  if (!nurseSig && !valetSig && !row[`nurse_name_${stage}`]) return null;
  return {
    nurse_name: row[`nurse_name_${stage}`] || null,
    signature_nurse: getSignatureUrl(nurseSig),
    signature_valet: getSignatureUrl(valetSig),
    valet_id: row[`valet_${stage}_id`] || null,
    signed_at: row[`signed_${stage}_at`] || null,
    complete: !!(nurseSig && valetSig && row[`nurse_name_${stage}`])
  };
};

/**
 * Status TTD per ruangan untuk satu transaksi.
 * roomIds (opsional) membatasi ke ruangan tertentu (portal perawat unit).
 */
export const getRoomSignState = async (conn, transactionId, { roomIds = null } = {}) => {
  const [[tx]] = await conn.query(
    'SELECT unit_sign_required FROM tr_linen_transaction WHERE id = ?', [transactionId]);
  const required = !!tx && Number(tx.unit_sign_required) === 1;

  const [rooms] = await conn.query(
    `SELECT d.room_id, r.room_name, COALESCE(r.is_gudang_linen, 0) AS is_gudang_linen,
            SUM(d.qty_kotor) AS total_kotor, SUM(COALESCE(d.qty_bersih, 0)) AS total_bersih
       FROM tr_linen_transaction_detail d
       INNER JOIN mst_rooms_rs r ON r.id = d.room_id
      WHERE d.transaction_id = ?${roomIds ? ' AND d.room_id IN (?)' : ''}
      GROUP BY d.room_id, r.room_name, r.is_gudang_linen
     HAVING total_kotor > 0
      ORDER BY r.room_name`,
    roomIds ? [transactionId, roomIds] : [transactionId]);

  const [signRows] = await conn.query(
    'SELECT * FROM tr_linen_transaction_room_sign WHERE transaction_id = ?', [transactionId]);
  const signByRoom = new Map(signRows.map(s => [Number(s.room_id), s]));

  const list = rooms.map(r => {
    const sign = signByRoom.get(Number(r.room_id));
    return {
      room_id: Number(r.room_id),
      room_name: r.room_name,
      total_kotor: Number(r.total_kotor),
      total_bersih: Number(r.total_bersih),
      required: required && Number(r.is_gudang_linen) !== 1,
      pickup: stageOf(sign, 'pickup'),
      delivery: stageOf(sign, 'delivery')
    };
  });
  const pending = (stage) => list.filter(r => r.required && !r[stage]?.complete).map(r => r.room_name);

  return {
    required,
    rooms: list,
    pending_pickup: pending('pickup'),
    pending_delivery: pending('delivery')
  };
};

/** Sidik jari isi tiap ruangan; dipakai untuk mendeteksi ruangan yang isinya berubah setelah TTD */
export const roomFingerprints = (details, field) => {
  const map = new Map();
  for (const d of details) {
    if (!d.room_id) continue;
    const key = Number(d.room_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(`${d.hospital_linen_id}:${d[field] == null ? '' : Number(d[field])}`);
  }
  for (const [k, v] of map) map.set(k, v.sort().join('|'));
  return map;
};

/**
 * Ruangan yang sudah TTD Valet + Perawat Unit pada tahap `stage` terkunci: isinya tidak boleh berubah.
 * Mengembalikan nama ruangan terkunci yang isinya berubah (kosong = aman disimpan).
 */
export const findLockedChangedRooms = async (conn, transactionId, before, after, stage) => {
  const changed = [];
  const roomIds = new Set([...before.keys(), ...after.keys()]);
  for (const roomId of roomIds) {
    if ((before.get(roomId) || '') !== (after.get(roomId) || '')) changed.push(roomId);
  }
  if (!changed.length) return [];
  const [rows] = await conn.query(
    `SELECT r.room_name
       FROM tr_linen_transaction_room_sign s
       INNER JOIN mst_rooms_rs r ON r.id = s.room_id
      WHERE s.transaction_id = ? AND s.room_id IN (?)
        AND s.signature_nurse_${stage} IS NOT NULL AND s.signature_valet_${stage} IS NOT NULL`,
    [transactionId, changed]);
  return rows.map(r => r.room_name);
};
