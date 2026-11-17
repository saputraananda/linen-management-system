import { ikmPool, mainPool } from '../../db/pool.js';
import { getSignatureUrl } from '../../middleware/upload.js';
import { parsePaging, buildPagination, offsetOf } from '../../utils/paging.js';
import { getRoomSignState } from '../../utils/roomSign.js';

// Riwayat Serah Terima Linen untuk Tim Unit (hanya baca).
// Perawat unit (punya userUnitId) hanya melihat baris ruangan yang di-assign ke dirinya.
// Akun unit bersama (tanpa userUnitId) melihat seluruh transaksi rumah sakitnya.

const toTitleCase = (str) => {
  if (!str) return '';
  return str.trim().toLowerCase().split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

/** null = tanpa pembatasan ruangan; array = hanya ruangan itu (array kosong = tidak melihat apa pun) */
const roomScope = (req) => (req.user.userUnitId ? (req.user.roomIds || []) : null);

/** Data berat/tagihan level rumah sakit tidak relevan untuk tampilan per ruangan, dan kg admin tidak pernah dibuka ke klien LMS */
const cleanTransaction = (row, scoped) => {
  if (!row || typeof row !== 'object') return row;
  const { total_kg_admin, ...rest } = row;
  if (scoped) {
    rest.total_kg_valet = null;
    rest.kg_total = null;
    rest.kg_agreement = null;
    rest.billing_by_kg = null;
  }
  return rest;
};

const withSignatures = (tx) => ({
  ...tx,
  signature_valet_pickup: getSignatureUrl(tx.signature_valet_pickup),
  signature_hospital_pickup: getSignatureUrl(tx.signature_hospital_pickup),
  signature_assistant_pickup: getSignatureUrl(tx.signature_assistant_pickup),
  signature_valet_delivery: getSignatureUrl(tx.signature_valet_delivery),
  signature_hospital_delivery: getSignatureUrl(tx.signature_hospital_delivery),
  signature_assistant_delivery: getSignatureUrl(tx.signature_assistant_delivery)
});

const loadEmployeeMap = async () => {
  const [employees] = await mainPool.query(`SELECT employee_id, full_name AS employee_name FROM mst_employee`);
  return new Map(employees.map(emp => [emp.employee_id, emp.employee_name]));
};

const emptyPage = (req) => {
  const pagination = buildPagination(parsePaging(req.query), 0);
  return { success: true, data: [], pagination };
};

export const getUnitTransactions = async (req, res) => {
  try {
    const hospitalId = req.user.id;
    const { startDate, endDate, status, search } = req.query;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'ID Rumah Sakit tidak valid' });
    }

    const rooms = roomScope(req);
    if (rooms && rooms.length === 0) return res.status(200).json(emptyPage(req));

    let matchedEmployeeIds = [];
    if (search) {
      const [emps] = await mainPool.query(`SELECT employee_id FROM mst_employee WHERE full_name LIKE ?`, [`%${search}%`]);
      matchedEmployeeIds = emps.map(e => e.employee_id);
    }

    // Hitungan item mengikuti ruangan yang boleh dilihat
    const roomCond = rooms ? ' AND d.room_id IN (?)' : '';
    const selectSql = `
      SELECT t.*, h.hospital_name, h.billing_by_kg, h.allow_express, h.kg_agreement,
        CASE WHEN t.total_kg_valet IS NULL THEN NULL ELSE t.total_kg_valet + COALESCE(h.kg_agreement, 0) END AS kg_total,
        (SELECT COUNT(*) FROM tr_linen_transaction_detail d WHERE d.transaction_id = t.id${roomCond}) AS total_items,
        (SELECT COALESCE(SUM(qty_kotor), 0) FROM tr_linen_transaction_detail d WHERE d.transaction_id = t.id${roomCond}) AS total_qty_kotor,
        (SELECT COALESCE(SUM(qty_bersih), 0) FROM tr_linen_transaction_detail d WHERE d.transaction_id = t.id${roomCond}) AS total_qty_bersih`;
    const selectParams = rooms ? [rooms, rooms, rooms] : [];

    let from = `
      FROM tr_linen_transaction t
      INNER JOIN mst_hospital h ON t.hospital_id = h.id
      WHERE t.hospital_id = ?
    `;
    const params = [hospitalId];

    if (rooms) {
      from += ` AND EXISTS (SELECT 1 FROM tr_linen_transaction_detail rd WHERE rd.transaction_id = t.id AND rd.room_id IN (?))`;
      params.push(rooms);
    }
    if (startDate) { from += ` AND DATE(t.pickup_date) >= ?`; params.push(startDate); }
    if (endDate) { from += ` AND DATE(t.pickup_date) <= ?`; params.push(endDate); }
    if (status) { from += ` AND t.status = ?`; params.push(status); }

    if (search) {
      const w = `%${search}%`;
      if (matchedEmployeeIds.length > 0) {
        from += ` AND (t.form_number LIKE ? OR t.notes LIKE ? OR t.hospital_staff_pickup LIKE ? OR t.hospital_staff_delivery LIKE ? OR t.hospital_assistant_pickup LIKE ? OR t.hospital_assistant_delivery LIKE ? OR t.user_pickup IN (?) OR t.user_delivery IN (?))`;
        params.push(w, w, w, w, w, w, matchedEmployeeIds, matchedEmployeeIds);
      } else {
        from += ` AND (t.form_number LIKE ? OR t.notes LIKE ? OR t.hospital_staff_pickup LIKE ? OR t.hospital_staff_delivery LIKE ? OR t.hospital_assistant_pickup LIKE ? OR t.hospital_assistant_delivery LIKE ?)`;
        params.push(w, w, w, w, w, w);
      }
    }

    const [[{ total }]] = await ikmPool.query(`SELECT COUNT(*) AS total ${from}`, params);
    const pagination = buildPagination(parsePaging(req.query), total);
    const [transactions] = await ikmPool.query(
      `${selectSql} ${from} ORDER BY t.pickup_date DESC, t.id DESC LIMIT ? OFFSET ?`,
      [...selectParams, ...params, pagination.limit, offsetOf(pagination)]
    );

    const empMap = await loadEmployeeMap();
    const data = transactions.map(tx => ({
      ...withSignatures(cleanTransaction(tx, !!rooms)),
      user_pickup_name: toTitleCase(empMap.get(tx.user_pickup) || ''),
      user_delivery_name: tx.user_delivery ? toTitleCase(empMap.get(tx.user_delivery) || '') : null
    }));

    return res.status(200).json({ success: true, data, pagination });
  } catch (error) {
    console.error('Error getting unit transactions:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat transaksi', error: error.message });
  }
};

