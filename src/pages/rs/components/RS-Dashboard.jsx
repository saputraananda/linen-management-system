import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Building, Search, Shirt, Database, AlertTriangle,
  CheckCircle2, ChevronRight, Layers, RefreshCw
} from 'lucide-react';

export default function RSDashboard() {
  const navigate = useNavigate();

  // Helper to format/build full default linen name (name + size + color + material)
  const getLinenDisplayName = (item) => {
    if (!item) return '';
    if (item.hospital_linen_name && item.hospital_linen_name.trim() !== '') {
      return item.hospital_linen_name;
    }
    const parts = [item.linen_name || ''];
    if (item.size_name) parts.push(item.size_name);
    if (item.color_name) parts.push(item.color_name);
    if (item.material_name) parts.push(item.material_name);
    return parts.filter(Boolean).join(' ');
  };

  // Helper to format date in a readable format
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // UI States
  const [loadingData, setLoadingData] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Dashboard Data States
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'rooms'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('all');
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [showOnlyShortage, setShowOnlyShortage] = useState(false);
  const [selectedLinenDetail, setSelectedLinenDetail] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    if (!token || role !== 'rs') {
      navigate('/login', { replace: true });
      return;
    }

    fetchDashboardData();
  }, [navigate]);

  // Fetch detailed dashboard data for the hospital
  const fetchDashboardData = async () => {
    setLoadingData(true);
    setFetchError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/rs/dashboard-data', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.success) {
        setDashboardData(response.data.data);
      } else {
        setFetchError('Gagal memuat data linen rumah sakit');
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setFetchError(err.response?.data?.message || 'Terjadi kesalahan saat memuat data');
    } finally {
      setLoadingData(false);
    }
  };

  // Filter logic for Inventory
  const filteredLinens = dashboardData?.linens?.filter(item => {
    const displayName = getLinenDisplayName(item);
    const matchesSearch =
      displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.linen_code && item.linen_code.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesOwnership =
      ownershipFilter === 'all' ||
      (ownershipFilter === 'MILIK_RS' && item.ownership_type === 'MILIK_RS') ||
      (ownershipFilter === 'SEWA' && item.ownership_type === 'SEWA');

    const matchesShortage = !showOnlyShortage || parseInt(item.total_kurang || 0) > 0;

    return matchesSearch && matchesOwnership && matchesShortage;
  }) || [];

  // Filter logic for Rooms stock
  const filteredRooms = dashboardData?.roomLinens?.filter(item => {
    const matchesSearch =
      item.linen_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.room_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRoom =
      selectedRoomFilter === 'all' ||
      item.room_id.toString() === selectedRoomFilter;

    return matchesSearch && matchesRoom;
  }) || [];

  // Get unique rooms for room filter dropdown
  const uniqueRooms = Array.from(
    new Map(dashboardData?.roomLinens?.map(item => [item.room_id, item.room_name])).entries()
  ).map(([id, name]) => ({ id, name }));

  // Calculate specific stocks for Milik RS and Sewa
  let totalStockMilikRs = 0;
  let totalStockSewa = 0;
  if (dashboardData && dashboardData.linens) {
    dashboardData.linens.forEach(item => {
      const itemTotal = parseInt(item.stock_in_ikm || 0) + parseInt(item.stock_in_rs || 0);
      if (item.ownership_type === 'MILIK_RS') {
        totalStockMilikRs += itemTotal;
      } else if (item.ownership_type === 'SEWA') {
        totalStockSewa += itemTotal;
      }
    });
  }
  const totalOverallStock = totalStockMilikRs + totalStockSewa;
  const pctMilikRs = totalOverallStock > 0 ? Math.round((totalStockMilikRs / totalOverallStock) * 100) : 0;
  const pctSewa = totalOverallStock > 0 ? Math.round((totalStockSewa / totalOverallStock) * 100) : 0;

  const formatNumber = (num) => {
    return new Intl.NumberFormat('id-ID').format(num || 0);
  };

  return (
    <>
      <main className="min-h-screen bg-slate-50 py-6 sm:py-10">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">

            {/* Title & Refresh Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  {dashboardData?.hospital?.hospital_name || 'Linen Rumah Sakit'}
                </h1>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  {dashboardData?.hospital?.address || 'Monitoring status inventaris linen dan stok per ruangan.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchDashboardData}
                  disabled={loadingData}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 transition shadow-sm cursor-pointer disabled:opacity-50"
                  title="Refresh Data"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Error State */}
            {fetchError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-semibold flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
                <div>{fetchError}</div>
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">

              {/* Card 1: TOTAL JENIS LINEN */}
              <div
                onClick={() => { setOwnershipFilter('all'); setShowOnlyShortage(false); }}
                className={`cursor-pointer transition-all duration-300 relative overflow-hidden p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-white ${ownershipFilter === 'all' && !showOnlyShortage
                  ? 'ring-4 ring-offset-2 ring-slate-800 scale-[1.03] shadow-lg border-2 border-slate-700'
                  : 'opacity-85 hover:opacity-100 border border-slate-700/30 hover:scale-[1.01]'
                  }`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-10 -translate-y-10 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-16 h-16 bg-white/5 rounded-full translate-x-6 translate-y-6 pointer-events-none" />

                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-white/10 text-white border border-white/20 rounded-lg">
                    <Database className="h-3 w-3" />
                  </div>
                  <span className="text-xs font-semibold tracking-widest text-white/90 uppercase">TOTAL JENIS LINEN</span>
                </div>

                <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mt-0.5 tracking-tight">
                  {loadingData ? '...' : formatNumber(dashboardData?.stats?.totalLinenTypes)}
                </h3>
                <p className="text-xs text-white/60 mt-0.5 font-medium">semua ditampilkan</p>
              </div>

              {/* Card 2: MILIK RS */}
              <div
                onClick={() => { setOwnershipFilter('MILIK_RS'); setShowOnlyShortage(false); }}
                className={`cursor-pointer transition-all duration-300 relative overflow-hidden p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white ${ownershipFilter === 'MILIK_RS' && !showOnlyShortage
                  ? 'ring-4 ring-offset-2 ring-blue-600 scale-[1.03] shadow-lg border-2 border-blue-400'
                  : 'opacity-85 hover:opacity-100 border border-blue-500/30 hover:scale-[1.01]'
                  }`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-10 -translate-y-10 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-16 h-16 bg-white/5 rounded-full translate-x-6 translate-y-6 pointer-events-none" />

                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-white/10 text-white border border-white/20 rounded-lg">
                    <Building className="h-3 w-3" />
                  </div>
                  <span className="text-xs font-semibold tracking-widest text-white/90 uppercase">MILIK RS</span>
                </div>

                <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mt-0.5 tracking-tight">
                  {loadingData ? '...' : formatNumber(totalStockMilikRs)}
                </h3>
                <p className="text-xs text-white/60 mt-0.5 font-medium">{pctMilikRs}% dari total stok</p>
              </div>

              {/* Card 3: SEWA */}
              <div
                onClick={() => { setOwnershipFilter('SEWA'); setShowOnlyShortage(false); }}
                className={`cursor-pointer transition-all duration-300 relative overflow-hidden p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white ${ownershipFilter === 'SEWA' && !showOnlyShortage
                  ? 'ring-4 ring-offset-2 ring-amber-500 scale-[1.03] shadow-lg border-2 border-amber-400'
                  : 'opacity-85 hover:opacity-100 border border-amber-500/30 hover:scale-[1.01]'
                  }`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-10 -translate-y-10 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-16 h-16 bg-white/5 rounded-full translate-x-6 translate-y-6 pointer-events-none" />

                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-white/10 text-white border border-white/20 rounded-lg">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                  <span className="text-xs font-semibold tracking-widest text-white/90 uppercase">SEWA</span>
                </div>

                <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mt-0.5 tracking-tight">
                  {loadingData ? '...' : formatNumber(totalStockSewa)}
                </h3>
                <p className="text-xs text-white/60 mt-0.5 font-medium">{pctSewa}% dari total stok</p>
              </div>

              {/* Card 4: Total Linen Kurang Kirim */}
              <div
                onClick={() => { setOwnershipFilter('all'); setShowOnlyShortage(true); }}
                className={`cursor-pointer transition-all duration-300 relative overflow-hidden p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white ${showOnlyShortage
                  ? 'ring-4 ring-offset-2 ring-emerald-500 scale-[1.03] shadow-lg border-2 border-emerald-400'
                  : 'opacity-85 hover:opacity-100 border border-emerald-500/30 hover:scale-[1.01]'
                  }`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-10 -translate-y-10 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-16 h-16 bg-white/5 rounded-full translate-x-6 translate-y-6 pointer-events-none" />

                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-white/10 text-white border border-white/20 rounded-lg">
                    <Layers className="h-3 w-3" />
                  </div>
                  <span className="text-xs font-semibold tracking-widest text-white/90 uppercase">Total Linen Kurang Kirim</span>
                </div>

                <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mt-0.5 tracking-tight">
                  {loadingData ? '...' : formatNumber(dashboardData?.stats?.totalKurangKirim)}
                </h3>
                <p className="text-xs text-white/60 mt-0.5 font-medium">total akumulasi kurang kirim</p>
              </div>
            </div>

            {/* TABS & FILTERS SECTION */}
            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">

              {/* Header, Search & Navigation Tabs */}
              <div className="px-6 py-5 border-b border-slate-100 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

                  {/* Switch Tabs */}
                  <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl w-fit">
                    <button
                      onClick={() => { setActiveTab('inventory'); setSearchTerm(''); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'inventory'
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      <Database className="h-4 w-4" />
                      Inventaris Linen
                    </button>
                    <button
                      onClick={() => { setActiveTab('rooms'); setSearchTerm(''); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'rooms'
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      <Layers className="h-4 w-4" />
                      Stok per Ruangan
                    </button>
                  </div>

                  {/* Filter controls */}
                  <div className="flex flex-wrap items-center gap-3">

                    {/* Search box */}
                    <div className="relative w-full sm:w-80 md:w-96">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Cari linen..."
                        className="block w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 transition-all text-xs"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Search className="h-3.5 w-3.5" />
                      </div>
                    </div>

                    {/* Dropdown Room Filter (Tab 2 only) */}
                    {activeTab === 'rooms' && (
                      <div className="relative">
                        <select
                          value={selectedRoomFilter}
                          onChange={(e) => setSelectedRoomFilter(e.target.value)}
                          className="block pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 transition-all text-xs cursor-pointer appearance-none"
                        >
                          <option value="all">Semua Ruangan</option>
                          {uniqueRooms.map(room => (
                            <option key={room.id} value={room.id}>{room.name}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
                          <ChevronRight className="h-3 w-3 transform rotate-90" />
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              </div>

              {/* TAB 1 content: INVENTARIS LINEN */}
              {activeTab === 'inventory' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm md:text-base border-collapse text-slate-600">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-xs md:text-sm border-b border-slate-100">
                        <th className="py-4 px-6 text-center">No</th>
                        <th className="py-4 px-6">Nama Linen</th>
                        <th className="py-4 px-6 text-center">Kepemilikan</th>
                        <th className="py-4 px-6 text-center">Satuan</th>
                        <th className="py-4 px-6 text-center">Total Linen Kurang</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingData ? (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-slate-400 text-sm font-semibold">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-teal-500 mb-2" />
                            Memuat data inventaris...
                          </td>
                        </tr>
                      ) : filteredLinens.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-slate-400 text-sm font-semibold">
                            Tidak ada data linen yang cocok dengan pencarian Anda.
                          </td>
                        </tr>
                      ) : (
                        filteredLinens.map((item, index) => {
                          const totalKurang = parseInt(item.total_kurang || 0);
                          const hasShortage = totalKurang > 0;

                          return (
                            <tr
                              key={item.id}
                              onClick={() => setSelectedLinenDetail(item)}
                              className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                              title="Klik untuk melihat rincian kurang kirim"
                            >
                              <td className="py-4 px-6 font-medium text-slate-400 text-sm md:text-base text-center">
                                {index + 1}
                              </td>
                              <td className="py-4 px-6 font-semibold text-slate-800 text-sm md:text-base">
                                {getLinenDisplayName(item)}
                              </td>
                              <td className="py-4 px-6 text-center">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${item.ownership_type === 'SEWA'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-100'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                  }`}>
                                  {item.ownership_type === 'SEWA' ? 'Sewa' : 'Milik RS'}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-center text-slate-500 text-sm md:text-base font-medium">
                                {item.unit || 'Pcs'}
                              </td>
                              <td className="py-4 px-6 text-center">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm md:text-base font-bold ${hasShortage
                                  ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                  : 'bg-slate-50 text-slate-400 border border-slate-100'
                                  }`}>
                                  {formatNumber(totalKurang)} Pcs
                                  {hasShortage && <AlertTriangle className="h-4 w-4 text-rose-500" />}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2 content: STOK PER RUANGAN */}
              {activeTab === 'rooms' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm md:text-base border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-xs md:text-sm border-b border-slate-100">
                        <th className="py-4 px-6 text-center">Nama Ruangan</th>
                        <th className="py-4 px-6 text-center">Nama Linen</th>
                        <th className="py-4 px-6 text-center">Stok di Ruangan (RS)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingData ? (
                        <tr>
                          <td colSpan="3" className="py-12 text-center text-slate-400 text-sm font-semibold">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-teal-500 mb-2" />
                            Memuat data stok ruangan...
                          </td>
                        </tr>
                      ) : filteredRooms.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="py-12 text-center text-slate-400 text-sm font-semibold">
                            Tidak ada data stok ruangan yang ditemukan.
                          </td>
                        </tr>
                      ) : (
                        filteredRooms.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="py-4 px-6 font-semibold text-slate-900 text-sm md:text-base">
                              <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                {item.room_name}
                              </span>
                            </td>
                            <td className="py-4 px-6 font-semibold text-slate-700 text-sm md:text-base">
                              {item.linen_name}
                            </td>
                            <td className="py-4 px-6 text-right font-bold text-teal-600 text-sm md:text-base">
                              {item.stock_in_rs} Pcs
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Details Modal */}
      {selectedLinenDetail && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh] animate-[fadeIn_0.2s_ease-out]">

            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-br from-[#126776] to-[#1ea59e] text-white flex justify-between items-start relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-6 translate-x-6 pointer-events-none" />
              <div>
                <span className="text-xs font-semibold tracking-widest uppercase bg-white/15 px-3 py-1 rounded-full border border-white/10">
                  Rincian Kurang Kirim Linen
                </span>
                <h3 className="text-xl font-bold mt-3 tracking-tight">
                  {getLinenDisplayName(selectedLinenDetail)}
                </h3>
                <p className="text-sm text-white/80 font-semibold mt-1">
                  Kepemilikan: {selectedLinenDetail.ownership_type === 'SEWA' ? 'Sewa' : 'Milik RS'} ({selectedLinenDetail.unit || 'Pcs'})
                </p>
              </div>
              <button
                onClick={() => setSelectedLinenDetail(null)}
                className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">

              {/* Summary card */}
              <div className="bg-rose-500/[0.04] p-5 rounded-2xl border border-rose-100 flex flex-col items-center justify-center text-center">
                <AlertTriangle className="h-7 w-7 text-rose-500 mb-1" />
                <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Total Kurang Kirim Saat Ini</span>
                <span className="text-2xl font-extrabold text-rose-700 mt-1">
                  {formatNumber(selectedLinenDetail.total_kurang)} {selectedLinenDetail.unit || 'Pcs'}
                </span>
              </div>

              {/* History of kurang kirim list */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-slate-400" />
                  Riwayat & Catatan Kurang Kirim
                </h4>

                {dashboardData?.history?.filter(h => h.hospital_linen_id === selectedLinenDetail.id).length > 0 ? (
                  <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-150">
                          <th className="py-2.5 px-3 text-center">Tanggal</th>
                          <th className="py-2.5 px-3">No. Formulir</th>
                          <th className="py-2.5 px-3 text-center">Kotor</th>
                          <th className="py-2.5 px-3 text-center">Bersih</th>
                          <th className="py-2.5 px-3 text-center">Selisih</th>
                          <th className="py-2.5 px-3">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {dashboardData.history
                          .filter(h => h.hospital_linen_id === selectedLinenDetail.id)
                          .map((h, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-3 font-medium text-slate-500 text-center whitespace-nowrap">
                                {formatDate(h.delivery_date || h.pickup_date)}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {h.form_number}
                              </td>
                              <td className="py-2.5 px-3 text-center font-medium text-slate-650">
                                {formatNumber(h.qty_kotor)}
                              </td>
                              <td className="py-2.5 px-3 text-center font-medium text-slate-650">
                                {formatNumber(h.qty_bersih)}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-rose-600">
                                {formatNumber(h.qty_kurang)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 italic max-w-[150px] truncate" title={h.notes || ''}>
                                {h.notes || '—'}
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-10 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs font-semibold">
                    Tidak ada riwayat kekurangan kirim untuk linen ini.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedLinenDetail(null)}
                className="px-6 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold transition shadow-sm active:scale-95 cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
