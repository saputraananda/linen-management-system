import { ikmPool, mainPool } from '../../db/pool.js';
import { getSignatureUrl, saveBase64Image, cleanupSignatures } from '../../middleware/upload.js';
import { parsePaging, buildPagination, offsetOf } from '../../utils/paging.js';
import { snapshotRoomStock, logRoomStockChanges, actorName } from '../../utils/roomStockLog.js';
import {
  hospitalRequiresUnitSign, getRoomSignState, roomFingerprints, findLockedChangedRooms
} from '../../utils/roomSign.js';
import { commercialLinenIds, syncKomersilChild } from '../../utils/komersilChild.js';

// Helper to format string to Capital Each Word (Title Case)
const toTitleCase = (str) => {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatMySQLDateTime = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch (e) {
    return null;
  }
};

/** empty string → null; otherwise Number (or null if invalid) */
const parseTotalKg = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
};

/** boolean / 0 / 1 → 0 or 1 */
const parseIsExpress = (val) => {
  if (val === true || val === 1 || val === '1') return 1;
  return 0;
};

/**
 * Linen kotor yang diambil IKM keluar dari ruangan: kurangi Dirty Utility dulu,
 * jika jumlah yang diambil lebih besar (Dirty Utility lupa dihitung) sisanya dikurangi dari Terpakai.
 * Urutan SET penting: MySQL mengevaluasi dari kiri ke kanan, jadi Terpakai dihitung memakai qty_dirty lama.
 */
const takeKotorFromRoom = (connection, hospitalLinenId, roomId, qty) =>
  connection.query(
    `UPDATE mst_hospital_linen_rooms
     SET qty_terpakai = GREATEST(qty_terpakai - GREATEST(? - qty_dirty, 0), 0),
         qty_dirty = GREATEST(qty_dirty - ?, 0)
     WHERE hospital_linen_id = ? AND room_id = ?`,
    [qty, qty, hospitalLinenId, roomId]
  );

// ───────────── Satu formulir induk per hari (per RS, per jenis reguler/express) ─────────────
const isPickupFinal = (tx) => !!(tx.signature_valet_pickup && tx.signature_hospital_pickup);

/**
 * Formulir pengambilan pada tanggal pickup tertentu untuk satu RS, beserta petugas IKM per ruangan.
 * can_continue = masih PROSES dan pengambilan kotor belum di-TTD akhir Tim Linen RS (ruangan masih bisa ditambah).
 */
const listDayForms = async (conn, hospitalId, date) => {
  const [rows] = await conn.query(
    `SELECT t.id, t.form_number, t.status, t.is_express, t.pickup_date, t.user_pickup,
            t.signature_valet_pickup, t.signature_hospital_pickup,
            (SELECT COUNT(DISTINCT d.room_id) FROM tr_linen_transaction_detail d
              WHERE d.transaction_id = t.id AND d.qty_kotor > 0) AS rooms,
            (SELECT COALESCE(SUM(d.qty_kotor), 0) FROM tr_linen_transaction_detail d
              WHERE d.transaction_id = t.id) AS total_kotor
       FROM tr_linen_transaction t
      WHERE t.hospital_id = ? AND DATE(t.pickup_date) = DATE(?)
      ORDER BY t.id`, [hospitalId, date]);
  if (!rows.length) return [];

  const [signs] = await conn.query(
    `SELECT transaction_id, valet_pickup_id FROM tr_linen_transaction_room_sign
      WHERE transaction_id IN (?) AND valet_pickup_id IS NOT NULL`, [rows.map(r => r.id)]);
  const empIds = [...new Set([...rows.map(r => r.user_pickup), ...signs.map(s => s.valet_pickup_id)].filter(Boolean).map(Number))];
  let names = new Map();
  if (empIds.length) {
    const [emps] = await mainPool.query('SELECT employee_id, full_name FROM mst_employee WHERE employee_id IN (?)', [empIds]);
    names = new Map(emps.map(e => [Number(e.employee_id), toTitleCase(e.full_name)]));
  }
  return rows.map(r => {
    const valetIds = [r.user_pickup, ...signs.filter(s => s.transaction_id === r.id).map(s => s.valet_pickup_id)]
      .filter(Boolean).map(Number);
    return {
      id: r.id,
      form_number: r.form_number,
      status: r.status,
      is_express: Number(r.is_express) === 1 ? 1 : 0,
      pickup_date: r.pickup_date,
      rooms: Number(r.rooms) || 0,
      total_kotor: Number(r.total_kotor) || 0,
      pickup_final: isPickupFinal(r),
      can_continue: r.status === 'PROSES' && !isPickupFinal(r),
      valets: [...new Set(valetIds.map(v => names.get(v)).filter(Boolean))]
    };
  });
};

/**
 * Ruang lingkup simpan per ruangan. scopeRoomIds (array) = ruangan yang diubah perangkat ini;
 * 'all'/null = baris tanpa ruangan. Tanpa scopeRoomIds = perilaku lama (seluruh isi formulir diganti).
 */
const buildScope = (scopeRoomIds) => {
  if (!Array.isArray(scopeRoomIds)) return null;
  const keys = new Set(scopeRoomIds.map(k => (k === null || k === undefined || k === '' || k === 'all') ? 'all' : String(Number(k))));
  return {
    keys,
    has: (roomId) => keys.has(roomId === null || roomId === undefined ? 'all' : String(Number(roomId))),
    roomIds: [...keys].filter(k => k !== 'all').map(Number),
    includeNoRoom: keys.has('all')
  };
};

/** Never expose admin kg weighing to LMS clients */
const stripAdminKg = (row) => {
  if (!row || typeof row !== 'object') return row;
  const { total_kg_admin, ...rest } = row;
  return rest;
};

