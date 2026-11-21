import { ikmPool, mainPool } from '../../db/pool.js';
import { getSignatureUrl, saveBase64Image, cleanupSignatures } from '../../middleware/upload.js';
import { getRoomSignState } from '../../utils/roomSign.js';
import { pushKomersilBersihToParent, komersilMeasure } from '../../utils/komersilChild.js';

const SIG_FIELDS = [
  'signature_valet_pickup', 'signature_hospital_pickup', 'signature_assistant_pickup',
  'signature_valet_delivery', 'signature_hospital_delivery', 'signature_assistant_delivery'
];

/** Batas edit: PROSES bebas, SELESAI maksimal 24 jam setelah selesai */
const withinEditWindow = (tx) => {
  if (!tx) return false;
  if (tx.status === 'PROSES') return true;
  const src = tx.completed_at || tx.updated_at;
  if (!src) return false;
  return (Date.now() - new Date(src).getTime()) / 36e5 <= 24;
};

/** Formulir komersil berinduk memakai TTD, status dan batas edit formulir serah terima induknya */
const attachParent = async (tx) => {
  if (!tx?.parent_transaction_id) return tx;
  const [[parent]] = await ikmPool.query(
    'SELECT * FROM tr_linen_transaction WHERE id = ?', [tx.parent_transaction_id]);
  if (!parent) return tx;
  for (const f of SIG_FIELDS) tx[f] = parent[f];
  tx.status = parent.status;
  tx.completed_at = parent.completed_at;
  tx.updated_at = parent.updated_at;
  tx.parent_form_number = parent.form_number;
  tx.parent_is_express = Number(parent.is_express) === 1 ? 1 : 0;
  tx._parent = parent;
  return tx;
};

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

// Ensure tr_komersil_linen_transaction_detail has hospital_linen_id column
const ensureKomersilTableColumns = async () => {
  try {
    await ikmPool.query(`
      ALTER TABLE tr_komersil_linen_transaction_detail 
      ADD COLUMN hospital_linen_id BIGINT UNSIGNED NULL AFTER transaction_id
    `);
  } catch (err) {
    // Ignore duplicate column error if it already exists
  }
};
ensureKomersilTableColumns();

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

/**
 * Get hospital linen items flagged as commercial (is_commercial = 1)
 */
export const getHospitalLinenKomersil = async (req, res) => {
  try {
    const { hospitalId } = req.query;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "ID Rumah Sakit wajib disertakan"
      });
    }

    const query = `
      SELECT hl.*, l.linen_name, l.linen_code, l.category_id,
             s.size_name, c.color_name, m.material_name
      FROM mst_hospital_linen hl
      INNER JOIN mst_linen l ON hl.linen_id = l.id
      LEFT JOIN mst_size s ON l.size_id = s.id
      LEFT JOIN mst_color c ON l.color_id = c.id
      LEFT JOIN mst_material m ON l.material_id = m.id
      WHERE hl.hospital_id = ? AND hl.is_active = 1 AND hl.is_commercial = 1
      ORDER BY l.linen_name ASC
    `;

    const [linens] = await ikmPool.query(query, [hospitalId]);

    return res.status(200).json({
      success: true,
      data: linens
    });
  } catch (error) {
    console.error("Error getting komersil hospital linen:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat master linen komersil",
      error: error.message
    });
  }
};

/**
 * Get list of komersil transactions (from tr_komersil_linen_transaction)
 */
