import { ikmPool } from '../../db/pool.js';

/**
 * Get list of all active hospitals
 */
export const getHospitals = async (req, res) => {
  try {
    const query = `
      SELECT id, hospital_name, hospital_id, company_name 
      FROM mst_hospital 
      ORDER BY hospital_name ASC
    `;
    const [hospitals] = await ikmPool.query(query);

    return res.status(200).json({
      success: true,
      data: hospitals
    });
  } catch (error) {
    console.error("Error getting hospitals:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat daftar rumah sakit",
      error: error.message
    });
  }
};

/**
 * Verify valet password for a specific hospital
 */
export const verifyHospital = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Kata sandi wajib diisi"
      });
    }

    // Ambil dari tabel mst_hospital pada kolom password_to_valet
    const [hospitals] = await ikmPool.query(
      "SELECT id, hospital_name FROM mst_hospital WHERE password_to_valet = ?",
      [password]
    );

    if (hospitals.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Verifikasi Rumah Sakit berhasil",
        data: {
          hospitalId: hospitals[0].id,
          hospitalName: hospitals[0].hospital_name
        }
      });
    } else {
      return res.status(401).json({
        success: false,
        message: "Kata sandi salah. Silakan periksa kata sandi valet Anda."
      });
    }
  } catch (error) {
    console.error("Error verifying hospital:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memverifikasi rumah sakit",
      error: error.message
    });
  }
};

/**
 * Fetch linen inventory and rooms stock data for a hospital
 */
