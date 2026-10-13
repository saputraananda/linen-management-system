import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Calendar, ChevronDown, Clock, Download, Eye, PlusCircle, RefreshCw, Search, Trash2 } from 'lucide-react';
import exportBastLinenSewa from '../utils/exportBastLinenSewa';

function nowLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function toInputDateTime(value) {
  const s = String(value || '').trim().replace(' ', 'T');
  const match = s.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (match) return match[1];
  const day = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return day ? `${day[1]}T00:00` : nowLocal();
}

function fullDate(value) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const weekday = new Date(year, month - 1, date).getDay();
  return `${days[weekday]}, ${date} ${months[month - 1]} ${year}`;
}

function toTitleCase(str) {
  return String(str || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function isTitleCase(str) {
  const raw = String(str || '').trim();
  return raw !== '' && raw === toTitleCase(raw);
}

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
}

function SenderSelect({ value, onChange, employees }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const list = employees.filter((emp) => emp.employee_name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-slate-800 outline-none focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10">
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>{value || 'Pilih pengirim'}</span>
        <span className="text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari petugas..." className="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#1ea59e]" />
          <div className="max-h-48 overflow-auto">
            {list.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Tidak ada petugas</p>}
            {list.map((emp) => (
              <button type="button" key={emp.employee_id} onClick={() => { onChange(emp.employee_name); setOpen(false); setQuery(''); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-[#1ea59e]/10 hover:text-[#126776]">
                {emp.employee_name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SignaturePad({ label, role, caption, value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!value) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = value;
  }, [value]);

  const point = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = event.touches ? event.touches[0] : event;
    return {
      x: ((src.clientX - rect.left) / rect.width) * canvas.width,
      y: ((src.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event) => {
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const p = point(event);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (event) => {
    if (!drawing.current) return;
    event.preventDefault();
    const p = point(event);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-700">{label}</p>
          {role && <p className="text-xs font-bold uppercase tracking-wide text-slate-800">{role}</p>}
        </div>
        <button type="button" className="rounded-md bg-slate-200/80 px-2 py-1 text-[10px] font-bold text-slate-700" onClick={() => onChange('')}>Hapus</button>
      </div>
      <canvas ref={canvasRef} width={640} height={240} className="h-44 w-full touch-none cursor-crosshair rounded-lg border-2 border-dashed border-slate-200 bg-slate-50"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      {caption && <p className="mt-3 border-t border-slate-800 pt-2 text-center text-xs font-bold text-slate-800">{caption}</p>}
    </div>
  );
}

function entriesFromDetails(row) {
  const next = {};
  for (const d of row.details || []) {
    const key = d.room_id ? String(d.room_id) : (row.room_id ? String(row.room_id) : 'all');
    if (!next[d.hospital_linen_id]) next[d.hospital_linen_id] = {};
    next[d.hospital_linen_id][key] = {
      pengiriman: Number(d.qty_pengiriman) ? String(d.qty_pengiriman) : '',
      penarikan: Number(d.qty_penarikan) ? String(d.qty_penarikan) : '',
      notes: d.notes || '',
    };
  }
  return next;
}

function scopeValue(entries, linenId, roomId, field) {
  const bucket = entries[linenId] || {};
  if (roomId) return bucket[roomId]?.[field] ?? '';
  if (field === 'notes') return bucket.all?.notes || '';
  let sum = 0;
  let any = false;
  for (const val of Object.values(bucket)) {
    const n = val?.[field];
    if (n !== '' && n != null) { sum += Number(n) || 0; any = true; }
  }
  return any ? String(sum) : '';
}

function writeEntry(prev, linenId, roomId, field, raw) {
  const key = roomId || 'all';
  const bucket = { ...(prev[linenId] || {}) };
  const current = { pengiriman: '', penarikan: '', notes: '', ...(bucket[key] || {}) };
  if (field === 'notes' || roomId) {
    bucket[key] = { ...current, [field]: raw };
    return { ...prev, [linenId]: bucket };
  }
  let others = 0;
  for (const [k, val] of Object.entries(bucket)) {
    if (k === 'all') continue;
    others += Number(val?.[field]) || 0;
  }
  const typed = raw === '' ? 0 : Number(raw) || 0;
  bucket.all = { ...current, [field]: Math.max(0, typed - others) ? String(Math.max(0, typed - others)) : '' };
  return { ...prev, [linenId]: bucket };
}

function detailsFromEntries(entries) {
  const details = [];
  for (const [linenId, bucket] of Object.entries(entries)) {
    for (const [key, val] of Object.entries(bucket || {})) {
      const kirim = Number(val?.pengiriman) || 0;
      const tarik = Number(val?.penarikan) || 0;
      if (!kirim && !tarik) continue;
      details.push({
        hospital_linen_id: Number(linenId),
        room_id: key === 'all' ? null : Number(key),
        qty_pengiriman: kirim,
        qty_penarikan: tarik,
        notes: val.notes || '',
      });
    }
  }
  return details;
}

export default function BastLinenSewa() {
  const hospitalId = sessionStorage.getItem('valet_hospital_id') || '';
  const hospitalName = sessionStorage.getItem('valet_hospital_name') || 'Rumah sakit belum dipilih';
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [linenSearch, setLinenSearch] = useState('');
  const [bastDate, setBastDate] = useState(nowLocal);
  const [employees, setEmployees] = useState([]);
  const [senderName, setSenderName] = useState(toTitleCase(localStorage.getItem('fullName') || localStorage.getItem('username') || ''));
  const [senderPosition, setSenderPosition] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPosition, setReceiverPosition] = useState('');
  const [gaHeadName, setGaHeadName] = useState('');
  const [gaHeadPosition, setGaHeadPosition] = useState('');
  const [sigSender, setSigSender] = useState('');
  const [sigReceiver, setSigReceiver] = useState('');
  const [sigGa, setSigGa] = useState('');
  const [linens, setLinens] = useState([]);
  const [entries, setEntries] = useState({});
  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [historyUnit, setHistoryUnit] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewSaving, setPreviewSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('history');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadHistory = useCallback(async () => {
    if (!hospitalId) return;
    const q = new URLSearchParams({ hospital_id: hospitalId });
    if (startDate) q.set('start_date', startDate);
    if (endDate) q.set('end_date', endDate);
    const { data } = await axios.get(`/api/ikm/bast-linen-sewa?${q}`, { headers: authHeaders() });
    if (data.success) setHistory(data.data || []);
  }, [hospitalId, startDate, endDate]);

  const loadLinens = useCallback(async (rid, bastId) => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ hospital_id: hospitalId });
      if (rid) q.set('room_id', rid);
      if (bastId) q.set('bast_id', bastId);
      const { data } = await axios.get(`/api/ikm/bast-linen-sewa/linens?${q}`, { headers: authHeaders() });
      if (data.success) {
        setRooms(data.rooms || []);
        setLinens(data.data || []);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    loadHistory().catch((err) => showToast(err.response?.data?.message || err.message, 'error'));
  }, [loadHistory]);

  useEffect(() => {
    axios.get('/api/ikm/employees', { headers: authHeaders() })
      .then(({ data }) => { if (data.success) setEmployees(data.data || []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab !== 'form') return;
    loadLinens(roomId, editingId);
  }, [roomId, editingId, loadLinens, activeTab]);

  const setQty = (id, field, raw) => {
    setEntries((prev) => writeEntry(prev, id, roomId, field, raw));
  };

  const resetForm = () => {
    setEditingId(null);
    setRoomId('');
    setEntries({});
    setBastDate(nowLocal());
    setSenderPosition('');
    setReceiverName('');
    setReceiverPosition('');
    setGaHeadName('');
    setGaHeadPosition('');
    setSigSender('');
    setSigReceiver('');
    setSigGa('');
    setSenderName(toTitleCase(localStorage.getItem('fullName') || localStorage.getItem('username') || ''));
  };

  const openPreview = async (id) => {
    try {
      const { data } = await axios.get(`/api/ikm/bast-linen-sewa/${id}`, { headers: authHeaders() });
      if (!data.success) return showToast('Gagal membuka pratinjau', 'error');
      setPreview({
        ...data.data,
        lines: (data.data.details || []).map((row) => ({
          id: row.id,
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

  const savePreview = async () => {
    if (!preview) return;
    setPreviewSaving(true);
    try {
      const { data } = await axios.patch(`/api/ikm/bast-linen-sewa/${preview.id}/lines`, {
        lines: preview.lines.map((line) => ({ id: line.id, ukuran: line.ukuran, bahan: line.bahan, warna: line.warna })),
      }, { headers: authHeaders() });
      showToast(data.message || 'Keterangan linen diperbarui');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal menyimpan keterangan linen', 'error');
    } finally {
      setPreviewSaving(false);
    }
  };

  const downloadBast = async (id) => {
    try {
      const { data } = await axios.get(`/api/ikm/bast-linen-sewa/${id}`, { headers: authHeaders() });
      if (!data.success || !exportBastLinenSewa(data.data)) showToast('Gagal membuka laporan. Izinkan pop-up browser.', 'error');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal mengunduh berita acara', 'error');
    }
  };

  const startEdit = async (id) => {
    try {
      const { data } = await axios.get(`/api/ikm/bast-linen-sewa/${id}`, { headers: authHeaders() });
      const row = data.data;
      if (String(row.hospital_id) !== String(hospitalId)) return showToast('BAST ini milik rumah sakit lain', 'error');
      setEditingId(row.id);
      setEntries(entriesFromDetails(row));
      setRoomId(row.room_id ? String(row.room_id) : '');
      setBastDate(toInputDateTime(row.bast_date));
      setSenderName(row.sender_name || '');
      setSenderPosition(row.sender_position || '');
      setReceiverName(row.receiver_name || row.rs_inspector_name || '');
      setReceiverPosition(row.receiver_position || '');
      setGaHeadName(row.ga_head_name || '');
      setGaHeadPosition(row.ga_head_position || '');
      setSigSender('');
      setSigReceiver('');
      setSigGa('');
      setActiveTab('form');
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const save = async () => {
    if (!hospitalId) return showToast('Pilih rumah sakit di dashboard valet terlebih dahulu', 'error');
    if (!senderName.trim()) return showToast('Nama pengirim wajib diisi', 'error');
    if (!isTitleCase(senderName)) return showToast('Nama pengirim harus Capital Each Word', 'error');
    if (!senderPosition.trim()) return showToast('Jabatan pengirim wajib diisi', 'error');
    if (!receiverName.trim()) return showToast('Nama penerima wajib diisi', 'error');
    if (!isTitleCase(receiverName)) return showToast('Nama penerima harus Capital Each Word', 'error');
    if (!receiverPosition.trim()) return showToast('Jabatan penerima wajib diisi', 'error');
    if (!gaHeadName.trim()) return showToast('Nama yang mengetahui wajib diisi', 'error');
    if (!isTitleCase(gaHeadName)) return showToast('Nama yang mengetahui harus Capital Each Word', 'error');
    if (!gaHeadPosition.trim()) return showToast('Jabatan yang mengetahui wajib diisi', 'error');
    const details = detailsFromEntries(entries);
    if (!details.length) return showToast('Isi minimal satu pengiriman atau penarikan', 'error');
    setSaving(true);
    try {
      const body = {
        hospital_id: Number(hospitalId),
        room_id: roomId ? Number(roomId) : null,
        bast_date: bastDate,
        sender_name: senderName.trim(),
        sender_position: senderPosition.trim(),
        receiver_name: receiverName.trim(),
        receiver_position: receiverPosition.trim(),
        ga_head_name: gaHeadName.trim(),
        ga_head_position: gaHeadPosition.trim(),
        signature_sender: sigSender || null,
        signature_receiver: sigReceiver || null,
        signature_ga: sigGa || null,
        details,
      };
      const url = editingId ? `/api/ikm/bast-linen-sewa/${editingId}` : '/api/ikm/bast-linen-sewa';
      const { data } = await axios({ url, method: editingId ? 'put' : 'post', data: body, headers: authHeaders() });
      showToast(data.message || 'BAST tersimpan');
      resetForm();
      setActiveTab('history');
      await loadHistory();
      await loadLinens('', null);
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      const { data } = await axios.delete(`/api/ikm/bast-linen-sewa/${deleteId}`, { headers: authHeaders() });
      showToast(data.message || 'BAST dihapus');
      const removed = deleteId;
      setDeleteId(null);
      if (editingId === removed) resetForm();
      await loadHistory();
      await loadLinens(roomId, editingId === removed ? null : editingId);
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
    }
  };

  const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10 disabled:bg-slate-100 disabled:text-slate-500';
  const visibleLinens = linens.filter((row) => String(row.linen_name || '').toLowerCase().includes(linenSearch.trim().toLowerCase()));
  const unitOptions = [...new Set(history.map((row) => row.room_name || 'Seluruh Unit'))];
  const visibleHistory = history.filter((row) => {
    const unit = row.room_name || 'Seluruh Unit';
    if (historyUnit && unit !== historyUnit) return false;
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    return [row.bast_number, row.sender_name, row.receiver_name, row.ga_head_name, unit].some((value) => String(value || '').toLowerCase().includes(q));
  });

  return (
    <div className="min-h-full bg-slate-50/50 py-6 text-slate-800" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-screen-2xl space-y-6 px-4 sm:px-6 lg:px-8">
      {toast && <div className={`rounded-xl px-4 py-3 text-sm font-medium ${toast.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{toast.message}</div>}
      <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">{hospitalName}</h2>
          <p className="mt-1 text-xs font-medium text-slate-400">Berita Acara Serah Terima Linen Sewa. Pengiriman menambah stok, penarikan mengurangi stok.</p>
        </div>
        <div className="flex h-fit shrink-0 self-start rounded-xl border border-slate-200 bg-slate-100 p-1.5 md:self-center">
          <button type="button" onClick={() => { setActiveTab('history'); if (editingId) resetForm(); }} className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all ${activeTab === 'history' ? 'bg-gradient-to-r from-[#126776] to-[#1ea59e] text-white shadow-md shadow-[#126776]/10' : 'text-slate-500 hover:bg-slate-200/55 hover:text-slate-800'}`}>
            <Clock className="h-4 w-4" />
            Riwayat
          </button>
          <button type="button" onClick={() => { resetForm(); setActiveTab('form'); }} className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all ${activeTab === 'form' ? 'bg-gradient-to-r from-[#126776] to-[#1ea59e] text-white shadow-md shadow-[#126776]/10' : 'text-slate-500 hover:bg-slate-200/55 hover:text-slate-800'}`}>
            <PlusCircle className="h-4 w-4" />
            Form BAST
          </button>
        </div>
      </div>
      {activeTab === 'form' && (
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-[#126776] to-[#1ea59e] p-5 sm:p-6">
          <h1 className="text-lg font-bold text-white">{editingId ? 'Ubah Berita Acara Serah Terima Linen Sewa' : 'Form Berita Acara Serah Terima Linen Sewa'}</h1>
          <p className="mt-1 text-xs font-medium text-white/80">{hospitalName}. Pengiriman menambah stok, penarikan mengurangi stok.</p>
        </div>
        <div className="space-y-6 p-5 text-slate-800 sm:p-6">
        {!hospitalId && <p className="text-sm font-medium text-amber-700">Buka rumah sakit dari dashboard valet terlebih dahulu.</p>}
        <label className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="w-28 shrink-0 text-xs font-semibold text-slate-500">Tanggal</span>
          <input type="datetime-local" value={bastDate} onChange={(e) => setBastDate(e.target.value)} className={`${fieldClass} sm:max-w-xs`} />
        </label>
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#126776]">Yang menyerahkan</p>
              <p className="text-sm font-semibold text-slate-800">Pihak Kedua · IKM</p>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Nama Pengirim</span>
                <SenderSelect value={senderName} onChange={setSenderName} employees={employees} />
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Jabatan Pengirim</span>
                <input value={senderPosition} onChange={(e) => setSenderPosition(e.target.value)} placeholder="Contoh: Staff Operasional" className={fieldClass} />
              </label>
            </div>
          </div>
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#126776]">Yang menerima</p>
              <p className="text-sm font-semibold text-slate-800">Pihak Pertama · Rumah Sakit</p>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Nama Penerima</span>
                <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} onBlur={() => setReceiverName(toTitleCase(receiverName))} placeholder="Contoh: Siti Aminah" className={fieldClass} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Jabatan Penerima</span>
                <input value={receiverPosition} onChange={(e) => setReceiverPosition(e.target.value)} placeholder="Contoh: Kepala Unit Rumah Tangga" className={fieldClass} />
              </label>
            </div>
          </div>
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#126776]">Mengetahui</p>
              <p className="text-sm font-semibold text-slate-800">Pejabat yang mengetahui</p>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Nama</span>
                <input value={gaHeadName} onChange={(e) => setGaHeadName(e.target.value)} onBlur={() => setGaHeadName(toTitleCase(gaHeadName))} placeholder="Contoh: Budi Santoso" className={fieldClass} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Jabatan</span>
                <input value={gaHeadPosition} onChange={(e) => setGaHeadPosition(e.target.value)} placeholder="Contoh: Kepala Divisi GA" className={fieldClass} />
              </label>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-3 sm:flex-row">
            <div className="relative min-w-[200px]">
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={!hospitalId} className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs font-semibold text-slate-700 outline-none focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10 disabled:bg-slate-100">
                <option value="">Seluruh Unit</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.room_name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-slate-400" />
            </div>
            <div className="relative flex-1">
              <Search className="absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400" />
              <input type="text" placeholder="Cari nama linen..." value={linenSearch} onChange={(e) => setLinenSearch(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10" />
              {linenSearch && <button type="button" onClick={() => setLinenSearch('')} className="absolute inset-y-0 right-3 my-auto text-slate-400">✕</button>}
            </div>
          </div>
          <div className="max-h-[75vh] overflow-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 [&_th]:sticky [&_th]:top-0 [&_th]:bg-slate-50">
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400 shadow-[0_1px_0_#e2e8f0]">
                <th className="w-12 px-4 py-3.5 text-center">No</th>
                <th className="px-4 py-3.5">Nama Linen</th>
                <th className="px-4 py-3.5 text-center">Stok Sekarang</th>
                <th className="w-28 px-4 py-3.5 text-center">Pengiriman</th>
                <th className="w-28 px-4 py-3.5 text-center">Penarikan</th>
                <th className="px-4 py-3.5">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading && <tr><td colSpan={6} className="px-4 py-16 text-center text-sm font-semibold text-slate-400">Memuat linen sewa...</td></tr>}
              {!loading && visibleLinens.length === 0 && <tr><td colSpan={6} className="px-4 py-16 text-center text-sm font-semibold text-slate-400">{linenSearch ? `Tidak ada linen yang cocok dengan "${linenSearch}"` : 'Tidak ada linen sewa'}</td></tr>}
              {visibleLinens.map((row, index) => {
                const kirim = Number(scopeValue(entries, row.hospital_linen_id, roomId, 'pengiriman')) || 0;
                const tarik = Number(scopeValue(entries, row.hospital_linen_id, roomId, 'penarikan')) || 0;
                const over = tarik > Number(row.stock_now) + kirim;
                const filled = kirim > 0 || tarik > 0;
                return (
                  <tr key={row.hospital_linen_id} className={`transition-all duration-150 ${filled ? 'border-l-4 border-l-[#1ea59e] bg-[#1ea59e]/5' : 'hover:bg-slate-50/40'}`}>
                    <td className="px-4 py-3 text-center text-xs font-medium text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3"><p className="text-sm font-semibold text-slate-800">{row.linen_name}</p></td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{row.stock_now}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <input type="number" min="0" placeholder="0" value={scopeValue(entries, row.hospital_linen_id, roomId, 'pengiriman')} onChange={(e) => setQty(row.hospital_linen_id, 'pengiriman', e.target.value)} className="w-16 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-center text-xs font-semibold text-slate-700 outline-none transition focus:border-[#1ea59e] focus:bg-white focus:ring-4 focus:ring-[#1ea59e]/10" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <input type="number" min="0" placeholder="0" value={scopeValue(entries, row.hospital_linen_id, roomId, 'penarikan')} onChange={(e) => setQty(row.hospital_linen_id, 'penarikan', e.target.value)} className={`w-16 rounded-lg border py-1.5 text-center text-xs font-semibold outline-none transition focus:border-[#1ea59e] focus:bg-white focus:ring-4 focus:ring-[#1ea59e]/10 ${over ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input value={scopeValue(entries, row.hospital_linen_id, roomId, 'notes')} placeholder="Catatan item..." onChange={(e) => setQty(row.hospital_linen_id, 'notes', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#1ea59e] focus:bg-white focus:ring-4 focus:ring-[#1ea59e]/10" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SignaturePad label="Yang menyerahkan," role="Pihak Kedua" caption={senderPosition} value={sigSender} onChange={setSigSender} />
          <SignaturePad label="Yang menerima," role="Pihak Pertama" caption={receiverPosition} value={sigReceiver} onChange={setSigReceiver} />
          <SignaturePad label="Mengetahui," caption={gaHeadPosition} value={sigGa} onChange={setSigGa} />
        </div>
        <p className="text-xs text-slate-400">Tanda tangan boleh dikosongkan dan dilengkapi nanti. Kanvas kosong saat edit mempertahankan tanda tangan yang sudah tersimpan.</p>
        <div className="flex gap-2">
          <button type="button" disabled={saving || !hospitalId} onClick={save} className="rounded-xl bg-gradient-to-r from-[#126776] to-[#1ea59e] px-6 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60">{saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan BAST'}</button>
          {editingId && <button type="button" onClick={() => { resetForm(); setActiveTab('history'); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Batal</button>}
        </div>
        </div>
      </section>
      )}
      {activeTab === 'history' && (
      <div className="space-y-6">
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
            <p className="mt-1 text-xs text-slate-400">Ubah filter, atau catat pengiriman dan penarikan baru pada Form BAST.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {visibleHistory.map((row) => (
              <div key={row.id} onClick={() => startEdit(row.id)} className="group relative flex cursor-pointer items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50/70">
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
                  <button type="button" aria-label="Hapus berita acara" onClick={() => setDeleteId(row.id)} className="rounded-lg p-1.5 text-rose-600 transition hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
      {preview && createPortal(
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" style={{ colorScheme: "light" }}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 text-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-slate-800">{preview.bast_number}</p>
                <p className="text-sm text-slate-500">{fullDate(preview.bast_date)} · {preview.hospital_name}</p>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="text-sm text-slate-500">Tutup</button>
            </div>
            <p className="mt-3 text-xs text-slate-500">Ukuran, bahan, dan warna yang kosong bisa diisi di sini. Simpan agar laporan berikutnya memakai isian ini.</p>
            <table className="mt-3 w-full text-sm text-slate-800">
              <thead className="text-center text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-center">Nama Linen</th>
                  <th className="px-2 py-2 text-center">Ukuran</th>
                  <th className="px-2 py-2 text-center">Bahan</th>
                  <th className="px-2 py-2 text-center">Warna</th>
                  <th className="px-2 py-2 text-center">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line) => (
                  <tr key={line.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 text-center font-medium">{line.nama}</td>
                    {['ukuran', 'bahan', 'warna'].map((field) => (
                      <td key={field} className="px-2 py-2 text-center">
                        <input value={line[field]} maxLength={100} onChange={(e) => setPreview((prev) => prev && ({ ...prev, lines: prev.lines.map((item) => item.id === line.id ? { ...item, [field]: e.target.value } : item) }))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm text-slate-800 outline-none focus:border-[#1ea59e]" />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center font-semibold">{line.kirim || line.tarik}{line.kirim && line.tarik ? ` / ${line.tarik}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end">
              <button type="button" disabled={previewSaving} onClick={savePreview} className="rounded-xl bg-[#126776] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{previewSaving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {deleteId && createPortal(
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" style={{ colorScheme: "light" }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center text-slate-800">
            <p className="text-sm font-semibold text-slate-800">Hapus BAST ini? Stok akan dikembalikan.</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button type="button" onClick={() => setDeleteId(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Batal</button>
              <button type="button" onClick={remove} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: "#e11d48", color: "#ffffff" }}>Hapus</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>
    </div>
  );
}
