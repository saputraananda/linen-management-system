import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Ya', cancelText = 'Batal' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl px-8 py-8 text-center max-w-sm w-full mx-4 animate-pop">
        <div className="mx-auto w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-[15px] text-slate-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[15px] font-semibold transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[15px] font-semibold transition-colors"
          >
            {confirmText}
          </button>
        </div>
        <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-lg hover:bg-slate-100 transition-colors">
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>
      <style>{`
        @keyframes pop {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop { animation: pop 0.2s ease-out; }
      `}</style>
    </div>
  );
}
