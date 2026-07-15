import { ikmPool, mainPool } from '../../db/pool.js';

// Helper to format string to Capital Each Word (Title Case)
const toTitleCase = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
      query += ` AND (t.form_number LIKE ? OR t.recorder_name LIKE ? OR t.notes LIKE ?)`;
      const searchWildcard = `%${search}%`;
      params.push(searchWildcard, searchWildcard, searchWildcard);
    }

    query += ` ORDER BY t.pickup_date DESC, t.id DESC`;

    const [transactions] = await ikmPool.query(query, params);

    const formattedTransactions = transactions.map(tx => ({
      ...tx,
      recorder_name: toTitleCase(tx.recorder_name)
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
      transaction.recorder_name = toTitleCase(transaction.recorder_name);

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

    const { hospitalId, recorderName, pickupDate, notes, details } = req.body;

    if (!hospitalId || !recorderName || !pickupDate || !details || details.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Data form pengisian tidak lengkap"
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

    const formattedRecorderName = toTitleCase(recorderName);

    const [result] = await connection.query(
      `INSERT INTO tr_linen_transaction 
       (form_number, hospital_id, recorder_name, pickup_date, status, notes)
       VALUES (?, ?, ?, ?, 'PROSES', ?)`,
      [formNumber, hospitalId, formattedRecorderName, pickupDate, notes || null]
    );

    const transactionId = result.insertId;

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
    const { deliveryDate, recorderName, notes, details } = req.body;

    if (!deliveryDate || !details || details.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Tanggal pengiriman dan rincian bersih wajib diisi"
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

    // Update Header
    const formattedRecorderName = recorderName ? toTitleCase(recorderName) : null;
    await connection.query(
      `UPDATE tr_linen_transaction 
       SET delivery_date = ?, 
           completed_at = ?,
           recorder_name = COALESCE(?, recorder_name), 
           notes = COALESCE(?, notes), 
           status = 'SELESAI'
       WHERE id = ?`,
      [deliveryDate, completedAt, formattedRecorderName, notes || null, id]
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
