import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Plus, Pencil, Power, Trash2, X, RefreshCw, Search, ChevronDown, Phone, KeyRound, Users } from 'lucide-react';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import ConfirmDialog from '../../../components/ConfirmDialog';

const EMPTY = { id: null, nurse_name: '', phone: '', username: '', password: '', role: 'unit', room_ids: [] };

const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1ea59e] focus:bg-white focus:ring-4 focus:ring-[#1ea59e]/10';
const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400';

export default function RSProfile() {
  const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const hospitalName = localStorage.getItem('fullName') || 'Rumah Sakit';
  useBodyScrollLock(!!form);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/rs/unit-users', auth());
      setUsers(data.users);
      setRooms(data.rooms);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const roomName = (id) => rooms.find((r) => r.id === id)?.room_name || id;
  const toggleRoom = (id) => setForm((f) => ({
    ...f, room_ids: f.room_ids.includes(id) ? f.room_ids.filter((x) => x !== id) : [...f.room_ids, id],
  }));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (status === 'aktif' && !u.is_active) return false;
      if (status === 'nonaktif' && u.is_active) return false;
      if (!q) return true;
      return [u.nurse_name, u.username, u.phone, u.role === 'rs' ? 'user rs' : 'unit', ...u.room_ids.map(roomName)]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [users, rooms, search, status]);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (form.id) await axios.put(`/api/rs/unit-users/${form.id}`, form, auth());
      else await axios.post('/api/rs/unit-users', form, auth());
      setForm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan');
    }
  };

  const toggle = async (u) => {
    try {
      await axios.post(`/api/rs/unit-users/${u.id}/toggle`, {}, auth());
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengubah status');
    }
  };

  const remove = async (u) => {
    try {
      await axios.delete(`/api/rs/unit-users/${u.id}`, auth());
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus');
    }
  };

  return (
    <div className="min-h-full bg-slate-50/50 py-6 text-slate-800" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">Master User Unit</h2>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {hospitalName} · Akun perawat per ruangan. Unit yang dipilih tampil hijau di dashboard; unit lain tetap bisa diakses (cross unit).
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setError(''); setForm({ ...EMPTY }); }}
            className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#126776] to-[#1ea59e] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#126776]/20 transition hover:shadow-lg active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Tambah User
          </button>
        </div>

        {error && !form && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
        )}

        {/* Filter */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama, username, no. telp, atau unit..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10"
              />
            </div>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full min-w-[140px] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-9 text-xs font-semibold text-slate-700 outline-none focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10 sm:w-auto"
              >
                <option value="">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
              <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-3.5 w-3.5 text-slate-400" />
            </div>
            <button
              type="button"
              title="Muat ulang"
              onClick={() => { setSearch(''); setStatus(''); load(); }}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#1ea59e]" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <h4 className="text-base font-bold text-slate-700">{users.length === 0 ? 'Belum ada user unit' : 'Tidak ada user yang cocok'}</h4>
            <p className="mt-1 text-xs text-slate-400">
              {users.length === 0 ? 'Klik "Tambah User" untuk membuat akun perawat pertama.' : 'Ubah pencarian atau filter status.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {visible.map((u) => (
              <div key={u.id} className={`relative flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50/70 lg:flex-row lg:items-center lg:gap-6 ${u.is_active ? '' : 'opacity-70'}`}>
                <div className={`absolute bottom-0 left-0 top-0 w-1 rounded-r-full ${u.is_active ? 'bg-[#126776]' : 'bg-slate-300'}`} />

                <div className="min-w-0 pl-2 lg:w-1/4">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-slate-800">{u.nurse_name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${u.role === 'rs' ? 'bg-indigo-50 text-indigo-700' : 'bg-sky-50 text-sky-700'}`}>
                      {u.role === 'rs' ? 'User RS' : 'Unit'}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Phone className="h-3 w-3" /> {u.phone || '-'}
                  </p>
                </div>

                <div className="pl-2 lg:w-1/4 lg:pl-0">
                  <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <KeyRound className="h-3 w-3" /> Login
                  </p>
                  <p className="mt-0.5 break-all font-mono text-xs font-semibold text-slate-700">{u.username} / {u.password}</p>
                </div>

                <div className="min-w-0 flex-1 pl-2 lg:pl-0">
                  {u.role === 'rs' ? (
                    <span className="text-[11px] font-medium text-slate-400">Akses semua unit</span>
                  ) : u.room_ids.length === 0 ? (
                    <span className="text-[11px] font-medium text-slate-400">Belum ada unit</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {u.room_ids.map((id) => (
                        <span key={id} className="rounded-full border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-700">{roomName(id)}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-0.5 pl-2 lg:pl-0">
                  <button type="button" title="Edit" aria-label="Edit user" onClick={() => { setError(''); setForm({ ...u }); }} className="cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-[#126776]">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'} aria-label="Ubah status" onClick={() => toggle(u)} className="cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-amber-600">
                    <Power className="h-4 w-4" />
                  </button>
                  <button type="button" title="Hapus" aria-label="Hapus user" onClick={() => setDelTarget(u)} className="cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={() => remove(delTarget)}
        title="Hapus User Unit"
        message={`Hapus user "${delTarget?.nurse_name}"? Tindakan ini tidak bisa dibatalkan.`}
        confirmText="Hapus"
      />

      {form && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center overscroll-contain bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" style={{ colorScheme: 'light' }}>
          <form onSubmit={save} className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-100 bg-white text-slate-800 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl">
            <div className="flex shrink-0 items-start justify-between bg-gradient-to-r from-[#126776] to-[#1ea59e] p-5 text-white sm:p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">Master User Unit</p>
                <h3 className="mt-1 text-lg font-bold tracking-tight">{form.id ? 'Edit User' : 'Tambah User'}</h3>
              </div>
              <button type="button" aria-label="Tutup" onClick={() => setForm(null)} className="cursor-pointer rounded-xl p-1 text-white/80 transition hover:bg-white/10 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-5 sm:p-6">
              {error && <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
              <div>
                <label className={labelCls}>Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {[['unit', 'Unit', 'Perawat per ruangan'], ['rs', 'User RS', 'Akses semua menu RS']].map(([val, label, desc]) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setForm({ ...form, role: val })}
                      className={`cursor-pointer rounded-xl border px-3 py-2.5 text-left transition ${form.role === val ? 'border-[#126776] bg-[#126776]/5 ring-4 ring-[#1ea59e]/10' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                    >
                      <p className={`text-xs font-bold ${form.role === val ? 'text-[#126776]' : 'text-slate-700'}`}>{label}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-slate-400">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>{form.role === 'rs' ? 'Nama' : 'Nama Perawat'}</label>
                <input className={inputCls} required placeholder="Contoh: Putra Simbolon" value={form.nurse_name} onChange={(e) => setForm({ ...form, nurse_name: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>No. Telepon (opsional)</label>
                <input className={inputCls} placeholder="08xxxxxxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Username (unik)</label>
                  <input className={inputCls} required placeholder="putraAtmajaya" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <input className={inputCls} required placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>
              {form.role !== 'rs' && (
              <div>
                <label className={labelCls}>Unit (bisa lebih dari satu)</label>
                <div className="flex flex-wrap gap-2">
                  {rooms.map((r) => {
                    const on = form.room_ids.includes(r.id);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => toggleRoom(r.id)}
                        className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold transition ${on ? 'border-[#126776] bg-[#126776] text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                      >
                        {r.room_name}
                      </button>
                    );
                  })}
                </div>
              </div>
              )}
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-white p-4 sm:px-6">
              <button type="button" onClick={() => setForm(null)} className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Batal</button>
              <button type="submit" className="cursor-pointer rounded-xl bg-gradient-to-r from-[#126776] to-[#1ea59e] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#126776]/20 transition active:scale-[0.98]">Simpan</button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}
