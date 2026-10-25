import { mainPool, ikmPool } from '../../db/pool.js';
import {
  clean, actorOf, writeLog, emit, serverError, photoUrl, SELECT_LIST,
} from '../../utils/complaintCore.js';

// Tim IKM (valet) melihat komplain semua rumah sakit — hanya baca.
// Pengecualian: karyawan PT WAI (mst_employee.company_id = 1) atau mst_leader.role = 'management'
// boleh bertindak (mewakili Tim Linen RS, mengubah status, menambah catatan).

const WAI_COMPANY_ID = 1;

// Transisi sama dengan admin di Alora SuperApp
const TRANSITIONS = {
  DIAJUKAN: ['DISETUJUI_RS', 'DITOLAK'],
  DISETUJUI_RS: ['DIPROSES', 'SELESAI', 'DITOLAK'],
  DIPROSES: ['SELESAI', 'DITOLAK'],
};
const TARGETS = ['DISETUJUI_RS', 'DIPROSES', 'SELESAI', 'DITOLAK'];
const STATUSES = ['DIAJUKAN', 'DISETUJUI_RS', 'DIPROSES', 'SELESAI', 'DITOLAK'];

const SELECT_IKM = SELECT_LIST
  .replace('SELECT c.id,', 'SELECT h.hospital_name, c.id,')
  .replace('FROM tr_complaint c', 'FROM tr_complaint c\n  LEFT JOIN mst_hospital h ON h.id = c.hospital_id');

// Hak diperiksa ke DB setiap request (bukan dari token) agar perubahan jabatan langsung berlaku
const resolveAccess = async (user) => {
  const empId = Number(user.id);
  const [emp] = await mainPool.query(
    'SELECT full_name, company_id FROM mst_employee WHERE employee_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)', [empId]);
  if (!emp.length) return { canManage: false, name: user.fullName || user.username };
  const [lead] = await ikmPool.query("SELECT 1 FROM mst_leader WHERE employee_id = ? AND role = 'management' LIMIT 1", [empId]);
  return {
    canManage: Number(emp[0].company_id) === WAI_COMPANY_ID || lead.length > 0,
    name: emp[0].full_name || user.fullName || user.username,
  };
};

export const requireIkm = (req, res, next) => (req.user.role === 'valet'
  ? next()
  : res.status(403).json({ success: false, message: 'Akses ditolak' }));

export const getAccess = async (req, res) => {
  try {
    const a = await resolveAccess(req.user);
    const [hospitals] = await ikmPool.query('SELECT id, hospital_name FROM mst_hospital ORDER BY hospital_name');
    res.json({ success: true, canManage: a.canManage, hospitals });
  } catch (e) { serverError(res, 'ikm getAccess', e); }
};

export const listComplaints = async (req, res) => {
  try {
    const a = await resolveAccess(req.user);
    const where = [];
    const params = [];
    if (Number(req.query.hospitalId)) { where.push('c.hospital_id = ?'); params.push(Number(req.query.hospitalId)); }
    if (STATUSES.includes(req.query.status)) { where.push('c.status = ?'); params.push(req.query.status); }
    const q = clean(req.query.q, 100);
    if (q) {
      where.push('(c.complaint_number LIKE ? OR c.complaint_type LIKE ? OR c.reporter_name LIKE ? OR c.description LIKE ? OR h.hospital_name LIKE ?)');
      params.push(...Array(5).fill(`%${q}%`));
    }
    const [rows] = await ikmPool.query(
      `${SELECT_IKM} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY c.created_at DESC, c.id DESC LIMIT 500`, params);
    res.json({ success: true, canManage: a.canManage, data: rows });
  } catch (e) { serverError(res, 'ikm listComplaints', e); }
};

export const getComplaint = async (req, res) => {
  try {
    const a = await resolveAccess(req.user);
    const [rows] = await ikmPool.query(`${SELECT_IKM} WHERE c.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Komplain tidak ditemukan' });
    const [docs] = await ikmPool.query('SELECT id, file_name, original_name FROM tr_complaint_doc WHERE complaint_id = ? ORDER BY id', [req.params.id]);
    const [logs] = await ikmPool.query(
      `SELECT id, action, from_status, to_status, note, detail, actor_name, actor_role, created_at
         FROM tr_complaint_log WHERE complaint_id = ? ORDER BY id`, [req.params.id]);
    res.json({
      success: true,
      data: {
        ...rows[0],
        can_manage: a.canManage,
        next_statuses: a.canManage ? (TRANSITIONS[rows[0].status] || []) : [],
        photos: docs.map((d) => ({ id: d.id, url: photoUrl(d.file_name), name: d.original_name })),
        logs,
      },
    });
  } catch (e) { serverError(res, 'ikm getComplaint', e); }
};

// Ubah status dan/atau tambah catatan — hanya company_id = 1 atau management
export const updateStatus = async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status ? String(req.body.status) : null;
  const note = clean(req.body?.note, 2000);
  if (!status && !note) return res.status(400).json({ success: false, message: 'Pilih status baru atau isi catatan' });
  if (status && !TARGETS.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid' });
  if (status === 'DITOLAK' && !note) return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi' });

  const conn = await ikmPool.getConnection();
  try {
    const a = await resolveAccess(req.user);
    if (!a.canManage) return res.status(403).json({ success: false, message: 'Anda hanya dapat melihat komplain (view only)' });

    const [rows] = await conn.query('SELECT id, hospital_id, complaint_number, status FROM tr_complaint WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Komplain tidak ditemukan' });
    const c = rows[0];
    const actor = { ...actorOf(req.user), name: a.name, role: 'ikm' };

    await conn.beginTransaction();
    if (status && status !== c.status) {
      if (!(TRANSITIONS[c.status] || []).includes(status)) {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          message: c.status === 'DIAJUKAN'
            ? 'Dari status Diajukan hanya bisa menyetujui atau menolak (mewakili Tim Linen RS)'
            : 'Perubahan status tidak diizinkan',
        });
      }
      const onBehalf = c.status === 'DIAJUKAN';
      if (onBehalf && !note) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Alasan wajib diisi saat mewakili Tim Linen RS' });
      }
      const [upd] = onBehalf
        ? await conn.query(
          'UPDATE tr_complaint SET status=?, updated_by=?, rs_approved_by=?, rs_approved_at=NOW() WHERE id=? AND status=?',
          [status, a.name, `${a.name} (Tim IKM, mewakili Tim Linen RS)`.slice(0, 150), id, c.status])
        : await conn.query('UPDATE tr_complaint SET status=?, updated_by=? WHERE id=? AND status=?', [status, a.name, id, c.status]);
      if (!upd.affectedRows) {
        await conn.rollback();
        return res.status(409).json({ success: false, message: 'Status komplain sudah berubah, muat ulang halaman' });
      }
      await writeLog(conn, {
        complaintId: id,
        number: c.complaint_number,
        from: c.status,
        to: status,
        note: note || null,
        actor,
        action: onBehalf ? (status === 'DISETUJUI_RS' ? 'APPROVED' : 'REJECTED') : 'STATUS',
        detail: onBehalf ? { on_behalf_of: 'rs' } : null,
      });
    } else if (note) {
      await writeLog(conn, { complaintId: id, number: c.complaint_number, action: 'NOTE', note, actor });
    } else {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Status sama dengan sebelumnya' });
    }
    await conn.commit();
    emit(req, c.hospital_id, `Komplain ${c.complaint_number} diperbarui oleh Tim IKM`);
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    serverError(res, 'ikm updateStatus', e);
  } finally {
    conn.release();
  }
};
