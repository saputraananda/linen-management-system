import { ikmPool } from '../db/pool.js';
import { roomFingerprints, findLockedChangedRooms } from './roomSign.js';

// ───────────────────────── Formulir Linen Komersil berinduk ─────────────────────────
// Linen komersil = mst_hospital_linen.is_commercial = 1 (bukan berdasarkan kepemilikan).
// Valet mencatatnya di formulir serah terima induk (per ruangan, ikut TTD induk termasuk TTD unit).
// Baris komersil tidak mengubah stok ruangan dan tidak dihitung di Total Kg induk; otomatis disalin ke
// formulir komersil anak (KODE-KOM-ddmmyy-NNN, mengikuti nomor induk) untuk perhitungan khususnya:
//   washing_price_type PCS = jumlah pcs, KG = grammage(gram) × qty / 1000, M2 = luas P × L per pcs.
// Hanya tipe M2 yang dipecah satu baris per pcs (tiap item punya ukuran sendiri).

const addColumnIfMissing = async (table, column, ddl) => {
  const [[col]] = await ikmPool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, column]);
  if (!Number(col.n)) await ikmPool.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
};

const addIndexIfMissing = async (table, index, ddl) => {
  const [[idx]] = await ikmPool.query(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`, [table, index]);
  if (!Number(idx.n)) await ikmPool.query(`ALTER TABLE ${table} ADD ${ddl}`);
};

// Dibuat otomatis saat server start (idempotent), sama seperti skema TTD unit.
export const komersilSchemaReady = (async () => {
  try {
    // Tipe hitung cuci: tambah M2 (luas P × L)
    const [[wpt]] = await ikmPool.query(
      `SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mst_hospital_linen' AND COLUMN_NAME = 'washing_price_type'`);
    if (wpt && !String(wpt.COLUMN_TYPE).includes("'M2'")) {
      await ikmPool.query(
        `ALTER TABLE mst_hospital_linen MODIFY washing_price_type ENUM('PCS','KG','M2')
           ${wpt.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'} DEFAULT 'PCS'`);
    }

    // Baris induk menyimpan status komersil saat dicatat (stok ruangan tidak disentuh untuk baris ini)
    await addColumnIfMissing('tr_linen_transaction_detail', 'is_commercial',
      'is_commercial tinyint(1) NOT NULL DEFAULT 0');

    // Formulir komersil anak → formulir induk
    await addColumnIfMissing('tr_komersil_linen_transaction', 'parent_transaction_id',
      'parent_transaction_id bigint unsigned NULL AFTER form_number');
    await addIndexIfMissing('tr_komersil_linen_transaction', 'uk_komersil_parent',
      'UNIQUE KEY uk_komersil_parent (parent_transaction_id)');
    await addColumnIfMissing('tr_komersil_linen_transaction', 'is_express',
      'is_express tinyint(1) NOT NULL DEFAULT 0');
    await addColumnIfMissing('tr_komersil_linen_transaction', 'completed_at',
      'completed_at datetime NULL');

    await addColumnIfMissing('tr_komersil_linen_transaction_detail', 'room_id',
      'room_id bigint unsigned NULL AFTER hospital_linen_id');

    // Kode kurang kirim komersil memakai komersil_detail_id; skema lama bernama custom_detail_id
    const [[legacy]] = await ikmPool.query(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tr_komersil_kurang_kirim_delivery_detail'
          AND COLUMN_NAME = 'custom_detail_id'`);
    if (Number(legacy.n)) {
      await ikmPool.query(
        `ALTER TABLE tr_komersil_kurang_kirim_delivery_detail
           CHANGE custom_detail_id komersil_detail_id int NOT NULL COMMENT 'Relasi ke tr_komersil_linen_transaction_detail.id'`);
    }
  } catch (e) {
    console.error('ensureKomersilSchema:', e.message);
  }
})();

/** Set hospital_linen_id yang komersil (is_commercial = 1) dari daftar id */
export const commercialLinenIds = async (conn, hospitalLinenIds) => {
  const ids = [...new Set((hospitalLinenIds || []).filter(Boolean).map(Number))];
  if (!ids.length) return new Set();
  const [rows] = await conn.query(
    'SELECT id FROM mst_hospital_linen WHERE id IN (?) AND COALESCE(is_commercial, 0) = 1', [ids]);
  return new Set(rows.map(r => Number(r.id)));
};

/** Nomor formulir komersil dari nomor induk: KODE-201126-001 → KODE-KOM-201126-001 */
const childFormNumber = async (conn, parentFormNumber) => {
  // LMS: ddmmyy (6 digit); SuperApp: yyyymmdd (8 digit)
  const m = String(parentFormNumber).match(/^(.*)-(\d{6,8})-(\d+)$/);
  const base = m ? `${m[1]}-KOM-${m[2]}-${m[3]}` : `${parentFormNumber}-KOM`;
  // Formulir komersil lama (berdiri sendiri) bisa sudah memakai nomor yang sama
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [[hit]] = await conn.query(
      'SELECT COUNT(*) AS n FROM tr_komersil_linen_transaction WHERE form_number = ?', [candidate]);
    if (!Number(hit.n)) return candidate;
  }
};

const keyOf = (linenId, roomId) => `${Number(linenId)}|${roomId == null ? 'null' : Number(roomId)}`;

/** Baris komersil yang sudah dipakai surat jalan kurang kirim tidak boleh dihapus */
const usedByKurangKirim = async (conn, detailIds) => {
  if (!detailIds.length) return new Set();
  const [rows] = await conn.query(
    `SELECT DISTINCT komersil_detail_id AS id FROM tr_komersil_kurang_kirim_delivery_detail
      WHERE komersil_detail_id IN (?)`, [detailIds]);
  return new Set(rows.map(r => Number(r.id)));
};

/**
 * Samakan formulir komersil anak dengan baris komersil formulir induk.
 * syncBersih = true → qty bersih induk ikut ditulis ke anak (dipanggil saat pengiriman bersih induk disimpan).
 * Ukuran P × L dan catatan yang sudah diisi di formulir komersil dipertahankan.
 */
export const syncKomersilChild = async (conn, parentId, { syncBersih = false } = {}) => {
  const [[parent]] = await conn.query('SELECT * FROM tr_linen_transaction WHERE id = ?', [parentId]);
  if (!parent) return null;

  const [groups] = await conn.query(
    `SELECT d.hospital_linen_id, d.room_id,
            SUM(d.qty_kotor) AS kotor,
            SUM(d.qty_bersih) AS bersih, COUNT(d.qty_bersih) AS bersih_n,
            COALESCE(hl.washing_price_type, 'PCS') AS price_type,
            COALESCE(NULLIF(hl.hospital_linen_name, ''), l.linen_name) AS item_name
       FROM tr_linen_transaction_detail d
       INNER JOIN mst_hospital_linen hl ON hl.id = d.hospital_linen_id
       INNER JOIN mst_linen l ON l.id = hl.linen_id
      WHERE d.transaction_id = ? AND d.is_commercial = 1
      GROUP BY d.hospital_linen_id, d.room_id, hl.washing_price_type, hl.hospital_linen_name, l.linen_name
     HAVING kotor > 0`, [parentId]);

  let [[child]] = await conn.query(
    'SELECT * FROM tr_komersil_linen_transaction WHERE parent_transaction_id = ?', [parentId]);

  if (!groups.length) {
    if (!child) return null;
    // Tidak ada lagi linen komersil di induk: hapus anak, kecuali sudah ada surat jalan kurang kirim
    const [[sj]] = await conn.query(
      'SELECT COUNT(*) AS n FROM tr_komersil_kurang_kirim_delivery WHERE transaction_id = ?', [child.id]);
    if (Number(sj.n)) {
      await conn.query('UPDATE tr_komersil_linen_transaction_detail SET qty_kotor = 0 WHERE transaction_id = ?', [child.id]);
      return child.id;
    }
    await conn.query('DELETE FROM tr_komersil_linen_transaction_detail WHERE transaction_id = ?', [child.id]);
    await conn.query('DELETE FROM tr_komersil_linen_transaction WHERE id = ?', [child.id]);
    return null;
  }

  const headerValues = [
    parent.hospital_id, parent.user_pickup, parent.user_delivery,
    parent.hospital_staff_pickup, parent.hospital_assistant_pickup,
    parent.hospital_staff_delivery, parent.hospital_assistant_delivery,
    parent.pickup_date, parent.delivery_date, parent.status, parent.completed_at,
    parent.notes_pickup, parent.notes_delivery
  ];
  if (!child) {
    const formNumber = await childFormNumber(conn, parent.form_number);
    const [r] = await conn.query(
      `INSERT INTO tr_komersil_linen_transaction
         (form_number, parent_transaction_id, hospital_id, user_pickup, user_delivery,
          hospital_staff_pickup, hospital_assistant_pickup, hospital_staff_delivery, hospital_assistant_delivery,
          pickup_date, delivery_date, status, completed_at, notes_pickup, notes_delivery, is_express)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [formNumber, parentId, ...headerValues, Number(parent.is_express) === 1 ? 1 : 0]);
    [[child]] = await conn.query('SELECT * FROM tr_komersil_linen_transaction WHERE id = ?', [r.insertId]);
  } else {
    // Kepala formulir mengikuti induk; is_express milik anak sendiri (opsional)
    await conn.query(
      `UPDATE tr_komersil_linen_transaction
          SET hospital_id = ?, user_pickup = ?, user_delivery = ?,
              hospital_staff_pickup = ?, hospital_assistant_pickup = ?,
              hospital_staff_delivery = ?, hospital_assistant_delivery = ?,
              pickup_date = ?, delivery_date = ?, status = ?, completed_at = ?,
              notes_pickup = ?, notes_delivery = ?
        WHERE id = ?`, [...headerValues, child.id]);
  }

  const [existing] = await conn.query(
    'SELECT * FROM tr_komersil_linen_transaction_detail WHERE transaction_id = ? ORDER BY id', [child.id]);
  const byKey = new Map();
  for (const row of existing) {
    const k = keyOf(row.hospital_linen_id, row.room_id);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(row);
  }
  const protectedIds = await usedByKurangKirim(conn, existing.map(r => r.id));
  const removeRows = async (rows) => {
    for (const row of rows) {
      if (protectedIds.has(Number(row.id))) {
        await conn.query('UPDATE tr_komersil_linen_transaction_detail SET qty_kotor = 0 WHERE id = ?', [row.id]);
      } else {
        await conn.query('DELETE FROM tr_komersil_linen_transaction_detail WHERE id = ?', [row.id]);
      }
    }
  };

  const seen = new Set();
  for (const g of groups) {
    const k = keyOf(g.hospital_linen_id, g.room_id);
    seen.add(k);
    const rows = byKey.get(k) || [];
    const kotor = Number(g.kotor) || 0;
    const parentBersih = Number(g.bersih_n) > 0 ? Number(g.bersih) || 0 : null;
    const writeBersih = syncBersih && parentBersih !== null;

    if (g.price_type === 'M2') {
      // Satu baris per pcs; bersih induk dibagi: n baris pertama = 1, sisanya 0
      for (let i = 0; i < kotor; i++) {
        const bersih = writeBersih ? (i < parentBersih ? 1 : 0) : undefined;
        const row = rows[i];
        if (row) {
          await conn.query(
            `UPDATE tr_komersil_linen_transaction_detail
                SET item_name = ?, qty_kotor = 1${bersih !== undefined ? ', qty_bersih = ?' : ''}
              WHERE id = ?`,
            bersih !== undefined ? [g.item_name, bersih, row.id] : [g.item_name, row.id]);
        } else {
          await conn.query(
            `INSERT INTO tr_komersil_linen_transaction_detail
               (transaction_id, hospital_linen_id, room_id, item_name, qty_kotor, qty_bersih)
             VALUES (?, ?, ?, ?, 1, ?)`,
            [child.id, g.hospital_linen_id, g.room_id, g.item_name, bersih === undefined ? null : bersih]);
        }
      }
      await removeRows(rows.slice(kotor));
    } else {
      // PCS / KG: satu baris dengan qty penuh
      const [row, ...extra] = rows;
      if (row) {
        await conn.query(
          `UPDATE tr_komersil_linen_transaction_detail
              SET item_name = ?, qty_kotor = ?${writeBersih ? ', qty_bersih = ?' : ''},
                  length_cm = NULL, width_cm = NULL, area_m2 = NULL
            WHERE id = ?`,
          writeBersih ? [g.item_name, kotor, parentBersih, row.id] : [g.item_name, kotor, row.id]);
      } else {
        await conn.query(
          `INSERT INTO tr_komersil_linen_transaction_detail
             (transaction_id, hospital_linen_id, room_id, item_name, qty_kotor, qty_bersih)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [child.id, g.hospital_linen_id, g.room_id, g.item_name, kotor, writeBersih ? parentBersih : null]);
      }
      await removeRows(extra);
    }
  }
  for (const [k, rows] of byKey) {
    if (!seen.has(k)) await removeRows(rows);
  }
  return child.id;
};

/**
 * Qty bersih diisi di formulir komersil → tulis balik ke baris induk (per linen per ruangan).
 * Ditolak bila ruangan tersebut sudah TTD unit pengiriman (terkunci).
 */
export const pushKomersilBersihToParent = async (conn, childId) => {
  const [[child]] = await conn.query('SELECT * FROM tr_komersil_linen_transaction WHERE id = ?', [childId]);
  if (!child?.parent_transaction_id) return { lockedRooms: [] };
  const parentId = child.parent_transaction_id;

  const [sums] = await conn.query(
    `SELECT hospital_linen_id, room_id, SUM(qty_bersih) AS bersih, COUNT(qty_bersih) AS bersih_n
       FROM tr_komersil_linen_transaction_detail WHERE transaction_id = ?
      GROUP BY hospital_linen_id, room_id`, [childId]);
  const [before] = await conn.query(
    'SELECT * FROM tr_linen_transaction_detail WHERE transaction_id = ? ORDER BY id', [parentId]);

  for (const s of sums) {
    const rows = before.filter(d => Number(d.is_commercial) === 1
      && keyOf(d.hospital_linen_id, d.room_id) === keyOf(s.hospital_linen_id, s.room_id));
    if (!rows.length) continue;
    let remaining = Number(s.bersih_n) > 0 ? Number(s.bersih) || 0 : null;
    for (let i = 0; i < rows.length; i++) {
      let value = null;
      if (remaining !== null) {
        value = i === rows.length - 1 ? remaining : Math.min(remaining, Number(rows[i].qty_kotor) || 0);
        remaining -= value;
      }
      await conn.query('UPDATE tr_linen_transaction_detail SET qty_bersih = ? WHERE id = ?', [value, rows[i].id]);
    }
  }

  const [after] = await conn.query(
    'SELECT hospital_linen_id, room_id, qty_kotor, qty_bersih FROM tr_linen_transaction_detail WHERE transaction_id = ?',
    [parentId]);
  const lockedRooms = await findLockedChangedRooms(
    conn, parentId, roomFingerprints(before, 'qty_bersih'), roomFingerprints(after, 'qty_bersih'), 'delivery');
  return { lockedRooms };
};

/** Hasil hitung satu baris komersil sesuai washing_price_type */
export const komersilMeasure = (row) => {
  const type = row.washing_price_type || row.price_type || 'PCS';
  const qty = Number(row.qty_bersih ?? row.qty_kotor) || 0;
  if (type === 'KG') return { type, value: Math.round(((Number(row.grammage) || 0) * qty / 1000) * 100) / 100, unit: 'Kg' };
  if (type === 'M2') return { type, value: Number(row.area_m2) || 0, unit: 'm²' };
  return { type: 'PCS', value: qty, unit: 'Pcs' };
};

const PARENT_SIG_FIELDS = [
  'signature_valet_pickup', 'signature_hospital_pickup', 'signature_assistant_pickup',
  'signature_valet_delivery', 'signature_hospital_delivery', 'signature_assistant_delivery'
];

/**
 * Formulir komersil berinduk: TTD, status dan tanggal selesai diambil dari formulir induk.
 * Dipanggil sebelum URL tanda tangan diformat. Mengubah baris di tempat.
 */
export const overlayParentInfo = async (conn, rows) => {
  const list = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
  const ids = [...new Set(list.map(r => r.parent_transaction_id).filter(Boolean).map(Number))];
  if (!ids.length) return rows;
  const [parents] = await conn.query('SELECT * FROM tr_linen_transaction WHERE id IN (?)', [ids]);
  const byId = new Map(parents.map(p => [Number(p.id), p]));
  for (const row of list) {
    const parent = byId.get(Number(row.parent_transaction_id));
    if (!parent) continue;
    for (const f of PARENT_SIG_FIELDS) row[f] = parent[f];
    row.status = parent.status;
    row.completed_at = parent.completed_at;
    row.parent_form_number = parent.form_number;
  }
  return rows;
};
