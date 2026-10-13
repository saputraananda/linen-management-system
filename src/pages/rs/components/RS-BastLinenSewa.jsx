import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Calendar, ChevronDown, Download, Eye, RefreshCw, Search, X } from 'lucide-react';
import exportBastLinenSewa from '../utils/exportBastLinenSewa';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
}

function fullDate(value) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  return `${days[new Date(year, month - 1, date).getDay()]}, ${date} ${months[month - 1]} ${year}`;
}

export default function RSBastLinenSewa() {
  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [historyUnit, setHistoryUnit] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewRoom, setPreviewRoom] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  useEffect(() => {
    axios.get('/api/rs/bast-linen-sewa', { headers: authHeaders() })
      .then(({ data }) => { if (data.success) setHistory(data.data || []); })
      .catch((err) => showToast(err.response?.data?.message || 'Gagal memuat riwayat', 'error'));
  }, []);

  const hospitalName = history[0]?.hospital_name || 'Rumah Sakit';
  const unitOptions = [...new Set(history.map((row) => row.room_name || 'Seluruh Unit'))];
  const visibleHistory = history.filter((row) => {
    const day = String(row.bast_date || '').slice(0, 10);
    if (startDate && day < startDate) return false;
    if (endDate && day > endDate) return false;
    const unit = row.room_name || 'Seluruh Unit';
    if (historyUnit && unit !== historyUnit) return false;
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    return [row.bast_number, row.sender_name, row.receiver_name, row.ga_head_name, unit].some((value) => String(value || '').toLowerCase().includes(q));
  });

  const openPreview = async (id) => {
    try {
      const { data } = await axios.get(`/api/rs/bast-linen-sewa/${id}`, { headers: authHeaders() });
      if (!data.success) return showToast('Gagal membuka pratinjau', 'error');
      setPreviewRoom('');
      setPreview({
        ...data.data,
        lines: (data.data.details || []).map((row) => ({
          id: row.id,
          ruangan: row.room_name || 'Seluruh Unit',
          nama: row.linen_name || 'Linen',
          ukuran: row.ukuran || row.size_name || '',
          bahan: row.bahan || row.material_name || '',
          warna: row.warna || row.color_name || '',
          kirim: Number(row.qty_pengiriman) || 0,
          tarik: Number(row.qty_penarikan) || 0,
        })),
      });
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal membuka pratinjau', 'error');
    }
  };

  const downloadBast = async (id) => {
    try {
      const { data } = await axios.get(`/api/rs/bast-linen-sewa/${id}`, { headers: authHeaders() });
      if (!data.success || !exportBastLinenSewa(data.data)) showToast('Gagal membuka laporan. Izinkan pop-up browser.', 'error');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal mengunduh berita acara', 'error');
    }
  };

  return (
    <div className="min-h-full bg-slate-50/50 py-6 text-slate-800" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        {toast && <div className={`rounded-xl px-4 py-3 text-sm font-medium ${toast.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{toast.message}</div>}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">{hospitalName}</h2>
          <p className="mt-1 text-xs font-medium text-slate-400">Riwayat pengiriman dan penarikan stok linen sewa. Halaman ini hanya untuk dilihat.</p>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col items-stretch justify-between gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nomor BAST, pengirim, atau penerima..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <Calendar className="h-4 w-4 text-slate-400" />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-28 cursor-pointer border-none bg-transparent text-center font-medium text-slate-700 outline-none" />
                <span className="font-semibold text-slate-400">s/d</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-28 cursor-pointer border-none bg-transparent text-center font-medium text-slate-700 outline-none" />
              </div>
              <div className="relative">
                <select value={historyUnit} onChange={(e) => setHistoryUnit(e.target.value)} className="min-w-[140px] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-9 text-xs font-semibold text-slate-700 outline-none focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10">
                  <option value="">Semua Unit</option>
                  {unitOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-3.5 w-3.5 text-slate-400" />
              </div>
              <button type="button" title="Reset filter" onClick={() => { setHistorySearch(''); setStartDate(''); setEndDate(''); setHistoryUnit(''); }} className="rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {visibleHistory.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <h4 className="text-base font-bold text-slate-700">Tidak ada riwayat BAST</h4>
            <p className="mt-1 text-xs text-slate-400">Ubah filter untuk mencari berita acara lain.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {visibleHistory.map((row) => (
              <div key={row.id} onClick={() => openPreview(row.id)} className="group relative flex cursor-pointer items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50/70">
                <div className="absolute bottom-0 left-0 top-0 w-1 rounded-r-full bg-[#126776]" />
                <div className="min-w-0 flex-1 pl-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{row.bast_number}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{fullDate(row.bast_date)}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{row.sender_name} · {row.receiver_name}</p>
                </div>
                <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  <div className="flex min-w-[64px] flex-col items-center rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Kirim</span>
                    <span className="text-sm font-bold leading-tight text-slate-700">{row.total_pengiriman}</span>
                  </div>
                  <div className="flex min-w-[64px] flex-col items-center rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tarik</span>
                    <span className="text-sm font-bold leading-tight text-slate-700">{row.total_penarikan}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button type="button" aria-label="Pratinjau berita acara" onClick={() => openPreview(row.id)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#126776]">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Unduh berita acara" onClick={() => downloadBast(row.id)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-[#126776]">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {preview && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" style={{ colorScheme: 'light' }} onClick={() => setPreview(null)}>
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white text-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-start justify-between bg-gradient-to-r from-[#126776] to-[#1ea59e] p-6 text-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">Berita Acara Serah Terima Linen Sewa</p>
                <h3 className="mt-1 text-xl font-bold tracking-tight">{preview.bast_number}</h3>
                <p className="mt-1 text-sm text-white/80">{fullDate(preview.bast_date)} · {preview.hospital_name}</p>
              </div>
              <button type="button" aria-label="Tutup" onClick={() => setPreview(null)} className="rounded-xl p-1 text-white/80 transition hover:bg-white/10 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Pengirim</p>
                  <p className="mt-0.5 font-bold text-slate-800">{preview.sender_name || '—'}</p>
                  <p className="text-slate-500">{preview.sender_position || ''}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Penerima</p>
                  <p className="mt-0.5 font-bold text-slate-800">{preview.receiver_name || '—'}</p>
                  <p className="text-slate-500">{preview.receiver_position || ''}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Mengetahui</p>
                  <p className="mt-0.5 font-bold text-slate-800">{preview.ga_head_name || '—'}</p>
                  <p className="text-slate-500">{preview.ga_head_position || ''}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Rincian Linen</p>
                <div className="relative">
                  <select value={previewRoom} onChange={(e) => setPreviewRoom(e.target.value)} className="min-w-[160px] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3.5 pr-9 text-xs font-semibold text-slate-700 outline-none focus:border-[#1ea59e]">
                    <option value="">Semua Ruangan</option>
                    {[...new Set(preview.lines.map((line) => line.ruangan))].map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-sm text-slate-800">
                  <thead className="bg-slate-50 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-3 text-center">Ruangan</th>
                      <th className="px-3 py-3 text-center">Nama Linen</th>
                      <th className="px-3 py-3 text-center">Ukuran</th>
                      <th className="px-3 py-3 text-center">Bahan</th>
                      <th className="px-3 py-3 text-center">Warna</th>
                      <th className="px-3 py-3 text-center">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.filter((line) => !previewRoom || line.ruangan === previewRoom).map((line) => (
                      <tr key={line.id} className="border-t border-slate-100">
                        <td className="px-3 py-3 text-center">{line.ruangan}</td>
                        <td className="px-3 py-3 text-center font-medium">{line.nama}</td>
                        <td className="px-3 py-3 text-center">{line.ukuran || '—'}</td>
                        <td className="px-3 py-3 text-center">{line.bahan || '—'}</td>
                        <td className="px-3 py-3 text-center">{line.warna || '—'}</td>
                        <td className="px-3 py-3 text-center font-semibold">{line.kirim || line.tarik}{line.kirim && line.tarik ? ` / ${line.tarik}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
