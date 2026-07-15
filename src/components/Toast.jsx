import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export default function Toast({ isOpen, onClose, title, message, icon = 'success', duration = 1500 }) {
  useEffect(() => {
    if (!isOpen || !duration) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  const Icon = icon === 'success' ? CheckCircle : AlertCircle;
  const color = icon === 'success'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : 'bg-rose-50 border-rose-200 text-rose-800';
  const iconColor = icon === 'success' ? 'text-emerald-500' : 'text-rose-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className={`relative rounded-2xl border shadow-lg px-8 py-10 text-center max-w-sm w-full mx-4 animate-pop ${color}`}>
        <Icon className={`h-12 w-12 mx-auto mb-4 ${iconColor}`} />
        <h3 className="text-xl font-bold mb-1">{title}</h3>
        {message && <p className="text-[15px] opacity-80">{message}</p>}
        <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-lg hover:bg-black/5 transition-colors">
          <X className="h-4 w-4" />
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
