import { ikmPool } from '../../db/pool.js';

/**
 * Fetch linen inventory and rooms stock data for the hospital unit
 */
export const getDashboardData = async (req, res) => {
  try {
    // Get hospitalId from authenticated user token (role 'unit')
    const hospitalId = req.user.id;
    const { roomId } = req.query;
    
    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "ID Rumah Sakit tidak valid"
      });
    }

    // 1. Fetch Hospital Info
    const [hospitals] = await ikmPool.query(
      "SELECT id, hospital_name, hospital_id, company_name, address FROM mst_hospital WHERE id = ?",
      [hospitalId]
    );

    if (hospitals.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Rumah sakit tidak ditemukan"
      });
    }

    const hospital = hospitals[0];

    // 2. Fetch Hospital Linen Inventory with all needed columns calculated
    const inventoryQuery = `
      SELECT hl.*, l.linen_name, l.linen_code,
             s.size_name, c.color_name, m.material_name,
             COALESCE((
               SELECT SUM(td.qty_kotor - td.qty_bersih)
               FROM tr_linen_transaction_detail td
               INNER JOIN tr_linen_transaction t ON td.transaction_id = t.id
               WHERE td.hospital_linen_id = hl.id 
                 AND t.status = 'SELESAI' 
                 AND td.qty_bersih < td.qty_kotor
             ), 0) AS total_kurang,
             COALESCE((
               SELECT SUM(td.qty_kotor)
               FROM tr_linen_transaction_detail td
               INNER JOIN tr_linen_transaction t ON td.transaction_id = t.id
               WHERE td.hospital_linen_id = hl.id 
                 AND t.status = 'PROSES'
             ), 0) AS total_cuci,
             COALESCE((
               SELECT SUM(hlr.stock_in_rs)
               FROM mst_hospital_linen_rooms hlr
               INNER JOIN mst_rooms_rs r ON hlr.room_id = r.id
               WHERE hlr.hospital_linen_id = hl.id 
                 AND r.is_gudang_linen = 1
             ), 0) AS total_gudang,
             COALESCE((
               SELECT SUM(hlr.qty_terpakai)
               FROM mst_hospital_linen_rooms hlr
               WHERE hlr.hospital_linen_id = hl.id
             ), 0) AS total_terpakai,
             COALESCE((
               SELECT SUM(hlr.qty_dirty)
               FROM mst_hospital_linen_rooms hlr
               WHERE hlr.hospital_linen_id = hl.id
             ), 0) AS total_dirty,
             COALESCE((
               SELECT SUM(hlr.stock_in_rs - hlr.qty_terpakai - hlr.qty_dirty)
               FROM mst_hospital_linen_rooms hlr
               INNER JOIN mst_rooms_rs r ON hlr.room_id = r.id
               WHERE hlr.hospital_linen_id = hl.id 
                 AND COALESCE(r.is_gudang_linen, 0) = 0
             ), 0) AS total_lemari
      FROM mst_hospital_linen hl
      INNER JOIN mst_linen l ON hl.linen_id = l.id
      LEFT JOIN mst_size s ON l.size_id = s.id
      LEFT JOIN mst_color c ON l.color_id = c.id
      LEFT JOIN mst_material m ON l.material_id = m.id
      WHERE hl.hospital_id = ? AND hl.is_active = 1
      ORDER BY l.linen_name ASC
    `;
    const [linens] = await ikmPool.query(inventoryQuery, [hospitalId]);

    // 3. Fetch Rooms Inventory
    const roomsQuery = `
      SELECT hlr.*, hl.linen_id, l.linen_name, r.room_name, r.is_gudang_linen,
             COALESCE((
               SELECT SUM(td.qty_kotor)
               FROM tr_linen_transaction_detail td
               INNER JOIN tr_linen_transaction t ON td.transaction_id = t.id
               WHERE td.hospital_linen_id = hlr.hospital_linen_id 
                 AND td.room_id = hlr.room_id
                 AND t.status = 'PROSES'
             ), 0) AS qty_cuci,
             COALESCE((
               SELECT SUM(td.qty_kotor - td.qty_bersih)
               FROM tr_linen_transaction_detail td
               INNER JOIN tr_linen_transaction t ON td.transaction_id = t.id
               WHERE td.hospital_linen_id = hlr.hospital_linen_id 
                 AND td.room_id = hlr.room_id
                 AND t.status = 'SELESAI'
                 AND td.qty_bersih < td.qty_kotor
             ), 0) AS qty_kurang
      FROM mst_hospital_linen_rooms hlr
      INNER JOIN mst_hospital_linen hl ON hlr.hospital_linen_id = hl.id
      INNER JOIN mst_linen l ON hl.linen_id = l.id
      INNER JOIN mst_rooms_rs r ON hlr.room_id = r.id
      WHERE hl.hospital_id = ?
      ORDER BY r.room_name ASC, l.linen_name ASC
    `;
    const [roomLinens] = await ikmPool.query(roomsQuery, [hospitalId]);

    // 4. Fetch All Rooms (even those without registered linens)
    const allRoomsQuery = `
      SELECT id, room_name, is_gudang_linen 
      FROM mst_rooms_rs 
      WHERE hospital_id = ? 
      ORDER BY room_name ASC
    `;
    const [rooms] = await ikmPool.query(allRoomsQuery, [hospitalId]);

    // 5. Fetch detailed history of kurang kirim for this hospital
    const historyQuery = `
      SELECT td.hospital_linen_id, t.form_number, t.pickup_date, t.delivery_date, 
             td.qty_kotor, td.qty_bersih, (td.qty_kotor - td.qty_bersih) AS qty_kurang,
             td.notes, t.user_pickup, t.user_delivery
      FROM tr_linen_transaction_detail td
      INNER JOIN tr_linen_transaction t ON td.transaction_id = t.id
      WHERE t.hospital_id = ? 
        AND t.status = 'SELESAI' 
        AND td.qty_bersih < td.qty_kotor
      ORDER BY t.pickup_date DESC
    `;
    const [history] = await ikmPool.query(historyQuery, [hospitalId]);

    // Calculate Summary Stats
    const totalLinenTypes = linens.length;
    let totalStockIkm = 0;
    let totalStockRs = 0;
    let totalParStock = 0;
    let lowStockCount = 0;
    let totalKurangKirim = 0;

    linens.forEach(hl => {
      totalStockIkm += parseInt(hl.stock_in_ikm || 0);
      totalStockRs += parseInt(hl.stock_in_rs || 0);
      totalParStock += parseInt(hl.par_stock || 0);
      totalKurangKirim += parseInt(hl.total_kurang || 0);
      
      const currentStock = parseInt(hl.stock_in_ikm || 0) + parseInt(hl.stock_in_rs || 0);
      const minStock = parseInt(hl.min_stock || 0);
      if (currentStock < minStock) {
        lowStockCount++;
      }
    });

    // 6. Fetch recent unique nurse names for the selected room
    let recentNurses = [];
    if (roomId) {
      const [nurses] = await ikmPool.query(
        "SELECT nurse_name FROM tr_unit_activity_log WHERE room_id = ? GROUP BY nurse_name ORDER BY MAX(id) DESC LIMIT 5",
        [roomId]
      );
      recentNurses = nurses.map(n => n.nurse_name);
    }

    return res.status(200).json({
      success: true,
      data: {
        hospital,
        stats: {
          totalLinenTypes,
          totalStockIkm,
          totalStockRs,
          totalParStock,
          lowStockCount,
          totalKurangKirim
        },
        linens,
        roomLinens,
        rooms,
        history,
        recentNurses
      }
    });
  } catch (error) {
    console.error("Error fetching unit dashboard data:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat data linen unit",
      error: error.message
    });
  }
};

