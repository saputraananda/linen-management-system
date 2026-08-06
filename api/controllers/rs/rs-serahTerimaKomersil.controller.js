import { ikmPool, mainPool } from '../../db/pool.js';
import { getSignatureUrl } from '../../middleware/upload.js';

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
 * Get list of completed and in-progress komersil transactions for this hospital
 */
export const getRSKomersilTransactions = async (req, res) => {
  try {
    const hospitalId = req.user.id;
    const { startDate, endDate, status, search } = req.query;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "ID Rumah Sakit tidak valid"
      });
    }

    // Lookup employee IDs if search query is provided
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
        (SELECT COALESCE(SUM(qty_bersih), 0) FROM tr_komersil_linen_transaction_detail d WHERE d.transaction_id = t.id) as total_qty_bersih
      FROM tr_komersil_linen_transaction t
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
    console.error("Error getting RS komersil transactions:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat riwayat transaksi khusus",
      error: error.message
    });
  }
};

/**
 * Get detailed komersil transaction items, audits, and shortage deliveries (Surat Jalan)
 */
export const getRSKomersilTransactionDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const hospitalId = req.user.id;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "ID Rumah Sakit tidak valid"
      });
    }

    // Fetch transaction header, making sure it belongs to the authenticated hospital
    const [transactions] = await ikmPool.query(
      `SELECT t.*, h.hospital_name 
       FROM tr_komersil_linen_transaction t
       INNER JOIN mst_hospital h ON t.hospital_id = h.id
       WHERE t.id = ? AND t.hospital_id = ?`,
      [id, hospitalId]
    );

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transaksi tidak ditemukan"
      });
    }

    const transaction = transactions[0];

    const [details] = await ikmPool.query(
      `SELECT td.*,
              COALESCE(td.item_name, hl.hospital_linen_name, l.linen_name) as linen_name,
              l.linen_code,
              hl.unit, hl.hospital_linen_name,
              s.size_name, c.color_name, m.material_name
       FROM tr_komersil_linen_transaction_detail td
       LEFT JOIN mst_hospital_linen hl ON td.hospital_linen_id = hl.id
       LEFT JOIN mst_linen l ON hl.linen_id = l.id
       LEFT JOIN mst_size s ON l.size_id = s.id
       LEFT JOIN mst_color c ON l.color_id = c.id
       LEFT JOIN mst_material m ON l.material_id = m.id
       WHERE td.transaction_id = ?
       ORDER BY td.id ASC`,
      [id]
    );

    // Fetch employee names
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

    // Fetch audits
    const [audits] = await ikmPool.query(
      `SELECT * FROM tr_komersil_linen_transaction_audit 
       WHERE transaction_id = ? 
       ORDER BY created_at ASC`,
      [id]
    );

    const auditUserIds = audits.map(a => a.user_id).filter(uid => uid !== null && uid !== undefined);
    if (auditUserIds.length > 0) {
      const [auditEmployees] = await mainPool.query(
        `SELECT employee_id, full_name as employee_name 
         FROM mst_employee 
         WHERE employee_id IN (?)`,
        [auditUserIds]
      );
      const auditEmpMap = new Map(auditEmployees.map(emp => [emp.employee_id, emp.employee_name]));
      audits.forEach(a => {
        if (a.user_id && auditEmpMap.has(a.user_id)) {
          a.full_name = toTitleCase(auditEmpMap.get(a.user_id));
        }
      });
    }

    // Fetch historical shortage deliveries (Surat Jalan Kurang Kirim Komersil)
    const queryDeliveries = `
      SELECT d.*, 
        (SELECT SUM(dd.qty_delivered) FROM tr_komersil_kurang_kirim_delivery_detail dd WHERE dd.delivery_id = d.id) as total_qty_delivered
      FROM tr_komersil_kurang_kirim_delivery d
      WHERE d.transaction_id = ?
      ORDER BY d.delivery_date DESC, d.id DESC
    `;
    const [deliveries] = await ikmPool.query(queryDeliveries, [id]);

    // Format valet name for deliveries
    const [allEmployees] = await mainPool.query(
      `SELECT employee_id, full_name as employee_name FROM mst_employee`
    );
    const allEmpMap = new Map(allEmployees.map(emp => [emp.employee_id, emp.employee_name]));

    const formattedDeliveries = deliveries.map(d => ({
      ...d,
      valet_name: toTitleCase(allEmpMap.get(d.valet_id) || ''),
      signature_valet: getSignatureUrl(d.signature_valet),
      signature_hospital: getSignatureUrl(d.signature_hospital)
    }));

    return res.status(200).json({
      success: true,
      data: {
        transaction,
        details,
        audits,
        deliveries: formattedDeliveries
      }
    });
  } catch (error) {
    console.error("Error getting RS komersil transaction detail:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat rincian transaksi khusus",
      error: error.message
    });
  }
};

/**
 * Get details of a single komersil shortage delivery (Surat Jalan Komersil) for hospital view
 */
export const getRSKomersilShortageDeliveryDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const hospitalId = req.user.id;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "ID Rumah Sakit tidak valid"
      });
    }

    const queryHeader = `
      SELECT d.*, t.form_number as original_form_number, t.pickup_date as original_pickup_date, h.hospital_name, h.address as hospital_address
      FROM tr_komersil_kurang_kirim_delivery d
      INNER JOIN tr_komersil_linen_transaction t ON d.transaction_id = t.id
      INNER JOIN mst_hospital h ON t.hospital_id = h.id
      WHERE d.id = ? AND t.hospital_id = ?
    `;

    const [headers] = await ikmPool.query(queryHeader, [id, hospitalId]);

    if (headers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Surat Jalan tidak ditemukan"
      });
    }

    const header = headers[0];

    const [details] = await ikmPool.query(
      `SELECT dd.*, 
              COALESCE(td.item_name, hl.hospital_linen_name, l.linen_name) as linen_name,
              l.linen_code,
              hl.unit, hl.hospital_linen_name, hl.grammage,
              s.size_name, c.color_name, m.material_name
       FROM tr_komersil_kurang_kirim_delivery_detail dd
       INNER JOIN tr_komersil_linen_transaction_detail td ON dd.komersil_detail_id = td.id
       LEFT JOIN mst_hospital_linen hl ON td.hospital_linen_id = hl.id
       LEFT JOIN mst_linen l ON hl.linen_id = l.id
       LEFT JOIN mst_size s ON l.size_id = s.id
       LEFT JOIN mst_color c ON l.color_id = c.id
       LEFT JOIN mst_material m ON l.material_id = m.id
       WHERE dd.delivery_id = ?
       ORDER BY td.id ASC`,
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
    console.error("Error getting RS komersil shortage delivery details:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat rincian Surat Jalan khusus",
      error: error.message
    });
  }
};
