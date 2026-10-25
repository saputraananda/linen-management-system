import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Plus, Search, ChevronDown, RefreshCw, X, Pencil, Trash2, ImagePlus, CheckCircle2, XCircle,
  MessageSquareWarning, Package, Camera, Clock,
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import useBodyScrollLock from '../utils/useBodyScrollLock';
import { socket } from '../utils/socket';

const base = (role) => `/api/${role}/complaint`;
const MAX_PHOTOS = 5;
const MAX_SIZE = 5 * 1024 * 1024;

export function PhotoGrid({ photos }) {
  const [idx, setIdx] = useState(null);
  useBodyScrollLock(idx !== null);
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((p, i) => (
          <button type="button" key={p.id} onClick={() => setIdx(i)} className="block aspect-square cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <img src={p.url} alt={p.name || 'Foto bukti'} className="h-full w-full object-cover transition hover:scale-105" loading="lazy" />
          </button>
        ))}
      </div>
      {idx !== null && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => setIdx(null)}>
          <button type="button" onClick={() => setIdx(null)} aria-label="Tutup" className="absolute right-4 top-4 cursor-pointer rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X className="h-5 w-5" /></button>
          <img src={photos[idx].url} alt={photos[idx].name || 'Foto bukti'} onClick={(e) => e.stopPropagation()} className="max-h-[85dvh] max-w-full rounded-xl object-contain shadow-2xl" />
          {photos.length > 1 && (
            <div className="absolute bottom-5 flex items-center gap-3 rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold text-white" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="cursor-pointer px-1" onClick={() => setIdx((idx - 1 + photos.length) % photos.length)}>‹</button>
              <span>{idx + 1} / {photos.length}</span>
              <button type="button" className="cursor-pointer px-1" onClick={() => setIdx((idx + 1) % photos.length)}>›</button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
export const STATUS = {
  DIAJUKAN: { label: 'Diajukan', cls: 'bg-amber-50 text-amber-700 border-amber-100', bar: 'bg-amber-400' },
  DISETUJUI_RS: { label: 'Disetujui Tim Linen RS', cls: 'bg-sky-50 text-sky-700 border-sky-100', bar: 'bg-sky-500' },
  DIPROSES: { label: 'Diproses', cls: 'bg-indigo-50 text-indigo-700 border-indigo-100', bar: 'bg-indigo-500' },
  SELESAI: { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', bar: 'bg-emerald-500' },
  DITOLAK: { label: 'Ditolak', cls: 'bg-rose-50 text-rose-700 border-rose-100', bar: 'bg-rose-500' },
};
export const ACTION = {
  CREATED: 'Komplain diajukan', UPDATED: 'Komplain diubah', APPROVED: 'Disetujui Tim Linen RS',
  REJECTED: 'Ditolak', STATUS: 'Status diubah', NOTE: 'Catatan', DELETED: 'Komplain dihapus',
};

export const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1ea59e] focus:bg-white focus:ring-4 focus:ring-[#1ea59e]/10';
export const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400';

export const OWNERSHIP = { MILIK_RS: 'Milik RS', SEWA: 'Sewa' };

const todayStr = () => new Date().toLocaleDateString('en-CA');
export const fmtDate = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-');
export const fmtDateTime = (s) => (s ? new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
export const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
export const errMsg = (e, fallback) => e.response?.data?.message || fallback;

export function Badge({ status }) {
  const s = STATUS[status] || STATUS.DIAJUKAN;
  return <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
}

// Modal standar: portal ke body, z-[9999], scroll halaman terkunci, hanya ditutup lewat tombol X
export function Modal({ title, subtitle, onClose, children, footer, wide = false }) {
  useBodyScrollLock(true);
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center overscroll-contain bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" style={{ colorScheme: 'light' }}>
      <div className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-100 bg-white text-slate-800 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex shrink-0 items-start justify-between bg-gradient-to-r from-[#126776] to-[#1ea59e] p-5 text-white sm:p-6">
          <div className="min-w-0">
            {subtitle && <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">{subtitle}</p>}
            <h3 className="mt-1 truncate text-lg font-bold tracking-tight">{title}</h3>
          </div>
          <button type="button" aria-label="Tutup" onClick={onClose} className="cursor-pointer rounded-xl p-1 text-white/80 transition hover:bg-white/10 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-5 sm:p-6">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-slate-100 bg-white p-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ComplaintPage({ role }) {
  const isUnitNurse = role === 'unit' && !!localStorage.getItem('nurseName');
  const defaultReporter = localStorage.getItem('nurseName') || localStorage.getItem('fullName') || '';
  const hospitalId = localStorage.getItem('employeeId');
  const hospitalName = localStorage.getItem('fullName') || 'Rumah Sakit';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(isUnitNurse); // default: hanya unit milik sendiri
  const [opts, setOpts] = useState({ rooms: [], categories: [], myRoomIds: [] });
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get(base(role), {
        ...auth(), params: { q: search || undefined, status: status || undefined, mine: mine ? 1 : undefined },
      });
      setItems(data.data);
      setError('');
    } catch (e) {
      setError(errMsg(e, 'Gagal memuat komplain'));
    } finally {
      setLoading(false);
    }
  }, [role, search, status, mine]);

  useEffect(() => { const t = setTimeout(() => load(), 250); return () => clearTimeout(t); }, [load]);

  useEffect(() => {
    axios.get(`${base(role)}/options`, auth()).then(({ data }) => setOpts(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const openDetail = useCallback(async (id) => {
    try {
      const { data } = await axios.get(`${base(role)}/${id}`, auth());
      setDetail(data.data);
    } catch (e) {
      setError(errMsg(e, 'Gagal membuka komplain'));
      setDetail(null);
    }
  }, [role]);

  // Realtime: komplain baru / status berubah
  useEffect(() => {
    if (!hospitalId) return undefined;
    socket.connect();
    socket.emit('join_hospital', hospitalId);
    const onChange = (ev) => {
      if (ev?.type !== 'COMPLAINT') return;
      load(true);
      setDetail((d) => { if (d) openDetail(d.id); return d; });
    };
    socket.on('data_changed', onChange);
    return () => { socket.off('data_changed', onChange); socket.disconnect(); };
  }, [hospitalId, load, openDetail]);

  const roomName = (id) => opts.rooms.find((r) => Number(r.id) === Number(id))?.room_name || '-';

  const openForm = (c = null) => {
    setError('');
    if (c) {
      setForm({
        id: c.id, reporter_name: c.reporter_name, complaint_date: String(c.complaint_date).slice(0, 10),
        room_id: String(c.room_id), complaint_type: c.complaint_type, description: c.description,
        hospital_linen_id: c.hospital_linen_id ? String(c.hospital_linen_id) : '', ownership_type: c.ownership_type || '', quantity: c.quantity ? String(c.quantity) : '',
        photos: c.photos || [], removeIds: [], newFiles: [],
      });
    } else {
      setForm({
        id: null, reporter_name: defaultReporter, complaint_date: todayStr(),
        room_id: String(opts.myRoomIds[0] || ''), complaint_type: '', description: '',
        hospital_linen_id: '', ownership_type: '', quantity: '', photos: [], removeIds: [], newFiles: [],
      });
    }
  };

  const doApprove = async (c) => {
    setBusy(true);
    try {
      await axios.post(`${base(role)}/${c.id}/approve`, {}, auth());
      await Promise.all([load(true), openDetail(c.id)]);
    } catch (e) { setError(errMsg(e, 'Gagal menyetujui komplain')); } finally { setBusy(false); }
  };

  const doDelete = async (c) => {
    try {
      await axios.delete(`${base(role)}/${c.id}`, auth());
      setDetail(null);
      load(true);
    } catch (e) { setError(errMsg(e, 'Gagal menghapus komplain')); }
  };

  return (
    <div className="min-h-full bg-slate-50/50 py-6 text-slate-800" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">Komplain</h2>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {hospitalName} · Ajukan dan pantau komplain linen. Komplain bisa diubah atau dihapus selama belum disetujui Tim Linen RS.
            </p>
          </div>
          <button type="button" onClick={() => openForm()} className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#126776] to-[#1ea59e] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#126776]/20 transition hover:shadow-lg active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Ajukan Komplain
          </button>
        </div>

        {notice && <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}
        {error && !form && <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Cari nomor, jenis, pelapor, atau deskripsi..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10" />
            </div>
            <div className="relative">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full min-w-[160px] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-9 text-xs font-semibold text-slate-700 outline-none focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10 lg:w-auto">
                <option value="">Semua Status</option>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-3.5 w-3.5 text-slate-400" />
            </div>
            {isUnitNurse && (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700">
                <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4 accent-[#126776]" />
                Hanya unit saya
              </label>
            )}
            <button type="button" title="Muat ulang" onClick={() => { setSearch(''); setStatus(''); setMine(isUnitNurse); load(); }} className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#1ea59e]" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <MessageSquareWarning className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <h4 className="text-base font-bold text-slate-700">Belum ada komplain</h4>
            <p className="mt-1 text-xs text-slate-400">Klik "Ajukan Komplain" untuk membuat komplain baru, atau ubah filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {items.map((c) => (
              <div key={c.id} onClick={() => openDetail(c.id)} className="group relative flex cursor-pointer flex-col gap-2 px-5 py-4 transition hover:bg-slate-50/70 lg:flex-row lg:items-center lg:gap-6">
                <div className={`absolute bottom-0 left-0 top-0 w-1 rounded-r-full ${(STATUS[c.status] || STATUS.DIAJUKAN).bar}`} />
                <div className="min-w-0 pl-2 lg:w-1/3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-slate-800">{c.complaint_number}</p>
                    <Badge status={c.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{c.complaint_type}</p>
                </div>
                <div className="min-w-0 flex-1 pl-2 lg:pl-0">
                  <p className="line-clamp-2 text-xs font-medium text-slate-600">{c.description}</p>
                  {c.linen_name && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <Package className="h-3 w-3" /> {c.linen_name}{c.category_name ? ` · ${c.category_name}` : ''}{c.ownership_type ? ` · ${OWNERSHIP[c.ownership_type]}` : ''} · {c.quantity} pcs
                    </p>
                  )}
                </div>
                <div className="pl-2 text-[11px] font-medium text-slate-500 lg:w-56 lg:pl-0">
                  <p className="font-semibold text-slate-700">{c.room_name || '-'}</p>
                  <p>{c.reporter_name} · {fmtDate(c.complaint_date)}</p>
                  {c.photo_count > 0 && <p className="mt-0.5 flex items-center gap-1"><Camera className="h-3 w-3" /> {c.photo_count} foto</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detail && (
        <Modal
          wide
          subtitle="Detail Komplain"
          title={detail.complaint_number}
          onClose={() => setDetail(null)}
          footer={(
            <>
              {detail.can_delete && <button type="button" onClick={() => setDelTarget(detail)} className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"><Trash2 className="h-4 w-4" /> Hapus</button>}
              {detail.can_edit && <button type="button" onClick={() => { const d = detail; setDetail(null); openForm(d); }} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><Pencil className="h-4 w-4" /> Ubah</button>}
              {detail.can_approve && (
                <>
                  <button type="button" disabled={busy} onClick={() => setRejecting(detail)} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"><XCircle className="h-4 w-4" /> Tolak</button>
                  <button type="button" disabled={busy} onClick={() => doApprove(detail)} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-[#126776] to-[#1ea59e] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#126776]/20 transition active:scale-[0.98] disabled:opacity-60"><CheckCircle2 className="h-4 w-4" /> Setujui</button>
                </>
              )}
            </>
          )}
        >
          {error && <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
          <div className="flex flex-wrap items-center gap-2"><Badge status={detail.status} /><span className="text-xs font-semibold text-slate-500">{detail.complaint_type}</span></div>
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-3">
            <div><p className={labelCls}>Pelapor</p><p className="font-bold text-slate-800">{detail.reporter_name}</p></div>
            <div><p className={labelCls}>Tanggal Pengajuan</p><p className="font-bold text-slate-800">{fmtDate(detail.complaint_date)}</p></div>
            <div><p className={labelCls}>Unit</p><p className="font-bold text-slate-800">{detail.room_name || '-'}</p></div>
            {detail.linen_name && (
              <>
                <div><p className={labelCls}>Linen</p><p className="font-bold text-slate-800">{detail.linen_name}</p></div>
                <div><p className={labelCls}>Kategori</p><p className="font-bold text-slate-800">{detail.category_name || '-'}</p></div>
                <div><p className={labelCls}>Kepemilikan</p><p className="font-bold text-slate-800">{OWNERSHIP[detail.ownership_type] || '-'}</p></div>
                <div><p className={labelCls}>Quantity</p><p className="font-bold text-slate-800">{detail.quantity} pcs</p></div>
              </>
            )}
          </div>
          <div><p className={labelCls}>Deskripsi</p><p className="whitespace-pre-wrap text-sm font-medium text-slate-700">{detail.description}</p></div>
          {detail.photos.length > 0 && (
            <div>
              <p className={labelCls}>Foto Bukti ({detail.photos.length})</p>
              <PhotoGrid photos={detail.photos} />
            </div>
          )}
          <div>
            <p className={labelCls}>Riwayat</p>
            <ol className="space-y-3 border-l-2 border-slate-100 pl-4">
              {detail.logs.map((l) => (
                <li key={l.id} className="relative">
                  <span className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#1ea59e]" />
                  <p className="text-xs font-bold text-slate-800">
                    {ACTION[l.action] || l.action}{l.actor_role === 'admin' && (l.action === 'APPROVED' || l.action === 'REJECTED') ? ' (Admin Alora mewakili Tim Linen RS)' : ''}
                    {l.to_status && l.action !== 'NOTE' && <span className="ml-1 font-semibold text-slate-400">→ {(STATUS[l.to_status] || {}).label || l.to_status}</span>}
                  </p>
                  {l.note && <p className="mt-0.5 whitespace-pre-wrap rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600">{l.note}</p>}
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400"><Clock className="h-3 w-3" /> {l.actor_name}{l.actor_role === 'admin' ? ' (Admin Alora)' : ''} · {fmtDateTime(l.created_at)}</p>
                </li>
              ))}
            </ol>
          </div>
        </Modal>
      )}

      {form && <ComplaintForm role={role} form={form} setForm={setForm} opts={opts} roomName={roomName} error={error} setError={setError}
        onClose={() => setForm(null)} onSaved={(msg) => { setForm(null); setNotice(msg); load(true); }} />}

      {rejecting && <RejectModal role={role} complaint={rejecting} onClose={() => setRejecting(null)}
        onDone={async () => { const id = rejecting.id; setRejecting(null); await Promise.all([load(true), openDetail(id)]); }} />}

      <ConfirmDialog isOpen={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => doDelete(delTarget)}
        title="Hapus Komplain" message={`Hapus komplain ${delTarget?.complaint_number}? Foto bukti ikut terhapus dan tindakan ini tidak bisa dibatalkan.`} confirmText="Hapus" />
    </div>
  );
}

function RejectModal({ role, complaint, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!note.trim()) { setErr('Alasan penolakan wajib diisi'); return; }
    setSaving(true);
    try {
      await axios.post(`${base(role)}/${complaint.id}/reject`, { note }, auth());
      onDone();
    } catch (ex) { setErr(errMsg(ex, 'Gagal menolak komplain')); setSaving(false); }
  };
  return (
    <Modal subtitle="Tolak Komplain" title={complaint.complaint_number} onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Batal</button>
          <button type="submit" form="reject-form" disabled={saving} className="cursor-pointer rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-60">{saving ? 'Menyimpan...' : 'Tolak Komplain'}</button>
        </>
      )}>
      <form id="reject-form" onSubmit={submit} className="space-y-3">
        {err && <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{err}</div>}
        <div>
          <label className={labelCls}>Alasan Penolakan</label>
          <textarea rows={4} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Jelaskan alasan komplain ditolak..." />
        </div>
        <p className="text-[11px] font-medium text-slate-400">Setelah ditolak, komplain terkunci dan alasan terlihat oleh pelapor.</p>
      </form>
    </Modal>
  );
}

function ComplaintForm({ role, form, setForm, opts, roomName, error, setError, onClose, onSaved }) {
  const [linens, setLinens] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!form.room_id) { setLinens([]); return; }
    axios.get(`${base(role)}/linen-options`, { ...auth(), params: { roomId: form.room_id } })
      .then(({ data }) => setLinens(data.data)).catch(() => setLinens([]));
  }, [form.room_id]);

  const chosen = linens.find((l) => String(l.hospital_linen_id) === String(form.hospital_linen_id));
  const keptPhotos = form.photos.filter((p) => !form.removeIds.includes(p.id));
  const total = keptPhotos.length + form.newFiles.length;

  const previews = useMemo(() => form.newFiles.map((f) => URL.createObjectURL(f)), [form.newFiles]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const next = [];
    for (const f of picked) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setError('Foto harus berformat JPG, PNG, atau WEBP'); return; }
      if (f.size > MAX_SIZE) { setError('Ukuran tiap foto maksimal 5 MB'); return; }
      next.push(f);
    }
    if (total + next.length > MAX_PHOTOS) { setError(`Maksimal ${MAX_PHOTOS} foto per komplain`); return; }
    setError('');
    setForm((f) => ({ ...f, newFiles: [...f.newFiles, ...next] }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.hospital_linen_id && !(Number(form.quantity) >= 1)) { setError('Quantity wajib diisi (minimal 1) jika memilih linen'); return; }
    const fd = new FormData();
    ['reporter_name', 'complaint_date', 'room_id', 'complaint_type', 'description'].forEach((k) => fd.append(k, form[k]));
    if (form.hospital_linen_id) { fd.append('hospital_linen_id', form.hospital_linen_id); fd.append('ownership_type', form.ownership_type); fd.append('quantity', form.quantity); }
    form.newFiles.forEach((f) => fd.append('photos', f));
    if (form.id) fd.append('remove_doc_ids', JSON.stringify(form.removeIds));
    setSaving(true);
    try {
      const { data } = form.id
        ? await axios.put(`${base(role)}/${form.id}`, fd, auth())
        : await axios.post(base(role), fd, auth());
      onSaved(form.id ? 'Komplain berhasil diperbarui' : `Komplain ${data.complaint_number} berhasil diajukan`);
    } catch (ex) {
      setError(errMsg(ex, 'Gagal menyimpan komplain'));
      setSaving(false);
    }
  };

  return (
    <Modal wide subtitle="Komplain" title={form.id ? 'Ubah Komplain' : 'Ajukan Komplain'} onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Batal</button>
          <button type="submit" form="complaint-form" disabled={saving} className="cursor-pointer rounded-xl bg-gradient-to-r from-[#126776] to-[#1ea59e] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#126776]/20 transition active:scale-[0.98] disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </>
      )}>
      <form id="complaint-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {error && <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 sm:col-span-2">{error}</div>}
        <div>
          <label className={labelCls}>Nama Pelapor</label>
          <input className={inputCls} required value={form.reporter_name} onChange={set('reporter_name')} />
        </div>
        <div>
          <label className={labelCls}>Tanggal Pengajuan</label>
          <input type="date" className={inputCls} required max={todayStr()} value={form.complaint_date} onChange={set('complaint_date')} />
        </div>
        <div>
          <label className={labelCls}>Unit / Ruangan</label>
          <div className="relative">
            <select className={`${inputCls} cursor-pointer appearance-none pr-9`} required value={form.room_id}
              onChange={(e) => setForm((f) => ({ ...f, room_id: e.target.value, hospital_linen_id: '', ownership_type: '', quantity: '' }))}>
              <option value="">Pilih unit...</option>
              {opts.rooms.map((r) => <option key={r.id} value={r.id}>{r.room_name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Jenis Komplain</label>
          <input className={inputCls} required list="complaint-types" maxLength={100} placeholder="Contoh: Linen rusak" value={form.complaint_type} onChange={set('complaint_type')} />
          <datalist id="complaint-types">{opts.categories.map((c) => <option key={c.id} value={c.category_name} />)}</datalist>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:col-span-2">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Linen yang dikomplain (opsional)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <div className="sm:col-span-2">
              <label className={labelCls}>Linen</label>
              <div className="relative">
                <select className={`${inputCls} cursor-pointer appearance-none bg-white pr-9`} value={form.hospital_linen_id} disabled={!form.room_id}
                  onChange={(e) => {
                    const l = linens.find((x) => String(x.hospital_linen_id) === e.target.value);
                    setForm((f) => ({ ...f, hospital_linen_id: e.target.value, ownership_type: l ? l.ownership_type : '', quantity: e.target.value ? (f.quantity || '1') : '' }));
                  }}>
                  <option value="">{form.room_id ? (linens.length ? 'Pilih linen...' : 'Tidak ada linen di unit ini') : 'Pilih unit dulu'}</option>
                  {linens.map((l) => <option key={l.hospital_linen_id} value={l.hospital_linen_id}>{l.linen_name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Kategori (otomatis)</label>
              <input className={`${inputCls} cursor-not-allowed text-slate-500`} readOnly tabIndex={-1} value={chosen ? (chosen.category_name || '-') : ''} placeholder="Terisi otomatis" />
            </div>
            <div>
              <label className={labelCls}>Kepemilikan</label>
              <div className="relative">
                <select className={`${inputCls} cursor-pointer appearance-none bg-white pr-9`} disabled={!form.hospital_linen_id} value={form.ownership_type} onChange={set('ownership_type')}>
                  <option value="" disabled>Pilih...</option>
                  {Object.entries(OWNERSHIP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Quantity</label>
              <input type="number" min="1" className={inputCls} disabled={!form.hospital_linen_id} value={form.quantity} onChange={set('quantity')} placeholder="0" />
            </div>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls}>Deskripsi Komplain</label>
          <textarea rows={4} className={inputCls} required maxLength={5000} placeholder="Jelaskan komplain secara rinci..." value={form.description} onChange={set('description')} />
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls}>Foto Bukti ({total}/{MAX_PHOTOS})</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {keptPhotos.map((p) => (
              <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Hapus foto" onClick={() => setForm((f) => ({ ...f, removeIds: [...f.removeIds, p.id] }))} className="absolute right-1 top-1 cursor-pointer rounded-full bg-slate-900/70 p-1 text-white transition hover:bg-rose-600"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {previews.map((u, i) => (
              <div key={u} className="relative aspect-square overflow-hidden rounded-xl border border-[#1ea59e]/40 bg-slate-100">
                <img src={u} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Hapus foto" onClick={() => setForm((f) => ({ ...f, newFiles: f.newFiles.filter((_, j) => j !== i) }))} className="absolute right-1 top-1 cursor-pointer rounded-full bg-slate-900/70 p-1 text-white transition hover:bg-rose-600"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {total < MAX_PHOTOS && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 transition hover:border-[#1ea59e] hover:text-[#126776]">
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px] font-bold">Tambah</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={addFiles} />
              </label>
            )}
          </div>
          <p className="mt-1.5 text-[11px] font-medium text-slate-400">JPG, PNG, atau WEBP. Maksimal {MAX_PHOTOS} foto, 5 MB per foto.</p>
        </div>
      </form>
    </Modal>
  );
}
