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

/**
 * Get completed transactions with remaining shortages
 */
export const getShortageTransactions = async (req, res) => {
    try {
        const { hospitalId } = req.query;

        if (!hospitalId) {
            return res.status(400).json({
                success: false,
                message: "ID Rumah Sakit wajib disertakan"
            });
        }

        // We check for details where qty_kotor > qty_bersih
        const query = `
      SELECT t.*, h.hospital_name,
        (
          SELECT COUNT(*) 
          FROM tr_linen_transaction_detail td
          WHERE td.transaction_id = t.id 
            AND td.qty_kotor > COALESCE(td.qty_bersih, 0)
        ) AS shortage_items_count,
        (
          SELECT COALESCE(SUM(
            td.qty_kotor - COALESCE(td.qty_bersih, 0)
          ), 0)
          FROM tr_linen_transaction_detail td
          WHERE td.transaction_id = t.id 
            AND td.qty_kotor > COALESCE(td.qty_bersih, 0)
        ) AS total_shortage_qty
      FROM tr_linen_transaction t
      INNER JOIN mst_hospital h ON t.hospital_id = h.id
      WHERE t.hospital_id = ? AND t.status = 'SELESAI'
      HAVING shortage_items_count > 0
      ORDER BY t.pickup_date DESC, t.id DESC
    `;

        const [transactions] = await ikmPool.query(query, [hospitalId]);

        // Fetch employee name lookup
        const [employees] = await mainPool.query(
            `SELECT employee_id, full_name as employee_name FROM mst_employee`
        );
        const empMap = new Map(employees.map(emp => [emp.employee_id, emp.employee_name]));

        const formatted = transactions.map(tx => ({
            ...tx,
            user_pickup_name: toTitleCase(empMap.get(tx.user_pickup) || ''),
            user_delivery_name: tx.user_delivery ? toTitleCase(empMap.get(tx.user_delivery) || '') : null
        }));

        return res.status(200).json({
            success: true,
            data: formatted
        });
    } catch (error) {
        console.error("Error getting shortage transactions:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal memuat daftar kurang kirim",
            error: error.message
        });
    }
};

/**
 * Get shortage details of a transaction
 */
