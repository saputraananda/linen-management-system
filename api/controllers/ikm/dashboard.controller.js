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
    const { hospitalId, password } = req.body;
    
    if (!hospitalId || !password) {
      return res.status(400).json({
        success: false,
        message: "ID Rumah Sakit dan password wajib diisi"
      });
    }

    // Expected password format: valet{hospitalId}
    const expectedPassword = `valet${hospitalId}`;
    
    if (password === expectedPassword) {
      return res.status(200).json({
        success: true,
        message: "Verifikasi Rumah Sakit berhasil"
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

    // 2. Fetch Hospital Linen Inventory (from mst_hospital_linen and join mst_linen for naming)
    const inventoryQuery = `
      SELECT hl.*, l.linen_name, l.linen_code,
             s.size_name, c.color_name, m.material_name
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
      SELECT hlr.*, hl.linen_id, l.linen_name, r.room_name
      FROM mst_hospital_linen_rooms hlr
      INNER JOIN mst_hospital_linen hl ON hlr.hospital_linen_id = hl.id
      INNER JOIN mst_linen l ON hl.linen_id = l.id
      INNER JOIN mst_rooms_rs r ON hlr.room_id = r.id
      WHERE hl.hospital_id = ?
      ORDER BY r.room_name ASC, l.linen_name ASC
    `;
    const [roomLinens] = await ikmPool.query(roomsQuery, [hospitalId]);

    // Calculate Summary Stats
    const totalLinenTypes = linens.length;
    let totalStockIkm = 0;
    let totalStockRs = 0;
    let totalParStock = 0;
    let lowStockCount = 0;

    linens.forEach(hl => {
      totalStockIkm += parseInt(hl.stock_in_ikm || 0);
      totalStockRs += parseInt(hl.stock_in_rs || 0);
      totalParStock += parseInt(hl.par_stock || 0);
      
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
          lowStockCount
        },
        linens,
        roomLinens
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
