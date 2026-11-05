import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { ikmPool } from '../db/pool.js';
import { parsePaging, buildPagination, offsetOf } from './paging.js';

const MAX_ITEMS = 10; // jumlah baris linen maksimal per komplain
const PHOTOS_PER_ITEM = 5; // foto bukti maksimal per baris linen
const MAX_SIZE = 5 * 1024 * 1024;
const URL_PREFIX = '/storage/assets/complaint';

// ───────────────────────── skema tabel ─────────────────────────
// Dibuat otomatis saat server start (idempotent), jadi tidak perlu menjalankan file .sql manual di production.
// Syarat: tr_complaint dan tr_complaint_doc sudah ada (dibuat/dipakai bersama Alora SuperApp).
const ensureComplaintSchema = async () => {
  try {
    await ikmPool.query(`
      CREATE TABLE IF NOT EXISTS tr_complaint_item (
        id bigint unsigned NOT NULL AUTO_INCREMENT,
        complaint_id bigint unsigned NOT NULL,
        hospital_linen_id bigint unsigned NOT NULL,
        linen_category_id bigint unsigned DEFAULT NULL,
        ownership_type enum('MILIK_RS','SEWA') DEFAULT NULL,
        quantity int unsigned NOT NULL,
        notes varchar(1000) DEFAULT NULL,
        created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_complaint_item_complaint (complaint_id),
        CONSTRAINT fk_complaint_item_complaint
          FOREIGN KEY (complaint_id) REFERENCES tr_complaint (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

    // Tabel lama (versi sebelum deskripsi diperpanjang) -> 1000 karakter
    const [[notesCol]] = await ikmPool.query(
      `SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tr_complaint_item' AND COLUMN_NAME = 'notes'`);
    if (notesCol && Number(notesCol.len) < 1000) {
      await ikmPool.query('ALTER TABLE tr_complaint_item MODIFY notes varchar(1000) DEFAULT NULL');
    }

    // Foto bukti menempel ke baris linen
    const [[itemCol]] = await ikmPool.query(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tr_complaint_doc' AND COLUMN_NAME = 'item_id'`);
    if (!Number(itemCol.n)) {
      await ikmPool.query(`
        ALTER TABLE tr_complaint_doc
          ADD COLUMN item_id bigint unsigned DEFAULT NULL AFTER complaint_id,
          ADD KEY idx_complaint_doc_item (item_id),
          ADD CONSTRAINT fk_complaint_doc_item FOREIGN KEY (item_id) REFERENCES tr_complaint_item (id) ON DELETE CASCADE`);
    }
  } catch (e) {
    console.error('[complaint] gagal menyiapkan skema tabel komplain:', e.message);
  }
};
ensureComplaintSchema();

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
  for (const n of names) fs.unlink(path.join(complaintDir(), path.basename(n)), () => { });
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

// Foto dikirim per baris linen: field `photos_<n>` (n = urutan baris pada daftar `items`, mulai 0).
export const uploadPhotos = (req, res, next) => {
  multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE, files: MAX_ITEMS * PHOTOS_PER_ITEM } })
    .any()(req, res, (err) => {
      if (!err) return next();
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran tiap foto maksimal 5 MB'
        : err.code === 'LIMIT_FILE_COUNT' ? `Maksimal ${PHOTOS_PER_ITEM} foto per linen`
          : 'Gagal membaca foto yang diunggah';
      res.status(400).json({ success: false, message: msg });
    });
};

// ───────────────────────── input parsing ─────────────────────────

