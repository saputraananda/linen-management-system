import { ikmPool, mainPool } from '../../db/pool.js';
import { saveBase64Image, cleanupSignatures } from '../../middleware/upload.js';
import { getRoomSignState } from '../../utils/roomSign.js';

const toTitleCase = (str) => {
  if (!str) return '';
  return str.trim().toLowerCase().split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

/**
 * PUT /api/ikm/transactions/:id/rooms/:roomId/sign
 * Body: { stage: 'pickup' | 'delivery', nurseName, signatureNurse, signatureValet }
 * Menyimpan TTD Valet + Perawat Unit untuk satu ruangan. Bisa diisi bertahap per ruangan.
 */
export const signRoom = async (req, res) => {
  const connection = await ikmPool.getConnection();
  let oldRow = null, saved = null;
  try {
    const { id, roomId } = req.params;
    const { stage, nurseName, signatureNurse, signatureValet } = req.body;

    if (!['pickup', 'delivery'].includes(stage)) {
      return res.status(400).json({ success: false, message: 'Tahap TTD tidak valid' });
    }
    if (!nurseName?.trim() || !signatureNurse || !signatureValet) {
      return res.status(400).json({ success: false, message: 'Nama perawat unit, TTD perawat, dan TTD valet wajib diisi.' });
    }

    await connection.beginTransaction();

    const [[tx]] = await connection.query('SELECT * FROM tr_linen_transaction WHERE id = ? FOR UPDATE', [id]);
    if (!tx) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }
    if (tx.status !== 'PROSES') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Transaksi sudah selesai, TTD unit tidak dapat diubah.' });
    }
    const pickupFinal = !!(tx.signature_valet_pickup && tx.signature_hospital_pickup);
    if (stage === 'pickup' && pickupFinal) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Pengambilan kotor sudah ditandatangani Tim Linen RS, TTD unit pickup terkunci.' });
    }
    if (stage === 'delivery' && !pickupFinal) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Selesaikan pengambilan kotor terlebih dahulu.' });
    }

    const [[room]] = await connection.query(
      `SELECT r.room_name, SUM(d.qty_kotor) AS kotor, SUM(d.qty_bersih IS NULL) AS bersih_kosong
         FROM tr_linen_transaction_detail d
         INNER JOIN mst_rooms_rs r ON r.id = d.room_id
        WHERE d.transaction_id = ? AND d.room_id = ?
        GROUP BY r.room_name`, [id, roomId]);
    if (!room || !(Number(room.kotor) > 0)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Ruangan ini tidak menurunkan linen kotor pada formulir ini. Simpan jumlah kotornya terlebih dahulu.' });
    }
    // Perawat menandatangani angka yang sudah tercatat: jumlah bersih ruangan wajib tersimpan dulu
    if (stage === 'delivery' && Number(room.bersih_kosong) > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Simpan jumlah bersih ruangan ${room.room_name} terlebih dahulu sebelum TTD.` });
    }

    const [[existing]] = await connection.query(
      'SELECT * FROM tr_linen_transaction_room_sign WHERE transaction_id = ? AND room_id = ?', [id, roomId]);
    // Sudah TTD Valet + Perawat Unit: ruangan ini terkunci untuk tahap ini
    if (existing?.[`signature_nurse_${stage}`] && existing?.[`signature_valet_${stage}`]) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Ruangan ${room.room_name} sudah TTD unit dan terkunci.` });
    }
    oldRow = existing ? {
      [`signature_nurse_${stage}`]: existing[`signature_nurse_${stage}`],
      [`signature_valet_${stage}`]: existing[`signature_valet_${stage}`]
    } : null;

    const nursePath = saveBase64Image(signatureNurse, `room${roomId}_nurse_${stage}`, id);
    const valetPath = saveBase64Image(signatureValet, `room${roomId}_valet_${stage}`, id);
    saved = { [`signature_nurse_${stage}`]: nursePath, [`signature_valet_${stage}`]: valetPath };

    // Petugas IKM ruangan ini = yang dipilih di isian Pengisi/Pengirim (satu akun bisa dipakai beberapa tim);
    // bila tidak dikirim/tidak valid, pakai akun yang login.
    let valetId = req.user?.id || null;
    const chosen = Number(req.body.valetId);
    if (chosen > 0) {
      const [[emp]] = await mainPool.query('SELECT employee_id FROM mst_employee WHERE employee_id = ?', [chosen]);
      if (emp) valetId = chosen;
    }
    await connection.query(
      `INSERT INTO tr_linen_transaction_room_sign
         (transaction_id, room_id, nurse_name_${stage}, signature_nurse_${stage}, signature_valet_${stage}, valet_${stage}_id, signed_${stage}_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         nurse_name_${stage} = VALUES(nurse_name_${stage}),
         signature_nurse_${stage} = VALUES(signature_nurse_${stage}),
         signature_valet_${stage} = VALUES(signature_valet_${stage}),
         valet_${stage}_id = VALUES(valet_${stage}_id),
         signed_${stage}_at = VALUES(signed_${stage}_at)`,
      [id, roomId, toTitleCase(nurseName), nursePath, valetPath, valetId]);

    await connection.commit();
    cleanupSignatures(oldRow, saved);

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${tx.hospital_id}`).emit('data_changed', {
        type: 'ROOM_SIGNED', transactionId: Number(id),
        message: `TTD unit ${room.room_name} tersimpan`
      });
    }

    const state = await getRoomSignState(ikmPool, id);
    return res.status(200).json({ success: true, message: `TTD unit ${room.room_name} berhasil disimpan`, data: state });
  } catch (error) {
    await connection.rollback();
    cleanupSignatures(saved, oldRow);
    console.error('Error signing room:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan TTD unit', error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * DELETE /api/ikm/transactions/:id/rooms/:roomId/sign?stage=pickup|delivery
 * "Edit" ruangan: hapus TTD Valet + Perawat Unit tahap itu (data dan file di server) supaya isian ruangan
 * terbuka lagi. Setelah diubah, ruangan wajib TTD ulang.
 */
export const unsignRoom = async (req, res) => {
  const connection = await ikmPool.getConnection();
  let oldFiles = null;
  try {
    const { id, roomId } = req.params;
    const stage = req.query.stage || req.body?.stage;
    if (!['pickup', 'delivery'].includes(stage)) {
      return res.status(400).json({ success: false, message: 'Tahap TTD tidak valid' });
    }

    await connection.beginTransaction();
    const [[tx]] = await connection.query('SELECT * FROM tr_linen_transaction WHERE id = ? FOR UPDATE', [id]);
    if (!tx) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }
    const pickupFinal = !!(tx.signature_valet_pickup && tx.signature_hospital_pickup);
    if (tx.status !== 'PROSES' || (stage === 'pickup' && pickupFinal)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Formulir sudah ditandatangani Tim Linen RS, TTD unit tidak dapat dibuka lagi.' });
    }

    const [[existing]] = await connection.query(
      'SELECT * FROM tr_linen_transaction_room_sign WHERE transaction_id = ? AND room_id = ?', [id, roomId]);
    if (!existing) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Ruangan ini belum memiliki TTD unit' });
    }
    oldFiles = {
      [`signature_nurse_${stage}`]: existing[`signature_nurse_${stage}`],
      [`signature_valet_${stage}`]: existing[`signature_valet_${stage}`]
    };

    await connection.query(
      `UPDATE tr_linen_transaction_room_sign
          SET nurse_name_${stage} = NULL, signature_nurse_${stage} = NULL, signature_valet_${stage} = NULL,
              valet_${stage}_id = NULL, signed_${stage}_at = NULL
        WHERE transaction_id = ? AND room_id = ?`, [id, roomId]);

    await connection.commit();
    // File TTD lama ikut dihapus dari server
    cleanupSignatures(oldFiles, null);

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${tx.hospital_id}`).emit('data_changed', { type: 'ROOM_UNSIGNED', transactionId: Number(id), message: 'TTD unit dibuka untuk diedit' });
    }

    const state = await getRoomSignState(ikmPool, id);
    return res.status(200).json({ success: true, message: 'Ruangan dibuka untuk diedit. TTD unit sebelumnya dihapus, wajib TTD ulang.', data: state });
  } catch (error) {
    await connection.rollback();
    console.error('Error unsigning room:', error);
    return res.status(500).json({ success: false, message: 'Gagal membuka ruangan untuk diedit', error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/ikm/room-nurses?hospitalId=
 * Daftar perawat unit aktif per ruangan (mst_users_rs) untuk mengisi nama otomatis; tetap bisa diedit.
 */
export const getRoomNurses = async (req, res) => {
  try {
    const { hospitalId } = req.query;
    if (!hospitalId) return res.status(400).json({ success: false, message: 'hospitalId wajib' });
    const [rows] = await ikmPool.query(
      `SELECT ur.room_id, u.nurse_name
         FROM mst_users_rs u
         INNER JOIN mst_users_rs_rooms ur ON ur.user_id = u.id
        WHERE u.hospital_id = ? AND u.role = 'unit' AND u.is_active = 1 AND u.nurse_name IS NOT NULL
        ORDER BY u.nurse_name`, [hospitalId]);
    const byRoom = {};
    rows.forEach(r => {
      const key = String(r.room_id);
      if (!byRoom[key]) byRoom[key] = [];
      if (!byRoom[key].includes(r.nurse_name)) byRoom[key].push(r.nurse_name);
    });
    return res.status(200).json({ success: true, data: byRoom });
  } catch (error) {
    console.error('Error getting room nurses:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar perawat unit', error: error.message });
  }
};
