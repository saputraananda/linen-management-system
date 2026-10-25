import { ikmPool } from '../../db/pool.js';

function linenDisplayName(row) {
  const custom = String(row.hospital_linen_name || "").trim();
  if (custom) return custom;
  const parts = [row.master_linen_name, row.size_name, row.color_name, row.material_name].filter(Boolean);
  return parts.join(" ") || `Linen #${row.hospital_linen_id}`;
}

function sendError(res, err) {
  if (err.status === 400) return res.status(400).json({ success: false, message: err.message });
  console.error('rs bast linen sewa:', err);
  if (err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({ success: false, message: 'Tabel BAST belum tersedia. Skema database belum dijalankan.' });
  }
  return res.status(500).json({ success: false, message: 'Gagal memuat BAST' });
}

export const listBast = async (req, res) => {
  try {
    const hospitalId = Number(req.user?.id);
    if (!hospitalId) return res.status(401).json({ success: false, message: 'Akses ditolak' });
    const [rows] = await ikmPool.query(
      `SELECT b.id, b.bast_number, b.hospital_id, h.hospital_name, b.room_id,
              DATE_FORMAT(b.bast_date, '%Y-%m-%d %H:%i:%s') AS bast_date,
              b.sender_name, b.sender_position, COALESCE(b.receiver_name, b.rs_inspector_name) AS receiver_name, b.receiver_position, b.ga_head_name, b.ga_head_position,
              CASE
                WHEN COUNT(DISTINCT IFNULL(COALESCE(d.room_id, b.room_id), 0)) > 1 THEN 'Beberapa Unit'
                ELSE COALESCE(MAX(rd.room_name), r.room_name)
              END AS room_name,
              COALESCE(SUM(d.qty_pengiriman), 0) AS total_pengiriman,
              COALESCE(SUM(d.qty_penarikan), 0) AS total_penarikan
       FROM tr_bast_linen_sewa b
       JOIN mst_hospital h ON h.id = b.hospital_id
       LEFT JOIN mst_rooms_rs r ON r.id = b.room_id
       LEFT JOIN tr_bast_linen_sewa_detail d ON d.bast_id = b.id
       LEFT JOIN mst_rooms_rs rd ON rd.id = d.room_id
       WHERE b.hospital_id = ?
       GROUP BY b.id, b.bast_number, b.hospital_id, h.hospital_name, b.room_id, b.bast_date,
                b.sender_name, b.sender_position, b.receiver_name, b.receiver_position, b.ga_head_name, b.ga_head_position, b.rs_inspector_name, r.room_name
       ORDER BY b.bast_date DESC, b.id DESC
       LIMIT 200`,
      [hospitalId]
    );
    const [hosp] = await ikmPool.query('SELECT hospital_name FROM mst_hospital WHERE id = ? LIMIT 1', [hospitalId]);
    res.json({ success: true, data: rows, hospital_name: hosp[0]?.hospital_name || '' });
  } catch (err) {
    sendError(res, err);
  }
};

export const getBast = async (req, res) => {
  try {
    const hospitalId = Number(req.user?.id);
    const id = Number(req.params.id);
    const [headers] = await ikmPool.query(
      `SELECT b.id, b.bast_number, b.hospital_id, b.room_id,
              DATE_FORMAT(b.bast_date, '%Y-%m-%d %H:%i:%s') AS bast_date,
              b.sender_name, b.sender_position, COALESCE(b.receiver_name, b.rs_inspector_name) AS receiver_name,
              b.receiver_position, b.ga_head_name, b.ga_head_position, b.signature_sender,
              COALESCE(b.signature_receiver, b.signature_inspector) AS signature_receiver, b.signature_ga,
              r.room_name, h.hospital_name
       FROM tr_bast_linen_sewa b
       JOIN mst_hospital h ON h.id = b.hospital_id
       LEFT JOIN mst_rooms_rs r ON r.id = b.room_id
       WHERE b.id = ? AND b.hospital_id = ?`,
      [id, hospitalId]
    );
    if (!headers.length) return res.status(404).json({ success: false, message: 'BAST tidak ditemukan' });
    const [details] = await ikmPool.query(
      `SELECT d.id, d.hospital_linen_id, COALESCE(d.room_id, b.room_id) AS room_id, rr.room_name,
              d.stock_before, d.qty_pengiriman, d.qty_penarikan, d.notes, d.ukuran, d.bahan, d.warna,
              hl.hospital_linen_name, l.linen_name AS master_linen_name,
              sz.size_name, cl.color_name, mt.material_name
       FROM tr_bast_linen_sewa_detail d
       JOIN tr_bast_linen_sewa b ON b.id = d.bast_id
       LEFT JOIN mst_rooms_rs rr ON rr.id = COALESCE(d.room_id, b.room_id)
       LEFT JOIN mst_hospital_linen hl ON hl.id = d.hospital_linen_id
       LEFT JOIN mst_linen l ON l.id = hl.linen_id
       LEFT JOIN mst_size sz ON l.size_id = sz.id
       LEFT JOIN mst_color cl ON l.color_id = cl.id
       LEFT JOIN mst_material mt ON l.material_id = mt.id
       WHERE d.bast_id = ?
       ORDER BY l.linen_name ASC, sz.size_name ASC`,
      [id]
    );
    const names = [...new Set(details.map((row) => row.room_name).filter(Boolean))];
    const header = { ...headers[0] };
    if (names.length > 1) header.room_name = "Beberapa Unit";
    else if (names.length === 1) header.room_name = names[0];
    res.json({
      success: true,
      data: { ...header, details: details.map((row) => ({ ...row, linen_name: linenDisplayName(row) })) },
    });
  } catch (err) {
    sendError(res, err);
  }
};