export const getDashboardData = async (req, res) => {
  try {
    const { hospitalId } = req.query;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "ID Rumah Sakit wajib ditentukan"
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

    // 3. Fetch Rooms Inventory (from mst_hospital_linen_rooms join mst_rooms_rs and mst_linen)
    const roomsQuery = `
      SELECT hlr.*, hl.linen_id, l.linen_name, r.room_name, r.is_gudang_linen
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
        history
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat data linen rumah sakit",
      error: error.message
    });
  }
};

/**
 * Update Terpakai stock for a specific room and linen
 */
export const updateTerpakai = async (req, res) => {
  try {
    const { hospitalLinenId, roomId, qtyTerpakai, type = 'terpakai' } = req.body;

    if (!hospitalLinenId || !roomId || qtyTerpakai === undefined) {
      return res.status(400).json({
        success: false,
        message: "hospitalLinenId, roomId, dan qtyTerpakai wajib diisi"
      });
    }

    const valUpdate = parseInt(qtyTerpakai || 0);
    if (valUpdate < 0) {
      return res.status(400).json({
        success: false,
        message: "Jumlah tidak boleh negatif"
      });
    }

    // Check if record exists in mst_hospital_linen_rooms
    const [existing] = await ikmPool.query(
      "SELECT * FROM mst_hospital_linen_rooms WHERE hospital_linen_id = ? AND room_id = ?",
      [hospitalLinenId, roomId]
    );

    if (existing.length > 0) {
      if (type === 'dirty') {
        await ikmPool.query(
          "UPDATE mst_hospital_linen_rooms SET qty_dirty = ? WHERE hospital_linen_id = ? AND room_id = ?",
          [valUpdate, hospitalLinenId, roomId]
        );
      } else {
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

    return res.status(200).json({
      success: true,
      message: type === 'dirty' ? "Data dirty utility berhasil diperbarui" : "Data terpakai berhasil diperbarui"
    });
  } catch (error) {
    console.error("Error updating stock:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui data stok",
      error: error.message
    });
  }
};

/**
 * Update Gudang stock for a specific linen
 */
export const updateGudang = async (req, res) => {
  try {
    const { hospitalLinenId, qtyGudang } = req.body;

    if (!hospitalLinenId || qtyGudang === undefined) {
      return res.status(400).json({
        success: false,
        message: "hospitalLinenId dan qtyGudang wajib diisi"
      });
    }

    const valGudang = parseInt(qtyGudang || 0);
    if (valGudang < 0) {
      return res.status(400).json({
        success: false,
        message: "Jumlah gudang tidak boleh negatif"
      });
    }

    // 1. Get hospital_id of the linen, and get its Stok Awal (stock_in_rs in mst_hospital_linen)
    const [linens] = await ikmPool.query(
      "SELECT hospital_id, stock_in_rs FROM mst_hospital_linen WHERE id = ?",
      [hospitalLinenId]
    );

    if (linens.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Linen rumah sakit tidak ditemukan"
      });
    }

    const linen = linens[0];
    const stokAwal = parseInt(linen.stock_in_rs || 0);

    // Validation: cannot exceed Stok Awal
    if (valGudang > stokAwal) {
      return res.status(400).json({
        success: false,
        message: `Jumlah gudang (${valGudang} Pcs) tidak boleh melebihi Stok Awal (${stokAwal} Pcs)`
      });
    }

    // 2. Find the room ID where is_gudang_linen = 1
    const [gudangRooms] = await ikmPool.query(
      "SELECT id FROM mst_rooms_rs WHERE hospital_id = ? AND is_gudang_linen = 1 LIMIT 1",
      [linen.hospital_id]
    );

    if (gudangRooms.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Gudang linen tidak dikonfigurasi untuk rumah sakit ini. Silakan buat/tandai ruangan sebagai gudang terlebih dahulu."
      });
    }

    const gudangRoomId = gudangRooms[0].id;

    // 3. Upsert into mst_hospital_linen_rooms for this gudangRoomId and hospitalLinenId
    await ikmPool.query(
      `INSERT INTO mst_hospital_linen_rooms (hospital_linen_id, room_id, stock_in_rs) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE stock_in_rs = VALUES(stock_in_rs)`,
      [hospitalLinenId, gudangRoomId, valGudang]
    );

    return res.status(200).json({
      success: true,
      message: "Data gudang berhasil diperbarui"
    });
  } catch (error) {
    console.error("Error updating gudang:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui data gudang",
      error: error.message
    });
  }
};

/**
 * Update Room Stock directly (stock_in_rs) for a specific room and linen
 */
export const updateRoomStock = async (req, res) => {
  try {
    const { hospitalLinenId, roomId, stockInRs } = req.body;

    if (!hospitalLinenId || !roomId || stockInRs === undefined) {
      return res.status(400).json({
        success: false,
        message: "hospitalLinenId, roomId, dan stockInRs wajib diisi"
      });
    }

    const valStock = parseInt(stockInRs || 0);
    if (valStock < 0) {
      return res.status(400).json({
        success: false,
        message: "Jumlah stok tidak boleh negatif"
      });
    }

    // Check if the target room is a gudang room
    const [rooms] = await ikmPool.query(
      "SELECT is_gudang_linen FROM mst_rooms_rs WHERE id = ?",
      [roomId]
    );

    const isGudang = rooms.length > 0 && rooms[0].is_gudang_linen === 1;
    let finalStockInRs = valStock;

    if (!isGudang) {
      // Query the current qty_terpakai of that room to calculate Stok Awal (Alokasi)
      const [existing] = await ikmPool.query(
        "SELECT qty_terpakai FROM mst_hospital_linen_rooms WHERE hospital_linen_id = ? AND room_id = ?",
        [hospitalLinenId, roomId]
      );
      const qtyTerpakai = existing.length > 0 ? parseInt(existing[0].qty_terpakai || 0) : 0;
      finalStockInRs = valStock + qtyTerpakai;
    }

    // Upsert into mst_hospital_linen_rooms
    await ikmPool.query(
      `INSERT INTO mst_hospital_linen_rooms (hospital_linen_id, room_id, stock_in_rs) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE stock_in_rs = VALUES(stock_in_rs)`,
      [hospitalLinenId, roomId, finalStockInRs]
    );

    return res.status(200).json({
      success: true,
      message: "Stok ruangan berhasil diperbarui"
    });
  } catch (error) {
    console.error("Error updating room stock:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui stok ruangan",
      error: error.message
    });
  }
};

