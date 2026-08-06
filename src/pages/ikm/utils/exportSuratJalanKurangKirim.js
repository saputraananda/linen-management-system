import kopSuratIkm from '../../../assets/images/kop_surat_ikm.png';

/**
 * Utility to print/export Surat Jalan Kurang Kirim to PDF / printer
 * Consists of Page 1: Global Summary and Page 2+: Room details using corporate letterhead kop_surat_ikm.png
 */
export default function exportSuratJalanKurangKirim(delivery, details) {
  const printWindow = window.open('', '_blank', 'width=950,height=1200');
  if (!printWindow) {
    const toast = document.createElement('div');
    toast.className = "fixed bottom-5 right-5 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border border-rose-100 bg-white/95 backdrop-blur-md min-w-[280px] text-xs font-semibold text-rose-700 animate-[slideIn_0.3s_ease-out]";
    toast.style.fontFamily = "sans-serif";
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "9999";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.background = "rgba(255,255,255,0.95)";
    toast.style.border = "1px solid #ffe4e6";
    toast.style.borderRadius = "16px";
    toast.style.padding = "12px 16px";
    toast.style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)";
    toast.innerHTML = `
      <div style="background:#fff1f2;padding:6px;border-radius:8px;color:#e11d48;margin-right:10px;display:inline-flex;font-weight:bold;">⚠️</div>
      <div>
        <p style="margin:0;font-weight:bold;color:#1e293b;">Gagal Cetak</p>
        <p style="margin:2px 0 0;color:#e11d48;font-size:10px;">Pastikan pop-up blocker browser Anda dinonaktifkan.</p>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4500);
    return;
  }

  // Format date and time to match preview format (e.g. 22 Juli 2026 & 17.20)
  const d = new Date(delivery.delivery_date || new Date());
  const formattedDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const rawTime = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const formattedTime = rawTime.replace(':', '.');

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

  // Original pickup date (Tanggal Pengambilan)
  let formattedPickupDate = '—';
  if (delivery.original_pickup_date) {
    const pDate = new Date(delivery.original_pickup_date);
    formattedPickupDate = pDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const hospitalRecipientName = delivery.hospital_staff || delivery.recipient_name || 'PETUGAS RS';
  const valetCourierName = delivery.valet_name || 'ABDUL ARIPIN';

  // 1. Build Global Summary details
  const globalSummaryMap = {};
  details.forEach(item => {
    const qty = parseInt(item.qty_delivered || item.qtyDelivered || 0);
    if (qty <= 0) return;

    const key = item.hospital_linen_id || getLinenDisplayName(item);
    if (!globalSummaryMap[key]) {
      globalSummaryMap[key] = {
        ...item,
        qty: 0,
        notesList: []
      };
    }
    globalSummaryMap[key].qty += qty;
    if (item.notes && item.notes.trim() !== '' && item.notes !== '—') {
      globalSummaryMap[key].notesList.push(item.notes.trim());
    }
  });

  const globalDetails = Object.values(globalSummaryMap).map(item => ({
    ...item,
    qty_delivered: item.qty,
    notes: item.notesList.length > 0 ? item.notesList.join('; ') : '—'
  }));

  const globalRowsHtml = globalDetails.map((item, idx) => {
    const qty = item.qty_delivered;
    const notes = item.notes;
    const grammage = parseFloat(item.grammage || 0);
    const weight = grammage * qty;
    const formattedWeight = weight > 0 ? weight.toLocaleString('id-ID') : '—';
    
    return `
      <tr style="color: #0f172a; border-bottom: 1px solid #0f172a;">
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${idx + 1}</td>
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a;">${getLinenDisplayName(item)}</td>
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${qty}</td>
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${formattedWeight}</td>
        <td style="padding: 10px 16px; color: #475569; font-style: italic;">${notes}</td>
      </tr>
    `;
  }).join('');

  // 2. Build Room Details Pages
  const roomGroups = {};
  details.forEach(item => {
    const qty = parseInt(item.qty_delivered || item.qtyDelivered || 0);
    if (qty <= 0) return;

    const rName = item.room_name || 'Tanpa Ruangan';
    if (!roomGroups[rName]) {
      roomGroups[rName] = [];
    }
    roomGroups[rName].push(item);
  });

  const roomPagesHtml = Object.entries(roomGroups).map(([rName, roomItems]) => {
    const roomRowsHtml = roomItems.map((item, idx) => {
      const qty = parseInt(item.qty_delivered || item.qtyDelivered || 0);
      const notes = item.notes || '—';
      const grammage = parseFloat(item.grammage || 0);
      const weight = grammage * qty;
      const formattedWeight = weight > 0 ? weight.toLocaleString('id-ID') : '—';
      
      return `
        <tr style="color: #0f172a; border-bottom: 1px solid #0f172a;">
          <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${idx + 1}</td>
          <td style="padding: 10px 16px; border-right: 1px solid #0f172a;">${getLinenDisplayName(item)}</td>
          <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${qty}</td>
          <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${formattedWeight}</td>
          <td style="padding: 10px 16px; color: #475569; font-style: italic;">${notes}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="paper-card room-page-break">
        <!-- Letterhead Image -->
        <img src="${kopSuratIkm}" style="width: 100%; display: block;" />

        <div class="paper-content">
          <!-- Document Title & Room Subheading -->
          <div style="text-align: center; margin-top: -55px; margin-bottom: 15px;">
            <h1 style="font-size: 20px; font-weight: 900; letter-spacing: 0.1em; color: #0f172a; margin: 0; line-height: 1; text-transform: uppercase;">SURAT JALAN</h1>
            <p style="font-size: 11px; font-weight: 700; color: #64748b; margin-top: 5px; margin-bottom: 0; text-transform: uppercase; letter-spacing: 0.05em;">No. ${delivery.surat_jalan_number || '(Otomatis)'}</p>
            <p style="font-size: 11px; font-weight: 800; color: #1ea59e; margin-top: 5px; margin-bottom: 0; text-transform: uppercase; letter-spacing: 0.05em;">Unit: ${rName}</p>
          </div>

          <!-- Info Block -->
          <div style="display: flex; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #0f172a; font-size: 11px; font-weight: 600; color: #475569;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 140px; font-weight: 700; color: #94a3b8;">Kepada Yth:</span> <span style="font-weight: 700; color: #0f172a;">${delivery.recipient_name || 'Rumah Sakit'}</span></p>
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 140px; font-weight: 700; color: #94a3b8;">Tanggal Pengambilan:</span> <span style="color: #0f172a; font-weight: 700;">${formattedPickupDate}</span></p>
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 140px; font-weight: 700; color: #94a3b8;">Form Transaksi Asal:</span> <span style="color: #0f172a;">${delivery.original_form_number || '—'}</span></p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px; text-align: left;">
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 120px; font-weight: 700; color: #94a3b8;">Tanggal Pengiriman:</span> <span style="color: #0f172a;">${formattedDate}</span></p>
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 120px; font-weight: 700; color: #94a3b8;">Jam:</span> <span style="color: #0f172a;">${formattedTime}</span></p>
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 120px; font-weight: 700; color: #94a3b8;">No. Kendaraan:</span> <span style="color: #0f172a;">${delivery.vehicle_number || '—'}</span></p>
            </div>
          </div>

          <!-- Items Table -->
          <div style="padding: 15px 0;">
            <table style="width: 100%; text-align: left; border-collapse: collapse; border: 1px solid #0f172a; font-size: 11px; font-weight: 600;">
              <thead>
                <tr style="background-color: #f1f5f9; color: #0f172a; text-transform: uppercase; font-weight: 900; border-bottom: 1px solid #0f172a; font-size: 9px; letter-spacing: 0.05em;">
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 48px;">NO</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center;">NAMA BARANG</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 96px;">JUMLAH</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 96px;">BERAT (GRAM)</th>
                  <th style="padding: 8px 16px; text-align: center;">KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                ${roomRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Signatures -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 24px; text-align: center; font-size: 11px; font-weight: 700; color: #0f172a;">
            <tr>
              <td style="width: 48%; vertical-align: top;">
                <p style="margin: 0 0 12px 0;">Di Terima Oleh :</p>
                <div style="height: 96px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #ffffff;">
                  ${delivery.signature_hospital ? `<img src="${delivery.signature_hospital}" alt="Hospital signature" style="height: 100%; object-fit: contain;" />` : '<span style="font-size: 10px; color: #94a3b8; font-style: italic;">Tidak ada tanda tangan</span>'}
                </div>
                <p style="border-top: 1px solid #0f172a; padding-top: 6px; margin: 12px 0 0 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">${hospitalRecipientName}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #475569; font-weight: 600;">Tim Linen RS</p>
              </td>
              
              <td style="width: 4%;"></td>

              <td style="width: 48%; vertical-align: top;">
                <p style="margin: 0 0 12px 0;">Di Serahkan Oleh :</p>
                <div style="height: 96px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #ffffff;">
                  ${delivery.signature_valet ? `<img src="${delivery.signature_valet}" alt="Valet signature" style="height: 100%; object-fit: contain;" />` : '<span style="font-size: 10px; color: #94a3b8; font-style: italic;">Tidak ada tanda tangan</span>'}
                </div>
                <p style="border-top: 1px solid #0f172a; padding-top: 6px; margin: 12px 0 0 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">${valetCourierName}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #475569; font-weight: 600;">Tim Linen IKM</p>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;
  }).join('');

  // HTML content matching A4 full width format
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Surat Jalan - ${delivery.surat_jalan_number || 'Kurang Kirim'}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4;
          margin: 0mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 0;
          font-size: 11px;
          line-height: 1.4;
        }
        .paper-card {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          background: #ffffff;
          position: relative;
        }
        .paper-content {
          padding: 0 15mm 15mm 15mm;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff;
          }
          .paper-card {
            width: 210mm;
            min-height: 297mm;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
          }
          .room-page-break {
            page-break-before: always !important;
          }
        }
      </style>
    </head>
    <body onload="setTimeout(() => { window.print(); window.close(); }, 300);">
      <!-- PAGE 1: GLOBAL SUMMARY -->
      <div class="paper-card">
        <!-- Letterhead Image -->
        <img src="${kopSuratIkm}" style="width: 100%; display: block;" />

        <div class="paper-content">
          <!-- Document Title -->
          <div style="text-align: center; margin-top: -55px; margin-bottom: 15px;">
            <h1 style="font-size: 20px; font-weight: 900; letter-spacing: 0.1em; color: #0f172a; margin: 0; line-height: 1; text-transform: uppercase;">SURAT JALAN</h1>
            <p style="font-size: 11px; font-weight: 700; color: #64748b; margin-top: 5px; margin-bottom: 0; text-transform: uppercase; letter-spacing: 0.05em;">No. ${delivery.surat_jalan_number || '(Otomatis)'}</p>
          </div>

          <!-- Info Block -->
          <div style="display: flex; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #0f172a; font-size: 11px; font-weight: 600; color: #475569;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 140px; font-weight: 700; color: #94a3b8;">Kepada Yth:</span> <span style="font-weight: 700; color: #0f172a;">${delivery.recipient_name || 'Rumah Sakit'}</span></p>
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 140px; font-weight: 700; color: #94a3b8;">Tanggal Pengambilan:</span> <span style="color: #0f172a; font-weight: 700;">${formattedPickupDate}</span></p>
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 140px; font-weight: 700; color: #94a3b8;">Form Transaksi Asal:</span> <span style="color: #0f172a;">${delivery.original_form_number || '—'}</span></p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px; text-align: left;">
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 120px; font-weight: 700; color: #94a3b8;">Tanggal Pengiriman:</span> <span style="color: #0f172a;">${formattedDate}</span></p>
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 120px; font-weight: 700; color: #94a3b8;">Jam:</span> <span style="color: #0f172a;">${formattedTime}</span></p>
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 120px; font-weight: 700; color: #94a3b8;">No. Kendaraan:</span> <span style="color: #0f172a;">${delivery.vehicle_number || '—'}</span></p>
            </div>
          </div>

          <!-- Items Table -->
          <div style="padding: 15px 0;">
            <table style="width: 100%; text-align: left; border-collapse: collapse; border: 1px solid #0f172a; font-size: 11px; font-weight: 600;">
              <thead>
                <tr style="background-color: #f1f5f9; color: #0f172a; text-transform: uppercase; font-weight: 900; border-bottom: 1px solid #0f172a; font-size: 9px; letter-spacing: 0.05em;">
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 48px;">NO</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center;">NAMA BARANG</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 96px;">JUMLAH</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 96px;">BERAT (GRAM)</th>
                  <th style="padding: 8px 16px; text-align: center;">KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                ${globalRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Signatures -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 24px; text-align: center; font-size: 11px; font-weight: 700; color: #0f172a;">
            <tr>
              <td style="width: 48%; vertical-align: top;">
                <p style="margin: 0 0 12px 0;">Di Terima Oleh :</p>
                <div style="height: 96px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #ffffff;">
                  ${delivery.signature_hospital ? `<img src="${delivery.signature_hospital}" alt="Hospital signature" style="height: 100%; object-fit: contain;" />` : '<span style="font-size: 10px; color: #94a3b8; font-style: italic;">Tidak ada tanda tangan</span>'}
                </div>
                <p style="border-top: 1px solid #0f172a; padding-top: 6px; margin: 12px 0 0 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">${hospitalRecipientName}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #475569; font-weight: 600;">Tim Linen RS</p>
              </td>
              
              <td style="width: 4%;"></td>

              <td style="width: 48%; vertical-align: top;">
                <p style="margin: 0 0 12px 0;">Di Serahkan Oleh :</p>
                <div style="height: 96px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #ffffff;">
                  ${delivery.signature_valet ? `<img src="${delivery.signature_valet}" alt="Valet signature" style="height: 100%; object-fit: contain;" />` : '<span style="font-size: 10px; color: #94a3b8; font-style: italic;">Tidak ada tanda tangan</span>'}
                </div>
                <p style="border-top: 1px solid #0f172a; padding-top: 6px; margin: 12px 0 0 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">${valetCourierName}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #475569; font-weight: 600;">Tim Linen IKM</p>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- PAGE 2+: ROOM DETAILS -->
      ${roomPagesHtml}
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
