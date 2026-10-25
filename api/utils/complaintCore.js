import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { ikmPool } from '../db/pool.js';

const MAX_PHOTOS = 5;
const MAX_SIZE = 5 * 1024 * 1024;
const URL_PREFIX = '/storage/assets/complaint';

// ───────────────────────── helpers ─────────────────────────

const complaintDir = () => {
  const base = process.env.UPLOAD_BASE_DIR || 'assets';
  return path.isAbsolute(base)
    ? path.join(base.replace(/\/$/, ''), 'complaint')
    : path.resolve(process.cwd(), base, 'complaint');
};

const photoUrl = (file) => `${URL_PREFIX}/${file}`;

// Deteksi tipe gambar dari isi file (bukan dari nama / mime yang dikirim klien)
const sniff = (buf) => {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
};

const unlinkFiles = (names) => {
  for (const n of names) fs.unlink(path.join(complaintDir(), path.basename(n)), () => {});
};

const clean = (v, max) => String(v ?? '').trim().slice(0, max);

const actorOf = (u) => ({
  name: u.nurseName || u.fullName || u.username || 'Unknown',
  username: u.username || null,
  role: u.role,
});

const isOwner = (c, u) => (u.userUnitId
  ? Number(c.created_by_user_id) === Number(u.userUnitId)
  : c.created_by_user_id == null && c.created_by === u.username && c.created_by_role === u.role);

// Edit / hapus hanya selama belum di-approve Tim Linen RS (status DIAJUKAN)
const permsOf = (c, u) => {
  const open = c.status === 'DIAJUKAN';
  const mayChange = open && (u.role === 'rs' || isOwner(c, u));
  return { can_edit: mayChange, can_delete: mayChange, can_approve: open && u.role === 'rs' };
};

