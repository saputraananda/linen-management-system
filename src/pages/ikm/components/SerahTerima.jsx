import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import {
  FileText, Search, Calendar, CheckCircle2,
  AlertTriangle, ArrowLeft, RefreshCw, PlusCircle,
  ChevronRight, ChevronDown, Save, User, Clock, AlertCircle,
  Warehouse, Building, Shirt, HelpCircle, Info, X, Lock, Unlock,
  Scale, Zap
} from 'lucide-react';
import RoomStatusSelect from './RoomStatusSelect';
import OwnershipBadge from '../../../components/OwnershipBadge';
import ConfirmDialog from '../../../components/ConfirmDialog';
import Pagination from '../../../components/Pagination';
import usePaging from '../../../utils/usePaging';
import { socket } from '../../../utils/socket';

// Hari ini (zona waktu perangkat) dalam format YYYY-MM-DD
const todayLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

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
  const [hospitalId, setHospitalId] = useState(sessionStorage.getItem('valet_hospital_id') || '');
  const [hospitalName, setHospitalName] = useState(sessionStorage.getItem('valet_hospital_name') || '');
  const [billingByKg, setBillingByKg] = useState(0);
  const [allowExpress, setAllowExpress] = useState(0);
  const [kgAgreement, setKgAgreement] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [alertConfig, setAlertConfig] = useState({ show: false, title: 'Peringatan', message: '' });
  const showAlert = (message, title = 'Peringatan') => setAlertConfig({ show: true, title, message });
  // Modal konfirmasi (pengganti window.confirm), gaya sama dengan modal peringatan
  const [confirmConfig, setConfirmConfig] = useState({ show: false, title: '', message: '', confirmLabel: 'Ya', onConfirm: null });
  const closeConfirm = () => setConfirmConfig(c => ({ ...c, show: false, onConfirm: null }));
  const [savedRooms, setSavedRooms] = useState([]);
  const [temporaryTxId, setTemporaryTxId] = useState(null);

  // Satu formulir induk per hari: isian yang terakhir dimuat dari server (dasar deteksi ruangan yang diubah
  // perangkat ini) dan modal "Lanjutkan formulir / Formulir Baru".
  const [pickupBaseline, setPickupBaseline] = useState({}); // { linenId: { roomKey: { q, n } } }
  const [forceNewForm, setForceNewForm] = useState(false);
  const [dayFormsModal, setDayFormsModal] = useState({ show: false, mode: 'start', forms: [], retry: null });

  // TTD Serah Terima per Unit (ruangan): Valet + Perawat Unit per ruangan, sebelum TTD akhir Tim Linen RS
  const [requireUnitSignature, setRequireUnitSignature] = useState(0);
  const [pickupRoomSign, setPickupRoomSign] = useState(null); // status TTD unit formulir pickup yang sedang diisi
  const [roomNurses, setRoomNurses] = useState({}); // { roomId: [nama perawat] } dari mst_users_rs
  const [unitNurseName, setUnitNurseName] = useState('');
  const [unitSigNurse, setUnitSigNurse] = useState('');
  const [unitSigValet, setUnitSigValet] = useState('');
  const [unitSigKey, setUnitSigKey] = useState(0); // remount kanvas TTD saat ganti ruangan
  const [signingRoom, setSigningRoom] = useState(false);

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
  const pg = usePaging();

  // Form tab states (New transaction - Day 1 Kotor)
  const [linensList, setLinensList] = useState([]);
  const [roomLinensList, setRoomLinensList] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const isRoomLocked = selectedRoomId && savedRooms.includes(selectedRoomId.toString());
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
  const [totalKgValet, setTotalKgValet] = useState('');
  const [isExpress, setIsExpress] = useState(false);
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
  const prevFiltersRef = useRef({ startDate, endDate, filterStatus, page: pg.page, pageSize: pg.pageSize });
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

  const getHospitalLinenTotalStock = (hospitalLinenId) => {
    if (editingTransaction) {
      const detail = editingTransaction.details.find(d => d.hospital_linen_id === hospitalLinenId);
      if (detail && detail.stock_in_rs !== undefined) {
        return detail.stock_in_rs;
      }
    }
    const linen = linensList.find(l => l.id === hospitalLinenId);
    return linen ? (linen.stock_in_rs || 0) : 0;
  };

  const getRoomAndStockInfo = (hospitalLinenId) => {
    const totalStock = getHospitalLinenTotalStock(hospitalLinenId);
    if (selectedRoomId) {
      const roomLinen = roomLinensList.find(rl => 
        rl.hospital_linen_id === hospitalLinenId && rl.room_id === parseInt(selectedRoomId)
      );
      const roomName = roomLinen?.room_name || 'Tidak ada di ruangan';
      const roomStock = roomLinen?.stock_in_rs || 0;
      return {
        roomName,
        roomStock,
        totalStock,
        isRoomSelected: true
      };
    } else {
      return {
        roomName: 'All',
        roomStock: null,
        totalStock,
        isRoomSelected: false
      };
    }
  };

  const sumQty = (qtyObj) => {
    if (qtyObj === undefined || qtyObj === null) return 0;
    if (typeof qtyObj === 'number') return qtyObj;
    if (typeof qtyObj === 'string') return parseInt(qtyObj) || 0;
    let sum = 0;
    Object.values(qtyObj).forEach(val => {
      if (val !== '') {
        sum += parseInt(val) || 0;
      }
    });
    return sum;
  };

  const getMergedNotes = (notesObj) => {
    if (!notesObj) return '';
    if (typeof notesObj === 'string') return notesObj;
    const parts = [];
    Object.entries(notesObj).forEach(([roomId, noteText]) => {
      if (noteText && noteText.trim() !== '') {
        if (roomId === 'all') {
          parts.push(noteText.trim());
        } else {
          const room = uniqueRooms.find(r => r.id === parseInt(roomId));
          const roomPrefix = room ? `${room.name}: ` : '';
          parts.push(`${roomPrefix}${noteText.trim()}`);
        }
      }
    });
    return parts.join('; ');
  };

  const getKotorQty = (linenId) => {
    const linenQtys = kotorQuantities[linenId];
    if (linenQtys === undefined || linenQtys === null) return '';
    if (typeof linenQtys === 'number' || typeof linenQtys === 'string') {
      return selectedRoomId ? '' : linenQtys;
    }
    if (selectedRoomId) {
      return linenQtys[selectedRoomId] !== undefined ? linenQtys[selectedRoomId] : '';
    } else {
      // Semua Ruangan: tampilkan placeholder selama belum ada unit yang mengisi qty > 0
      let sum = 0;
      Object.values(linenQtys).forEach(qty => {
        if (qty !== '') sum += parseInt(qty) || 0;
      });
      return sum > 0 ? sum : '';
    }
  };

  const handleKotorQtyChange = (linenId, value) => {
    if (pickupRoomLocked) return;
    setKotorQuantities(prev => {
      const linenQtys = prev[linenId] || {};
      const activeRoom = selectedRoomId || 'all';
      if (typeof linenQtys === 'number' || typeof linenQtys === 'string') {
        return { ...prev, [linenId]: { all: linenQtys, [activeRoom]: value === '' ? '' : (parseInt(value) || 0) } };
      }
      return {
        ...prev,
        [linenId]: {
          ...linenQtys,
          [activeRoom]: value === '' ? '' : (parseInt(value) || 0)
        }
      };
    });
  };

  const getBersihQty = (detailId) => {
    const val = bersihQuantities[detailId];
    return val !== undefined && val !== null ? val : '';
  };

  const handleBersihQtyChange = (detailId, value) => {
    setBersihQuantities(prev => ({
      ...prev,
      [detailId]: value === '' ? '' : (parseInt(value) || 0)
    }));
  };

  const getEditKotorQty = (detailId) => {
    const val = editKotorQuantities[detailId];
    return val !== undefined && val !== null ? val : '';
  };

  const handleEditKotorQtyChange = (detailId, value) => {
    setEditKotorQuantities(prev => ({
      ...prev,
      [detailId]: value === '' ? '' : (parseInt(value) || 0)
    }));
  };

  const getNoteVal = (id) => {
    const notesObj = itemNotes[id];
    if (!notesObj) return '';
    if (typeof notesObj === 'string') {
      return selectedRoomId ? '' : notesObj;
    }
    if (selectedRoomId) {
      return notesObj[selectedRoomId] || '';
    } else {
      return notesObj['all'] || '';
    }
  };

  const handleNoteValChange = (id, value) => {
    if (pickupRoomLocked) return;
    setItemNotes(prev => {
      const notesObj = prev[id] || {};
      if (typeof notesObj === 'string') {
        return { ...prev, [id]: { all: notesObj, [selectedRoomId || 'all']: value } };
      }
      return {
        ...prev,
        [id]: {
          ...notesObj,
          [selectedRoomId || 'all']: value
        }
      };
    });
  };

  const getEditNoteVal = (id) => {
    const notesObj = editItemNotes[id];
    if (!notesObj) return '';
    if (typeof notesObj === 'string') {
      return selectedRoomId ? '' : notesObj;
    }
    if (selectedRoomId) {
      return notesObj[selectedRoomId] || '';
    } else {
      return notesObj['all'] || '';
    }
  };

  const handleEditNoteValChange = (id, value) => {
    setEditItemNotes(prev => {
      const notesObj = prev[id] || {};
      if (typeof notesObj === 'string') {
        return { ...prev, [id]: { all: notesObj, [selectedRoomId || 'all']: value } };
      }
      return {
        ...prev,
        [id]: {
          ...notesObj,
          [selectedRoomId || 'all']: value
        }
      };
    });
  };

  // Fetch initial data — runs once when hospitalId is available
  useEffect(() => {
    fetchEmployees();
    if (hospitalId) {
      fetchHospitalInfo();
      fetchHistory();
      fetchHospitalLinens();
      fetchRoomNurses();
    }
  }, [hospitalId]);

  // Auto-fetch on filter changes — skip initial mount by checking for actual changes
  useEffect(() => {
    if (!hospitalId) return;

    const prev = prevFiltersRef.current;
    const hasChanged = prev.startDate !== startDate ||
      prev.endDate !== endDate ||
      prev.filterStatus !== filterStatus ||
      prev.page !== pg.page ||
      prev.pageSize !== pg.pageSize;

    prevFiltersRef.current = { startDate, endDate, filterStatus, page: pg.page, pageSize: pg.pageSize };

    if (hasChanged) {
      fetchHistory();
    }
  }, [startDate, endDate, filterStatus, pg.page, pg.pageSize, hospitalId]);

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
      const { data } = await axios.get(`/api/ikm/dashboard-data?hospitalId=${hospitalId}&all=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        setHospitalName(data.data.hospital?.hospital_name || '');
        setBillingByKg(Number(data.data.hospital?.billing_by_kg) || 0);
        setAllowExpress(Number(data.data.hospital?.allow_express) || 0);
        setKgAgreement(data.data.hospital?.kg_agreement ?? null);
        setRequireUnitSignature(Number(data.data.hospital?.require_unit_signature) || 0);
      }
    } catch (err) {
      console.error('Error fetching hospital info:', err);
    }
  };

  // Nama perawat unit per ruangan (diisi otomatis, tetap bisa diedit)
  const fetchRoomNurses = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/room-nurses?hospitalId=${hospitalId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) setRoomNurses(data.data || {});
    } catch (err) {
      console.error('Error fetching room nurses:', err);
    }
  };

  // Ambil ulang status TTD unit dari server (server bisa mereset TTD ruangan yang isinya berubah)
  const refreshRoomSign = async (txId, stage) => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/transactions/${txId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!data?.success) return;
      if (stage === 'pickup') setPickupRoomSign(data.data.roomSign || null);
      else setEditingTransaction(prev => (prev ? { ...prev, roomSign: data.data.roomSign } : prev));
    } catch (err) {
      console.error('Error refreshing room signatures:', err);
    }
  };

  // ───────── Simpan per ruangan (banyak valet mengisi satu formulir) ─────────
  const asRoomObj = (v) => (v && typeof v === 'object')
    ? v
    : ((v !== undefined && v !== null && v !== '') ? { all: v } : {});

  const buildPickupBaseline = (details) => {
    const base = {};
    (details || []).forEach(d => {
      const rk = d.room_id ? String(d.room_id) : 'all';
      if (!base[d.hospital_linen_id]) base[d.hospital_linen_id] = {};
      base[d.hospital_linen_id][rk] = { q: parseInt(d.qty_kotor) || 0, n: d.notes || '' };
    });
    return base;
  };

  // Ruangan (pickup) yang isinya diubah perangkat ini dibanding data terakhir dari server
  const pickupDirtyRooms = () => {
    const dirty = new Set();
    const lids = new Set([...Object.keys(kotorQuantities), ...Object.keys(itemNotes), ...Object.keys(pickupBaseline)]);
    lids.forEach(lid => {
      const qObj = asRoomObj(kotorQuantities[lid]);
      const nObj = asRoomObj(itemNotes[lid]);
      const bObj = pickupBaseline[lid] || {};
      new Set([...Object.keys(qObj), ...Object.keys(nObj), ...Object.keys(bObj)]).forEach(rk => {
        const q = parseInt(qObj[rk]) || 0;
        const bq = bObj[rk]?.q || 0;
        // Catatan hanya tersimpan bila jumlah kotornya > 0
        const n = q > 0 ? String(nObj[rk] || '').trim() : '';
        const bn = bq > 0 ? String(bObj[rk]?.n || '').trim() : '';
        if (q !== bq || n !== bn) dirty.add(rk);
      });
    });
    return [...dirty];
  };

  // Terapkan isi formulir pickup dari server; ruangan di keepRooms tetap memakai isian lokal (belum disimpan)
  const applyPickupFromServer = (fullTx, keepRooms = new Set()) => {
    const base = buildPickupBaseline(fullTx.details);
    setPickupBaseline(base);
    const merge = (prev, field) => {
      const next = {};
      const lids = new Set([...linensList.map(l => String(l.id)), ...Object.keys(base), ...Object.keys(prev || {})]);
      lids.forEach(lid => {
        const out = {};
        Object.entries(asRoomObj(prev?.[lid])).forEach(([rk, v]) => { if (keepRooms.has(rk)) out[rk] = v; });
        Object.entries(base[lid] || {}).forEach(([rk, v]) => { if (!keepRooms.has(rk)) out[rk] = v[field]; });
        next[lid] = out;
      });
      return next;
    };
    setKotorQuantities(prev => merge(prev, 'q'));
    setItemNotes(prev => merge(prev, 'n'));
    setPickupRoomSign(fullTx.roomSign || null);
    const filled = new Set();
    (fullTx.details || []).forEach(d => {
      if (d.room_id && (d.qty_kotor > 0 || (d.notes && d.notes.trim() !== ''))) filled.add(String(d.room_id));
    });
    setSavedRooms([...filled]);
  };

  const reloadPickup = async (txId, keepRooms = new Set()) => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/transactions/${txId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (data?.success) applyPickupFromServer(data.data, keepRooms);
    } catch (err) {
      console.error('Error reloading pickup form:', err);
    }
  };

  // Ruangan (pengiriman) yang isinya diubah perangkat ini dibanding data terakhir dari server
  const deliveryDirtyRooms = () => {
    const dirty = new Set();
    (editingTransaction?.details || []).forEach(d => {
      const rk = d.room_id ? String(d.room_id) : 'all';
      const b = bersihQuantities[d.id];
      const k = editKotorQuantities[d.id];
      const n = editItemNotes[d.id];
      const bOld = d.qty_bersih === null || d.qty_bersih === undefined ? null : parseInt(d.qty_bersih);
      const bChanged = b !== undefined && b !== null && b !== '' && parseInt(b) !== bOld;
      const kChanged = k !== undefined && k !== null && k !== '' && parseInt(k) !== (parseInt(d.qty_kotor) || 0);
      const nChanged = typeof n === 'string' && n.trim() !== String(d.notes || '').trim();
      if (bChanged || kChanged || nChanged) dirty.add(rk);
    });
    return [...dirty];
  };

  // Terapkan isi formulir pengiriman dari server; ruangan di keepRooms tetap memakai isian lokal
  const applyDeliveryFromServer = (fullTx, keepRooms = new Set()) => {
    const keep = (d) => keepRooms.has(d.room_id ? String(d.room_id) : 'all');
    setEditingTransaction(fullTx);
    setEditKotorQuantities(prev => {
      const next = {};
      fullTx.details.forEach(d => { next[d.id] = keep(d) && prev[d.id] !== undefined ? prev[d.id] : (d.qty_kotor !== null ? d.qty_kotor : ''); });
      return next;
    });
    setBersihQuantities(prev => {
      const next = {};
      fullTx.details.forEach(d => { next[d.id] = keep(d) && prev[d.id] !== undefined ? prev[d.id] : (d.qty_bersih !== null ? d.qty_bersih : ''); });
      return next;
    });
    setEditItemNotes(prev => {
      const next = {};
      fullTx.details.forEach(d => { next[d.id] = keep(d) && prev[d.id] !== undefined ? prev[d.id] : (d.notes || ''); });
      return next;
    });
  };

  const reloadDelivery = async (txId, keepRooms = new Set()) => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/transactions/${txId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (data?.success) applyDeliveryFromServer(data.data, keepRooms);
    } catch (err) {
      console.error('Error reloading delivery form:', err);
    }
  };

  // Formulir hari ini: saat membuka Form Serah Terima, tawarkan lanjutkan formulir yang ada atau Formulir Baru
  const checkDayForms = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/transactions-day?hospitalId=${hospitalId}&date=${todayLocal()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success && data.data.length) {
        setDayFormsModal({ show: true, mode: 'start', forms: data.data, retry: null });
      }
    } catch (err) {
      console.error('Error loading day forms:', err);
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
      url += `&page=${pg.page}&limit=${pg.pageSize}`;

      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        setTransactions(data.data);
        pg.accept(data.pagination);
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
      const { data } = await axios.get(`/api/ikm/dashboard-data?hospitalId=${hospitalId}&all=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        setLinensList(data.data.linens || []);
        setRoomLinensList(data.data.roomLinens || []);
        if (data.data.hospital?.billing_by_kg != null) {
          setBillingByKg(Number(data.data.hospital.billing_by_kg) || 0);
        }
        if (data.data.hospital?.allow_express != null) {
          setAllowExpress(Number(data.data.hospital.allow_express) || 0);
        }
        if (data.data.hospital) {
          setKgAgreement(data.data.hospital.kg_agreement ?? null);
        }
        // Initialize kotor quantities empty (placeholder until diisi)
        const initialQtys = {};
        const initialNotes = {};
        data.data.linens.forEach(item => {
          initialQtys[item.id] = '';
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
  // roomOnly: simpan isian ruangan saja (selalu sementara, TTD akhir tidak dikirim). Mengembalikan id transaksi.
  // overrideTxId/overrideScope: dipakai saat isian formulir baru digabung ke formulir hari itu yang sudah ada.
  const handleCreatePickup = async (e = null, { roomOnly = false, overrideTxId = null, overrideScope = null, forceNew = false } = {}) => {
    if (e?.preventDefault) e.preventDefault();
    setErrorMsg('');
    const txIdToSave = overrideTxId || temporaryTxId;

    const isTemp = roomOnly || !signatureValetPickup || !signatureHospitalPickup;
    if (!isTemp) {
      if (!hospitalStaffPickup.trim()) {
        setErrorMsg('Nama petugas RS pemeriksa (Pickup) wajib diisi.');
        showAlert('Nama petugas RS pemeriksa (Pickup) wajib diisi.');
        return null;
      }
      if (pendingPickupRooms.length) {
        const msg = `Masih ada unit yang belum TTD pengambilan: ${pendingPickupRooms.map(r => r.name).join(', ')}.`;
        setErrorMsg(msg);
        showAlert(msg, 'TTD Unit Belum Lengkap');
        return null;
      }
    }



    const activeDetails = [];
    Object.entries(kotorQuantities).forEach(([linenId, qtyVal]) => {
      if (qtyVal && typeof qtyVal === 'object') {
        Object.entries(qtyVal).forEach(([roomId, qty]) => {
          const parsedQty = parseInt(qty) || 0;
          if (parsedQty > 0) {
            const rId = roomId === 'all' ? null : parseInt(roomId);
            const notesObj = itemNotes[linenId] || {};
            const noteText = typeof notesObj === 'string' ? notesObj : (notesObj[roomId] || '');
            activeDetails.push({
              hospitalLinenId: parseInt(linenId),
              roomId: rId,
              qtyKotor: parsedQty,
              notes: noteText || null
            });
          }
        });
      } else {
        const parsedQty = parseInt(qtyVal) || 0;
        if (parsedQty > 0) {
          activeDetails.push({
            hospitalLinenId: parseInt(linenId),
            roomId: null,
            qtyKotor: parsedQty,
            notes: typeof itemNotes[linenId] === 'string' ? itemNotes[linenId] : null
          });
        }
      }
    });

    if (activeDetails.length === 0) {
      setErrorMsg('Harap isi jumlah "Kotor" minimal untuk 1 jenis linen.');
      showAlert('Harap isi jumlah "Kotor" minimal untuk 1 jenis linen.');
      return null;
    }

    // Simpan per ruangan: pada formulir yang sudah ada, hanya ruangan yang diubah perangkat ini yang dikirim
    // sebagai lingkup simpan, supaya isian valet lain di formulir yang sama tidak tertimpa.
    const dirtyBefore = pickupDirtyRooms();
    const scopeRoomIds = !txIdToSave ? null
      : overrideScope || (roomOnly ? [selectedRoomId ? String(selectedRoomId) : 'all'] : dirtyBefore);

    setSubmittingNew(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post('/api/ikm/transactions', {
        id: txIdToSave,
        scopeRoomIds,
        roomOnly: !!(txIdToSave && roomOnly),
        forceNew: !txIdToSave && (forceNew || forceNewForm),
        hospitalId: parseInt(hospitalId),
        pickupDate: pickupDate.replace('T', ' ') + ':00',
        userPickup: parseInt(userPickup),
        hospitalStaffPickup,
        hospitalAssistantPickup,
        notes,
        details: activeDetails,
        signatureValetPickup: roomOnly ? null : signatureValetPickup,
        signatureHospitalPickup: roomOnly ? null : signatureHospitalPickup,
        signatureAssistantPickup: roomOnly ? null : signatureAssistantPickup,
        totalKgValet: totalKgValet === '' ? null : Number(totalKgValet),
        isExpress: isExpress ? 1 : 0
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data?.success) {
        setSavedRooms([]);
        setForceNewForm(false);
        if (data.isTemporary) {
          setTemporaryTxId(data.data.transactionId);
          if (!roomOnly) showToast("Berhasil Tersimpan Sementara");
          fetchHistory();
          // Muat ulang isi formulir dari server (termasuk ruangan valet lain); ruangan yang diubah
          // perangkat ini tapi belum ikut tersimpan tetap dipertahankan.
          const saved = new Set((scopeRoomIds || dirtyBefore).map(String));
          await reloadPickup(data.data.transactionId, new Set(dirtyBefore.filter(r => !saved.has(String(r)))));
          return data.data.transactionId;
        } else {
          setTemporaryTxId(null);
          setPickupRoomSign(null);
          setPickupBaseline({});
          setUserPickup(localStorage.getItem('employeeId') || '');
          setUserPickupName(localStorage.getItem('fullName') || localStorage.getItem('username') || '');
          setNotes('');
          setHospitalStaffPickup('');
          setHospitalAssistantPickup('');
          setSignatureValetPickup('');
          setSignatureHospitalPickup('');
          setSignatureAssistantPickup('');
          setTotalKgValet('');
          setIsExpress(false);
          const resetQtys = {};
          const resetNotes = {};
          linensList.forEach(item => {
            resetQtys[item.id] = '';
            resetNotes[item.id] = '';
          });
          setKotorQuantities(resetQtys);
          setItemNotes(resetNotes);
          setErrorMsg('');

          showToast("Transaksi serah terima linen (Kotor) berhasil dicatat");
          fetchHistory();
          setActiveTab('history');
          return data.data.transactionId;
        }
      }
      return null;
    } catch (err) {
      // Sudah ada formulir hari itu yang bisa dilanjutkan: tawarkan gabung ke formulir itu atau buat Formulir Baru
      if (err.response?.status === 409 && err.response?.data?.code === 'OPEN_FORM_EXISTS') {
        setDayFormsModal({ show: true, mode: 'conflict', forms: err.response.data.forms || [], retry: { roomOnly } });
        return null;
      }
      const msg = err.response?.data?.message || 'Gagal menyimpan transaksi.';
      setErrorMsg(msg);
      if (roomOnly) showAlert(msg);
      return null;
    } finally {
      setSubmittingNew(false);
    }
  };

  // Ruangan yang punya isian di formulir ini (dipakai saat isian formulir baru digabung ke formulir yang ada)
  const pickupFilledRooms = () => {
    const rooms = new Set();
    Object.entries(kotorQuantities).forEach(([, q]) => {
      Object.entries(asRoomObj(q)).forEach(([rk, v]) => { if (parseInt(v) > 0) rooms.add(rk); });
    });
    return [...rooms];
  };

  // Pilihan di modal formulir hari ini
  const continueDayForm = async (form) => {
    const retry = dayFormsModal.mode === 'conflict' ? dayFormsModal.retry : null;
    setDayFormsModal(m => ({ ...m, show: false }));
    if (retry) {
      // Isian yang sudah diketik digabung ke formulir yang dipilih (hanya ruangan yang diisi perangkat ini)
      const txId = await handleCreatePickup(null, { roomOnly: retry.roomOnly, overrideTxId: form.id, overrideScope: pickupFilledRooms() });
      if (txId) {
        showToast(`Isian digabung ke formulir ${form.form_number}`);
        await handleOpenEdit({ id: txId });
      }
      return;
    }
    await handleOpenEdit({ id: form.id });
  };

  const startNewDayForm = async () => {
    const retry = dayFormsModal.mode === 'conflict' ? dayFormsModal.retry : null;
    setDayFormsModal(m => ({ ...m, show: false }));
    setForceNewForm(true);
    if (retry) await handleCreatePickup(null, { roomOnly: retry.roomOnly, forceNew: true });
  };

  // Click card to edit / complete delivery
  const handleOpenEdit = async (tx) => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/transactions/${tx.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        setSavedRooms([]);
        const fullTx = data.data;

        // If pickup signatures are missing/empty, it's still in Day 1 kotor pickup phase!
        const hasPickupSignatures = fullTx.transaction.signature_valet_pickup && fullTx.transaction.signature_hospital_pickup;

        if (!hasPickupSignatures) {
          setTemporaryTxId(fullTx.transaction.id);
          setPickupRoomSign(fullTx.roomSign || null);
          setPickupBaseline(buildPickupBaseline(fullTx.details));
          setForceNewForm(false);
          setHospitalStaffPickup(fullTx.transaction.hospital_staff_pickup || '');
          setHospitalAssistantPickup(fullTx.transaction.hospital_assistant_pickup || '');
          setNotes(fullTx.transaction.notes_pickup || '');
          setTotalKgValet(
            fullTx.transaction.total_kg_valet != null && fullTx.transaction.total_kg_valet !== ''
              ? String(fullTx.transaction.total_kg_valet)
              : ''
          );
          setIsExpress(Number(fullTx.transaction.is_express) === 1);

          if (fullTx.transaction.pickup_date) {
            const pDate = new Date(fullTx.transaction.pickup_date);
            setPickupDate(new Date(pDate.getTime() - pDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
          }

          setSignatureValetPickup(fullTx.transaction.signature_valet_pickup || '');
          setSignatureHospitalPickup(fullTx.transaction.signature_hospital_pickup || '');
          setSignatureAssistantPickup(fullTx.transaction.signature_assistant_pickup || '');

          // Map kotor quantities
          const qtys = {};
          const notesMap = {};
          const initiallySavedRooms = new Set();
          
          linensList.forEach(item => {
            qtys[item.id] = {};
            notesMap[item.id] = {};
          });
          
          fullTx.details.forEach(detailItem => {
            const roomIdKey = detailItem.room_id ? detailItem.room_id.toString() : 'all';
            
            if (!qtys[detailItem.hospital_linen_id]) {
              qtys[detailItem.hospital_linen_id] = {};
            }
            qtys[detailItem.hospital_linen_id][roomIdKey] = detailItem.qty_kotor || 0;

            if (!notesMap[detailItem.hospital_linen_id]) {
              notesMap[detailItem.hospital_linen_id] = {};
            }
            notesMap[detailItem.hospital_linen_id][roomIdKey] = detailItem.notes || '';
            
            if (detailItem.room_id && (detailItem.qty_kotor > 0 || (detailItem.notes && detailItem.notes.trim() !== ''))) {
              initiallySavedRooms.add(detailItem.room_id.toString());
            }
          });
          
          setKotorQuantities(qtys);
          setItemNotes(notesMap);
          setSavedRooms(Array.from(initiallySavedRooms));

          setEditingTransaction(null);
          setActiveTab('form');
          setErrorMsg('');
        } else {
          // Normal Day 2 update bersih view
          setEditingTransaction(fullTx);
          // Petugas pengirim default = valet yang sedang login (tetap bisa diganti)
          setUserDelivery(fullTx.transaction.user_delivery || localStorage.getItem('employeeId') || '');
          setUserDeliveryName(fullTx.transaction.user_delivery
            ? (fullTx.transaction.user_delivery_name || '')
            : (localStorage.getItem('fullName') || localStorage.getItem('username') || ''));
          setEditNotes(fullTx.transaction.notes_delivery || '');
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
          setTotalKgValet(
            fullTx.transaction.total_kg_valet != null && fullTx.transaction.total_kg_valet !== ''
              ? String(fullTx.transaction.total_kg_valet)
              : ''
          );
          setIsExpress(Number(fullTx.transaction.is_express) === 1);

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
          const initiallySavedRooms = new Set();
          fullTx.details.forEach(item => {
            initialKotor[item.id] = item.qty_kotor !== null ? item.qty_kotor : '';
            initialBersih[item.id] = item.qty_bersih !== null ? item.qty_bersih : '';
            initialNotes[item.id] = item.notes || '';
            
            if (item.room_id && (item.qty_bersih !== null && item.qty_bersih > 0)) {
              initiallySavedRooms.add(item.room_id.toString());
            }
          });
          setEditKotorQuantities(initialKotor);
          setBersihQuantities(initialBersih);
          setEditItemNotes(initialNotes);
          setSavedRooms(Array.from(initiallySavedRooms));
          setErrorMsg('');
        }
      }
    } catch (err) {
      console.error('Error fetching transaction detail:', err);
    }
  };

  // Submit Day 2 Bersih completion
  // roomOnly: simpan isian ruangan saja (selalu sementara, TTD akhir pengiriman tidak dikirim). Mengembalikan true bila tersimpan.
  const handleCompleteDelivery = async (e = null, { roomOnly = false } = {}) => {
    if (e?.preventDefault) e.preventDefault();
    setErrorMsg('');

    const isTemp = roomOnly || !signatureValetDelivery || !signatureHospitalDelivery;
    if (!isTemp) {
      if (!hospitalStaffDelivery.trim()) {
        setErrorMsg('Nama petugas RS pemeriksa (Delivery) wajib diisi.');
        showAlert('Nama petugas RS pemeriksa (Delivery) wajib diisi.');
        return false;
      }
      if (editingTransaction?.transaction?.status === 'PROSES' && pendingDeliveryRooms.length) {
        const msg = `Masih ada unit yang belum TTD pengiriman bersih: ${pendingDeliveryRooms.map(r => r.room_name).join(', ')}.`;
        setErrorMsg(msg);
        showAlert(msg, 'TTD Unit Belum Lengkap');
        return false;
      }
    }

    // Saat pengiriman bersih: Total Kg wajib jika RS pakai billing per kg
    const hospitalRequiresKg =
      Number(billingByKg) === 1 ||
      Number(editingTransaction?.transaction?.billing_by_kg) === 1;
    if (hospitalRequiresKg) {
      const kgNum = totalKgValet === '' || totalKgValet == null ? NaN : Number(totalKgValet);
      if (Number.isNaN(kgNum) || kgNum < 0) {
        setErrorMsg('Total Kg wajib diisi saat pengiriman bersih.');
        showAlert('Total Kg wajib diisi saat pengiriman bersih.');
        return false;
      }
    }

    setSubmittingEdit(true);

    const activeDetails = editingTransaction.details.map(item => {
      const kotorVal = editKotorQuantities[item.id];
      const bersihVal = bersihQuantities[item.id];
      
      const qtyKotor = kotorVal !== undefined && kotorVal !== '' ? parseInt(kotorVal) : (item.qty_kotor || 0);
      const qtyBersih = bersihVal !== undefined && bersihVal !== '' ? parseInt(bersihVal) : (item.qty_bersih !== null ? item.qty_bersih : null);
      
      return {
        id: item.id,
        qtyKotor,
        qtyBersih,
        notes: editItemNotes[item.id] || ''
      };
    });

    try {
      const token = localStorage.getItem('token');
      // Simpan per ruangan selama PROSES: hanya ruangan yang diubah perangkat ini yang dikirim sebagai lingkup
      const isProses = editingTransaction.transaction.status === 'PROSES';
      const scopeRoomIds = !isProses ? undefined
        : (roomOnly ? [selectedRoomId ? String(selectedRoomId) : 'all'] : deliveryDirtyRooms());
      const { data } = await axios.put(`/api/ikm/transactions/${editingTransaction.transaction.id}`, {
        scopeRoomIds,
        roomOnly: isProses && roomOnly,
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
        signatureValetDelivery: roomOnly ? null : signatureValetDelivery,
        signatureHospitalDelivery: roomOnly ? null : signatureHospitalDelivery,
        signatureAssistantDelivery: roomOnly ? null : signatureAssistantDelivery,
        totalKgValet: totalKgValet === '' ? null : Number(totalKgValet),
        isExpress: isExpress ? 1 : 0
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data?.success) {
        setSavedRooms([]);
        if (data.isTemporary) {
          const { data: detailData } = await axios.get(`/api/ikm/transactions/${editingTransaction.transaction.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (detailData?.success) {
            const fullTx = detailData.data;
            setEditingTransaction(fullTx);
            // Petugas pengirim default = valet yang sedang login (tetap bisa diganti)
          setUserDelivery(fullTx.transaction.user_delivery || localStorage.getItem('employeeId') || '');
            setUserDeliveryName(fullTx.transaction.user_delivery
            ? (fullTx.transaction.user_delivery_name || '')
            : (localStorage.getItem('fullName') || localStorage.getItem('username') || ''));
            setEditNotes(fullTx.transaction.notes_delivery || '');
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
            setTotalKgValet(
              fullTx.transaction.total_kg_valet != null && fullTx.transaction.total_kg_valet !== ''
                ? String(fullTx.transaction.total_kg_valet)
                : ''
            );
            setIsExpress(Number(fullTx.transaction.is_express) === 1);

            const initialKotor = {};
            const initialBersih = {};
            const initialItemNotes = {};
            const initiallySavedRooms = new Set();
            fullTx.details.forEach(item => {
              initialKotor[item.id] = item.qty_kotor;
              initialBersih[item.id] = item.qty_bersih !== null ? item.qty_bersih : '';
              initialItemNotes[item.id] = item.notes || '';
              
              if (item.room_id && (item.qty_bersih !== null && item.qty_bersih > 0)) {
                initiallySavedRooms.add(item.room_id.toString());
              }
            });
            setEditKotorQuantities(initialKotor);
            setBersihQuantities(initialBersih);
            setEditItemNotes(initialItemNotes);
            setSavedRooms(Array.from(initiallySavedRooms));
          }
          if (!roomOnly) showToast("Berhasil Tersimpan Sementara");
          fetchHistory();
        } else {
          setEditingTransaction(null);
          setErrorMsg('');
          fetchHistory();
        }
        return true;
      }
      return false;
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyelesaikan pengiriman.';
      setErrorMsg(msg);
      if (roomOnly) showAlert(msg);
      return false;
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Simpan isian ruangan yang sedang dipilih, lalu (bila diisi) simpan TTD Valet + Perawat Unit ruangan itu
  const handleSaveAndSignRoom = async () => {
    const stage = editingTransaction ? 'delivery' : 'pickup';
    const wantsSign = !!(unitSigNurse || unitSigValet);
    if (wantsSign && (!unitNurseName.trim() || !unitSigNurse || !unitSigValet)) {
      showAlert('Lengkapi nama perawat unit, TTD perawat unit, dan TTD valet untuk ruangan ini.', 'TTD Unit Belum Lengkap');
      return;
    }
    setSigningRoom(true);
    try {
      let txId = null;
      if (stage === 'pickup') {
        txId = await handleCreatePickup(null, { roomOnly: true });
      } else if (await handleCompleteDelivery(null, { roomOnly: true })) {
        txId = editingTransaction.transaction.id;
      }
      if (!txId) return;
      if (!wantsSign) {
        showToast('Ruangan tersimpan. TTD unit belum diisi.');
        return;
      }
      const token = localStorage.getItem('token');
      const { data } = await axios.put(`/api/ikm/transactions/${txId}/rooms/${selectedRoomId}/sign`, {
        stage,
        nurseName: unitNurseName,
        signatureNurse: unitSigNurse,
        signatureValet: unitSigValet,
        // Petugas IKM ruangan ini (bisa berbeda per ruangan)
        valetId: parseInt(stage === 'pickup' ? userPickup : userDelivery) || null
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (data?.success) {
        showToast(data.message || 'TTD unit tersimpan');
        await refreshRoomSign(txId, stage);
        setUnitSigNurse('');
        setUnitSigValet('');
        setUnitSigKey(k => k + 1);
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Gagal menyimpan TTD unit.');
    } finally {
      setSigningRoom(false);
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

  // Filtered linen lists for table search and selected room
  const filteredLinensList = linensList.filter(item => {
    const matchSearch = linenSearch.trim() === '' ||
      getLinenDisplayName(item).toLowerCase().includes(linenSearch.toLowerCase());
    
    if (selectedRoomId) {
      const existsInRoom = roomLinensList.some(rl => 
        rl.hospital_linen_id === item.id && rl.room_id === parseInt(selectedRoomId)
      );
      return matchSearch && existsInRoom;
    }
    return matchSearch;
  });

  const filteredEditDetails = (() => {
    if (!editingTransaction) return [];
    
    const baseFiltered = editingTransaction.details.filter(item => {
      return editLinenSearch.trim() === '' ||
        getLinenDisplayName(item).toLowerCase().includes(editLinenSearch.toLowerCase());
    });

    if (selectedRoomId) {
      return baseFiltered.filter(item => item.room_id === parseInt(selectedRoomId));
    } else {
      const grouped = {};
      baseFiltered.forEach(item => {
        const lid = item.hospital_linen_id;
        if (!grouped[lid]) {
          grouped[lid] = {
            ...item,
            id: `grouped_${lid}`,
            qty_kotor: 0,
            qty_bersih: 0,
            room_id: null,
            room_name: null,
            notes: [],
            isGrouped: true,
            originalItemIds: []
          };
        }
        grouped[lid].qty_kotor += parseInt(item.qty_kotor || 0);
        if (item.qty_bersih !== null && item.qty_bersih !== undefined) {
          grouped[lid].qty_bersih += parseInt(item.qty_bersih || 0);
        }
        if (item.notes && item.notes.trim() !== '') {
          grouped[lid].notes.push(item.notes.trim());
        }
        grouped[lid].originalItemIds.push(item.id);
      });
      return Object.values(grouped).map(group => ({
        ...group,
        notes: group.notes.join('; ')
      }));
    }
  })();

  const isEditable = (() => {
    if (!editingTransaction) return false;
    
    // Lock completely if delivery signatures are present
    const hasDeliverySignatures = editingTransaction.transaction.signature_valet_delivery && editingTransaction.transaction.signature_hospital_delivery;
    if (hasDeliverySignatures) {
      return false;
    }
    
    return editingTransaction.transaction.status === 'PROSES' || editingTransaction.transaction.is_editable;
  })();

  // Kg / Express: editable only while PROSES; locked after SELESAI (Alsa-only)
  const isKgExpressEditable = editingTransaction
    ? editingTransaction.transaction.status === 'PROSES'
    : true;

  const showKgFields = (() => {
    const tx = editingTransaction?.transaction;
    const hasExisting =
      (tx?.total_kg_valet != null && tx.total_kg_valet !== '') ||
      (totalKgValet !== '' && totalKgValet != null);
    return Number(billingByKg) === 1 || Number(tx?.billing_by_kg) === 1 || hasExisting;
  })();

  const showExpressField = (() => {
    const tx = editingTransaction?.transaction;
    const hasExisting = Number(tx?.is_express) === 1 || isExpress;
    return Number(allowExpress) === 1 || Number(tx?.allow_express) === 1 || hasExisting;
  })();

  const showKgExpressFields = showKgFields || showExpressField;

  // Kg ditagihkan = kg valet + kg perjanjian RS; kosong selama kg valet belum diisi
  const kgAgreementValue = (() => {
    const raw = editingTransaction?.transaction?.kg_agreement ?? kgAgreement;
    const n = raw === '' || raw == null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  })();
  const kgTotalPreview = (() => {
    const n = totalKgValet === '' || totalKgValet == null ? NaN : Number(totalKgValet);
    return Number.isFinite(n) ? n + (kgAgreementValue ?? 0) : null;
  })();
  const formatKg = (n) => `${Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Kg`;
  const kgSummary = (
    <div className="grid grid-cols-2 gap-2 pt-1">
      <div className="px-3 py-2 rounded-lg bg-white border border-slate-200">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Kg Perjanjian</p>
        <p className="text-xs font-semibold text-slate-700">{kgAgreementValue != null ? formatKg(kgAgreementValue) : 'Tidak ada'}</p>
      </div>
      <div className="px-3 py-2 rounded-lg bg-white border border-[#126776]/20">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Kg Ditagihkan</p>
        <p className="text-xs font-bold text-[#126776]">{kgTotalPreview != null ? formatKg(kgTotalPreview) : '—'}</p>
      </div>
    </div>
  );

  const getLinenNameById = (hospitalLinenId) => {
    const detail = editingTransaction?.details?.find(d => d.hospital_linen_id === hospitalLinenId);
    return detail ? getLinenDisplayName(detail) : `Linen #${hospitalLinenId}`;
  };

  const formatAuditTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
    const dateFormatted = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${dayName}, ${dateFormatted}, ${hours}:${minutes} WIB`;
  };

  const generateAuditLogDescriptions = (audit) => {
    const descriptions = [];
    if (!audit.old_values || !audit.new_values) {
      if (audit.action === 'CREATE' || audit.action === 'PICKUP_KOTOR') {
        descriptions.push("Membuat transaksi kotor");
      } else if (audit.action === 'ADMIN') {
        descriptions.push("Melakukan perubahan admin");
      } else if (audit.action === 'RUMAH_SAKIT') {
        descriptions.push("Rumah Sakit memperbarui data transaksi");
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

    const oldTx = oldSnap.transaction || oldSnap.header || {};
    const newTx = newSnap.transaction || newSnap.header || {};

    if (oldTx.notes_pickup !== newTx.notes_pickup) {
      descriptions.push(`Catatan pickup: "${oldTx.notes_pickup || '—'}" menjadi "${newTx.notes_pickup || '—'}"`);
    }
    if (oldTx.notes_delivery !== newTx.notes_delivery) {
      descriptions.push(`Catatan delivery: "${oldTx.notes_delivery || '—'}" menjadi "${newTx.notes_delivery || '—'}"`);
    }
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

    // Check for updated details
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

    // Check for deleted details
    oldDetails.forEach(oldItem => {
      const newItem = newDetails.find(n => n.id === oldItem.id);
      if (!newItem) {
        const name = getLinenNameById(oldItem.hospital_linen_id);
        descriptions.push(`Menghapus linen ${name} (sebelumnya ${oldItem.qty_kotor || 0} Pcs kotor)`);
      }
    });

    if (descriptions.length === 0) {
      descriptions.push("Melakukan pembaruan data transaksi");
    }

    return descriptions;
  };

  // Get unique rooms from roomLinensList
  const uniqueRooms = [];
  const roomMap = new Map();
  roomLinensList.forEach(rl => {
    if (rl.room_id && !roomMap.has(rl.room_id)) {
      roomMap.set(rl.room_id, rl.room_name);
      uniqueRooms.push({ id: rl.room_id, name: rl.room_name });
    }
  });

  // ── TTD per unit ──
  const gudangRoomIds = new Set(roomLinensList.filter(rl => Number(rl.is_gudang_linen) === 1).map(rl => String(rl.room_id)));
  const roomSignOf = (state, roomId) => state?.rooms?.find(r => String(r.room_id) === String(roomId));
  // TTD unit ruangan terpilih yang sudah lengkap (terkunci) → isian petugas menampilkan valet ruangan itu
  const lockedRoomSign = (stage) => {
    const state = stage === 'pickup' ? pickupRoomSign : editingTransaction?.roomSign;
    const s = selectedRoomId ? roomSignOf(state, selectedRoomId)?.[stage] : null;
    return s?.complete ? s : null;
  };
  const renderLockedValetField = (sign) => (
    <div>
      <div className="w-full min-h-[38px] pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-not-allowed relative">
        <User className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
        <span className="flex-1">{toTitleCase(sign.valet_name || '') || '—'}</span>
        <Lock className="h-3.5 w-3.5 text-slate-400" />
      </div>
      <p className="text-[10px] text-slate-400 mt-1">Petugas yang TTD ruangan ini. Untuk mengganti, tekan Edit Ruangan Ini.</p>
    </div>
  );
  // Formulir baru mengikuti saklar RS; formulir yang sudah tersimpan mengikuti penanda di transaksinya
  const pickupUnitSignMode = pickupRoomSign
    ? !!pickupRoomSign.required
    : Number(requireUnitSignature) === 1 && uniqueRooms.some(r => !gudangRoomIds.has(String(r.id)));
  const deliveryUnitSignMode = !!editingTransaction?.roomSign?.required;
  // Ruangan yang menurunkan kotor menurut isian form saat ini
  const pickupKotorRoomIds = new Set();
  Object.values(kotorQuantities).forEach(q => {
    if (q && typeof q === 'object') {
      Object.entries(q).forEach(([rid, v]) => { if (rid !== 'all' && parseInt(v) > 0) pickupKotorRoomIds.add(String(rid)); });
    }
  });
  const pendingPickupRooms = pickupUnitSignMode
    ? uniqueRooms.filter(r => pickupKotorRoomIds.has(String(r.id)) && !gudangRoomIds.has(String(r.id))
        && !roomSignOf(pickupRoomSign, r.id)?.pickup?.complete)
    : [];
  const pendingDeliveryRooms = deliveryUnitSignMode
    ? editingTransaction.roomSign.rooms.filter(r => r.required && !r.delivery?.complete)
    : [];
  const selectedRoomNeedsSign = !!selectedRoomId && !gudangRoomIds.has(String(selectedRoomId));
  // Ruangan yang sudah TTD Valet + Perawat Unit terkunci; dibuka lewat tombol Edit (TTD dihapus, wajib TTD ulang)
  const pickupRoomLocked = pickupUnitSignMode && selectedRoomNeedsSign
    && !!roomSignOf(pickupRoomSign, selectedRoomId)?.pickup?.complete;
  const isDeliveryRoomLocked = (roomId) => deliveryUnitSignMode && editingTransaction?.transaction?.status === 'PROSES'
    && !!roomSignOf(editingTransaction.roomSign, roomId)?.delivery?.complete;
  const deliveryRoomLocked = selectedRoomNeedsSign && isDeliveryRoomLocked(selectedRoomId);

  // Ganti ruangan: kosongkan kanvas TTD unit dan isi nama perawat (TTD sebelumnya atau akun perawat ruangan itu)
  useEffect(() => {
    if (!selectedRoomId) return;
    const stage = editingTransaction ? 'delivery' : 'pickup';
    const state = editingTransaction ? editingTransaction.roomSign : pickupRoomSign;
    const prevName = roomSignOf(state, selectedRoomId)?.[stage]?.nurse_name
      || (stage === 'delivery' ? roomSignOf(state, selectedRoomId)?.pickup?.nurse_name : null);
    setUnitNurseName(prevName || roomNurses[String(selectedRoomId)]?.[0] || '');
    setUnitSigNurse('');
    setUnitSigValet('');
    setUnitSigKey(k => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId, editingTransaction?.transaction?.id, roomNurses]);

  // Form Pengambilan: ruangan yang punya linen kotor belum diambil (terpakai + dirty utility)
  const pickupRoomStatus = {};
  roomLinensList.forEach(rl => {
    const cur = pickupRoomStatus[rl.room_id] || { kotor: 0, cuci: 0 };
    cur.kotor += (parseInt(rl.qty_dirty) || 0) + (parseInt(rl.qty_terpakai) || 0);
    pickupRoomStatus[rl.room_id] = cur;
  });
  if (pickupUnitSignMode) {
    uniqueRooms.forEach(r => {
      if (!pickupKotorRoomIds.has(String(r.id)) || gudangRoomIds.has(String(r.id))) return;
      const cur = pickupRoomStatus[r.id] || { kotor: 0, cuci: 0 };
      cur.ttd = roomSignOf(pickupRoomSign, r.id)?.pickup?.complete ? 'done' : 'pending';
      pickupRoomStatus[r.id] = cur;
    });
  }

  // Form Pengiriman: hanya ruangan di transaksi yang sedang dibuka, sebesar total linen kotornya.
  // Badge tetap tampil walau sudah dikirim bersih / transaksi SELESAI.
  const deliveryRoomStatus = {};
  if (editingTransaction) {
    editingTransaction.details.forEach(d => {
      if (!d.room_id) return;
      const kotor = parseInt(d.qty_kotor) || 0;
      if (kotor > 0) {
        const cur = deliveryRoomStatus[d.room_id] || { kotor: 0, cuci: 0 };
        cur.cuci += kotor;
        deliveryRoomStatus[d.room_id] = cur;
      }
    });
    if (deliveryUnitSignMode) {
      editingTransaction.roomSign.rooms.forEach(r => {
        if (!r.required) return;
        const cur = deliveryRoomStatus[r.room_id] || { kotor: 0, cuci: 0 };
        cur.ttd = r.delivery?.complete ? 'done' : 'pending';
        deliveryRoomStatus[r.room_id] = cur;
      });
    }
  }

  // Ringkasan TTD unit per ruangan (dipakai di tampilan "Semua Ruangan")
  const renderUnitSignSummary = (state, stage, pendingNames) => {
    const rooms = (state?.rooms || []).filter(r => r.required);
    const localPending = pendingNames.filter(n => !rooms.some(r => r.room_name === n));
    if (!rooms.length && !localPending.length) return null;
    return (
      <div className={`p-4 rounded-2xl border space-y-3 ${pendingNames.length ? 'bg-amber-50/60 border-amber-200' : 'bg-emerald-50/60 border-emerald-200'}`}>
        <div className="flex items-start gap-2">
          {pendingNames.length
            ? <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            : <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />}
          <p className={`text-xs font-semibold ${pendingNames.length ? 'text-amber-800' : 'text-emerald-800'}`}>
            {pendingNames.length
              ? `${pendingNames.length} unit belum TTD ${stage === 'pickup' ? 'pengambilan' : 'pengiriman'}: ${pendingNames.join(', ')}. Pilih ruangannya di atas untuk TTD. TTD Tim Linen RS baru bisa disimpan setelah semua unit TTD.`
              : `Semua unit sudah TTD ${stage === 'pickup' ? 'pengambilan' : 'pengiriman'}. Lanjutkan TTD Tim Linen RS dan Valet di bawah.`}
          </p>
        </div>
        {(() => {
          // Kelompokkan per Petugas IKM (valet) yang TTD ruangan itu; urut sesuai waktu TTD pertama
          const signed = rooms.filter(r => r[stage]?.complete)
            .sort((a, b) => String(a[stage].signed_at || '').localeCompare(String(b[stage].signed_at || '')));
          const groups = new Map();
          signed.forEach(r => {
            const key = r[stage].valet_name || 'Petugas IKM tidak tercatat';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(r);
          });
          const pendingRooms = rooms.filter(r => !r[stage]?.complete);
          const chipDone = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200';
          const chipPending = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-200';
          return (
            <div className="space-y-2.5">
              {[...groups.entries()].map(([valet, list]) => (
                <div key={valet} className="space-y-1">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                    <User className="h-3.5 w-3.5 text-slate-400" /> {toTitleCase(valet)}
                    <span className="font-semibold text-slate-400">· {list.length} unit</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map(r => (
                      <span key={r.room_id} title={`TTD: ${r[stage].nurse_name}`} className={chipDone}>
                        ✓ {r.room_name}{r[stage].nurse_name ? ` · ${r[stage].nurse_name}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {(pendingRooms.length > 0 || localPending.length > 0) && (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-rose-700">Belum TTD</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pendingRooms.map(r => (
                      <span key={r.room_id} title="Belum TTD" className={chipPending}>• {r.room_name}</span>
                    ))}
                    {localPending.map(n => (
                      <span key={n} className={chipPending}>• {n} (belum disimpan)</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // Panel TTD Valet + Perawat Unit untuk ruangan yang sedang dipilih
  const renderUnitSignPanel = (stage) => {
    const state = stage === 'pickup' ? pickupRoomSign : editingTransaction?.roomSign;
    const roomName = uniqueRooms.find(r => String(r.id) === String(selectedRoomId))?.name || '';
    const existing = roomSignOf(state, selectedRoomId)?.[stage];
    const nurses = roomNurses[String(selectedRoomId)] || [];
    const valetName = stage === 'pickup' ? userPickupName : userDeliveryName;
    const fmtTime = (v) => (v ? new Date(v).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
    return (
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-[#126776]/5 text-[#126776] rounded-md">
              <FileText className="h-4 w-4" />
            </div>
            <label className="block text-xs font-semibold text-[#126776] uppercase tracking-widest">
              TTD Serah Terima Unit {stage === 'pickup' ? '(Pickup Kotor)' : '(Delivery Bersih)'} — {roomName}
            </label>
          </div>
          {existing?.complete ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" /> Sudah TTD
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              Belum TTD
            </span>
          )}
        </div>

        {existing?.complete && (
          <div className="grid grid-cols-2 gap-3">
            {[['Valet', existing.signature_valet, existing.valet_name], ['Perawat Unit', existing.signature_nurse, existing.nurse_name]].map(([label, src, nm]) => (
              <div key={label} className="flex flex-col items-center p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</span>
                {src ? <img src={src} alt={label} className="max-h-[60px] object-contain" /> : <span className="text-xs text-slate-400">—</span>}
                {nm && <span className="text-[11px] font-bold text-[#126776] mt-1">({toTitleCase(nm)})</span>}
              </div>
            ))}
            <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-100/70 border border-slate-200">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <Lock className="h-3.5 w-3.5 text-slate-500" />
                Ruangan terkunci — ditandatangani {fmtTime(existing.signed_at)}.
              </p>
              <button
                type="button"
                onClick={() => handleUnlockRoom(stage)}
                disabled={signingRoom}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold transition cursor-pointer disabled:opacity-60"
              >
                <Unlock className="h-3.5 w-3.5" /> Edit Ruangan Ini
              </button>
            </div>
          </div>
        )}

        {!existing?.complete && (<>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Nama Perawat Unit <span className="text-rose-500 font-bold">*</span>
          </label>
          <div className="relative">
            <User className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
            <input
              type="text"
              list={`unit-nurses-${selectedRoomId}`}
              placeholder="Nama perawat penanggung jawab unit..."
              value={unitNurseName}
              onChange={e => setUnitNurseName(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition"
            />
            <datalist id={`unit-nurses-${selectedRoomId}`}>
              {nurses.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
          {nurses.length > 0 && (
            <p className="text-[10px] text-slate-400">Terisi otomatis dari akun perawat unit ini; boleh diubah.</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SignatureInput
            key={`unit-valet-${unitSigKey}`}
            title="Tanda Tangan Petugas IKM (Valet)"
            value={unitSigValet}
            onChange={setUnitSigValet}
            isEditable={true}
            name={valetName}
          />
          <SignatureInput
            key={`unit-nurse-${unitSigKey}`}
            title="Tanda Tangan Perawat Unit"
            value={unitSigNurse}
            onChange={setUnitSigNurse}
            isEditable={true}
            name={unitNurseName}
          />
        </div>
        <p className="text-[11px] text-slate-500">
          Jumlah {stage === 'pickup' ? 'kotor' : 'bersih'} ruangan ini ikut tersimpan saat menekan <b>Simpan &amp; TTD Ruangan Ini</b>.
          Setelah TTD, ruangan ini terkunci; perubahan harus lewat tombol Edit dan wajib TTD ulang.
        </p>
        </>)}
      </div>
    );
  };

  // Edit ruangan yang sudah TTD: hapus TTD unit di server (termasuk file), ruangan terbuka dan wajib TTD ulang
  const handleUnlockRoom = (stage) => {
    const roomName = uniqueRooms.find(r => String(r.id) === String(selectedRoomId))?.name || 'ini';
    setConfirmConfig({
      show: true,
      title: `Edit Ruangan ${roomName}?`,
      message: 'TTD Valet dan Perawat Unit yang sudah ada akan dihapus, dan ruangan ini wajib TTD ulang setelah diubah.',
      confirmLabel: 'Ya, Edit Ruangan',
      onConfirm: () => unlockRoom(stage)
    });
  };

  const unlockRoom = async (stage) => {
    const txId = stage === 'pickup' ? temporaryTxId : editingTransaction?.transaction?.id;
    if (!txId) return;
    setSigningRoom(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.delete(`/api/ikm/transactions/${txId}/rooms/${selectedRoomId}/sign?stage=${stage}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        if (stage === 'pickup') setPickupRoomSign(data.data);
        else setEditingTransaction(prev => (prev ? { ...prev, roomSign: data.data } : prev));
        setUnitSigNurse('');
        setUnitSigValet('');
        setUnitSigKey(k => k + 1);
        showToast(data.message || 'Ruangan dibuka untuk diedit');
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Gagal membuka ruangan untuk diedit.');
    } finally {
      setSigningRoom(false);
    }
  };

  // Real-time: valet lain menyimpan ruangan di formulir yang sedang dibuka → muat ulang ruangan lain,
  // isian yang sedang diubah di perangkat ini tidak ditimpa.
  const liveRef = useRef({});
  liveRef.current = {
    activeTab,
    temporaryTxId,
    editingTxId: editingTransaction?.transaction?.id,
    editingStatus: editingTransaction?.transaction?.status,
    pickupDirtyRooms, deliveryDirtyRooms, reloadPickup, reloadDelivery, fetchHistory
  };
  useEffect(() => {
    if (!hospitalId) return undefined;
    socket.connect();
    socket.emit('join_hospital', hospitalId);
    let timer = null;
    const onChange = (evt) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const L = liveRef.current;
        const txId = Number(evt?.transactionId);
        if (L.activeTab === 'form' && !L.editingTxId && L.temporaryTxId && txId === Number(L.temporaryTxId)) {
          L.reloadPickup(L.temporaryTxId, new Set(L.pickupDirtyRooms()));
        } else if (L.editingTxId && txId === Number(L.editingTxId) && L.editingStatus === 'PROSES') {
          L.reloadDelivery(L.editingTxId, new Set(L.deliveryDirtyRooms()));
        } else if (L.activeTab === 'history' && !L.editingTxId) {
          L.fetchHistory();
        }
      }, 700);
    };
    socket.on('data_changed', onChange);
    return () => {
      clearTimeout(timer);
      socket.off('data_changed', onChange);
      socket.disconnect();
    };
  }, [hospitalId]);

  return (
    <div className="min-h-screen bg-slate-50 py-6 sm:py-10">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Header Banner Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
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
              onClick={() => {
                setActiveTab('form');
                setEditingTransaction(null);
                setTemporaryTxId(null);
                setPickupRoomSign(null);
                setPickupBaseline({});
                setForceNewForm(false);
                checkDayForms();
                setSavedRooms([]);
                setNotes('');
                setHospitalStaffPickup('');
                setHospitalAssistantPickup('');
                setSignatureValetPickup('');
                setSignatureHospitalPickup('');
                setSignatureAssistantPickup('');
                setTotalKgValet('');
                setIsExpress(false);
                const resetQtys = {};
                const resetNotes = {};
                linensList.forEach(item => {
                  resetQtys[item.id] = '';
                  resetNotes[item.id] = '';
                });
                setKotorQuantities(resetQtys);
                setItemNotes(resetNotes);
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
                    onChange={e => { setSearchQuery(e.target.value); pg.resetPage(); }}
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
                      onChange={e => { setStartDate(e.target.value); pg.resetPage(); }}
                      className="bg-transparent border-none text-slate-700 outline-none w-28 text-center cursor-pointer font-medium"
                    />
                    <span className="text-slate-400 font-semibold">s/d</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => { setEndDate(e.target.value); pg.resetPage(); }}
                      className="bg-transparent border-none text-slate-700 outline-none w-28 text-center cursor-pointer font-medium"
                    />
                  </div>

                  {/* Custom Styled Select Dropdown */}
                  <div className="relative">
                    <select
                      value={filterStatus}
                      onChange={e => { setFilterStatus(e.target.value); pg.resetPage(); }}
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
                      onClick={() => { setSearchQuery(''); setStartDate(''); setEndDate(''); setFilterStatus('all'); pg.resetPage(); }}
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
                        {(tx.total_kg_valet != null || Number(tx.is_express) === 1) && (
                          <p className="text-[10px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                            {tx.total_kg_valet != null && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-semibold">
                                {Number(tx.total_kg_valet).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Kg
                              </span>
                            )}
                            {tx.kg_total != null && tx.kg_agreement != null && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#126776]/5 text-[#126776] border border-[#126776]/20 font-semibold">
                                Ditagih {Number(tx.kg_total).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Kg
                              </span>
                            )}
                            {Number(tx.is_express) === 1 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold uppercase tracking-wider">
                                Express
                              </span>
                            )}
                          </p>
                        )}
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
            {!loadingHistory && (
              <Pagination pagination={pg.pagination} shown={transactions.length} pageSize={pg.pageSize} onChange={pg.goTo} onPageSizeChange={pg.setPageSize} />
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
                      {lockedRoomSign('pickup') ? renderLockedValetField(lockedRoomSign('pickup')) : (
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
                      )}
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
                        Petugas RS <span className="text-rose-500 font-bold">*</span>
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

                    {/* Perawat RS (Pickup) — diganti TTD Perawat Unit per ruangan bila RS memakai TTD per unit */}
                    {pickupUnitSignMode ? (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                          Perawat RS
                        </label>
                        <div className="w-full flex items-center gap-2 px-3.5 py-2.5 bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500">
                          <Info className="h-4 w-4 text-[#1ea59e] shrink-0" />
                          <span className="truncate">TTD per unit / ruangan</span>
                        </div>
                      </div>
                    ) : (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                        Perawat RS
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
                    )}
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

                {/* Search bar & Room Selector above linen table */}
                <div className="flex flex-col sm:flex-row gap-3 p-3 border-b border-slate-100 bg-slate-50/70">
                  {/* Room Selector */}
                  <RoomStatusSelect value={selectedRoomId} onChange={setSelectedRoomId} rooms={uniqueRooms} roomStatus={pickupRoomStatus} />

                  {/* Search bar */}
                  <div className="relative flex-1">
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
                        className="absolute inset-y-0 right-3 my-auto text-slate-400 hover:text-slate-650 text-base leading-none cursor-pointer"
                      >✕</button>
                    )}
                  </div>
                </div>

                <div className="max-h-[75vh] overflow-auto">
                  <table className="w-full text-left text-sm border-separate border-spacing-0 min-w-[500px]">
                    <thead className="sticky top-0 z-10 [&_th]:sticky [&_th]:top-0 [&_th]:bg-slate-50">
                      <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider text-xs border-b border-slate-150 shadow-[0_1px_0_#e2e8f0]">
                        <th className="py-3.5 px-4 w-12 text-center">No</th>
                        <th className="py-3.5 px-4">Nama Linen</th>
                        <th className="py-3.5 px-4 text-center">Kepemilikan</th>
                        <th className="py-3.5 px-4 text-center">Ruangan</th>
                        <th className="py-3.5 px-4 w-28 text-center">Kotor</th>
                        <th className="py-3.5 px-4 text-center">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {loadingLinens ? (
                        <tr>
                          <td colSpan="6" className="py-16 text-center text-slate-400 font-bold">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto text-[#126776] mb-2" />
                            Memuat data linen...
                          </td>
                        </tr>
                      ) : filteredLinensList.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-16 text-center text-slate-400 font-semibold">
                            {linenSearch ? `Tidak ada linen yang cocok dengan "${linenSearch}"` : 'Belum ada master linen terdaftar untuk rumah sakit ini.'}
                          </td>
                        </tr>
                      ) : (
                        filteredLinensList.map((item, index) => {
                          const isFilled = (kotorQuantities[item.id] || 0) > 0;
                          const roomInfo = getRoomAndStockInfo(item.id);
                          const isRoomLocked = selectedRoomId && savedRooms.includes(selectedRoomId.toString());
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
                              <td className="py-3 px-4 text-center">
                                <OwnershipBadge type={item.ownership_type} />
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-650 border border-slate-200">
                                  {roomInfo.roomName}
                                </span>
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex items-center justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={getKotorQty(item.id)}
                                    onChange={e => handleKotorQtyChange(item.id, e.target.value)}
                                    disabled={pickupRoomLocked}
                                    className="w-16 text-center py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white transition text-slate-900 placeholder:text-slate-300 placeholder:font-medium disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                  />
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  placeholder="Catatan item..."
                                  value={getNoteVal(item.id)}
                                  onChange={e => handleNoteValChange(item.id, e.target.value)}
                                  disabled={pickupRoomLocked}
                                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
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

              {showKgExpressFields && (
                <div className={`grid grid-cols-1 gap-4 ${showKgFields && showExpressField ? 'sm:grid-cols-2' : ''}`}>
                  {showKgFields && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-[#126776]/5 text-[#126776] rounded-md">
                          <Scale className="h-4 w-4" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#126776] uppercase tracking-widest">
                            Total Kilogram
                          </label>
                          <p className="text-[10px] text-slate-400 mt-0.5">Opsional saat pengambilan kotor</p>
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={totalKgValet}
                          onChange={e => setTotalKgValet(e.target.value)}
                          className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition-all"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase tracking-wider">Kg</span>
                      </div>
                      {kgSummary}
                    </div>
                  )}
                  {showExpressField && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-amber-500/10 text-amber-600 rounded-md">
                          <Zap className="h-4 w-4" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-amber-700 uppercase tracking-widest">
                            Layanan Express
                          </label>
                          <p className="text-[10px] text-slate-400 mt-0.5">Terpisah dari pencatatan kilogram</p>
                        </div>
                      </div>
                      {temporaryTxId && (
                        <p className="text-[10px] text-slate-500">
                          Jenis express ditetapkan saat formulir dibuat. Untuk linen express, buat <b>Formulir Baru</b> khusus express.
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={!!temporaryTxId}
                        onClick={() => !temporaryTxId && setIsExpress(prev => !prev)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${
                          isExpress
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-xs font-semibold">
                          {isExpress ? 'Express aktif' : 'Tidak express'}
                        </span>
                        <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${isExpress ? 'bg-amber-500' : 'bg-slate-200'}`}>
                          <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition ${isExpress ? 'translate-x-4' : ''}`} />
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TTD per unit: panel ruangan terpilih, atau ringkasan saat Semua Ruangan */}
              {pickupUnitSignMode && selectedRoomNeedsSign && renderUnitSignPanel('pickup')}
              {pickupUnitSignMode && !selectedRoomId && renderUnitSignSummary(pickupRoomSign, 'pickup', pendingPickupRooms.map(r => r.name))}

              {/* Tanda Tangan Section */}
              {!(pickupUnitSignMode && selectedRoomId) && (
              <div className={`bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-4 ${pickupUnitSignMode && pendingPickupRooms.length ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-[#126776]/5 text-[#126776] rounded-md">
                    <FileText className="h-4 w-4" />
                  </div>
                  <label className="block text-xs font-semibold text-[#126776] uppercase tracking-widest">
                    {pickupUnitSignMode ? 'TTD Akhir Tim Linen RS & Valet (Pickup)' : 'Dokumentasi Tanda Tangan Serah Terima (Pickup)'}
                  </label>
                </div>
                <div className={`grid grid-cols-1 gap-5 ${hospitalAssistantPickup.trim() || signatureAssistantPickup ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
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
                  {(hospitalAssistantPickup.trim() || signatureAssistantPickup) && (
                    <SignatureInput
                      title="Tanda Tangan Perawat RS (Opsional)"
                      value={signatureAssistantPickup}
                      onChange={setSignatureAssistantPickup}
                      isEditable={true}
                      name={hospitalAssistantPickup}
                    />
                  )}
                </div>
              </div>
              )}

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setActiveTab('history'); setErrorMsg(''); setSavedRooms([]); }}
                  className="px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer"
                >
                  Batal
                </button>
                {selectedRoomId && pickupUnitSignMode && selectedRoomNeedsSign ? (
                  <button
                    type="button"
                    onClick={handleSaveAndSignRoom}
                    disabled={signingRoom || submittingNew || pickupRoomLocked}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#126776] to-[#1ea59e] hover:from-[#0e5562] hover:to-[#188b85] text-white rounded-xl text-xs font-semibold shadow-md shadow-[#126776]/10 active:scale-95 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed animate-[fadeIn_0.2s_ease-out]"
                  >
                    {pickupRoomLocked
                      ? <><Lock className="h-4 w-4" /> Ruangan Terkunci</>
                      : signingRoom
                      ? <><RefreshCw className="h-4 w-4 animate-spin" /> Menyimpan...</>
                      : <><Save className="h-4 w-4" /> Simpan &amp; TTD Ruangan Ini</>}
                  </button>
                ) : selectedRoomId ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleCreatePickup();
                    }}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-500/10 active:scale-95 transition cursor-pointer flex items-center gap-1.5 animate-[fadeIn_0.2s_ease-out]"
                  >
                    <Save className="h-4 w-4" /> Simpan Sementara Ruangan Ini
                  </button>
                ) : (
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
                )}
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

              {/* Pengambilan Section */}
              <div className="flex rounded-2xl border border-slate-150 bg-slate-50/50 min-h-[130px]">
                <div className="bg-[#678083] text-white flex items-center justify-center px-4 font-bold text-[10px] uppercase select-none tracking-widest shrink-0 [writing-mode:vertical-lr] rotate-180 rounded-r-2xl">
                  Pengambilan
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 p-5 text-xs items-center">
                  <div className="space-y-1">
                    <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider block">Petugas</span>
                    <span className="font-semibold text-slate-700 block text-sm">
                      {toTitleCase(editingTransaction.transaction.user_pickup_name)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider block">Petugas RS</span>
                    <span className="font-semibold text-slate-700 block text-sm">
                      {editingTransaction.transaction.hospital_staff_pickup || '—'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider block">Perawat RS</span>
                    <span className="font-semibold text-slate-700 block text-sm">
                      {editingTransaction.transaction.hospital_assistant_pickup || '—'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider block">Tanggal</span>
                    <span className="font-semibold text-slate-700 block text-xs">{formatDate(editingTransaction.transaction.pickup_date)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-semibold uppercase text-xs tracking-wider block">Catatan</span>
                    <span className="font-medium text-slate-500 block italic text-xs truncate" title={editingTransaction.transaction.notes_pickup || ''}>
                      {editingTransaction.transaction.notes_pickup || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pengiriman Section */}
              <div className="flex rounded-2xl border border-slate-150 bg-slate-50/50 min-h-[130px]">
                <div className="bg-[#126776] text-white flex items-center justify-center px-4 font-bold text-[10px] uppercase select-none tracking-widest shrink-0 [writing-mode:vertical-lr] rotate-180 rounded-r-2xl">
                  Pengiriman
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 p-5 items-start">

                  {/* Delivery Complete Recorder */}
                  <div className="space-y-1.5" ref={editEmployeeSelectRef}>
                    <label className="flex items-center h-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">
                      Petugas
                    </label>
                    <div className="relative">
                      {isEditable && lockedRoomSign('delivery') ? renderLockedValetField(lockedRoomSign('delivery')) : !isEditable ? (
                        <div className="w-full h-10 pl-10 pr-4 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-not-allowed">
                          <User className="h-4 w-4 text-slate-400" />
                          <span>
                            {toTitleCase(userDeliveryName)}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div
                            onClick={() => setIsEditEmployeeDropdownOpen(!isEditEmployeeDropdownOpen)}
                            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] select-none h-10 transition-all"
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
                    <label className="flex items-center h-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">
                      Pengiriman Bersih
                    </label>
                    <div className="relative">
                      <Calendar className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                      <input
                        type="datetime-local"
                        required
                        value={deliveryDate}
                        onChange={e => setDeliveryDate(e.target.value)}
                        disabled={!isEditable}
                        className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Petugas RS Pemeriksa (Delivery) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center h-4">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                        Petugas RS
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
                        className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Perawat RS Pemeriksa (Delivery) — diganti TTD Perawat Unit per ruangan bila RS memakai TTD per unit */}
                  {deliveryUnitSignMode ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center h-4">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                          Perawat RS
                        </label>
                      </div>
                      <div className="w-full h-10 flex items-center gap-2 px-3.5 bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500">
                        <Info className="h-4 w-4 text-[#1ea59e] shrink-0" />
                        <span className="truncate">TTD per unit / ruangan</span>
                      </div>
                    </div>
                  ) : (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center h-4">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                        Perawat RS
                      </label>
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => setHospitalAssistantDelivery(hospitalAssistantPickup || '')}
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
                        disabled={!isEditable}
                        placeholder="Nama perawat Rumah Sakit (Opsional)..."
                        value={hospitalAssistantDelivery}
                        onChange={e => setHospitalAssistantDelivery(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>
                  )}

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
                  <span>Data Sudah Terkunci dan Sudah Disetujui Oleh Kedua Belah Pihak</span>
                </div>
              )}

              {/* Table of detail quantities */}
              <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">

                 {/* Search bar & Room Selector above bersih linen table */}
                <div className="flex flex-col sm:flex-row gap-3 p-3 border-b border-slate-100 bg-slate-50/70">
                  {/* Room Selector */}
                  <RoomStatusSelect value={selectedRoomId} onChange={setSelectedRoomId} rooms={uniqueRooms} roomStatus={deliveryRoomStatus} />

                  {/* Search bar */}
                  <div className="relative flex-1">
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
                        className="absolute inset-y-0 right-3 my-auto text-slate-400 hover:text-slate-650 text-base leading-none cursor-pointer"
                      >✕</button>
                    )}
                  </div>
                </div>

                <div className="max-h-[75vh] overflow-auto">
                  <table className="w-full text-left text-sm border-separate border-spacing-0 min-w-[650px]">
                    <thead className="sticky top-0 z-10 [&_th]:sticky [&_th]:top-0 [&_th]:bg-slate-50">
                      <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider text-xs border-b border-slate-150 shadow-[0_1px_0_#e2e8f0]">
                        <th className="py-3 px-4 w-12 text-center">No</th>
                        <th className="py-3 px-4">Nama Linen</th>
                        <th className="py-3 px-4 text-center">Kepemilikan</th>
                        <th className="py-3 px-4 text-center">Ruangan</th>
                        <th className="py-3 px-4 text-center w-24">Kotor</th>
                        <th className="py-3 px-4 text-center w-24">Bersih</th>
                        <th className="py-3 px-4 text-center">Catatan Selisih & Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredEditDetails.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-12 text-center text-slate-400 font-semibold text-xs">
                            {editLinenSearch ? `Tidak ada linen yang cocok dengan "${editLinenSearch}"` : 'Tidak ada data linen.'}
                          </td>
                        </tr>
                      ) : filteredEditDetails.map((item, index) => {
                        const inputKey = item.isGrouped ? (item.originalItemIds?.[0] || item.id) : item.id;
                        // Ruangan yang sudah TTD unit (delivery) terkunci sampai dibuka lewat Edit
                        const rowRoomId = item.isGrouped ? editingTransaction.details.find(d => d.id === inputKey)?.room_id : item.room_id;
                        const isRowEditable = isEditable && !isDeliveryRoomLocked(rowRoomId)
                          && (!item.isGrouped || (item.originalItemIds.length === 1 && editingTransaction.details.find(d => d.id === item.originalItemIds[0])?.room_id === null));
                        const isRoomLocked = selectedRoomId && savedRooms.includes(selectedRoomId.toString());

                        let kotor = 0;
                        let bersih = 0;
                        if (item.isGrouped) {
                          item.originalItemIds.forEach(subId => {
                            const kVal = editKotorQuantities[subId];
                            kotor += kVal !== undefined && kVal !== '' ? parseInt(kVal) : 0;
                            
                            const bVal = bersihQuantities[subId];
                            if (bVal !== undefined && bVal !== '') {
                              bersih += parseInt(bVal) || 0;
                            } else {
                              const origDetail = editingTransaction.details.find(d => d.id === subId);
                              if (origDetail && origDetail.qty_bersih !== null) {
                                bersih += parseInt(origDetail.qty_bersih) || 0;
                              }
                            }
                          });
                        } else {
                          kotor = editKotorQuantities[item.id] !== undefined ? editKotorQuantities[item.id] : item.qty_kotor;
                          bersih = bersihQuantities[item.id] !== undefined ? bersihQuantities[item.id] : (item.qty_bersih !== null && item.qty_bersih !== undefined ? item.qty_bersih : '');
                        }

                        const isDiff = parseInt(kotor || 0) !== parseInt(bersih || 0);
                        const roomInfo = getRoomAndStockInfo(item.hospital_linen_id);

                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors duration-150 ${isDiff && isRowEditable
                              ? 'bg-amber-500/[0.03] border-l-4 border-l-amber-400'
                              : 'hover:bg-slate-50/40'
                              }`}
                          >
                            <td className="py-3 px-4 text-center font-medium text-slate-400 text-xs">{index + 1}</td>
                            <td className="py-3 px-4">
                                <p className="font-semibold text-slate-800 text-sm">{getLinenDisplayName(item)}</p>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <OwnershipBadge type={item.ownership_type} />
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-650 border border-slate-200">
                                {item.room_name || 'All'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-center font-bold text-slate-700 text-sm">
                                {formatNumber(kotor)}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {isRowEditable ? (
                                <div className="flex items-center justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={bersihQuantities[inputKey] !== undefined ? bersihQuantities[inputKey] : ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setBersihQuantities(prev => ({ ...prev, [inputKey]: val === '' ? '' : (parseInt(val) || 0) }));
                                    }}
                                    className="w-16 text-center py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white transition text-slate-700"
                                  />
                                </div>
                              ) : (
                                <div className="text-center font-bold text-teal-750 text-sm">
                                  {bersih !== '' ? `${formatNumber(bersih)} Pcs` : '—'}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isRowEditable ? (
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    placeholder="Tambahkan alasan/catatan selisih..."
                                    value={editItemNotes[inputKey] || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setEditItemNotes(prev => ({ ...prev, [inputKey]: val }));
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
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-slate-650 text-xs">
                                    {item.notes || '—'}
                                  </span>
                                  {item.isGrouped && item.originalItemIds.length > 1 && (
                                    <span className="text-[10px] text-amber-600 font-bold italic">
                                      * Pilih ruangan untuk mengisi jumlah bersih.
                                    </span>
                                  )}
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
                    <div className="px-5 pb-5 border-t border-slate-150/70 pt-4 bg-white animate-[fadeIn_0.2s_ease-out] space-y-5 max-h-72 overflow-y-auto pr-2 divide-y divide-slate-100/70">
                      
                      {/* Section 1: Pickup Linen Kotor */}
                      {editingTransaction.audits.some(a => a.action === 'CREATE' || a.action === 'PICKUP_KOTOR') && (
                        <div className="space-y-2 pt-3 first:pt-0">
                          <h5 className="text-[10px] font-extrabold text-[#678083] uppercase tracking-wider block">
                            Pickup Linen Kotor
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

                      {/* Section 2: Pengantaran Linen Bersih */}
                      {editingTransaction.audits.some(a => a.action === 'UPDATE' || a.action === 'DELIVERY_BERSIH') && (
                        <div className="space-y-2 pt-3">
                          <h5 className="text-[10px] font-extrabold text-[#1ea59e] uppercase tracking-wider block">
                            Pengantaran Linen Bersih
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

                      {/* Section 3: Linen Kurang Kirim */}
                      {editingTransaction.audits.some(a => a.action === 'KURANG_KIRIM') && (
                        <div className="space-y-2 pt-3">
                          <h5 className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider block">
                            Linen Kurang Kirim
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

                      {/* Section 4: Perubahan Oleh Rumah Sakit */}
                      {editingTransaction.audits.some(a => a.action === 'RUMAH_SAKIT') && (
                        <div className="space-y-2 pt-3">
                          <h5 className="text-[10px] font-extrabold text-teal-600 uppercase tracking-wider block">
                            Perubahan Oleh Rumah Sakit
                          </h5>
                          <div className="space-y-1.5 pl-1.5">
                            {editingTransaction.audits
                              .filter(a => a.action === 'RUMAH_SAKIT')
                              .map(audit => {
                                const descriptions = generateAuditLogDescriptions(audit);
                                return descriptions.map((desc, idx) => (
                                  <div key={`${audit.id}-${idx}`} className="text-xs font-semibold text-slate-600 flex items-start gap-1.5">
                                    <span className="text-slate-400 font-bold shrink-0">{formatAuditTime(audit.created_at)}</span>
                                    <span className="text-slate-400 font-bold shrink-0">•</span>
                                    <span className="text-teal-650 font-bold shrink-0">{audit.full_name || audit.username}</span>
                                    <span className="text-slate-400 font-bold shrink-0">•</span>
                                    <span className="text-slate-700 font-medium">{desc}</span>
                                  </div>
                                ));
                              })}
                          </div>
                        </div>
                      )}

                      {/* Section 5: Perubahan Oleh Admin */}
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

              {showKgExpressFields && (
                <div className={`grid grid-cols-1 gap-4 ${showKgFields && showExpressField ? 'sm:grid-cols-2' : ''}`}>
                  {showKgFields && (
                    <div className={`p-5 rounded-2xl border space-y-3 ${
                      isKgExpressEditable
                        ? 'bg-teal-50/50 border-teal-200'
                        : 'bg-slate-50 border-slate-150'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-[#126776]/10 text-[#126776] rounded-md">
                            <Scale className="h-4 w-4" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#126776] uppercase tracking-widest">
                              Total Kilogram
                              {isKgExpressEditable && (
                                <span className="ml-1.5 text-rose-500 normal-case tracking-normal font-bold">*</span>
                              )}
                            </label>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {isKgExpressEditable ? 'Wajib diisi saat pengiriman bersih' : 'Terkunci setelah transaksi selesai'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={totalKgValet}
                          disabled={!isKgExpressEditable}
                          required={isKgExpressEditable}
                          onChange={e => setTotalKgValet(e.target.value)}
                          className={`w-full pl-4 pr-12 py-3 rounded-xl text-sm font-semibold text-slate-800 border focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition-all disabled:cursor-not-allowed disabled:bg-slate-100 ${
                            isKgExpressEditable && (totalKgValet === '' || totalKgValet == null)
                              ? 'bg-white border-rose-300'
                              : 'bg-white border-slate-200'
                          }`}
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase tracking-wider">Kg</span>
                      </div>
                      {kgSummary}
                    </div>
                  )}
                  {showExpressField && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-amber-500/10 text-amber-600 rounded-md">
                          <Zap className="h-4 w-4" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-amber-700 uppercase tracking-widest">
                            Layanan Express
                          </label>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {isKgExpressEditable ? 'Terpisah dari pencatatan kilogram' : 'Terkunci setelah transaksi selesai'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!isKgExpressEditable}
                        onClick={() => isKgExpressEditable && setIsExpress(prev => !prev)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition ${
                          isKgExpressEditable ? 'active:scale-[0.99] cursor-pointer' : 'cursor-not-allowed opacity-70'
                        } ${
                          isExpress
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <span className="text-xs font-semibold">
                          {isExpress ? 'Express aktif' : 'Tidak express'}
                        </span>
                        <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${isExpress ? 'bg-amber-500' : 'bg-slate-200'}`}>
                          <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition ${isExpress ? 'translate-x-4' : ''}`} />
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TTD per unit (delivery): panel ruangan terpilih, atau ringkasan saat Semua Ruangan */}
              {deliveryUnitSignMode && selectedRoomNeedsSign && editingTransaction.transaction.status === 'PROSES' && isEditable && renderUnitSignPanel('delivery')}
              {deliveryUnitSignMode && !selectedRoomId && renderUnitSignSummary(editingTransaction.roomSign, 'delivery', pendingDeliveryRooms.map(r => r.room_name))}

              {/* Tanda Tangan Section */}
              {!(deliveryUnitSignMode && selectedRoomNeedsSign && editingTransaction.transaction.status === 'PROSES' && isEditable) && (
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-[#126776]/5 text-[#126776] rounded-md">
                    <FileText className="h-4 w-4" />
                  </div>
                  <label className="block text-xs font-semibold text-[#126776] uppercase tracking-widest">
                    {deliveryUnitSignMode ? 'TTD Akhir Tim Linen RS & Valet' : 'Dokumentasi Tanda Tangan Serah Terima'}
                  </label>
                </div>
                
                <div className="space-y-6">
                  {/* Pickup Signatures Card */}
                  <div className="border border-slate-150 rounded-2xl p-5 bg-slate-50/50 space-y-4">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-widest block">Tanda Tangan Saat Pickup (Kotor)</span>
                    <div className={`grid grid-cols-1 gap-5 ${editingTransaction.transaction.hospital_assistant_pickup || signatureAssistantPickup ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
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
                      {(editingTransaction.transaction.hospital_assistant_pickup || signatureAssistantPickup) && (
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
                      )}
                    </div>
                  </div>

                  {/* Delivery Signatures Card */}
                  <div className="border border-slate-150 rounded-2xl p-5 bg-slate-50/50 space-y-4">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-widest block">Tanda Tangan Saat Delivery (Bersih)</span>
                    {editingTransaction.transaction.status === 'PROSES' ? (
                      <div className={`grid grid-cols-1 gap-5 ${hospitalAssistantDelivery.trim() || signatureAssistantDelivery ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
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
                        {(hospitalAssistantDelivery.trim() || signatureAssistantDelivery) && (
                          <SignatureInput
                            title="Perawat RS (Opsional)"
                            value={signatureAssistantDelivery}
                            onChange={setSignatureAssistantDelivery}
                            isEditable={true}
                            name={hospitalAssistantDelivery}
                          />
                        )}
                      </div>
                    ) : (
                      <div className={`grid grid-cols-1 gap-5 ${editingTransaction.transaction.hospital_assistant_delivery || signatureAssistantDelivery ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
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
                        {(editingTransaction.transaction.hospital_assistant_delivery || signatureAssistantDelivery) && (
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
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* Actions Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setEditingTransaction(null); setErrorMsg(''); setSavedRooms([]); }}
                  className="px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer"
                >
                  {editingTransaction.transaction.status === 'SELESAI' && !isEditable ? 'Tutup' : 'Batal'}
                </button>

                {isEditable && (
                  selectedRoomId && deliveryUnitSignMode && selectedRoomNeedsSign && editingTransaction.transaction.status === 'PROSES' ? (
                    <button
                      type="button"
                      onClick={handleSaveAndSignRoom}
                      disabled={signingRoom || submittingEdit || deliveryRoomLocked}
                      className="px-6 py-2.5 bg-gradient-to-r from-[#126776] to-[#1ea59e] hover:from-[#0e5562] hover:to-[#188b85] text-white rounded-xl text-xs font-semibold shadow-md shadow-[#126776]/10 active:scale-95 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed animate-[fadeIn_0.2s_ease-out]"
                    >
                      {deliveryRoomLocked
                        ? <><Lock className="h-4 w-4" /> Ruangan Terkunci</>
                        : signingRoom
                        ? <><RefreshCw className="h-4 w-4 animate-spin" /> Menyimpan...</>
                        : <><Save className="h-4 w-4" /> Simpan &amp; TTD Ruangan Ini</>}
                    </button>
                  ) : selectedRoomId ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleCompleteDelivery();
                      }}
                      className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-500/10 active:scale-95 transition cursor-pointer flex items-center gap-1.5 animate-[fadeIn_0.2s_ease-out]"
                    >
                      <Save className="h-4 w-4" /> Simpan Sementara Ruangan Ini
                    </button>
                  ) : (
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
                  )
                )}
              </div>

            </form>
          </div>
        )}
          </>
        )}

      </div>

      {/* Modal formulir hari ini: Lanjutkan formulir induk atau Formulir Baru */}
      {dayFormsModal.show && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#126776]/10 text-[#126776] shrink-0"><FileText className="h-5 w-5" /></div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-800">Formulir Serah Terima Hari Ini</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {dayFormsModal.mode === 'conflict'
                    ? 'Sudah ada formulir hari ini. Isian Anda akan digabung ke formulir yang dipilih (per ruangan), atau buat Formulir Baru bila ini proses serah terima terpisah.'
                    : 'Satu hari satu formulir induk. Lanjutkan formulir yang ada agar semua ruangan terekap di satu formulir. Pilih Formulir Baru hanya untuk proses serah terima kedua atau linen express.'}
                </p>
              </div>
              <button type="button" onClick={() => setDayFormsModal(m => ({ ...m, show: false }))}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-2 max-h-[55vh] overflow-y-auto">
              {dayFormsModal.forms.map(f => (
                <div key={f.id} className={`p-3 rounded-xl border ${f.can_continue ? 'border-slate-200 bg-white' : 'border-slate-150 bg-slate-50'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800">{f.form_number}</span>
                      {f.is_express === 1 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Zap className="h-3 w-3" /> Express
                        </span>
                      )}
                      {!f.can_continue && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          {f.status === 'SELESAI' ? 'Selesai' : 'Pengambilan sudah final'}
                        </span>
                      )}
                    </div>
                    {f.can_continue && (
                      <button type="button" onClick={() => continueDayForm(f)}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#126776] to-[#1ea59e] text-white text-[11px] font-semibold cursor-pointer hover:opacity-90">
                        {dayFormsModal.mode === 'conflict' ? 'Gabungkan ke formulir ini' : 'Lanjutkan'}
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {f.rooms} ruangan · {f.total_kotor} pcs kotor
                    {f.valets?.length ? ` · Petugas IKM: ${f.valets.join(', ')}` : ''}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setDayFormsModal(m => ({ ...m, show: false }))}
                className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer hover:bg-slate-50">
                Batal
              </button>
              <button type="button" onClick={startNewDayForm}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold cursor-pointer hover:bg-amber-100">
                <PlusCircle className="h-3.5 w-3.5" /> Formulir Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border border-slate-100 bg-white/95 backdrop-blur-md animate-[slideIn_0.3s_ease-out] min-w-[280px]">
          <div className={`p-1.5 rounded-lg ${toast.type === 'success' ? 'bg-teal-50 text-teal-600' : 'bg-rose-50 text-rose-600'}`}>
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

      {/* Konfirmasi (komponen standar) */}
      <ConfirmDialog
        isOpen={confirmConfig.show}
        onClose={closeConfirm}
        onConfirm={() => confirmConfig.onConfirm?.()}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmLabel}
      />

      {/* Custom Alert Modal */}
      {alertConfig.show && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-6 transform animate-[scaleIn_0.2s_ease-out] relative">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100/50">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{alertConfig.title}</h3>
                <p className="text-slate-500 text-xs font-semibold mt-1">Sistem Waschen Alora</p>
              </div>
            </div>
            
            <p className="text-slate-600 text-sm font-semibold leading-relaxed">
              {alertConfig.message}
            </p>
            
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setAlertConfig({ show: false, title: 'Peringatan', message: '' })}
                className="px-6 py-2.5 bg-gradient-to-r from-[#126776] to-[#1ea59e] hover:from-[#0e5562] hover:to-[#188b85] text-white rounded-xl text-xs font-semibold shadow-md shadow-[#126776]/10 active:scale-95 transition cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}