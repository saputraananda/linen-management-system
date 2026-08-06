import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import {
  FileText, Search, Calendar, CheckCircle2,
  AlertTriangle, ArrowLeft, RefreshCw, PlusCircle,
  ChevronRight, ChevronDown, Save, User, Clock, AlertCircle,
  Warehouse, Building, Shirt, HelpCircle, Info, X, Trash2
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

export default function SerahTerimaKomersil() {
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'form'
  const [hospitalId, setHospitalId] = useState(sessionStorage.getItem('valet_hospital_id') || '');
  const [hospitalName, setHospitalName] = useState(sessionStorage.getItem('valet_hospital_name') || '');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [temporaryTxId, setTemporaryTxId] = useState(null);

  // Keep hospitalId and hospitalName in sync with sessionStorage in case of client-side navigation transitions
  const currentSessionHospitalId = sessionStorage.getItem('valet_hospital_id') || '';
  const currentSessionHospitalName = sessionStorage.getItem('valet_hospital_name') || '';

  if (currentSessionHospitalId !== hospitalId) {
    setHospitalId(currentSessionHospitalId);
    setLoadingHistory(!!currentSessionHospitalId);
  }
  if (currentSessionHospitalName !== hospitalName) {
    setHospitalName(currentSessionHospitalName);
  }

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

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
  
  // Dynamic Dynamic Rows State for Komersil Linen Items
  const [komersilRows, setKomersilRows] = useState([]);
  const [submittingNew, setSubmittingNew] = useState(false);

  // Edit/Completion view state (Day 2 Bersih)
  const [editingTransaction, setEditingTransaction] = useState(null);
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
  const [editDetails, setEditDetails] = useState([]);
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

  const prevFiltersRef = useRef({ startDate, endDate, filterStatus });
  const prevSearchQueryRef = useRef(searchQuery);

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

  useEffect(() => {
    let viewKey;
    if (editingTransaction) {
      viewKey = `edit-${editingTransaction.transaction?.id}`;
    } else {
      viewKey = activeTab;
    }
    const isFirstLoad = window.history.state?.serahTerimaKomersilView == null;
    if (isFirstLoad) {
      window.history.replaceState({ serahTerimaKomersilView: viewKey }, '');
    } else if (window.history.state?.serahTerimaKomersilView !== viewKey) {
      window.history.pushState({ serahTerimaKomersilView: viewKey }, '');
    }
  }, [activeTab, editingTransaction]);

  useEffect(() => {
    const handlePopState = (event) => {
      const view = event.state?.serahTerimaKomersilView;
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
        setEditingTransaction(null);
        setActiveTab('history');
        setErrorMsg('');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('/api/ikm/employees-komersil', {
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

  useEffect(() => {
    fetchEmployees();
    if (hospitalId) {
      fetchHospitalInfo();
      fetchHistory();
      fetchHospitalLinensKomersil();
    }
  }, [hospitalId]);

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
      let url = `/api/ikm/transactions-komersil?hospitalId=${hospitalId}`;
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
      console.error('Error fetching komersil history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchHospitalLinensKomersil = async () => {
    setLoadingLinens(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/hospital-linen-komersil?hospitalId=${hospitalId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        const fetchedLinens = data.data || [];
        setLinensList(fetchedLinens);

        // Initialize komersil rows with 1 row per master item by default if rows are empty
        if (fetchedLinens.length > 0 && komersilRows.length === 0) {
          const defaultRows = fetchedLinens.map((item, idx) => ({
            rowId: `row-${Date.now()}-${idx}`,
            hospitalLinenId: item.id,
            qtyKotor: '',
            notes: ''
          }));
          setKomersilRows(defaultRows);
        }
      }
    } catch (err) {
      console.error('Error fetching komersil linens:', err);
    } finally {
      setLoadingLinens(false);
    }
  };

  // Dynamic Row Handlers for Komersil Items Form
  const handleAddRow = () => {
    const defaultLinenId = linensList[0]?.id || '';
    setKomersilRows(prev => [
      ...prev,
      {
        rowId: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        hospitalLinenId: defaultLinenId,
        qtyKotor: '',
        notes: ''
      }
    ]);
  };

  const handleRemoveRow = (rowId) => {
    setKomersilRows(prev => prev.filter(r => r.rowId !== rowId));
  };

  const handleRowChange = (rowId, field, value) => {
    setKomersilRows(prev =>
      prev.map(r => (r.rowId === rowId ? { ...r, [field]: value } : r))
    );
  };

  // Dynamic Row Handlers for Komersil Items Edit/Delivery View
  const handleAddEditRow = () => {
    const defaultLinenId = linensList[0]?.id || '';
    setEditDetails(prev => [
      ...prev,
      {
        rowId: `edit-row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        id: null,
        hospitalLinenId: defaultLinenId,
        qtyKotor: '',
        qtyBersih: '',
        lengthCm: '',
        widthCm: '',
        areaM2: 0,
        notes: ''
      }
    ]);
  };

  const handleRemoveEditRow = (rowId) => {
    setEditDetails(prev => prev.filter(r => r.rowId !== rowId));
  };

  const handleEditRowChange = (rowId, field, value) => {
    setEditDetails(prev =>
      prev.map(r => {
        if (r.rowId !== rowId) return r;
        const updated = { ...r, [field]: value };
        if (field === 'lengthCm' || field === 'widthCm') {
          const l = parseFloat(field === 'lengthCm' ? value : r.lengthCm) || 0;
          const w = parseFloat(field === 'widthCm' ? value : r.widthCm) || 0;
          updated.areaM2 = (l && w) ? parseFloat((l * w).toFixed(2)) : 0;
        }
        return updated;
      })
    );
  };

  const handleCreatePickup = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!hospitalStaffPickup.trim()) {
      setErrorMsg('Nama petugas RS pemeriksa (Pickup) wajib diisi.');
      return;
    }

    const activeDetails = komersilRows
      .filter(row => row.hospitalLinenId && parseInt(row.qtyKotor || 0) > 0)
      .map(row => ({
        hospitalLinenId: parseInt(row.hospitalLinenId),
        qtyKotor: parseInt(row.qtyKotor),
        notes: row.notes || ''
      }));

    if (activeDetails.length === 0) {
      setErrorMsg('Harap isi kuantitas "Kotor" minimal untuk 1 baris item komersil.');
      return;
    }

    setSubmittingNew(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post('/api/ikm/transactions-komersil', {
        id: temporaryTxId,
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
        if (data.isTemporary) {
          setTemporaryTxId(data.data.transactionId);
          showToast("Berhasil Tersimpan Sementara");
          fetchHistory();
        } else {
          setTemporaryTxId(null);
          setUserPickup(localStorage.getItem('employeeId') || '');
          setUserPickupName(localStorage.getItem('fullName') || localStorage.getItem('username') || '');
          setNotes('');
          setHospitalStaffPickup('');
          setHospitalAssistantPickup('');
          setSignatureValetPickup('');
          setSignatureHospitalPickup('');
          setSignatureAssistantPickup('');
          
          // Reset rows
          if (linensList.length > 0) {
            setKomersilRows(linensList.map((item, idx) => ({
              rowId: `row-${Date.now()}-${idx}`,
              hospitalLinenId: item.id,
              qtyKotor: '',
              notes: ''
            })));
          }
          setErrorMsg('');

          showToast("Transaksi serah terima komersil item (Kotor) berhasil dicatat");
          fetchHistory();
          setActiveTab('history');
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Gagal menyimpan transaksi.');
    } finally {
      setSubmittingNew(false);
    }
  };

  const handleOpenEdit = async (tx) => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/transactions-komersil/${tx.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        const fullTx = data.data;

        const hasPickupSignatures = fullTx.transaction.signature_valet_pickup && fullTx.transaction.signature_hospital_pickup;

        if (!hasPickupSignatures) {
          setTemporaryTxId(fullTx.transaction.id);
          setHospitalStaffPickup(fullTx.transaction.hospital_staff_pickup || '');
          setHospitalAssistantPickup(fullTx.transaction.hospital_assistant_pickup || '');
          setNotes(fullTx.transaction.notes_pickup || '');

          if (fullTx.transaction.pickup_date) {
            const pDate = new Date(fullTx.transaction.pickup_date);
            setPickupDate(new Date(pDate.getTime() - pDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
          }

          setSignatureValetPickup(fullTx.transaction.signature_valet_pickup || '');
          setSignatureHospitalPickup(fullTx.transaction.signature_hospital_pickup || '');
          setSignatureAssistantPickup(fullTx.transaction.signature_assistant_pickup || '');

          // Map fullTx.details into komersilRows
          const editRows = fullTx.details.map((detailItem, idx) => ({
            rowId: `row-edit-${detailItem.id}-${idx}`,
            hospitalLinenId: detailItem.hospital_linen_id,
            qtyKotor: detailItem.qty_kotor || 0,
            notes: detailItem.notes || ''
          }));
          setKomersilRows(editRows);

          setActiveTab('form');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        setEditingTransaction(fullTx);
        setUserDelivery(fullTx.transaction.user_delivery || localStorage.getItem('employeeId') || '');
        setUserDeliveryName(
          fullTx.transaction.user_delivery_name || localStorage.getItem('fullName') || localStorage.getItem('username') || ''
        );
        setHospitalStaffPickup(fullTx.transaction.hospital_staff_pickup || '');
        setHospitalAssistantPickup(fullTx.transaction.hospital_assistant_pickup || '');
        setSignatureValetPickup(fullTx.transaction.signature_valet_pickup || '');
        setSignatureHospitalPickup(fullTx.transaction.signature_hospital_pickup || '');
        setSignatureAssistantPickup(fullTx.transaction.signature_assistant_pickup || '');
        setHospitalStaffDelivery(fullTx.transaction.hospital_staff_delivery || '');
        setHospitalAssistantDelivery(fullTx.transaction.hospital_assistant_delivery || '');
        setSignatureValetDelivery(fullTx.transaction.signature_valet_delivery || '');
        setSignatureHospitalDelivery(fullTx.transaction.signature_hospital_delivery || '');
        setSignatureAssistantDelivery(fullTx.transaction.signature_assistant_delivery || '');

        if (fullTx.transaction.delivery_date) {
          const dDate = new Date(fullTx.transaction.delivery_date);
          setDeliveryDate(new Date(dDate.getTime() - dDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        } else {
          setDeliveryDate(new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        }

        setEditNotes(fullTx.transaction.notes_delivery || '');

        const mappedEditDetails = fullTx.details.map((dItem, idx) => ({
          rowId: `edit-row-${dItem.id || Date.now()}-${idx}`,
          id: dItem.id || null,
          hospitalLinenId: dItem.hospital_linen_id || (linensList[0]?.id || ''),
          qtyKotor: dItem.qty_kotor || 0,
          qtyBersih: dItem.qty_bersih !== null ? dItem.qty_bersih : '',
          lengthCm: dItem.length_cm || '',
          widthCm: dItem.width_cm || '',
          areaM2: dItem.area_m2 || 0,
          notes: dItem.notes || ''
        }));

        setEditDetails(mappedEditDetails);
        setErrorMsg('');
      }
    } catch (err) {
      console.error('Error fetching transaction detail:', err);
    }
  };

  const handleCompleteDelivery = async (e) => {
    e.preventDefault();
    if (!editingTransaction) return;
    setErrorMsg('');

    if (!hospitalStaffDelivery.trim()) {
      setErrorMsg('Nama petugas RS penerima (Delivery) wajib diisi.');
      return;
    }

    const detailsPayload = editDetails
      .filter(row => row.hospitalLinenId && parseInt(row.qtyKotor || 0) > 0)
      .map(row => ({
        id: row.id,
        hospitalLinenId: parseInt(row.hospitalLinenId),
        qtyKotor: parseInt(row.qtyKotor),
        qtyBersih: row.qtyBersih !== '' && row.qtyBersih !== null && row.qtyBersih !== undefined ? parseInt(row.qtyBersih) : null,
        lengthCm: row.lengthCm !== '' ? parseFloat(row.lengthCm) : null,
        widthCm: row.widthCm !== '' ? parseFloat(row.widthCm) : null,
        areaM2: row.areaM2 ? parseFloat(row.areaM2) : null,
        notes: row.notes || ''
      }));

    if (detailsPayload.length === 0) {
      setErrorMsg('Harap isi kuantitas "Kotor" minimal untuk 1 baris item komersil.');
      return;
    }

    setSubmittingEdit(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.put(`/api/ikm/transactions-komersil/${editingTransaction.transaction.id}`, {
        userDelivery: parseInt(userDelivery),
        hospitalStaffDelivery,
        hospitalAssistantDelivery,
        deliveryDate: deliveryDate.replace('T', ' ') + ':00',
        notes: editNotes,
        details: detailsPayload,
        signatureValetDelivery,
        signatureHospitalDelivery,
        signatureAssistantDelivery
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data?.success) {
        showToast(data.message || "Pengiriman komersil item bersih berhasil disimpan");
        setEditingTransaction(null);
        fetchHistory();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Gagal memperbarui transaksi delivery.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const formatNumber = (val) => new Intl.NumberFormat('id-ID').format(val || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAuditTime = (timeStr) => {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const getLinenNameById = (hospitalLinenId) => {
    const found = linensList.find(l => l.id === hospitalLinenId);
    if (found) return getLinenDisplayName(found);
    if (editingTransaction?.details) {
      const detailFound = editingTransaction.details.find(d => d.hospital_linen_id === hospitalLinenId);
      if (detailFound) return getLinenDisplayName(detailFound);
    }
    return `ID #${hospitalLinenId}`;
  };

  const generateAuditLogDescriptions = (audit) => {
    const descriptions = [];
    let oldSnap = {};
    let newSnap = {};

    try {
      oldSnap = typeof audit.old_values === 'string' ? JSON.parse(audit.old_values) : (audit.old_values || {});
    } catch (e) { }

    try {
      newSnap = typeof audit.new_values === 'string' ? JSON.parse(audit.new_values) : (audit.new_values || {});
    } catch (e) { }

    const oldTx = oldSnap.transaction || {};
    const newTx = newSnap.transaction || {};

    if (audit.action === 'CREATE' || audit.action === 'PICKUP_KOTOR') {
      const details = newSnap.details || [];
      if (details.length > 0) {
        details.forEach(d => {
          const name = getLinenNameById(d.hospital_linen_id);
          descriptions.push(`Mencatat pickup kotor ${name} sebanyak ${d.qty_kotor || 0} Pcs ${d.notes ? `(${d.notes})` : ''}`);
        });
      } else {
        descriptions.push("Membuat transaksi pickup linen komersil kotor baru");
      }
      return descriptions;
    }

    if (audit.action === 'DELIVERY_BERSIH') {
      const details = newSnap.details || [];
      details.forEach(d => {
        const name = getLinenNameById(d.hospital_linen_id);
        const len = d.length_cm ? parseFloat(d.length_cm) : null;
        const wid = d.width_cm ? parseFloat(d.width_cm) : null;
        const sizeStr = (len && wid) ? `${len}m x ${wid}m ` : '';
        descriptions.push(`Mengirim linen komersil bersih ${name} ${sizeStr}sebanyak ${d.qty_bersih || 0} Pcs ${d.notes ? `(${d.notes})` : ''}`);
      });
      return descriptions;
    }

    if (oldTx.hospital_staff_delivery !== newTx.hospital_staff_delivery) {
      descriptions.push(`Petugas RS Delivery: "${oldTx.hospital_staff_delivery || '—'}" menjadi "${newTx.hospital_staff_delivery || '—'}"`);
    }
    if (oldTx.hospital_assistant_delivery !== newTx.hospital_assistant_delivery) {
      descriptions.push(`Perawat RS Delivery: "${oldTx.hospital_assistant_delivery || '—'}" menjadi "${newTx.hospital_assistant_delivery || '—'}"`);
    }

    if (oldTx.pickup_date !== newTx.pickup_date) {
      descriptions.push(`Tanggal Pickup: "${oldTx.pickup_date || '—'}" menjadi "${newTx.pickup_date || '—'}"`);
    }
    if (oldTx.delivery_date !== newTx.delivery_date) {
      descriptions.push(`Tanggal Pengantaran: "${oldTx.delivery_date || '—'}" menjadi "${newTx.delivery_date || '—'}"`);
    }
    if (oldTx.status !== newTx.status) {
      descriptions.push(`Status Transaksi: "${oldTx.status || '—'}" menjadi "${newTx.status || '—'}"`);
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

    if (descriptions.length === 0) {
      descriptions.push("Melakukan pembaruan data transaksi");
    }

    return descriptions;
  };

  const filteredEmployees = employees.filter(emp =>
    emp.employee_name.toLowerCase().includes(searchEmployeeQuery.toLowerCase())
  );

  const filteredEditEmployees = employees.filter(emp =>
    emp.employee_name.toLowerCase().includes(editSearchEmployeeQuery.toLowerCase())
  );

  const filteredKomersilRows = komersilRows.filter(row => {
    if (!linenSearch.trim()) return true;
    const masterObj = linensList.find(l => l.id === row.hospitalLinenId);
    const name = masterObj ? getLinenDisplayName(masterObj).toLowerCase() : '';
    const notes = (row.notes || '').toLowerCase();
    const query = linenSearch.toLowerCase();
    return name.includes(query) || notes.includes(query);
  });

  const filteredEditDetails = editDetails.filter(row => {
    if (!editLinenSearch.trim()) return true;
    const masterObj = linensList.find(l => l.id === row.hospitalLinenId);
    const name = masterObj ? getLinenDisplayName(masterObj).toLowerCase() : '';
    const notes = (row.notes || '').toLowerCase();
    const query = editLinenSearch.toLowerCase();
    return name.includes(query) || notes.includes(query);
  });

  const isEditable = editingTransaction ? editingTransaction.transaction.is_editable : false;

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
              Portal pencatatan sirkulasi harian linen komersil (Gorden/Vitrase/Karpet/PxL).
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
              onClick={() => {
                setActiveTab('form');
                setEditingTransaction(null);
                setTemporaryTxId(null);
                setNotes('');
                setHospitalStaffPickup('');
                setHospitalAssistantPickup('');
                setSignatureValetPickup('');
                setSignatureHospitalPickup('');
                setSignatureAssistantPickup('');
                if (linensList.length > 0) {
                  setKomersilRows(linensList.map((item, idx) => ({
                    rowId: `row-${Date.now()}-${idx}`,
                    hospitalLinenId: item.id,
                    qtyKotor: '',
                    notes: ''
                  })));
                }
              }}
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

        {!hospitalId ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-3xl p-6 flex items-start gap-4">
            <Info className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Rumah Sakit Belum Dipilih</p>
              <p className="text-xs text-amber-700/90 mt-1 leading-relaxed">
                Silakan pilih salah satu Rumah Sakit di sidebar atau kembali ke Dashboard terlebih dahulu untuk memproses data.
              </p>
            </div>
          </div>
        ) : (
          <>
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

                      {/* Komersil Styled Select Dropdown */}
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
                                <span className="text-[11px] text-[#1ea59e] font-medium">Valet - Linen Kotor:</span>
                                {tx.user_pickup_name}
                              </span>
                              {tx.user_delivery && (
                                <span className="flex items-center gap-1 border-l border-slate-200 pl-2">
                                  <span className="text-[11px] text-[#1ea59e] font-medium">Valet - Linen Bersih:</span>
                                  {tx.user_delivery_name}
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
                    Form Pengisian Serah Terima Linen Komersil
                  </h2>
                  <p className="text-xs text-white/80 mt-1 font-medium">
                    Lakukan pendataan jumlah linen komersil kotor yang diambil untuk dicuci dari {hospitalName || 'Rumah Sakit'}.
                  </p>
                </div>

                <form onSubmit={handleCreatePickup} className="p-6 space-y-6">

                  {/* Form Config Fields */}
                  <div className="space-y-4">
                    {/* Card 1: Data Transaksi IKM */}
                    <div className="flex rounded-2xl border border-slate-150 bg-slate-50/50">
                      <div className="bg-[#678083] text-white flex items-center justify-center px-4 font-bold text-[10px] uppercase select-none tracking-widest shrink-0 [writing-mode:vertical-lr] rotate-180 rounded-r-2xl">
                        Valet IKM
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5 p-5">
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
                              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] select-none min-h-[38px] transition-all"
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
                                <div className="relative mb-2 shrink-0">
                                  <Search className="absolute inset-y-0 left-2.5 my-auto h-3.5 w-3.5 text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder="Cari petugas..."
                                    value={searchEmployeeQuery}
                                    onChange={e => setSearchEmployeeQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-150 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#1ea59e]/20 focus:border-[#1ea59e] font-semibold text-slate-700"
                                    onClick={e => e.stopPropagation()}
                                  />
                                </div>

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
                    </div>

                    {/* Card 2: Data Petugas Pemeriksa Rumah Sakit */}
                    <div className="flex rounded-2xl border border-slate-150 bg-slate-50/50">
                      <div className="bg-[#678083] text-white flex items-center justify-center px-4 font-bold text-[10px] uppercase select-none tracking-widest shrink-0 [writing-mode:vertical-lr] rotate-180 rounded-r-2xl">
                        Petugas RS
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
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
                  </div>

                  {/* Error Alert */}
                  {errorMsg && (
                    <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-start gap-2.5 animate-shake">
                      <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Table of items with Dynamic Add Item support */}
                  <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                    {/* Header bar above linen table with Search & Tambah Item button */}
                    <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Cari nama item komersil..."
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

                      <button
                        type="button"
                        onClick={handleAddRow}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#126776] hover:bg-[#0e5562] text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer shrink-0"
                      >
                        <PlusCircle className="h-4 w-4" />
                        <span>Tambah Item</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider text-xs border-b border-slate-150">
                            <th className="py-3.5 px-4 w-12 text-center">No</th>
                            <th className="py-3.5 px-4 text-center">Nama Linen Khusus</th>
                            <th className="py-3.5 px-4 w-28 text-center">Kotor</th>
                            <th className="py-3.5 px-4 text-center">Keterangan</th>
                            <th className="py-3.5 px-4 w-14 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {loadingLinens ? (
                            <tr>
                              <td colSpan="5" className="py-16 text-center text-slate-400 font-bold">
                                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-[#126776] mb-2" />
                                Memuat data linen...
                              </td>
                            </tr>
                          ) : filteredKomersilRows.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="py-16 text-center text-slate-400 font-semibold">
                                Belum ada baris item komersil. Klik <strong>"+ Tambah Item"</strong> untuk menambah baris baru.
                              </td>
                            </tr>
                          ) : (
                            filteredKomersilRows.map((row, index) => {
                              const isFilled = parseInt(row.qtyKotor || 0) > 0;
                              return (
                                <tr
                                  key={row.rowId}
                                  className={`transition-all duration-150 ${isFilled
                                    ? 'bg-[#1ea59e]/5 border-l-4 border-l-[#1ea59e]'
                                    : 'hover:bg-slate-50/40'
                                    }`}
                                >
                                  <td className="py-3 px-4 text-center font-medium text-slate-400 text-xs">{index + 1}</td>
                                  
                                  {/* Master Linen Select Dropdown */}
                                  <td className="py-3 px-4">
                                    <select
                                      value={row.hospitalLinenId}
                                      onChange={e => handleRowChange(row.rowId, 'hospitalLinenId', parseInt(e.target.value))}
                                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white cursor-pointer"
                                    >
                                      {linensList.map(m => (
                                        <option key={m.id} value={m.id}>
                                          {getLinenDisplayName(m)}
                                        </option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* Qty Kotor Input */}
                                  <td className="py-3 px-4">
                                    <div className="flex items-center justify-center">
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="Qty"
                                        value={row.qtyKotor}
                                        onChange={e => {
                                          const val = parseInt(e.target.value) || 0;
                                          handleRowChange(row.rowId, 'qtyKotor', val >= 0 ? val : 0);
                                        }}
                                        className="w-20 text-center py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white transition"
                                      />
                                    </div>
                                  </td>

                                  {/* Notes / PxL Input */}
                                  <td className="py-3 px-4">
                                    <input
                                      type="text"
                                      placeholder="Catatan item (misal: PxL, noda, lokasi)..."
                                      value={row.notes}
                                      onChange={e => handleRowChange(row.rowId, 'notes', e.target.value)}
                                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white transition"
                                    />
                                  </td>

                                  {/* Delete Row Action Button */}
                                  <td className="py-3 px-4 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRow(row.rowId)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                      title="Hapus baris"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
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
                        Update Pengiriman Bersih Komersil
                      </span>
                      <span className="text-xs text-white/60 font-medium">Form Transaksi #{editingTransaction.transaction.id}</span>
                    </div>
                    <h2 className="text-lg font-bold tracking-tight mt-2.5">
                      No. Formulir: {editingTransaction.transaction.form_number}
                    </h2>
                    <p className="text-xs text-white/80 mt-1 font-medium">
                      Catat pengembalian laundry komersil bersih untuk {hospitalName || 'Rumah Sakit'}.
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

                  {/* Pengambilan Section */}
                  <div className="flex flex-col md:flex-row rounded-2xl border border-slate-150 bg-slate-50/50 min-h-fit md:min-h-[130px]">
                    <div className="bg-[#678083] text-white flex items-center justify-center py-2.5 md:py-0 px-5 md:px-4 font-bold text-[10px] uppercase select-none tracking-widest shrink-0 md:[writing-mode:vertical-lr] md:rotate-180 rounded-t-2xl md:rounded-t-none md:rounded-r-2xl text-center">
                      Pengambilan
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 p-5 text-xs items-center">
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
                        <span className="font-medium text-slate-500 block italic text-xs truncate" title={editingTransaction.transaction.notes_pickup || ''}>
                          {editingTransaction.transaction.notes_pickup || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pengiriman Section */}
                  <div className="flex flex-col md:flex-row rounded-2xl border border-slate-150 bg-slate-50/50 min-h-fit md:min-h-[130px]">
                    <div className="bg-[#126776] text-white flex items-center justify-center py-2.5 md:py-0 px-5 md:px-4 font-bold text-[10px] uppercase select-none tracking-widest shrink-0 md:[writing-mode:vertical-lr] md:rotate-180 rounded-t-2xl md:rounded-t-none md:rounded-r-2xl text-center">
                      Pengiriman
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 p-5 items-center">

                      {/* Delivery Complete Recorder */}
                      <div className="space-y-1.5" ref={editEmployeeSelectRef}>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
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
                                className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] select-none min-h-[38px] transition-all"
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
                                  <div className="relative mb-2 shrink-0">
                                    <Search className="absolute inset-y-0 left-2.5 my-auto h-3.5 w-3.5 text-slate-400" />
                                    <input
                                      type="text"
                                      placeholder="Cari petugas..."
                                      value={editSearchEmployeeQuery}
                                      onChange={e => setEditSearchEmployeeQuery(e.target.value)}
                                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-150 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#1ea59e]/20 focus:border-[#1ea59e] font-semibold text-slate-700"
                                      onClick={e => e.stopPropagation()}
                                    />
                                  </div>

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
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
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
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5 min-h-[16px]">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Petugas RS (Delivery)
                          </label>
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => setHospitalStaffDelivery(hospitalStaffPickup)}
                              className="text-[9px] text-[#1ea59e] hover:text-[#126776] font-extrabold transition flex items-center gap-1 cursor-pointer select-none"
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

                      {/* Perawat RS Pemeriksa (Delivery) */}
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5 min-h-[16px]">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Perawat RS (Delivery)
                          </label>
                          {isEditable && (
                            <button
                              type="button"
                              onClick={() => setHospitalAssistantDelivery(hospitalAssistantPickup || '')}
                              className="text-[9px] text-[#1ea59e] hover:text-[#126776] font-extrabold transition flex items-center gap-1 cursor-pointer select-none"
                            >
                              Sama Dengan Pickup
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <User className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            disabled={!isEditable}
                            placeholder="Nama perawat Rumah Sakit (Opsional)..."
                            value={hospitalAssistantDelivery}
                            onChange={e => setHospitalAssistantDelivery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>
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
                  <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                    {/* Search bar above bersih linen table */}
                    <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Cari nama item komersil..."
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

                      {isEditable && (
                        <button
                          type="button"
                          onClick={handleAddEditRow}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#126776] hover:bg-[#0e5562] text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer shrink-0"
                        >
                          <PlusCircle className="h-4 w-4" />
                          <span>Tambah Item</span>
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider text-xs border-b border-slate-150">
                            <th className="py-3.5 px-4 w-12 text-center">No</th>
                            <th className="py-3.5 px-4 text-center min-w-[160px]">Nama Linen Khusus</th>
                            <th className="py-3.5 px-4 text-center w-20">P (m)</th>
                            <th className="py-3.5 px-4 text-center w-20">L (m)</th>
                            <th className="py-3.5 px-4 text-center w-24">Luas (m²)</th>
                            <th className="py-3.5 px-4 text-center w-20">Kotor</th>
                            <th className="py-3.5 px-4 text-center w-20">Bersih</th>
                            <th className="py-3.5 px-4 text-center">Catatan Selisih & Keterangan</th>
                            {isEditable && <th className="py-3.5 px-4 w-14 text-center">Aksi</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {filteredEditDetails.length === 0 ? (
                            <tr>
                              <td colSpan={isEditable ? 9 : 8} className="py-16 text-center text-slate-400 font-semibold text-xs">
                                {editLinenSearch ? `Tidak ada item komersil yang cocok dengan "${editLinenSearch}"` : 'Tidak ada data item komersil.'}
                              </td>
                            </tr>
                          ) : filteredEditDetails.map((row, index) => {
                            const isDiff = parseInt(row.qtyKotor || 0) !== parseInt(row.qtyBersih || 0);
                            return (
                              <tr
                                key={row.rowId}
                                className={`transition-colors duration-150 ${isDiff && isEditable
                                  ? 'bg-amber-500/[0.03] border-l-4 border-l-amber-400'
                                  : 'hover:bg-slate-50/40'
                                  }`}
                              >
                                <td className="py-3 px-4 text-center font-medium text-slate-400 text-xs">{index + 1}</td>
                                
                                {/* Nama Linen Khusus */}
                                <td className="py-3 px-4 font-semibold text-slate-800">
                                  {isEditable ? (
                                    <select
                                      value={row.hospitalLinenId}
                                      onChange={e => handleEditRowChange(row.rowId, 'hospitalLinenId', parseInt(e.target.value))}
                                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1ea59e]/20 focus:border-[#1ea59e] focus:bg-white cursor-pointer"
                                    >
                                      {linensList.map(m => (
                                        <option key={m.id} value={m.id}>
                                          {getLinenDisplayName(m)}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-sm">{getLinenNameById(row.hospitalLinenId)}</span>
                                  )}
                                </td>

                                {/* Panjang (m) */}
                                <td className="py-3 px-4">
                                  {isEditable ? (
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      placeholder="P"
                                      value={row.lengthCm}
                                      onChange={e => handleEditRowChange(row.rowId, 'lengthCm', e.target.value)}
                                      className="w-16 text-center py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1ea59e]/20 focus:border-[#1ea59e] focus:bg-white transition"
                                    />
                                  ) : (
                                    <div className="text-center text-xs font-semibold text-slate-700">{row.lengthCm || '—'}</div>
                                  )}
                                </td>

                                {/* Lebar (m) */}
                                <td className="py-3 px-4">
                                  {isEditable ? (
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      placeholder="L"
                                      value={row.widthCm}
                                      onChange={e => handleEditRowChange(row.rowId, 'widthCm', e.target.value)}
                                      className="w-16 text-center py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1ea59e]/20 focus:border-[#1ea59e] focus:bg-white transition"
                                    />
                                  ) : (
                                    <div className="text-center text-xs font-semibold text-slate-700">{row.widthCm || '—'}</div>
                                  )}
                                </td>

                                {/* Luas (m²) */}
                                <td className="py-3 px-4 text-center">
                                  <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-650 rounded-lg text-xs font-bold border border-slate-200">
                                    {row.areaM2 || 0} m²
                                  </span>
                                </td>

                                {/* Kotor */}
                                <td className="py-3 px-4">
                                  {isEditable ? (
                                    <input
                                      type="number"
                                      min="0"
                                      value={row.qtyKotor}
                                      onChange={e => handleEditRowChange(row.rowId, 'qtyKotor', parseInt(e.target.value) || 0)}
                                      className="w-16 text-center py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1ea59e]/20 focus:border-[#1ea59e] focus:bg-white transition"
                                    />
                                  ) : (
                                    <div className="text-center font-semibold text-slate-700 text-sm">{formatNumber(row.qtyKotor)}</div>
                                  )}
                                </td>

                                {/* Bersih */}
                                <td className="py-3 px-4">
                                  {isEditable ? (
                                    <input
                                      type="number"
                                      min="0"
                                      value={row.qtyBersih}
                                      onChange={e => handleEditRowChange(row.rowId, 'qtyBersih', parseInt(e.target.value) || 0)}
                                      className="w-16 text-center py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1ea59e]/20 focus:border-[#1ea59e] focus:bg-white transition"
                                    />
                                  ) : (
                                    <div className="text-center font-semibold text-teal-700 text-sm">{formatNumber(row.qtyBersih)}</div>
                                  )}
                                </td>

                                {/* Notes / Catatan */}
                                <td className="py-3 px-4">
                                  {isEditable ? (
                                    <div className="space-y-1">
                                      <input
                                        type="text"
                                        placeholder="Keterangan..."
                                        value={row.notes || ''}
                                        onChange={e => handleEditRowChange(row.rowId, 'notes', e.target.value)}
                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ea59e]/20 focus:border-[#1ea59e] focus:bg-white transition"
                                      />
                                      {isDiff && (
                                        <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          Selisih: {Math.abs(parseInt(row.qtyKotor || 0) - parseInt(row.qtyBersih || 0))} Pcs.
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      {isDiff && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                                      <span className="font-medium text-slate-650 text-xs">{row.notes || '—'}</span>
                                    </div>
                                  )}
                                </td>

                                {/* Aksi (Delete Row) */}
                                {isEditable && (
                                  <td className="py-3 px-4 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveEditRow(row.rowId)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                      title="Hapus baris"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary Footer bar */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-end gap-x-6 gap-y-2 text-xs font-bold text-slate-700">
                      <div>
                        Total Kotor: <span className="text-[#126776] text-sm">{formatNumber(editDetails.reduce((sum, r) => sum + parseInt(r.qtyKotor || 0), 0))} Pcs</span>
                      </div>
                      <div>
                        Total Bersih: <span className="text-teal-700 text-sm">{formatNumber(editDetails.reduce((sum, r) => sum + parseInt(r.qtyBersih || 0), 0))} Pcs</span>
                      </div>
                      <div>
                        Total Luas: <span className="text-[#1ea59e] text-sm">{editDetails.reduce((sum, r) => sum + parseFloat(r.areaM2 || 0), 0).toFixed(2)} m²</span>
                      </div>
                    </div>
                  </div>

                  {/* Log Aktivitas Transaksi Collapsible Panel */}
                  {editingTransaction.audits && editingTransaction.audits.length > 0 && (
                    <div className="bg-slate-50 rounded-2xl border border-slate-150 overflow-hidden shadow-sm transition-all duration-200">
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
                              Log Aktivitas Transaksi Komersil
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

                      {showAuditLogs && (
                        <div className="px-5 pb-5 border-t border-slate-150/70 pt-4 bg-white animate-[fadeIn_0.2s_ease-out] space-y-5 max-h-72 overflow-y-auto pr-2 divide-y divide-slate-100/70">
                          {editingTransaction.audits.some(a => a.action === 'CREATE' || a.action === 'PICKUP_KOTOR') && (
                            <div className="space-y-2 pt-3 first:pt-0">
                              <h5 className="text-[10px] font-extrabold text-[#678083] uppercase tracking-wider block">
                                Pickup Item Komersil Kotor
                              </h5>
                              <div className="space-y-1.5 pl-1.5">
                                {editingTransaction.audits
                                  .filter(a => a.action === 'CREATE' || a.action === 'PICKUP_KOTOR')
                                  .map(audit => {
                                    const descriptions = generateAuditLogDescriptions(audit);
                                    return descriptions.map((desc, idx) => (
                                      <div key={`${audit.id}-${idx}`} className="text-xs font-semibold text-slate-600 flex items-start gap-1.5">
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

                          {editingTransaction.audits.some(a => a.action === 'UPDATE' || a.action === 'DELIVERY_BERSIH') && (
                            <div className="space-y-2 pt-3">
                              <h5 className="text-[10px] font-extrabold text-[#1ea59e] uppercase tracking-wider block">
                                Pengantaran Item Komersil Bersih
                              </h5>
                              <div className="space-y-1.5 pl-1.5">
                                {editingTransaction.audits
                                  .filter(a => a.action === 'UPDATE' || a.action === 'DELIVERY_BERSIH')
                                  .map(audit => {
                                    const descriptions = generateAuditLogDescriptions(audit);
                                    return descriptions.map((desc, idx) => (
                                      <div key={`${audit.id}-${idx}`} className="text-xs font-semibold text-slate-600 flex items-start gap-1.5">
                                        <span className="text-slate-400 font-bold shrink-0">{formatAuditTime(audit.created_at)}</span>
                                        <span className="text-slate-400 font-bold shrink-0">•</span>
                                        <span className="text-[#1ea59e] font-bold shrink-0">{audit.full_name || audit.username}</span>
                                        <span className="text-slate-400 font-bold shrink-0">•</span>
                                        <span className="text-slate-700 font-medium">{desc}</span>
                                      </div>
                                    ));
                                  })}
                              </div>
                            </div>
                          )}

                          {editingTransaction.audits.some(a => a.action === 'KURANG_KIRIM') && (
                            <div className="space-y-2 pt-3">
                              <h5 className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider block">
                                Komersil Item Kurang Kirim
                              </h5>
                              <div className="space-y-1.5 pl-1.5">
                                {editingTransaction.audits
                                  .filter(a => a.action === 'KURANG_KIRIM')
                                  .map(audit => {
                                    const descriptions = generateAuditLogDescriptions(audit);
                                    return descriptions.map((desc, idx) => (
                                      <div key={`${audit.id}-${idx}`} className="text-xs font-semibold text-slate-600 flex items-start gap-1.5">
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

                          {editingTransaction.audits.some(a => a.action === 'ADMIN') && (
                            <div className="space-y-2 pt-3">
                              <h5 className="text-[10px] font-extrabold text-violet-600 uppercase tracking-wider block">
                                Perubahan Oleh Admin
                              </h5>
                              <div className="space-y-1.5 pl-1.5">
                                {editingTransaction.audits
                                  .filter(a => a.action === 'ADMIN')
                                  .map(audit => {
                                    const descriptions = generateAuditLogDescriptions(audit);
                                    return descriptions.map((desc, idx) => (
                                      <div key={`${audit.id}-${idx}`} className="text-xs font-semibold text-slate-600 flex items-start gap-1.5">
                                        <span className="text-slate-400 font-bold shrink-0">{formatAuditTime(audit.created_at)}</span>
                                        <span className="text-slate-400 font-bold shrink-0">•</span>
                                        <span className="text-violet-600 font-bold shrink-0">{audit.full_name || audit.username}</span>
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
          </>
        )}

      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border border-slate-100 bg-white/95 backdrop-blur-md animate-[slideIn_0.3s_ease-out] min-w-[280px]">
          <div className={`p-1.5 rounded-lg ${toast.type === 'success' ? 'bg-teal-50 text-[#1ea59e]' : 'bg-rose-50 text-rose-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-800 leading-tight">
              {toast.type === 'success' ? 'Berhasil' : 'Pemberitahuan'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-semibold leading-tight">
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToast(prev => ({ ...prev, show: false }))}
            className="text-slate-400 hover:text-slate-650 transition shrink-0 p-1 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
