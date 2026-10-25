import { ikmPool } from '../../db/pool.js';
import { clean, actorOf, writeLog, emit, serverError } from '../../utils/complaintCore.js';

// CRUD yang sama dengan Unit (hak edit/hapus dibedakan lewat permsOf di core)
export {
  uploadPhotos, getOptions, getLinenOptions, listComplaints, getComplaint,
  createComplaint, updateComplaint, deleteComplaint,
} from '../../utils/complaintCore.js';

export const requireRs = (req, res, next) => (req.user.role === 'rs'
  ? next()
  : res.status(403).json({ success: false, message: 'Akses ditolak' }));

// Tim Linen RS: setujui (ACC) atau tolak. Setelah ini komplain terkunci dan lanjut ke Admin.
const decide = (approve) => async (req, res) => {
  const u = req.user;
  if (u.role !== 'rs') return res.status(403).json({ success: false, message: 'Hanya Tim Linen RS yang bisa memproses komplain' });
  const note = clean(req.body?.note, 1000);
  if (!approve && !note) return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi' });
  const to = approve ? 'DISETUJUI_RS' : 'DITOLAK';
  const actor = actorOf(u);
  const conn = await ikmPool.getConnection();
  try {
    await conn.beginTransaction();
    const [upd] = await conn.query(
      `UPDATE tr_complaint SET status = ?, rs_approved_by = ?, rs_approved_at = NOW(), updated_by = ?
        WHERE id = ? AND hospital_id = ? AND status = 'DIAJUKAN'`, [to, actor.name, actor.name, req.params.id, u.id]);
    if (!upd.affectedRows) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Komplain tidak ditemukan atau sudah diproses' });
    }
    const [[c]] = await conn.query('SELECT complaint_number FROM tr_complaint WHERE id = ?', [req.params.id]);
    await writeLog(conn, { complaintId: Number(req.params.id), number: c.complaint_number, action: approve ? 'APPROVED' : 'REJECTED', from: 'DIAJUKAN', to, note: note || null, actor });
    await conn.commit();
    emit(req, u.id, `Komplain ${c.complaint_number} ${approve ? 'disetujui' : 'ditolak'}`);
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    serverError(res, 'decide', e);
  } finally {
    conn.release();
  }
};

export const approveComplaint = decide(true);
export const rejectComplaint = decide(false);
