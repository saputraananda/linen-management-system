import { Construction } from 'lucide-react';

export default function KurangKirimGorden() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Construction className="w-16 h-16 text-yellow-500 mb-4" />
      <h2 className="text-2xl font-bold text-gray-700 mb-2">Coming Soon</h2>
      <p className="text-gray-500 max-w-md">
        Halaman Kurang Kirim Gorden sedang dalam pengembangan. Silakan kembali lagi nanti.
      </p>
    </div>
  );
}