const stripAdminKgFromJson = (value) => {
  if (value == null) return value;
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (parsed && typeof parsed === 'object') {
    if (parsed.transaction) {
      parsed = { ...parsed, transaction: stripAdminKg(parsed.transaction) };
    } else {
      parsed = stripAdminKg(parsed);
    }
  }
  return typeof value === 'string' ? JSON.stringify(parsed) : parsed;
};

const sanitizeAuditRow = (audit) => {
  if (!audit) return audit;
  return {
    ...audit,
    old_values: stripAdminKgFromJson(audit.old_values),
    new_values: stripAdminKgFromJson(audit.new_values)
  };
};

/**
 * Get list of transactions for a hospital with filters
 */
export const getTransactions = async (req, res) => {
  try {
    const { hospitalId, startDate, endDate, status, search } = req.query;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "ID Rumah Sakit wajib disertakan"
      });
    }

    // Lookup employee IDs if search is provided
    let matchedEmployeeIds = [];
    if (search) {
      const [emps] = await mainPool.query(
        `SELECT employee_id FROM mst_employee WHERE full_name LIKE ?`,
        [`%${search}%`]
      );
      matchedEmployeeIds = emps.map(e => e.employee_id);
    }

    const selectSql = `
      SELECT t.*, h.hospital_name, h.billing_by_kg, h.allow_express, h.kg_agreement,
        CASE WHEN t.total_kg_valet IS NULL THEN NULL ELSE t.total_kg_valet + COALESCE(h.kg_agreement, 0) END AS kg_total,
        (SELECT COUNT(*) FROM tr_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_items,
        (SELECT COALESCE(SUM(qty_kotor), 0) FROM tr_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_qty_kotor,
        (SELECT COALESCE(SUM(qty_bersih), 0) FROM tr_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_qty_bersih,
        (SELECT k.id FROM tr_komersil_linen_transaction k WHERE k.parent_transaction_id = t.id) as komersil_id,
        (SELECT k.form_number FROM tr_komersil_linen_transaction k WHERE k.parent_transaction_id = t.id) as komersil_form_number`;
    // Bagian FROM ... WHERE dipakai bersama oleh COUNT(*) dan query data
    let query = `
      FROM tr_linen_transaction t
      INNER JOIN mst_hospital h ON t.hospital_id = h.id
      WHERE t.hospital_id = ?
    `;
    const params = [hospitalId];

    if (startDate) {
      query += ` AND DATE(t.pickup_date) >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND DATE(t.pickup_date) <= ?`;
      params.push(endDate);
    }

    if (status) {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    if (search) {
      const searchWildcard = `%${search}%`;
      if (matchedEmployeeIds.length > 0) {
        query += ` AND (t.form_number LIKE ? OR t.notes LIKE ? OR t.hospital_staff_pickup LIKE ? OR t.hospital_staff_delivery LIKE ? OR t.hospital_assistant_pickup LIKE ? OR t.hospital_assistant_delivery LIKE ? OR t.user_pickup IN (?) OR t.user_delivery IN (?))`;
        params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard, matchedEmployeeIds, matchedEmployeeIds);
      } else {
        query += ` AND (t.form_number LIKE ? OR t.notes LIKE ? OR t.hospital_staff_pickup LIKE ? OR t.hospital_staff_delivery LIKE ? OR t.hospital_assistant_pickup LIKE ? OR t.hospital_assistant_delivery LIKE ?)`;
        params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard);
      }
    }

    const [[{ total }]] = await ikmPool.query(`SELECT COUNT(*) AS total ${query}`, params);
    const pagination = buildPagination(parsePaging(req.query), total);
    const [transactions] = await ikmPool.query(
      `${selectSql} ${query} ORDER BY t.pickup_date DESC, t.id DESC LIMIT ? OFFSET ?`,
      [...params, pagination.limit, offsetOf(pagination)]
    );

    // Fetch employee name lookup
    const [employees] = await mainPool.query(
      `SELECT employee_id, full_name as employee_name FROM mst_employee`
    );
    const empMap = new Map(employees.map(emp => [emp.employee_id, emp.employee_name]));

    const formattedTransactions = transactions.map(tx => ({
      ...stripAdminKg(tx),
      user_pickup_name: toTitleCase(empMap.get(tx.user_pickup) || ''),
      user_delivery_name: tx.user_delivery ? toTitleCase(empMap.get(tx.user_delivery) || '') : null,
      signature_valet_pickup: getSignatureUrl(tx.signature_valet_pickup),
      signature_hospital_pickup: getSignatureUrl(tx.signature_hospital_pickup),
      signature_assistant_pickup: getSignatureUrl(tx.signature_assistant_pickup),
      signature_valet_delivery: getSignatureUrl(tx.signature_valet_delivery),
      signature_hospital_delivery: getSignatureUrl(tx.signature_hospital_delivery),
      signature_assistant_delivery: getSignatureUrl(tx.signature_assistant_delivery)
    }));

    return res.status(200).json({
      success: true,
      data: formattedTransactions,
      pagination
    });
  } catch (error) {
    console.error("Error getting transactions:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat riwayat transaksi",
      error: error.message
    });
  }
};

/**
 * Get detailed transaction items
 */