export const getKomersilTransactions = async (req, res) => {
  try {
    const { hospitalId, startDate, endDate, status, search } = req.query;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "ID Rumah Sakit wajib disertakan"
      });
    }

    let matchedEmployeeIds = [];
    if (search) {
      const [emps] = await mainPool.query(
        `SELECT employee_id FROM mst_employee WHERE full_name LIKE ?`,
        [`%${search}%`]
      );
      matchedEmployeeIds = emps.map(e => e.employee_id);
    }

    let query = `
      SELECT t.*, h.hospital_name,
        (SELECT COUNT(*) FROM tr_komersil_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_items,
        (SELECT COALESCE(SUM(qty_kotor), 0) FROM tr_komersil_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_qty_kotor,
        (SELECT COALESCE(SUM(qty_bersih), 0) FROM tr_komersil_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_qty_bersih,
        p.form_number AS parent_form_number,
        p.status AS parent_status, p.completed_at AS parent_completed_at,
        p.signature_valet_pickup AS p_signature_valet_pickup, p.signature_hospital_pickup AS p_signature_hospital_pickup,
        p.signature_assistant_pickup AS p_signature_assistant_pickup, p.signature_valet_delivery AS p_signature_valet_delivery,
        p.signature_hospital_delivery AS p_signature_hospital_delivery, p.signature_assistant_delivery AS p_signature_assistant_delivery
      FROM tr_komersil_linen_transaction t
      INNER JOIN mst_hospital h ON t.hospital_id = h.id
      LEFT JOIN tr_linen_transaction p ON p.id = t.parent_transaction_id
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
      query += ` AND COALESCE(p.status, t.status) = ?`;
      params.push(status);
    }

    if (search) {
      const searchWildcard = `%${search}%`;
      if (matchedEmployeeIds.length > 0) {
        query += ` AND (t.form_number LIKE ? OR t.notes_pickup LIKE ? OR t.hospital_staff_pickup LIKE ? OR t.hospital_staff_delivery LIKE ? OR t.user_pickup IN (?) OR t.user_delivery IN (?))`;
        params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, matchedEmployeeIds, matchedEmployeeIds);
      } else {
        query += ` AND (t.form_number LIKE ? OR t.notes_pickup LIKE ? OR t.hospital_staff_pickup LIKE ? OR t.hospital_staff_delivery LIKE ?)`;
        params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
      }
    }

    query += ` ORDER BY t.pickup_date DESC, t.id DESC`;

    const [transactions] = await ikmPool.query(query, params);

    const [employees] = await mainPool.query(
      `SELECT employee_id, full_name as employee_name FROM mst_employee`
    );
    const empMap = new Map(employees.map(emp => [emp.employee_id, emp.employee_name]));

    const formattedTransactions = transactions.map(raw => {
      const tx = { ...raw };
      if (tx.parent_transaction_id && tx.parent_form_number) {
        for (const f of SIG_FIELDS) tx[f] = tx[`p_${f}`];
        tx.status = tx.parent_status;
        tx.completed_at = tx.parent_completed_at;
      }
      for (const f of SIG_FIELDS) delete tx[`p_${f}`];
      return tx;
    }).map(tx => ({
      ...tx,
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
      data: formattedTransactions
    });
  } catch (error) {
    console.error("Error getting komersil transactions:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat riwayat transaksi komersil",
      error: error.message
    });
  }
};

/**
 * Get detailed transaction items for komersil items (from tr_komersil_linen_transaction & tr_komersil_linen_transaction_detail)
 */
export const getKomersilTransactionDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [transactions] = await ikmPool.query(
      `SELECT t.*, h.hospital_name 
       FROM tr_komersil_linen_transaction t
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
              COALESCE(td.item_name, hl.hospital_linen_name, l.linen_name) as linen_name,
              l.linen_code, l.category_id,
              hl.unit, hl.hospital_linen_name, hl.grammage,
              COALESCE(hl.washing_price_type, 'PCS') AS washing_price_type,
              s.size_name, c.color_name, m.material_name, r.room_name
       FROM tr_komersil_linen_transaction_detail td
       LEFT JOIN mst_hospital_linen hl ON td.hospital_linen_id = hl.id
       LEFT JOIN mst_linen l ON hl.linen_id = l.id
       LEFT JOIN mst_size s ON l.size_id = s.id
       LEFT JOIN mst_color c ON l.color_id = c.id
       LEFT JOIN mst_material m ON l.material_id = m.id
       LEFT JOIN mst_rooms_rs r ON td.room_id = r.id
       WHERE td.transaction_id = ?
       ORDER BY r.room_name ASC, td.hospital_linen_id ASC, td.id ASC`,
      [id]
    );
    details.forEach(d => { const m = komersilMeasure(d); d.measure_value = m.value; d.measure_unit = m.unit; });

    const transaction = await attachParent(transactions[0]);
    let roomSign = null;
    if (transaction) {
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

      transaction.is_editable = withinEditWindow(transaction);
      if (transaction._parent) {
        roomSign = await getRoomSignState(ikmPool, transaction.parent_transaction_id);
        delete transaction._parent;
      }
    }

    const [audits] = await ikmPool.query(
      `SELECT * FROM tr_komersil_linen_transaction_audit 
       WHERE transaction_id = ? 
       ORDER BY created_at ASC`,
      [id]
    );

    const auditUserIds = audits.map(a => a.user_id).filter(uid => uid !== null && uid !== undefined);
    if (auditUserIds.length > 0) {
      const [employees] = await mainPool.query(
        `SELECT employee_id, full_name as employee_name 
         FROM mst_employee 
         WHERE employee_id IN (?)`,
        [auditUserIds]
      );
      const empMap = new Map(employees.map(emp => [emp.employee_id, emp.employee_name]));
      audits.forEach(a => {
        if (a.user_id && empMap.has(a.user_id)) {
          a.full_name = toTitleCase(empMap.get(a.user_id));
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        transaction,
        details,
        audits,
        roomSign
      }
    });
  } catch (error) {
    console.error("Error getting komersil transaction detail:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat rincian transaksi komersil",
      error: error.message
    });
  }
};

/**
 * Create komersil transaction into tr_komersil_linen_transaction & tr_komersil_linen_transaction_detail
 */
export const createKomersilTransaction = async (req, res) => {
  // Formulir komersil kini dibuat otomatis dari formulir serah terima induk (linen is_commercial)
  if (!req.body?.id) {
    return res.status(400).json({
      success: false,
      message: 'Formulir linen komersil dibuat otomatis dari Serah Terima Linen. Catat linen komersil di formulir serah terima.'
    });
  }
  const [[existing]] = await ikmPool.query(
    'SELECT parent_transaction_id FROM tr_komersil_linen_transaction WHERE id = ?', [req.body.id]);
  if (existing?.parent_transaction_id) {
    return res.status(400).json({
      success: false,
      message: 'Pengambilan kotor formulir komersil ini mengikuti formulir serah terima induknya.'
    });
  }
  const connection = await ikmPool.getConnection();
  let oldSigs = null, savedSigs = null;
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
      signatureAssistantPickup
    } = req.body;

    if (!hospitalId || !userPickup || !pickupDate || !details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Data form pengisian tidak lengkap"
      });
    }

    let transactionId = id;
    let formNumber;

    if (transactionId) {
      [[oldSigs]] = await connection.query(`SELECT * FROM tr_komersil_linen_transaction WHERE id = ?`, [transactionId]);
      // Temporary transaction update
      await connection.query(
        `UPDATE tr_komersil_linen_transaction 
         SET user_pickup = ?, 
             hospital_staff_pickup = ?, 
             hospital_assistant_pickup = ?, 
             pickup_date = ?, 
             notes_pickup = ?
         WHERE id = ?`,
        [userPickup, hospitalStaffPickup ? toTitleCase(hospitalStaffPickup) : null, hospitalAssistantPickup ? toTitleCase(hospitalAssistantPickup) : null, pickupDate, notes || null, transactionId]
      );
      await connection.query(`DELETE FROM tr_komersil_linen_transaction_detail WHERE transaction_id = ?`, [transactionId]);
    } else {
      const d = new Date(pickupDate);
      const yyyy = d.getFullYear();
      const yy = String(yyyy).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const ddmmyy = `${dd}${mm}${yy}`;

      const [countResult] = await connection.query(
        `SELECT COUNT(*) as cnt FROM tr_komersil_linen_transaction WHERE hospital_id = ? AND DATE(pickup_date) = DATE(?)`,
        [hospitalId, pickupDate]
      );
      const nextSeq = (countResult?.[0]?.cnt || 0) + 1;

      const [hospitalRows] = await connection.query(
        `SELECT hospital_id FROM mst_hospital WHERE id = ?`,
        [hospitalId]
      );
      const hospitalCode = hospitalRows?.[0]?.hospital_id || hospitalId;
      formNumber = `${hospitalCode}-KOM-${ddmmyy}-${String(nextSeq).padStart(3, '0')}`;

      const [result] = await connection.query(
        `INSERT INTO tr_komersil_linen_transaction 
         (form_number, hospital_id, user_pickup, hospital_staff_pickup, hospital_assistant_pickup, pickup_date, status, notes_pickup)
         VALUES (?, ?, ?, ?, ?, ?, 'PROSES', ?)`,
        [formNumber, hospitalId, userPickup, hospitalStaffPickup ? toTitleCase(hospitalStaffPickup) : null, hospitalAssistantPickup ? toTitleCase(hospitalAssistantPickup) : null, pickupDate, notes || null]
      );
      transactionId = result.insertId;
    }

    const valetPickupPath = saveBase64Image(signatureValetPickup, 'valet_pickup', transactionId);
    const hospitalPickupPath = saveBase64Image(signatureHospitalPickup, 'hospital_pickup', transactionId);
    const assistantPickupPath = signatureAssistantPickup ? saveBase64Image(signatureAssistantPickup, 'assistant_pickup', transactionId) : null;
    savedSigs = { signature_valet_pickup: valetPickupPath, signature_hospital_pickup: hospitalPickupPath, signature_assistant_pickup: assistantPickupPath };

    await connection.query(
      `UPDATE tr_komersil_linen_transaction 
       SET signature_valet_pickup = COALESCE(?, signature_valet_pickup), 
           signature_hospital_pickup = COALESCE(?, signature_hospital_pickup), 
           signature_assistant_pickup = COALESCE(?, signature_assistant_pickup)
       WHERE id = ?`,
      [valetPickupPath || null, hospitalPickupPath || null, assistantPickupPath || null, transactionId]
    );

    // Look up display names for hospital_linen_ids
    const hospitalLinenIds = details.map(d => d.hospitalLinenId).filter(Boolean);
    let linenNameMap = new Map();
    if (hospitalLinenIds.length > 0) {
      const [linenRows] = await connection.query(
        `SELECT hl.id, COALESCE(hl.hospital_linen_name, l.linen_name) as display_name
         FROM mst_hospital_linen hl
         INNER JOIN mst_linen l ON hl.linen_id = l.id
         WHERE hl.id IN (?)`,
        [hospitalLinenIds]
      );
      linenNameMap = new Map(linenRows.map(r => [r.id, r.display_name]));
    }

    for (const item of details) {
      const name = linenNameMap.get(item.hospitalLinenId) || item.itemName || 'Linen Komersil';
      await connection.query(
        `INSERT INTO tr_komersil_linen_transaction_detail 
         (transaction_id, hospital_linen_id, item_name, qty_kotor, qty_bersih, notes)
         VALUES (?, ?, ?, ?, NULL, ?)`,
        [transactionId, item.hospitalLinenId || null, name, parseInt(item.qtyKotor || 0), item.notes || null]
      );
    }

    const [newHeaderRows] = await connection.query(
      `SELECT * FROM tr_komersil_linen_transaction WHERE id = ?`,
      [transactionId]
    );
    const newHeader = newHeaderRows[0];

    const [newDetails] = await connection.query(
      `SELECT * FROM tr_komersil_linen_transaction_detail WHERE transaction_id = ?`,
      [transactionId]
    );

    const userId = req.user?.id || null;
    const username = req.user?.username || 'system';
    const fullName = req.user?.fullName || null;
    const role = req.user?.role || null;
    const action = (role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'superadmin' || role?.toLowerCase() === 'administrator') ? 'ADMIN' : 'PICKUP_KOTOR';

    await connection.query(
      `INSERT INTO tr_komersil_linen_transaction_audit 
       (transaction_id, action, user_id, username, full_name, role, old_values, new_values)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        transactionId,
        action,
        userId,
        username,
        fullName,
        role,
        JSON.stringify({ transaction: newHeader, details: newDetails })
      ]
    );

    await connection.commit();
    cleanupSignatures(oldSigs, newHeader);

    // Emit real-time socket.io event
    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}`).emit('data_changed', {
        type: 'TRANSACTION_PICKUP',
        message: 'Transaksi pengambilan linen kotor komersil telah dicatat'
      });
    }

    const isTemporary = !signatureValetPickup || !signatureHospitalPickup;

    return res.status(201).json({
      success: true,
      message: isTemporary ? "Berhasil Tersimpan Sementara" : "Berhasil menyimpan serah terima kotor komersil item",
      isTemporary,
      data: { transactionId, formNumber: formNumber || newHeader.form_number }
    });
  } catch (error) {
    await connection.rollback();
    cleanupSignatures(savedSigs, oldSigs);
    console.error("Error creating komersil transaction:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal menyimpan serah terima kotor komersil item",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Complete Delivery in tr_komersil_linen_transaction & tr_komersil_linen_transaction_detail
 */
export const updateKomersilTransactionDelivery = async (req, res) => {
  const [[head]] = await ikmPool.query(
    'SELECT parent_transaction_id FROM tr_komersil_linen_transaction WHERE id = ?', [req.params.id]);
  if (head?.parent_transaction_id) return updateKomersilChild(req, res);
  const connection = await ikmPool.getConnection();
  let oldHeader = null, savedSigs = null;
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      userDelivery,
      hospitalStaffDelivery,
      hospitalAssistantDelivery,
      deliveryDate,
      notes,
      details,
      signatureValetDelivery,
      signatureHospitalDelivery,
      signatureAssistantDelivery
    } = req.body;

    const [oldHeaderRows] = await connection.query(
      `SELECT * FROM tr_komersil_linen_transaction WHERE id = ?`,
      [id]
    );
    if (oldHeaderRows.length === 0) {
      return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan" });
    }
    oldHeader = oldHeaderRows[0];

    const [oldDetails] = await connection.query(
      `SELECT * FROM tr_komersil_linen_transaction_detail WHERE transaction_id = ?`,
      [id]
    );

    const valetDeliveryPath = saveBase64Image(signatureValetDelivery, 'valet_delivery', id);
    const hospitalDeliveryPath = saveBase64Image(signatureHospitalDelivery, 'hospital_delivery', id);
    const assistantDeliveryPath = signatureAssistantDelivery ? saveBase64Image(signatureAssistantDelivery, 'assistant_delivery', id) : null;
    savedSigs = { signature_valet_delivery: valetDeliveryPath, signature_hospital_delivery: hospitalDeliveryPath, signature_assistant_delivery: assistantDeliveryPath };

    const isTemporary = !signatureValetDelivery || !signatureHospitalDelivery;
    const newStatus = isTemporary ? 'PROSES' : 'SELESAI';
    const completedAtVal = isTemporary ? null : new Date();

    await connection.query(
      `UPDATE tr_komersil_linen_transaction 
       SET user_delivery = ?, 
           hospital_staff_delivery = ?, 
           hospital_assistant_delivery = ?, 
           delivery_date = ?, 
           status = ?, 
           notes_delivery = ?, 
           signature_valet_delivery = COALESCE(?, signature_valet_delivery), 
           signature_hospital_delivery = COALESCE(?, signature_hospital_delivery), 
           signature_assistant_delivery = COALESCE(?, signature_assistant_delivery)
       WHERE id = ?`,
      [
        userDelivery,
        hospitalStaffDelivery ? toTitleCase(hospitalStaffDelivery) : null,
        hospitalAssistantDelivery ? toTitleCase(hospitalAssistantDelivery) : null,
        deliveryDate,
        newStatus,
        notes || null,
        valetDeliveryPath || null,
        hospitalDeliveryPath || null,
        assistantDeliveryPath || null,
        id
      ]
    );

    // Delete all existing detail entries for this transaction
    await connection.query(
      `DELETE FROM tr_komersil_linen_transaction_detail WHERE transaction_id = ?`,
      [id]
    );

    // Fetch display names for hospital_linen_ids
    const hospitalLinenIds = details.map(d => d.hospitalLinenId).filter(Boolean);
    let linenNameMap = new Map();
    if (hospitalLinenIds.length > 0) {
      const [linenRows] = await connection.query(
        `SELECT hl.id, COALESCE(hl.hospital_linen_name, l.linen_name) as display_name
         FROM mst_hospital_linen hl
         INNER JOIN mst_linen l ON hl.linen_id = l.id
         WHERE hl.id IN (?)`,
        [hospitalLinenIds]
      );
      linenNameMap = new Map(linenRows.map(r => [r.id, r.display_name]));
    }

    for (const item of details) {
      const name = linenNameMap.get(item.hospitalLinenId) || item.itemName || 'Linen Komersil';
      const length = item.lengthCm ? parseFloat(item.lengthCm) : null;
      const width = item.widthCm ? parseFloat(item.widthCm) : null;
      let area = null;
      if (length && width) {
        area = (length > 10 && width > 10) ? (length * width) / 10000 : (length * width);
      }

      await connection.query(
        `INSERT INTO tr_komersil_linen_transaction_detail 
         (transaction_id, hospital_linen_id, item_name, qty_kotor, qty_bersih, length_cm, width_cm, area_m2, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.hospitalLinenId || null,
          name,
          parseInt(item.qtyKotor || 0),
          item.qtyBersih !== null && item.qtyBersih !== undefined ? parseInt(item.qtyBersih) : null,
          length,
          width,
          item.areaM2 !== undefined && item.areaM2 !== null ? item.areaM2 : area,
          item.notes || null
        ]
      );
    }

    const [newHeaderRows] = await connection.query(
      `SELECT * FROM tr_komersil_linen_transaction WHERE id = ?`,
      [id]
    );
    const newHeader = newHeaderRows[0];

    const [newDetails] = await connection.query(
      `SELECT * FROM tr_komersil_linen_transaction_detail WHERE transaction_id = ?`,
      [id]
    );

    const userId = req.user?.id || null;
    const username = req.user?.username || 'system';
    const fullName = req.user?.fullName || null;
    const role = req.user?.role || null;
    const action = (role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'superadmin' || role?.toLowerCase() === 'administrator') ? 'ADMIN' : 'DELIVERY_BERSIH';

    await connection.query(
      `INSERT INTO tr_komersil_linen_transaction_audit 
       (transaction_id, action, user_id, username, full_name, role, old_values, new_values)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        action,
        userId,
        username,
        fullName,
        role,
        JSON.stringify({ transaction: oldHeader, details: oldDetails }),
        JSON.stringify({ transaction: newHeader, details: newDetails })
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
        message: 'Transaksi pengiriman linen bersih komersil telah dicatat'
      });
    }

    return res.status(200).json({
      success: true,
      message: isTemporary ? "Berhasil Tersimpan Sementara" : "Transaksi serah terima komersil item bersih berhasil diselesaikan",
      isTemporary
    });
  } catch (error) {
    await connection.rollback();
    cleanupSignatures(savedSigs, oldHeader);
    console.error("Error updating komersil transaction delivery:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal menyimpan pengiriman komersil item bersih",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Simpan formulir komersil berinduk: hanya qty bersih, ukuran P × L (tipe M2), catatan dan express.
 * Baris, kotor, TTD dan status mengikuti formulir serah terima induk.
 */
const updateKomersilChild = async (req, res) => {
  const connection = await ikmPool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { details = [], isExpress } = req.body;

    const [[header]] = await connection.query('SELECT * FROM tr_komersil_linen_transaction WHERE id = ? FOR UPDATE', [id]);
    const [[parent]] = await connection.query('SELECT * FROM tr_linen_transaction WHERE id = ?', [header.parent_transaction_id]);
    if (!parent) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Formulir serah terima induk tidak ditemukan' });
    }
    if (!withinEditWindow(parent)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Batas waktu edit 24 jam setelah formulir induk selesai telah berakhir.' });
    }

    const [oldDetails] = await connection.query(
      `SELECT td.*, COALESCE(hl.washing_price_type, 'PCS') AS washing_price_type
         FROM tr_komersil_linen_transaction_detail td
         LEFT JOIN mst_hospital_linen hl ON hl.id = td.hospital_linen_id
        WHERE td.transaction_id = ?`, [id]);
    const byId = new Map(oldDetails.map(d => [String(d.id), d]));
    const num = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

    for (const item of details) {
      const row = byId.get(String(item.id));
      if (!row) continue; // baris milik formulir lain / sudah tidak ada
      const kotor = Number(row.qty_kotor) || 0;
      let bersih = item.qtyBersih === undefined ? row.qty_bersih : num(item.qtyBersih);
      if (bersih !== null) bersih = Math.max(0, Math.min(kotor, Math.round(bersih)));
      let length = null, width = null, area = null;
      if (row.washing_price_type === 'M2') {
        length = item.lengthCm === undefined ? num(row.length_cm) : num(item.lengthCm);
        width = item.widthCm === undefined ? num(row.width_cm) : num(item.widthCm);
        area = length && width ? Math.round(length * width * 100) / 100 : null;
      }
      await connection.query(
        `UPDATE tr_komersil_linen_transaction_detail
            SET qty_bersih = ?, length_cm = ?, width_cm = ?, area_m2 = ?, notes = ?
          WHERE id = ? AND transaction_id = ?`,
        [bersih, length, width, area, item.notes === undefined ? row.notes : (item.notes || null), row.id, id]);
    }

    if (isExpress !== undefined) {
      await connection.query('UPDATE tr_komersil_linen_transaction SET is_express = ? WHERE id = ?',
        [isExpress === true || isExpress === 1 || isExpress === '1' ? 1 : 0, id]);
    }

    // Bersih ditulis balik ke formulir induk; ruangan yang sudah TTD unit pengiriman terkunci
    const { lockedRooms } = await pushKomersilBersihToParent(connection, id);
    if (lockedRooms.length) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Ruangan ${lockedRooms.join(', ')} sudah TTD unit pengiriman dan terkunci; jumlah bersihnya tidak dapat diubah.`,
        lockedRooms
      });
    }

    const [[newHeader]] = await connection.query('SELECT * FROM tr_komersil_linen_transaction WHERE id = ?', [id]);
    const [newDetails] = await connection.query('SELECT * FROM tr_komersil_linen_transaction_detail WHERE transaction_id = ?', [id]);
    const role = req.user?.role || null;
    const isAdmin = ['admin', 'superadmin', 'administrator'].includes(String(role).toLowerCase());
    await connection.query(
      `INSERT INTO tr_komersil_linen_transaction_audit
         (transaction_id, action, user_id, username, full_name, role, old_values, new_values)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, isAdmin ? 'ADMIN' : 'DELIVERY_BERSIH', req.user?.id || null, req.user?.username || 'system',
        req.user?.fullName || null, role,
        JSON.stringify({ transaction: header, details: oldDetails }),
        JSON.stringify({ transaction: newHeader, details: newDetails })]);

    await connection.commit();

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${header.hospital_id}`).emit('data_changed', {
        type: 'TRANSACTION_DELIVERY',
        message: 'Formulir linen komersil diperbarui'
      });
    }
    return res.status(200).json({ success: true, message: 'Formulir linen komersil berhasil disimpan', isTemporary: false });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating komersil child:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan formulir linen komersil', error: error.message });
  } finally {
    connection.release();
  }
};
