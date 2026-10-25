import { useEffect, useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, RefreshCw, Save } from 'lucide-react';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1ea59e] focus:bg-white focus:ring-4 focus:ring-[#1ea59e]/10';
const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400';

export default function UnitProfile() {
  const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState({ text: '', ok: true });
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const hospitalName = localStorage.getItem('fullName') || 'Rumah Sakit';

  useEffect(() => {
    axios.get('/api/unit/profile', auth())
      .then(({ data }) => setForm(data.profile))
      .catch((e) => setMsg({ text: e.response?.data?.message || 'Gagal memuat profil', ok: false }));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ text: '', ok: true });
    try {
      const { data } = await axios.put('/api/unit/profile', form, auth());
      localStorage.setItem('nurseName', data.nurseName);
      localStorage.setItem('username', data.username);
      sessionStorage.removeItem('unit_nurse_name');
      setMsg({ text: 'Profil tersimpan. Nama di badge berubah setelah halaman dimuat ulang.', ok: true });
    } catch (err) {
      setMsg({ text: err.response?.data?.message || 'Gagal menyimpan', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-slate-50 py-6 text-slate-800 sm:py-10" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Profil Saya</h2>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {hospitalName} · Ubah nama, no. telepon, username, dan password akun Anda. Perubahan username/password berlaku di login berikutnya.
          </p>
        </div>

        {msg.text && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.text}</div>
        )}

        {!form ? (
          !msg.text && (
            <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#1ea59e]" />
            </div>
          )
        ) : (
          <form onSubmit={save} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Data Diri</p>
              </div>
              <div>
                <label className={labelCls}>Nama</label>
                <input className={inputCls} required value={form.nurse_name} onChange={set('nurse_name')} />
              </div>
              <div>
                <label className={labelCls}>No. Telepon (opsional)</label>
                <input className={inputCls} value={form.phone} onChange={set('phone')} />
              </div>

              <div className="border-t border-slate-100 pt-5 md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Akun Login</p>
              </div>
              <div>
                <label className={labelCls}>Username</label>
                <input className={inputCls} required value={form.username} onChange={set('username')} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input className={`${inputCls} pr-11`} required type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')} />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute inset-y-0 right-3 my-auto h-fit cursor-pointer p-1 text-slate-400 transition hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#126776] to-[#1ea59e] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#126776]/20 transition active:scale-[0.98] disabled:opacity-60 sm:w-auto"
              >
                <Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