export const getTransactionDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [transactions] = await ikmPool.query(
      `SELECT t.*, h.hospital_name, h.billing_by_kg, h.allow_express, h.kg_agreement,
              CASE WHEN t.total_kg_valet IS NULL THEN NULL ELSE t.total_kg_valet + COALESCE(h.kg_agreement, 0) END AS kg_total
       FROM tr_linen_transaction t
       INNER JOIN mst_hospital h ON t.hospital_id = h.id
       WHERE t.id = ?`,
      [id]
    );

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaksi tidak ditemukan"
      });
    }

    const [details] = await ikmPool.query(
      `SELECT td.*,
              hl.stock_in_rs,
              l.linen_name, l.linen_code,
              hl.unit, hl.hospital_linen_name, hl.ownership_type, hl.washing_price_type,
              s.size_name, c.color_name, m.material_name,
              r.room_name
       FROM tr_linen_transaction_detail td
       INNER JOIN mst_hospital_linen hl ON td.hospital_linen_id = hl.id
       INNER JOIN mst_linen l ON hl.linen_id = l.id
       LEFT JOIN mst_size s ON l.size_id = s.id
       LEFT JOIN mst_color c ON l.color_id = c.id
       LEFT JOIN mst_material m ON l.material_id = m.id
       LEFT JOIN mst_rooms_rs r ON td.room_id = r.id
       WHERE td.transaction_id = ?
       ORDER BY l.linen_name ASC`,
      [id]
    );

    const transaction = stripAdminKg(transactions[0]);
    if (transaction) {
      // Fetch names
      const [employees] = await mainPool.query(
        `SELECT employee_id, full_name as employee_name 
         FROM mst_employee 
         WHERE employee_id IN (?, ?)`,
        [transaction.user_pickup, transaction.user_delivery || 0]
      );
      const empMap = new Map(employees.map(emp => [emp.employee_id, emp.employee_name]));

      transaction.user_pickup_name = toTitleCase(empMap.get(transaction.user_pickup) || '');
      transaction.user_delivery_name = transaction.user_delivery ? toTitleCase(empMap.get(transaction.user_delivery) || '') : null;
      transaction.signature_valet_pickup = getSignatureUrl(transaction.signature_valet_pickup);
      transaction.signature_hospital_pickup = getSignatureUrl(transaction.signature_hospital_pickup);
      transaction.signature_assistant_pickup = getSignatureUrl(transaction.signature_assistant_pickup);
      transaction.signature_valet_delivery = getSignatureUrl(transaction.signature_valet_delivery);
      transaction.signature_hospital_delivery = getSignatureUrl(transaction.signature_hospital_delivery);
      transaction.signature_assistant_delivery = getSignatureUrl(transaction.signature_assistant_delivery);

      // Calculate is_editable
      let isEditable = false;
      if (transaction.status === 'PROSES') {
        isEditable = true;
      } else if (transaction.status === 'SELESAI') {
        const completedTimeSource = transaction.completed_at || transaction.updated_at;
        if (completedTimeSource) {
          const completedTime = new Date(completedTimeSource).getTime();
          const currentTime = new Date().getTime();
          const diffHours = (currentTime - completedTime) / (1000 * 60 * 60);
          if (diffHours <= 24) {
            isEditable = true;
          }
        }
      }
      transaction.is_editable = isEditable;
    }

    const [audits] = await ikmPool.query(
      `SELECT * FROM tr_linen_transaction_audit 
       WHERE transaction_id = ? 
       ORDER BY created_at ASC`,
      [id]
    );

    // Fetch names of users in audits from mainPool.mst_employee (excluding RUMAH_SAKIT action logs)
    const auditUserIds = audits
      .filter(a => a.action !== 'RUMAH_SAKIT')
      .map(a => a.user_id)
      .filter(uid => uid !== null && uid !== undefined);

    if (auditUserIds.length > 0) {
      const [employees] = await mainPool.query(
        `SELECT employee_id, full_name as employee_name 
         FROM mst_employee 
         WHERE employee_id IN (?)`,
        [auditUserIds]
      );
      const empMap = new Map(employees.map(emp => [emp.employee_id, emp.employee_name]));
      audits.forEach(a => {
        if (a.action === 'RUMAH_SAKIT') {
          if (a.full_name) {
            a.full_name = toTitleCase(a.full_name);
          } else if (a.username) {
            a.full_name = toTitleCase(a.username);
          } else {
            a.full_name = 'Rumah Sakit';
          }
        } else if (a.user_id && empMap.has(a.user_id)) {
          a.full_name = toTitleCase(empMap.get(a.user_id));
        }
      });
    } else {
      // Format RUMAH_SAKIT full_name directly even if no employee IDs are looked up
      audits.forEach(a => {
        if (a.action === 'RUMAH_SAKIT') {
          if (a.full_name) {
            a.full_name = toTitleCase(a.full_name);
          } else if (a.username) {
            a.full_name = toTitleCase(a.username);
          } else {
            a.full_name = 'Rumah Sakit';
          }
        }
      });
    }

    const roomSign = await getRoomSignState(ikmPool, id);
    const [[komersil]] = await ikmPool.query(
      'SELECT id, form_number, status FROM tr_komersil_linen_transaction WHERE parent_transaction_id = ?', [id]);
    if (transaction) transaction.komersil = komersil || null;

    return res.status(200).json({
      success: true,
      data: {
        transaction,
        details,
        audits: audits.map(sanitizeAuditRow),
        roomSign
      }
    });
  } catch (error) {
    console.error("Error getting transaction detail:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat rincian transaksi",
      error: error.message
    });
  }
};

/**
 * GET /api/ikm/transactions-day?hospitalId=&date=YYYY-MM-DD
 * Formulir pengambilan hari itu (untuk modal "Lanjutkan formulir / Formulir Baru").
 */
export const getDayForms = async (req, res) => {
  try {
    const { hospitalId, date } = req.query;
    if (!hospitalId) return res.status(400).json({ success: false, message: 'hospitalId wajib' });
    const [[now]] = await ikmPool.query('SELECT CURDATE() AS d');
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? date : now.d;
    const forms = await listDayForms(ikmPool, hospitalId, day);
    return res.status(200).json({ success: true, data: forms });
  } catch (error) {
    console.error('Error getting day forms:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat formulir hari ini', error: error.message });
  }
};

/**
 * Day 1: Create transaction (Pickup - Kotor)
 */
