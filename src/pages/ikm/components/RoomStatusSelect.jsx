import { useEffect, useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

// Dropdown ruangan dengan badge penanda ruangan yang masih ada pekerjaan untuk Valet IKM:
//  - kotor : linen kotor di ruangan yang belum diambil (terpakai + dirty utility)
//  - cuci  : linen sudah diambil (transaksi PROSES) dan belum dikirim kembali bersih
//  - kurang: sisa kurang kirim yang belum diselesaikan
// <select> bawaan browser tidak bisa menampilkan badge, jadi dibuat dropdown sendiri.
const RoomStatusSelect = ({ value, onChange, rooms, roomStatus }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const statusOf = (id) => roomStatus[id] || { kotor: 0, cuci: 0, kurang: 0 };
  const selected = rooms.find(r => String(r.id) === String(value));
  const pending = rooms.filter(r => statusOf(r.id).kotor > 0 || statusOf(r.id).cuci > 0 || statusOf(r.id).kurang > 0).length;

  const Badges = ({ id }) => {
    const { kotor, cuci, kurang } = statusOf(id);
    if (kotor <= 0 && cuci <= 0 && kurang <= 0) return null;
    return (
      <span className="flex items-center gap-1 shrink-0">
        {kotor > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            {kotor} Pcs
          </span>
        )}
        {kurang > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            {kurang} Pcs
          </span>
        )}
        {cuci > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 text-[10px] font-bold whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
            {cuci} Pcs
          </span>
        )}
      </span>
    );
  };

  const pick = (id) => { onChange(String(id)); setOpen(false); };
  const optCls = (active) => `w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold cursor-pointer transition ${active ? 'bg-[#1ea59e]/10 text-[#126776]' : 'text-slate-700 hover:bg-slate-50'}`;

  return (
    <div className="relative min-w-[200px]" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] cursor-pointer flex items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{selected ? selected.name : 'Semua Ruangan'}</span>
        {selected
          ? <Badges id={selected.id} />
          : pending > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold whitespace-nowrap">{pending} ruangan</span>}
      </button>
      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
        <ChevronDown className="w-4 h-4" />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[320px] max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl py-1">
          <button type="button" onClick={() => pick('')} className={optCls(!value)}>
            <span>Semua Ruangan</span>
            {pending > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold">{pending} ruangan</span>}
          </button>
          {rooms.map(room => (
            <button key={room.id} type="button" onClick={() => pick(room.id)} className={optCls(String(room.id) === String(value))}>
              <span className="truncate">{room.name}</span>
              <Badges id={room.id} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoomStatusSelect;
