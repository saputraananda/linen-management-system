import { ikmPool, mainPool } from '../../db/pool.js';
import { getSignatureUrl, saveBase64Image } from '../../middleware/upload.js';

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

// Ensure tr_custom_linen_transaction_detail has hospital_linen_id column
const ensureCustomTableColumns = async () => {
  try {
    await ikmPool.query(`
      ALTER TABLE tr_custom_linen_transaction_detail 
      ADD COLUMN hospital_linen_id BIGINT UNSIGNED NULL AFTER transaction_id
    `);
  } catch (err) {
    // Ignore duplicate column error if it already exists
  }
};
ensureCustomTableColumns();

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
 * Get hospital linen items where category_id IN (32, 33) (Linen Custom / PxL / Gorden / Vitrase / Karpet)
 */
export const getHospitalLinenCustom = async (req, res) => {
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
      WHERE hl.hospital_id = ? AND hl.is_active = 1 AND l.category_id IN (32, 33)
      ORDER BY l.linen_name ASC
    `;

    const [linens] = await ikmPool.query(query, [hospitalId]);

    return res.status(200).json({
      success: true,
      data: linens
    });
  } catch (error) {
    console.error("Error getting custom hospital linen:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat master linen custom",
      error: error.message
    });
  }
};

/**
 * Get list of custom transactions (from tr_custom_linen_transaction)
 */
export const getCustomTransactions = async (req, res) => {
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
        (SELECT COUNT(*) FROM tr_custom_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_items,
        (SELECT COALESCE(SUM(qty_kotor), 0) FROM tr_custom_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_qty_kotor,
        (SELECT COALESCE(SUM(qty_bersih), 0) FROM tr_custom_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_qty_bersih
      FROM tr_custom_linen_transaction t
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

    const formattedTransactions = transactions.map(tx => ({
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
    console.error("Error getting custom transactions:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat riwayat transaksi custom",
      error: error.message
    });
  }
};

/**
 * Get detailed transaction items for custom items (from tr_custom_linen_transaction & tr_custom_linen_transaction_detail)
 */
export const getCustomTransactionDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [transactions] = await ikmPool.query(
      `SELECT t.*, h.hospital_name 
       FROM tr_custom_linen_transaction t
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
              hl.unit, hl.hospital_linen_name,
              s.size_name, c.color_name, m.material_name
       FROM tr_custom_linen_transaction_detail td
       LEFT JOIN mst_hospital_linen hl ON td.hospital_linen_id = hl.id
       LEFT JOIN mst_linen l ON hl.linen_id = l.id
       LEFT JOIN mst_size s ON l.size_id = s.id
       LEFT JOIN mst_color c ON l.color_id = c.id
       LEFT JOIN mst_material m ON l.material_id = m.id
       WHERE td.transaction_id = ?
       ORDER BY td.id ASC`,
      [id]
    );

    const transaction = transactions[0];
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
      `SELECT * FROM tr_custom_linen_transaction_audit 
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
        audits
      }
    });
  } catch (error) {
    console.error("Error getting custom transaction detail:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat rincian transaksi custom",
      error: error.message
    });
  }
};

/**
 * Create custom transaction into tr_custom_linen_transaction & tr_custom_linen_transaction_detail
 */
