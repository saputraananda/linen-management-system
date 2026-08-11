import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
const axiosInstance = axios;


import {
  Building, Search, Shirt, Database, AlertTriangle,
  CheckCircle2, ChevronRight, Layers, RefreshCw, Warehouse, HelpCircle
} from 'lucide-react';
import { socket } from '../../../utils/socket';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('all');
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [showOnlyShortage, setShowOnlyShortage] = useState(false);
  const [selectedLinenDetail, setSelectedLinenDetail] = useState(null);
  const [detailModalTab, setDetailModalTab] = useState('shortage');

  // Inline Editing States
  const [editingCell, setEditingCell] = useState(null); // { itemId, type: 'terpakai' | 'gudang' }
  const [editValue, setEditValue] = useState('');
  const [updating, setUpdating] = useState(false);

  // Modal Inline Editing States
  const [modalEditingCell, setModalEditingCell] = useState(null); // { roomId }
  const [modalEditValue, setModalEditValue] = useState('');

  // Smart Terpakai Modal States
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedUpdateLinen, setSelectedUpdateLinen] = useState(null);
  const [updateMode, setUpdateMode] = useState('out'); // 'out', 'in', or 'override'
  const [updateValue, setUpdateValue] = useState('');
  const [updateTarget, setUpdateTarget] = useState('terpakai'); // 'terpakai' or 'dirty'

  // Smart Gudang Modal States
  const [showGudangModal, setShowGudangModal] = useState(false);
  const [selectedGudangLinen, setSelectedGudangLinen] = useState(null);
  const [gudangValue, setGudangValue] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    if (!token || role !== 'rs') {
      navigate('/login', { replace: true });
      return;
    }

    fetchDashboardData();
  }, [navigate]);

  useEffect(() => {
    const hospitalId = localStorage.getItem('employeeId');
    if (!hospitalId) return;

    // Connect to websocket and join hospital room
    socket.connect();
    socket.emit('join_hospital', hospitalId);

    const handleDataChanged = (event) => {
      console.log('Realtime socket update:', event);
      fetchDashboardData(true);
    };

    socket.on('data_changed', handleDataChanged);

    return () => {
      socket.off('data_changed', handleDataChanged);
      socket.disconnect();
    };
  }, []);

  // Fetch detailed dashboard data for the hospital
  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoadingData(true);
    setFetchError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axiosInstance.get('/api/rs/dashboard-data', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.success) {
        setDashboardData(response.data.data);
        return response.data.data;
      } else {
        setFetchError('Gagal memuat data linen rumah sakit');
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setFetchError(err.response?.data?.message || 'Terjadi kesalahan saat memuat data');
    } finally {
      if (!silent) setLoadingData(false);
    }
    return null;
  };

  // Update Terpakai stock
  const handleUpdateTerpakai = async (itemId, roomId, newValue) => {
    if (updating) return;
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      await axiosInstance.post('/api/rs/update-terpakai', {
        hospitalLinenId: itemId,
        roomId: roomId,
        qtyTerpakai: parseInt(newValue || 0)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchDashboardData();
      setEditingCell(null);
    } catch (err) {
      console.error('Error updating terpakai:', err);
      alert(err.response?.data?.message || 'Gagal memperbarui data terpakai');
    } finally {
      setUpdating(false);
    }
  };

  // Update Gudang stock
  const handleUpdateGudang = async (itemId, newValue, stokAwal) => {
    const val = parseInt(newValue || 0);
    if (val > stokAwal) {
      alert(`Jumlah gudang (${val} Pcs) tidak boleh melebihi Stok Awal (${stokAwal} Pcs)`);
      return;
    }
    if (updating) return;
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      await axiosInstance.post('/api/rs/update-gudang', {
        hospitalLinenId: itemId,
        qtyGudang: val
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchDashboardData();
      setEditingCell(null);
    } catch (err) {
      console.error('Error updating gudang:', err);
      alert(err.response?.data?.message || 'Gagal memperbarui data gudang');
    } finally {
      setUpdating(false);
    }
  };

  // Update Room Stock directly inside modal
  const handleUpdateModalRoomStock = async (roomId, newValue) => {
    if (updating) return;
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      await axiosInstance.post('/api/rs/update-room-stock', {
        hospitalLinenId: selectedLinenDetail.id,
        roomId: roomId,
        stockInRs: parseInt(newValue || 0)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const freshData = await fetchDashboardData();
      if (freshData && freshData.linens) {
        const updatedLinen = freshData.linens.find(hl => hl.id === selectedLinenDetail.id);
        if (updatedLinen) {
          setSelectedLinenDetail(updatedLinen);
        }
      }
      setModalEditingCell(null);
    } catch (err) {
      console.error('Error updating modal room stock:', err);
      alert(err.response?.data?.message || 'Gagal memperbarui stok ruangan');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveModalTerpakai = async () => {
    if (!selectedUpdateLinen || updating) return;
    
    // Resolve current terpakai and dirty
    const roomRecord = dashboardData?.roomLinens?.find(
      rl => rl.hospital_linen_id === selectedUpdateLinen.id && rl.room_id.toString() === selectedRoomFilter.toString()
    );
    const currentTerpakai = roomRecord ? parseInt(roomRecord.qty_terpakai || 0) : 0;
    const currentDirty = roomRecord ? parseInt(roomRecord.qty_dirty || 0) : 0;
    const currentStokAwal = roomRecord ? parseInt(roomRecord.stock_in_rs || 0) : 0;
    const currentLemari = Math.max(0, currentStokAwal - currentTerpakai - currentDirty);
    
    const inputVal = parseInt(updateValue || 0);
    let finalValue = 0;
    
    if (updateTarget === 'terpakai') {
      let finalTerpakai = currentTerpakai;
      if (updateMode === 'out') {
        if (inputVal > currentLemari) {
          alert("Jumlah yang diambil melebihi stok Lemari Bersih!");
          return;
        }
        finalTerpakai = currentTerpakai + inputVal;
      } else if (updateMode === 'in') {
        if (inputVal > currentTerpakai) {
          alert("Jumlah yang dimasukkan melebihi stok Terpakai!");
          return;
        }
        finalTerpakai = currentTerpakai - inputVal;
      } else {
        if (inputVal + currentDirty > currentStokAwal) {
          alert("Jumlah terpakai + dirty utility tidak boleh melebihi Stok Awal Ruangan!");
          return;
        }
        finalTerpakai = inputVal;
      }
      finalValue = finalTerpakai;
    } else {
      let finalDirty = currentDirty;
      if (updateMode === 'out') {
        if (inputVal > currentLemari) {
          alert("Jumlah kotor melebihi stok Lemari Bersih!");
          return;
        }
        finalDirty = currentDirty + inputVal;
      } else if (updateMode === 'in') {
        if (inputVal > currentDirty) {
          alert("Jumlah yang dikurangi melebihi stok Dirty Utility!");
          return;
        }
        finalDirty = currentDirty - inputVal;
      } else {
        if (inputVal + currentTerpakai > currentStokAwal) {
          alert("Jumlah terpakai + dirty utility tidak boleh melebihi Stok Awal Ruangan!");
          return;
        }
        finalDirty = inputVal;
      }
      finalValue = finalDirty;
    }
    
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      await axiosInstance.post('/api/rs/update-terpakai', {
        hospitalLinenId: selectedUpdateLinen.id,
        roomId: selectedRoomFilter,
        qtyTerpakai: finalValue,
        type: updateTarget
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchDashboardData();
      setShowUpdateModal(false);
      setSelectedUpdateLinen(null);
      setUpdateValue('');
    } catch (err) {
      console.error('Error updating stock:', err);
      alert(err.response?.data?.message || 'Gagal memperbarui data stok');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveModalGudang = async () => {
    if (!selectedGudangLinen || updating) return;
    const val = parseInt(gudangValue || 0);
    const stokAwal = parseInt(selectedGudangLinen.stock_in_rs || 0);
    if (val < 0) {
      alert("Jumlah gudang tidak boleh kurang dari 0!");
      return;
    }
    if (val > stokAwal) {
      alert(`Jumlah gudang (${val} Pcs) tidak boleh melebihi Stok Awal (${stokAwal} Pcs)`);
      return;
    }
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      await axiosInstance.post('/api/rs/update-gudang', {
        hospitalLinenId: selectedGudangLinen.id,
        qtyGudang: val
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchDashboardData();
      setShowGudangModal(false);
      setSelectedGudangLinen(null);
      setGudangValue('');
    } catch (err) {
      console.error('Error updating gudang:', err);
      alert(err.response?.data?.message || 'Gagal memperbarui data gudang');
    } finally {
      setUpdating(false);
    }
  };


  // Filter logic for combined table
  const filteredLinens = dashboardData?.linens?.filter(item => {
    const displayName = getLinenDisplayName(item);
    const matchesSearch =
      displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.linen_code && item.linen_code.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesOwnership =
      ownershipFilter === 'all' ||
      (ownershipFilter === 'MILIK_RS' && item.ownership_type === 'MILIK_RS') ||
      (ownershipFilter === 'SEWA' && item.ownership_type === 'SEWA');

    const roomRecord = selectedRoomFilter === 'all' ? null : dashboardData?.roomLinens?.find(
      rl => rl.hospital_linen_id === item.id && rl.room_id.toString() === selectedRoomFilter.toString()
    );
    const currentShortage = selectedRoomFilter === 'all'
      ? parseInt(item.total_kurang || 0)
      : roomRecord ? parseInt(roomRecord.qty_kurang || 0) : 0;
    const matchesShortage = !showOnlyShortage || currentShortage > 0;

    if (selectedRoomFilter !== 'all' && !roomRecord) {
      return false;
    }

    return matchesSearch && matchesOwnership && matchesShortage;
  }) || [];

  // Helper to get selected room name
  const getSelectedRoomName = () => {
    if (selectedRoomFilter === 'all') return 'Total Seluruh Ruangan';
    const room = dashboardData?.rooms?.find(r => r.id.toString() === selectedRoomFilter.toString());
    return room ? room.room_name : 'Ruangan';
  };

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

  // Calculate room-specific metrics when a room is selected
  let totalLinenTypes = 0;
  let totalLemariStock = 0;
  let totalTerpakaiStock = 0;
  let totalDirtyStock = 0;

  if (selectedRoomFilter !== 'all' && dashboardData) {
    const roomLinenItems = dashboardData?.linens?.filter(item => {
      return dashboardData?.roomLinens?.some(
        rl => rl.hospital_linen_id === item.id && rl.room_id.toString() === selectedRoomFilter.toString()
      );
    }) || [];
    
    totalLinenTypes = roomLinenItems.length;
    
    roomLinenItems.forEach(item => {
      const roomRecord = dashboardData?.roomLinens?.find(
        rl => rl.hospital_linen_id === item.id && rl.room_id.toString() === selectedRoomFilter.toString()
      );
      const stockInRs = parseInt(roomRecord?.stock_in_rs || 0);
      const terpakai = parseInt(roomRecord?.qty_terpakai || 0);
      const dirty = parseInt(roomRecord?.qty_dirty || 0);
      totalLemariStock += Math.max(0, stockInRs - terpakai - dirty);
      totalTerpakaiStock += terpakai;
      totalDirtyStock += dirty;
    });
  }

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
            {selectedRoomFilter === 'all' ? (
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
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Card 1: JENIS LINEN */}
                <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-sm border border-slate-700/25">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-10 -translate-y-10 pointer-events-none" />
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-white/10 text-white border border-white/20 rounded-lg">
                      <Database className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold tracking-widest uppercase text-white/90">JENIS LINEN</span>
                  </div>
                  <h3 className="text-2xl font-black mt-2">
                    {loadingData ? '...' : formatNumber(totalLinenTypes)}
                  </h3>
                  <p className="text-xs text-white/60 font-semibold mt-0.5">aktif di ruangan ini</p>
                </div>

                {/* Card 2: STOK LEMARI */}
                <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm border border-blue-500/25">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-10 -translate-y-10 pointer-events-none" />
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-white/10 text-white border border-white/20 rounded-lg">
                      <Building className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold tracking-widest uppercase text-white/90">STOK LEMARI</span>
                  </div>
                  <h3 className="text-2xl font-black mt-2">
                    {loadingData ? '...' : formatNumber(totalLemariStock)}
                  </h3>
                  <p className="text-xs text-white/60 font-semibold mt-0.5">tersedia di lemari</p>
                </div>

                {/* Card 3: TERPAKAI */}
                <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm border border-amber-500/25">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-10 -translate-y-10 pointer-events-none" />
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-white/10 text-white border border-white/20 rounded-lg">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold tracking-widest uppercase text-white/90">TERPAKAI</span>
                  </div>
                  <h3 className="text-2xl font-black mt-2">
                    {loadingData ? '...' : formatNumber(totalTerpakaiStock)}
                  </h3>
                  <p className="text-xs text-white/60 font-semibold mt-0.5">sedang digunakan unit</p>
                </div>

                {/* Card 4: DIRTY UTILITY */}
                <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-sm border border-rose-500/25">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-10 -translate-y-10 pointer-events-none" />
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-white/10 text-white border border-white/20 rounded-lg">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold tracking-widest uppercase text-white/90">DIRTY UTILITY</span>
                  </div>
                  <h3 className="text-2xl font-black mt-2">
                    {loadingData ? '...' : formatNumber(totalDirtyStock)}
                  </h3>
                  <p className="text-xs text-white/60 font-semibold mt-0.5 font-medium">kotor siap dicuci</p>
                </div>
              </div>
            )}

            {/* ──────────────── INVENTORY & ROOMS COMBINED SECTION ──────────────── */}
            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">

              {/* Header, Search & Room Dropdown Filter */}
              <div className="px-6 py-5 border-b border-slate-100 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

                  {/* Section Title */}
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-teal-600" />
                    <h2 className="text-sm md:text-base font-bold text-slate-800">
                      Status Inventaris Linen & Stok Ruangan
                    </h2>
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

                    {/* Dropdown Room Filter */}
                    <div className="relative">
                      <select
                        value={selectedRoomFilter}
                        onChange={(e) => setSelectedRoomFilter(e.target.value)}
                        className="block pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 transition-all text-xs cursor-pointer appearance-none"
                      >
                        <option value="all">Semua Ruangan</option>
                        {dashboardData?.rooms?.map(room => (
                          <option key={room.id} value={room.id.toString()}>
                            {room.room_name}{room.is_special_unit === 1 ? ' (Transit/Spesial)' : ''}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
                        <ChevronRight className="h-3 w-3 transform rotate-90" />
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Unified Table Content */}
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm md:text-base border-collapse text-slate-600">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-xs md:text-sm border-b border-slate-100">
                      <th className="py-4 px-6 text-center">No</th>
                      <th className="py-4 px-6">Nama Linen</th>
                      <th className="py-4 px-6 text-center">Kepemilikan</th>
                      <th className="py-4 px-6 text-center">Stok Awal Ruangan</th>
                      <th className="py-4 px-6 text-center">Terpakai</th>
                      <th className="py-4 px-6 text-center">
                        {selectedRoomFilter === 'all' ? 'Dirty Utility' : 'Dirty Utility'}
                      </th>
                      <th className="py-4 px-6 text-center">
                        {selectedRoomFilter === 'all' ? 'Lemari Bersih' : `Lemari Bersih (${getSelectedRoomName()})`}
                      </th>
                      <th className="py-4 px-6 text-center">Cuci IKM</th>
                      <th className="py-4 px-6 text-center">Gudang Linen</th>
                      <th className="py-4 px-6 text-center">Kurang Kirim IKM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingData ? (
                      <tr>
                        <td colSpan="10" className="py-12 text-center text-slate-400 text-sm font-semibold">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-teal-500 mb-2" />
                          Memuat data inventaris...
                        </td>
                      </tr>
                    ) : filteredLinens.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="py-12 text-center text-slate-400 text-sm font-semibold">
                          Tidak ada data linen yang cocok dengan kriteria pencarian/ruangan Anda.
                        </td>
                      </tr>
                    ) : (
                      filteredLinens.map((item, index) => {
                        const roomRecord = selectedRoomFilter === 'all' ? null : dashboardData?.roomLinens?.find(
                          rl => rl.hospital_linen_id === item.id && rl.room_id.toString() === selectedRoomFilter.toString()
                        );
                        const totalKurang = selectedRoomFilter === 'all'
                          ? parseInt(item.total_kurang || 0)
                          : roomRecord ? parseInt(roomRecord.qty_kurang || 0) : 0;
                        const hasShortage = totalKurang > 0;
                        
                        const displayStokAwal = selectedRoomFilter === 'all'
                          ? parseInt(item.stock_in_rs || 0)
                          : parseInt(roomRecord?.stock_in_rs || 0);

                        const terpakai = selectedRoomFilter === 'all'
                          ? parseInt(item.total_terpakai || 0)
                          : parseInt(roomRecord?.qty_terpakai || 0);

                        const dirty = selectedRoomFilter === 'all'
                          ? parseInt(item.total_dirty || 0)
                          : roomRecord ? parseInt(roomRecord.qty_dirty || 0) : 0;
                          
                        const lemari = selectedRoomFilter === 'all'
                          ? parseInt(item.total_lemari || 0)
                          : Math.max(0, displayStokAwal - terpakai - dirty);
                          
                        const cuci = selectedRoomFilter === 'all'
                          ? parseInt(item.total_cuci || 0)
                          : roomRecord ? parseInt(roomRecord.qty_cuci || 0) : 0;
                        const gudang = parseInt(item.total_gudang || 0);

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
                            <td className="py-4 px-6 text-center text-slate-650 font-semibold text-sm md:text-base">
                              {formatNumber(displayStokAwal)}
                            </td>
                            
                            {/* Terpakai Column (Editable only if a room is selected) */}
                            <td 
                              className="py-4 px-6 text-center"
                              onClick={(e) => {
                                if (selectedRoomFilter !== 'all') {
                                  e.stopPropagation();
                                  setSelectedUpdateLinen(item);
                                  setUpdateTarget('terpakai');
                                  setUpdateMode('out');
                                  setUpdateValue('1');
                                  setShowUpdateModal(true);
                                }
                              }}
                            >
                              <span className={`inline-flex items-center gap-1 font-bold ${selectedRoomFilter !== 'all' ? 'text-teal-600 hover:bg-slate-100 px-2 py-1 rounded-lg cursor-pointer border border-dashed border-teal-200' : 'text-slate-600'}`}>
                                {formatNumber(terpakai)}
                                {selectedRoomFilter !== 'all' && (
                                  <svg className="w-3.5 h-3.5 text-teal-400 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                )}
                              </span>
                            </td>

                            {/* Dirty Utility Column (Editable only if a room is selected) */}
                            <td 
                              className="py-4 px-6 text-center"
                              onClick={(e) => {
                                if (selectedRoomFilter !== 'all') {
                                  e.stopPropagation();
                                  setSelectedUpdateLinen(item);
                                  setUpdateTarget('dirty');
                                  setUpdateMode('out');
                                  setUpdateValue('1');
                                  setShowUpdateModal(true);
                                }
                              }}
                            >
                              <span className={`inline-flex items-center gap-1 font-bold ${selectedRoomFilter !== 'all' ? 'text-rose-600 hover:bg-slate-100 px-2 py-1 rounded-lg cursor-pointer border border-dashed border-rose-200' : 'text-slate-600'}`}>
                                {formatNumber(dirty)}
                                {selectedRoomFilter !== 'all' && (
                                  <svg className="w-3.5 h-3.5 text-rose-400 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                )}
                              </span>
                            </td>

                            {/* Lemari Column */}
                            <td className="py-4 px-6 text-center text-slate-700 font-semibold text-sm md:text-base">
                              {formatNumber(lemari)}
                            </td>

                            {/* Cuci Column */}
                            <td className="py-4 px-6 text-center text-slate-600 font-medium text-sm md:text-base">
                              {formatNumber(cuci)}
                            </td>

                            {/* Gudang Column (Always editable if Gudang room setup exists) */}
                             <td 
                               className="py-4 px-6 text-center"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setSelectedGudangLinen(item);
                                 setGudangValue(gudang.toString());
                                 setShowGudangModal(true);
                               }}
                             >
                               <span className="inline-flex items-center gap-1 font-bold text-teal-600 hover:bg-slate-100 px-2 py-1 rounded-lg cursor-pointer border border-dashed border-teal-200">
                                 {formatNumber(gudang)}
                                 <svg className="w-3.5 h-3.5 text-teal-400 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                 </svg>
                               </span>
                             </td>

                            {/* Kurang Kirim Column */}
                            <td className="py-4 px-6 text-center">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm md:text-base font-bold ${hasShortage
                                ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                : 'bg-slate-50 text-slate-400 border border-slate-100'
                                }`}>
                                {formatNumber(totalKurang)}
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

              {/* Breadcrumb Navigation Tabs */}
              <nav className="flex items-center gap-2 px-1 text-xs font-bold text-slate-400 select-none pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setDetailModalTab('shortage')}
                  className={`transition-colors cursor-pointer pb-1 ${
                    detailModalTab === 'shortage'
                      ? 'text-teal-600 font-extrabold border-b-2 border-teal-500'
                      : 'hover:text-slate-600'
                  }`}
                >
                  Riwayat & Catatan Kurang Kirim
                </button>
                <span className="pb-1">/</span>
                <button
                  type="button"
                  onClick={() => setDetailModalTab('distribution')}
                  className={`transition-colors cursor-pointer pb-1 ${
                    detailModalTab === 'distribution'
                      ? 'text-teal-600 font-extrabold border-b-2 border-teal-500'
                      : 'hover:text-slate-600'
                  }`}
                >
                  Distribusi Stok per Ruangan / Unit
                </button>
              </nav>

              {detailModalTab === 'shortage' ? (
                /* Riwayat & Catatan Kurang Kirim Section */
                <div className="space-y-3 animate-[fadeIn_0.2s_ease-out]">
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-slate-400" />
                    Riwayat & Catatan Kurang Kirim
                  </h4>

                  {dashboardData?.history?.filter(h => h.hospital_linen_id === selectedLinenDetail.id).length > 0 ? (
                    <div className="border border-slate-150 rounded-2xl overflow-x-auto shadow-sm">
                      <table className="w-full text-left text-xs border-collapse min-w-[650px]">
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
                                <td className="py-2.5 px-3 font-medium text-slate-550 text-center whitespace-nowrap">
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
              ) : (
                /* Distribusi Stok per Ruangan/Unit Section */
                <div className="space-y-3 animate-[fadeIn_0.2s_ease-out]">
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-slate-400" />
                    Distribusi Stok per Ruangan / Unit
                  </h4>

                  <div className="border border-slate-150 rounded-2xl overflow-x-auto shadow-sm bg-white">
                    <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-150">
                          <th className="py-2.5 px-3">Nama Ruangan</th>
                          <th className="py-2.5 px-3 text-center">Jenis</th>
                          <th className="py-2.5 px-3 text-center">Terpakai</th>
                          <th className="py-2.5 px-3 text-center">Dirty Utility</th>
                          <th className="py-2.5 px-3 text-center">Stok Lemari / Gudang</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {dashboardData?.rooms?.map((room) => {
                          const roomLinen = dashboardData?.roomLinens?.find(
                            rl => rl.hospital_linen_id === selectedLinenDetail.id && rl.room_id.toString() === room.id.toString()
                          );
                          const stockInRs = roomLinen ? parseInt(roomLinen.stock_in_rs || 0) : 0;
                          const qtyTerpakai = roomLinen ? parseInt(roomLinen.qty_terpakai || 0) : 0;
                          const qtyDirty = roomLinen ? parseInt(roomLinen.qty_dirty || 0) : 0;
                          const lemariStock = room.is_gudang_linen === 1 ? stockInRs : Math.max(0, stockInRs - qtyTerpakai - qtyDirty);

                          return (
                            <tr key={room.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {room.room_name}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  room.is_gudang_linen === 1
                                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                    : 'bg-teal-50 text-teal-700 border border-teal-100'
                                }`}>
                                  {room.is_gudang_linen === 1 ? 'Gudang' : 'Unit'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-medium text-slate-500">
                                {formatNumber(qtyTerpakai)} Pcs
                              </td>
                              <td className="py-2.5 px-3 text-center font-medium text-slate-500">
                                {formatNumber(qtyDirty)} Pcs
                              </td>
                              <td 
                                className="py-2.5 px-3 text-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalEditingCell({ roomId: room.id });
                                  setModalEditValue(lemariStock.toString());
                                }}
                              >
                                {modalEditingCell?.roomId === room.id ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={modalEditValue}
                                    onChange={(e) => setModalEditValue(e.target.value)}
                                    onBlur={() => handleUpdateModalRoomStock(room.id, modalEditValue)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleUpdateModalRoomStock(room.id, modalEditValue);
                                      if (e.key === 'Escape') setModalEditingCell(null);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-16 px-1.5 py-0.5 text-center bg-white border border-teal-500 rounded-md text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                                    autoFocus
                                    disabled={updating}
                                  />
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-bold text-teal-600 hover:bg-slate-100 px-2 py-0.5 rounded-md cursor-pointer border border-dashed border-teal-200">
                                    {formatNumber(lemariStock)} Pcs
                                    <svg className="w-3.5 h-3.5 text-teal-400 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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

      {/* Smart Terpakai Update Modal */}
      {showUpdateModal && selectedUpdateLinen && (() => {
        const roomRecord = dashboardData?.roomLinens?.find(
          rl => rl.hospital_linen_id === selectedUpdateLinen.id && rl.room_id.toString() === selectedRoomFilter.toString()
        );
        const currentStokAwal = roomRecord ? parseInt(roomRecord.stock_in_rs || 0) : 0;
        const currentTerpakai = roomRecord ? parseInt(roomRecord.qty_terpakai || 0) : 0;
        const currentDirty = roomRecord ? parseInt(roomRecord.qty_dirty || 0) : 0;
        const currentLemari = Math.max(0, currentStokAwal - currentTerpakai - currentDirty);
        
        const numericVal = parseInt(updateValue || 0);
        let previewTerpakai = currentTerpakai;
        let previewDirty = currentDirty;
        
        if (updateTarget === 'terpakai') {
          if (updateMode === 'out') {
            previewTerpakai = currentTerpakai + numericVal;
          } else if (updateMode === 'in') {
            previewTerpakai = Math.max(0, currentTerpakai - numericVal);
          } else {
            previewTerpakai = numericVal;
          }
        } else {
          if (updateMode === 'out') {
            previewDirty = currentDirty + numericVal;
          } else if (updateMode === 'in') {
            previewDirty = Math.max(0, currentDirty - numericVal);
          } else {
            previewDirty = numericVal;
          }
        }
        
        const previewLemari = Math.max(0, currentStokAwal - previewTerpakai - previewDirty);
        
        let isValid = true;
        let errorMessage = '';
        
        if (updateTarget === 'terpakai') {
          isValid = previewTerpakai >= 0 && previewTerpakai + currentDirty <= currentStokAwal;
          if (updateMode === 'out' && numericVal > currentLemari) {
            isValid = false;
            errorMessage = 'Jumlah yang diambil melebihi stok Lemari Bersih!';
          } else if (updateMode === 'in' && numericVal > currentTerpakai) {
            isValid = false;
            errorMessage = 'Jumlah yang dimasukkan melebihi stok Terpakai!';
          } else if (previewTerpakai < 0) {
            isValid = false;
            errorMessage = 'Jumlah terpakai tidak boleh kurang dari 0!';
          } else if (previewTerpakai + currentDirty > currentStokAwal) {
            isValid = false;
            errorMessage = 'Jumlah terpakai + kotor melebihi Stok Awal Ruangan!';
          }
        } else {
          isValid = previewDirty >= 0 && previewDirty + currentTerpakai <= currentStokAwal;
          if (updateMode === 'out' && numericVal > currentLemari) {
            isValid = false;
            errorMessage = 'Jumlah kotor melebihi stok Lemari Bersih!';
          } else if (updateMode === 'in' && numericVal > currentDirty) {
            isValid = false;
            errorMessage = 'Jumlah yang dikurangi melebihi stok Dirty Utility!';
          } else if (previewDirty < 0) {
            isValid = false;
            errorMessage = 'Jumlah kotor tidak boleh kurang dari 0!';
          } else if (previewDirty + currentTerpakai > currentStokAwal) {
            isValid = false;
            errorMessage = 'Jumlah terpakai + kotor melebihi Stok Awal Ruangan!';
          }
        }

        const isDirtyTarget = updateTarget === 'dirty';

        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-[fadeIn_0.2s_ease-out]">
              
              {/* Header */}
              <div className={`p-5 bg-gradient-to-br ${isDirtyTarget ? 'from-rose-600 to-red-700' : 'from-[#126776] to-[#1ea59e]'} text-white flex justify-between items-center`}>
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-white/15 px-2.5 py-0.5 rounded-full border border-white/10">
                    Pembaruan Stok {isDirtyTarget ? 'Dirty Utility' : 'Terpakai'} RS
                  </span>
                  <h3 className="text-base font-bold mt-1 tracking-tight">
                    {getLinenDisplayName(selectedUpdateLinen)}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowUpdateModal(false);
                    setSelectedUpdateLinen(null);
                    setUpdateValue('');
                  }}
                  className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                
                {/* Info Box */}
                <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Stok Awal</span>
                    <span className="text-xs font-extrabold text-slate-700 mt-0.5 block">{currentStokAwal} Pcs</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Terpakai</span>
                    <span className="text-xs font-extrabold text-slate-700 mt-0.5 block">{currentTerpakai} Pcs</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Kotor</span>
                    <span className="text-xs font-extrabold text-slate-700 mt-0.5 block">{currentDirty} Pcs</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lemari</span>
                    <span className="text-xs font-extrabold text-slate-700 mt-0.5 block">{currentLemari} Pcs</span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1 border border-slate-200 shadow-inner">
                  <button
                    type="button"
                    onClick={() => {
                      setUpdateMode('out');
                      setUpdateValue('1');
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border ${
                      updateMode === 'out'
                        ? 'bg-white text-black shadow-sm font-extrabold border-slate-250'
                        : 'text-slate-800 hover:text-black font-extrabold border-transparent hover:bg-white/40'
                    }`}
                  >
                    {isDirtyTarget ? 'Kotor (+)' : 'Keluar (-)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUpdateMode('in');
                      setUpdateValue('1');
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border ${
                      updateMode === 'in'
                        ? 'bg-white text-black shadow-sm font-extrabold border-slate-250'
                        : 'text-slate-800 hover:text-black font-extrabold border-transparent hover:bg-white/40'
                    }`}
                  >
                    {isDirtyTarget ? 'Kurang (-)' : 'Masuk (+)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUpdateMode('override');
                      setUpdateValue(isDirtyTarget ? currentDirty.toString() : currentTerpakai.toString());
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border ${
                      updateMode === 'override'
                        ? 'bg-white text-black shadow-sm font-extrabold border-slate-250'
                        : 'text-slate-800 hover:text-black font-extrabold border-transparent hover:bg-white/40'
                    }`}
                  >
                    Ubah Total
                  </button>
                </div>

                {/* Input Fields */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {updateTarget === 'terpakai' ? (
                      <>
                        {updateMode === 'out' && 'Jumlah linen yang dikeluarkan (diambil dari lemari)'}
                        {updateMode === 'in' && 'Jumlah linen yang dimasukkan (dikembalikan ke lemari)'}
                        {updateMode === 'override' && 'Ubah total terpakai menjadi'}
                      </>
                    ) : (
                      <>
                        {updateMode === 'out' && 'Jumlah linen kotor (diambil dari lemari)'}
                        {updateMode === 'in' && 'Jumlah linen yang dikurangi dari kantong kotor'}
                        {updateMode === 'override' && 'Ubah total kotor (dirty utility) menjadi'}
                      </>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={updateValue}
                    onChange={(e) => setUpdateValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-355 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 text-slate-900 placeholder-slate-400"
                    placeholder="Masukkan jumlah..."
                    autoFocus
                  />
                </div>

                {/* Preview Calculation */}
                <div className={`p-3 rounded-2xl border text-xs font-semibold ${isValid ? 'bg-teal-50 border-teal-100 text-teal-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className={`h-4 w-4 ${isValid ? 'text-teal-600' : 'text-rose-500'}`} />
                    <span>Pratinjau Hasil Pembaruan:</span>
                  </div>
                  <div className="mt-1.5 space-y-1 pl-5 text-[11px] font-medium text-slate-655">
                    <div>
                      {isDirtyTarget ? (
                        <>
                          Dirty Utility Baru: {updateMode === 'out' && `${currentDirty} + ${numericVal} = ${previewDirty} Pcs`}
                          {updateMode === 'in' && `${currentDirty} - ${numericVal} = ${previewDirty} Pcs`}
                          {updateMode === 'override' && `${previewDirty} Pcs`}
                        </>
                      ) : (
                        <>
                          Terpakai Baru: {updateMode === 'out' && `${currentTerpakai} + ${numericVal} = ${previewTerpakai} Pcs`}
                          {updateMode === 'in' && `${currentTerpakai} - ${numericVal} = ${previewTerpakai} Pcs`}
                          {updateMode === 'override' && `${previewTerpakai} Pcs`}
                        </>
                      )}
                    </div>
                    <div>
                      Lemari Baru: {currentStokAwal} - {previewTerpakai} - {previewDirty} = {previewLemari} Pcs
                    </div>
                    {!isValid && (
                      <div className="text-rose-600 font-bold mt-1">
                        * {errorMessage || 'Jumlah input tidak valid!'}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-155 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowUpdateModal(false);
                    setSelectedUpdateLinen(null);
                    setUpdateValue('');
                  }}
                  className="px-4 py-2 border border-slate-400 text-slate-800 hover:text-black hover:border-slate-500 bg-white hover:bg-slate-50 active:scale-95 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalTerpakai}
                  disabled={updating || !isValid}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white disabled:opacity-50 text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
                >
                  {updating ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Smart Gudang Update Modal */}
      {showGudangModal && selectedGudangLinen && (() => {
        const currentGudang = parseInt(selectedGudangLinen.total_gudang || 0);
        const itemStokAwal = parseInt(selectedGudangLinen.stock_in_rs || 0);
        
        const numericVal = parseInt(gudangValue || 0);
        let isValid = numericVal >= 0 && numericVal <= itemStokAwal;
        let errorMessage = '';
        
        if (numericVal < 0) {
          isValid = false;
          errorMessage = 'Jumlah gudang tidak boleh kurang dari 0!';
        } else if (numericVal > itemStokAwal) {
          isValid = false;
          errorMessage = `Jumlah gudang tidak boleh melebihi Stok Awal (${itemStokAwal} Pcs)!`;
        }

        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-[fadeIn_0.2s_ease-out]">
              
              {/* Header */}
              <div className="p-5 bg-gradient-to-br from-[#126776] to-[#1ea59e] text-white flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-white/15 px-2.5 py-0.5 rounded-full border border-white/10">
                    Pembaruan Stok Gudang Linen
                  </span>
                  <h3 className="text-base font-bold mt-1 tracking-tight">
                    {getLinenDisplayName(selectedGudangLinen)}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowGudangModal(false);
                    setSelectedGudangLinen(null);
                    setGudangValue('');
                  }}
                  className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                
                {/* Info Box */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Stok Awal RS</span>
                    <span className="text-sm font-extrabold text-slate-700 mt-0.5 block">{itemStokAwal} Pcs</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Gudang Sekarang</span>
                    <span className="text-sm font-extrabold text-slate-700 mt-0.5 block">{currentGudang} Pcs</span>
                  </div>
                </div>

                {/* Input Fields */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Jumlah Stok Gudang Baru (Pcs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={itemStokAwal}
                    value={gudangValue}
                    onChange={(e) => setGudangValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-355 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 text-slate-900 placeholder-slate-400"
                    placeholder="Masukkan jumlah..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isValid && !updating) {
                        handleSaveModalGudang();
                      }
                    }}
                  />
                </div>

                {/* Preview Calculation / Warning */}
                <div className={`p-3 rounded-2xl border text-xs font-semibold ${isValid ? 'bg-teal-50 border-teal-100 text-teal-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className={`h-4 w-4 ${isValid ? 'text-teal-600' : 'text-rose-500'}`} />
                    <span>Validasi Pembaruan:</span>
                  </div>
                  <div className="mt-1.5 space-y-1 pl-5 text-[11px] font-medium text-slate-655">
                    <div>
                      Stok Gudang Baru: {numericVal} Pcs
                    </div>
                    {!isValid && (
                      <div className="text-rose-600 font-bold mt-1">
                        * {errorMessage}
                      </div>
                    )}
                    {isValid && (
                      <div className="text-teal-600 font-bold mt-1">
                        Input valid. Stok Gudang dapat diperbarui.
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowGudangModal(false);
                    setSelectedGudangLinen(null);
                    setGudangValue('');
                  }}
                  className="px-4 py-2 border border-slate-400 text-slate-800 hover:text-black hover:border-slate-500 bg-white hover:bg-slate-50 active:scale-95 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalGudang}
                  disabled={updating || !isValid}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white disabled:opacity-50 text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
                >
                  {updating ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}