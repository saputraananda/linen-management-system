import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Activity, 
  Cpu, 
  Database, 
  Radio, 
  Shirt, 
  RefreshCw, 
  Truck, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  Server,
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function Home() {
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchSystemInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get('/api/info');
        if (response.data && response.data.success) {
          setSystemInfo(response.data);
        } else {
          throw new Error(response.data?.message || 'Gagal memuat status sistem');
        }
      } catch (err) {
        console.error('API Fetch error, using fallback client data:', err);
        setError('Koneksi ke backend Express belum aktif atau terjadi kesalahan. Silakan pastikan backend berjalan di port 5000.');
        // Fallback mock data for demo visual check
        setSystemInfo({
          success: true,
          message: "Selamat Datang di PT Waschen Alora Indonesia - Linen Monitoring System (Demo)",
          version: "1.0.0 (Demo Mode)",
          environment: "client-fallback",
          status: "Demo Mode Active",
          timestamp: new Date().toISOString(),
          database: {
            status: "Offline / Unreachable",
            client: "MySQL 2"
          },
          metrics: {
            rfidScannerStatus: "SIMULATED",
            laundryProcessingUnit: "SIMULATED",
            activeTrackedLinens: 1248,
            pendingDispatchCount: 45
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSystemInfo();
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-hidden flex flex-col justify-between">
      {/* Background Decorative Glow Elements */}
      <div className="glow-spot bg-blue-500 top-[-100px] left-[-100px]" />
      <div className="glow-spot bg-sky-600 bottom-[-150px] right-[-100px]" />
      <div className="glow-spot bg-indigo-500 top-[30%] right-[10%]" />

      {/* Navigation / Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-xl shadow-lg shadow-sky-500/20">
              <Shirt className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5 font-sans">
                WASCHEN
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                  Monitoring
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">PT Waschen Alora Indonesia</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-900 text-slate-300 transition-all duration-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Segarkan
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              v1.0.0
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-6 py-12 flex-grow flex flex-col justify-center">
        {/* Welcome Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            <span>Monorepo Boilerplate Starter Active</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Linen Monitoring System
          </h2>
          <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Sistem pemantauan linen rumah sakit dan industri berbasis RFID. Starter ini mengintegrasikan frontend React + Vite dengan backend Express JS secara monorepo.
          </p>
        </div>

        {/* Backend Connectivity Check Banner */}
        {error && (
          <div className="max-w-4xl mx-auto w-full mb-8 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <WifiOff className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Menunggu Koneksi Backend...</span>
                <span className="text-xs text-amber-300/80">{error}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-slate-300">
                npm run dev
              </code>
              <span className="text-xs text-slate-400">untuk menjalankan API & Frontend secara paralel</span>
            </div>
          </div>
        )}

        {/* Dynamic Mock Status / Real Status Dashboard Display */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 text-sm">Menghubungkan ke API Waschen...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
            {/* API Status Box */}
            <div className="md:col-span-3 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300">Status Server API</h3>
                    <p className="text-xs text-slate-500">Merespon dari server.js</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    systemInfo?.environment === 'client-fallback' 
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      systemInfo?.environment === 'client-fallback' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}></span>
                    {systemInfo?.status || 'Unknown'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500 mb-1">Message from Server:</p>
                  <p className="text-slate-200 font-medium">{systemInfo?.message}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Database Connection:</p>
                  <p className="text-slate-200 font-medium flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-sky-400" />
                    {systemInfo?.database?.status} ({systemInfo?.database?.client})
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
                  <Radio className="h-5 w-5" />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Device Status</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">RFID Scanner</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white tracking-tight">
                    {systemInfo?.metrics?.rfidScannerStatus}
                  </span>
                  <span className="text-xs text-emerald-400 flex items-center gap-0.5">
                    <Wifi className="h-3 w-3" /> ONLINE
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl">
                  <Shirt className="h-5 w-5" />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Inventory</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">Linen Sedang Dipantau</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    {systemInfo?.metrics?.activeTrackedLinens?.toLocaleString('id-ID')}
                  </span>
                  <span className="text-xs text-slate-400">Pcs</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Truck className="h-5 w-5" />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Logistics</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">Antrean Pengiriman</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    {systemInfo?.metrics?.pendingDispatchCount}
                  </span>
                  <span className="text-xs text-slate-400">Bundles</span>
                </div>
              </div>
            </div>

            {/* Starter Structure Guide Box */}
            <div className="md:col-span-3 bg-gradient-to-tr from-slate-900/60 to-slate-950 border border-slate-800/80 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-400" />
                Struktur Komponen yang Telah Dibuat
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/30 border border-slate-800/50 p-4 rounded-xl">
                  <span className="text-xs font-bold text-sky-400 block mb-1">1. Routing (Express)</span>
                  <code className="text-[10px] text-slate-300 block mb-2 font-mono">api/routes/info.routes.js</code>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Mengarahkan request <code className="text-sky-300">GET /api/info</code> ke fungsi controller.
                  </p>
                </div>
                <div className="bg-slate-900/30 border border-slate-800/50 p-4 rounded-xl">
                  <span className="text-xs font-bold text-indigo-400 block mb-1">2. Controller (Express)</span>
                  <code className="text-[10px] text-slate-300 block mb-2 font-mono">api/controllers/info.controller.js</code>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Fungsi <code className="text-indigo-300">getSystemInfo</code> memproses data sistem dan mengembalikan response JSON.
                  </p>
                </div>
                <div className="bg-slate-900/30 border border-slate-800/50 p-4 rounded-xl">
                  <span className="text-xs font-bold text-pink-400 block mb-1">3. Frontend Page (React)</span>
                  <code className="text-[10px] text-slate-300 block mb-2 font-mono">src/pages/Home.jsx</code>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Halaman Selamat Datang ini yang terintegrasi Axios untuk mengambil data API.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 border-t border-slate-900/80 bg-slate-950/80 backdrop-blur-sm text-center">
        <p className="text-xs text-slate-500">
          &copy; {new Date().getFullYear()} PT Waschen Alora Indonesia. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