const writeLog = (conn, { complaintId, number, action, from = null, to = null, note = null, detail = null, actor }) =>
  conn.query(
    `INSERT INTO tr_complaint_log
       (complaint_id, complaint_number, action, from_status, to_status, note, detail, actor_name, actor_username, actor_role)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [complaintId, number, action, from, to, note, detail ? JSON.stringify(detail) : null, actor.name, actor.username, actor.role]);

const emit = (req, hospitalId, message) => {
  req.app.get('io')?.to(`hospital_${hospitalId}`).emit('data_changed', { type: 'COMPLAINT', message, hospitalId: Number(hospitalId) });
};

// Nama tampil linen: nama RS jika ada, jika tidak nama linen + ukuran + warna + bahan
// (aturan sama dengan getLinenDisplayName di Dashboard / Serah Terima).
const LINEN_NAME_SQL = "COALESCE(NULLIF(TRIM(hl.hospital_linen_name), ''), TRIM(CONCAT_WS(' ', l.linen_name, s.size_name, co.color_name, m.material_name)))";

const SELECT_LIST = `
  SELECT c.id, c.complaint_number, c.hospital_id, c.room_id, r.room_name, c.reporter_name,
         DATE_FORMAT(c.complaint_date, '%Y-%m-%d') AS complaint_date,
         c.complaint_type, c.description, c.hospital_linen_id,
         ${LINEN_NAME_SQL} AS linen_name,
         c.linen_category_id, lc.category_name, c.ownership_type, c.quantity, c.status,
         c.rs_approved_by, c.rs_approved_at, c.created_by, c.created_by_user_id, c.created_by_role,
         c.created_at, c.updated_at,
         (SELECT COUNT(*) FROM tr_complaint_doc d WHERE d.complaint_id = c.id) AS photo_count
  FROM tr_complaint c
  LEFT JOIN mst_rooms_rs r ON r.id = c.room_id
  LEFT JOIN mst_hospital_linen hl ON hl.id = c.hospital_linen_id
  LEFT JOIN mst_linen l ON l.id = hl.linen_id
  LEFT JOIN mst_size s ON s.id = l.size_id
  LEFT JOIN mst_color co ON co.id = l.color_id
  LEFT JOIN mst_material m ON m.id = l.material_id
  LEFT JOIN mst_linen_category lc ON lc.id = c.linen_category_id`;

// ───────────────────────── upload middleware ─────────────────────────

export const uploadPhotos = (req, res, next) => {
  multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE, files: MAX_PHOTOS } })
    .array('photos', MAX_PHOTOS)(req, res, (err) => {
      if (!err) return next();
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran tiap foto maksimal 5 MB'
        : (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') ? `Maksimal ${MAX_PHOTOS} foto`
        : 'Gagal membaca foto yang diunggah';
      res.status(400).json({ success: false, message: msg });
    });
};

// ───────────────────────── input parsing ─────────────────────────

const readFields = (b) => ({
  reporter: clean(b.reporter_name, 150),
  date: clean(b.complaint_date, 10),
  roomId: Number(b.room_id) || 0,
  type: clean(b.complaint_type, 100),
  description: clean(b.description, 5000),
  linenId: Number(b.hospital_linen_id) || 0,
  qty: Number.parseInt(b.quantity, 10),
  ownership: clean(b.ownership_type, 20).toUpperCase(),
});

const OWNERSHIPS = ['MILIK_RS', 'SEWA'];

const validateDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return false;
  return d.getTime() <= Date.now() + 36 * 3600 * 1000; // toleransi zona waktu, tidak boleh tanggal masa depan
};

// Validasi + ambil kategori linen dari master (kategori tidak dipercaya dari klien)
const validate = async (hospitalId, f) => {
  if (!f.reporter) return { error: 'Nama pelapor wajib diisi' };
  if (!f.type) return { error: 'Jenis komplain wajib diisi' };
  if (!f.description) return { error: 'Deskripsi komplain wajib diisi' };
  if (!f.roomId) return { error: 'Unit / ruangan wajib dipilih' };
  if (!f.date) f.date = new Date().toISOString().slice(0, 10);
  if (!validateDate(f.date)) return { error: 'Tanggal pengajuan tidak valid' };

  const [room] = await ikmPool.query('SELECT id FROM mst_rooms_rs WHERE id = ? AND hospital_id = ?', [f.roomId, hospitalId]);
  if (!room.length) return { error: 'Ruangan tidak ditemukan di rumah sakit ini' };

  if (!f.linenId) return { linenId: null, categoryId: null, qty: null, ownership: null };
  if (!(f.qty >= 1)) return { error: 'Quantity wajib diisi (minimal 1) jika memilih linen' };
  const [lin] = await ikmPool.query(
    `SELECT hl.id, l.category_id, hl.ownership_type
       FROM mst_hospital_linen hl
       JOIN mst_linen l ON l.id = hl.linen_id
       JOIN mst_hospital_linen_rooms hlr ON hlr.hospital_linen_id = hl.id AND hlr.room_id = ?
      WHERE hl.id = ? AND hl.hospital_id = ?`, [f.roomId, f.linenId, hospitalId]);
  if (!lin.length) return { error: 'Linen tidak terdaftar di ruangan yang dipilih' };
  if (f.ownership && !OWNERSHIPS.includes(f.ownership)) return { error: 'Kepemilikan tidak valid' };
  // Default dari master; boleh diubah pelapor (nilai dipilih tetap divalidasi terhadap enum)
  return { linenId: lin[0].id, categoryId: lin[0].category_id ?? null, qty: f.qty, ownership: f.ownership || lin[0].ownership_type };
};

// Pastikan file benar-benar gambar, kembalikan ekstensi dari isi file
const checkFiles = (files) => {
  const exts = [];
  for (const f of files || []) {
    const ext = sniff(f.buffer);
    if (!ext) return { error: 'Foto harus berformat JPG, PNG, atau WEBP' };
    exts.push(ext);
  }
  return { exts };
};

const saveFiles = (files, exts, complaintId) => {
  fs.mkdirSync(complaintDir(), { recursive: true });
  const names = [];
  files.forEach((f, i) => {
    const name = `${complaintId}_${Date.now()}_${i}.${exts[i]}`;
    fs.writeFileSync(path.join(complaintDir(), name), f.buffer);
    names.push(name);
  });
  return names;
};

const nextNumber = async (hospitalId) => {
  const [[h]] = await ikmPool.query('SELECT hospital_id AS code FROM mst_hospital WHERE id = ?', [hospitalId]);
  const code = String(h?.code || `H${hospitalId}`).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const prefix = `CMP-${code}-${new Date().getFullYear()}-`;
  const [[row]] = await ikmPool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(complaint_number, '-', -1) AS UNSIGNED)), 0) + 1 AS n
       FROM tr_complaint WHERE complaint_number LIKE ?`, [`${prefix}%`]);
  return `${prefix}${String(row.n).padStart(4, '0')}`;
};

