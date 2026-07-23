/**
 * Utility to print/export Surat Jalan Kurang Kirim to PDF / printer
 * Formatted to match the UI modal preview exactly.
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

  // Build items rows matching preview table style
  const rowsHtml = details.map((item, idx) => {
    const qty = item.qty_delivered || item.qtyDelivered || 0;
    const notes = item.notes || '—';
    const grammage = parseFloat(item.grammage || 0);
    const weight = grammage * qty;
    const formattedWeight = weight > 0 ? weight.toLocaleString('id-ID') : '—';
    
    return `
      <tr style="color: #1e293b; border-bottom: 1px solid #0f172a;">
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${idx + 1}</td>
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a;">${getLinenDisplayName(item)}</td>
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${qty}</td>
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${formattedWeight}</td>
        <td style="padding: 10px 16px; color: #64748b; font-style: italic;">${notes}</td>
      </tr>
    `;
  }).join('');

  // Original pickup date (Tanggal Pengambilan)
  let formattedPickupDate = '—';
  if (delivery.original_pickup_date) {
    const pDate = new Date(delivery.original_pickup_date);
    formattedPickupDate = pDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const hospitalRecipientName = delivery.hospital_staff || delivery.recipient_name || 'PETUGAS RS';
  const valetCourierName = delivery.valet_name || 'ABDUL ARIPIN';

  // HTML content matching modal preview
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
          size: A4 portrait;
          margin: 12mm;
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
          padding: 16px;
          font-size: 12px;
          line-height: 1.4;
        }
        @media print {
          body {
            padding: 0 !important;
          }
          .paper-card {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            border-radius: 16px !important;
            padding: 32px !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
        .paper-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          max-width: 800px;
          margin: 0 auto;
        }
      </style>
    </head>
    <body onload="setTimeout(() => { window.print(); window.close(); }, 300);">
      <div class="paper-card">
        <!-- Paper Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 2px solid #0f172a; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="/ikm.png" alt="IKM Logo" style="height: 56px; object-fit: contain;" />
            <div>
              <h2 style="font-size: 16px; font-weight: 700; text-transform: uppercase; tracking: tight; color: #0f172a; margin: 0; line-height: 1;">PT. INTERSOLUSI KARYA MANDIRI</h2>
              <p style="font-size: 10px; color: #64748b; font-weight: 600; margin-top: 4px; margin-bottom: 0;">Jl. Pringgondani No. 101, Cimanggis, Depok, Jawa Barat</p>
              <p style="font-size: 10px; color: #64748b; font-weight: 600; margin-top: 2px; margin-bottom: 0;">HP: 08118871101 / 08161986580</p>
            </div>
          </div>
          <div style="text-align: right;">
            <h1 style="font-size: 22px; font-weight: 900; letter-spacing: 0.1em; color: #0f172a; margin: 0; line-height: 1;">SURAT JALAN</h1>
            <p style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 4px; margin-bottom: 0; text-transform: uppercase; letter-spacing: 0.05em;">No. ${delivery.surat_jalan_number || '(Otomatis)'}</p>
          </div>
        </div>

        <!-- Info Block -->
        <div style="display: flex; justify-content: space-between; padding: 20px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 600; color: #475569;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <p style="margin: 0; display: flex; align-items: center;"><span style="width: 140px; font-weight: 700; color: #94a3b8;">Kepada Yth:</span> <span style="font-weight: 700; color: #0f172a;">${delivery.recipient_name || 'Rumah Sakit'}</span></p>
            <p style="margin: 0; display: flex; align-items: center;"><span style="width: 140px; font-weight: 700; color: #94a3b8;">Tanggal Pengambilan:</span> <span style="color: #1e293b; font-weight: 700;">${formattedPickupDate}</span></p>
            <p style="margin: 0; display: flex; align-items: center;"><span style="width: 140px; font-weight: 700; color: #94a3b8;">Form Transaksi Asal:</span> <span style="color: #1e293b;">${delivery.original_form_number || '—'}</span></p>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; text-align: left;">
            <p style="margin: 0; display: flex; align-items: center;"><span style="width: 120px; font-weight: 700; color: #94a3b8;">Tanggal Pengiriman:</span> <span style="color: #1e293b;">${formattedDate}</span></p>
            <p style="margin: 0; display: flex; align-items: center;"><span style="width: 120px; font-weight: 700; color: #94a3b8;">Jam:</span> <span style="color: #1e293b;">${formattedTime}</span></p>
            <p style="margin: 0; display: flex; align-items: center;"><span style="width: 120px; font-weight: 700; color: #94a3b8;">No. Kendaraan:</span> <span style="color: #1e293b;">${delivery.vehicle_number || '—'}</span></p>
          </div>
        </div>

        <!-- Items Table -->
        <div style="padding: 20px 0;">
          <table style="width: 100%; text-align: left; border-collapse: collapse; border: 1px solid #0f172a; font-size: 12px; font-weight: 600;">
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
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Signatures (Side-by-Side 2 Column Table) -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 24px; text-align: center; font-size: 11px; font-weight: 700; color: #0f172a;">
          <tr>
            <td style="width: 48%; vertical-align: top;">
              <p style="margin: 0 0 12px 0;">Di Terima Oleh :</p>
              <div style="height: 96px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                ${delivery.signature_hospital ? `<img src="${delivery.signature_hospital}" alt="Hospital signature" style="height: 100%; object-fit: contain;" />` : '<span style="font-size: 10px; color: #94a3b8; font-style: italic;">Tidak ada tanda tangan</span>'}
              </div>
              <p style="border-top: 1px solid #020617; padding-top: 6px; margin: 12px 0 0 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">${hospitalRecipientName}</p>
            </td>
            
            <td style="width: 4%;"></td>

            <td style="width: 48%; vertical-align: top;">
              <p style="margin: 0 0 12px 0;">Di Serahkan Oleh :</p>
              <div style="height: 96px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                ${delivery.signature_valet ? `<img src="${delivery.signature_valet}" alt="Valet signature" style="height: 100%; object-fit: contain;" />` : '<span style="font-size: 10px; color: #94a3b8; font-style: italic;">Tidak ada tanda tangan</span>'}
              </div>
              <p style="border-top: 1px solid #020617; padding-top: 6px; margin: 12px 0 0 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">${valetCourierName}</p>
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
