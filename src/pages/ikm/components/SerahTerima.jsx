import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import {
  FileText, Search, Calendar, CheckCircle2,
  AlertTriangle, ArrowLeft, RefreshCw, PlusCircle,
  ChevronRight, ChevronDown, Save, User, Clock, AlertCircle,
  Warehouse, Building, Shirt, HelpCircle
} from 'lucide-react';

export default function SerahTerima() {
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'form'
  const [hospitalId] = useState(sessionStorage.getItem('valet_hospital_id') || '');
  const [hospitalName, setHospitalName] = useState('');

  // History tab states
  const [transactions, setTransactions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(!!sessionStorage.getItem('valet_hospital_id'));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form tab states (New transaction - Day 1 Kotor)
  const [linensList, setLinensList] = useState([]);
  const [loadingLinens, setLoadingLinens] = useState(false);
  const [recorderName, setRecorderName] = useState(
    localStorage.getItem('fullName') || localStorage.getItem('username') || ''
  );
  const [pickupDate, setPickupDate] = useState(
    new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  );
  const [notes, setNotes] = useState('');
  const [kotorQuantities, setKotorQuantities] = useState({}); // { hospitalLinenId: qty }
  const [itemNotes, setItemNotes] = useState({}); // { hospitalLinenId: noteText }
  const [submittingNew, setSubmittingNew] = useState(false);

  // Edit/Completion view state (Day 2 Bersih)
  const [editingTransaction, setEditingTransaction] = useState(null); // transaction detail object
  const [editRecorderName, setEditRecorderName] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(
    new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  );
  const [editNotes, setEditNotes] = useState('');
  const [editKotorQuantities, setEditKotorQuantities] = useState({}); // { detailId: qty }
  const [bersihQuantities, setBersihQuantities] = useState({}); // { detailId: qty }
  const [editItemNotes, setEditItemNotes] = useState({}); // { detailId: noteText }
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  // Employees searchable dropdown states
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  const [editSearchEmployeeQuery, setEditSearchEmployeeQuery] = useState('');
  const [isEditEmployeeDropdownOpen, setIsEditEmployeeDropdownOpen] = useState(false);

  // Linen table search states
  const [linenSearch, setLinenSearch] = useState('');
  const [editLinenSearch, setEditLinenSearch] = useState('');

  const employeeSelectRef = useRef(null);
  const editEmployeeSelectRef = useRef(null);

  // Refs to track previous filter and search query values to prevent duplicate mount runs
  const prevFiltersRef = useRef({ startDate, endDate, filterStatus });
  const prevSearchQueryRef = useRef(searchQuery);

  // Click outside listener for searchable dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (employeeSelectRef.current && !employeeSelectRef.current.contains(event.target)) {
        setIsEmployeeDropdownOpen(false);
      }
      if (editEmployeeSelectRef.current && !editEmployeeSelectRef.current.contains(event.target)) {
        setIsEditEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Push a browser history entry each time the view changes so the browser back button works correctly
  useEffect(() => {
    let viewKey;
    if (editingTransaction) {
      viewKey = `edit-${editingTransaction.transaction?.id}`;
    } else {
      viewKey = activeTab; // 'history' | 'form'
    }
    // Replace on the very first load (no duplicate), push on subsequent changes
    const isFirstLoad = window.history.state?.serahTerimaView == null;
    if (isFirstLoad) {
      window.history.replaceState({ serahTerimaView: viewKey }, '');
    } else if (window.history.state?.serahTerimaView !== viewKey) {
      window.history.pushState({ serahTerimaView: viewKey }, '');
    }
  }, [activeTab, editingTransaction]);

  // Handle browser back button — navigate within the component instead of leaving the page
  useEffect(() => {
    const handlePopState = (event) => {
      const view = event.state?.serahTerimaView;
      if (!view) return;

      if (view === 'history') {
        setEditingTransaction(null);
        setActiveTab('history');
        setErrorMsg('');
      } else if (view === 'form') {
        setEditingTransaction(null);
        setActiveTab('form');
        setErrorMsg('');
      } else if (view?.startsWith('edit-')) {
        // If going "forward" back into edit view via popstate, just close edit
        // (we can't re-open the edit form from history state alone safely)
        setEditingTransaction(null);
        setActiveTab('history');
        setErrorMsg('');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch IKM active employees
  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('/api/ikm/employees', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        setEmployees(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Naming logic priority helper
  // Priority: hospital_linen_name > linen_name + size + color + material
  const getLinenDisplayName = (item) => {
    if (item.hospital_linen_name && item.hospital_linen_name.trim() !== '') {
      return item.hospital_linen_name;
    }
    const parts = [item.linen_name || ''];
    if (item.size_name) parts.push(item.size_name);
    if (item.color_name) parts.push(item.color_name);
    if (item.material_name) parts.push(item.material_name);
    return parts.filter(Boolean).join(' ');
  };

  // Fetch initial data — runs once when hospitalId is available
  useEffect(() => {
    fetchEmployees();
    if (hospitalId) {
      fetchHospitalInfo();
      fetchHistory();
      fetchHospitalLinens();
    }
  }, [hospitalId]);

  // Auto-fetch on filter changes — skip initial mount by checking for actual changes
  useEffect(() => {
    if (!hospitalId) return;

    const prev = prevFiltersRef.current;
    const hasChanged = prev.startDate !== startDate ||
      prev.endDate !== endDate ||
      prev.filterStatus !== filterStatus;

    prevFiltersRef.current = { startDate, endDate, filterStatus };

    if (hasChanged) {
      fetchHistory();
    }
  }, [startDate, endDate, filterStatus, hospitalId]);

  // Auto-fetch on search query with debounce — skip initial mount by checking for actual changes
  useEffect(() => {
    if (!hospitalId) return;

    const prev = prevSearchQueryRef.current;
    const hasChanged = prev !== searchQuery;

    prevSearchQueryRef.current = searchQuery;

    if (hasChanged) {
      const timer = setTimeout(() => {
        fetchHistory();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, hospitalId]);


  const fetchHospitalInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/dashboard-data?hospitalId=${hospitalId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        setHospitalName(data.data.hospital?.hospital_name || '');
      }
    } catch (err) {
      console.error('Error fetching hospital info:', err);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      let url = `/api/ikm/transactions?hospitalId=${hospitalId}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (filterStatus !== 'all') url += `&status=${filterStatus}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        setTransactions(data.data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchHospitalLinens = async () => {
    setLoadingLinens(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/dashboard-data?hospitalId=${hospitalId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        setLinensList(data.data.linens || []);
        // Initialize kotor quantities to 0
        const initialQtys = {};
        const initialNotes = {};
        data.data.linens.forEach(item => {
          initialQtys[item.id] = 0;
          initialNotes[item.id] = '';
        });
        setKotorQuantities(initialQtys);
        setItemNotes(initialNotes);
      }
    } catch (err) {
      console.error('Error fetching linens:', err);
    } finally {
      setLoadingLinens(false);
    }
  };

  // Submit Day 1 Kotor form
  const handleCreatePickup = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const activeDetails = Object.entries(kotorQuantities)
      .filter(([_, qty]) => parseInt(qty) > 0)
      .map(([id, qty]) => ({
        hospitalLinenId: parseInt(id),
        qtyKotor: parseInt(qty),
        notes: itemNotes[id] || ''
      }));

    if (activeDetails.length === 0) {
      setErrorMsg('Harap isi jumlah "Kotor" minimal untuk 1 jenis linen.');
      return;
    }

    setSubmittingNew(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post('/api/ikm/transactions', {
        hospitalId: parseInt(hospitalId),
        recorderName,
        pickupDate: pickupDate.replace('T', ' ') + ':00',
        notes,
        details: activeDetails
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data?.success) {
        setNotes('');
        const resetQtys = {};
        const resetNotes = {};
        linensList.forEach(item => {
          resetQtys[item.id] = 0;
          resetNotes[item.id] = '';
        });
        setKotorQuantities(resetQtys);
        setItemNotes(resetNotes);
        setErrorMsg('');

        fetchHistory();
        setActiveTab('history');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Gagal menyimpan transaksi.');
    } finally {
      setSubmittingNew(false);
    }
  };

  // Click card to edit / complete delivery
  const handleOpenEdit = async (tx) => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/transactions/${tx.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        const fullTx = data.data;
        setEditingTransaction(fullTx);
        setEditRecorderName(fullTx.transaction.recorder_name);
        setEditNotes(fullTx.transaction.notes || '');

        if (fullTx.transaction.delivery_date) {
          const dDate = new Date(fullTx.transaction.delivery_date);
          setDeliveryDate(new Date(dDate.getTime() - dDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        } else {
          setDeliveryDate(new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        }

        // Initialize kotor and bersih quantities
        const initialKotor = {};
        const initialBersih = {};
        const initialNotes = {};
        fullTx.details.forEach(item => {
          initialKotor[item.id] = item.qty_kotor !== null ? item.qty_kotor : '';
          initialBersih[item.id] = item.qty_bersih !== null ? item.qty_bersih : '';
          initialNotes[item.id] = item.notes || '';
        });
        setEditKotorQuantities(initialKotor);
        setBersihQuantities(initialBersih);
        setEditItemNotes(initialNotes);
        setErrorMsg('');
      }
    } catch (err) {
      console.error('Error fetching transaction detail:', err);
    }
  };

  // Submit Day 2 Bersih completion
  const handleCompleteDelivery = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmittingEdit(true);

    const activeDetails = editingTransaction.details.map(item => ({
      id: item.id,
      qtyKotor: parseInt(editKotorQuantities[item.id] !== undefined ? editKotorQuantities[item.id] : item.qty_kotor || 0),
      qtyBersih: parseInt(bersihQuantities[item.id] || 0),
      notes: editItemNotes[item.id] || ''
    }));

    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.put(`/api/ikm/transactions/${editingTransaction.transaction.id}`, {
        deliveryDate: deliveryDate.replace('T', ' ') + ':00',
        recorderName: editRecorderName,
        notes: editNotes,
        details: activeDetails
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data?.success) {
        setEditingTransaction(null);
        setErrorMsg('');
        fetchHistory();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Gagal menyelesaikan pengiriman.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Formatter helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('id-ID').format(num || 0);
  };

  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const filteredEmployees = employees.filter(emp =>
    (emp.employee_name || '').toLowerCase().includes(searchEmployeeQuery.toLowerCase())
  );

  const filteredEditEmployees = employees.filter(emp =>
    (emp.employee_name || '').toLowerCase().includes(editSearchEmployeeQuery.toLowerCase())
  );

  // Filtered linen lists for table search
  const filteredLinensList = linenSearch.trim() === ''
    ? linensList
    : linensList.filter(item =>
      getLinenDisplayName(item).toLowerCase().includes(linenSearch.toLowerCase())
    );

  const filteredEditDetails = editingTransaction
    ? (editLinenSearch.trim() === ''
      ? editingTransaction.details
      : editingTransaction.details.filter(item =>
        getLinenDisplayName(item).toLowerCase().includes(editLinenSearch.toLowerCase())
      ))
    : [];

  const isEditable = editingTransaction
    ? (editingTransaction.transaction.status === 'PROSES' || editingTransaction.transaction.is_editable)
    : false;

  const getLinenNameById = (hospitalLinenId) => {
    const detail = editingTransaction?.details?.find(d => d.hospital_linen_id === hospitalLinenId);
    return detail ? getLinenDisplayName(detail) : `Linen #${hospitalLinenId}`;
  };

  const formatAuditTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} WIB`;
  };

  const generateAuditLogDescriptions = (audit) => {
    const descriptions = [];
    if (!audit.old_values || !audit.new_values) {
      if (audit.action === 'CREATE') {
        descriptions.push("Membuat transaksi kotor");
      }
      return descriptions;
    }

    let oldSnap, newSnap;
    try {
      oldSnap = typeof audit.old_values === 'string' ? JSON.parse(audit.old_values) : audit.old_values;
      newSnap = typeof audit.new_values === 'string' ? JSON.parse(audit.new_values) : audit.new_values;
    } catch (e) {
      return ["Gagal memuat detail log"];
    }

    const oldTx = oldSnap.transaction || {};
    const newTx = newSnap.transaction || {};

    if (oldTx.notes !== newTx.notes) {
      descriptions.push(`Catatan umum: "${oldTx.notes || '—'}" menjadi "${newTx.notes || '—'}"`);
    }
    if (oldTx.recorder_name !== newTx.recorder_name) {
      descriptions.push(`Petugas: "${oldTx.recorder_name || '—'}" menjadi "${newTx.recorder_name || '—'}"`);
    }

    const oldDetails = oldSnap.details || [];
    const newDetails = newSnap.details || [];

    newDetails.forEach(newItem => {
      const oldItem = oldDetails.find(o => o.id === newItem.id);
      if (oldItem) {
        const name = getLinenNameById(newItem.hospital_linen_id);
        
        if (parseInt(oldItem.qty_kotor || 0) !== parseInt(newItem.qty_kotor || 0)) {
          descriptions.push(`Linen Kotor ${name} ${oldItem.qty_kotor || 0} menjadi ${newItem.qty_kotor || 0}`);
        }
        
        const oldBersih = oldItem.qty_bersih;
        const newBersih = newItem.qty_bersih;
        if (oldBersih !== newBersih) {
          descriptions.push(`Linen Bersih ${name} ${oldBersih === null ? '—' : oldBersih} menjadi ${newBersih === null ? '—' : newBersih}`);
        }

        if (oldItem.notes !== newItem.notes) {
          descriptions.push(`Catatan ${name}: "${oldItem.notes || '—'}" menjadi "${newItem.notes || '—'}"`);
        }
      }
    });

    return descriptions;
  };

  return (
    <div className="min-h-full py-6 bg-slate-50/50">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Header Banner Card */}
        <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#126776] bg-[#126776]/5 px-3 py-1 rounded-md border border-[#126776]/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1ea59e]" />
              Rumah Sakit Terpilih
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-2.5">
              {hospitalName || 'Rumah Sakit'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Portal pencatatan sirkulasi harian linen kotor & pengembalian bersih.
            </p>
          </div>

          {/* Tab Selector System */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl shrink-0 h-fit self-start md:self-center border border-slate-200">
            <button
              onClick={() => { setActiveTab('history'); setEditingTransaction(null); }}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'history' && !editingTransaction
                ? 'bg-gradient-to-r from-[#126776] to-[#1ea59e] text-white shadow-md shadow-[#126776]/10'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/55'
                }`}
            >
              <Clock className="h-4 w-4" />
              Riwayat Transaksi
            </button>
            <button
              onClick={() => { setActiveTab('form'); setEditingTransaction(null); }}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'form' && !editingTransaction
                ? 'bg-gradient-to-r from-[#126776] to-[#1ea59e] text-white shadow-md shadow-[#126776]/10'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/55'
                }`}
            >
              <PlusCircle className="h-4 w-4" />
              Form Serah Terima
            </button>
          </div>
        </div>

        {/* ══════════════════════ TAB 1: HISTORY ══════════════════════ */}
        {activeTab === 'history' && !editingTransaction && (
          <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">

            {/* Redesigned Filters Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">

                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nomor form, pengisi, atau catatan..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition-all"
                  />
                </div>

                {/* Filter Controls Row */}
                <div className="flex flex-wrap items-center gap-3">

                  {/* Unified Date Range Group */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="bg-transparent border-none text-slate-700 outline-none w-28 text-center cursor-pointer font-medium"
                    />
                    <span className="text-slate-400 font-semibold">s/d</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="bg-transparent border-none text-slate-700 outline-none w-28 text-center cursor-pointer font-medium"
                    />
                  </div>

                  {/* Custom Styled Select Dropdown */}
                  <div className="relative">
                    <select
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                      className="pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] cursor-pointer appearance-none min-w-[140px]"
                    >
                      <option value="all">Semua Status</option>
                      <option value="PROSES">PROSES (Kotor)</option>
                      <option value="SELESAI">SELESAI (Bersih)</option>
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setSearchQuery(''); setStartDate(''); setEndDate(''); setFilterStatus('all'); }}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition cursor-pointer active:scale-95 border border-slate-200"
                      title="Reset Filter"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>

                </div>
              </div>
            </div>

            {/* List View */}
            {loadingHistory ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white h-16 rounded-2xl border border-slate-150 animate-pulse" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="bg-white border border-slate-150 p-16 rounded-3xl text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100">
                  <FileText className="h-8 w-8 text-slate-300" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-700">Tidak ada riwayat transaksi</h4>
                  <p className="text-xs text-slate-400 mt-1">Silakan gunakan filter lain atau catat pengambilan kotor baru pada Tab Form.</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden divide-y divide-slate-100">
                {transactions.map((tx) => {
                  const kotor = parseInt(tx.total_qty_kotor || 0);
                  const bersih = parseInt(tx.total_qty_bersih || 0);
                  const kurang = tx.status === 'SELESAI' ? Math.max(0, kotor - bersih) : 0;
                  const isKurang = tx.status === 'SELESAI' && kurang > 0;

                  return (
                    <div
                      key={tx.id}
                      onClick={() => handleOpenEdit(tx)}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/70 cursor-pointer transition-all duration-150 group relative"
                    >
                      {/* Left accent bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r-full ${tx.status === 'PROSES' ? 'bg-[#126776]'
                        : isKurang ? 'bg-amber-400'
                          : 'bg-[#1ea59e]'
                        }`} />

                      {/* Status badge */}
                      <div className="shrink-0 pl-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${tx.status === 'PROSES'
                          ? 'bg-[#1ea59e]/10 text-[#126776] border-[#1ea59e]/30'
                          : isKurang
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-teal-50 text-teal-700 border-teal-200'
                          }`}>
                          {tx.status === 'PROSES' ? 'Dalam Proses' : isKurang ? 'Selesai – Kurang' : 'Selesai'}
                        </span>
                      </div>

                      {/* Form number + recorder */}
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase leading-none truncate">{tx.form_number}</p>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center gap-1 truncate">
                          <User className="h-3 w-3 text-slate-400 shrink-0" />
                          {toTitleCase(tx.recorder_name)}
                        </p>
                      </div>

                      {/* Stat chips */}
                      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                        <div className="flex flex-col items-center bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 min-w-[64px]">
                          <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Linen Kotor</span>
                          <span className="text-sm font-bold text-slate-700 leading-tight">{formatNumber(kotor)}</span>
                        </div>
                        <div className={`flex flex-col items-center border rounded-xl px-3 py-1.5 min-w-[64px] ${tx.status === 'SELESAI' ? 'bg-teal-50 border-teal-100' : 'bg-slate-50 border-slate-100'
                          }`}>
                          <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Linen Bersih</span>
                          <span className={`text-sm font-bold leading-tight ${tx.status === 'SELESAI' ? 'text-teal-700' : 'text-slate-300'
                            }`}>
                            {tx.status === 'SELESAI' ? formatNumber(bersih) : '—'}
                          </span>
                        </div>
                        {isKurang && (
                          <div className="flex flex-col items-center bg-red-50 border border-red-100 rounded-xl px-3 py-1.5 min-w-[64px]">
                            <span className="text-[9px] font-bold uppercase text-red-500 tracking-wider">Linen Kurang Kirim</span>
                            <span className="text-sm font-bold text-red-600 leading-tight">{formatNumber(kurang)}</span>
                          </div>
                        )}
                      </div>

                      {/* Dates + action */}
                      <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0 text-right">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span className="font-medium">{formatDate(tx.pickup_date)}</span>
                        </div>
                        {tx.delivery_date && (
                          <div className="flex items-center gap-1 text-[10px] text-[#1ea59e]">
                            <CheckCircle2 className="h-3 w-3" />
                            <span className="font-medium">{formatDate(tx.delivery_date)}</span>
                          </div>
                        )}
                      </div>

                      {/* Arrow / action */}
                      <div className="shrink-0">
                        {tx.status === 'PROSES' ? (
                          <div className="flex items-center gap-1 text-[#126776] text-[10px] font-bold group-hover:text-[#1ea59e] transition-colors">
                            <span className="hidden lg:inline">Update</span>
                            <ChevronRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ══════════════════════ TAB 2: CREATE NEW FORM (DAY 1 KOTOR) ══════════════════════ */}
        {activeTab === 'form' && !editingTransaction && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            {/* Header info */}
            <div className="p-6 bg-gradient-to-r from-[#126776] to-[#1ea59e] text-white">
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Form Pengisian Serah Terima Linen
              </h2>
              <p className="text-xs text-white/80 mt-1 font-medium">
                Lakukan pendataan jumlah linen kotor yang diambil untuk dicuci dari {hospitalName || 'Rumah Sakit'}.
              </p>
            </div>

            <form onSubmit={handleCreatePickup} className="p-6 space-y-6">

              {/* Form Config Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-50/50 p-5 rounded-2xl border border-slate-150">

                {/* Form Number */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Nomor Formulir
                  </label>
                  <input
                    type="text"
                    disabled
                    value="(Otomatis saat disimpan)"
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl text-xs font-semibold cursor-not-allowed"
                  />
                </div>

                {/* Recorder (Searchable Dropdown Select) */}
                <div className="space-y-1.5" ref={employeeSelectRef}>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Pengisi (Petugas IKM)
                  </label>
                  <div className="relative">
                    <div
                      onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                      className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] select-none min-h-[38px] border-slate-200 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <User className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                        <span>{toTitleCase(recorderName) || 'Pilih Pengisi Petugas IKM...'}</span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </div>

                    {isEmployeeDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 shadow-xl rounded-2xl p-2.5 z-50 max-h-60 flex flex-col">
                        {/* Search Input inside dropdown */}
                        <div className="relative mb-2 shrink-0">
                          <Search className="absolute inset-y-0 left-2.5 my-auto h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Cari petugas..."
                            value={searchEmployeeQuery}
                            onChange={e => setSearchEmployeeQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-150 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#1ea59e]/20 focus:border-[#1ea59e] font-semibold text-slate-700"
                            onClick={e => e.stopPropagation()} // Prevent closing dropdown on click
                          />
                        </div>

                        {/* Employees Scrollable List */}
                        <div className="overflow-y-auto flex-1 divide-y divide-slate-50 max-h-40">
                          {loadingEmployees ? (
                            <div className="p-3 text-center text-slate-400 text-xs font-medium">
                              Memuat petugas...
                            </div>
                          ) : filteredEmployees.length === 0 ? (
                            <div className="p-3 text-center text-slate-400 text-xs font-medium">
                              Tidak ada petugas ditemukan
                            </div>
                          ) : (
                            filteredEmployees.map(emp => (
                              <button
                                key={emp.employee_id}
                                type="button"
                                onClick={() => {
                                  setRecorderName(emp.employee_name);
                                  setIsEmployeeDropdownOpen(false);
                                  setSearchEmployeeQuery('');
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#1ea59e]/5 hover:text-[#126776] rounded-lg transition cursor-pointer"
                              >
                                {toTitleCase(emp.employee_name)}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Date pickup */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Tanggal Pengambilan Kotor
                  </label>
                  <div className="relative">
                    <Calendar className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                    <input
                      type="datetime-local"
                      required
                      value={pickupDate}
                      onChange={e => setPickupDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition"
                    />
                  </div>
                </div>

              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-start gap-2.5 animate-shake">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Table of items */}
              <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">

                {/* Search bar above linen table */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/70">
                  <div className="relative">
                    <Search className="absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari nama linen..."
                      value={linenSearch}
                      onChange={e => setLinenSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition"
                    />
                    {linenSearch && (
                      <button
                        type="button"
                        onClick={() => setLinenSearch('')}
                        className="absolute inset-y-0 right-3 my-auto text-slate-400 hover:text-slate-600 text-base leading-none cursor-pointer"
                      >✕</button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider text-xs border-b border-slate-150">
                        <th className="py-3.5 px-4 w-12 text-center">No</th>
                        <th className="py-3.5 px-4 text-center">Nama Linen</th>
                        <th className="py-3.5 px-4 w-28 text-center">Kotor</th>
                        <th className="py-3.5 px-4 text-center">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {loadingLinens ? (
                        <tr>
                          <td colSpan="4" className="py-16 text-center text-slate-400 font-bold">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto text-[#126776] mb-2" />
                            Memuat data linen...
                          </td>
                        </tr>
                      ) : filteredLinensList.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-16 text-center text-slate-400 font-semibold">
                            {linenSearch ? `Tidak ada linen yang cocok dengan "${linenSearch}"` : 'Belum ada master linen terdaftar untuk rumah sakit ini.'}
                          </td>
                        </tr>
                      ) : (
                        filteredLinensList.map((item, index) => {
                          const isFilled = (kotorQuantities[item.id] || 0) > 0;
                          return (
                            <tr
                              key={item.id}
                              className={`transition-all duration-150 ${isFilled
                                ? 'bg-[#1ea59e]/5 border-l-4 border-l-[#1ea59e]'
                                : 'hover:bg-slate-50/40'
                                }`}
                            >
                              <td className="py-3 px-4 text-center font-medium text-slate-400 text-xs">{index + 1}</td>
                              <td className="py-3 px-4">
                                <p className="font-semibold text-slate-800 text-sm">{getLinenDisplayName(item)}</p>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={kotorQuantities[item.id] || ''}
                                    onChange={e => {
                                      const val = parseInt(e.target.value) || 0;
                                      setKotorQuantities(prev => ({ ...prev, [item.id]: val >= 0 ? val : 0 }));
                                    }}
                                    className="w-16 text-center py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white transition"
                                  />
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  placeholder="Catatan item..."
                                  value={itemNotes[item.id] || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setItemNotes(prev => ({ ...prev, [item.id]: val }));
                                  }}
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white transition"
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* General Note */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-[#126776]/5 text-[#126776] rounded-md">
                    <FileText className="h-4 w-4" />
                  </div>
                  <label className="block text-xs font-semibold text-[#126776] uppercase tracking-widest">
                    Catatan Umum Formulir
                  </label>
                </div>
                <textarea
                  rows="2.5"
                  placeholder="Tambahkan penjelasan tambahan mengenai serah terima pengambilan kotor ini..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition-all resize-none placeholder-slate-400"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setActiveTab('history'); setErrorMsg(''); }}
                  className="px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingNew}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#126776] to-[#1ea59e] hover:from-[#0e5562] hover:to-[#188b85] text-white rounded-xl text-xs font-semibold shadow-md shadow-[#126776]/10 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                >
                  {submittingNew ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Menyimpan...</>
                  ) : (
                    <><Save className="h-4 w-4" /> Simpan Pengambilan</>
                  )}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* ══════════════════════ EDIT VIEW (DAY 2 COMPLETE DELIVERY / BERSIH) ══════════════════════ */}
        {editingTransaction && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            {/* Header info */}
            <div className="p-6 bg-gradient-to-r from-[#126776] to-[#1ea59e] text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold tracking-widest uppercase bg-white/20 px-2.5 py-0.5 rounded-full border border-white/10">
                    Update Pengiriman Bersih
                  </span>
                  <span className="text-xs text-white/60 font-medium">Form Transaksi #{editingTransaction.transaction.id}</span>
                </div>
                <h2 className="text-lg font-bold tracking-tight mt-2.5">
                  No. Formulir: {editingTransaction.transaction.form_number}
                </h2>
                <p className="text-xs text-white/80 mt-1 font-medium">
                  Catat pengembalian laundry bersih untuk {hospitalName || 'Rumah Sakit'}.
                </p>
              </div>

              <button
                onClick={() => setEditingTransaction(null)}
                className="flex items-center gap-1.5 text-xs font-semibold text-white/95 hover:text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl border border-white/10 transition cursor-pointer shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Riwayat
              </button>
            </div>

            <form onSubmit={handleCompleteDelivery} className="p-6 space-y-6">

              {/* Summary Details Info card grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider block">Status Transaksi</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase border ${editingTransaction.transaction.status === 'SELESAI'
                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                    : 'bg-[#1ea59e]/10 text-[#126776] border border-[#1ea59e]/30'
                    }`}>
                    {editingTransaction.transaction.status === 'SELESAI' ? 'Selesai' : 'Pengambilan Kotor'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider block">Petugas Pengambil</span>
                  <span className="font-semibold text-slate-700 block text-sm">{toTitleCase(editingTransaction.transaction.recorder_name)}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider block">Tanggal Pengambilan</span>
                  <span className="font-semibold text-slate-700 block text-xs">{formatDate(editingTransaction.transaction.pickup_date)}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider block">Catatan Pengambilan</span>
                  <span className="font-medium text-slate-500 block italic text-xs truncate" title={editingTransaction.transaction.notes || ''}>
                    {editingTransaction.transaction.notes || '—'}
                  </span>
                </div>
              </div>

              {/* Delivery Input Config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50/50 p-5 rounded-2xl border border-slate-150">

                {/* Delivery Complete Recorder */}
                <div className="space-y-1.5" ref={editEmployeeSelectRef}>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Petugas Pengirim
                  </label>
                  <div className="relative">
                    {!isEditable ? (
                      <div className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-not-allowed">
                        <User className="h-4 w-4 text-slate-400" />
                        <span>{toTitleCase(editRecorderName)}</span>
                      </div>
                    ) : (
                      <>
                        <div
                          onClick={() => setIsEditEmployeeDropdownOpen(!isEditEmployeeDropdownOpen)}
                          className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] select-none min-h-[38px] border-slate-200 transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <User className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                            <span>{toTitleCase(editRecorderName) || 'Pilih Pengirim Petugas IKM...'}</span>
                          </div>
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </div>

                        {isEditEmployeeDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 shadow-xl rounded-2xl p-2.5 z-50 max-h-60 flex flex-col">
                            {/* Search Input inside dropdown */}
                            <div className="relative mb-2 shrink-0">
                              <Search className="absolute inset-y-0 left-2.5 my-auto h-3.5 w-3.5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Cari petugas..."
                                value={editSearchEmployeeQuery}
                                onChange={e => setEditSearchEmployeeQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-150 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#1ea59e]/20 focus:border-[#1ea59e] font-semibold text-slate-700"
                                onClick={e => e.stopPropagation()} // Prevent closing dropdown on click
                              />
                            </div>

                            {/* Employees Scrollable List */}
                            <div className="overflow-y-auto flex-1 divide-y divide-slate-50 max-h-40">
                              {loadingEmployees ? (
                                <div className="p-3 text-center text-slate-400 text-xs font-medium">
                                  Memuat petugas...
                                </div>
                              ) : filteredEditEmployees.length === 0 ? (
                                <div className="p-3 text-center text-slate-400 text-xs font-medium">
                                  Tidak ada petugas ditemukan
                                </div>
                              ) : (
                                filteredEditEmployees.map(emp => (
                                  <button
                                    key={emp.employee_id}
                                    type="button"
                                    onClick={() => {
                                      setEditRecorderName(emp.employee_name);
                                      setIsEditEmployeeDropdownOpen(false);
                                      setEditSearchEmployeeQuery('');
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#1ea59e]/5 hover:text-[#126776] rounded-lg transition cursor-pointer"
                                  >
                                    {toTitleCase(emp.employee_name)}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Delivery Date */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Tanggal Pengembalian Bersih
                  </label>
                  <div className="relative">
                    <Calendar className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                    <input
                      type="datetime-local"
                      required
                      value={deliveryDate}
                      onChange={e => setDeliveryDate(e.target.value)}
                      disabled={!isEditable}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                </div>

              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-medium rounded-xl flex items-start gap-2.5 animate-shake">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 24-Hour Expiration Alert */}
              {editingTransaction.transaction.status === 'SELESAI' && !isEditable && (
                <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 text-xs font-semibold rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>Data Sudah Lebih Dari 24 Jam, Mohon Hubungi Admin Jika Ada Perubahan</span>
                </div>
              )}

              {/* Table of detail quantities */}
              <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">

                {/* Search bar above bersih linen table */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/70">
                  <div className="relative">
                    <Search className="absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari nama linen..."
                      value={editLinenSearch}
                      onChange={e => setEditLinenSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition"
                    />
                    {editLinenSearch && (
                      <button
                        type="button"
                        onClick={() => setEditLinenSearch('')}
                        className="absolute inset-y-0 right-3 my-auto text-slate-400 hover:text-slate-600 text-base leading-none cursor-pointer"
                      >✕</button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse min-w-[650px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider text-xs border-b border-slate-150">
                        <th className="py-3 px-4 w-12 text-center">No</th>
                        <th className="py-3 px-4 text-center">Nama Linen</th>
                        <th className="py-3 px-4 text-center w-24">Kotor</th>
                        <th className="py-3 px-4 text-center w-24">Bersih</th>
                        <th className="py-3 px-4 text-center">Catatan Selisih & Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredEditDetails.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-slate-400 font-semibold text-xs">
                            {editLinenSearch ? `Tidak ada linen yang cocok dengan "${editLinenSearch}"` : 'Tidak ada data linen.'}
                          </td>
                        </tr>
                      ) : filteredEditDetails.map((item, index) => {
                        const kotor = editKotorQuantities[item.id] !== undefined ? editKotorQuantities[item.id] : item.qty_kotor;
                        const bersih = bersihQuantities[item.id] !== undefined ? bersihQuantities[item.id] : (item.qty_bersih !== null ? item.qty_bersih : '');
                        const isDiff = parseInt(kotor || 0) !== parseInt(bersih || 0);

                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors duration-150 ${isDiff && isEditable
                              ? 'bg-amber-500/[0.03] border-l-4 border-l-amber-400'
                              : 'hover:bg-slate-50/40'
                              }`}
                          >
                            <td className="py-3 px-4 text-center font-medium text-slate-400 text-xs">{index + 1}</td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-800 text-sm">{getLinenDisplayName(item)}</p>
                            </td>
                            <td className="py-3 px-4">
                              {isEditable ? (
                                <div className="flex items-center justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={editKotorQuantities[item.id] !== undefined ? editKotorQuantities[item.id] : ''}
                                    onChange={e => {
                                      const valStr = e.target.value;
                                      if (valStr === '') {
                                        setEditKotorQuantities(prev => ({ ...prev, [item.id]: '' }));
                                      } else {
                                        const val = parseInt(valStr);
                                        setEditKotorQuantities(prev => ({ ...prev, [item.id]: isNaN(val) ? 0 : (val >= 0 ? val : 0) }));
                                      }
                                    }}
                                    className="w-16 text-center py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white transition"
                                  />
                                </div>
                              ) : (
                                <div className="text-center font-semibold text-slate-700 text-sm">
                                  {formatNumber(kotor)}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isEditable ? (
                                <div className="flex items-center justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={bersihQuantities[item.id] !== undefined ? bersihQuantities[item.id] : ''}
                                    onChange={e => {
                                      const valStr = e.target.value;
                                      if (valStr === '') {
                                        setBersihQuantities(prev => ({ ...prev, [item.id]: '' }));
                                      } else {
                                        const val = parseInt(valStr);
                                        setBersihQuantities(prev => ({ ...prev, [item.id]: isNaN(val) ? 0 : (val >= 0 ? val : 0) }));
                                      }
                                    }}
                                    className="w-16 text-center py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white transition"
                                  />
                                </div>
                              ) : (
                                <div className="text-center font-semibold text-teal-700 text-sm">
                                  {formatNumber(bersih)}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isEditable ? (
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    placeholder="Tambahkan alasan/catatan selisih..."
                                    value={editItemNotes[item.id] || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setEditItemNotes(prev => ({ ...prev, [item.id]: val }));
                                    }}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white transition"
                                  />
                                  {isDiff && (
                                    <p className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      Selisih kuantitas kotor-bersih: {Math.abs(parseInt(kotor || 0) - parseInt(bersih || 0))} Pcs.
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {isDiff && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                                  <span className="font-medium text-slate-650 text-xs">
                                    {item.notes || '—'}
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Log Aktivitas Transaksi Collapsible Panel */}
              {editingTransaction.audits && editingTransaction.audits.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-150 overflow-hidden shadow-sm transition-all duration-200">
                  {/* Header / Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowAuditLogs(!showAuditLogs)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-100/60 transition-colors cursor-pointer select-none text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-[#126776]/5 text-[#126776] rounded-lg">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#126776] uppercase tracking-widest">
                          Log Aktivitas Transaksi
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                          Klik untuk melihat riwayat perubahan data kotor & bersih.
                        </p>
                      </div>
                    </div>
                    <div className="text-slate-400">
                      {showAuditLogs ? (
                        <ChevronDown className="w-5 h-5 transform rotate-180 transition-transform duration-200" />
                      ) : (
                        <ChevronDown className="w-5 h-5 transition-transform duration-200" />
                      )}
                    </div>
                  </button>

                  {/* Collapsible Content */}
                  {showAuditLogs && (
                    <div className="px-5 pb-5 border-t border-slate-150/70 pt-4 bg-white animate-[fadeIn_0.2s_ease-out]">
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-2 divide-y divide-slate-100">
                        {editingTransaction.audits.map((audit) => {
                          const descriptions = generateAuditLogDescriptions(audit);
                          return descriptions.map((desc, idx) => (
                            <div key={`${audit.id}-${idx}`} className="py-2.5 text-xs font-semibold text-slate-650 flex items-start gap-1.5 first:pt-0">
                              <span className="text-slate-400 font-bold shrink-0">{formatAuditTime(audit.created_at)}</span>
                              <span className="text-slate-400 font-bold shrink-0">•</span>
                              <span className="text-[#126776] font-bold shrink-0">{audit.full_name || audit.username}</span>
                              <span className="text-slate-400 font-bold shrink-0">•</span>
                              <span className="text-slate-700 font-medium">{desc}</span>
                            </div>
                          ));
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* General Note */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-[#126776]/5 text-[#126776] rounded-md">
                    <FileText className="h-4 w-4" />
                  </div>
                  <label className="block text-xs font-semibold text-[#126776] uppercase tracking-widest">
                    Catatan Umum Pengiriman
                  </label>
                </div>
                <textarea
                  rows="2.5"
                  placeholder="Keterangan umum serah terima barang bersih..."
                  value={editNotes}
                  disabled={!isEditable}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition resize-none disabled:cursor-not-allowed disabled:bg-slate-100 placeholder-slate-400"
                />
              </div>

              {/* Actions Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setEditingTransaction(null); setErrorMsg(''); }}
                  className="px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer"
                >
                  {editingTransaction.transaction.status === 'SELESAI' && !isEditable ? 'Tutup' : 'Batal'}
                </button>

                {isEditable && (
                  <button
                    type="submit"
                    disabled={submittingEdit}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#126776] to-[#1ea59e] hover:from-[#0e5562] hover:to-[#188b85] text-white rounded-xl text-xs font-semibold shadow-md shadow-[#126776]/10 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                  >
                    {submittingEdit ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Menyimpan...</>
                    ) : (
                      <><Save className="h-4 w-4" /> {editingTransaction.transaction.status === 'SELESAI' ? 'Simpan Perubahan' : 'Simpan & Selesaikan Transaksi'}</>
                    )}
                  </button>
                )}
              </div>

            </form>
          </div>
        )}

      </div>
    </div>
  );
}
