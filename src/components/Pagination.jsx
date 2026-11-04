import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 'all'];
export const DEFAULT_PAGE_SIZE = 10;

// Nomor halaman dengan elipsis: 1 … 4 5 6 … 20 (pola sama dengan Linen Transaction di superapp)
export function generatePages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i += 1) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

const navCls = 'flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

// Footer pagination server-side. pagination = { page, limit, total, totalPages }.
// pageSize: angka atau 'all'. Footer tetap tampil selama ada data agar ukuran halaman bisa diganti kembali.
export default function Pagination({ pagination, shown, onChange, pageSize, onPageSizeChange }) {
  const { page, total, totalPages } = pagination;
  if (!total) return null;
  return (
    <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs font-semibold text-slate-500 shadow-sm lg:flex-row">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
        <div>
          Menampilkan <span className="font-bold text-slate-800">{shown}</span> dari <span className="font-bold text-slate-800">{total}</span> data
        </div>
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            Tampilkan:
            <span className="relative">
              <select value={pageSize} onChange={(e) => onPageSizeChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-8 text-xs font-bold text-slate-700 outline-none transition focus:border-[#1ea59e] focus:ring-4 focus:ring-[#1ea59e]/10">
                {PAGE_SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o === 'all' ? 'Semua' : o}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute inset-y-0 right-2.5 my-auto h-3.5 w-3.5 text-slate-400" />
            </span>
          </label>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Halaman sebelumnya" onClick={() => onChange(page - 1)} disabled={page <= 1} className={navCls}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          {generatePages(page, totalPages).map((p, i) => (
            p === '...' ? (
              <span key={`gap-${i}`} className="flex h-8 w-8 items-center justify-center text-slate-400">…</span>
            ) : (
              <button type="button" key={p} onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined}
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border transition ${p === page ? 'border-[#1ea59e] bg-[#1ea59e] font-bold text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {p}
              </button>
            )
          ))}
          <button type="button" aria-label="Halaman berikutnya" onClick={() => onChange(page + 1)} disabled={page >= totalPages} className={navCls}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
