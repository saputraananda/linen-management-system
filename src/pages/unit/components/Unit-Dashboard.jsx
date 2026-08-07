import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Building, Search, ArrowLeft, Database, AlertTriangle, CheckCircle2,
  Layers, RefreshCw, Home, Compass, ChevronRight
} from 'lucide-react';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { socket } from '../../../utils/socket';

export default function UnitDashboard() {
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Read saved room selection
  const [selectedRoom, setSelectedRoom] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('unit_selected_room') || 'null');
    } catch {
      return null;
    }
  });

  // User session details
  const hospitalId = localStorage.getItem('employeeId'); // for hospital / unit, employeeId stores the hospital's PK in mst_hospital
  const hospitalName = localStorage.getItem('fullName') || 'Rumah Sakit';

  // API Data States
  const [loadingData, setLoadingData] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roomSearchTerm, setRoomSearchTerm] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [showOnlyShortage, setShowOnlyShortage] = useState(false);
  const [selectedLinenDetail, setSelectedLinenDetail] = useState(null);
  const [detailModalTab, setDetailModalTab] = useState('shortage');

  // Active Nurse States
  const [activeNurse, setActiveNurse] = useState(() => {
    return sessionStorage.getItem('unit_nurse_name') || '';
  });
  const [nurseInput, setNurseInput] = useState('');

  // Linen Activity Logs
  const [linenLogs, setLinenLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Inline Editing States
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [updating, setUpdating] = useState(false);

  // Smart Terpakai Modal States
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedUpdateLinen, setSelectedUpdateLinen] = useState(null);
  const [updateMode, setUpdateMode] = useState('add'); // 'add' or 'correct'
  const [updateValue, setUpdateValue] = useState('');
  const [updateTarget, setUpdateTarget] = useState('terpakai'); // 'terpakai' or 'dirty'

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    if (!token || role !== 'unit') {
      navigate('/login', { replace: true });
      return;
    }

    if (hospitalId) {
      fetchDashboardData(hospitalId, selectedRoom?.id);
    }
  }, [navigate, hospitalId, selectedRoom]);

  useEffect(() => {
    if (!hospitalId) return;

    // Connect to websocket and join hospital room
    socket.connect();
    socket.emit('join_hospital', hospitalId);

    const handleDataChanged = (event) => {
      console.log('Realtime socket update:', event);
      fetchDashboardData(hospitalId, selectedRoom?.id, true);
    };

    socket.on('data_changed', handleDataChanged);

    return () => {
      socket.off('data_changed', handleDataChanged);
      socket.disconnect();
    };
  }, [hospitalId, selectedRoom]);

  const fetchDashboardData = async (hId, roomId, silent = false) => {
    if (!silent) setLoadingData(true);
    setFetchError('');
    try {
      const token = localStorage.getItem('token');
      const targetRoomId = roomId || selectedRoom?.id;
      const url = targetRoomId
        ? `/api/unit/dashboard-data?hospitalId=${hId}&roomId=${targetRoomId}`
        : `/api/unit/dashboard-data?hospitalId=${hId}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.success) {
        setDashboardData(response.data.data);
      } else {
        setFetchError('Gagal memuat data linen rumah sakit');
      }
    } catch (err) {
      console.error('Error fetching unit dashboard data:', err);
      setFetchError(err.response?.data?.message || 'Terjadi kesalahan saat memuat data');
    } finally {
      if (!silent) setLoadingData(false);
    }
  };

  const fetchLinenLogs = async (linenId, rId) => {
    setLoadingLogs(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/unit/linen-logs?hospitalLinenId=${linenId}&roomId=${rId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.success) {
        setLinenLogs(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching linen logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (selectedLinenDetail && selectedRoom) {
      fetchLinenLogs(selectedLinenDetail.id, selectedRoom.id);
    } else {
      setLinenLogs([]);
    }
  }, [selectedLinenDetail, selectedRoom]);

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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('id-ID').format(num || 0);
  };

  // Select room handler
  const handleSelectRoom = (room) => {
    sessionStorage.setItem('unit_selected_room', JSON.stringify(room));
    setSelectedRoom(room);
    if (hospitalId) {
      fetchDashboardData(hospitalId, room.id);
    }
  };

  // Change room handler
  const handleResetRoom = () => {
    sessionStorage.removeItem('unit_selected_room');
    sessionStorage.removeItem('unit_nurse_name');
    setSelectedRoom(null);
    setActiveNurse('');
    setNurseInput('');
    setSearchTerm('');
  };

  // Update Terpakai stock
  const handleUpdateTerpakai = async (itemId, roomId, newValue) => {
    if (updating) return;
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/unit/update-terpakai', {
        hospitalLinenId: itemId,
        roomId: roomId,
        qtyTerpakai: parseInt(newValue || 0),
        nurseName: activeNurse
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchDashboardData(hospitalId, roomId);
      setEditingCell(null);

      // Refresh modal logs if open
      if (selectedLinenDetail && selectedLinenDetail.id === itemId) {
        fetchLinenLogs(itemId, roomId);
      }
    } catch (err) {
      console.error('Error updating terpakai:', err);
      alert(err.response?.data?.message || 'Gagal memperbarui data terpakai');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveModalTerpakai = async () => {
    if (!selectedUpdateLinen || updating) return;

    // Resolve current terpakai and dirty
    const roomRecord = dashboardData?.roomLinens?.find(
      rl => rl.hospital_linen_id === selectedUpdateLinen.id && rl.room_id.toString() === selectedRoom?.id?.toString()
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
      await axios.post('/api/unit/update-terpakai', {
        hospitalLinenId: selectedUpdateLinen.id,
        roomId: selectedRoom.id,
        qtyTerpakai: finalValue,
        nurseName: activeNurse,
        type: updateTarget
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchDashboardData(hospitalId, selectedRoom.id);
      setShowUpdateModal(false);
      setSelectedUpdateLinen(null);
      setUpdateValue('');

      // Refresh modal logs if open
      if (selectedLinenDetail && selectedLinenDetail.id === selectedUpdateLinen.id) {
        fetchLinenLogs(selectedUpdateLinen.id, selectedRoom.id);
      }
    } catch (err) {
      console.error('Error updating stock:', err);
      alert(err.response?.data?.message || 'Gagal memperbarui data stok');
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
      await axios.post('/api/unit/update-gudang', {
        hospitalLinenId: itemId,
        qtyGudang: val
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchDashboardData(hospitalId);
      setEditingCell(null);
    } catch (err) {
      console.error('Error updating gudang:', err);
      alert(err.response?.data?.message || 'Gagal memperbarui data gudang');
    } finally {
      setUpdating(false);
    }
  };

  // Filter logic for Room Dashboard
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

    // Filter to only display linens registered to this specific selected room
    if (selectedRoom) {
      const existsInRoom = dashboardData?.roomLinens?.some(
        rl => rl.hospital_linen_id === item.id && rl.room_id.toString() === selectedRoom.id.toString()
      );
      if (!existsInRoom) return false;
    }

    return matchesSearch && matchesOwnership && matchesShortage;
  }) || [];

  // Sum total items in this room
  let totalLinenTypes = filteredLinens.length;
  let totalLemariStock = 0;
  let totalTerpakaiStock = 0;
  let totalDirtyStock = 0;

  filteredLinens.forEach(item => {
    const roomRecord = dashboardData?.roomLinens?.find(
      rl => rl.hospital_linen_id === item.id && rl.room_id.toString() === selectedRoom?.id?.toString()
    );
    const stockInRs = parseInt(roomRecord?.stock_in_rs || 0);
    const terpakai = parseInt(roomRecord?.qty_terpakai || 0);
    const dirty = parseInt(roomRecord?.qty_dirty || 0);
    totalLemariStock += Math.max(0, stockInRs - terpakai - dirty);
    totalTerpakaiStock += terpakai;
    totalDirtyStock += dirty;
  });

  // Filter rooms based on search term
  const filteredRooms = dashboardData?.rooms?.filter(room =>
    room.room_name.toLowerCase().includes(roomSearchTerm.toLowerCase())
  ) || [];

  return (
    <>
      <main className="min-h-screen bg-slate-50 py-6 sm:py-10">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">

          {/* Error Message */}
          {fetchError && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-semibold flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              <div>{fetchError}</div>
            </div>
          )}

          {/* ──────────────── FLOW 1: SELECT ROOM SCREEN ──────────────── */}
          {!selectedRoom ? (
            <div className="space-y-6 sm:space-y-8 animate-[fadeIn_0.3s_ease-out]">
              <div className="text-center max-w-md mx-auto space-y-2">
                <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-teal-500 to-[#126776] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg text-white">
                  <Compass className="h-6 w-6 sm:h-8 sm:w-8" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Pilih Ruangan Unit</h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Selamat datang di portal unit {hospitalName}. Silakan pilih ruangan Anda untuk mengakses dashboard.
                </p>
              </div>

              {/* Room Search Bar */}
              {dashboardData?.rooms && dashboardData.rooms.length > 0 && (
                <div className="max-w-md mx-auto px-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={roomSearchTerm}
                      onChange={(e) => setRoomSearchTerm(e.target.value)}
                      placeholder="Cari ruangan..."
                      className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 transition-all text-xs shadow-sm"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              )}

              {loadingData ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-semibold">
                  <RefreshCw className="h-8 w-8 animate-spin text-teal-600 mb-3" />
                  Memuat daftar ruangan...
                </div>
              ) : !dashboardData?.rooms || dashboardData.rooms.length === 0 ? (
                <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-3xl max-w-lg mx-auto bg-white font-semibold">
                  <Building className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                  Belum ada ruangan terdaftar di rumah sakit ini.
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-3xl max-w-lg mx-auto bg-white font-semibold px-4">
                  <Building className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                  Tidak ada ruangan yang cocok dengan pencarian "{roomSearchTerm}".
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 max-w-5xl mx-auto px-4">
                  {filteredRooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => handleSelectRoom(room)}
                      className="cursor-pointer group relative bg-white border border-slate-200 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md hover:border-teal-500/30 active:scale-[0.99] transition-all overflow-hidden flex flex-col justify-between min-h-[120px] sm:min-h-[140px]"
                    >
                      {/* Decorative elements */}
                      <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 bg-teal-500/[0.02] rounded-full translate-x-8 -translate-y-8 pointer-events-none transition-transform group-hover:scale-110" />

                      <div className="space-y-2 sm:space-y-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center transition-colors group-hover:bg-teal-500 group-hover:text-white">
                          <Home className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-xs sm:text-sm md:text-base tracking-tight group-hover:text-teal-700 transition-colors line-clamp-2">
                            {room.room_name}
                          </h3>
                          {room.is_gudang_linen === 1 && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[8px] sm:text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                              Gudang Linen
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[9px] sm:text-[11px] font-bold text-teal-600 mt-2 sm:mt-4 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        Masuk Ruangan
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : !activeNurse ? (
            /* ──────────────── FLOW 1.5: NURSE NAME PROMPT ──────────────── */
            <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-3xl shadow-xl space-y-6 animate-[fadeIn_0.2s_ease-out]">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Siapa yang bertugas saat ini?</h2>
                <p className="text-sm text-slate-500 font-medium">
                  Silakan masukkan nama Anda untuk mencatat log aktivitas di ruangan <span className="font-bold text-slate-700">{selectedRoom.room_name}</span>.
                </p>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (!nurseInput.trim()) return;
                setActiveNurse(nurseInput.trim());
                sessionStorage.setItem('unit_nurse_name', nurseInput.trim());
              }} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Perawat / Staff</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ns. Ananda"
                    value={nurseInput}
                    onChange={(e) => setNurseInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  Mulai Bertugas
                  <ChevronRight className="h-4 w-4" />
                </button>
              </form>

              {dashboardData?.recentNurses && dashboardData.recentNurses.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pilih Cepat Petugas Sebelumnya:</span>
                  <div className="flex flex-wrap gap-2">
                    {dashboardData.recentNurses.map((nurse, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setNurseInput(nurse);
                          setActiveNurse(nurse);
                          sessionStorage.setItem('unit_nurse_name', nurse);
                        }}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95"
                      >
                        {nurse}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-center pt-2">
                <button
                  onClick={handleResetRoom}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 inline-flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Kembali ke Daftar Ruangan
                </button>
              </div>
            </div>
          ) : (

            /* ──────────────── FLOW 2: DASHBOARD VIEW ──────────────── */
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">

              {/* Header Title */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-100">
                      <Home className="h-3 w-3" />
                      Ruangan: {selectedRoom.room_name}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                      <CheckCircle2 className="h-3 w-3" />
                      Petugas: {activeNurse}
                      <button
                        onClick={() => {
                          setActiveNurse('');
                          sessionStorage.removeItem('unit_nurse_name');
                        }}
                        className="ml-1 text-[10px] text-amber-500 hover:text-amber-700 font-extrabold underline cursor-pointer"
                      >
                        (Ganti)
                      </button>
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
                    {hospitalName}
                  </h1>
                  <p className="text-sm text-slate-500 mt-1 font-medium">
                    Monitoring stok linen khusus ruangan {selectedRoom.room_name}.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetRoom}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Ganti Ruangan
                  </button>

                  <button
                    onClick={() => fetchDashboardData(hospitalId)}
                    disabled={loadingData}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 transition shadow-sm cursor-pointer disabled:opacity-50"
                    title="Refresh Data"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Metrics cards for selected room */}
              <div className="grid grid-cols-4 gap-3 sm:gap-6">

                {/* Metric 1: Total Linen Types */}
                <div className="relative overflow-hidden p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-sm border border-slate-700/25">
                  <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-white/10 rounded-full translate-x-8 -translate-y-8 sm:translate-x-10 sm:-translate-y-10 pointer-events-none" />
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <div className="p-1 bg-white/10 text-white border border-white/20 rounded-md sm:rounded-lg">
                      <Database className="h-3 w-3 sm:h-4 sm:w-4" />
                    </div>
                    <span className="text-[8px] sm:text-xs font-bold tracking-wider sm:tracking-widest uppercase text-white/90">JENIS LINEN</span>
                  </div>
                  <h3 className="text-lg sm:text-2xl font-black mt-1 sm:mt-2">
                    {loadingData ? '...' : formatNumber(totalLinenTypes)}
                  </h3>
                  <p className="text-[8px] sm:text-xs text-white/60 font-semibold mt-0.5">aktif di ruangan ini</p>
                </div>

                {/* Metric 2: Total Lemari */}
                <div className="relative overflow-hidden p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm border border-blue-500/25">
                  <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-white/10 rounded-full translate-x-8 -translate-y-8 sm:translate-x-10 sm:-translate-y-10 pointer-events-none" />
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <div className="p-1 bg-white/10 text-white border border-white/20 rounded-md sm:rounded-lg">
                      <Building className="h-3 w-3 sm:h-4 sm:w-4" />
                    </div>
                    <span className="text-[8px] sm:text-xs font-bold tracking-wider sm:tracking-widest uppercase text-white/90">STOK LEMARI</span>
                  </div>
                  <h3 className="text-lg sm:text-2xl font-black mt-1 sm:mt-2">
                    {loadingData ? '...' : formatNumber(totalLemariStock)}
                  </h3>
                  <p className="text-[8px] sm:text-xs text-white/60 font-semibold mt-0.5">tersedia di lemari</p>
                </div>

                {/* Metric 3: Total Terpakai */}
                <div className="relative overflow-hidden p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm border border-amber-500/25">
                  <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-white/10 rounded-full translate-x-8 -translate-y-8 sm:translate-x-10 sm:-translate-y-10 pointer-events-none" />
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <div className="p-1 bg-white/10 text-white border border-white/20 rounded-md sm:rounded-lg">
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    </div>
                    <span className="text-[8px] sm:text-xs font-bold tracking-wider sm:tracking-widest uppercase text-white/90">TERPAKAI</span>
                  </div>
                  <h3 className="text-lg sm:text-2xl font-black mt-1 sm:mt-2">
                    {loadingData ? '...' : formatNumber(totalTerpakaiStock)}
                  </h3>
                  <p className="text-[8px] sm:text-xs text-white/60 font-semibold mt-0.5">sedang digunakan unit</p>
                </div>

                {/* Metric 4: Dirty Utility */}
                <div className="relative overflow-hidden p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-sm border border-rose-500/25">
                  <div className="absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-white/10 rounded-full translate-x-8 -translate-y-8 sm:translate-x-10 sm:-translate-y-10 pointer-events-none" />
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <div className="p-1 bg-white/10 text-white border border-white/20 rounded-md sm:rounded-lg">
                      <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
                    </div>
                    <span className="text-[8px] sm:text-xs font-bold tracking-wider sm:tracking-widest uppercase text-white/90">DIRTY UTILITY</span>
                  </div>
                  <h3 className="text-lg sm:text-2xl font-black mt-1 sm:mt-2">
                    {loadingData ? '...' : formatNumber(totalDirtyStock)}
                  </h3>
                  <p className="text-[8px] sm:text-xs text-white/60 font-semibold mt-0.5">kotor siap dicuci</p>
                </div>
              </div>

              {/* Info Notice Banner */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-xs sm:text-sm font-medium flex items-start gap-3 shadow-sm">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Pemberitahuan:</span> Jika ada perubahan berupa penambahan atau pengurangan stok di lemari unit, silakan hubungi admin / Tim Linen RS.
                </div>
              </div>

              {/* Table section */}
              <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">

                {/* Filters */}
                <div className="px-6 py-5 border-b border-slate-100 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-teal-600" />
                      <h2 className="text-sm md:text-base font-bold text-slate-800">
                        Status Inventaris Linen Ruangan
                      </h2>
                    </div>

                    <div className="flex items-center gap-3">
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
                    </div>

                  </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm md:text-base border-collapse text-slate-600">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-xs md:text-sm border-b border-slate-100">
                        <th className="py-4 px-6 text-center">No</th>
                        <th className="py-4 px-6">Nama Linen</th>
                        <th className="py-4 px-6 text-center">Kepemilikan</th>
                        <th className="py-4 px-6 text-center">Stok Awal Ruangan</th>
                        <th className="py-4 px-6 text-center">Terpakai</th>
                        <th className="py-4 px-6 text-center">Dirty Utility</th>
                        <th className="py-4 px-6 text-center">Lemari Bersih ({selectedRoom.room_name})</th>
                        <th className="py-4 px-6 text-center">Cuci IKM</th>
                        <th className="py-4 px-6 text-center">Kurang Kirim IKM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingData ? (
                        <tr>
                          <td colSpan="9" className="py-12 text-center text-slate-400 text-sm font-semibold">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-teal-500 mb-2" />
                            Memuat data inventaris...
                          </td>
                        </tr>
                      ) : filteredLinens.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="py-12 text-center text-slate-400 text-sm font-semibold">
                            Tidak ada data linen di ruangan ini.
                          </td>
                        </tr>
                      ) : (
                        filteredLinens.map((item, index) => {
                          // Resolve Terpakai, Dirty, and Lemari for selected room
                          const roomRecord = dashboardData?.roomLinens?.find(
                            rl => rl.hospital_linen_id === item.id && rl.room_id.toString() === selectedRoom.id.toString()
                          );
                          const totalKurang = parseInt(roomRecord?.qty_kurang || 0);
                          const hasShortage = totalKurang > 0;

                          const stokAwalRuangan = parseInt(roomRecord?.stock_in_rs || 0);
                          const terpakai = parseInt(roomRecord?.qty_terpakai || 0);
                          const dirty = parseInt(roomRecord?.qty_dirty || 0);
                          const lemari = Math.max(0, stokAwalRuangan - terpakai - dirty);
                          const cuci = parseInt(roomRecord?.qty_cuci || 0);

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
                                {formatNumber(stokAwalRuangan)}
                              </td>

                              {/* Terpakai Column (Editable) */}
                              <td
                                className="py-4 px-6 text-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!activeNurse.trim()) {
                                    alert("Silakan masukkan Nama Petugas / Perawat RS terlebih dahulu pada kolom di atas sebelum melakukan pembaruan.");
                                    const inputElem = document.getElementById("nurse-name-input");
                                    if (inputElem) {
                                      inputElem.focus();
                                      inputElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                    return;
                                  }
                                  setSelectedUpdateLinen(item);
                                  setUpdateTarget('terpakai');
                                  setUpdateMode('out');
                                  setUpdateValue('1'); // Default to +1 for quick use
                                  setShowUpdateModal(true);
                                }}
                              >
                                <span className="inline-flex items-center gap-1 font-bold text-teal-600 hover:bg-slate-100 px-2 py-1 rounded-lg cursor-pointer border border-dashed border-teal-200">
                                  {formatNumber(terpakai)}
                                  <svg className="w-3.5 h-3.5 text-teal-400 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </span>
                              </td>

                              {/* Dirty Utility Column (Read-only for Unit Staff) */}
                              <td className="py-4 px-6 text-center">
                                <span className="inline-flex items-center gap-1 font-bold text-slate-650">
                                  {formatNumber(dirty)}
                                </span>
                              </td>

                              {/* Lemari Column */}
                              <td className="py-4 px-6 text-center text-slate-700 font-semibold text-sm md:text-base">
                                {formatNumber(lemari)}
                              </td>

                              {/* Cuci Column */}
                              <td className="py-4 px-6 text-center text-slate-650 font-medium text-sm md:text-base">
                                {formatNumber(cuci)}
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
          )}
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
                  {formatNumber(selectedLinenDetail.total_kurang)}
                </span>
              </div>

              {/* Breadcrumb Navigation Tabs */}
              <nav className="flex items-center gap-2 px-1 text-xs font-bold text-slate-400 select-none pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setDetailModalTab('shortage')}
                  className={`transition-colors cursor-pointer pb-1 ${detailModalTab === 'shortage'
                      ? 'text-teal-600 font-extrabold border-b-2 border-teal-500'
                      : 'hover:text-slate-600'
                    }`}
                >
                  Riwayat & Catatan Kurang Kirim
                </button>
                <span className="pb-1">/</span>
                <button
                  type="button"
                  onClick={() => setDetailModalTab('activity')}
                  className={`transition-colors cursor-pointer pb-1 ${detailModalTab === 'activity'
                      ? 'text-teal-600 font-extrabold border-b-2 border-teal-500'
                      : 'hover:text-slate-600'
                    }`}
                >
                  Riwayat Aktivitas Pemakaian Unit
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
                          <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-155">
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
                /* Riwayat Aktivitas Pemakaian Unit Section */
                <div className="space-y-3 animate-[fadeIn_0.2s_ease-out]">
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-slate-400" />
                    Riwayat Aktivitas Pemakaian Unit
                  </h4>

                  {loadingLogs ? (
                    <div className="py-6 text-center text-slate-400 text-xs font-semibold">
                      <RefreshCw className="h-4 w-4 animate-spin text-teal-600 inline-block mr-2" />
                      Memuat log aktivitas...
                    </div>
                  ) : linenLogs.length > 0 ? (
                    <div className="border border-slate-150 rounded-2xl overflow-x-auto shadow-sm">
                      <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-155">
                            <th className="py-2.5 px-3 text-center">Waktu</th>
                            <th className="py-2.5 px-3">Petugas</th>
                            <th className="py-2.5 px-3 text-center">Aktivitas</th>
                            <th className="py-2.5 px-3 text-center">Sebelum</th>
                            <th className="py-2.5 px-3 text-center">Sesudah</th>
                            <th className="py-2.5 px-3 text-center">Selisih</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {linenLogs.map((log) => {
                            const diff = parseInt(log.new_value || 0) - parseInt(log.old_value || 0);
                            const formattedDiff = diff > 0 ? `+${diff}` : diff;
                            const diffColor = diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-500';

                            return (
                              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-2.5 px-3 font-medium text-slate-550 text-center whitespace-nowrap">
                                  {new Date(log.created_at).toLocaleString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-800">
                                  {log.nurse_name}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`inline-block px-1.5 py-0.5 rounded font-extrabold text-[9px] uppercase border ${log.action_type === 'UPDATE_DIRTY'
                                      ? 'bg-rose-50 text-rose-700 border-rose-100'
                                      : 'bg-teal-50 text-teal-700 border-teal-100'
                                    }`}>
                                    {log.action_type === 'UPDATE_TERPAKAI' ? 'Pakai Linen' : log.action_type === 'UPDATE_DIRTY' ? 'Dirty Utility' : log.action_type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-semibold text-slate-650">
                                  {formatNumber(log.old_value)}
                                </td>
                                <td className="py-2.5 px-3 text-center font-semibold text-slate-650">
                                  {formatNumber(log.new_value)}
                                </td>
                                <td className={`py-2.5 px-3 text-center font-extrabold ${diffColor}`}>
                                  {formattedDiff}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs font-semibold">
                      Belum ada log aktivitas untuk pemakaian linen ini.
                    </div>
                  )}
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
          rl => rl.hospital_linen_id === selectedUpdateLinen.id && rl.room_id.toString() === selectedRoom?.id?.toString()
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
                    Pembaruan Stok {isDirtyTarget ? 'Dirty Utility' : 'Terpakai'}
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
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border ${updateMode === 'out'
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
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border ${updateMode === 'in'
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
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border ${updateMode === 'override'
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
                    className="w-full px-3 py-2 border border-slate-350 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 text-slate-900 placeholder-slate-400"
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
                  <div className="mt-1.5 space-y-1 pl-5 text-[11px] font-medium text-slate-650">
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
              <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-end gap-2.5">
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

      <ConfirmDialog
        isOpen={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => { localStorage.clear(); sessionStorage.clear(); navigate('/login', { replace: true }); }}
        title="Keluar"
        message="Apakah Anda yakin ingin keluar dari sistem?"
        confirmText="Ya, Keluar"
        cancelText="Batal"
      />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