/**
 * Update Terpakai stock for a specific room and linen with activity logging
 */
export const updateTerpakai = async (req, res) => {
  try {
    const hospitalId = req.user.id;
    const { hospitalLinenId, roomId, qtyTerpakai, nurseName, type = 'terpakai' } = req.body;

    if (type === 'dirty') {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Pengkinian Dirty Utility hanya dapat dilakukan oleh Tim Linen IKM dan Tim RS."
      });
    }

    if (!hospitalLinenId || !roomId || qtyTerpakai === undefined || !nurseName) {
      return res.status(400).json({
        success: false,
        message: "hospitalLinenId, roomId, qtyTerpakai, dan nama perawat wajib diisi"
      });
    }

    const valUpdate = parseInt(qtyTerpakai || 0);
    if (valUpdate < 0) {
      return res.status(400).json({
        success: false,
        message: "Jumlah tidak boleh negatif"
      });
    }

    // Security check: Verify that hospitalLinenId belongs to the authenticated hospital
    const [linens] = await ikmPool.query(
      "SELECT hospital_id FROM mst_hospital_linen WHERE id = ?",
      [hospitalLinenId]
    );

    if (linens.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Linen rumah sakit tidak ditemukan"
      });
    }

    if (linens[0].hospital_id !== hospitalId) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Linen tidak terdaftar untuk rumah sakit Anda."
      });
    }

    // Security check: Verify that roomId belongs to the authenticated hospital
    const [rooms] = await ikmPool.query(
      "SELECT hospital_id FROM mst_rooms_rs WHERE id = ?",
      [roomId]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Ruangan tidak ditemukan"
      });
    }

    if (rooms[0].hospital_id !== hospitalId) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Ruangan tidak terdaftar untuk rumah sakit Anda."
      });
    }

    // Check if record exists in mst_hospital_linen_rooms
    const [existing] = await ikmPool.query(
      "SELECT * FROM mst_hospital_linen_rooms WHERE hospital_linen_id = ? AND room_id = ?",
      [hospitalLinenId, roomId]
    );

    let oldValue = 0;
    const actionType = type === 'dirty' ? 'UPDATE_DIRTY' : 'UPDATE_TERPAKAI';

    if (existing.length > 0) {
      const record = existing[0];
      if (type === 'dirty') {
        oldValue = parseInt(record.qty_dirty || 0);
        await ikmPool.query(
          "UPDATE mst_hospital_linen_rooms SET qty_dirty = ? WHERE hospital_linen_id = ? AND room_id = ?",
          [valUpdate, hospitalLinenId, roomId]
        );
      } else {
        oldValue = parseInt(record.qty_terpakai || 0);
        await ikmPool.query(
          "UPDATE mst_hospital_linen_rooms SET qty_terpakai = ? WHERE hospital_linen_id = ? AND room_id = ?",
          [valUpdate, hospitalLinenId, roomId]
        );
      }
    } else {
      if (type === 'dirty') {
        await ikmPool.query(
          "INSERT INTO mst_hospital_linen_rooms (hospital_linen_id, room_id, qty_dirty, stock_in_rs) VALUES (?, ?, ?, 0)",
          [hospitalLinenId, roomId, valUpdate]
        );
      } else {
        await ikmPool.query(
          "INSERT INTO mst_hospital_linen_rooms (hospital_linen_id, room_id, qty_terpakai, stock_in_rs) VALUES (?, ?, ?, 0)",
          [hospitalLinenId, roomId, valUpdate]
        );
      }
    }

    // Log the unit stock change action in tr_unit_activity_log
    await ikmPool.query(
      `INSERT INTO tr_unit_activity_log (hospital_linen_id, room_id, nurse_name, action_type, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hospitalLinenId, roomId, nurseName, actionType, oldValue, valUpdate]
    );

    // Emit real-time socket.io event
    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${hospitalId}`).emit('data_changed', {
        type: 'STOCK_UPDATE',
        message: type === 'dirty' ? 'Stok Dirty Utility ruangan telah diperbarui oleh perawat' : 'Stok Terpakai ruangan telah diperbarui oleh perawat'
      });
    }

    return res.status(200).json({
      success: true,
      message: type === 'dirty' ? "Data dirty utility berhasil diperbarui" : "Data terpakai berhasil diperbarui"
    });
  } catch (error) {
    console.error("Error updating unit stock:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui data stok",
      error: error.message
    });
  }
};

/**
 * Fetch activity logs for a specific linen in a room
 */
export const getLinenLogs = async (req, res) => {
  try {
    const hospitalId = req.user.id;
    const { hospitalLinenId, roomId } = req.query;

    if (!hospitalLinenId || !roomId) {
      return res.status(400).json({
        success: false,
        message: "hospitalLinenId dan roomId wajib diisi"
      });
    }

    // Security check: Verify that roomId belongs to the authenticated hospital
    const [rooms] = await ikmPool.query(
      "SELECT hospital_id FROM mst_rooms_rs WHERE id = ?",
      [roomId]
    );

    if (rooms.length === 0 || rooms[0].hospital_id !== hospitalId) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Ruangan tidak valid."
      });
    }

    const [logs] = await ikmPool.query(
      `SELECT id, nurse_name, action_type, old_value, new_value, created_at 
       FROM tr_unit_activity_log 
       WHERE hospital_linen_id = ? AND room_id = ? 
       ORDER BY created_at DESC LIMIT 50`,
      [hospitalLinenId, roomId]
    );

    return res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error("Error getting linen logs:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat log aktivitas linen",
      error: error.message
    });
  }
};