// Daftar linen dikirim sebagai JSON di field `items` (FormData). null = format salah.
// `id` = id baris yang sudah tersimpan (mode ubah); kosong untuk baris baru.
// Tanpa `items`, field tunggal lama (hospital_linen_id/quantity/ownership_type) tetap diterima.
const parseItems = (b) => {
  if (b.items !== undefined) {
    let arr;
    try { arr = typeof b.items === 'string' ? JSON.parse(b.items) : b.items; } catch { return null; }
    if (!Array.isArray(arr)) return null;
    return arr.map((i) => ({
      id: Number(i?.id) || 0,
      linenId: Number(i?.hospital_linen_id) || 0,
      qty: Number.parseInt(i?.quantity, 10),
      ownership: clean(i?.ownership_type, 20).toUpperCase(),
      notes: clean(i?.notes, 1000),
    }));
  }
  const linenId = Number(b.hospital_linen_id) || 0;
  return linenId
    ? [{ id: 0, linenId, qty: Number.parseInt(b.quantity, 10), ownership: clean(b.ownership_type, 20).toUpperCase(), notes: '' }]
    : [];
};

// Deskripsi komplain tidak lagi diisi pelapor: keterangan ada di tiap baris linen.
const readFields = (b) => ({
  reporter: clean(b.reporter_name, 150),
  date: clean(b.complaint_date, 10),
  roomId: Number(b.room_id) || 0,
  type: clean(b.complaint_type, 100),
  items: parseItems(b),
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
  if (!f.roomId) return { error: 'Unit / ruangan wajib dipilih' };
  if (!f.date) f.date = new Date().toISOString().slice(0, 10);
  if (!validateDate(f.date)) return { error: 'Tanggal pengajuan tidak valid' };

  const [room] = await ikmPool.query('SELECT id FROM mst_rooms_rs WHERE id = ? AND hospital_id = ?', [f.roomId, hospitalId]);
  if (!room.length) return { error: 'Ruangan tidak ditemukan di rumah sakit ini' };

  // Minimal 1 baris linen (keterangan dan foto melekat pada baris linen). Linen yang sama boleh muncul lebih dari
  // sekali (mis. masalahnya berbeda), karena itu tidak ada pengecekan duplikat.
  if (f.items === null) return { error: 'Format daftar linen tidak valid' };
  if (!f.items.length) return { error: 'Pilih minimal 1 linen yang dikomplain' };
  if (f.items.length > MAX_ITEMS) return { error: `Maksimal ${MAX_ITEMS} linen per komplain` };
  for (const it of f.items) {
    if (!it.linenId) return { error: 'Linen wajib dipilih pada setiap baris' };
    if (!(it.qty >= 1)) return { error: 'Quantity wajib diisi (minimal 1) pada setiap linen' };
    if (!it.notes) return { error: 'Deskripsi komplain wajib diisi pada setiap linen' };
    if (it.ownership && !OWNERSHIPS.includes(it.ownership)) return { error: 'Kepemilikan tidak valid' };
  }
  const ids = [...new Set(f.items.map((i) => i.linenId))];
  const [lin] = await ikmPool.query(
    `SELECT hl.id, l.category_id, hl.ownership_type, ${LINEN_NAME_SQL} AS linen_name
       FROM mst_hospital_linen hl
       JOIN mst_linen l ON l.id = hl.linen_id
       JOIN mst_hospital_linen_rooms hlr ON hlr.hospital_linen_id = hl.id AND hlr.room_id = ?
       LEFT JOIN mst_size s ON s.id = l.size_id
       LEFT JOIN mst_color co ON co.id = l.color_id
       LEFT JOIN mst_material m ON m.id = l.material_id
      WHERE hl.hospital_id = ? AND hl.id IN (?)`, [f.roomId, hospitalId, ids]);
  const byId = new Map(lin.map((r) => [Number(r.id), r]));
  const items = [];
  for (const it of f.items) {
    const m = byId.get(it.linenId);
    if (!m) return { error: 'Linen tidak terdaftar di ruangan yang dipilih' };
    // Kategori dari master (tidak dipercaya dari klien); kepemilikan default dari master, boleh diubah pelapor
    items.push({ id: it.id, linenId: m.id, name: m.linen_name, categoryId: m.category_id ?? null, qty: it.qty, ownership: it.ownership || m.ownership_type, notes: it.notes || null });
  }
  return { items, description: composeDescription(items) };
};

// Kolom `description` di tr_complaint wajib terisi dan masih dibaca admin SuperApp, sedangkan pelapor kini mengisi
// keterangan per linen. Isinya diturunkan otomatis dari gabungan keterangan tiap linen.
const composeDescription = (items) => clean(
  items.map((i) => `${i.name} (${i.qty} pcs)${i.notes ? `: ${i.notes}` : ''}`).join('\n'), 5000);

// Kolom linen lama di tr_complaint diisi dengan baris pertama agar admin SuperApp (yang masih membaca kolom itu) tetap jalan
const legacyOf = (items) => {
  const f = items[0];
  return f ? { linenId: f.linenId, categoryId: f.categoryId, ownership: f.ownership, qty: f.qty } : { linenId: null, categoryId: null, ownership: null, qty: null };
};

const insertItem = async (conn, complaintId, i) => {
  const [r] = await conn.query(
    'INSERT INTO tr_complaint_item (complaint_id, hospital_linen_id, linen_category_id, ownership_type, quantity, notes) VALUES (?,?,?,?,?,?)',
    [complaintId, i.linenId, i.categoryId, i.ownership, i.qty, i.notes]);
  return r.insertId;
};

const updateItem = (conn, complaintId, itemId, i) => conn.query(
  'UPDATE tr_complaint_item SET hospital_linen_id=?, linen_category_id=?, ownership_type=?, quantity=?, notes=? WHERE id=? AND complaint_id=?',
  [i.linenId, i.categoryId, i.ownership, i.qty, i.notes, itemId, complaintId]);

const insertDoc = (conn, complaintId, itemId, name, file, actorName) => conn.query(
  'INSERT INTO tr_complaint_doc (complaint_id, item_id, file_name, original_name, mime_type, file_size, uploaded_by) VALUES (?,?,?,?,?,?,?)',
  [complaintId, itemId, name, clean(file.originalname, 255), file.mimetype, file.size, actorName]);

// Mengelompokkan file unggahan per baris linen (field `photos_<n>`). Mengembalikan Map<indexBaris, File[]>.
const groupFiles = (files, itemCount) => {
  const byIndex = new Map();
  for (const f of files || []) {
    const m = /^photos_(\d+)$/.exec(f.fieldname || '');
    const idx = m ? Number(m[1]) : -1;
    if (idx < 0 || idx >= itemCount) return { error: 'Foto harus dilampirkan pada baris linen yang valid' };
    if (!byIndex.has(idx)) byIndex.set(idx, []);
    byIndex.get(idx).push(f);
  }
  return { byIndex };
};

// Menempelkan foto ke tiap baris linen (berdasarkan item_id). Foto tanpa item_id (tingkat komplain, mis. data lama)
// dikembalikan terpisah sebagai `general`.
export const splitPhotos = (docs, items) => {
  const photos = docs.map((d) => ({ id: d.id, item_id: d.item_id, url: photoUrl(d.file_name), name: d.original_name }));
  return {
    items: items.map((it) => ({ ...it, photos: it.id ? photos.filter((p) => Number(p.item_id) === Number(it.id)) : [] })),
    general: photos.filter((p) => !p.item_id),
  };
};

const ITEM_SELECT = `
  SELECT i.id, i.complaint_id, i.hospital_linen_id, ${LINEN_NAME_SQL} AS linen_name, lc.category_name,
         i.ownership_type, i.quantity, i.notes
    FROM tr_complaint_item i
    LEFT JOIN mst_hospital_linen hl ON hl.id = i.hospital_linen_id
    LEFT JOIN mst_linen l ON l.id = hl.linen_id
    LEFT JOIN mst_size s ON s.id = l.size_id
    LEFT JOIN mst_color co ON co.id = l.color_id
    LEFT JOIN mst_material m ON m.id = l.material_id
    LEFT JOIN mst_linen_category lc ON lc.id = i.linen_category_id`;

// Menempelkan `items` ke tiap baris komplain (satu query untuk semua baris).
// Komplain lama tanpa baris item tetapi punya linen di kolom lama dibaca sebagai satu item (tanpa mengubah data).
export const attachItems = async (rows) => {
  if (!rows.length) return rows;
  const [found] = await ikmPool.query(`${ITEM_SELECT} WHERE i.complaint_id IN (?) ORDER BY i.id`, [rows.map((r) => r.id)]);
  const byComplaint = new Map();
  for (const it of found) {
    if (!byComplaint.has(it.complaint_id)) byComplaint.set(it.complaint_id, []);
    byComplaint.get(it.complaint_id).push(it);
  }
  return rows.map((r) => ({
    ...r,
    items: byComplaint.get(r.id) || (r.hospital_linen_id
      ? [{ id: null, complaint_id: r.id, hospital_linen_id: r.hospital_linen_id, linen_name: r.linen_name, category_name: r.category_name, ownership_type: r.ownership_type, quantity: r.quantity, notes: null }]
      : []),
  }));
};

// Pastikan file benar-benar gambar, kembalikan ekstensi dari isi file
const checkFiles = (files) => {
  const exts = [];
  for (const f of files || []) {
    const ext = sniff(f.buffer);
    if (!ext) return { error: 'Foto harus berformat JPG, PNG, atau WEBP' };
    f.ext = ext;
    exts.push(ext);
  }
  return { exts };
};

const saveFile = (f, complaintId, itemId, seq) => {
  fs.mkdirSync(complaintDir(), { recursive: true });
  const name = `${complaintId}_${itemId}_${Date.now()}_${seq}.${f.ext}`;
  fs.writeFileSync(path.join(complaintDir(), name), f.buffer);
  return name;
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
      maxPhotos: PHOTOS_PER_ITEM,
      maxItems: MAX_ITEMS,
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

// Filter rentang Tanggal Pengajuan (complaint_date). Nilai selain YYYY-MM-DD diabaikan.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const addDateRange = (query, where, params) => {
  const from = String(query.startDate || '');
  const to = String(query.endDate || '');
  if (DATE_RE.test(from)) { where.push('c.complaint_date >= ?'); params.push(from); }
  if (DATE_RE.test(to)) { where.push('c.complaint_date <= ?'); params.push(to); }
};

export const listComplaints = async (req, res) => {
  try {
    const u = req.user;
    const where = ['c.hospital_id = ?'];
    const params = [u.id];
    const paging = parsePaging(req.query);

    if (req.query.mine === '1' && u.role === 'unit' && u.userUnitId) {
      const rooms = (u.roomIds || []).map(Number).filter(Boolean);
      if (!rooms.length) return res.json({ success: true, data: [], pagination: buildPagination(paging, 0) });
      where.push('c.room_id IN (?)');
      params.push(rooms);
    }
    if (req.query.status) { where.push('c.status = ?'); params.push(String(req.query.status)); }
    addDateRange(req.query, where, params);
    const q = clean(req.query.q, 100);
    if (q) {
      where.push('(c.complaint_number LIKE ? OR c.complaint_type LIKE ? OR c.reporter_name LIKE ? OR c.description LIKE ?)');
      params.push(...Array(4).fill(`%${q}%`));
    }
    const whereSql = where.join(' AND ');
    const [[{ total }]] = await ikmPool.query(`SELECT COUNT(*) AS total FROM tr_complaint c WHERE ${whereSql}`, params);
    const pagination = buildPagination(paging, total);
    const [rows] = await ikmPool.query(
      `${SELECT_LIST} WHERE ${whereSql} ORDER BY c.created_at DESC, c.id DESC LIMIT ? OFFSET ?`,
      [...params, pagination.limit, offsetOf(pagination)]);
    const withItems = await attachItems(rows);
    res.json({ success: true, data: withItems.map((c) => ({ ...c, ...permsOf(c, u) })), pagination });
  } catch (e) { serverError(res, 'listComplaints', e); }
};

export const getComplaint = async (req, res) => {
  try {
    const u = req.user;
    const [rows] = await ikmPool.query(`${SELECT_LIST} WHERE c.id = ? AND c.hospital_id = ?`, [req.params.id, u.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Komplain tidak ditemukan' });
    const [docs] = await ikmPool.query('SELECT id, item_id, file_name, original_name FROM tr_complaint_doc WHERE complaint_id = ? ORDER BY id', [req.params.id]);
    const [logs] = await ikmPool.query(
      `SELECT id, action, from_status, to_status, note, detail, actor_name, actor_role, created_at
         FROM tr_complaint_log WHERE complaint_id = ? ORDER BY id`, [req.params.id]);
    const [row] = await attachItems([rows[0]]);
    const ph = splitPhotos(docs, row.items);
    res.json({
      success: true,
      data: {
        ...row,
        ...permsOf(rows[0], u),
        items: ph.items, // tiap baris linen membawa foto buktinya sendiri
        photos: ph.general, // foto tingkat komplain (tanpa baris linen), mis. data lama
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
    const grp = groupFiles(files, v.items.length);
    if (grp.error) return res.status(400).json({ success: false, message: grp.error });
    if ([...grp.byIndex.values()].some((a) => a.length > PHOTOS_PER_ITEM)) {
      return res.status(400).json({ success: false, message: `Maksimal ${PHOTOS_PER_ITEM} foto per linen` });
    }

    const actor = actorOf(u);
    const lg = legacyOf(v.items);
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
          [number, u.id, f.roomId, f.reporter, f.date, f.type, v.description, lg.linenId, lg.categoryId, lg.ownership, lg.qty,
            actor.username || actor.name, u.userUnitId || null, u.role, actor.name]);
        const id = ins.insertId;
        let seq = 0;
        for (let idx = 0; idx < v.items.length; idx++) {
          const itemId = await insertItem(conn, id, v.items[idx]);
          for (const file of grp.byIndex.get(idx) || []) {
            const name = saveFile(file, id, itemId, seq++);
            written.push(name);
            await insertDoc(conn, id, itemId, name, file, actor.name);
          }
        }
        await writeLog(conn, { complaintId: id, number, action: 'CREATED', to: 'DIAJUKAN', actor, detail: { photos: written.length, items: v.items.length } });
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

    const grp = groupFiles(files, v.items.length);
    if (grp.error) return res.status(400).json({ success: false, message: grp.error });

    let removeIds = [];
    try { removeIds = JSON.parse(req.body.remove_doc_ids || '[]'); } catch { removeIds = []; }
    removeIds = (Array.isArray(removeIds) ? removeIds : []).map(Number).filter(Boolean);

    // Baris linen yang tersimpan: dipakai untuk memperbarui (bukan menghapus-ulang) agar foto per baris tetap menempel
    const [oldRows] = await ikmPool.query(
      'SELECT id, hospital_linen_id AS linenId, ownership_type AS ownership, quantity AS qty, notes FROM tr_complaint_item WHERE complaint_id = ? ORDER BY id', [c.id]);
    const curIds = new Set(oldRows.map((r) => Number(r.id)));
    const sentIds = v.items.filter((i) => i.id).map((i) => i.id);
    if (sentIds.some((id) => !curIds.has(id)) || new Set(sentIds).size !== sentIds.length) {
      return res.status(400).json({ success: false, message: 'Baris linen tidak valid, muat ulang halaman' });
    }
    const dropItemIds = [...curIds].filter((id) => !sentIds.includes(id)); // baris yang dibuang beserta fotonya

    const [docs] = await ikmPool.query('SELECT id, item_id, file_name FROM tr_complaint_doc WHERE complaint_id = ?', [c.id]);
    const toRemove = docs.filter((d) => removeIds.includes(d.id) || (d.item_id && dropItemIds.includes(Number(d.item_id))));
    const removedIds = new Set(toRemove.map((d) => d.id));
    for (let idx = 0; idx < v.items.length; idx++) {
      const it = v.items[idx];
      const kept = it.id ? docs.filter((d) => Number(d.item_id) === it.id && !removedIds.has(d.id)).length : 0;
      if (kept + (grp.byIndex.get(idx) || []).length > PHOTOS_PER_ITEM) {
        return res.status(400).json({ success: false, message: `Maksimal ${PHOTOS_PER_ITEM} foto per linen` });
      }
    }

    const actor = actorOf(u);
    const lg = legacyOf(v.items);
    const next = { reporter_name: f.reporter, complaint_date: f.date, room_id: f.roomId, complaint_type: f.type };
    const prev = {
      reporter_name: c.reporter_name, complaint_date: String(c.complaint_date instanceof Date ? c.complaint_date.toISOString().slice(0, 10) : c.complaint_date).slice(0, 10),
      room_id: c.room_id, complaint_type: c.complaint_type
    };
    const changes = {};
    for (const k of Object.keys(next)) if (String(prev[k] ?? '') !== String(next[k] ?? '')) changes[k] = [prev[k] ?? null, next[k] ?? null];

    // Perubahan daftar linen dicatat ringkas (id linen, kepemilikan, jumlah, keterangan)
    const sig = (arr) => arr.map((i) => ({ linen: Number(i.linenId), own: i.ownership ?? null, qty: Number(i.qty), notes: i.notes || null }));
    const oldItems = oldRows.length ? oldRows
      : (c.hospital_linen_id ? [{ linenId: c.hospital_linen_id, ownership: c.ownership_type, qty: c.quantity, notes: null }] : []);
    const oldSig = sig(oldItems);
    const newSig = sig(v.items);
    if (JSON.stringify(oldSig) !== JSON.stringify(newSig)) changes.items = [oldSig, newSig];
    if (toRemove.length) changes.photos_removed = toRemove.length;
    if (files.length) changes.photos_added = files.length;

    conn = await ikmPool.getConnection();
    await conn.beginTransaction();
    // Guard status di UPDATE agar tidak menimpa komplain yang barusan di-approve
    const [upd] = await conn.query(
      `UPDATE tr_complaint SET room_id=?, reporter_name=?, complaint_date=?, complaint_type=?, description=?,
              hospital_linen_id=?, linen_category_id=?, ownership_type=?, quantity=?, updated_by=?
        WHERE id=? AND status='DIAJUKAN'`,
      [f.roomId, f.reporter, f.date, f.type, v.description, lg.linenId, lg.categoryId, lg.ownership, lg.qty, actor.name, c.id]);
    if (!upd.affectedRows) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Komplain sudah disetujui Tim Linen RS dan tidak bisa diubah' });
    }
    // Foto yang dibuang (termasuk foto baris yang dihapus) dihapus dulu, baru baris linennya
    if (toRemove.length) await conn.query('DELETE FROM tr_complaint_doc WHERE id IN (?)', [toRemove.map((d) => d.id)]);
    if (dropItemIds.length) await conn.query('DELETE FROM tr_complaint_item WHERE id IN (?) AND complaint_id = ?', [dropItemIds, c.id]);
    let seq = 0;
    for (let idx = 0; idx < v.items.length; idx++) {
      const it = v.items[idx];
      let itemId = it.id;
      if (itemId) await updateItem(conn, c.id, itemId, it);
      else itemId = await insertItem(conn, c.id, it);
      for (const file of grp.byIndex.get(idx) || []) {
        const name = saveFile(file, c.id, itemId, seq++);
        written.push(name);
        await insertDoc(conn, c.id, itemId, name, file, actor.name);
      }
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
    // Baris linen ikut terhapus lewat relasi CASCADE. tr_complaint_doc tidak punya relasi ke komplain, jadi fotonya dihapus eksplisit.
    const [del] = await conn.query("DELETE FROM tr_complaint WHERE id = ? AND status = 'DIAJUKAN'", [c.id]);
    if (!del.affectedRows) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Komplain sudah disetujui Tim Linen RS dan tidak bisa dihapus' });
    }
    await conn.query('DELETE FROM tr_complaint_doc WHERE complaint_id = ?', [c.id]);
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
export { clean, actorOf, writeLog, emit, serverError, permsOf, photoUrl, SELECT_LIST, URL_PREFIX, addDateRange };
