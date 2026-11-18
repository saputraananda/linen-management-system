// Badge kepemilikan linen (mst_hospital_linen.ownership_type): SEWA = linen sewa IKM, selain itu Milik RS.
// Gaya sama dengan kolom Kepemilikan di dashboard RS.
export default function OwnershipBadge({ type }) {
  if (!type) return <span className="text-slate-300 font-semibold">—</span>;
  const isSewa = type === 'SEWA';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${isSewa
      ? 'bg-sky-50 text-sky-700 border border-sky-100'
      : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
      }`}>
      {isSewa ? 'Sewa' : 'Milik RS'}
    </span>
  );
}