const serverError = (res, tag, e) => {
  console.error(tag, e);
  return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
};

// ───────────────────────── handlers ─────────────────────────

export const getOptions = async (req, res) => {
  try {
    const hid = req.user.id;
    const [rooms] = await ikmPool.query('SELECT id, room_name FROM mst_rooms_rs WHERE hospital_id = ? ORDER BY room_name', [hid]);
    const [categories] = await ikmPool.query('SELECT id, category_name FROM mst_complaint_category WHERE is_active = 1 ORDER BY category_name');
    res.json({
      success: true,
      rooms,
      categories,
      myRoomIds: req.user.role === 'unit' && req.user.userUnitId ? (req.user.roomIds || []) : [],
      maxPhotos: MAX_PHOTOS,
    });
  } catch (e) { serverError(res, 'getOptions', e); }
};

export const getLinenOptions = async (req, res) => {
  try {
    const roomId = Number(req.query.roomId) || 0;
    if (!roomId) return res.json({ success: true, data: [] });
    const [rows] = await ikmPool.query(
      `SELECT hl.id AS hospital_linen_id,
              ${LINEN_NAME_SQL} AS linen_name,
              l.linen_code, l.category_id, lc.category_name, hl.ownership_type
         FROM mst_hospital_linen_rooms hlr
         JOIN mst_rooms_rs r ON r.id = hlr.room_id AND r.hospital_id = ?
         JOIN mst_hospital_linen hl ON hl.id = hlr.hospital_linen_id AND hl.hospital_id = ?
         JOIN mst_linen l ON l.id = hl.linen_id
         LEFT JOIN mst_size s ON s.id = l.size_id
         LEFT JOIN mst_color co ON co.id = l.color_id
         LEFT JOIN mst_material m ON m.id = l.material_id
         LEFT JOIN mst_linen_category lc ON lc.id = l.category_id
        WHERE hlr.room_id = ? AND hl.is_active = 1
        ORDER BY linen_name`, [req.user.id, req.user.id, roomId]);
    res.json({ success: true, data: rows });
  } catch (e) { serverError(res, 'getLinenOptions', e); }
};

export const listComplaints = async (req, res) => {
  try {
    const u = req.user;
    const where = ['c.hospital_id = ?'];
    const params = [u.id];

    if (req.query.mine === '1' && u.role === 'unit' && u.userUnitId) {
      const rooms = (u.roomIds || []).map(Number).filter(Boolean);
      if (!rooms.length) return res.json({ success: true, data: [] });
      where.push('c.room_id IN (?)');
      params.push(rooms);
    }
    if (req.query.status) { where.push('c.status = ?'); params.push(String(req.query.status)); }
    const q = clean(req.query.q, 100);
    if (q) {
      where.push('(c.complaint_number LIKE ? OR c.complaint_type LIKE ? OR c.reporter_name LIKE ? OR c.description LIKE ?)');
      params.push(...Array(4).fill(`%${q}%`));
    }
    const [rows] = await ikmPool.query(`${SELECT_LIST} WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC, c.id DESC LIMIT 500`, params);
    res.json({ success: true, data: rows.map((c) => ({ ...c, ...permsOf(c, u) })) });
  } catch (e) { serverError(res, 'listComplaints', e); }
};

