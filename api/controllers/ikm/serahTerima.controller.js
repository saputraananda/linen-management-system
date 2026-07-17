import { ikmPool, mainPool } from '../../db/pool.js';
import fs from 'fs';
import path from 'path';

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

// Helper to get the public URL/path of a signature image
const getSignatureUrl = (filename) => {
  if (!filename) return null;

  // Normalize legacy full-path data:
  // Old records stored `/storage/serahterimalinen/file.png` which now 422s because
  // the actual server folder is /storage/assets/ → accessible at /assets/
  if (filename.startsWith('/storage/serahterimalinen/')) {
    return filename.replace('/storage/serahterimalinen/', '/assets/serahterimalinen/');
  }

  // If it's already a correct /assets/ path, return it directly
  if (filename.startsWith('/assets/')) {
    return filename;
  }

  // For plain filenames, build the URL prefix from UPLOAD_DIR
  const uploadBaseDir = process.env.UPLOAD_DIR || 'assets/serahterimalinen';
  const isAbsolute = path.isAbsolute(uploadBaseDir);

  if (isAbsolute) {
    // If UPLOAD_DIR points to .../storage/assets/... → serve via /assets/
    if (uploadBaseDir.includes('/assets/')) {
      return `/assets/serahterimalinen/${filename}`;
    }
    return `/storage/serahterimalinen/${filename}`;
  } else {
    return `/assets/serahterimalinen/${filename}`;
  }
};

