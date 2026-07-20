import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import {
  FileText, Search, Calendar, CheckCircle2,
  AlertTriangle, ArrowLeft, RefreshCw, PlusCircle,
  ChevronRight, ChevronDown, Save, User, Clock, AlertCircle,
  Warehouse, Building, Shirt, HelpCircle
} from 'lucide-react';

// Utility to convert string to Title Case
const toTitleCase = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Signature Input sub-component supporting Canvas pen drawing and photo upload
const SignatureInput = ({ title, value, onChange, isEditable, name }) => {
  const [mode, setMode] = useState('draw'); // 'draw' | 'upload'
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => {
    if (mode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#0f172a'; // slate-900
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Clear canvas if value is empty
      if (!value) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSigned(false);
      }
    }
  }, [mode, value]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
    
    // Map CSS coordinate space to canvas internal coordinate space
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    
    return { x, y };
  };

  const startDrawing = (e) => {
    if (!isEditable) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !isEditable) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (canvas && hasSigned) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSigned(false);
      onChange('');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onChange(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2">
        <span className="text-xs font-bold text-slate-700 tracking-wide max-w-full">{title}</span>
        {isEditable && (
          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => { setMode('draw'); onChange(''); }}
              className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer whitespace-nowrap ${mode === 'draw' ? 'bg-[#126776] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Coret Pen
            </button>
            <button
              type="button"
              onClick={() => { setMode('upload'); onChange(''); }}
              className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer whitespace-nowrap ${mode === 'upload' ? 'bg-[#126776] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Upload Foto
            </button>
          </div>
        )}
      </div>

      {mode === 'draw' ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={300}
            height={150}
            className={`w-full h-[150px] border-2 border-dashed border-slate-200 bg-slate-50 rounded-lg cursor-crosshair touch-none ${!isEditable ? 'pointer-events-none' : ''}`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {isEditable && (
            <button
              type="button"
              onClick={clearCanvas}
              className="absolute bottom-2 right-2 px-2 py-1 bg-slate-200/80 hover:bg-slate-300 text-slate-700 rounded-md text-[10px] font-bold transition-all cursor-pointer"
            >
              Hapus
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {isEditable ? (
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-[150px] border-2 border-dashed border-slate-200 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100/50 transition">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-8 h-8 mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <p className="mb-1 text-xs text-slate-500 font-semibold">Klik untuk unggah foto</p>
                  <p className="text-[10px] text-slate-400">PNG, JPG up to 5MB</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          ) : null}
        </div>
      )}

      {/* Name display under signature */}
      {name && (
        <div className="pt-1.5 border-t border-slate-100 text-center">
          <span className="text-[11px] font-bold text-[#126776] block truncate" title={name}>
            ({toTitleCase(name)})
          </span>
        </div>
      )}

      {value && (
        <div className="mt-2 flex flex-col items-center p-2 bg-slate-50 border border-slate-150 rounded-lg">
          <span className="text-[9px] font-bold text-slate-700 uppercase mb-1">Pratinjau Tanda Tangan</span>
          <img src={value} alt="Preview Signature" className="max-h-[80px] object-contain border border-slate-200 rounded bg-white p-1" />
        </div>
      )}
    </div>
  );
};

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
  const [userPickup, setUserPickup] = useState(localStorage.getItem('employeeId') || '');
  const [userPickupName, setUserPickupName] = useState(
    localStorage.getItem('fullName') || localStorage.getItem('username') || ''
  );
  const [pickupDate, setPickupDate] = useState(
    new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  );
  const [notes, setNotes] = useState('');
  const [hospitalStaffPickup, setHospitalStaffPickup] = useState('');
  const [hospitalAssistantPickup, setHospitalAssistantPickup] = useState('');
  const [signatureValetPickup, setSignatureValetPickup] = useState('');
  const [signatureHospitalPickup, setSignatureHospitalPickup] = useState('');
  const [signatureAssistantPickup, setSignatureAssistantPickup] = useState('');
  const [kotorQuantities, setKotorQuantities] = useState({}); // { hospitalLinenId: qty }
  const [itemNotes, setItemNotes] = useState({}); // { hospitalLinenId: noteText }
  const [submittingNew, setSubmittingNew] = useState(false);

  // Edit/Completion view state (Day 2 Bersih)
  const [editingTransaction, setEditingTransaction] = useState(null); // transaction detail object
  const [userDelivery, setUserDelivery] = useState('');
  const [userDeliveryName, setUserDeliveryName] = useState('');
  const [hospitalStaffDelivery, setHospitalStaffDelivery] = useState('');
  const [hospitalAssistantDelivery, setHospitalAssistantDelivery] = useState('');
  const [signatureValetDelivery, setSignatureValetDelivery] = useState('');
  const [signatureHospitalDelivery, setSignatureHospitalDelivery] = useState('');
  const [signatureAssistantDelivery, setSignatureAssistantDelivery] = useState('');
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

    if (!hospitalStaffPickup.trim()) {
      setErrorMsg('Nama petugas RS pemeriksa (Pickup) wajib diisi.');
      return;
    }

    if (!signatureValetPickup) {
      setErrorMsg('Tanda tangan Petugas IKM wajib diisi/digambar.');
      return;
    }
    if (!signatureHospitalPickup) {
      setErrorMsg('Tanda tangan Petugas RS wajib diisi/digambar.');
      return;
    }

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
        userPickup: parseInt(userPickup),
        hospitalStaffPickup,
        hospitalAssistantPickup,
        pickupDate: pickupDate.replace('T', ' ') + ':00',
        notes,
        details: activeDetails,
        signatureValetPickup,
        signatureHospitalPickup,
        signatureAssistantPickup
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data?.success) {
        setUserPickup(localStorage.getItem('employeeId') || '');
        setUserPickupName(localStorage.getItem('fullName') || localStorage.getItem('username') || '');
        setNotes('');
        setHospitalStaffPickup('');
        setHospitalAssistantPickup('');
        setSignatureValetPickup('');
        setSignatureHospitalPickup('');
        setSignatureAssistantPickup('');
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
        setUserDelivery(fullTx.transaction.user_delivery || '');
        setUserDeliveryName(fullTx.transaction.user_delivery_name || '');
        setEditNotes(fullTx.transaction.notes || '');
        setHospitalStaffPickup(fullTx.transaction.hospital_staff_pickup || '');
        setHospitalStaffDelivery(fullTx.transaction.hospital_staff_delivery || '');
        setHospitalAssistantPickup(fullTx.transaction.hospital_assistant_pickup || '');
        setHospitalAssistantDelivery(fullTx.transaction.hospital_assistant_delivery || '');
        setSignatureValetPickup(fullTx.transaction.signature_valet_pickup || '');
        setSignatureHospitalPickup(fullTx.transaction.signature_hospital_pickup || '');
        setSignatureAssistantPickup(fullTx.transaction.signature_assistant_pickup || '');
        setSignatureValetDelivery(fullTx.transaction.signature_valet_delivery || '');
        setSignatureHospitalDelivery(fullTx.transaction.signature_hospital_delivery || '');
        setSignatureAssistantDelivery(fullTx.transaction.signature_assistant_delivery || '');

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

    if (!hospitalStaffDelivery.trim()) {
      setErrorMsg('Nama petugas RS pemeriksa (Delivery) wajib diisi.');
      return;
    }

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
        userDelivery: parseInt(userDelivery),
        hospitalStaffPickup,
        hospitalStaffDelivery,
        hospitalAssistantPickup,
        hospitalAssistantDelivery,
        notes: editNotes,
        details: activeDetails,
        signatureValetPickup,
        signatureHospitalPickup,
        signatureAssistantPickup,
        signatureValetDelivery,
        signatureHospitalDelivery,
        signatureAssistantDelivery
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
    const getEmployeeName = (id) => {
      const emp = employees.find(e => e.employee_id === id);
      return emp ? emp.employee_name : `Karyawan #${id}`;
    };

    if (oldTx.user_pickup !== newTx.user_pickup) {
      const oldVal = oldTx.user_pickup ? toTitleCase(getEmployeeName(oldTx.user_pickup)) : '—';
      const newVal = newTx.user_pickup ? toTitleCase(getEmployeeName(newTx.user_pickup)) : '—';
      descriptions.push(`Petugas Pickup: "${oldVal}" menjadi "${newVal}"`);
    }

    if (oldTx.user_delivery !== newTx.user_delivery) {
      const oldVal = oldTx.user_delivery ? toTitleCase(getEmployeeName(oldTx.user_delivery)) : '—';
      const newVal = newTx.user_delivery ? toTitleCase(getEmployeeName(newTx.user_delivery)) : '—';
      descriptions.push(`Petugas Delivery: "${oldVal}" menjadi "${newVal}"`);
    }

    if (oldTx.hospital_staff_pickup !== newTx.hospital_staff_pickup) {
      descriptions.push(`Petugas RS Pickup: "${oldTx.hospital_staff_pickup || '—'}" menjadi "${newTx.hospital_staff_pickup || '—'}"`);
    }
    if (oldTx.hospital_assistant_pickup !== newTx.hospital_assistant_pickup) {
      descriptions.push(`Perawat RS Pickup: "${oldTx.hospital_assistant_pickup || '—'}" menjadi "${newTx.hospital_assistant_pickup || '—'}"`);
    }

    if (oldTx.hospital_staff_delivery !== newTx.hospital_staff_delivery) {
      descriptions.push(`Petugas RS Delivery: "${oldTx.hospital_staff_delivery || '—'}" menjadi "${newTx.hospital_staff_delivery || '—'}"`);
    }
    if (oldTx.hospital_assistant_delivery !== newTx.hospital_assistant_delivery) {
      descriptions.push(`Perawat RS Delivery: "${oldTx.hospital_assistant_delivery || '—'}" menjadi "${newTx.hospital_assistant_delivery || '—'}"`);
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
                        <p className="text-sm font-semibold text-slate-800 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 truncate">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="text-[11px] text-slate-400 font-medium">Pickup:</span>
                            {tx.user_pickup_name} {tx.hospital_staff_pickup && <span className="text-slate-400 font-normal">({tx.hospital_staff_pickup}{tx.hospital_assistant_pickup ? `, ${tx.hospital_assistant_pickup}` : ''})</span>}
                          </span>
                          {tx.user_delivery && (
                            <span className="flex items-center gap-1 border-l border-slate-200 pl-2">
                              <span className="text-[11px] text-[#1ea59e] font-medium">Delivery:</span>
                              {tx.user_delivery_name} {tx.hospital_staff_delivery && <span className="text-slate-400 font-normal">({tx.hospital_staff_delivery}{tx.hospital_assistant_delivery ? `, ${tx.hospital_assistant_delivery}` : ''})</span>}
                            </span>
                          )}
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
              <div className="space-y-4">
                {/* Card 1: Data Transaksi IKM */}
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
                          <span>
                            {toTitleCase(userPickupName) || 'Pilih Pengisi Petugas IKM...'}
                          </span>
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
                                    setUserPickup(emp.employee_id);
                                    setUserPickupName(emp.employee_name);
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

                {/* Card 2: Data Petugas Pemeriksa Rumah Sakit */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50/50 p-5 rounded-2xl border border-slate-150">
                  {/* Petugas RS Pemeriksa (Pickup) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                      Petugas RS Pemeriksa (Pickup) <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="Nama petugas Rumah Sakit..."
                        value={hospitalStaffPickup}
                        onChange={e => setHospitalStaffPickup(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition"
                      />
                    </div>
                  </div>

                  {/* Perawat RS (Pickup) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                      Perawat RS (Pickup) <span className="text-slate-400 font-normal">(Opsional)</span>
                    </label>
                    <div className="relative">
                      <User className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Nama perawat Rumah Sakit (Opsional)..."
                        value={hospitalAssistantPickup}
                        onChange={e => setHospitalAssistantPickup(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition"
                      />
                    </div>
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

              {/* Tanda Tangan Section */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-[#126776]/5 text-[#126776] rounded-md">
                    <FileText className="h-4 w-4" />
                  </div>
                  <label className="block text-xs font-semibold text-[#126776] uppercase tracking-widest">
                    Dokumentasi Tanda Tangan Serah Terima (Pickup)
                  </label>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <SignatureInput
                    title="Tanda Tangan Petugas IKM (Valet)"
                    value={signatureValetPickup}
                    onChange={setSignatureValetPickup}
                    isEditable={true}
                    name={userPickupName}
                  />
                  <SignatureInput
                    title="Tanda Tangan Petugas RS Pemeriksa"
                    value={signatureHospitalPickup}
                    onChange={setSignatureHospitalPickup}
                    isEditable={true}
                    name={hospitalStaffPickup}
                  />
                  <SignatureInput
                    title="Tanda Tangan Perawat RS (Opsional)"
                    value={signatureAssistantPickup}
                    onChange={setSignatureAssistantPickup}
                    isEditable={true}
                    name={hospitalAssistantPickup}
                  />
                </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150 text-xs">
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
                  <span className="font-semibold text-slate-700 block text-sm">
                    {toTitleCase(editingTransaction.transaction.user_pickup_name)}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider block">Petugas RS (Pickup)</span>
                  <span className="font-semibold text-slate-700 block text-sm">
                    {editingTransaction.transaction.hospital_staff_pickup || '—'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider block">Perawat RS (Pickup)</span>
                  <span className="font-semibold text-slate-700 block text-sm">
                    {editingTransaction.transaction.hospital_assistant_pickup || '—'}
                  </span>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-50/50 p-5 rounded-2xl border border-slate-150">

                {/* Delivery Complete Recorder */}
                <div className="space-y-1.5" ref={editEmployeeSelectRef}>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Petugas Pengirim
                  </label>
                  <div className="relative">
                    {!isEditable ? (
                      <div className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-not-allowed">
                        <User className="h-4 w-4 text-slate-400" />
                        <span>
                          {toTitleCase(userDeliveryName)}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div
                          onClick={() => setIsEditEmployeeDropdownOpen(!isEditEmployeeDropdownOpen)}
                          className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] select-none min-h-[38px] border-slate-200 transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <User className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                            <span>
                              {toTitleCase(userDeliveryName) || 'Pilih Pengirim Petugas IKM...'}
                            </span>
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
                                      setUserDelivery(emp.employee_id);
                                      setUserDeliveryName(emp.employee_name);
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

                {/* Petugas RS Pemeriksa (Delivery) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center h-4">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                      Petugas RS (Delivery)
                    </label>
                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => setHospitalStaffDelivery(hospitalStaffPickup)}
                        className="text-[10px] text-[#1ea59e] hover:text-[#126776] font-bold transition flex items-center gap-1 cursor-pointer select-none"
                      >
                        Sama Dengan Pickup
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <User className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      disabled={!isEditable}
                      placeholder="Nama petugas Rumah Sakit..."
                      value={hospitalStaffDelivery}
                      onChange={e => setHospitalStaffDelivery(e.target.value)}
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

              {/* Tanda Tangan Section */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-[#126776]/5 text-[#126776] rounded-md">
                    <FileText className="h-4 w-4" />
                  </div>
                  <label className="block text-xs font-semibold text-[#126776] uppercase tracking-widest">
                    Dokumentasi Tanda Tangan Serah Terima
                  </label>
                </div>
                
                <div className="space-y-6">
                  {/* Pickup Signatures Card */}
                  <div className="border border-slate-150 rounded-2xl p-5 bg-slate-50/50 space-y-4">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-widest block">Tanda Tangan Saat Pickup (Kotor)</span>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl min-h-[140px] shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">Petugas IKM (Valet)</span>
                        <div className="flex-1 flex items-center justify-center mb-2">
                          {signatureValetPickup ? (
                            <img src={signatureValetPickup} alt="Valet Pickup" className="max-h-[80px] object-contain" />
                          ) : (
                            <span className="text-xs text-slate-450 font-bold">—</span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-[#126776] text-center border-t border-slate-100 pt-1.5 w-full">
                          ({toTitleCase(editingTransaction.transaction.user_pickup_name || '')})
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl min-h-[140px] shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">Petugas RS</span>
                        <div className="flex-1 flex items-center justify-center mb-2">
                          {signatureHospitalPickup ? (
                            <img src={signatureHospitalPickup} alt="RS Pickup" className="max-h-[80px] object-contain" />
                          ) : (
                            <span className="text-xs text-slate-450 font-bold">—</span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-[#126776] text-center border-t border-slate-100 pt-1.5 w-full">
                          {editingTransaction.transaction.hospital_staff_pickup ? `(${toTitleCase(editingTransaction.transaction.hospital_staff_pickup)})` : '—'}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl min-h-[140px] shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">Perawat RS</span>
                        <div className="flex-1 flex items-center justify-center mb-2">
                          {signatureAssistantPickup ? (
                            <img src={signatureAssistantPickup} alt="Perawat Pickup" className="max-h-[80px] object-contain" />
                          ) : (
                            <span className="text-xs text-slate-450 font-bold">—</span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-[#126776] text-center border-t border-slate-100 pt-1.5 w-full">
                          {editingTransaction.transaction.hospital_assistant_pickup ? `(${toTitleCase(editingTransaction.transaction.hospital_assistant_pickup)})` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Signatures Card */}
                  <div className="border border-slate-150 rounded-2xl p-5 bg-slate-50/50 space-y-4">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-widest block">Tanda Tangan Saat Delivery (Bersih)</span>
                    {editingTransaction.transaction.status === 'PROSES' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <SignatureInput
                          title="Petugas IKM (Valet)"
                          value={signatureValetDelivery}
                          onChange={setSignatureValetDelivery}
                          isEditable={true}
                          name={userDeliveryName}
                        />
                        <SignatureInput
                          title="Petugas RS"
                          value={signatureHospitalDelivery}
                          onChange={setSignatureHospitalDelivery}
                          isEditable={true}
                          name={hospitalStaffDelivery}
                        />
                        <SignatureInput
                          title="Perawat RS (Opsional)"
                          value={signatureAssistantDelivery}
                          onChange={setSignatureAssistantDelivery}
                          isEditable={true}
                          name={hospitalAssistantDelivery}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl min-h-[140px] shadow-sm">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">Petugas IKM (Valet)</span>
                          <div className="flex-1 flex items-center justify-center mb-2">
                            {signatureValetDelivery ? (
                              <img src={signatureValetDelivery} alt="Valet Delivery" className="max-h-[80px] object-contain" />
                            ) : (
                              <span className="text-xs text-slate-450 font-bold">—</span>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-[#126776] text-center border-t border-slate-100 pt-1.5 w-full">
                            {editingTransaction.transaction.user_delivery_name ? `(${toTitleCase(editingTransaction.transaction.user_delivery_name)})` : '—'}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl min-h-[140px] shadow-sm">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">Petugas RS</span>
                          <div className="flex-1 flex items-center justify-center mb-2">
                            {signatureHospitalDelivery ? (
                              <img src={signatureHospitalDelivery} alt="RS Delivery" className="max-h-[80px] object-contain" />
                            ) : (
                              <span className="text-xs text-slate-450 font-bold">—</span>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-[#126776] text-center border-t border-slate-100 pt-1.5 w-full">
                            {editingTransaction.transaction.hospital_staff_delivery ? `(${toTitleCase(editingTransaction.transaction.hospital_staff_delivery)})` : '—'}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl min-h-[140px] shadow-sm">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">Perawat RS</span>
                          <div className="flex-1 flex items-center justify-center mb-2">
                            {signatureAssistantDelivery ? (
                              <img src={signatureAssistantDelivery} alt="Perawat Delivery" className="max-h-[80px] object-contain" />
                            ) : (
                              <span className="text-xs text-slate-450 font-bold">—</span>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-[#126776] text-center border-t border-slate-100 pt-1.5 w-full">
                            {editingTransaction.transaction.hospital_assistant_delivery ? `(${toTitleCase(editingTransaction.transaction.hospital_assistant_delivery)})` : '—'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