export const createTransaction = async (req, res) => {
  const connection = await ikmPool.getConnection();
  let oldSigs = null, savedSigs = null;
  let prevKotorFingerprints = null;
  try {
    await connection.beginTransaction();

    const {
      id,
      hospitalId,
      userPickup,
      hospitalStaffPickup,
      hospitalAssistantPickup,
      pickupDate,
      notes,
      details,
      signatureValetPickup,
      signatureHospitalPickup,
      signatureAssistantPickup,
      totalKgValet,
      isExpress,
      scopeRoomIds,  // ruangan yang diubah perangkat ini (simpan per ruangan, aman untuk banyak valet)
      roomOnly,      // simpan satu ruangan saja: kepala formulir tidak ikut diubah
      forceNew       // valet sengaja memilih "Formulir Baru" walau masih ada formulir hari itu
    } = req.body;

    const total_kg_valet = parseTotalKg(totalKgValet);
    const is_express = parseIsExpress(isExpress);
    const scope = id ? buildScope(scopeRoomIds) : null;

    const isTemporary = !signatureValetPickup || !signatureHospitalPickup;

    if (!hospitalId || !userPickup || !pickupDate || !details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Data form pengisian tidak lengkap"
      });
    }

    if (!isTemporary && !hospitalStaffPickup) {
      return res.status(400).json({
        success: false,
        message: "Nama Petugas RS wajib diisi untuk simpan permanen."
      });
    }

    // Log stok ruangan: potret Terpakai/Dirty semua linen-ruangan yang tersentuh (isian lama + baru) sebelum diubah
    const [prevPairs] = id
      ? await connection.query(
          `SELECT hospital_linen_id, room_id FROM tr_linen_transaction_detail WHERE transaction_id = ? AND room_id IS NOT NULL`, [id])
      : [[]];
    const stockPairs = [
      ...prevPairs.map(p => ({ hospitalLinenId: p.hospital_linen_id, roomId: p.room_id })),
      ...details.filter(d => d.roomId).map(d => ({ hospitalLinenId: d.hospitalLinenId, roomId: d.roomId }))
    ];
    const stockBefore = await snapshotRoomStock(connection, stockPairs);

    let transactionId = id;
    let formNumber;

    if (transactionId) {
      // Check existing
      const [oldTxRows] = await connection.query(
        `SELECT * FROM tr_linen_transaction WHERE id = ?`,
        [transactionId]
      );
      oldSigs = oldTxRows[0];
      if (oldTxRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan" });
      }
      if (oldTxRows[0].status === 'SELESAI') {
        await connection.rollback();
        return res.status(400).json({ success: false, message: "Transaksi yang sudah selesai tidak dapat diubah dari form pengambilan" });
      }
      formNumber = oldTxRows[0].form_number;

      // Update Header. Simpan satu ruangan (roomOnly) tidak menyentuh kepala formulir supaya isian valet lain
      // tidak tertimpa. Jenis express ditetapkan saat formulir dibuat (formulir express terpisah).
      if (!(scope && roomOnly)) {
        await connection.query(
          `UPDATE tr_linen_transaction
           SET user_pickup = ?,
               hospital_staff_pickup = ?,
               hospital_assistant_pickup = ?,
               pickup_date = ?,
               notes_pickup = ?,
               total_kg_valet = ?,
               is_express = COALESCE(?, is_express)
           WHERE id = ?`,
          [
            userPickup,
            hospitalStaffPickup ? toTitleCase(hospitalStaffPickup) : null,
            hospitalAssistantPickup ? toTitleCase(hospitalAssistantPickup) : null,
            pickupDate,
            notes || null,
            total_kg_valet,
            scope ? null : is_express,
            transactionId
          ]
        );
      }

      // Kembalikan Dirty Utility dari rincian lama sebelum dihitung ulang
      const [prevDetails] = await connection.query(
        `SELECT hospital_linen_id, room_id, qty_kotor, is_commercial FROM tr_linen_transaction_detail WHERE transaction_id = ?`,
        [transactionId]
      );
      // Isi kotor per ruangan sebelum disimpan ulang (untuk mereset TTD unit yang angkanya berubah)
      prevKotorFingerprints = roomFingerprints(prevDetails, 'qty_kotor');
      for (const prev of prevDetails) {
        if (scope && !scope.has(prev.room_id)) continue; // ruangan di luar lingkup simpan tidak disentuh
        if (!prev.room_id || !(prev.qty_kotor > 0)) continue;
        if (Number(prev.is_commercial) === 1) continue; // linen komersil tidak memengaruhi stok ruangan
        await connection.query(
          `UPDATE mst_hospital_linen_rooms SET qty_dirty = qty_dirty + ? WHERE hospital_linen_id = ? AND room_id = ?`,
          [prev.qty_kotor, prev.hospital_linen_id, prev.room_id]
        );
      }

      // Delete existing details so we can re-insert (simpan per ruangan: hanya ruangan dalam lingkup)
      if (scope) {
        if (scope.roomIds.length) {
          await connection.query(
            `DELETE FROM tr_linen_transaction_detail WHERE transaction_id = ? AND room_id IN (?)`,
            [transactionId, scope.roomIds]
          );
        }
        if (scope.includeNoRoom) {
          await connection.query(
            `DELETE FROM tr_linen_transaction_detail WHERE transaction_id = ? AND room_id IS NULL`,
            [transactionId]
          );
        }
      } else {
        await connection.query(
          `DELETE FROM tr_linen_transaction_detail WHERE transaction_id = ?`,
          [transactionId]
        );
      }
    } else {
      // Satu formulir induk per hari: tolak formulir baru bila masih ada formulir hari itu (jenis sama,
      // reguler/express) yang bisa dilanjutkan, kecuali valet sengaja memilih "Formulir Baru".
      // Kunci baris RS supaya dua valet yang membuat bersamaan tidak sama-sama lolos.
      await connection.query('SELECT id FROM mst_hospital WHERE id = ? FOR UPDATE', [hospitalId]);
      if (!forceNew) {
        const open = (await listDayForms(connection, hospitalId, formatMySQLDateTime(pickupDate)))
          .filter(f => f.can_continue && f.is_express === is_express);
        if (open.length) {
          await connection.rollback();
          return res.status(409).json({
            success: false,
            code: 'OPEN_FORM_EXISTS',
            message: `Sudah ada formulir ${open.map(f => f.form_number).join(', ')} hari ini. Lanjutkan formulir tersebut atau pilih Formulir Baru.`,
            forms: open
          });
        }
      }

      // Generate form number: {hospitalCode}-{ddmmyy}-{001} (sequential per hospital+day)
      const d = new Date(pickupDate);
      const yyyy = d.getFullYear();
      const yy = String(yyyy).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const ddmmyy = `${dd}${mm}${yy}`;

      // Get the hospital_id code from mst_hospital
      const [hospitalRows] = await connection.query(
        `SELECT hospital_id FROM mst_hospital WHERE id = ?`,
        [hospitalId]
      );
      const hospitalCode = hospitalRows?.[0]?.hospital_id || hospitalId;

      // Nomor urut = nomor terbesar hari itu + 1 (bukan jumlah formulir), supaya tidak bentrok
      // bila ada formulir yang pernah dihapus/digabung.
      const prefix = `${hospitalCode}-${ddmmyy}-`;
      const [sameDay] = await connection.query(
        `SELECT form_number FROM tr_linen_transaction
         WHERE form_number LIKE ? OR (hospital_id = ? AND DATE(pickup_date) = DATE(?))`,
        [`${prefix}%`, hospitalId, pickupDate]
      );
      const maxSeq = sameDay.reduce((m, r) => {
        const s = String(r.form_number || '');
        const n = s.startsWith(prefix) ? parseInt(s.slice(prefix.length), 10) : NaN;
        return Number.isFinite(n) ? Math.max(m, n) : m;
      }, 0);
      const nextSeq = Math.max(maxSeq, 0) + 1;
      formNumber = `${prefix}${String(nextSeq).padStart(3, '0')}`;

      // Aturan TTD per unit dikunci saat transaksi dibuat (transaksi lama tidak terdampak)
      const unitSignRequired = (await hospitalRequiresUnitSign(connection, hospitalId)) ? 1 : 0;

      const [result] = await connection.query(
        `INSERT INTO tr_linen_transaction
         (form_number, hospital_id, user_pickup, hospital_staff_pickup, hospital_assistant_pickup, pickup_date, status, notes_pickup, total_kg_valet, is_express, unit_sign_required)
         VALUES (?, ?, ?, ?, ?, ?, 'PROSES', ?, ?, ?, ?)`,
        [formNumber, hospitalId, userPickup, hospitalStaffPickup ? toTitleCase(hospitalStaffPickup) : null, hospitalAssistantPickup ? toTitleCase(hospitalAssistantPickup) : null, formatMySQLDateTime(pickupDate), notes || null, total_kg_valet, is_express, unitSignRequired]
      );

      transactionId = result.insertId;
    }

    // Decode and save signature images
    const valetPickupPath = saveBase64Image(signatureValetPickup, 'valet_pickup', transactionId);
    const hospitalPickupPath = saveBase64Image(signatureHospitalPickup, 'hospital_pickup', transactionId);
    const assistantPickupPath = signatureAssistantPickup ? saveBase64Image(signatureAssistantPickup, 'assistant_pickup', transactionId) : null;
    savedSigs = { signature_valet_pickup: valetPickupPath, signature_hospital_pickup: hospitalPickupPath, signature_assistant_pickup: assistantPickupPath };

    if (valetPickupPath || hospitalPickupPath || assistantPickupPath) {
      await connection.query(
        `UPDATE tr_linen_transaction 
         SET signature_valet_pickup = COALESCE(?, signature_valet_pickup), 
             signature_hospital_pickup = COALESCE(?, signature_hospital_pickup), 
             signature_assistant_pickup = COALESCE(?, signature_assistant_pickup)
         WHERE id = ?`,
        [valetPickupPath || null, hospitalPickupPath || null, assistantPickupPath || null, transactionId]
      );
    }

    // Linen komersil (is_commercial) dicatat di induk tetapi stoknya tidak disentuh; disalin ke formulir komersil anak
    const commercialIds = await commercialLinenIds(connection, details.map(d => d.hospitalLinenId));
    for (const item of details) {
      // Simpan per ruangan: isian ruangan lain dari perangkat ini (bisa sudah basi) diabaikan
      if (scope && !scope.has(item.roomId || null)) continue;
      const isCommercial = commercialIds.has(Number(item.hospitalLinenId)) ? 1 : 0;
      await connection.query(
        `INSERT INTO tr_linen_transaction_detail
         (transaction_id, hospital_linen_id, room_id, qty_kotor, qty_bersih, notes, is_commercial)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
        [transactionId, item.hospitalLinenId, item.roomId || null, parseInt(item.qtyKotor || 0), item.notes || null, isCommercial]
      );
      // Linen kotor diambil IKM: keluar dari Dirty Utility ruangan, tercatat sebagai Cuci IKM
      const qtyKotor = parseInt(item.qtyKotor || 0);
      if (item.roomId && qtyKotor > 0 && !isCommercial) {
        await takeKotorFromRoom(connection, item.hospitalLinenId, item.roomId, qtyKotor);
      }
    }

    // TTD per unit: ruangan yang sudah TTD Valet + Perawat Unit terkunci, jumlah kotornya tidak boleh berubah
    if (prevKotorFingerprints) {
      const [savedDetails] = await connection.query(
        `SELECT hospital_linen_id, room_id, qty_kotor FROM tr_linen_transaction_detail WHERE transaction_id = ?`,
        [transactionId]
      );
      const lockedRooms = await findLockedChangedRooms(
        connection, transactionId, prevKotorFingerprints, roomFingerprints(savedDetails, 'qty_kotor'), 'pickup');
      if (lockedRooms.length) {
        await connection.rollback();
        cleanupSignatures(savedSigs, oldSigs);
        return res.status(400).json({
          success: false,
          message: `Ruangan ${lockedRooms.join(', ')} sudah TTD unit dan terkunci; jumlah kotornya tidak dapat diubah.`,
          lockedRooms
        });
      }
    }

    // TTD akhir Tim Linen RS + Valet hanya boleh setelah semua unit yang menurunkan kotor sudah TTD
    if (!isTemporary) {
      const roomState = await getRoomSignState(connection, transactionId);
      if (roomState.required && roomState.pending_pickup.length) {
        await connection.rollback();
        cleanupSignatures(savedSigs, oldSigs);
        return res.status(400).json({
          success: false,
          message: `Masih ada unit yang belum TTD pengambilan: ${roomState.pending_pickup.join(', ')}.`,
          pendingRooms: roomState.pending_pickup
        });
      }
    }

    // Formulir komersil anak mengikuti isi linen komersil induk
    await syncKomersilChild(connection, transactionId);

    // Log stok ruangan: perubahan Terpakai/Dirty akibat pengambilan kotor (selisih bersih saja)
    await logRoomStockChanges(connection, stockBefore, await snapshotRoomStock(connection, stockPairs), {
      prefix: 'PICKUP', actor: `Valet ${actorName(req.user, 'IKM')} · ${formNumber}`
    });

    // Capture created state for audit logging
    const [newHeaderRows] = await connection.query(
      `SELECT * FROM tr_linen_transaction WHERE id = ?`,
      [transactionId]
    );
    const newHeader = newHeaderRows[0];

    const [newDetails] = await connection.query(
      `SELECT * FROM tr_linen_transaction_detail WHERE transaction_id = ?`,
      [transactionId]
    );

    const newSnapshot = {
      transaction: stripAdminKg(newHeader),
      details: newDetails
    };

    // User details from token middleware (req.user)
    const userId = req.user?.id || null;
    const username = req.user?.username || 'system';
    const fullName = req.user?.fullName || null;
    const role = req.user?.role || null;

    const action = (role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'superadmin' || role?.toLowerCase() === 'administrator') ? 'ADMIN' : 'PICKUP_KOTOR';

    await connection.query(
      `INSERT INTO tr_linen_transaction_audit 
       (transaction_id, action, user_id, username, full_name, role, old_values, new_values)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        transactionId,
        action,
        userId,
        username,
        fullName,
        role,
        JSON.stringify(newSnapshot)
      ]
    );

    await connection.commit();
    cleanupSignatures(oldSigs, newHeader);

    // Emit real-time socket.io event
    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}`).emit('data_changed', {
        type: 'TRANSACTION_PICKUP',
        transactionId,
        message: 'Transaksi pengambilan linen kotor telah dicatat'
      });
    }

    return res.status(201).json({
      success: true,
      message: isTemporary ? "Berhasil Tersimpan Sementara" : "Transaksi serah terima linen (Kotor) berhasil dicatat",
      isTemporary,
      data: { transactionId, formNumber }
    });
  } catch (error) {
    await connection.rollback();
    cleanupSignatures(savedSigs, oldSigs);
    console.error("Error creating transaction:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal menyimpan data pengambilan kotor",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Day 2: Update delivery (Delivery - Bersih)
 */
export const updateTransactionDelivery = async (req, res) => {
  const connection = await ikmPool.getConnection();
  let oldHeader = null, savedSigs = null;
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      deliveryDate,
      userDelivery,
      hospitalStaffPickup,
      hospitalStaffDelivery,
      hospitalAssistantPickup,
      hospitalAssistantDelivery,
      notes,
      details,
      signatureValetPickup,
      signatureHospitalPickup,
      signatureAssistantPickup,
      signatureValetDelivery,
      signatureHospitalDelivery,
      signatureAssistantDelivery,
      totalKgValet,
      isExpress,
      scopeRoomIds,  // ruangan yang diubah perangkat ini (simpan per ruangan, aman untuk banyak valet)
      roomOnly       // simpan satu ruangan saja: kepala formulir tidak ikut diubah
    } = req.body;

    const isTemporary = !signatureValetDelivery || !signatureHospitalDelivery;

    if (!deliveryDate || !details || details.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Tanggal pengiriman dan rincian bersih wajib diisi"
      });
    }

    if (!isTemporary && (!userDelivery || !hospitalStaffDelivery)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Petugas pengirim dan nama Petugas RS wajib diisi untuk simpan permanen."
      });
    }

    // Get old state
    const [oldHeaderRows] = await connection.query(
      `SELECT * FROM tr_linen_transaction WHERE id = ?`,
      [id]
    );

    if (oldHeaderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Transaksi tidak ditemukan"
      });
    }

    oldHeader = oldHeaderRows[0];

    // Kg / Express: valet may set only while PROSES; after SELESAI keep existing DB values (Alsa-only)
    let total_kg_valet = oldHeader.total_kg_valet;
    let is_express = oldHeader.is_express != null ? oldHeader.is_express : 0;
    if (oldHeader.status === 'PROSES') {
      if (totalKgValet !== undefined) {
        total_kg_valet = parseTotalKg(totalKgValet);
      }
      if (isExpress !== undefined) {
        is_express = parseIsExpress(isExpress);
      }
    }

    // Pengiriman bersih: Total Kg wajib jika RS billing_by_kg
    if (oldHeader.status === 'PROSES') {
      const [hospRows] = await connection.query(
        `SELECT billing_by_kg FROM mst_hospital WHERE id = ? LIMIT 1`,
        [oldHeader.hospital_id]
      );
      if (hospRows.length && Number(hospRows[0].billing_by_kg) === 1) {
        if (total_kg_valet == null || Number.isNaN(Number(total_kg_valet)) || Number(total_kg_valet) < 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: "Total Kg wajib diisi saat pengiriman bersih untuk rumah sakit dengan billing kilogram."
          });
        }
      }
    }

    // Enforce 24-hour edit limit if status is 'SELESAI'
    if (oldHeader.status === 'SELESAI') {
      const completedTimeSource = oldHeader.completed_at || oldHeader.updated_at;
      if (!completedTimeSource) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Batas waktu edit untuk transaksi ini telah berakhir (data lama)."
        });
      }

      const completedTime = new Date(completedTimeSource).getTime();
      const currentTime = new Date().getTime();
      const diffHours = (currentTime - completedTime) / (1000 * 60 * 60);

      if (diffHours > 24) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "Batas waktu edit 24 jam setelah transaksi selesai telah berakhir."
        });
      }
    }

    // Get old details for audit snapshot
    const [oldDetails] = await connection.query(
      `SELECT * FROM tr_linen_transaction_detail WHERE transaction_id = ?`,
      [id]
    );
    // Log stok ruangan: potret sebelum koreksi kotor (koreksi mengubah Terpakai/Dirty ruangan)
    const stockPairs = oldDetails.filter(d => d.room_id).map(d => ({ hospitalLinenId: d.hospital_linen_id, roomId: d.room_id }));
    const stockBefore = await snapshotRoomStock(connection, stockPairs);

    // Determine completed_at (set to now if transitioning from PROSES to SELESAI, and is not temporary save)
    let completedAt = oldHeader.completed_at;
    if (oldHeader.status === 'PROSES' && !isTemporary) {
      completedAt = new Date();
    }

    // Decode and save delivery signatures
    const valetPickupPath = saveBase64Image(signatureValetPickup, 'valet_pickup', id);
    const hospitalPickupPath = saveBase64Image(signatureHospitalPickup, 'hospital_pickup', id);
    const assistantPickupPath = signatureAssistantPickup ? saveBase64Image(signatureAssistantPickup, 'assistant_pickup', id) : null;
    const valetDeliveryPath = saveBase64Image(signatureValetDelivery, 'valet_delivery', id);
    const hospitalDeliveryPath = saveBase64Image(signatureHospitalDelivery, 'hospital_delivery', id);
    const assistantDeliveryPath = signatureAssistantDelivery ? saveBase64Image(signatureAssistantDelivery, 'assistant_delivery', id) : null;
    savedSigs = {
      signature_valet_pickup: valetPickupPath, signature_hospital_pickup: hospitalPickupPath, signature_assistant_pickup: assistantPickupPath,
      signature_valet_delivery: valetDeliveryPath, signature_hospital_delivery: hospitalDeliveryPath, signature_assistant_delivery: assistantDeliveryPath
    };

    const status = isTemporary ? 'PROSES' : 'SELESAI';
    const completedAtValue = isTemporary ? null : completedAt;

    // Simpan per ruangan (hanya selama PROSES): ruangan di luar lingkup tidak disentuh
    const scope = oldHeader.status === 'PROSES' ? buildScope(scopeRoomIds) : null;

    if (scope && roomOnly) {
      // Simpan satu ruangan: kepala formulir tidak ditimpa (isian valet lain aman); hanya isi yang masih kosong
      await connection.query(
        `UPDATE tr_linen_transaction
            SET delivery_date = COALESCE(delivery_date, ?),
                user_delivery = COALESCE(user_delivery, ?)
          WHERE id = ?`,
        [formatMySQLDateTime(deliveryDate), userDelivery || null, id]
      );
    } else {
    // Update Header
    await connection.query(
      `UPDATE tr_linen_transaction 
       SET delivery_date = ?, 
           completed_at = ?,
           user_delivery = COALESCE(?, user_delivery), 
           hospital_staff_pickup = ?,
           hospital_staff_delivery = ?,
           hospital_assistant_pickup = ?,
           hospital_assistant_delivery = ?,
           signature_valet_pickup = ?,
           signature_hospital_pickup = ?,
           signature_assistant_pickup = ?,
           signature_valet_delivery = ?,
           signature_hospital_delivery = ?,
           signature_assistant_delivery = ?,
           notes_delivery = ?, 
           status = ?,
           total_kg_valet = ?,
           is_express = ?
       WHERE id = ?`,
      [
        formatMySQLDateTime(deliveryDate),
        formatMySQLDateTime(completedAt),
        userDelivery || null,
        toTitleCase(hospitalStaffPickup) || null,
        toTitleCase(hospitalStaffDelivery) || null,
        hospitalAssistantPickup ? toTitleCase(hospitalAssistantPickup) : null,
        hospitalAssistantDelivery ? toTitleCase(hospitalAssistantDelivery) : null,
        valetPickupPath || null,
        hospitalPickupPath || null,
        assistantPickupPath || null,
        valetDeliveryPath || null,
        hospitalDeliveryPath || null,
        assistantDeliveryPath || null,
        notes || null,
        status,
        total_kg_valet,
        is_express,
        id
      ]
    );
    }

    // Update Details (support updating both qty_kotor and qty_bersih)
    for (const item of details) {
      const newKotor = parseInt(item.qtyKotor !== undefined ? item.qtyKotor : 0);
      const prev = oldDetails.find((row) => String(row.id) === String(item.id));
      // Simpan per ruangan: baris ruangan lain dari perangkat ini (bisa sudah basi) diabaikan
      if (scope && (!prev || !scope.has(prev.room_id))) continue;
      await connection.query(
        `UPDATE tr_linen_transaction_detail 
         SET qty_kotor = ?, 
             qty_bersih = ?, 
             notes = ?
         WHERE id = ? AND transaction_id = ?`,
        [
          newKotor,
          item.qtyBersih !== null && item.qtyBersih !== undefined ? parseInt(item.qtyBersih) : null,
          item.notes || null,
          item.id,
          id
        ]
      );
      // Koreksi kotor oleh admin: samakan Dirty Utility dengan selisihnya
      if (prev?.room_id && prev.qty_kotor !== newKotor && Number(prev.is_commercial) !== 1) {
        const selisih = prev.qty_kotor - newKotor;
        if (selisih > 0) {
          // Kotor dikurangi: selisihnya kembali ke Dirty Utility
          await connection.query(
            `UPDATE mst_hospital_linen_rooms SET qty_dirty = qty_dirty + ? WHERE hospital_linen_id = ? AND room_id = ?`,
            [selisih, prev.hospital_linen_id, prev.room_id]
          );
        } else {
          // Kotor ditambah: ambil dari Dirty Utility dulu, sisanya dari Terpakai
          await takeKotorFromRoom(connection, prev.hospital_linen_id, prev.room_id, -selisih);
        }
      }
    }

    // Log stok ruangan: perubahan Terpakai/Dirty akibat koreksi jumlah kotor
    await logRoomStockChanges(connection, stockBefore, await snapshotRoomStock(connection, stockPairs), {
      prefix: 'KOREKSI', actor: `${actorName(req.user, 'IKM')} · ${oldHeader.form_number}`
    });

    // TTD per unit (pengiriman bersih) selama transaksi masih PROSES
    if (oldHeader.status === 'PROSES') {
      const [savedDetails] = await connection.query(
        `SELECT hospital_linen_id, room_id, qty_kotor, qty_bersih FROM tr_linen_transaction_detail WHERE transaction_id = ?`,
        [id]
      );
      // Ruangan yang sudah TTD unit terkunci: bersih (tahap delivery) dan kotor (tahap pickup) tidak boleh berubah
      const lockedRooms = [...new Set([
        ...await findLockedChangedRooms(connection, id, roomFingerprints(oldDetails, 'qty_bersih'), roomFingerprints(savedDetails, 'qty_bersih'), 'delivery'),
        ...await findLockedChangedRooms(connection, id, roomFingerprints(oldDetails, 'qty_kotor'), roomFingerprints(savedDetails, 'qty_kotor'), 'pickup')
      ])];
      if (lockedRooms.length) {
        await connection.rollback();
        cleanupSignatures(savedSigs, oldHeader);
        return res.status(400).json({
          success: false,
          message: `Ruangan ${lockedRooms.join(', ')} sudah TTD unit dan terkunci; jumlahnya tidak dapat diubah.`,
          lockedRooms
        });
      }

      if (!isTemporary) {
        const roomState = await getRoomSignState(connection, id);
        if (roomState.required && roomState.pending_delivery.length) {
          await connection.rollback();
          cleanupSignatures(savedSigs, oldHeader);
          return res.status(400).json({
            success: false,
            message: `Masih ada unit yang belum TTD pengiriman bersih: ${roomState.pending_delivery.join(', ')}.`,
            pendingRooms: roomState.pending_delivery
          });
        }
      }
    }

    // Formulir komersil anak: kepala, qty dan bersih mengikuti induk
    await syncKomersilChild(connection, id, { syncBersih: true });

    // Fetch new values for the audit log
    const [newHeaderRows] = await connection.query(
      `SELECT * FROM tr_linen_transaction WHERE id = ?`,
      [id]
    );
    const newHeader = newHeaderRows[0];

    const [newDetails] = await connection.query(
      `SELECT * FROM tr_linen_transaction_detail WHERE transaction_id = ?`,
      [id]
    );

    const oldSnapshot = {
      transaction: stripAdminKg(oldHeader),
      details: oldDetails
    };
    const newSnapshot = {
      transaction: stripAdminKg(newHeader),
      details: newDetails
    };

    // User details from token middleware (req.user)
    const userId = req.user?.id || null;
    const username = req.user?.username || 'system';
    const fullName = req.user?.fullName || null;
    const role = req.user?.role || null;

    const action = (role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'superadmin' || role?.toLowerCase() === 'administrator') ? 'ADMIN' : 'DELIVERY_BERSIH';

    await connection.query(
      `INSERT INTO tr_linen_transaction_audit 
       (transaction_id, action, user_id, username, full_name, role, old_values, new_values)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        action,
        userId,
        username,
        fullName,
        role,
        JSON.stringify(oldSnapshot),
        JSON.stringify(newSnapshot)
      ]
    );

    await connection.commit();
    cleanupSignatures(oldHeader, newHeader);

    const hospitalId = oldHeader.hospital_id;

    // Emit real-time socket.io event
    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}`).emit('data_changed', {
        type: 'TRANSACTION_DELIVERY',
        transactionId: Number(id),
        message: 'Transaksi pengiriman linen bersih telah dicatat'
      });
    }

    return res.status(200).json({
      success: true,
      message: isTemporary ? "Berhasil Tersimpan Sementara" : "Transaksi serah terima linen bersih berhasil diselesaikan",
      isTemporary
    });
  } catch (error) {
    await connection.rollback();
    cleanupSignatures(savedSigs, oldHeader);
    console.error("Error updating transaction delivery:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal menyimpan data pengiriman bersih",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Get active IKM employees (company_id = 2 and exit_date IS NULL)
 */
export const getIkmEmployees = async (req, res) => {
  try {
    const [employees] = await mainPool.query(
      `SELECT employee_id, full_name as employee_name
       FROM mst_employee
       WHERE company_id = 2 AND exit_date IS NULL
       ORDER BY full_name ASC`
    );
    const formattedEmployees = employees.map(emp => ({
      ...emp,
      employee_name: toTitleCase(emp.employee_name)
    }));
    return res.status(200).json({
      success: true,
      data: formattedEmployees
    });
  } catch (error) {
    console.error("Error getting IKM employees:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat daftar petugas IKM",
      error: error.message
    });
  }
};
