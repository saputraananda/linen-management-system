import { useEffect, useState, useRef, Fragment } from 'react';
import axios from 'axios';
import {
    FileText, Search, Calendar, CheckCircle2,
    AlertTriangle, ArrowLeft, RefreshCw, ChevronRight,
    User, Clock, AlertCircle, Warehouse, Building,
    Shirt, Info, X, Printer, ListCollapse, Edit2, Trash2,
    Save, Undo, ChevronDown
} from 'lucide-react';
import exportSuratJalanKurangKirim from '../../ikm/utils/exportSuratJalanKurangKirim.js';
import exportSerahTerimaLinen from '../../../utils/exportSerahTerimaLinen.js';
import exportSerahTerimaLinenPDF from '../../../utils/exportSerahTerimaLinenPDF.js';

// Helper to convert string to Title Case
const toTitleCase = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export default function RSSerahTerima() {
    const [transactions, setTransactions] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // Details Modal States
    const [editingTransaction, setEditingTransaction] = useState(null); // stores active transaction detail
    const [detailTab, setDetailTab] = useState('detail'); // 'detail' | 'surat_jalan'
    const [showAuditLogs, setShowAuditLogs] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [roomsList, setRoomsList] = useState([]);

    // Edit/Delete detail states
    const [editingItemId, setEditingItemId] = useState(null);
    const [editQtyKotor, setEditQtyKotor] = useState(0);
    const [editItemNotesState, setEditItemNotesState] = useState('');
    const [expandedGroupedLid, setExpandedGroupedLid] = useState(null);
    const [savingEdit, setSavingEdit] = useState(false);

    const startEdit = (itemId, currentQty, currentNotes) => {
        setEditingItemId(itemId);
        setEditQtyKotor(currentQty);
        setEditItemNotesState(currentNotes || '');
    };

    const handleSaveEdit = async (itemId) => {
        if (editQtyKotor < 0) {
            showToast('Jumlah kotor tidak boleh kurang dari 0', 'error');
            return;
        }
        setSavingEdit(true);
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.put(
                `/api/rs/transactions/${editingTransaction.transaction.id}/detail/${itemId}`,
                {
                    qty_kotor: parseInt(editQtyKotor),
                    notes: editItemNotesState
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            if (data?.success) {
                showToast(data.message || 'Berhasil memperbarui data kotor linen', 'success');
                setEditingItemId(null);
                // Refresh modal details
                await handleOpenDetail(editingTransaction.transaction.id);
                // Also refresh history list behind the modal
                fetchHistory();
            }
        } catch (err) {
            console.error('Error saving item edit:', err);
            showToast(err.response?.data?.message || 'Gagal menyimpan perubahan', 'error');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus linen ini dari daftar transaksi kotor?')) {
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.delete(
                `/api/rs/transactions/${editingTransaction.transaction.id}/detail/${itemId}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            if (data?.success) {
                showToast(data.message || 'Linen berhasil dihapus dari daftar', 'success');
                setEditingItemId(null);
                // Refresh modal details
                await handleOpenDetail(editingTransaction.transaction.id);
                // Also refresh history list behind the modal
                fetchHistory();
            }
        } catch (err) {
            console.error('Error deleting item:', err);
            showToast(err.response?.data?.message || 'Gagal menghapus linen', 'error');
        }
    };

    const getLinenNameById = (hospitalLinenId) => {
        const detail = editingTransaction?.details?.find(d => d.hospital_linen_id === hospitalLinenId);
        return detail ? getLinenDisplayName(detail) : `Linen #${hospitalLinenId}`;
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

        if (oldTx.user_pickup !== newTx.user_pickup) {
            descriptions.push(`Petugas Pickup diubah`);
        }
        if (oldTx.user_delivery !== newTx.user_delivery) {
            descriptions.push(`Petugas Delivery diubah`);
        }
        if (oldTx.hospital_staff_pickup !== newTx.hospital_staff_pickup) {
            descriptions.push(`Petugas RS Pickup: "${oldTx.hospital_staff_pickup || '—'}" menjadi "${newTx.hospital_staff_pickup || '—'}"`);
        }
        if (oldTx.hospital_staff_delivery !== newTx.hospital_staff_delivery) {
            descriptions.push(`Petugas RS Delivery: "${oldTx.hospital_staff_delivery || '—'}" menjadi "${newTx.hospital_staff_delivery || '—'}"`);
        }
        if (oldTx.pickup_date !== newTx.pickup_date) {
            descriptions.push(`Tanggal Pickup diubah`);
        }
        if (oldTx.delivery_date !== newTx.delivery_date) {
            descriptions.push(`Tanggal Pengantaran diubah`);
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

    const formatAuditTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const dayName = d.toLocaleDateString('id-ID', { weekday: 'long' });
        const dateFormatted = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${dayName}, ${dateFormatted}, ${hours}:${minutes} WIB`;
    };

    // Selected Surat Jalan details inside "Surat Jalan" tab
    const [selectedSj, setSelectedSj] = useState(null);
    const [sjDetails, setSjDetails] = useState([]);
    const [loadingSjDetails, setLoadingSjDetails] = useState(false);
    const [hospitalName, setHospitalName] = useState('');
    const [downloadingTxId, setDownloadingTxId] = useState(null);
    const [downloadingPdfTxId, setDownloadingPdfTxId] = useState(null);

    const prevFiltersRef = useRef({ startDate, endDate, filterStatus });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => {
            setToast(prev => ({ ...prev, show: false }));
        }, 3000);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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

    // Fetch RS transactions
    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const token = localStorage.getItem('token');
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (filterStatus !== 'all') params.status = filterStatus;
            if (searchQuery.trim()) params.search = searchQuery;

            const { data } = await axios.get('/api/rs/transactions', {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            if (data?.success) {
                setTransactions(data.data || []);
            }
        } catch (err) {
            console.error('Error fetching transactions:', err);
            showToast('Gagal memuat riwayat transaksi', 'error');
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchHospitalInfo = async () => {
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.get('/api/rs/dashboard-data', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data?.success) {
                setHospitalName(data.data.hospital?.hospital_name || '');
                // Extract unique rooms list
                const uniqueRooms = [];
                const seenRoomIds = new Set();
                (data.data.roomLinens || []).forEach(rl => {
                    if (rl.room_id && !seenRoomIds.has(rl.room_id)) {
                        seenRoomIds.add(rl.room_id);
                        uniqueRooms.push({ id: rl.room_id, name: rl.room_name });
                    }
                });
                setRoomsList(uniqueRooms);
            }
        } catch (err) {
            console.error('Error fetching hospital info:', err);
        }
    };

    // Fetch single transaction details, audits, and deliveries
    const handleOpenDetail = async (txId) => {
        setLoadingDetails(true);
        setDetailTab('detail');
        setSelectedSj(null);
        setSjDetails([]);
        setSelectedRoomId('');
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.get(`/api/rs/transactions/${txId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data?.success) {
                setEditingTransaction(data.data);
            }
        } catch (err) {
            console.error('Error fetching transaction detail:', err);
            showToast('Gagal memuat rincian transaksi', 'error');
        } finally {
            setLoadingDetails(false);
        }
    };

    // Fetch a single Surat Jalan (shortage delivery) detail
    const handleViewSj = async (sj) => {
        setLoadingSjDetails(true);
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.get(`/api/rs/kurang-kirim-linen/delivery/${sj.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data?.success) {
                setSelectedSj(data.data.delivery);
                setSjDetails(data.data.details || []);
            }
        } catch (err) {
            console.error('Error fetching SJ details:', err);
            showToast('Gagal memuat rincian Surat Jalan', 'error');
        } finally {
            setLoadingSjDetails(false);
        }
    };

    const handlePrintSj = () => {
        if (selectedSj) {
            exportSuratJalanKurangKirim(selectedSj, sjDetails);
        }
    };

    const handleDownloadExcel = async (e, tx) => {
        e.stopPropagation();
        setDownloadingTxId(tx.id);
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.get(`/api/rs/transactions/${tx.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data?.success) {
                await exportSerahTerimaLinen(data.data.transaction, data.data.details);
                showToast('Berhasil mengunduh dokumen Excel', 'success');
            } else {
                showToast('Gagal memuat rincian transaksi untuk Excel', 'error');
            }
        } catch (err) {
            console.error('Error exporting transaction to Excel:', err);
            showToast('Gagal mengunduh dokumen Excel', 'error');
        } finally {
            setDownloadingTxId(null);
        }
    };

    const handleDownloadPdf = async (e, tx) => {
        e.stopPropagation();
        setDownloadingPdfTxId(tx.id);
        try {
            const token = localStorage.getItem('token');
            const { data } = await axios.get(`/api/rs/transactions/${tx.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data?.success) {
                await exportSerahTerimaLinenPDF(data.data.transaction, data.data.details);
                showToast('Berhasil mengunduh dokumen PDF', 'success');
            } else {
                showToast('Gagal memuat rincian transaksi untuk PDF', 'error');
            }
        } catch (err) {
            console.error('Error exporting transaction to PDF:', err);
            showToast('Gagal mengunduh dokumen PDF', 'error');
        } finally {
            setDownloadingPdfTxId(null);
        }
    };

    // Fetch initial history
    useEffect(() => {
        fetchHistory();
        fetchHospitalInfo();
    }, []);

    // Fetch history when filters change
    useEffect(() => {
        const prev = prevFiltersRef.current;
        const hasChanged = prev.startDate !== startDate ||
            prev.endDate !== endDate ||
            prev.filterStatus !== filterStatus;

        prevFiltersRef.current = { startDate, endDate, filterStatus };

        if (hasChanged) {
            fetchHistory();
        }
    }, [startDate, endDate, filterStatus]);

    // Debounced search query
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchHistory();
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleResetFilters = () => {
        setSearchQuery('');
        setFilterStatus('all');
        setStartDate('');
        setEndDate('');
    };

    return (
        <main className="min-h-screen bg-slate-50 py-6 sm:py-10">
            <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
                <div className="space-y-6">

                    {/* Header */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                    {hospitalName || 'Memuat nama rumah sakit...'}
                                </h2>
                                <p className="text-xs text-slate-400 font-medium">
                                    Portal pencatatan sirkulasi harian linen kotor & pengembalian bersih.
                                </p>
                            </div>
                            <button
                                onClick={fetchHistory}
                                disabled={loadingHistory}
                                className="inline-flex h-10 px-4 items-center justify-center gap-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold text-xs shadow-sm transition active:scale-[0.98] cursor-pointer disabled:opacity-50 self-start md:self-center"
                            >
                                <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                                Segarkan
                            </button>
                        </div>
                    </div>

                    {/* Filters section */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                            {/* Search */}
                            <div className="space-y-1.5 col-span-1 sm:col-span-2 lg:col-span-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Cari Transaksi</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="No. Form / Catatan / Nama..."
                                        className="block w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 transition-all text-slate-800"
                                    />
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Search className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Status</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 transition-all text-slate-700 cursor-pointer"
                                >
                                    <option value="all">Semua Status</option>
                                    <option value="PROSES">Pengambilan Kotor (PROSES)</option>
                                    <option value="SELESAI">Selesai (SELESAI)</option>
                                </select>
                            </div>

                            {/* Start Date */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Mulai Tanggal</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="block w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 transition-all text-slate-700 cursor-pointer"
                                    />
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>

                            {/* End Date */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Sampai Tanggal</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="block w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-teal-500/5 focus:border-teal-500 transition-all text-slate-700 cursor-pointer"
                                    />
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Reset filters link */}
                        {(searchQuery || filterStatus !== 'all' || startDate || endDate) && (
                            <div className="flex justify-end pt-1">
                                <button
                                    type="button"
                                    onClick={handleResetFilters}
                                    className="text-xs font-bold text-teal-600 hover:text-teal-700 transition flex items-center gap-1 cursor-pointer"
                                >
                                    <X className="h-3 w-3" /> Bersihkan Filter
                                </button>
                            </div>
                        )}
                    </div>

                    {/* History Transactions List */}
                    {loadingHistory ? (
                        <div className="py-24 text-center text-slate-400 font-semibold bg-white border border-slate-200 rounded-3xl shadow-sm">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-teal-500 mb-3" />
                            Memuat riwayat transaksi...
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-2">
                            <FileText className="h-10 w-10 text-slate-300 mx-auto" />
                            <h3 className="font-bold text-slate-800 text-sm">Tidak Ada Transaksi</h3>
                            <p className="text-xs text-slate-500 max-w-xs mx-auto">
                                Belum ada catatan transaksi serah terima yang tercatat untuk pencarian atau filter saat ini.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs sm:text-sm border-collapse text-slate-650">
                                    <thead>
                                        <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-widest text-[9px] border-b border-slate-200">
                                            <th className="py-4 px-4 text-center w-12">No</th>
                                            <th className="py-4 px-4 text-left">No. Formulir</th>
                                            <th className="py-4 px-4 text-left">Tanggal</th>
                                            <th className="py-4 px-4 text-left">Valet IKM</th>
                                            <th className="py-4 px-4 text-left">Petugas RS</th>
                                            <th className="py-4 px-4 text-center bg-slate-50/40 w-24">Kotor</th>
                                            <th className="py-4 px-4 text-center bg-teal-50/20 w-24">Bersih</th>
                                            <th className="py-4 px-4 text-center w-28">Status</th>
                                            <th className="py-4 px-4 text-center w-36">Selisih</th>
                                            <th className="py-4 px-4 text-center w-40">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                        {transactions.map((tx, index) => {
                                            const totalShortage = Math.max(0, parseInt(tx.total_qty_kotor || 0) - parseInt(tx.total_qty_bersih || 0));
                                            const hasShortage = totalShortage > 0 && tx.status === 'SELESAI';

                                            return (
                                                <tr
                                                    key={tx.id}
                                                    onClick={() => handleOpenDetail(tx.id)}
                                                    className="hover:bg-slate-50/40 transition-colors cursor-pointer group"
                                                >
                                                    <td className="py-4 px-4 text-center text-slate-400 font-medium">
                                                        {index + 1}
                                                    </td>
                                                    <td className="py-4 px-4 font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                                                        {tx.form_number}
                                                    </td>
                                                    <td className="py-4 px-4 text-left text-slate-500 font-medium whitespace-nowrap">
                                                        {formatDate(tx.pickup_date)}
                                                    </td>
                                                    <td className="py-4 px-4 font-bold text-slate-750">
                                                        {tx.user_pickup_name || '—'}
                                                    </td>
                                                    <td className="py-4 px-4 font-bold text-slate-750">
                                                        {tx.hospital_staff_pickup || '—'}
                                                    </td>
                                                    <td className="py-4 px-4 text-center bg-slate-50/10 text-slate-800 font-extrabold">
                                                        {tx.total_qty_kotor} Pcs
                                                    </td>
                                                    <td className="py-4 px-4 text-center bg-teal-50/[0.05] text-teal-700 font-extrabold">
                                                        {tx.status === 'SELESAI' ? `${tx.total_qty_bersih} Pcs` : '—'}
                                                    </td>
                                                    <td className="py-4 px-4 text-center whitespace-nowrap">
                                                        {tx.status === 'SELESAI' ? (
                                                            hasShortage ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-150 shadow-sm">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                                                    Kurang Kirim
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-150 shadow-sm">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                    Selesai
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-150 shadow-sm">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                Kotor
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4 text-center whitespace-nowrap">
                                                        {tx.status === 'SELESAI' ? (
                                                            hasShortage ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-rose-50 text-rose-650 border border-rose-150 shadow-sm">
                                                                    Selisih {totalShortage} Pcs
                                                                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-650 border border-emerald-150 shadow-sm">
                                                                    Lengkap
                                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-slate-50 text-slate-400 border border-slate-150 shadow-sm">
                                                                Belum Selesai
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDownloadExcel(e, tx)}
                                                                disabled={downloadingTxId === tx.id}
                                                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-200 bg-white hover:bg-teal-50 text-teal-700 text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 hover:shadow duration-200"
                                                                title="Unduh Excel"
                                                            >
                                                                {downloadingTxId === tx.id ? (
                                                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                    </svg>
                                                                )}
                                                                Excel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDownloadPdf(e, tx)}
                                                                disabled={downloadingPdfTxId === tx.id}
                                                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 hover:shadow duration-200"
                                                                title="Unduh PDF"
                                                            >
                                                                {downloadingPdfTxId === tx.id ? (
                                                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <FileText className="h-3.5 w-3.5" />
                                                                )}
                                                                PDF
                                                            </button>
                                                        </div>
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
            </div>

            {/* Details Overlay Modal */}
            {editingTransaction && (() => {
                const modalTotalKotor = (editingTransaction.details || []).reduce((sum, item) => sum + parseInt(item.qty_kotor || 0), 0);
                const modalTotalBersih = (editingTransaction.details || []).reduce((sum, item) => sum + parseInt(item.qty_bersih || 0), 0);
                const modalTotalShortage = Math.max(0, modalTotalKotor - modalTotalBersih);
                const modalHasShortage = modalTotalShortage > 0 && editingTransaction.transaction.status === 'SELESAI';

                return (
                    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col h-[90vh] max-h-[900px] animate-[fadeIn_0.2s_ease-out]">

                            {/* Modal Header */}
                            <div className="p-6 bg-gradient-to-r from-[#126776] to-[#1ea59e] text-white flex justify-between items-start relative shrink-0">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-6 translate-x-6 pointer-events-none" />
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold tracking-widest uppercase bg-white/15 px-3 py-1 rounded-full border border-white/10">
                                            Form Transaksi #{editingTransaction.transaction.id}
                                        </span>
                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${editingTransaction.transaction.status === 'SELESAI'
                                            ? modalHasShortage
                                                ? 'bg-rose-500/25 text-rose-100 border-rose-400/40'
                                                : 'bg-emerald-500/20 text-emerald-250 border-emerald-500/30'
                                            : 'bg-amber-500/20 text-amber-250 border-amber-500/30'
                                            }`}>
                                            {editingTransaction.transaction.status === 'SELESAI'
                                                ? modalHasShortage ? 'Kurang Kirim' : 'Selesai'
                                                : 'Pengambilan Kotor'}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold mt-2 tracking-tight">
                                        No. Formulir: {editingTransaction.transaction.form_number}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setEditingTransaction(null)}
                                    className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            {/* Modal Navigation Tabs */}
                            <div className="border-b border-slate-200 bg-slate-50 px-6 py-2 flex items-center justify-between shrink-0">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setDetailTab('detail'); setSelectedSj(null); }}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${detailTab === 'detail'
                                            ? 'bg-white text-teal-700 shadow-sm border border-slate-200'
                                            : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        <FileText className="h-4 w-4 inline mr-1" />
                                        Detail Transaksi
                                    </button>
                                    <button
                                        onClick={() => { setDetailTab('surat_jalan'); setSelectedSj(null); }}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${detailTab === 'surat_jalan'
                                            ? 'bg-white text-teal-700 shadow-sm border border-slate-200'
                                            : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        <Warehouse className="h-4 w-4 inline mr-1" />
                                        Surat Jalan
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body Container */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                                {/* ======================= TAB 1: DETAIL TRANSAKSI ======================= */}
                                {detailTab === 'detail' && (
                                    <div className="space-y-6">

                                        {/* Info Metadata Block */}
                                        <div className={`grid grid-cols-1 ${editingTransaction.transaction.status === 'SELESAI' ? 'md:grid-cols-2' : ''} gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-150 text-xs`}>

                                            {/* Left Column (Day 1 - Kotor) */}
                                            <div className="space-y-3">
                                                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                                                    Tahap 1: Pengambilan Kotor (Pickup)
                                                </h4>
                                                <div className="grid grid-cols-2 gap-2 text-slate-600">
                                                    <div>
                                                        <p className="font-semibold text-slate-400 uppercase text-[9px] tracking-wider">Valet IKM</p>
                                                        <p className="font-bold text-slate-800 mt-0.5">{toTitleCase(editingTransaction.transaction.user_pickup_name)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-400 uppercase text-[9px] tracking-wider">Tanggal Pengambilan</p>
                                                        <p className="font-semibold text-slate-700 mt-0.5">{formatDate(editingTransaction.transaction.pickup_date)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-400 uppercase text-[9px] tracking-wider">Petugas RS (Penyerah)</p>
                                                        <p className="font-bold text-slate-800 mt-0.5">{editingTransaction.transaction.hospital_staff_pickup || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-400 uppercase text-[9px] tracking-wider">Perawat RS</p>
                                                        <p className="font-bold text-slate-850 mt-0.5">{editingTransaction.transaction.hospital_assistant_pickup || '—'}</p>
                                                    </div>
                                                </div>
                                                <div className="p-2 bg-white rounded-lg border border-slate-200">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Catatan Pengambilan</p>
                                                    <p className="text-slate-600 mt-0.5 italic">{editingTransaction.transaction.notes_pickup || '—'}</p>
                                                </div>
                                            </div>

                                            {/* Right Column (Day 2 - Bersih) */}
                                            {editingTransaction.transaction.status === 'SELESAI' && (
                                                <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-200 md:pl-6">
                                                    <h4 className="font-bold text-teal-700 text-xs uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-1.5">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                                                        Tahap 2: Penerimaan Bersih (Delivery)
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                                                        <div>
                                                            <p className="font-semibold text-slate-400 uppercase text-[9px] tracking-wider">Valet IKM</p>
                                                            <p className="font-bold text-slate-800 mt-0.5">{toTitleCase(editingTransaction.transaction.user_delivery_name || '')}</p>
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-slate-400 uppercase text-[9px] tracking-wider">Tanggal Penerimaan</p>
                                                            <p className="font-semibold text-slate-700 mt-0.5">{formatDate(editingTransaction.transaction.delivery_date)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-slate-400 uppercase text-[9px] tracking-wider">Petugas RS (Penerima)</p>
                                                            <p className="font-bold text-slate-800 mt-0.5">{editingTransaction.transaction.hospital_staff_delivery || '—'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-slate-400 uppercase text-[9px] tracking-wider">Perawat RS</p>
                                                            <p className="font-bold text-slate-850 mt-0.5">{editingTransaction.transaction.hospital_assistant_delivery || '—'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Catatan Penerimaan</p>
                                                        <p className="text-slate-600 mt-0.5 italic">{editingTransaction.transaction.notes_delivery || '—'}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Room Filter Dropdown */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="relative min-w-[200px]">
                                                <select
                                                    value={selectedRoomId}
                                                    onChange={e => setSelectedRoomId(e.target.value)}
                                                    className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-[#1ea59e]/10 focus:border-[#1ea59e] cursor-pointer appearance-none shadow-sm"
                                                >
                                                    <option value="">Semua Ruangan</option>
                                                    {roomsList.map(room => (
                                                        <option key={room.id} value={room.id}>{room.name}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                                                    <ChevronRight className="w-4 h-4 rotate-90" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Items list Table */}
                                        <div className="border border-slate-200 rounded-3xl shadow-sm overflow-hidden bg-white">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                                                        <th className="py-3 px-4 text-center">No</th>
                                                        <th className="py-3 px-4">Nama Linen</th>
                                                        <th className="py-3 px-4 text-center">Ruangan</th>
                                                        <th className="py-3 px-4 text-center">Unit</th>
                                                        <th className="py-3 px-4 text-center bg-slate-100/50">Qty Kotor (Pickup)</th>
                                                        <th className="py-3 px-4 text-center bg-teal-50/50">Qty Bersih (Received)</th>
                                                        <th className="py-3 px-4 text-center">Selisih</th>
                                                        <th className="py-3 px-4">Keterangan</th>
                                                        {editingTransaction && (() => {
                                                            const isPickupUnsigned = editingTransaction.transaction.status === 'PROSES' || !editingTransaction.transaction.signature_valet_delivery || !editingTransaction.transaction.signature_hospital_delivery;
                                                            return isPickupUnsigned && <th className="py-3 px-4 text-center">Aksi</th>;
                                                        })()}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-150 text-slate-700 font-semibold">
                                                    {(() => {
                                                        const isPickupUnsigned = editingTransaction.transaction.status === 'PROSES' || !editingTransaction.transaction.signature_valet_delivery || !editingTransaction.transaction.signature_hospital_delivery;
                                                        const filteredDetails = (() => {
                                                            if (selectedRoomId) {
                                                                return editingTransaction.details.filter(item => item.room_id === parseInt(selectedRoomId));
                                                            } else {
                                                                const grouped = {};
                                                                editingTransaction.details.forEach(item => {
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

                                                        if (filteredDetails.length === 0) {
                                                            return (
                                                                <tr>
                                                                    <td colSpan={isPickupUnsigned ? 9 : 8} className="py-8 text-center text-slate-400 font-semibold text-xs">
                                                                        Tidak ada data linen untuk ruangan ini.
                                                                    </td>
                                                                </tr>
                                                            );
                                                        }

                                                        return filteredDetails.map((item, idx) => {
                                                            const kotor = parseInt(item.qty_kotor || 0);
                                                            const bersih = parseInt(item.qty_bersih || 0);
                                                            const selisih = Math.max(0, kotor - bersih);
                                                            const isShort = selisih > 0 && editingTransaction.transaction.status === 'SELESAI';

                                                            const canEditItemDirectly = !item.isGrouped || item.originalItemIds.length === 1;
                                                            const targetItemId = item.isGrouped ? item.originalItemIds[0] : item.id;
                                                            const isEditing = editingItemId === targetItemId;

                                                            return (
                                                                <Fragment key={item.id}>
                                                                    <tr className="hover:bg-slate-50/50 transition-colors">
                                                                        <td className="py-3 px-4 text-center text-slate-400">{idx + 1}</td>
                                                                        <td className="py-3 px-4 text-slate-800 font-bold">
                                                                            <div>{getLinenDisplayName(item)}</div>
                                                                        </td>
                                                                        <td className="py-3 px-4 text-center">
                                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                                {item.room_name || 'Semua Ruangan'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-3 px-4 text-center text-slate-500">{item.unit || 'Pcs'}</td>
                                                                        <td className="py-3 px-4 text-center bg-slate-100/30 text-slate-800 font-bold">
                                                                            {isPickupUnsigned && isEditing ? (
                                                                                <input
                                                                                    type="number"
                                                                                    className="w-16 px-1.5 py-1 bg-white border border-slate-300 rounded text-center text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                                                                                    value={editQtyKotor}
                                                                                    disabled={savingEdit}
                                                                                    onChange={e => setEditQtyKotor(e.target.value)}
                                                                                />
                                                                            ) : (
                                                                                kotor
                                                                            )}
                                                                        </td>
                                                                        <td className="py-3 px-4 text-center bg-teal-50/30 text-teal-700 font-bold">
                                                                            {editingTransaction.transaction.status === 'SELESAI' ? bersih : '—'}
                                                                        </td>
                                                                        <td className="py-3 px-4 text-center">
                                                                            {editingTransaction.transaction.status === 'SELESAI' ? (
                                                                                <span className={`inline-flex px-2 py-0.5 rounded font-bold ${isShort ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                                                                                    {selisih}
                                                                                </span>
                                                                            ) : '—'}
                                                                        </td>
                                                                        <td className="py-3 px-4 font-normal text-slate-500 italic max-w-[150px] truncate" title={item.notes || ''}>
                                                                            {isPickupUnsigned && isEditing ? (
                                                                                <input
                                                                                    type="text"
                                                                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                                                                                    value={editItemNotesState}
                                                                                    disabled={savingEdit}
                                                                                    onChange={e => setEditItemNotesState(e.target.value)}
                                                                                />
                                                                            ) : (
                                                                                item.notes || '—'
                                                                            )}
                                                                        </td>
                                                                        {isPickupUnsigned && (
                                                                            <td className="py-3 px-4 text-center">
                                                                                <div className="flex items-center justify-center gap-1.5">
                                                                                    {canEditItemDirectly ? (
                                                                                        isEditing ? (
                                                                                            <>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => handleSaveEdit(targetItemId)}
                                                                                                    disabled={savingEdit}
                                                                                                    className="p-1 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 rounded transition disabled:opacity-50"
                                                                                                    title="Simpan"
                                                                                                >
                                                                                                    <Save className="w-4 h-4" />
                                                                                                </button>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => setEditingItemId(null)}
                                                                                                    disabled={savingEdit}
                                                                                                    className="p-1 hover:bg-slate-150 text-slate-500 hover:text-slate-600 rounded transition disabled:opacity-50"
                                                                                                    title="Batal"
                                                                                                >
                                                                                                    <Undo className="w-4 h-4" />
                                                                                                </button>
                                                                                            </>
                                                                                        ) : (
                                                                                            <>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => startEdit(targetItemId, kotor, item.notes)}
                                                                                                    className="p-1 hover:bg-teal-50 text-teal-650 hover:text-teal-700 rounded transition"
                                                                                                    title="Edit"
                                                                                                >
                                                                                                    <Edit2 className="w-4 h-4" />
                                                                                                </button>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => handleDeleteItem(targetItemId)}
                                                                                                    className="p-1 hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded transition"
                                                                                                    title="Hapus"
                                                                                                >
                                                                                                    <Trash2 className="w-4 h-4" />
                                                                                                </button>
                                                                                            </>
                                                                                        )
                                                                                    ) : (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setExpandedGroupedLid(expandedGroupedLid === item.hospital_linen_id ? null : item.hospital_linen_id)}
                                                                                            className="px-2.5 py-1 rounded bg-[#126776]/5 hover:bg-[#126776]/10 text-[#126776] text-[10px] font-extrabold border border-[#126776]/15 flex items-center gap-1 transition shadow-sm"
                                                                                        >
                                                                                            {expandedGroupedLid === item.hospital_linen_id ? 'Tutup' : 'Ubah Ruangan'}
                                                                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedGroupedLid === item.hospital_linen_id ? 'transform rotate-180' : ''}`} />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                    {item.isGrouped && item.originalItemIds.length > 1 && expandedGroupedLid === item.hospital_linen_id && (
                                                                        editingTransaction.details
                                                                            .filter(d => d.hospital_linen_id === item.hospital_linen_id)
                                                                            .map((subItem, sidx) => {
                                                                                const isSubEditing = editingItemId === subItem.id;
                                                                                return (
                                                                                    <tr key={subItem.id} className="bg-slate-50/70 border-l-4 border-[#1ea59e]/70 transition">
                                                                                        <td className="py-2.5 px-4 text-center text-slate-400 font-medium">{idx + 1}.{sidx + 1}</td>
                                                                                        <td className="py-2.5 px-4 text-slate-500 font-bold pl-6">
                                                                                            <span className="text-[#1ea59e] font-bold mr-1.5">└─</span>
                                                                                            {getLinenDisplayName(subItem)}
                                                                                        </td>
                                                                                        <td className="py-2.5 px-4 text-center">
                                                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-white text-slate-600 border border-slate-200 shadow-sm">
                                                                                                {subItem.room_name || 'Semua Ruangan'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-2.5 px-4 text-center text-slate-400">{subItem.unit || 'Pcs'}</td>
                                                                                        <td className="py-2.5 px-4 text-center bg-slate-100/10 text-slate-800 font-bold">
                                                                                            {isSubEditing ? (
                                                                                                <input
                                                                                                    type="number"
                                                                                                    className="w-16 px-1.5 py-1 bg-white border border-slate-300 rounded text-center text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                                                                                                    value={editQtyKotor}
                                                                                                    disabled={savingEdit}
                                                                                                    onChange={e => setEditQtyKotor(e.target.value)}
                                                                                                />
                                                                                            ) : (
                                                                                                subItem.qty_kotor
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="py-2.5 px-4 text-center text-slate-400">—</td>
                                                                                        <td className="py-2.5 px-4 text-center text-slate-400">—</td>
                                                                                        <td className="py-2.5 px-4 font-normal text-slate-500 italic max-w-[150px] truncate" title={subItem.notes || ''}>
                                                                                            {isSubEditing ? (
                                                                                                <input
                                                                                                    type="text"
                                                                                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                                                                                                    value={editItemNotesState}
                                                                                                    disabled={savingEdit}
                                                                                                    onChange={e => setEditItemNotesState(e.target.value)}
                                                                                                />
                                                                                            ) : (
                                                                                                subItem.notes || '—'
                                                                                            )}
                                                                                        </td>
                                                                                        {isPickupUnsigned && (
                                                                                            <td className="py-2.5 px-4 text-center">
                                                                                                <div className="flex items-center justify-center gap-1.5">
                                                                                                    {isSubEditing ? (
                                                                                                        <>
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                onClick={() => handleSaveEdit(subItem.id)}
                                                                                                                disabled={savingEdit}
                                                                                                                className="p-1 hover:bg-emerald-50 text-emerald-650 hover:text-emerald-700 rounded transition disabled:opacity-50"
                                                                                                                title="Simpan"
                                                                                                            >
                                                                                                                <Save className="w-3.5 h-3.5" />
                                                                                                            </button>
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                onClick={() => setEditingItemId(null)}
                                                                                                                disabled={savingEdit}
                                                                                                                className="p-1 hover:bg-slate-150 text-slate-500 hover:text-slate-600 rounded transition disabled:opacity-50"
                                                                                                                title="Batal"
                                                                                                            >
                                                                                                                <Undo className="w-3.5 h-3.5" />
                                                                                                            </button>
                                                                                                        </>
                                                                                                    ) : (
                                                                                                        <>
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                onClick={() => startEdit(subItem.id, subItem.qty_kotor, subItem.notes)}
                                                                                                                className="p-1 hover:bg-teal-50 text-teal-650 hover:text-teal-700 rounded transition"
                                                                                                                title="Edit"
                                                                                                            >
                                                                                                                <Edit2 className="w-3.5 h-3.5" />
                                                                                                            </button>
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                onClick={() => handleDeleteItem(subItem.id)}
                                                                                                                className="p-1 hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded transition"
                                                                                                                title="Hapus"
                                                                                                            >
                                                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                                                            </button>
                                                                                                        </>
                                                                                                    )}
                                                                                                </div>
                                                                                            </td>
                                                                                        )}
                                                                                    </tr>
                                                                                );
                                                                            })
                                                                    )}
                                                                </Fragment>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Signatures block */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">

                                            {/* Pickup Signatures */}
                                            <div className="space-y-4">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                                    <Warehouse className="h-4 w-4 text-slate-400" />
                                                    Tanda Tangan Tahap 1 (Pickup)
                                                </h4>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="border border-slate-200 rounded-xl p-3 bg-white text-center flex flex-col justify-between h-[180px]">
                                                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Valet</span>
                                                        <div className="flex-1 flex items-center justify-center p-1 bg-slate-50 rounded border border-slate-100 my-2 overflow-hidden">
                                                            {editingTransaction.transaction.signature_valet_pickup ? (
                                                                <img src={editingTransaction.transaction.signature_valet_pickup} alt="Valet Signature" className="max-h-[80px] object-contain" />
                                                            ) : (

                                                                <span className="text-[9px] text-slate-350 italic">Tidak ada</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-teal-700 truncate">({toTitleCase(editingTransaction.transaction.user_pickup_name || '')})</span>
                                                    </div>

                                                    <div className="border border-slate-200 rounded-xl p-3 bg-white text-center flex flex-col justify-between h-[180px]">
                                                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Petugas RS</span>
                                                        <div className="flex-1 flex items-center justify-center p-1 bg-slate-50 rounded border border-slate-100 my-2 overflow-hidden">
                                                            {editingTransaction.transaction.signature_hospital_pickup ? (
                                                                <img src={editingTransaction.transaction.signature_hospital_pickup} alt="Hospital Signature" className="max-h-[80px] object-contain" />
                                                            ) : (
                                                                <span className="text-[9px] text-slate-350 italic">Tidak ada</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-teal-700 truncate">({editingTransaction.transaction.hospital_staff_pickup ? toTitleCase(editingTransaction.transaction.hospital_staff_pickup) : '—'})</span>
                                                    </div>

                                                    <div className="border border-slate-200 rounded-xl p-3 bg-white text-center flex flex-col justify-between h-[180px]">
                                                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Perawat RS</span>
                                                        <div className="flex-1 flex items-center justify-center p-1 bg-slate-50 rounded border border-slate-100 my-2 overflow-hidden">
                                                            {editingTransaction.transaction.signature_assistant_pickup ? (
                                                                <img src={editingTransaction.transaction.signature_assistant_pickup} alt="Assistant Signature" className="max-h-[80px] object-contain" />
                                                            ) : (
                                                                <span className="text-[9px] text-slate-350 italic">Tidak ada</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-teal-700 truncate">({editingTransaction.transaction.hospital_assistant_pickup ? toTitleCase(editingTransaction.transaction.hospital_assistant_pickup) : '—'})</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Delivery Signatures */}
                                            {editingTransaction.transaction.status === 'SELESAI' && (
                                                <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-200 md:pl-6">
                                                    <h4 className="text-xs font-bold text-teal-700 uppercase tracking-widest flex items-center gap-1">
                                                        <Warehouse className="h-4 w-4 text-teal-600" />
                                                        Tanda Tangan Tahap 2 (Delivery)
                                                    </h4>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div className="border border-slate-200 rounded-xl p-3 bg-white text-center flex flex-col justify-between h-[180px]">
                                                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Valet</span>
                                                            <div className="flex-1 flex items-center justify-center p-1 bg-slate-50 rounded border border-slate-100 my-2 overflow-hidden">
                                                                {editingTransaction.transaction.signature_valet_delivery ? (
                                                                    <img src={editingTransaction.transaction.signature_valet_delivery} alt="Valet Signature" className="max-h-[80px] object-contain" />
                                                                ) : (
                                                                    <span className="text-[9px] text-slate-350 italic">Tidak ada</span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-bold text-teal-700 truncate">({toTitleCase(editingTransaction.transaction.user_delivery_name || '')})</span>
                                                        </div>

                                                        <div className="border border-slate-200 rounded-xl p-3 bg-white text-center flex flex-col justify-between h-[180px]">
                                                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Petugas RS</span>
                                                            <div className="flex-1 flex items-center justify-center p-1 bg-slate-50 rounded border border-slate-100 my-2 overflow-hidden">
                                                                {editingTransaction.transaction.signature_hospital_delivery ? (
                                                                    <img src={editingTransaction.transaction.signature_hospital_delivery} alt="Hospital Signature" className="max-h-[80px] object-contain" />
                                                                ) : (
                                                                    <span className="text-[9px] text-slate-350 italic">Tidak ada</span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-bold text-teal-700 truncate">({editingTransaction.transaction.hospital_staff_delivery ? toTitleCase(editingTransaction.transaction.hospital_staff_delivery) : '—'})</span>
                                                        </div>

                                                        <div className="border border-slate-200 rounded-xl p-3 bg-white text-center flex flex-col justify-between h-[180px]">
                                                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Perawat RS</span>
                                                            <div className="flex-1 flex items-center justify-center p-1 bg-slate-50 rounded border border-slate-100 my-2 overflow-hidden">
                                                                {editingTransaction.transaction.signature_assistant_delivery ? (
                                                                    <img src={editingTransaction.transaction.signature_assistant_delivery} alt="Assistant Signature" className="max-h-[80px] object-contain" />
                                                                ) : (
                                                                    <span className="text-[9px] text-slate-350 italic">Tidak ada</span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-bold text-teal-700 truncate">({editingTransaction.transaction.hospital_assistant_delivery ? toTitleCase(editingTransaction.transaction.hospital_assistant_delivery) : '—'})</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ======================= TAB 2: SURAT JALAN ======================= */}
                                {detailTab === 'surat_jalan' && (
                                    <div className="space-y-6">

                                        {(!editingTransaction.deliveries || editingTransaction.deliveries.length === 0) ? (
                                            modalHasShortage ? (
                                                <div className="py-16 text-center bg-amber-500/[0.04] border border-dashed border-amber-300 rounded-3xl flex flex-col justify-center items-center gap-3 p-6">
                                                    <div className="p-3.5 bg-amber-100/80 rounded-2xl border border-amber-200">
                                                        <Clock className="h-8 w-8 text-amber-600 animate-pulse" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-amber-900 text-base">Dalam Proses Inputasi Surat Jalan</h3>
                                                        <p className="text-xs text-amber-700 max-w-md mx-auto mt-1.5 leading-relaxed font-medium">
                                                            Terdapat selisih kekurangan sebanyak <span className="font-extrabold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">{modalTotalShortage} Pcs</span> yang wajib diselesaikan. Surat jalan pengiriman susulan saat ini dalam proses penginputan oleh petugas IKM.
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-16 text-center bg-emerald-500/[0.03] border border-dashed border-emerald-200 rounded-3xl flex flex-col justify-center items-center gap-3 p-6">
                                                    <div className="p-3.5 bg-emerald-100/80 rounded-2xl border border-emerald-200">
                                                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-emerald-800 text-base">Tidak Ada Proses Kurang Kirim</h3>
                                                        <p className="text-xs text-emerald-600 max-w-md mx-auto mt-1.5 leading-relaxed font-medium">
                                                            Seluruh linen kotor yang dikirimkan telah diterima dengan lengkap tanpa adanya selisih/kekurangan.
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        ) : (
                                            <div>
                                                {/* Left: list of Surat Jalan, Right: selected Surat Jalan preview */}
                                                {!selectedSj ? (
                                                    <div className="space-y-4">
                                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Daftar Surat Jalan Kurang Kirim</h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {editingTransaction.deliveries.map((sj, index) => (
                                                                <div
                                                                    key={sj.id}
                                                                    onClick={() => handleViewSj(sj)}
                                                                    className="bg-white border border-slate-200 hover:border-teal-500/30 p-5 rounded-2xl shadow-sm hover:shadow transition-all duration-300 flex justify-between items-center cursor-pointer active:scale-[0.99]"
                                                                >
                                                                    <div className="space-y-1.5">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No. Surat Jalan</span>
                                                                            <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[9px] font-extrabold rounded-full border border-teal-100">SJ KK</span>
                                                                        </div>
                                                                        <h4 className="text-sm font-bold text-slate-800">{sj.surat_jalan_number}</h4>
                                                                        <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Tanggal: {formatDate(sj.delivery_date)}</p>
                                                                    </div>
                                                                    <div className="text-right space-y-1">
                                                                        <span className="text-xs font-extrabold text-teal-600 block">{sj.total_qty_delivered} Pcs</span>
                                                                        <button className="text-[10px] font-bold text-teal-600 group-hover:text-teal-700 flex items-center gap-0.5">
                                                                            Lihat <ChevronRight className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-5 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm">

                                                        {/* Inner Header with navigation controls */}
                                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-150 pb-4">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedSj(null)}
                                                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs shadow-sm transition active:scale-[0.98] cursor-pointer"
                                                            >
                                                                <ArrowLeft className="h-3.5 w-3.5" />
                                                                Kembali ke Daftar Surat Jalan
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={handlePrintSj}
                                                                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#126776] to-[#1ea59e] hover:from-[#0e5562] hover:to-[#188b85] text-white font-bold text-xs shadow-sm transition active:scale-[0.98] cursor-pointer"
                                                            >
                                                                <Printer className="h-4 w-4" />
                                                                Cetak Surat Jalan
                                                            </button>
                                                        </div>

                                                        {loadingSjDetails ? (
                                                            <div className="py-12 text-center text-slate-400 font-semibold">
                                                                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-teal-500 mb-2" />
                                                                Memuat rincian Surat Jalan...
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-6">

                                                                {/* SJ Metadata */}
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150 text-[11px] text-slate-650 font-semibold leading-relaxed">
                                                                    <div className="space-y-1">
                                                                        <p className="flex"><span className="w-28 font-bold text-slate-400 uppercase tracking-wide text-[9px]">Penerima:</span> <span className="font-bold text-slate-900">{selectedSj.recipient_name}</span></p>
                                                                        <p className="flex"><span className="w-28 font-bold text-slate-400 uppercase tracking-wide text-[9px]">Petugas RS:</span> <span className="font-semibold text-slate-800">{selectedSj.hospital_staff || '—'}</span></p>
                                                                        <p className="flex"><span className="w-28 font-bold text-slate-400 uppercase tracking-wide text-[9px]">Form Transaksi Asal:</span> <span className="font-bold text-slate-800">{selectedSj.original_form_number || '—'}</span></p>
                                                                        <p className="flex"><span className="w-28 font-bold text-slate-400 uppercase tracking-wide text-[9px]">Tgl Pengambilan:</span> <span className="font-semibold text-slate-700">{selectedSj.original_pickup_date ? new Date(selectedSj.original_pickup_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span></p>
                                                                    </div>
                                                                    <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200 sm:pl-4">
                                                                        <p className="flex"><span className="w-28 font-bold text-slate-400 uppercase tracking-wide text-[9px]">Tgl Pengiriman:</span> <span className="font-semibold text-slate-800">{new Date(selectedSj.delivery_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
                                                                        <p className="flex"><span className="w-28 font-bold text-slate-400 uppercase tracking-wide text-[9px]">Jam Pengiriman:</span> <span className="font-bold text-slate-900">{new Date(selectedSj.delivery_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span></p>
                                                                        <p className="flex"><span className="w-28 font-bold text-slate-400 uppercase tracking-wide text-[9px]">No. Kendaraan:</span> <span className="font-bold text-slate-800">{selectedSj.vehicle_number || '—'}</span></p>
                                                                        <p className="flex"><span className="w-28 font-bold text-slate-400 uppercase tracking-wide text-[9px]">Valet Pengirim:</span> <span className="font-bold text-slate-900">{selectedSj.valet_name || '—'}</span></p>
                                                                    </div>
                                                                </div>

                                                                {/* Delivered Items Table */}
                                                                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                                                                    <table className="w-full text-left text-xs border-collapse">
                                                                        <thead>
                                                                            <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                                                                                <th className="py-2.5 px-3 text-center">No</th>
                                                                                <th className="py-2.5 px-3">Nama Barang</th>
                                                                                <th className="py-2.5 px-3 text-center">Jumlah</th>
                                                                                <th className="py-2.5 px-3 text-center">Berat (Gram)</th>
                                                                                <th className="py-2.5 px-3">Keterangan</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-150 font-semibold text-slate-700">
                                                                            {sjDetails.map((item, idx) => {
                                                                                const qty = item.qty_delivered || item.qtyDelivered || 0;
                                                                                const grammage = parseFloat(item.grammage || 0);
                                                                                const weight = grammage * qty;
                                                                                const formattedWeight = weight > 0 ? weight.toLocaleString('id-ID') : '—';

                                                                                return (
                                                                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                                                        <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                                                                                        <td className="py-2.5 px-3 text-slate-800 font-bold">{getLinenDisplayName(item)}</td>
                                                                                        <td className="py-2.5 px-3 text-center text-teal-700 font-bold">{qty} Pcs</td>
                                                                                        <td className="py-2.5 px-3 text-center text-slate-500">{formattedWeight}</td>
                                                                                        <td className="py-2.5 px-3 text-slate-500 italic font-normal">{item.notes || '—'}</td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>

                                                                {/* Signatures block for SJ */}
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="border border-slate-200 rounded-xl p-3 bg-white text-center flex flex-col justify-between h-[180px]">
                                                                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Diterima Oleh</span>
                                                                        <div className="flex-1 flex items-center justify-center p-1 bg-slate-50 rounded border border-slate-100 my-2 overflow-hidden">
                                                                            {selectedSj.signature_hospital ? (
                                                                                <img src={selectedSj.signature_hospital} alt="Hospital Recipient Signature" className="max-h-[80px] object-contain" />
                                                                            ) : (
                                                                                <span className="text-[9px] text-slate-350 italic">Tidak ada</span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-[10px] font-bold text-teal-700 truncate">({toTitleCase(selectedSj.hospital_staff || selectedSj.recipient_name || '')})</span>
                                                                    </div>
                                                                    <div className="border border-slate-200 rounded-xl p-3 bg-white text-center flex flex-col justify-between h-[180px]">
                                                                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Diserahkan Oleh</span>
                                                                        <div className="flex-1 flex items-center justify-center p-1 bg-slate-50 rounded border border-slate-100 my-2 overflow-hidden">
                                                                            {selectedSj.signature_valet ? (
                                                                                <img src={selectedSj.signature_valet} alt="Valet Courier Signature" className="max-h-[80px] object-contain" />
                                                                            ) : (
                                                                                <span className="text-[9px] text-slate-350 italic">Tidak ada</span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-[10px] font-bold text-teal-700 truncate">({toTitleCase(selectedSj.valet_name || '')})</span>
                                                                    </div>
                                                                </div>

                                                            </div>
                                                        )}

                                                    </div>
                                                )}
                                            </div>
                                        )}

                                    </div>
                                )}

                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 bg-slate-50 border-t border-slate-250 flex justify-end shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setEditingTransaction(null)}
                                    className="px-6 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
                                >
                                    Tutup
                                </button>
                            </div>

                        </div>
                    </div>
                );
            })()}

            {/* CSS keyframe animations */}
            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </main>
    );
}