export const getComplaint = async (req, res) => {
  try {
    const u = req.user;
    const [rows] = await ikmPool.query(`${SELECT_LIST} WHERE c.id = ? AND c.hospital_id = ?`, [req.params.id, u.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Komplain tidak ditemukan' });
    const [docs] = await ikmPool.query('SELECT id, file_name, original_name FROM tr_complaint_doc WHERE complaint_id = ? ORDER BY id', [req.params.id]);
    const [logs] = await ikmPool.query(
      `SELECT id, action, from_status, to_status, note, detail, actor_name, actor_role, created_at
         FROM tr_complaint_log WHERE complaint_id = ? ORDER BY id`, [req.params.id]);
    res.json({
      success: true,
      data: {
        ...rows[0],
        ...permsOf(rows[0], u),
        photos: docs.map((d) => ({ id: d.id, url: photoUrl(d.file_name), name: d.original_name })),
        logs,
      },
    });
  } catch (e) { serverError(res, 'getComplaint', e); }
};

export const createComplaint = async (req, res) => {
  const u = req.user;
  const f = readFields(req.body);
  try {
    const v = await validate(u.id, f);
    if (v.error) return res.status(400).json({ success: false, message: v.error });
    const files = req.files || [];
    const fc = checkFiles(files);
    if (fc.error) return res.status(400).json({ success: false, message: fc.error });

    const actor = actorOf(u);
    for (let attempt = 0; attempt < 4; attempt++) {
      const number = await nextNumber(u.id);
      const conn = await ikmPool.getConnection();
      let written = [];
      try {
        await conn.beginTransaction();
        const [ins] = await conn.query(
          `INSERT INTO tr_complaint
             (complaint_number, hospital_id, room_id, reporter_name, complaint_date, complaint_type, description,
              hospital_linen_id, linen_category_id, ownership_type, quantity, created_by, created_by_user_id, created_by_role, updated_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [number, u.id, f.roomId, f.reporter, f.date, f.type, f.description, v.linenId, v.categoryId, v.ownership, v.qty,
            actor.username || actor.name, u.userUnitId || null, u.role, actor.name]);
        const id = ins.insertId;
        written = saveFiles(files, fc.exts, id);
        for (let i = 0; i < written.length; i++) {
          await conn.query(
            'INSERT INTO tr_complaint_doc (complaint_id, file_name, original_name, mime_type, file_size, uploaded_by) VALUES (?,?,?,?,?,?)',
            [id, written[i], clean(files[i].originalname, 255), files[i].mimetype, files[i].size, actor.name]);
        }
        await writeLog(conn, { complaintId: id, number, action: 'CREATED', to: 'DIAJUKAN', actor, detail: { photos: written.length } });
        await conn.commit();
        emit(req, u.id, `Komplain baru ${number}`);
        return res.json({ success: true, id, complaint_number: number });
      } catch (e) {
        await conn.rollback();
        unlinkFiles(written);
        if (e.code === 'ER_DUP_ENTRY' && attempt < 3) continue; // nomor bentrok, ambil nomor berikutnya
        throw e;
      } finally {
        conn.release();
      }
    }
  } catch (e) { return serverError(res, 'createComplaint', e); }
};

export const updateComplaint = async (req, res) => {
  const u = req.user;
  const f = readFields(req.body);
  let written = [];
  let conn;
  try {
    const [cur] = await ikmPool.query('SELECT * FROM tr_complaint WHERE id = ? AND hospital_id = ?', [req.params.id, u.id]);
    if (!cur.length) return res.status(404).json({ success: false, message: 'Komplain tidak ditemukan' });
    const c = cur[0];
    if (!permsOf(c, u).can_edit) {
      return res.status(403).json({ success: false, message: c.status === 'DIAJUKAN' ? 'Anda tidak berhak mengubah komplain ini' : 'Komplain sudah disetujui Tim Linen RS dan tidak bisa diubah' });
    }

    const v = await validate(u.id, f);
    if (v.error) return res.status(400).json({ success: false, message: v.error });
    const files = req.files || [];
    const fc = checkFiles(files);
    if (fc.error) return res.status(400).json({ success: false, message: fc.error });

    let removeIds = [];
    try { removeIds = JSON.parse(req.body.remove_doc_ids || '[]'); } catch { removeIds = []; }
    removeIds = (Array.isArray(removeIds) ? removeIds : []).map(Number).filter(Boolean);

    const [docs] = await ikmPool.query('SELECT id, file_name FROM tr_complaint_doc WHERE complaint_id = ?', [c.id]);
    const toRemove = docs.filter((d) => removeIds.includes(d.id));
    if (docs.length - toRemove.length + files.length > MAX_PHOTOS) {
      return res.status(400).json({ success: false, message: `Maksimal ${MAX_PHOTOS} foto per komplain` });
    }

    const actor = actorOf(u);
    const next = { reporter_name: f.reporter, complaint_date: f.date, room_id: f.roomId, complaint_type: f.type,
      description: f.description, hospital_linen_id: v.linenId, ownership_type: v.ownership, quantity: v.qty };
    const prev = { reporter_name: c.reporter_name, complaint_date: String(c.complaint_date instanceof Date ? c.complaint_date.toISOString().slice(0, 10) : c.complaint_date).slice(0, 10),
      room_id: c.room_id, complaint_type: c.complaint_type, description: c.description, hospital_linen_id: c.hospital_linen_id, ownership_type: c.ownership_type, quantity: c.quantity };
    const changes = {};
    for (const k of Object.keys(next)) if (String(prev[k] ?? '') !== String(next[k] ?? '')) changes[k] = [prev[k] ?? null, next[k] ?? null];
    if (toRemove.length) changes.photos_removed = toRemove.length;
    if (files.length) changes.photos_added = files.length;

    conn = await ikmPool.getConnection();
    await conn.beginTransaction();
    // Guard status di UPDATE agar tidak menimpa komplain yang barusan di-approve
    const [upd] = await conn.query(
      `UPDATE tr_complaint SET room_id=?, reporter_name=?, complaint_date=?, complaint_type=?, description=?,
              hospital_linen_id=?, linen_category_id=?, ownership_type=?, quantity=?, updated_by=?
        WHERE id=? AND status='DIAJUKAN'`,
      [f.roomId, f.reporter, f.date, f.type, f.description, v.linenId, v.categoryId, v.ownership, v.qty, actor.name, c.id]);
    if (!upd.affectedRows) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Komplain sudah disetujui Tim Linen RS dan tidak bisa diubah' });
    }
    if (toRemove.length) await conn.query('DELETE FROM tr_complaint_doc WHERE id IN (?)', [toRemove.map((d) => d.id)]);
    written = saveFiles(files, fc.exts, c.id);
    for (let i = 0; i < written.length; i++) {
      await conn.query(
        'INSERT INTO tr_complaint_doc (complaint_id, file_name, original_name, mime_type, file_size, uploaded_by) VALUES (?,?,?,?,?,?)',
        [c.id, written[i], clean(files[i].originalname, 255), files[i].mimetype, files[i].size, actor.name]);
    }
    await writeLog(conn, { complaintId: c.id, number: c.complaint_number, action: 'UPDATED', from: 'DIAJUKAN', to: 'DIAJUKAN', actor, detail: changes });
    await conn.commit();
    unlinkFiles(toRemove.map((d) => d.file_name));
    emit(req, u.id, `Komplain ${c.complaint_number} diperbarui`);
    res.json({ success: true });
  } catch (e) {
    if (conn) await conn.rollback();
    unlinkFiles(written);
    serverError(res, 'updateComplaint', e);
  } finally {
    conn?.release();
  }
};

export const deleteComplaint = async (req, res) => {
  const u = req.user;
  let conn;
  try {
    const [cur] = await ikmPool.query('SELECT * FROM tr_complaint WHERE id = ? AND hospital_id = ?', [req.params.id, u.id]);
    if (!cur.length) return res.status(404).json({ success: false, message: 'Komplain tidak ditemukan' });
    const c = cur[0];
    if (!permsOf(c, u).can_delete) {
      return res.status(403).json({ success: false, message: c.status === 'DIAJUKAN' ? 'Anda tidak berhak menghapus komplain ini' : 'Komplain sudah disetujui Tim Linen RS dan tidak bisa dihapus' });
    }
    const [docs] = await ikmPool.query('SELECT file_name FROM tr_complaint_doc WHERE complaint_id = ?', [c.id]);

    conn = await ikmPool.getConnection();
    await conn.beginTransaction();
    const [del] = await conn.query("DELETE FROM tr_complaint WHERE id = ? AND status = 'DIAJUKAN'", [c.id]); // foto ikut terhapus (CASCADE)
    if (!del.affectedRows) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Komplain sudah disetujui Tim Linen RS dan tidak bisa dihapus' });
    }
    await writeLog(conn, { complaintId: c.id, number: c.complaint_number, action: 'DELETED', from: c.status, actor: actorOf(u), detail: { photos: docs.length, type: c.complaint_type } });
    await conn.commit();
    unlinkFiles(docs.map((d) => d.file_name));
    emit(req, u.id, `Komplain ${c.complaint_number} dihapus`);
    res.json({ success: true });
  } catch (e) {
    if (conn) await conn.rollback();
    serverError(res, 'deleteComplaint', e);
  } finally {
    conn?.release();
  }
};


// Dipakai controller Unit / RS / IKM
export { clean, actorOf, writeLog, emit, serverError, permsOf, photoUrl, SELECT_LIST, URL_PREFIX };
