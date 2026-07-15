import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, Shirt, Layers, Activity, Info, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();

  // Retrieve hospital details from localStorage
  const fullName = localStorage.getItem('fullName') || localStorage.getItem('username') || 'Rumah Sakit';
  const hospitalId = localStorage.getItem('hospitalId') || 'RS';

  const avatarUrl = `/assets/logos/${hospitalId}.png`;

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    if (!token || role !== 'rs') navigate('/login');
  }, [navigate]);
  const linenStock = [
    { name: 'Sprei Medis (Bed Sheet)', total: 350, clean: 280, dirty: 70, status: 'Aman' },
    { name: 'Sarung Bantal (Pillow Case)', total: 400, clean: 310, dirty: 90, status: 'Aman' },
    { name: 'Selimut Pasien (Blanket)', total: 200, clean: 140, dirty: 60, status: 'Perlu Pengiriman' },
    { name: 'Baju Pasien (Patient Gown)', total: 250, clean: 210, dirty: 40, status: 'Aman' },
    { name: 'Linen Operasi (OT Gown)', total: 120, clean: 95, dirty: 25, status: 'Aman' },
  ];

  return (
    <main className="min-h-screen bg-slate-50 py-6 sm:py-10">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Aset Linen</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">1,320</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Info className="h-3 w-3" /> Terdaftar dalam tag RFID</p>
            </div>
            <div className="p-4 bg-slate-50 text-slate-600 rounded-2xl"><Layers className="h-7 w-7" /></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Linen Bersih & Steril</p>
              <h3 className="text-3xl font-extrabold text-teal-600 mt-2">1,036</h3>
              <p className="text-xs text-teal-600 mt-1 font-semibold">✓ Ready to use</p>
            </div>
            <div className="p-4 bg-teal-50 text-teal-600 rounded-2xl"><Shirt className="h-7 w-7" /></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dalam Proses Cuci</p>
              <h3 className="text-3xl font-extrabold text-amber-600 mt-2">284</h3>
              <p className="text-xs text-amber-600 mt-1 font-semibold flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Sedang diproses</p>
            </div>
            <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><RefreshCw className="h-7 w-7" /></div>
          </div>
        </div>

        {/* Table */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Rincian Inventaris Linen</h3>
              <p className="text-xs text-slate-500 mt-0.5">Data ketersediaan linen per kategori dan status kebersihannya.</p>
            </div>
            <div className="text-xs text-slate-400 font-semibold bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">Terakhir: Baru Saja</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-slate-100">
                  <th className="py-4 px-6">Nama Linen</th>
                  <th className="py-4 px-6">Stok Bersih</th>
                  <th className="py-4 px-6">Stok Kotor</th>
                  <th className="py-4 px-6">Total Aset</th>
                  <th className="py-4 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linenStock.map((linen, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900 text-sm">{linen.name}</td>
                    <td className="py-4 px-6 font-bold text-teal-600">{linen.clean} Pcs</td>
                    <td className="py-4 px-6 font-bold text-amber-600">{linen.dirty} Pcs</td>
                    <td className="py-4 px-6 font-medium text-slate-500">{linen.total} Pcs</td>
                    <td className="py-4 px-6 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${linen.status === 'Aman'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${linen.status === 'Aman' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {linen.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