export const getUnitTransactionDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const hospitalId = req.user.id;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'ID Rumah Sakit tidak valid' });
    }

    const rooms = roomScope(req);
    const notFound = () => res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    if (rooms && rooms.length === 0) return notFound();

    const [transactions] = await ikmPool.query(
      `SELECT t.*, h.hospital_name, h.billing_by_kg, h.allow_express, h.kg_agreement,
              CASE WHEN t.total_kg_valet IS NULL THEN NULL ELSE t.total_kg_valet + COALESCE(h.kg_agreement, 0) END AS kg_total
       FROM tr_linen_transaction t
       INNER JOIN mst_hospital h ON t.hospital_id = h.id
       WHERE t.id = ? AND t.hospital_id = ?`,
      [id, hospitalId]
    );
    if (transactions.length === 0) return notFound();

    const [details] = await ikmPool.query(
      `SELECT td.*,
              l.linen_name, l.linen_code,
              hl.unit, hl.hospital_linen_name,
              s.size_name, c.color_name, m.material_name,
              r.room_name
       FROM tr_linen_transaction_detail td
       INNER JOIN mst_hospital_linen hl ON td.hospital_linen_id = hl.id
       INNER JOIN mst_linen l ON hl.linen_id = l.id
       LEFT JOIN mst_size s ON l.size_id = s.id
       LEFT JOIN mst_color c ON l.color_id = c.id
       LEFT JOIN mst_material m ON l.material_id = m.id
       LEFT JOIN mst_rooms_rs r ON td.room_id = r.id
       WHERE td.transaction_id = ?${rooms ? ' AND td.room_id IN (?)' : ''}
       ORDER BY l.linen_name ASC`,
      rooms ? [id, rooms] : [id]
    );

    // Transaksi tanpa satu pun baris untuk ruangan ini dianggap bukan milik unit
    if (rooms && details.length === 0) return notFound();

    const empMap = await loadEmployeeMap();
    const transaction = withSignatures(cleanTransaction(transactions[0], !!rooms));
    transaction.user_pickup_name = toTitleCase(empMap.get(transaction.user_pickup) || '');
    transaction.user_delivery_name = transaction.user_delivery ? toTitleCase(empMap.get(transaction.user_delivery) || '') : null;

    // Surat Jalan Kurang Kirim: untuk perawat hanya yang memuat linen ruangannya
    const [deliveries] = await ikmPool.query(
      `SELECT d.*,
         (SELECT SUM(dd.qty_delivered) FROM tr_kurang_kirim_delivery_detail dd
           WHERE dd.delivery_id = d.id${rooms ? ' AND dd.room_id IN (?)' : ''}) AS total_qty_delivered
       FROM tr_kurang_kirim_delivery d
       WHERE d.transaction_id = ?${rooms ? ' AND EXISTS (SELECT 1 FROM tr_kurang_kirim_delivery_detail x WHERE x.delivery_id = d.id AND x.room_id IN (?))' : ''}
       ORDER BY d.delivery_date DESC, d.id DESC`,
      rooms ? [rooms, id, rooms] : [id]
    );

    const formattedDeliveries = deliveries.map(d => ({
      ...d,
      valet_name: toTitleCase(empMap.get(d.valet_id) || ''),
      signature_valet: getSignatureUrl(d.signature_valet),
      signature_hospital: getSignatureUrl(d.signature_hospital)
    }));

    // Audit log sengaja dikosongkan: snapshot-nya memuat seluruh baris transaksi (semua ruangan).
    return res.status(200).json({
      success: true,
      // TTD unit: perawat hanya melihat ruangannya sendiri
      data: {
        transaction, details, audits: [], deliveries: formattedDeliveries,
        roomSign: await getRoomSignState(ikmPool, id, { roomIds: rooms })
      }
    });
  } catch (error) {
    console.error('Error getting unit transaction detail:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat rincian transaksi', error: error.message });
  }
};

export const getUnitShortageDeliveryDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const hospitalId = req.user.id;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'ID Rumah Sakit tidak valid' });
    }

    const rooms = roomScope(req);
    const notFound = () => res.status(404).json({ success: false, message: 'Surat Jalan tidak ditemukan' });
    if (rooms && rooms.length === 0) return notFound();

    const [headers] = await ikmPool.query(
      `SELECT d.*, t.form_number AS original_form_number, t.pickup_date AS original_pickup_date,
              t.total_kg_valet, t.is_express, h.kg_agreement,
              CASE WHEN t.total_kg_valet IS NULL THEN NULL ELSE t.total_kg_valet + COALESCE(h.kg_agreement, 0) END AS kg_total,
              h.hospital_name, h.address AS hospital_address
       FROM tr_kurang_kirim_delivery d
       INNER JOIN tr_linen_transaction t ON d.transaction_id = t.id
       INNER JOIN mst_hospital h ON t.hospital_id = h.id
       WHERE d.id = ? AND t.hospital_id = ?`,
      [id, hospitalId]
    );
    if (headers.length === 0) return notFound();

    const [details] = await ikmPool.query(
      `SELECT dd.*,
              l.linen_name, l.linen_code,
              hl.unit, hl.hospital_linen_name, hl.grammage,
              s.size_name, c.color_name, m.material_name,
              r.room_name
       FROM tr_kurang_kirim_delivery_detail dd
       INNER JOIN mst_hospital_linen hl ON dd.hospital_linen_id = hl.id
       INNER JOIN mst_linen l ON hl.linen_id = l.id
       LEFT JOIN mst_size s ON l.size_id = s.id
       LEFT JOIN mst_color c ON l.color_id = c.id
       LEFT JOIN mst_material m ON l.material_id = m.id
       LEFT JOIN mst_rooms_rs r ON dd.room_id = r.id
       WHERE dd.delivery_id = ?${rooms ? ' AND dd.room_id IN (?)' : ''}
       ORDER BY l.linen_name ASC`,
      rooms ? [id, rooms] : [id]
    );
    if (rooms && details.length === 0) return notFound();

    const header = headers[0];
    if (rooms) {
      header.total_kg_valet = null;
      header.kg_total = null;
      header.kg_agreement = null;
    }
    const empMap = await loadEmployeeMap();
    header.valet_name = toTitleCase(empMap.get(header.valet_id) || '');
    header.signature_valet = getSignatureUrl(header.signature_valet);
    header.signature_hospital = getSignatureUrl(header.signature_hospital);

    return res.status(200).json({ success: true, data: { delivery: header, details } });
  } catch (error) {
    console.error('Error getting unit shortage delivery detail:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat rincian Surat Jalan', error: error.message });
  }
};
