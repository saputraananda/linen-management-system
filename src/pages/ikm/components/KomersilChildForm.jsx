import { useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Save, RefreshCw, Link2, Info, CheckCircle2, Clock } from 'lucide-react';

// Formulir Linen Komersil berinduk (dibuat otomatis dari Serah Terima Linen).
// Baris, qty kotor, TTD dan status mengikuti formulir induk; di sini hanya diisi bersih, P × L (tipe M2),
// catatan dan pilihan express. Hitungan per washing_price_type: PCS = qty, KG = grammage × qty / 1000, M2 = P × L.

const TYPE_LABEL = { PCS: 'Per Pcs', KG: 'Per Kg', M2: 'Per m²' };
const num = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
const fmt = (v, digits = 2) => Number(v || 0).toLocaleString('id-ID', { maximumFractionDigits: digits });

export const measureOf = (row) => {
  const type = row.type || 'PCS';
  const qty = num(row.bersih) ?? (Number(row.kotor) || 0);
  if (type === 'KG') return { value: (Number(row.grammage) || 0) * qty / 1000, unit: 'Kg' };
  if (type === 'M2') {
    const p = num(row.length);
    const l = num(row.width);
    return { value: p && l ? Math.round(p * l * 100) / 100 : 0, unit: 'm²' };
  }
  return { value: qty, unit: 'Pcs' };
};