export const createCustomTransaction = async (req, res) => {
  const connection = await ikmPool.getConnection();
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
      // Temporary transaction update
      await connection.query(
        `UPDATE tr_custom_linen_transaction 
         SET user_pickup = ?, 
             hospital_staff_pickup = ?, 
             hospital_assistant_pickup = ?, 
             pickup_date = ?, 
             notes_pickup = ?
         WHERE id = ?`,
        [userPickup, hospitalStaffPickup ? toTitleCase(hospitalStaffPickup) : null, hospitalAssistantPickup ? toTitleCase(hospitalAssistantPickup) : null, pickupDate, notes || null, transactionId]
      );
      await connection.query(`DELETE FROM tr_custom_linen_transaction_detail WHERE transaction_id = ?`, [transactionId]);
    } else {
      const d = new Date(pickupDate);
      const yyyy = d.getFullYear();
      const yy = String(yyyy).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const ddmmyy = `${dd}${mm}${yy}`;

      const [countResult] = await connection.query(
        `SELECT COUNT(*) as cnt FROM tr_custom_linen_transaction WHERE hospital_id = ? AND DATE(pickup_date) = DATE(?)`,
        [hospitalId, pickupDate]
      );
      const nextSeq = (countResult?.[0]?.cnt || 0) + 1;

      const [hospitalRows] = await connection.query(
        `SELECT hospital_id FROM mst_hospital WHERE id = ?`,
        [hospitalId]
      );
      const hospitalCode = hospitalRows?.[0]?.hospital_id || hospitalId;
      formNumber = `${hospitalCode}-CUST-${ddmmyy}-${String(nextSeq).padStart(3, '0')}`;

      const [result] = await connection.query(
        `INSERT INTO tr_custom_linen_transaction 
         (form_number, hospital_id, user_pickup, hospital_staff_pickup, hospital_assistant_pickup, pickup_date, status, notes_pickup)
         VALUES (?, ?, ?, ?, ?, ?, 'PROSES', ?)`,
        [formNumber, hospitalId, userPickup, hospitalStaffPickup ? toTitleCase(hospitalStaffPickup) : null, hospitalAssistantPickup ? toTitleCase(hospitalAssistantPickup) : null, pickupDate, notes || null]
      );
      transactionId = result.insertId;
    }

    const valetPickupPath = saveBase64Image(signatureValetPickup, 'valet_pickup', transactionId);
    const hospitalPickupPath = saveBase64Image(signatureHospitalPickup, 'hospital_pickup', transactionId);
    const assistantPickupPath = signatureAssistantPickup ? saveBase64Image(signatureAssistantPickup, 'assistant_pickup', transactionId) : null;

    await connection.query(
      `UPDATE tr_custom_linen_transaction 
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
      const name = linenNameMap.get(item.hospitalLinenId) || item.itemName || 'Linen Custom';
      await connection.query(
        `INSERT INTO tr_custom_linen_transaction_detail 
         (transaction_id, hospital_linen_id, item_name, qty_kotor, qty_bersih, notes)
         VALUES (?, ?, ?, ?, NULL, ?)`,
        [transactionId, item.hospitalLinenId || null, name, parseInt(item.qtyKotor || 0), item.notes || null]
      );
    }

    const [newHeaderRows] = await connection.query(
      `SELECT * FROM tr_custom_linen_transaction WHERE id = ?`,
      [transactionId]
    );
    const newHeader = newHeaderRows[0];

    const [newDetails] = await connection.query(
      `SELECT * FROM tr_custom_linen_transaction_detail WHERE transaction_id = ?`,
      [transactionId]
    );

    const userId = req.user?.id || null;
    const username = req.user?.username || 'system';
    const fullName = req.user?.fullName || null;
    const role = req.user?.role || null;
    const action = (role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'superadmin' || role?.toLowerCase() === 'administrator') ? 'ADMIN' : 'PICKUP_KOTOR';

    await connection.query(
      `INSERT INTO tr_custom_linen_transaction_audit 
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

    const isTemporary = !signatureValetPickup || !signatureHospitalPickup;

    return res.status(201).json({
      success: true,
      message: isTemporary ? "Berhasil Tersimpan Sementara" : "Berhasil menyimpan serah terima kotor custom item",
      isTemporary,
      data: { transactionId, formNumber: formNumber || newHeader.form_number }
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating custom transaction:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal menyimpan serah terima kotor custom item",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Complete Delivery in tr_custom_linen_transaction & tr_custom_linen_transaction_detail
 */
export const updateCustomTransactionDelivery = async (req, res) => {
  const connection = await ikmPool.getConnection();
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
      `SELECT * FROM tr_custom_linen_transaction WHERE id = ?`,
      [id]
    );
    if (oldHeaderRows.length === 0) {
      return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan" });
    }
    const oldHeader = oldHeaderRows[0];

    const [oldDetails] = await connection.query(
      `SELECT * FROM tr_custom_linen_transaction_detail WHERE transaction_id = ?`,
      [id]
    );

    const valetDeliveryPath = saveBase64Image(signatureValetDelivery, 'valet_delivery', id);
    const hospitalDeliveryPath = saveBase64Image(signatureHospitalDelivery, 'hospital_delivery', id);
    const assistantDeliveryPath = signatureAssistantDelivery ? saveBase64Image(signatureAssistantDelivery, 'assistant_delivery', id) : null;

    const isTemporary = !signatureValetDelivery || !signatureHospitalDelivery;
    const newStatus = isTemporary ? 'PROSES' : 'SELESAI';
    const completedAtVal = isTemporary ? null : new Date();

    await connection.query(
      `UPDATE tr_custom_linen_transaction 
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
      `DELETE FROM tr_custom_linen_transaction_detail WHERE transaction_id = ?`,
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
      const name = linenNameMap.get(item.hospitalLinenId) || item.itemName || 'Linen Custom';
      const length = item.lengthCm ? parseFloat(item.lengthCm) : null;
      const width = item.widthCm ? parseFloat(item.widthCm) : null;
      let area = null;
      if (length && width) {
        area = (length > 10 && width > 10) ? (length * width) / 10000 : (length * width);
      }

      await connection.query(
        `INSERT INTO tr_custom_linen_transaction_detail 
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
      `SELECT * FROM tr_custom_linen_transaction WHERE id = ?`,
      [id]
    );
    const newHeader = newHeaderRows[0];

    const [newDetails] = await connection.query(
      `SELECT * FROM tr_custom_linen_transaction_detail WHERE transaction_id = ?`,
      [id]
    );

    const userId = req.user?.id || null;
    const username = req.user?.username || 'system';
    const fullName = req.user?.fullName || null;
    const role = req.user?.role || null;
    const action = (role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'superadmin' || role?.toLowerCase() === 'administrator') ? 'ADMIN' : 'DELIVERY_BERSIH';

    await connection.query(
      `INSERT INTO tr_custom_linen_transaction_audit 
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

    return res.status(200).json({
      success: true,
      message: isTemporary ? "Berhasil Tersimpan Sementara" : "Transaksi serah terima custom item bersih berhasil diselesaikan",
      isTemporary
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating custom transaction delivery:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal menyimpan pengiriman custom item bersih",
      error: error.message
    });
  } finally {
    connection.release();
  }
};