// Helper function to decode and save Base64 image
const saveBase64Image = (base64Str, prefix, transactionId) => {
  if (!base64Str) return null;
  
  // If it's already a saved URL/path, extract and return the filename
  if (base64Str.startsWith('/assets/') || base64Str.startsWith('/storage/')) {
    return path.basename(base64Str);
  }
  
  // If it's just the filename already, return it directly
  if (base64Str.includes('_') && base64Str.endsWith('.png') && !base64Str.includes('/')) {
    return base64Str;
  }
  
  // Resolve UPLOAD_DIR
  const uploadBaseDir = process.env.UPLOAD_DIR || 'assets/serahterimalinen';
  let targetDir;
  let isAbsolute = path.isAbsolute(uploadBaseDir);
  
  if (isAbsolute) {
    targetDir = path.join(uploadBaseDir, 'serahterimalinen');
  } else {
    // Relative to the workspace root (process.cwd())
    targetDir = path.resolve(process.cwd(), uploadBaseDir);
  }
  
  // Create directory recursively if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Parse base64 string
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let imageBuffer;
  let extension = 'png'; // default
  
  if (matches && matches.length === 3) {
    const type = matches[1];
    extension = type.split('/')[1] || 'png';
    imageBuffer = Buffer.from(matches[2], 'base64');
  } else {
    // Raw base64 string
    imageBuffer = Buffer.from(base64Str, 'base64');
  }
  
  const filename = `${prefix}_${transactionId}_${Date.now()}.${extension}`;
  const filepath = path.join(targetDir, filename);
  
  fs.writeFileSync(filepath, imageBuffer);
  
  // Return only the filename instead of the full path
  return filename;
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

    let query = `
      SELECT t.*, h.hospital_name,
        (SELECT COUNT(*) FROM tr_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_items,
        (SELECT COALESCE(SUM(qty_kotor), 0) FROM tr_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_qty_kotor,
        (SELECT COALESCE(SUM(qty_bersih), 0) FROM tr_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_qty_bersih
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

    query += ` ORDER BY t.pickup_date DESC, t.id DESC`;

    const [transactions] = await ikmPool.query(query, params);

    // Fetch employee name lookup
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
      `SELECT t.*, h.hospital_name 
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
              l.linen_name, l.linen_code,
              hl.unit, hl.hospital_linen_name,
              s.size_name, c.color_name, m.material_name
       FROM tr_linen_transaction_detail td
       INNER JOIN mst_hospital_linen hl ON td.hospital_linen_id = hl.id
       INNER JOIN mst_linen l ON hl.linen_id = l.id
       LEFT JOIN mst_size s ON l.size_id = s.id
       LEFT JOIN mst_color c ON l.color_id = c.id
       LEFT JOIN mst_material m ON l.material_id = m.id
       WHERE td.transaction_id = ?
       ORDER BY l.linen_name ASC`,
      [id]
    );

    const transaction = transactions[0];
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

    return res.status(200).json({
      success: true,
      data: {
        transaction,
        details,
        audits
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
 * Day 1: Create transaction (Pickup - Kotor)
 */
export const createTransaction = async (req, res) => {
  const connection = await ikmPool.getConnection();
  try {
    await connection.beginTransaction();

    const { 
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

    if (!hospitalId || !userPickup || !hospitalStaffPickup || !pickupDate || !signatureValetPickup || !signatureHospitalPickup || !details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Data form pengisian tidak lengkap (termasuk Petugas RS dan Tanda Tangan)"
      });
    }

    // Generate form number: {hospitalCode}-{yyyymmdd}-{0001} (sequential per hospital+day)
    const d = new Date(pickupDate);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyymmdd = `${yyyy}${mm}${dd}`;

    const [countResult] = await connection.query(
      `SELECT COUNT(*) as cnt FROM tr_linen_transaction
       WHERE hospital_id = ? AND DATE(pickup_date) = DATE(?)`,
      [hospitalId, pickupDate]
    );
    const nextSeq = (countResult?.[0]?.cnt || 0) + 1;

    // Get the hospital_id code from mst_hospital
    const [hospitalRows] = await connection.query(
      `SELECT hospital_id FROM mst_hospital WHERE id = ?`,
      [hospitalId]
    );
    const hospitalCode = hospitalRows?.[0]?.hospital_id || hospitalId;
    const formNumber = `${hospitalCode}-${yyyymmdd}-${String(nextSeq).padStart(3, '0')}`;

    const [result] = await connection.query(
      `INSERT INTO tr_linen_transaction 
       (form_number, hospital_id, user_pickup, hospital_staff_pickup, hospital_assistant_pickup, pickup_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'PROSES', ?)`,
      [formNumber, hospitalId, userPickup, toTitleCase(hospitalStaffPickup), hospitalAssistantPickup ? toTitleCase(hospitalAssistantPickup) : null, pickupDate, notes || null]
    );

    const transactionId = result.insertId;

    // Decode and save signature images
    const valetPickupPath = saveBase64Image(signatureValetPickup, 'valet_pickup', transactionId);
    const hospitalPickupPath = saveBase64Image(signatureHospitalPickup, 'hospital_pickup', transactionId);
    const assistantPickupPath = signatureAssistantPickup ? saveBase64Image(signatureAssistantPickup, 'assistant_pickup', transactionId) : null;

    if (valetPickupPath || hospitalPickupPath || assistantPickupPath) {
      await connection.query(
        `UPDATE tr_linen_transaction 
         SET signature_valet_pickup = ?, signature_hospital_pickup = ?, signature_assistant_pickup = ?
         WHERE id = ?`,
        [valetPickupPath, hospitalPickupPath, assistantPickupPath, transactionId]
      );
    }

    for (const item of details) {
      await connection.query(
        `INSERT INTO tr_linen_transaction_detail 
         (transaction_id, hospital_linen_id, qty_kotor, qty_bersih, notes)
         VALUES (?, ?, ?, NULL, ?)`,
        [transactionId, item.hospitalLinenId, parseInt(item.qtyKotor || 0), item.notes || null]
      );
    }

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
      transaction: newHeader,
      details: newDetails
    };

    // User details from token middleware (req.user)
    const userId = req.user?.id || null;
    const username = req.user?.username || 'system';
    const fullName = req.user?.fullName || null;
    const role = req.user?.role || null;

    await connection.query(
      `INSERT INTO tr_linen_transaction_audit 
       (transaction_id, action, user_id, username, full_name, role, old_values, new_values)
       VALUES (?, 'CREATE', ?, ?, ?, ?, NULL, ?)`,
      [
        transactionId,
        userId,
        username,
        fullName,
        role,
        JSON.stringify(newSnapshot)
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Transaksi serah terima linen (Kotor) berhasil dicatat",
      data: { transactionId, formNumber }
    });
  } catch (error) {
    await connection.rollback();
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
      signatureAssistantDelivery
    } = req.body;

    if (!deliveryDate || !userDelivery || !hospitalStaffDelivery || !signatureValetDelivery || !signatureHospitalDelivery || !details || details.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Tanggal pengiriman, petugas pengirim, petugas RS pemeriksa, tanda tangan delivery, dan rincian bersih wajib diisi"
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

    const oldHeader = oldHeaderRows[0];

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

    // Determine completed_at (set to now if transitioning from PROSES to SELESAI)
    let completedAt = oldHeader.completed_at;
    if (oldHeader.status === 'PROSES') {
      completedAt = new Date();
    }

    // Decode and save delivery signatures
    const valetPickupPath = saveBase64Image(signatureValetPickup, 'valet_pickup', id);
    const hospitalPickupPath = saveBase64Image(signatureHospitalPickup, 'hospital_pickup', id);
    const assistantPickupPath = signatureAssistantPickup ? saveBase64Image(signatureAssistantPickup, 'assistant_pickup', id) : null;
    const valetDeliveryPath = saveBase64Image(signatureValetDelivery, 'valet_delivery', id);
    const hospitalDeliveryPath = saveBase64Image(signatureHospitalDelivery, 'hospital_delivery', id);
    const assistantDeliveryPath = signatureAssistantDelivery ? saveBase64Image(signatureAssistantDelivery, 'assistant_delivery', id) : null;

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
           notes = COALESCE(?, notes), 
           status = 'SELESAI'
       WHERE id = ?`,
      [
        deliveryDate, 
        completedAt, 
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
        id
      ]
    );

    // Update Details (support updating both qty_kotor and qty_bersih)
    for (const item of details) {
      await connection.query(
        `UPDATE tr_linen_transaction_detail 
         SET qty_kotor = ?, 
             qty_bersih = ?, 
             notes = ?
         WHERE id = ? AND transaction_id = ?`,
        [
          parseInt(item.qtyKotor !== undefined ? item.qtyKotor : 0),
          item.qtyBersih !== null && item.qtyBersih !== undefined ? parseInt(item.qtyBersih) : null,
          item.notes || null,
          item.id,
          id
        ]
      );
    }

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
      transaction: oldHeader,
      details: oldDetails
    };
    const newSnapshot = {
      transaction: newHeader,
      details: newDetails
    };

    // User details from token middleware (req.user)
    const userId = req.user?.id || null;
    const username = req.user?.username || 'system';
    const fullName = req.user?.fullName || null;
    const role = req.user?.role || null;

    await connection.query(
      `INSERT INTO tr_linen_transaction_audit 
       (transaction_id, action, user_id, username, full_name, role, old_values, new_values)
       VALUES (?, 'UPDATE', ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        username,
        fullName,
        role,
        JSON.stringify(oldSnapshot),
        JSON.stringify(newSnapshot)
      ]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Transaksi serah terima linen berhasil diperbarui"
    });
  } catch (error) {
    await connection.rollback();
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
