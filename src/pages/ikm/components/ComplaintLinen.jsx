import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Search, ChevronDown, RefreshCw, MessageSquareWarning, Camera, Clock, Package, Eye } from 'lucide-react';
import {
  STATUS, ACTION, OWNERSHIP, PhotoGrid, labelCls, inputCls, fmtDate, fmtDateTime, auth, errMsg, Badge, Modal,
} from '../../../components/ComplaintShared';

const API = '/api/ikm/complaint';

// Tim IKM: melihat komplain semua rumah sakit (view only).
// Aksi (setujui/tolak mewakili RS, ubah status, catatan) hanya untuk karyawan PT WAI (company_id = 1)
// atau mst_leader.role = 'management'; hak ditentukan server, bukan sekadar disembunyikan di UI.
export default function ComplaintLinen() {
  const [items, setItems] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(API, {
        ...auth(), params: { q: search || undefined, status: status || undefined, hospitalId: hospitalId || undefined },
      });
      setItems(data.data);
      setCanManage(!!data.canManage);
      setError('');
    } catch (e) {
      setError(errMsg(e, 'Gagal memuat komplain'));
    } finally {
      setLoading(false);
    }
  }, [search, status, hospitalId]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => {
    axios.get(`${API}/access`, auth()).then(({ data }) => setHospitals(data.hospitals)).catch(() => {});
  }, []);

  const openDetail = async (id) => {
    try {
      const { data } = await axios.get(`${API}/${id}`, auth());
      setDetail(data.data);
    } catch (e) { setError(errMsg(e, 'Gagal membuka komplain')); }
  };

  return (
    <div className="min-h-full bg-slate-50/50 py-6 text-slate-800" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">Komplain Rumah Sakit</h2>
            {!loading && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${canManage ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                {!canManage && <Eye className="h-3 w-3" />} {canManage ? 'Dapat menindaklanjuti' : 'View only'}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-medium text-slate-400">Pantau komplain dari seluruh rumah sakit mitra.</p>
        </div>

        {error && <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Cari nomor, jenis, pelapor, deskripsi, atau rumah sakit..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10" />
            </div>
            <div className="relative">
              <select value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} className="w-full min-w-[180px] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-9 text-xs font-semibold text-slate-700 outline-none focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10 lg:w-auto">
                <option value="">Semua Rumah Sakit</option>
                {hospitals.map((h) => <option key={h.id} value={h.id}>{h.hospital_name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="relative">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full min-w-[160px] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-9 text-xs font-semibold text-slate-700 outline-none focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10 lg:w-auto">
                <option value="">Semua Status</option>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-3.5 w-3.5 text-slate-400" />
            </div>
            <button type="button" title="Muat ulang" onClick={() => { setSearch(''); setStatus(''); setHospitalId(''); load(); }} className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#1ea59e]" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <MessageSquareWarning className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <h4 className="text-base font-bold text-slate-700">Tidak ada komplain</h4>
            <p className="mt-1 text-xs text-slate-400">Ubah filter atau tunggu pengajuan baru dari rumah sakit.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {items.map((c) => (
              <div key={c.id} onClick={() => openDetail(c.id)} className="relative flex cursor-pointer flex-col gap-2 px-5 py-4 transition hover:bg-slate-50/70 lg:flex-row lg:items-center lg:gap-6">
                <div className={`absolute bottom-0 left-0 top-0 w-1 rounded-r-full ${(STATUS[c.status] || STATUS.DIAJUKAN).bar}`} />
                <div className="min-w-0 pl-2 lg:w-1/3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-slate-800">{c.complaint_number}</p>
                    <Badge status={c.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{c.hospital_name} · {c.room_name || '-'}</p>
                </div>
                <div className="min-w-0 flex-1 pl-2 lg:pl-0">
                  <p className="text-xs font-bold text-slate-700">{c.complaint_type}</p>
                  <p className="line-clamp-2 text-xs font-medium text-slate-600">{c.description}</p>
                  {c.linen_name && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <Package className="h-3 w-3" /> {c.linen_name}{c.category_name ? ` · ${c.category_name}` : ''}{c.ownership_type ? ` · ${OWNERSHIP[c.ownership_type]}` : ''} · {c.quantity} pcs
                    </p>
                  )}
                </div>
                <div className="pl-2 text-[11px] font-medium text-slate-500 lg:w-52 lg:pl-0">
                  <p className="font-semibold text-slate-700">{c.reporter_name}</p>
                  <p>{fmtDate(c.complaint_date)}</p>
                  {c.photo_count > 0 && <p className="mt-0.5 flex items-center gap-1"><Camera className="h-3 w-3" /> {c.photo_count} foto</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} onChanged={async () => { await load(); await openDetail(detail.id); }} />}
    </div>
  );
}

function DetailModal({ detail, onClose, onChanged }) {
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!status && !note.trim()) { setErr('Pilih status baru atau isi catatan'); return; }
    if (status && ['DITOLAK', 'DISETUJUI_RS'].includes(status) && !note.trim() && detail.status === 'DIAJUKAN') { setErr('Alasan wajib diisi saat mewakili Tim Linen RS'); return; }
    if (status === 'DITOLAK' && !note.trim()) { setErr('Alasan penolakan wajib diisi'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/${detail.id}/status`, { status: status || undefined, note }, auth());
      setStatus(''); setNote('');
      await onChanged();
    } catch (ex) { setErr(errMsg(ex, 'Gagal menyimpan')); } finally { setSaving(false); }
  };

  const nextLabel = (k) => (detail.status === 'DIAJUKAN'
    ? (k === 'DISETUJUI_RS' ? 'Setujui (mewakili Tim Linen RS)' : 'Tolak (mewakili Tim Linen RS)')
    : STATUS[k]?.label || k);

  return (
    <Modal wide subtitle="Detail Komplain" title={detail.complaint_number} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2"><Badge status={detail.status} /><span className="text-xs font-semibold text-slate-500">{detail.complaint_type}</span></div>
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-3">
        {[['Rumah Sakit', detail.hospital_name], ['Unit', detail.room_name || '-'], ['Pelapor', detail.reporter_name],
          ['Tanggal Pengajuan', fmtDate(detail.complaint_date)],
          ...(detail.linen_name ? [['Linen', detail.linen_name], ['Kategori', detail.category_name || '-'], ['Kepemilikan', OWNERSHIP[detail.ownership_type] || '-'], ['Quantity', `${detail.quantity} pcs`]] : []),
        ].map(([l, v]) => <div key={l}><p className={labelCls}>{l}</p><p className="font-bold text-slate-800">{v}</p></div>)}
      </div>
      <div><p className={labelCls}>Deskripsi</p><p className="whitespace-pre-wrap text-sm font-medium text-slate-700">{detail.description}</p></div>
      {detail.photos.length > 0 && (
        <div>
          <p className={labelCls}>Foto Bukti ({detail.photos.length})</p>
          <PhotoGrid photos={detail.photos} />
        </div>
      )}

      {detail.can_manage ? (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[#1ea59e]/30 bg-[#1ea59e]/5 p-4">
          <p className="text-xs font-bold text-slate-700">Tindak Lanjut</p>
          {err && <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{err}</div>}
          {detail.next_statuses.length > 0 ? (
            <div>
              <label className={labelCls}>Ubah Status</label>
              <div className="relative">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} cursor-pointer appearance-none bg-white pr-9`}>
                  <option value="">Tidak diubah ({STATUS[detail.status]?.label})</option>
                  {detail.next_statuses.map((k) => <option key={k} value={k}>{nextLabel(k)}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
          ) : <p className="text-[11px] font-medium text-slate-500">Komplain sudah selesai / ditolak. Anda masih bisa menambahkan catatan.</p>}
          {detail.status === 'DIAJUKAN' && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
              Komplain ini belum diproses Tim Linen RS. Gunakan hanya jika kondisional; tindakan Anda dicatat sebagai mewakili Tim Linen RS dan alasan wajib diisi.
            </p>
          )}
          <div>
            <label className={labelCls}>Catatan (terlihat oleh Unit dan Tim Linen RS)</label>
            <textarea rows={3} className={inputCls} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tulis catatan tindak lanjut..." />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="cursor-pointer rounded-xl bg-gradient-to-r from-[#126776] to-[#1ea59e] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#126776]/20 transition active:scale-[0.98] disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      ) : (
        <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500">
          <Eye className="h-3.5 w-3.5" /> Akun Anda hanya dapat melihat komplain (view only).
        </p>
      )}

      <div>
        <p className={labelCls}>Riwayat</p>
        <ol className="space-y-3 border-l-2 border-slate-100 pl-4">
          {detail.logs.map((l) => (
            <li key={l.id} className="relative">
              <span className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#1ea59e]" />
              <p className="text-xs font-bold text-slate-800">
                {ACTION[l.action] || l.action}{['admin', 'ikm'].includes(l.actor_role) && (l.action === 'APPROVED' || l.action === 'REJECTED') ? ' (mewakili Tim Linen RS)' : ''}
                {l.to_status && l.action !== 'NOTE' && <span className="ml-1 font-semibold text-slate-400">→ {STATUS[l.to_status]?.label || l.to_status}</span>}
              </p>
              {l.note && <p className="mt-0.5 whitespace-pre-wrap rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600">{l.note}</p>}
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400"><Clock className="h-3 w-3" /> {l.actor_name}{l.actor_role === 'admin' ? ' (Admin Alora)' : l.actor_role === 'ikm' ? ' (Tim IKM)' : ''} · {fmtDateTime(l.created_at)}</p>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
