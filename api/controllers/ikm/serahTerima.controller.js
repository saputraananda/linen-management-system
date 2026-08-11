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
              hl.stock_in_rs,
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

    let transactionId = id;
    let formNumber;

    if (transactionId) {
      // Check existing
      const [oldTxRows] = await connection.query(
        `SELECT form_number, status FROM tr_linen_transaction WHERE id = ?`,
        [transactionId]
      );
      if (oldTxRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan" });
      }
      if (oldTxRows[0].status === 'SELESAI') {
        await connection.rollback();
        return res.status(400).json({ success: false, message: "Transaksi yang sudah selesai tidak dapat diubah dari form pengambilan" });
      }
      formNumber = oldTxRows[0].form_number;

      // Update Header
      await connection.query(
        `UPDATE tr_linen_transaction 
         SET user_pickup = ?, 
             hospital_staff_pickup = ?, 
             hospital_assistant_pickup = ?, 
             pickup_date = ?, 
             notes_pickup = ?
         WHERE id = ?`,
        [
          userPickup, 
          hospitalStaffPickup ? toTitleCase(hospitalStaffPickup) : null, 
          hospitalAssistantPickup ? toTitleCase(hospitalAssistantPickup) : null, 
          pickupDate, 
          notes || null,
          transactionId
        ]
      );

      // Delete existing details so we can re-insert
      await connection.query(
        `DELETE FROM tr_linen_transaction_detail WHERE transaction_id = ?`,
        [transactionId]
      );
    } else {
      // Generate form number: {hospitalCode}-{ddmmyy}-{001} (sequential per hospital+day)
      const d = new Date(pickupDate);
      const yyyy = d.getFullYear();
      const yy = String(yyyy).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const ddmmyy = `${dd}${mm}${yy}`;

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
      formNumber = `${hospitalCode}-${ddmmyy}-${String(nextSeq).padStart(3, '0')}`;

      const [result] = await connection.query(
        `INSERT INTO tr_linen_transaction 
         (form_number, hospital_id, user_pickup, hospital_staff_pickup, hospital_assistant_pickup, pickup_date, status, notes_pickup)
         VALUES (?, ?, ?, ?, ?, ?, 'PROSES', ?)`,
        [formNumber, hospitalId, userPickup, hospitalStaffPickup ? toTitleCase(hospitalStaffPickup) : null, hospitalAssistantPickup ? toTitleCase(hospitalAssistantPickup) : null, formatMySQLDateTime(pickupDate), notes || null]
      );

      transactionId = result.insertId;
    }

    // Decode and save signature images
    const valetPickupPath = saveBase64Image(signatureValetPickup, 'valet_pickup', transactionId);
    const hospitalPickupPath = saveBase64Image(signatureHospitalPickup, 'hospital_pickup', transactionId);
    const assistantPickupPath = signatureAssistantPickup ? saveBase64Image(signatureAssistantPickup, 'assistant_pickup', transactionId) : null;

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

    for (const item of details) {
      await connection.query(
        `INSERT INTO tr_linen_transaction_detail 
         (transaction_id, hospital_linen_id, room_id, qty_kotor, qty_bersih, notes)
         VALUES (?, ?, ?, ?, NULL, ?)`,
        [transactionId, item.hospitalLinenId, item.roomId || null, parseInt(item.qtyKotor || 0), item.notes || null]
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

    // Emit real-time socket.io event
    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}`).emit('data_changed', {
        type: 'TRANSACTION_PICKUP',
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

    const status = isTemporary ? 'PROSES' : 'SELESAI';
    const completedAtValue = isTemporary ? null : completedAt;

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
           status = ?
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
        id
      ]
    );

    // Query for any special unit/transit room in this hospital
    let specialRoomId = null;
    if (!isTemporary) {
      const [specialRooms] = await connection.query(
        "SELECT id FROM mst_rooms_rs WHERE hospital_id = ? AND is_special_unit = 1 LIMIT 1",
        [oldHeader.hospital_id]
      );
      if (specialRooms.length > 0) {
        specialRoomId = specialRooms[0].id;
      }
    }

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

      // Mutate room stocks if final save (status === 'SELESAI')
      if (!isTemporary && item.qtyBersih !== null && item.qtyBersih !== undefined) {
        const qtyCleaned = parseInt(item.qtyBersih || 0);
        if (qtyCleaned > 0) {
          // Get hospital_linen_id and room_id from detail record
          const [detailRows] = await connection.query(
            "SELECT hospital_linen_id, room_id FROM tr_linen_transaction_detail WHERE id = ?",
            [item.id]
          );

          if (detailRows.length > 0) {
            const { hospital_linen_id, room_id } = detailRows[0];

            if (room_id) {
              // 1. Clear dirty utility in originating unit
              await connection.query(
                `UPDATE mst_hospital_linen_rooms 
                 SET qty_dirty = IF(qty_dirty >= ?, qty_dirty - ?, 0) 
                 WHERE hospital_linen_id = ? AND room_id = ?`,
                [qtyCleaned, qtyCleaned, hospital_linen_id, room_id]
              );

              // 2. Route clean stock
              if (specialRoomId && specialRoomId !== room_id) {
                // If there's a special unit, decrease allocated stock in unit
                await connection.query(
                  `UPDATE mst_hospital_linen_rooms 
                   SET stock_in_rs = IF(stock_in_rs >= ?, stock_in_rs - ?, 0) 
                   WHERE hospital_linen_id = ? AND room_id = ?`,
                  [qtyCleaned, qtyCleaned, hospital_linen_id, room_id]
                );

                // And increase stock in special unit (transit room)
                await connection.query(
                  `INSERT INTO mst_hospital_linen_rooms (hospital_linen_id, room_id, stock_in_rs, qty_terpakai, qty_dirty) 
                   VALUES (?, ?, ?, 0, 0) 
                   ON DUPLICATE KEY UPDATE stock_in_rs = stock_in_rs + VALUES(stock_in_rs)`,
                  [hospital_linen_id, specialRoomId, qtyCleaned]
                );
              }
            }
          }
        }
      }
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

    const hospitalId = oldHeader.hospital_id;

    // Emit real-time socket.io event
    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}`).emit('data_changed', {
        type: 'TRANSACTION_DELIVERY',
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