export const getShortageTransactionDetails = async (req, res) => {
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
              hl.unit, hl.hospital_linen_name, hl.grammage,
              s.size_name, c.color_name, m.material_name,
              COALESCE((
                SELECT SUM(dd.qty_delivered) 
                FROM tr_kurang_kirim_delivery_detail dd
                INNER JOIN tr_kurang_kirim_delivery d ON dd.delivery_id = d.id
                WHERE d.transaction_id = td.transaction_id AND dd.hospital_linen_id = td.hospital_linen_id
              ), 0) AS qty_delivered_so_far
       FROM tr_linen_transaction_detail td
       INNER JOIN mst_hospital_linen hl ON td.hospital_linen_id = hl.id
       INNER JOIN mst_linen l ON hl.linen_id = l.id
       LEFT JOIN mst_size s ON l.size_id = s.id
       LEFT JOIN mst_color c ON l.color_id = c.id
       LEFT JOIN mst_material m ON l.material_id = m.id
       WHERE td.transaction_id = ?
         AND td.qty_kotor > COALESCE(td.qty_bersih, 0)
       ORDER BY l.linen_name ASC`,
            [id]
        );

        const transaction = transactions[0];
        const [employees] = await mainPool.query(
            `SELECT employee_id, full_name as employee_name 
       FROM mst_employee 
       WHERE employee_id IN (?, ?)`,
            [transaction.user_pickup, transaction.user_delivery || 0]
        );
        const empMap = new Map(employees.map(emp => [emp.employee_id, emp.employee_name]));

        transaction.user_pickup_name = toTitleCase(empMap.get(transaction.user_pickup) || '');
        transaction.user_delivery_name = transaction.user_delivery ? toTitleCase(empMap.get(transaction.user_delivery) || '') : null;

        // Filter details that still have remaining shortage > 0
        const filteredDetails = details.map(item => {
            const remainingShortage = Math.max(0, item.qty_kotor - (item.qty_bersih || 0));
            const initialShortage = remainingShortage + item.qty_delivered_so_far;
            return {
                ...item,
                initial_shortage: initialShortage,
                remaining_shortage: remainingShortage
            };
        }).filter(item => item.remaining_shortage > 0);

        return res.status(200).json({
            success: true,
            data: {
                transaction,
                details: filteredDetails
            }
        });
    } catch (error) {
        console.error("Error getting shortage details:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal memuat rincian kurang kirim",
            error: error.message
        });
    }
};

/**
 * Create delivery of shortage items (Surat Jalan Kurang Kirim)
 */
export const createShortageDelivery = async (req, res) => {
    const connection = await ikmPool.getConnection();
    try {
        await connection.beginTransaction();

        const {
            transactionId,
            deliveryDate,
            vehicleNumber,
            recipientName,
            hospitalStaff,
            valetId,
            signatureValet,
            signatureHospital,
            details
        } = req.body;

        if (!transactionId || !deliveryDate || !recipientName || !hospitalStaff || !valetId || !signatureValet || !signatureHospital || !details || details.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Data pengiriman tidak lengkap (termasuk tanda tangan digital dan petugas RS)"
            });
        }

        // Capture old state for audit logging
        const [oldHeaderRows] = await connection.query(
            `SELECT * FROM tr_linen_transaction WHERE id = ?`,
            [transactionId]
        );
        const oldHeader = oldHeaderRows[0];
        const [oldDetails] = await connection.query(
            `SELECT * FROM tr_linen_transaction_detail WHERE transaction_id = ?`,
            [transactionId]
        );
        const oldSnapshot = {
            transaction: oldHeader,
            details: oldDetails
        };

        // Generate Surat Jalan number: SJKK/ddmmyy/0001
        const d = new Date(deliveryDate);
        const yyyy = d.getFullYear();
        const yy = String(yyyy).slice(-2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const ddmmyy = `${dd}${mm}${yy}`;

        const [countResult] = await connection.query(
            `SELECT COUNT(*) as cnt FROM tr_kurang_kirim_delivery
       WHERE DATE(delivery_date) = DATE(?)`,
            [deliveryDate]
        );
        const nextSeq = (countResult?.[0]?.cnt || 0) + 1;
        const sjNumber = `SJKK/${ddmmyy}/${String(nextSeq).padStart(4, '0')}`;

        // Insert into tr_kurang_kirim_delivery
        const [result] = await connection.query(
            `INSERT INTO tr_kurang_kirim_delivery 
       (transaction_id, surat_jalan_number, delivery_date, vehicle_number, recipient_name, hospital_staff, valet_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [transactionId, sjNumber, deliveryDate, vehicleNumber || null, recipientName, toTitleCase(hospitalStaff), valetId]
        );

        const deliveryId = result.insertId;

        const signatureValetPath = saveBase64Image(signatureValet, 'kk_valet', deliveryId);
        const signatureHospitalPath = saveBase64Image(signatureHospital, 'kk_hospital', deliveryId);

        await connection.query(
            `UPDATE tr_kurang_kirim_delivery
       SET signature_valet = ?, signature_hospital = ?
       WHERE id = ?`,
            [signatureValetPath, signatureHospitalPath, deliveryId]
        );

        // Save details
        for (const item of details) {
            if (!item.qtyDelivered || parseInt(item.qtyDelivered) <= 0) continue;

            // Get grammage
            const [hlRows] = await connection.query(
                `SELECT grammage FROM mst_hospital_linen WHERE id = ?`,
                [item.hospitalLinenId]
            );
            const grammage = hlRows?.[0]?.grammage || 0;
            const totalWeight = parseFloat(grammage) * parseInt(item.qtyDelivered);

            await connection.query(
                `INSERT INTO tr_kurang_kirim_delivery_detail
          (delivery_id, hospital_linen_id, qty_delivered, grammage, total_weight, notes)
          VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    deliveryId,
                    item.hospitalLinenId,
                    parseInt(item.qtyDelivered),
                    grammage,
                    totalWeight,
                    item.notes || null
                ]
            );

            // Update tr_linen_transaction_detail to add the delivered quantity to qty_bersih
            await connection.query(
                `UPDATE tr_linen_transaction_detail
                 SET qty_bersih = COALESCE(qty_bersih, 0) + ?
                 WHERE transaction_id = ? AND hospital_linen_id = ?`,
                [
                    parseInt(item.qtyDelivered),
                    transactionId,
                    item.hospitalLinenId
                ]
            );
        }

        // Capture new state for audit logging
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
             VALUES (?, 'KURANG_KIRIM', ?, ?, ?, ?, ?, ?)`,
            [
                transactionId,
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
            message: "Surat Jalan Kurang Kirim berhasil diterbitkan",
            data: {
                deliveryId,
                suratJalanNumber: sjNumber
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error("Error creating shortage delivery:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal menerbitkan Surat Jalan Kurang Kirim",
            error: error.message
        });
    } finally {
        connection.release();
    }
};

/**
 * Get all shortage deliveries for a hospital
 */
export const getShortageDeliveries = async (req, res) => {
    try {
        const { hospitalId } = req.query;

        if (!hospitalId) {
            return res.status(400).json({
                success: false,
                message: "ID Rumah Sakit wajib disertakan"
            });
        }

        const query = `
      SELECT d.*, t.form_number as original_form_number, t.pickup_date as original_pickup_date, h.hospital_name,
        (SELECT SUM(dd.qty_delivered) FROM tr_kurang_kirim_delivery_detail dd WHERE dd.delivery_id = d.id) as total_qty_delivered
      FROM tr_kurang_kirim_delivery d
      INNER JOIN tr_linen_transaction t ON d.transaction_id = t.id
      INNER JOIN mst_hospital h ON t.hospital_id = h.id
      WHERE t.hospital_id = ?
      ORDER BY d.delivery_date DESC, d.id DESC
    `;

        const [deliveries] = await ikmPool.query(query, [hospitalId]);

        const [employees] = await mainPool.query(
            `SELECT employee_id, full_name as employee_name FROM mst_employee`
        );
        const empMap = new Map(employees.map(emp => [emp.employee_id, emp.employee_name]));

        const formatted = deliveries.map(d => ({
            ...d,
            valet_name: toTitleCase(empMap.get(d.valet_id) || ''),
            signature_valet: getSignatureUrl(d.signature_valet),
            signature_hospital: getSignatureUrl(d.signature_hospital)
        }));

        return res.status(200).json({
            success: true,
            data: formatted
        });
    } catch (error) {
        console.error("Error getting shortage deliveries:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal memuat riwayat Surat Jalan Kurang Kirim",
            error: error.message
        });
    }
};

/**
 * Get details of a single shortage delivery (Surat Jalan)
 */
export const getShortageDeliveryDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const queryHeader = `
      SELECT d.*, t.form_number as original_form_number, t.pickup_date as original_pickup_date, h.hospital_name, h.address as hospital_address
      FROM tr_kurang_kirim_delivery d
      INNER JOIN tr_linen_transaction t ON d.transaction_id = t.id
      INNER JOIN mst_hospital h ON t.hospital_id = h.id
      WHERE d.id = ?
    `;

        const [headers] = await ikmPool.query(queryHeader, [id]);

        if (headers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Surat Jalan tidak ditemukan"
            });
        }

        const header = headers[0];

        const [details] = await ikmPool.query(
            `SELECT dd.*, 
              l.linen_name, l.linen_code,
              hl.unit, hl.hospital_linen_name, hl.grammage,
              s.size_name, c.color_name, m.material_name
       FROM tr_kurang_kirim_delivery_detail dd
       INNER JOIN mst_hospital_linen hl ON dd.hospital_linen_id = hl.id
       INNER JOIN mst_linen l ON hl.linen_id = l.id
       LEFT JOIN mst_size s ON l.size_id = s.id
       LEFT JOIN mst_color c ON l.color_id = c.id
       LEFT JOIN mst_material m ON l.material_id = m.id
       WHERE dd.delivery_id = ?
       ORDER BY l.linen_name ASC`,
            [id]
        );

        const [employees] = await mainPool.query(
            `SELECT employee_id, full_name as employee_name FROM mst_employee WHERE employee_id = ?`,
            [header.valet_id]
        );
        header.valet_name = toTitleCase(employees?.[0]?.employee_name || '');
        header.signature_valet = getSignatureUrl(header.signature_valet);
        header.signature_hospital = getSignatureUrl(header.signature_hospital);

        return res.status(200).json({
            success: true,
            data: {
                delivery: header,
                details
            }
        });
    } catch (error) {
        console.error("Error getting shortage delivery details:", error);
        return res.status(500).json({
            success: false,
            message: "Gagal memuat rincian Surat Jalan",
            error: error.message
        });
    }
};
