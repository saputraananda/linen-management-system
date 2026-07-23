import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  FileText, Search, Calendar, CheckCircle2,
  AlertTriangle, ArrowLeft, RefreshCw, ChevronDown, Save, User, Clock, AlertCircle,
  Truck, Printer, X, Plus, Info
} from 'lucide-react';
import exportSuratJalanKurangKirim from '../utils/exportSuratJalanKurangKirim';

// Helper to convert string to Title Case
const toTitleCase = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Naming logic priority helper
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

// Signature Input sub-component matching SerahTerima signature pad style
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
      reader.onloadend = () => {
        onChange(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-2xl p-4 overflow-hidden shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/60">
        <span className="text-xs font-bold text-slate-800 tracking-wide uppercase">{title}</span>
        {isEditable && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => { setMode('draw'); clearCanvas(); }}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
                mode === 'draw'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Gambar
            </button>
            <button
              type="button"
              onClick={() => { setMode('upload'); onChange(''); }}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
                mode === 'upload'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Unggah Foto
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center min-h-[160px] bg-white border border-slate-200 border-dashed rounded-xl relative overflow-hidden">
        {mode === 'draw' ? (
          <>
            <canvas
              ref={canvasRef}
              width={400}
              height={200}
              className={`w-full h-full min-h-[160px] cursor-crosshair touch-none ${!isEditable ? 'pointer-events-none bg-slate-50' : 'bg-white'}`}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            {isEditable && hasSigned && (
              <button
                type="button"
                onClick={clearCanvas}
                className="absolute bottom-2.5 right-2.5 px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-[10px] rounded-lg transition"
              >
                Hapus
              </button>
            )}
          </>
        ) : (
          <div className="p-4 w-full flex flex-col items-center justify-center">
            {value ? (
              <div className="relative w-full max-h-[160px] flex items-center justify-center">
                <img src={value} alt="Preview signature" className="max-h-[140px] object-contain rounded-lg" />
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-full flex items-center justify-center shadow transition active:scale-95"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-slate-50/55 p-6 rounded-xl transition border-2 border-dashed border-slate-200">
                <Printer className="h-6 w-6 text-slate-400 mb-2" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Pilih file tanda tangan</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function KurangKirimLinen() {
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'sjHistory'
  const [hospitalId] = useState(sessionStorage.getItem('valet_hospital_id') || '');
  const [hospitalName, setHospitalName] = useState('');

  // Lists
  const [shortageTransactions, setShortageTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [sjList, setSjList] = useState([]);
  const [loadingSj, setLoadingSj] = useState(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Transaction for Delivery
  const [selectedTx, setSelectedTx] = useState(null);
  const [shortageDetails, setShortageDetails] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Delivery Process States
  const [processTab, setProcessTab] = useState('form'); // 'form' | 'sj'
  const [recipientName, setRecipientName] = useState('');
  const [hospitalStaff, setHospitalStaff] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(
    new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  );
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [signatureValet, setSignatureValet] = useState('');
  const [signatureHospital, setSignatureHospital] = useState('');
  const [deliveriesMap, setDeliveriesMap] = useState({}); // { hospitalLinenId: { qtyDelivered, notes } }
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected SJ View Modal
  const [viewingSj, setViewingSj] = useState(null);
  const [sjDetails, setSjDetails] = useState([]);
  const [loadingSjDetails, setLoadingSjDetails] = useState(false);

  const [valetId, setValetId] = useState(localStorage.getItem('employeeId') || '');
  const [valetName, setValetName] = useState(
    localStorage.getItem('fullName') || localStorage.getItem('username') || 'Valet'
  );

  // Searchable employees states
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const employeeSelectRef = useRef(null);

  // Click outside listener for valet select dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (employeeSelectRef.current && !employeeSelectRef.current.contains(event.target)) {
        setIsEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch employees list on load
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

  useEffect(() => {
    fetchEmployees();
    if (hospitalId) {
      fetchHospitalInfo();
    }
  }, [hospitalId]);

  const filteredEmployees = employees.filter(emp =>
    (emp.employee_name || '').toLowerCase().includes(searchEmployeeQuery.toLowerCase())
  );

  // Fetch initial shortage transactions
  const fetchShortageTransactions = async () => {
    if (!hospitalId) return;
    setLoadingTransactions(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('/api/ikm/kurang-kirim-linen/transactions', {
        params: { hospitalId },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        setShortageTransactions(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching shortage transactions:", err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Fetch SJ list
  const fetchSjList = async () => {
    if (!hospitalId) return;
    setLoadingSj(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('/api/ikm/kurang-kirim-linen/deliveries', {
        params: { hospitalId },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        setSjList(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching SJ list:", err);
    } finally {
      setLoadingSj(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchShortageTransactions();
    } else {
      fetchSjList();
    }
  }, [activeTab]);

  // Load shortage transaction details
  const handleSelectTransaction = async (tx) => {
    setSelectedTx(tx);
    setLoadingDetails(true);
    setRecipientName(tx.hospital_name || hospitalName);
    setHospitalStaff('');
    setVehicleNumber('');
    setSignatureValet('');
    setSignatureHospital('');
    setDeliveriesMap({});
    setProcessTab('form');
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/kurang-kirim-linen/transaction/${tx.id}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        setShortageDetails(data.data.details || []);
        // Initialize deliveries mapping
        const initMap = {};
        (data.data.details || []).forEach(item => {
          initMap[item.hospital_linen_id] = {
            qtyDelivered: 0,
            notes: ''
          };
        });
        setDeliveriesMap(initMap);
      }
    } catch (err) {
      console.error("Error loading shortage details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // View specific SJ detail
  const handleViewSj = async (sjId) => {
    setLoadingSjDetails(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/ikm/kurang-kirim-linen/delivery/${sjId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.success) {
        setViewingSj(data.data.delivery);
        setSjDetails(data.data.details || []);
      }
    } catch (err) {
      console.error("Error getting SJ detail:", err);
    } finally {
      setLoadingSjDetails(false);
    }
  };

  // Handle Qty / Notes edits in form (syncs with SJ preview)
  const handleQtyChange = (hospitalLinenId, val, maxLimit) => {
    const parsed = parseInt(val) || 0;
    const clamped = Math.min(maxLimit, Math.max(0, parsed));
    setDeliveriesMap(prev => ({
      ...prev,
      [hospitalLinenId]: {
        ...prev[hospitalLinenId],
        qtyDelivered: clamped
      }
    }));
  };

  const handleNotesChange = (hospitalLinenId, val) => {
    setDeliveriesMap(prev => ({
      ...prev,
      [hospitalLinenId]: {
        ...prev[hospitalLinenId],
        notes: val
      }
    }));
  };

  // Submit delivery
  const handleSubmitDelivery = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Filter items being delivered (qty > 0)
    const itemsToDeliver = [];
    Object.keys(deliveriesMap).forEach(hlId => {
      const deliveryObj = deliveriesMap[hlId];
      if (deliveryObj.qtyDelivered > 0) {
        itemsToDeliver.push({
          hospitalLinenId: parseInt(hlId),
          qtyDelivered: deliveryObj.qtyDelivered,
          notes: deliveryObj.notes
        });
      }
    });

    if (itemsToDeliver.length === 0) {
      setErrorMsg("Harap masukkan setidaknya satu barang dengan jumlah kirim lebih dari 0.");
      return;
    }

    if (!signatureValet) {
      setErrorMsg("Tanda tangan Petugas IKM wajib diisi.");
      return;
    }

    if (!signatureHospital) {
      setErrorMsg("Tanda tangan Penerima Rumah Sakit wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post('/api/ikm/kurang-kirim-linen/delivery', {
        transactionId: selectedTx.id,
        deliveryDate,
        vehicleNumber,
        recipientName,
        hospitalStaff,
        valetId: parseInt(valetId),
        signatureValet,
        signatureHospital,
        details: itemsToDeliver
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data?.success) {
        // Success callback
        setSelectedTx(null);
        setActiveTab('sjHistory'); // Switch to SJ tab
      }
    } catch (err) {
      console.error("Error submitting shortage delivery:", err);
      setErrorMsg(err.response?.data?.message || "Gagal menyimpan pengiriman kurang kirim.");
    } finally {
      setSubmitting(false);
    }
  };

  // Print active unsaved/new shortage delivery preview
  const handlePrintActive = () => {
    const activeDetails = shortageDetails.map(item => {
      const deliverObj = deliveriesMap[item.hospital_linen_id] || { qtyDelivered: 0, notes: '' };
      return {
        ...item,
        qty_delivered: deliverObj.qtyDelivered,
        notes: deliverObj.notes
      };
    }).filter(item => item.qty_delivered > 0);

    const deliveryHeader = {
      surat_jalan_number: '(Otomatis)',
      delivery_date: deliveryDate,
      vehicle_number: vehicleNumber,
      recipient_name: recipientName,
      hospital_staff: hospitalStaff,
      valet_name: valetName,
      hospital_address: selectedTx?.hospital_address || '',
      signature_hospital: signatureHospital,
      signature_valet: signatureValet
    };

    exportSuratJalanKurangKirim(deliveryHeader, activeDetails);
  };

  // Print historical delivery
  const handlePrintHistory = () => {
    if (viewingSj) {
      exportSuratJalanKurangKirim(viewingSj, sjDetails);
    }
  };

  // Filtered lists computation
  const filteredShortageTransactions = shortageTransactions.filter(tx => {
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const matchForm = (tx.form_number || '').toLowerCase().includes(query);
      const matchValet = (tx.user_pickup_name || '').toLowerCase().includes(query);
      const matchDelivery = (tx.user_delivery_name || '').toLowerCase().includes(query);
      const matchHospital = (tx.hospital_name || '').toLowerCase().includes(query);
      const matchNotes = (tx.notes_pickup || '').toLowerCase().includes(query) || (tx.notes_delivery || '').toLowerCase().includes(query);
      if (!matchForm && !matchValet && !matchDelivery && !matchHospital && !matchNotes) return false;
    }

    if (startDate) {
      const txDate = tx.pickup_date ? tx.pickup_date.substring(0, 10) : '';
      if (txDate && txDate < startDate) return false;
    }
    if (endDate) {
      const txDate = tx.pickup_date ? tx.pickup_date.substring(0, 10) : '';
      if (txDate && txDate > endDate) return false;
    }

    return true;
  });

  const filteredSjList = sjList.filter(sj => {
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const matchSj = (sj.surat_jalan_number || '').toLowerCase().includes(query);
      const matchForm = (sj.original_form_number || '').toLowerCase().includes(query);
      const matchValet = (sj.valet_name || '').toLowerCase().includes(query);
      const matchRecipient = (sj.recipient_name || '').toLowerCase().includes(query);
      const matchStaff = (sj.hospital_staff || '').toLowerCase().includes(query);
      const matchVehicle = (sj.vehicle_number || '').toLowerCase().includes(query);
      if (!matchSj && !matchForm && !matchValet && !matchRecipient && !matchStaff && !matchVehicle) return false;
    }

    if (startDate) {
      const sjDate = sj.delivery_date ? sj.delivery_date.substring(0, 10) : '';
      if (sjDate && sjDate < startDate) return false;
    }
    if (endDate) {
      const sjDate = sj.delivery_date ? sj.delivery_date.substring(0, 10) : '';
      if (sjDate && sjDate > endDate) return false;
    }

    return true;
  });

  return (
    <div className="min-h-full py-6 bg-slate-50/50">
      {/* Scope specific print CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-document, #print-document * {
            visibility: visible;
          }
          #print-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 space-y-6">

      {/* Header Banner Card */}
      <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all no-print">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#126776] bg-[#126776]/5 px-3 py-1 rounded-md border border-[#126776]/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1ea59e]" />
            Rumah Sakit Terpilih
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-2.5">
              {hospitalName || 'Rumah Sakit'}
            </h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Portal pencatatan kurang kirim linen dan penerbitan Surat Jalan.
          </p>
        </div>

        {/* Tab Toggle buttons */}
        {!selectedTx && (
          <div className="flex bg-slate-100 p-1.5 rounded-xl shrink-0 h-fit self-start md:self-center border border-slate-200">
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-[#126776] to-[#1ea59e] text-white shadow-md shadow-[#126776]/10'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/55'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              Sisa Kurang Kirim
            </button>
            <button
              onClick={() => setActiveTab('sjHistory')}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'sjHistory'
                  ? 'bg-gradient-to-r from-[#126776] to-[#1ea59e] text-white shadow-md shadow-[#126776]/10'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/55'
              }`}
            >
              <FileText className="h-4 w-4" />
              Riwayat Surat Jalan
            </button>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="no-print">
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
        ) : selectedTx ? (
          // ════════════════════════ PROCESS DELIVERY / UPDATE VIEW ════════════════════════
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-[fadeIn_0.25s_ease-out]">
            {/* Header info */}
            <div className="p-6 bg-gradient-to-r from-[#126776] to-[#1ea59e] text-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedTx(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-md font-bold tracking-tight">Formulir Kirim Kurang Linen</h2>
                  <p className="text-[10px] text-white/80 mt-0.5">
                    Menyelesaikan sisa kekurangan kirim untuk formulir: <span className="font-bold">{selectedTx.form_number}</span>
                  </p>
                </div>
              </div>

              {/* Sub tabs (Form vs Surat Jalan) */}
              <div className="flex items-center gap-1.5 bg-black/10 p-1 rounded-xl">
                <button
                  onClick={() => setProcessTab('form')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition ${
                    processTab === 'form' ? 'bg-white text-[#126776]' : 'text-white hover:bg-white/10'
                  }`}
                >
                  Form Update
                </button>
                <button
                  onClick={() => setProcessTab('sj')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition ${
                    processTab === 'sj' ? 'bg-white text-[#126776]' : 'text-white hover:bg-white/10'
                  }`}
                >
                  Preview Surat Jalan
                </button>
              </div>
            </div>

            {loadingDetails ? (
              <div className="p-12 text-center text-slate-400 font-medium flex flex-col items-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
                <span>Memuat rincian item kotor...</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitDelivery} className="p-6 space-y-6">
                {processTab === 'form' ? (
                  // TAB: FORM UPDATE
                  <div className="space-y-6">
                    {/* Header Details with Side Badges */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Valet Section */}
                      <div className="flex rounded-2xl border border-slate-150 bg-slate-50/50">
                        <div className="bg-[#678083] text-white flex items-center justify-center px-4 font-bold text-[10px] uppercase select-none tracking-widest shrink-0 [writing-mode:vertical-lr] rotate-180 rounded-r-2xl">
                          Valet IKM
                        </div>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                          {/* Searchable Dropdown Select */}
                          <div className="space-y-1.5" ref={employeeSelectRef}>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Petugas Pengirim (IKM)
                            </label>
                            <div className="relative">
                              <div
                                onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-between cursor-pointer focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] select-none min-h-[38px] transition-all"
                              >
                                <div className="flex items-center gap-2">
                                  <User className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                                  <span>{toTitleCase(valetName) || 'Pilih Petugas IKM...'}</span>
                                </div>
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              </div>

                              {isEmployeeDropdownOpen && (
                                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 shadow-xl rounded-2xl p-2.5 z-50 max-h-60 flex flex-col no-print">
                                  {/* Search Input inside dropdown */}
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
                                            setValetId(emp.employee_id);
                                            setValetName(emp.employee_name);
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

                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              No. Kendaraan
                            </label>
                            <input
                              type="text"
                              placeholder="B 1234 XX..."
                              value={vehicleNumber}
                              onChange={e => setVehicleNumber(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Hospital Section */}
                      <div className="flex rounded-2xl border border-slate-150 bg-slate-50/50">
                        <div className="bg-[#678083] text-white flex items-center justify-center px-4 font-bold text-[10px] uppercase select-none tracking-widest shrink-0 [writing-mode:vertical-lr] rotate-180 rounded-r-2xl">
                          Petugas RS
                        </div>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Penerima (Petugas RS)
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Nama petugas Rumah Sakit..."
                              value={hospitalStaff}
                              onChange={e => setHospitalStaff(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition outline-none"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Tanggal & Jam Pengiriman
                            </label>
                            <input
                              type="datetime-local"
                              required
                              value={deliveryDate}
                              onChange={e => setDeliveryDate(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] transition outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Shortage Item Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-150">
                              <th className="px-4 py-3.5 text-center w-12">No</th>
                              <th className="px-4 py-3.5">Nama Linen</th>
                              <th className="px-4 py-3.5 text-center w-48">Sisa Kurang Kirim</th>
                              <th className="px-4 py-3.5 text-center w-36">Jumlah Kirim</th>
                              <th className="px-4 py-3.5 min-w-[200px]">Catatan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {shortageDetails.map((item, idx) => {
                              const deliverObj = deliveriesMap[item.hospital_linen_id] || { qtyDelivered: 0, notes: '' };
                              return (
                                <tr key={item.id} className="hover:bg-slate-50/50 text-xs font-medium text-slate-700">
                                  <td className="px-4 py-3 text-center font-bold text-slate-400 text-xs">{idx + 1}</td>
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-800 text-sm">{getLinenDisplayName(item)}</div>
                                  </td>
                                  <td className="px-4 py-3 text-center text-rose-500 font-bold text-sm">{item.remaining_shortage}</td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center">
                                      <input
                                        type="number"
                                        min="0"
                                        max={item.remaining_shortage}
                                        value={deliverObj.qtyDelivered || ''}
                                        onChange={e => handleQtyChange(item.hospital_linen_id, e.target.value, item.remaining_shortage)}
                                        className="w-16 text-center py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white transition"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      placeholder="Catatan item..."
                                      value={deliverObj.notes}
                                      onChange={e => handleNotesChange(item.hospital_linen_id, e.target.value)}
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] focus:bg-white transition"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Dual Signatures */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <SignatureInput
                        title="Tanda Tangan Petugas IKM"
                        value={signatureValet}
                        onChange={setSignatureValet}
                        isEditable={true}
                      />
                      <SignatureInput
                        title="Tanda Tangan Penerima Rumah Sakit"
                        value={signatureHospital}
                        onChange={setSignatureHospital}
                        isEditable={true}
                      />
                    </div>
                  </div>
                ) : (
                  // TAB: SURAT JALAN PREVIEW (EDITABLE SYNCED VIEW)
                  <div className="space-y-6">
                    {/* Paper Document Preview Container */}
                    <div id="print-document" className="max-w-[800px] mx-auto bg-white border border-slate-300 rounded-xl p-8 shadow-md text-slate-800 font-sans">
                      {/* Header */}
                      <div className="flex flex-row items-center justify-between pb-4 border-b-2 border-slate-900 gap-4">
                        <div className="flex items-center gap-3">
                          <img src="/ikm.png" alt="IKM Logo" className="h-14 object-contain" />
                          <div>
                            <h2 className="text-md sm:text-lg font-bold uppercase tracking-tight text-slate-900 leading-none">PT. INTERSOLUSI KARYA MANDIRI</h2>
                            <p className="text-[10px] text-slate-500 font-semibold mt-1">Jl. Pringgondani No. 101, Cimanggis, Depok, Jawa Barat</p>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">HP: 08118871101 / 08161986580</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <h1 className="text-xl sm:text-2xl font-black tracking-widest text-slate-900 leading-none">SURAT JALAN</h1>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">No. (Otomatis)</p>
                        </div>
                      </div>

                      {/* Meta Columns */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-6 text-xs border-b border-slate-200">
                        {/* Left Side */}
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-500 w-36 tracking-wider">Kepada Yth:</span>
                            <input
                              type="text"
                              value={recipientName}
                              onChange={e => setRecipientName(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 border border-slate-200 hover:border-slate-350 focus:border-teal-500 outline-none rounded-lg font-bold text-slate-800 transition"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-500 w-36 tracking-wider">Tanggal Pengambilan:</span>
                            <input
                              type="text"
                              disabled
                              value={selectedTx?.pickup_date ? new Date(selectedTx.pickup_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                              className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 outline-none rounded-lg font-semibold text-slate-500 select-none cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Right Side */}
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-500 w-36 tracking-wider">Tanggal Pengiriman:</span>
                            <input
                              type="datetime-local"
                              value={deliveryDate}
                              onChange={e => setDeliveryDate(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 border border-slate-200 hover:border-slate-350 focus:border-teal-500 outline-none rounded-lg font-semibold text-slate-700 transition"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-500 w-36 tracking-wider">No. Kendaraan:</span>
                            <input
                              type="text"
                              placeholder="Ketik No. Kendaraan..."
                              value={vehicleNumber}
                              onChange={e => setVehicleNumber(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 border border-slate-200 hover:border-slate-350 focus:border-teal-500 outline-none rounded-lg font-semibold text-slate-700 transition"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="py-6">
                        <table className="w-full text-left border-collapse border border-slate-900 text-xs font-semibold">
                          <thead>
                            <tr className="bg-slate-100 text-slate-900 uppercase font-black tracking-wider border-b border-slate-900 text-[10px]">
                              <th className="px-4 py-2.5 border-r border-slate-900 text-center w-12">No</th>
                              <th className="px-4 py-2.5 border-r border-slate-900 text-center">Nama Barang</th>
                              <th className="px-4 py-2.5 border-r border-slate-900 text-center w-28">Jumlah Barang</th>
                              <th className="px-4 py-2.5 border-r border-slate-900 text-center w-28">Berat (Gram)</th>
                              <th className="px-4 py-2.5 text-center">Keterangan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900 border-b border-slate-900">
                            {shortageDetails.map((item, idx) => {
                              const deliverObj = deliveriesMap[item.hospital_linen_id] || { qtyDelivered: 0, notes: '' };
                              const calculatedWeight = parseFloat(item.grammage || 0) * (deliverObj.qtyDelivered || 0);

                              // Only show items with Qty Kirim > 0 in print preview
                              if (deliverObj.qtyDelivered <= 0) return null;

                              return (
                                <tr key={item.id} className="text-slate-800">
                                  <td className="px-4 py-3 border-r border-slate-900 text-center font-bold">{idx + 1}</td>
                                  <td className="px-4 py-3 border-r border-slate-900">{getLinenDisplayName(item)}</td>
                                  <td className="px-4 py-3 border-r border-slate-900 text-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max={item.remaining_shortage}
                                      value={deliverObj.qtyDelivered}
                                      onChange={e => handleQtyChange(item.hospital_linen_id, e.target.value, item.remaining_shortage)}
                                      className="w-16 text-center border border-slate-200 rounded p-1 font-bold inline-block"
                                    />
                                  </td>
                                  <td className="px-4 py-3 border-r border-slate-900 text-center font-bold">
                                    {calculatedWeight ? calculatedWeight.toLocaleString('id-ID') : '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      placeholder="keterangan..."
                                      value={deliverObj.notes}
                                      onChange={e => handleNotesChange(item.hospital_linen_id, e.target.value)}
                                      className="w-full border border-transparent hover:border-slate-200 focus:border-teal-500 rounded p-1"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                            
                            {/* Empty State warning inside tab table */}
                            {Object.values(deliveriesMap).every(item => item.qtyDelivered <= 0) && (
                              <tr>
                                <td colSpan="5" className="px-4 py-8 text-center text-slate-400 italic">
                                  Belum ada barang yang dikirim. Masukkan jumlah kirim di tab "Form Update" atau di kolom jumlah di atas.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Signatures & Notes */}
                      <div className="grid grid-cols-2 gap-10 pt-10 text-center text-xs font-bold text-slate-900">
                        {/* Left signature block */}
                        <div className="space-y-4">
                          <p>Di Terima Oleh :</p>
                          <div className="h-28 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-center relative overflow-hidden">
                            {signatureHospital ? (
                              <img src={signatureHospital} alt="Hospital signature" className="h-full object-contain" />
                            ) : (
                              <span className="text-[10px] text-slate-400 italic font-semibold">Tanda Tangan Belum Ada</span>
                            )}
                          </div>
                          <p className="border-t border-slate-950 pt-1.5 font-bold uppercase tracking-wide">
                            {hospitalStaff || '(Petugas RS)'}
                          </p>
                        </div>

                        {/* Right signature block */}
                        <div className="space-y-4">
                          <p>Di Serahkan Oleh :</p>
                          <div className="h-28 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-center relative overflow-hidden">
                            {signatureValet ? (
                              <img src={signatureValet} alt="Valet signature" className="h-full object-contain" />
                            ) : (
                              <span className="text-[10px] text-slate-400 italic font-semibold">Tanda Tangan Belum Ada</span>
                            )}
                          </div>
                          <p className="border-t border-slate-950 pt-1.5 font-bold uppercase tracking-wide">
                            {valetName}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Error Message */}
                {errorMsg && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-start gap-2.5 animate-shake">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex items-center justify-between border-t border-slate-200 pt-6 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTx(null)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-250 active:scale-95 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    Batal
                  </button>

                  <div className="flex items-center gap-3">
                    {processTab === 'sj' && (
                      <button
                        type="button"
                        onClick={handlePrintActive}
                        className="px-4 py-2.5 bg-slate-800 text-white hover:bg-slate-900 active:scale-95 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                        Cetak Surat Jalan
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2.5 bg-[#126776] text-white hover:bg-[#0f5460] active:scale-95 font-bold text-xs rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Kirim & Simpan
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        ) : (
          // ════════════════════════ LIST VIEW ════════════════════════
          <div className="space-y-6">
            {/* Redesigned Filters Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">

                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute inset-y-0 left-3.5 my-auto h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={
                      activeTab === 'history'
                        ? "Cari nomor form, petugas, atau catatan..."
                        : "Cari nomor SJ, form asal, valet, atau penerima..."
                    }
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

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setSearchQuery(''); setStartDate(''); setEndDate(''); }}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition cursor-pointer active:scale-95 border border-slate-200"
                      title="Reset Filter"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>

                </div>
              </div>
            </div>

            {activeTab === 'history' ? (
              // TAB: SHORTAGES LIST
              <div className="space-y-4">
                {loadingTransactions ? (
                  <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-medium flex flex-col items-center gap-3">
                    <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
                    <span>Memuat daftar transaksi kurang kirim...</span>
                  </div>
                ) : filteredShortageTransactions.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-medium flex flex-col items-center gap-2">
                    <CheckCircle2 className="h-8 w-8 text-teal-500 mb-2" />
                    <span className="text-slate-700 font-bold text-sm">
                      {shortageTransactions.length === 0 ? "Tidak Ada Kurang Kirim Linen" : "Tidak Ada Transaksi Ditemukan"}
                    </span>
                    <span className="text-xs text-slate-400 mt-0.5">
                      {shortageTransactions.length === 0
                        ? "Semua pengiriman linen kotor telah lengkap diselesaikan."
                        : "Tidak ada transaksi yang sesuai dengan filter atau pencarian Anda."}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredShortageTransactions.map(tx => (
                      <div key={tx.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-5 relative overflow-hidden group">
                        {/* Top banner accent */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#126776]" />
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-slate-800 bg-slate-100 px-3 py-1.5 rounded-xl">{tx.form_number}</span>
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg">
                              Shortage
                            </span>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <span>{new Date(tx.pickup_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <User className="h-4 w-4 text-slate-400" />
                              <span>Petugas: {tx.user_pickup_name}</span>
                            </div>
                          </div>
                        </div>

                        {/* Shortage info highlight */}
                        <div className="flex items-center justify-between bg-rose-50/50 border border-rose-100/60 p-3 rounded-2xl">
                          <div className="text-left">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Jenis Linen</span>
                            <span className="text-sm font-extrabold text-slate-700">{tx.shortage_items_count} item</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Total Kekurangan</span>
                            <span className="text-sm font-extrabold text-rose-600">{tx.total_shortage_qty} PCS</span>
                          </div>
                        </div>

                        {/* Action */}
                        <button
                          onClick={() => handleSelectTransaction(tx)}
                          className="w-full py-2.5 bg-[#126776] text-white hover:bg-[#0f5460] font-bold text-xs rounded-xl active:scale-[0.98] transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Truck className="h-4 w-4" />
                          Proses Pengiriman
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // TAB: SJ LIST (HISTORY)
              <div className="space-y-4">
                {loadingSj ? (
                  <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-medium flex flex-col items-center gap-3">
                    <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
                    <span>Memuat riwayat Surat Jalan...</span>
                  </div>
                ) : filteredSjList.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-medium flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-slate-300 mb-2" />
                    <span className="text-slate-700 font-bold text-sm">
                      {sjList.length === 0 ? "Belum Ada Surat Jalan" : "Tidak Ada Surat Jalan Ditemukan"}
                    </span>
                    <span className="text-xs text-slate-400 mt-0.5">
                      {sjList.length === 0
                        ? "Surat Jalan pengiriman kurang kirim belum pernah dibuat."
                        : "Tidak ada Surat Jalan yang sesuai dengan filter atau pencarian Anda."}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredSjList.map(sj => (
                      <div key={sj.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-5 relative overflow-hidden group">
                        {/* Top accent */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#678083]" />
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-slate-800 bg-slate-100 px-3 py-1.5 rounded-xl">{sj.surat_jalan_number}</span>
                            <span className="text-[10px] font-bold text-teal-600 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-lg">
                              SJ Kurang
                            </span>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <span>{new Date(sj.delivery_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <User className="h-4 w-4 text-slate-400" />
                              <span>Valet: {sj.valet_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <Truck className="h-4 w-4 text-slate-400" />
                              <span>No. Kendaraan: {sj.vehicle_number || '—'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Summary info */}
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                          <div className="text-left">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Form Asal</span>
                            <span className="text-xs font-bold text-slate-700">{sj.original_form_number}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Total Kirim</span>
                            <span className="text-sm font-extrabold text-teal-600">{sj.total_qty_delivered} PCS</span>
                          </div>
                        </div>

                        {/* Action */}
                        <button
                          onClick={() => handleViewSj(sj.id)}
                          className="w-full py-2.5 bg-[#678083] hover:bg-[#5f7578] text-white font-bold text-xs rounded-xl active:scale-[0.98] transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="h-4 w-4" />
                          Lihat Surat Jalan
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════ VIEW SJ MODAL (FULL PRINT-READY PREVIEW) ════════════════════════ */}
      {viewingSj && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-[840px] flex flex-col overflow-hidden max-h-[90vh] animate-[scaleUp_0.2s_ease-out]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-150 flex items-center justify-between gap-4 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Detail Surat Jalan Kurang Kirim</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{viewingSj.surat_jalan_number}</p>
              </div>
              <button
                onClick={() => setViewingSj(null)}
                className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-450 hover:text-slate-650 transition active:scale-90"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              <div id="print-document" className="bg-white border border-slate-250 rounded-2xl p-8 shadow-sm text-slate-850">
                {/* Paper Header */}
                <div className="flex flex-row items-center justify-between pb-4 border-b-2 border-slate-900 gap-4">
                  <div className="flex items-center gap-3">
                    <img src="/ikm.png" alt="IKM Logo" className="h-14 object-contain" />
                    <div>
                      <h2 className="text-md font-bold uppercase tracking-tight text-slate-900 leading-none">PT. INTERSOLUSI KARYA MANDIRI</h2>
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">Jl. Pringgondani No. 101, Cimanggis, Depok, Jawa Barat</p>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">HP: 08118871101 / 08161986580</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h1 className="text-xl font-black tracking-widest text-slate-900 leading-none">SURAT JALAN</h1>
                    <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">No. {viewingSj.surat_jalan_number}</p>
                  </div>
                </div>

                {/* Info block */}
                <div className="grid grid-cols-2 gap-4 py-5 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <div className="space-y-1.5">
                    <p className="flex"><span className="w-36 font-bold text-slate-400">Kepada Yth:</span> <span className="font-bold text-slate-900">{viewingSj.recipient_name}</span></p>
                    <p className="flex"><span className="w-36 font-bold text-slate-400">Tanggal Pengambilan:</span> <span className="text-slate-800">{viewingSj.original_pickup_date ? new Date(viewingSj.original_pickup_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span></p>
                    <p className="flex"><span className="w-36 font-bold text-slate-400">Form Transaksi Asal:</span> <span className="text-slate-800">{viewingSj.original_form_number || '—'}</span></p>
                  </div>
                  <div className="space-y-1.5 text-right sm:text-left sm:pl-10">
                    <p className="flex"><span className="w-36 font-bold text-slate-400">Tanggal Pengiriman:</span> <span className="text-slate-800">{new Date(viewingSj.delivery_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
                    <p className="flex"><span className="w-36 font-bold text-slate-400">Jam:</span> <span className="text-slate-800">{new Date(viewingSj.delivery_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span></p>
                    <p className="flex"><span className="w-36 font-bold text-slate-400">No. Kendaraan:</span> <span className="text-slate-800">{viewingSj.vehicle_number || '—'}</span></p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="py-5">
                  <table className="w-full text-left border-collapse border border-slate-900 text-xs font-semibold">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 uppercase font-black border-b border-slate-900 text-[9px] tracking-wider">
                        <th className="px-4 py-2 border-r border-slate-900 text-center w-12">No</th>
                        <th className="px-4 py-2 border-r border-slate-900 text-center">Nama Barang</th>
                        <th className="px-4 py-2 border-r border-slate-900 text-center w-24">Jumlah</th>
                        <th className="px-4 py-2 border-r border-slate-900 text-center w-24">Berat (Gram)</th>
                        <th className="px-4 py-2 text-center">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 border-b border-slate-900">
                      {sjDetails.map((item, idx) => {
                        const itemWeight = parseFloat(item.grammage || 0) * (item.qty_delivered || 0);
                        return (
                          <tr key={item.id} className="text-slate-800">
                            <td className="px-4 py-2.5 border-r border-slate-900 text-center font-bold">{idx + 1}</td>
                            <td className="px-4 py-2.5 border-r border-slate-900">{getLinenDisplayName(item)}</td>
                            <td className="px-4 py-2.5 border-r border-slate-900 text-center font-bold">
                              {item.qty_delivered}
                            </td>
                            <td className="px-4 py-2.5 border-r border-slate-900 text-center font-bold">
                              {itemWeight ? itemWeight.toLocaleString('id-ID') : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 italic">{item.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-10 pt-8 text-center text-[11px] font-bold text-slate-900">
                  <div className="space-y-3">
                    <p>Di Terima Oleh :</p>
                    <div className="h-24 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden">
                      {viewingSj.signature_hospital ? (
                        <img src={viewingSj.signature_hospital} alt="Hospital recipient signature" className="h-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Tidak ada tanda tangan</span>
                      )}
                    </div>
                    <p className="border-t border-slate-950 pt-1.5 font-bold uppercase tracking-wider">{viewingSj.hospital_staff || viewingSj.recipient_name || '(Petugas RS)'}</p>
                  </div>
                  <div className="space-y-3">
                    <p>Di Serahkan Oleh :</p>
                    <div className="h-24 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden">
                      {viewingSj.signature_valet ? (
                        <img src={viewingSj.signature_valet} alt="Valet courier signature" className="h-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Tidak ada tanda tangan</span>
                      )}
                    </div>
                    <p className="border-t border-slate-950 pt-1.5 font-bold uppercase tracking-wider">{viewingSj.valet_name}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-150 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setViewingSj(null)}
                className="px-4 py-2.5 bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold text-xs rounded-xl active:scale-95 transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handlePrintHistory}
                className="px-5 py-2.5 bg-[#126776] text-white hover:bg-[#0f5460] font-bold text-xs rounded-xl active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Cetak Surat Jalan
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>
    </div>
  );
}
