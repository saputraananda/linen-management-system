import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

// Modal peringatan standar (sama dengan peringatan di Serah Terima Linen)
export default function AlertDialog({ message, title = 'Peringatan', onClose }) {
  if (!message) return null;
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-6 animate-[scaleIn_0.2s_ease-out]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100/50">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
            <p className="text-slate-500 text-xs font-semibold mt-1">Sistem Waschen Alora</p>
          </div>
        </div>
        <p className="text-slate-600 text-sm font-semibold leading-relaxed">{message}</p>
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-[#126776] to-[#1ea59e] hover:from-[#0e5562] hover:to-[#188b85] text-white rounded-xl text-xs font-semibold shadow-md shadow-[#126776]/10 active:scale-95 transition cursor-pointer"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