const fmtDate = (v) => (v ? new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

const SigBox = ({ label, src, name }) => (
  <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-2">
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    <div className="flex h-16 w-full items-center justify-center">
      {src ? <img src={src} alt={label} className="max-h-14 max-w-full object-contain" />
        : <span className="text-[10px] italic text-slate-300">Belum TTD</span>}
    </div>
    <span className="text-[11px] font-semibold text-slate-700">{name || '—'}</span>
  </div>
);

export default function KomersilChildForm({ data, onBack, onSaved, onError }) {
  const tx = data.transaction;
  const editable = !!tx.is_editable;
  const [isExpress, setIsExpress] = useState(Number(tx.is_express) === 1);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState(() => (data.details || []).map(d => ({
    id: d.id,
    room: d.room_name || 'Tanpa Ruangan',
    name: d.linen_name || d.item_name,
    type: d.washing_price_type || 'PCS',
    grammage: d.grammage,
    kotor: Number(d.qty_kotor) || 0,
    bersih: d.qty_bersih ?? '',
    length: d.length_cm ?? '',
    width: d.width_cm ?? '',
    notes: d.notes || ''
  })));

  const setRow = (id, field, value) => setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));

  const totals = useMemo(() => {
    const t = { Pcs: 0, Kg: 0, 'm²': 0, kotor: 0, bersih: 0, m2Missing: 0 };
    for (const r of rows) {
      const m = measureOf(r);
      t[m.unit] += m.value;
      t.kotor += r.kotor;
      t.bersih += num(r.bersih) || 0;
      if (r.type === 'M2' && !(num(r.length) && num(r.width))) t.m2Missing++;
    }
    return t;
  }, [rows]);

  const unitRooms = (data.roomSign?.rooms || []).filter(r => r.required && rows.some(row => row.room === r.room_name));

  const save = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const { data: res } = await axios.put(`/api/ikm/transactions-komersil/${tx.id}`, {
        isExpress: isExpress ? 1 : 0,
        details: rows.map(r => ({ id: r.id, qtyBersih: r.bersih, lengthCm: r.length, widthCm: r.width, notes: r.notes }))
      }, { headers: { Authorization: `Bearer ${token}` } });
      onSaved(res?.message || 'Formulir linen komersil tersimpan');
    } catch (err) {
      onError(err.response?.data?.message || 'Gagal menyimpan formulir linen komersil');
    } finally {
      setSaving(false);
    }
  };

  const cell = 'px-3 py-2.5 text-xs text-slate-700';
  const input = 'w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold text-slate-700 outline-none focus:border-[#1ea59e] focus:bg-white focus:ring-2 focus:ring-[#1ea59e]/15 disabled:bg-slate-100 disabled:text-slate-400';

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 bg-gradient-to-r from-[#126776] to-[#1ea59e] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="rounded-full border border-white/10 bg-white/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-widest">
            Formulir Linen Komersil
          </span>
          <h2 className="mt-2.5 text-lg font-bold tracking-tight">No. Formulir: {tx.form_number}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
            <Link2 className="h-3.5 w-3.5" /> Induk: <span className="font-bold">{tx.parent_form_number}</span>
            <span className="mx-1 text-white/40">·</span> {tx.hospital_name}
          </p>
        </div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-4 py-2 text-xs font-semibold hover:bg-white/25">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>
      </div>

      <div className="space-y-5 p-6">
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Formulir ini dibuat otomatis dari formulir serah terima <b>{tx.parent_form_number}</b>. Daftar linen, qty kotor,
            tanda tangan dan status mengikuti formulir induk. Isi di sini: qty bersih, ukuran P × L (linen bertipe m²) dan catatan.
            Qty bersih yang diubah di sini ikut tersimpan di formulir induk.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="font-semibold text-slate-400">Status</p>
            <p className={`mt-1 font-bold ${tx.status === 'SELESAI' ? 'text-teal-700' : 'text-[#126776]'}`}>{tx.status === 'SELESAI' ? 'Selesai' : 'Dalam Proses'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="flex items-center gap-1 font-semibold text-slate-400"><Clock className="h-3 w-3" /> Pengambilan</p>
            <p className="mt-1 font-bold text-slate-700">{fmtDate(tx.pickup_date)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="flex items-center gap-1 font-semibold text-slate-400"><CheckCircle2 className="h-3 w-3" /> Pengiriman</p>
            <p className="mt-1 font-bold text-slate-700">{fmtDate(tx.delivery_date)}</p>
          </div>
          <label className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3 ${isExpress ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
            <span>
              <span className="block font-semibold text-slate-400">Layanan Express</span>
              <span className="mt-1 block font-bold text-slate-700">{isExpress ? 'Ya' : 'Tidak'}</span>
            </span>
            <input type="checkbox" checked={isExpress} disabled={!editable} onChange={(e) => setIsExpress(e.target.checked)} className="h-4 w-4 accent-amber-500" />
          </label>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-3 text-center">No</th>
                <th className="px-3 py-3">Ruangan</th>
                <th className="px-3 py-3">Nama Linen</th>
                <th className="px-3 py-3 text-center">Hitungan</th>
                <th className="px-3 py-3 text-center">Kotor</th>
                <th className="px-3 py-3 text-center">Bersih</th>
                <th className="px-3 py-3 text-center">P (m)</th>
                <th className="px-3 py-3 text-center">L (m)</th>
                <th className="px-3 py-3 text-center">Hasil</th>
                <th className="px-3 py-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-10 text-center text-xs text-slate-400">Tidak ada linen komersil.</td></tr>
              )}
              {rows.map((r, i) => {
                const m = measureOf(r);
                const isM2 = r.type === 'M2';
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className={`${cell} text-center text-slate-400`}>{i + 1}</td>
                    <td className={`${cell} font-semibold`}>{r.room}</td>
                    <td className={`${cell} font-semibold text-slate-800`}>{r.name}</td>
                    <td className={`${cell} text-center`}>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {TYPE_LABEL[r.type] || r.type}{r.type === 'KG' && r.grammage ? ` · ${fmt(r.grammage, 0)} g` : ''}
                      </span>
                    </td>
                    <td className={`${cell} text-center font-bold`}>{r.kotor}</td>
                    <td className={`${cell} text-center`}>
                      <input type="number" min="0" max={r.kotor} value={r.bersih} disabled={!editable}
                        onChange={(e) => setRow(r.id, 'bersih', e.target.value)} className={input} placeholder="0" />
                    </td>
                    <td className={`${cell} text-center`}>
                      {isM2 ? <input type="number" min="0" step="0.01" value={r.length} disabled={!editable}
                        onChange={(e) => setRow(r.id, 'length', e.target.value)} className={input} placeholder="0,00" /> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`${cell} text-center`}>
                      {isM2 ? <input type="number" min="0" step="0.01" value={r.width} disabled={!editable}
                        onChange={(e) => setRow(r.id, 'width', e.target.value)} className={input} placeholder="0,00" /> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`${cell} whitespace-nowrap text-center font-bold text-[#126776]`}>{fmt(m.value)} {m.unit}</td>
                    <td className={cell}>
                      <input value={r.notes} disabled={!editable} onChange={(e) => setRow(r.id, 'notes', e.target.value)}
                        placeholder="Catatan…" className="w-full min-w-[140px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-[#1ea59e] focus:bg-white disabled:bg-slate-100" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-slate-50 text-xs font-bold text-slate-700">
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-right uppercase tracking-wider text-slate-500">Total</td>
                  <td className="px-3 py-3 text-center">{totals.kotor}</td>
                  <td className="px-3 py-3 text-center">{totals.bersih}</td>
                  <td colSpan={3} className="px-3 py-3 text-center text-[#126776]">
                    {[totals.Pcs ? `${fmt(totals.Pcs)} Pcs` : '', totals.Kg ? `${fmt(totals.Kg)} Kg` : '', totals['m²'] ? `${fmt(totals['m²'])} m²` : '']
                      .filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-3 text-[10px] font-semibold text-amber-600">
                    {totals.m2Missing ? `${totals.m2Missing} item m² belum diukur` : ''}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tanda Tangan (dari formulir induk {tx.parent_form_number})</p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase text-[#126776]">Pengambilan Kotor</p>
              <div className="grid grid-cols-3 gap-2">
                <SigBox label="Valet IKM" src={tx.signature_valet_pickup} name={tx.user_pickup_name} />
                <SigBox label="Petugas RS" src={tx.signature_hospital_pickup} name={tx.hospital_staff_pickup} />
                <SigBox label="Perawat RS" src={tx.signature_assistant_pickup} name={tx.hospital_assistant_pickup} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase text-teal-700">Pengiriman Bersih</p>
              <div className="grid grid-cols-3 gap-2">
                <SigBox label="Valet IKM" src={tx.signature_valet_delivery} name={tx.user_delivery_name} />
                <SigBox label="Petugas RS" src={tx.signature_hospital_delivery} name={tx.hospital_staff_delivery} />
                <SigBox label="Perawat RS" src={tx.signature_assistant_delivery} name={tx.hospital_assistant_delivery} />
              </div>
            </div>
          </div>
          {unitRooms.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-semibold text-slate-500">TTD Unit:</span>
              {unitRooms.map(r => (
                <span key={r.room_id} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
                  {r.room_name}: {r.pickup?.complete ? '✓ Pickup' : 'Pickup belum'} · {r.delivery?.complete ? '✓ Delivery' : 'Delivery belum'}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          {!editable && <span className="text-xs font-semibold text-slate-400">Batas edit 24 jam setelah formulir induk selesai telah lewat.</span>}
          <button type="button" onClick={onBack} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Tutup</button>
          {editable && (
            <button type="button" disabled={saving} onClick={save}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#126776] to-[#1ea59e] px-5 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-60">
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
