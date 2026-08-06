import kopSuratIkm from '../assets/images/kop_surat_ikm.png';

// Helper to convert string to Title Case
const toTitleCase = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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

/**
 * Utility to print/export Serah Terima Linen Form to PDF / printer
 */
export default async function exportSerahTerimaLinenPDF(transaction, details) {
  const printWindow = window.open('', '_blank', 'width=950,height=1200');
  if (!printWindow) {
    alert('Gagal mencetak. Pastikan pop-up blocker browser Anda dinonaktifkan.');
    return;
  }

  // Format date and time
  const pickupDateObj = new Date(transaction.pickup_date);
  const formattedPickupDate = pickupDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const deliveryDateObj = transaction.delivery_date ? new Date(transaction.delivery_date) : null;
  const formattedDeliveryDate = deliveryDateObj ? deliveryDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const formattedDeliveryTime = deliveryDateObj ? deliveryDateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.') + ' WIB' : '—';

  // Signature rendering helper
  const renderSigImg = (sigSrc, pendingMsg) => {
    if (pendingMsg) {
      return `<span style="font-size: 8px; color: #94a3b8; font-style: italic;">${pendingMsg}</span>`;
    }
    if (sigSrc && sigSrc.trim() !== '') {
      return `<img src="${sigSrc}" style="max-height: 48px; max-width: 90%; object-fit: contain;" />`;
    }
    return '<span style="font-size: 8px; color: #94a3b8; font-style: italic;">(Belum Tanda Tangan)</span>';
  };

  const signaturesBlockHtml = `
    <!-- SIGNATURES BLOCK -->
    <div style="margin-top: 24px; font-size: 10px; color: #0f172a;">
      <!-- Row 1: Pengambilan Linen Kotor -->
      <div style="border: 1.5px solid #0f172a; border-radius: 8px; overflow: hidden; margin-bottom: 15px;">
        <div style="background: #e2efd8; padding: 4px 10px; font-weight: 800; border-bottom: 1.5px solid #0f172a; color: #1e4620; text-transform: uppercase; letter-spacing: 0.05em; font-size: 9px;">
          Tahap 1: Pengambilan Linen Kotor (Pickup)
        </div>
        <table style="width: 100%; border-collapse: collapse; text-align: center; font-weight: 700;">
          <tr>
            <td style="width: 33.3%; border-right: 1.5px solid #0f172a; padding: 4px; background: #f8fafc; font-size: 8px; text-transform: uppercase; border-bottom: 1.5px solid #0f172a;">Valet IKM</td>
            <td style="width: 33.3%; border-right: 1.5px solid #0f172a; padding: 4px; background: #f8fafc; font-size: 8px; text-transform: uppercase; border-bottom: 1.5px solid #0f172a;">Petugas RS</td>
            <td style="width: 33.3%; padding: 4px; background: #f8fafc; font-size: 8px; text-transform: uppercase; border-bottom: 1.5px solid #0f172a;">Perawat RS</td>
          </tr>
          <tr>
            <td style="border-right: 1.5px solid #0f172a; height: 55px; vertical-align: middle;">
              ${renderSigImg(transaction.signature_valet_pickup)}
            </td>
            <td style="border-right: 1.5px solid #0f172a; height: 55px; vertical-align: middle;">
              ${renderSigImg(transaction.signature_hospital_pickup)}
            </td>
            <td style="height: 55px; vertical-align: middle;">
              ${renderSigImg(transaction.signature_assistant_pickup)}
            </td>
          </tr>
          <tr>
            <td style="border-right: 1.5px solid #0f172a; padding: 4px; border-top: 1.5px solid #0f172a; font-size: 8px; text-transform: uppercase;">(${toTitleCase(transaction.user_pickup_name || '—')})</td>
            <td style="border-right: 1.5px solid #0f172a; padding: 4px; border-top: 1.5px solid #0f172a; font-size: 8px; text-transform: uppercase;">(${toTitleCase(transaction.hospital_staff_pickup || '—')})</td>
            <td style="padding: 4px; border-top: 1.5px solid #0f172a; font-size: 8px; text-transform: uppercase;">(${toTitleCase(transaction.hospital_assistant_pickup || '—')})</td>
          </tr>
        </table>
      </div>

      <!-- Row 2: Pengiriman Linen Bersih -->
      <div style="border: 1.5px solid #0f172a; border-radius: 8px; overflow: hidden;">
        <div style="background: #d9e1f2; padding: 4px 10px; font-weight: 800; border-bottom: 1.5px solid #0f172a; color: #1e2a4a; text-transform: uppercase; letter-spacing: 0.05em; font-size: 9px;">
          Tahap 2: Pengiriman Linen Bersih (Delivery)
        </div>
        <table style="width: 100%; border-collapse: collapse; text-align: center; font-weight: 700;">
          <tr>
            <td style="width: 33.3%; border-right: 1.5px solid #0f172a; padding: 4px; background: #f8fafc; font-size: 8px; text-transform: uppercase; border-bottom: 1.5px solid #0f172a;">Valet IKM</td>
            <td style="width: 33.3%; border-right: 1.5px solid #0f172a; padding: 4px; background: #f8fafc; font-size: 8px; text-transform: uppercase; border-bottom: 1.5px solid #0f172a;">Petugas RS</td>
            <td style="width: 33.3%; padding: 4px; background: #f8fafc; font-size: 8px; text-transform: uppercase; border-bottom: 1.5px solid #0f172a;">Perawat RS</td>
          </tr>
          <tr>
            <td style="border-right: 1.5px solid #0f172a; height: 55px; vertical-align: middle;">
              ${renderSigImg(transaction.signature_valet_delivery, transaction.status !== 'SELESAI' ? 'Belum Ada Pengiriman' : '')}
            </td>
            <td style="border-right: 1.5px solid #0f172a; height: 55px; vertical-align: middle;">
              ${renderSigImg(transaction.signature_hospital_delivery, transaction.status !== 'SELESAI' ? 'Belum Ada Pengiriman' : '')}
            </td>
            <td style="height: 55px; vertical-align: middle;">
              ${renderSigImg(transaction.signature_assistant_delivery, transaction.status !== 'SELESAI' ? 'Belum Ada Pengiriman' : '')}
            </td>
          </tr>
          <tr>
            <td style="border-right: 1.5px solid #0f172a; padding: 4px; border-top: 1.5px solid #0f172a; font-size: 8px; text-transform: uppercase;">(${toTitleCase(transaction.user_delivery_name || '—')})</td>
            <td style="border-right: 1.5px solid #0f172a; padding: 4px; border-top: 1.5px solid #0f172a; font-size: 8px; text-transform: uppercase;">(${toTitleCase(transaction.hospital_staff_delivery || '—')})</td>
            <td style="padding: 4px; border-top: 1.5px solid #0f172a; font-size: 8px; text-transform: uppercase;">(${toTitleCase(transaction.hospital_assistant_delivery || '—')})</td>
          </tr>
        </table>
      </div>
    </div>
  `;

  // 1. Build Global rows
  const globalSummary = {};
  details.forEach(item => {
    const kotor = parseInt(item.qty_kotor || 0);
    const bersih = parseInt(item.qty_bersih || 0);
    if (kotor <= 0 && bersih <= 0) return;

    const key = item.hospital_linen_id || getLinenDisplayName(item);
    if (!globalSummary[key]) {
      globalSummary[key] = {
        ...item,
        qty_kotor: 0,
        qty_bersih: 0,
        notesList: []
      };
    }
    globalSummary[key].qty_kotor += kotor;
    globalSummary[key].qty_bersih += bersih;
    if (item.notes && item.notes.trim() !== '' && item.notes !== '—') {
      globalSummary[key].notesList.push(item.notes.trim());
    }
  });

  const globalRowsHtml = Object.values(globalSummary).map((item, idx) => {
    const kotor = item.qty_kotor;
    const bersih = transaction.status === 'SELESAI' ? item.qty_bersih : 0;
    const selisih = Math.max(0, kotor - bersih);
    const notes = item.notesList.length > 0 ? item.notesList.join('; ') : '—';
    return `
      <tr style="color: #0f172a; border-bottom: 1px solid #0f172a;">
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${idx + 1}</td>
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a;">${getLinenDisplayName(item)}</td>
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${kotor}</td>
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${transaction.status === 'SELESAI' ? bersih : '—'}</td>
        <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${transaction.status === 'SELESAI' ? selisih : '—'}</td>
        <td style="padding: 10px 16px; color: #475569; font-style: italic;">${notes}</td>
      </tr>
    `;
  }).join('');

  // 2. Build Room rows
  const roomGroups = {};
  details.forEach(item => {
    const kotor = parseInt(item.qty_kotor || 0);
    const bersih = parseInt(item.qty_bersih || 0);
    if (kotor <= 0 && bersih <= 0) return;

    const rName = item.room_name || 'Tanpa Ruangan';
    if (!roomGroups[rName]) {
      roomGroups[rName] = [];
    }
    roomGroups[rName].push(item);
  });

  const roomPagesHtml = Object.entries(roomGroups).map(([rName, roomItems]) => {
    const roomRowsHtml = roomItems.map((item, idx) => {
      const kotor = parseInt(item.qty_kotor || 0);
      const bersih = transaction.status === 'SELESAI' ? parseInt(item.qty_bersih || 0) : 0;
      const selisih = Math.max(0, kotor - bersih);
      const notes = item.notes || '—';
      return `
        <tr style="color: #0f172a; border-bottom: 1px solid #0f172a;">
          <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${idx + 1}</td>
          <td style="padding: 10px 16px; border-right: 1px solid #0f172a;">${getLinenDisplayName(item)}</td>
          <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${kotor}</td>
          <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${transaction.status === 'SELESAI' ? bersih : '—'}</td>
          <td style="padding: 10px 16px; border-right: 1px solid #0f172a; text-align: center; font-weight: 700;">${transaction.status === 'SELESAI' ? selisih : '—'}</td>
          <td style="padding: 10px 16px; color: #475569; font-style: italic;">${notes}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="paper-card room-page-break">
        <img src="${kopSuratIkm}" style="width: 100%; display: block;" />

        <div class="paper-content">
          <!-- Document Title -->
          <div style="text-align: center; margin-top: -55px; margin-bottom: 15px;">
            <h1 style="font-size: 18px; font-weight: 900; letter-spacing: 0.05em; color: #0f172a; margin: 0; line-height: 1.1; text-transform: uppercase;">FORM SERAH TERIMA LINEN</h1>
            <p style="font-size: 10px; font-weight: 850; color: #1ea59e; margin-top: 5px; margin-bottom: 0; text-transform: uppercase; letter-spacing: 0.05em;">Unit: ${rName}</p>
            <p style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 4px; margin-bottom: 0; text-transform: uppercase; letter-spacing: 0.05em;">No. Form: ${transaction.form_number || '—'}</p>
          </div>

          <!-- Info Block -->
          <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #0f172a; font-size: 10.5px; font-weight: 600; color: #475569;">
            <div style="display: flex; flex-direction: column; gap: 5px;">
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 130px; font-weight: 700; color: #94a3b8;">Kepada Yth:</span> <span style="font-weight: 700; color: #0f172a;">${transaction.hospital_name || 'Rumah Sakit'}</span></p>
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 130px; font-weight: 700; color: #94a3b8;">Tanggal Pengambilan:</span> <span style="color: #0f172a; font-weight: 700;">${formattedPickupDate}</span></p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 5px; text-align: left;">
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 125px; font-weight: 700; color: #94a3b8;">Tanggal Pengiriman:</span> <span style="color: #0f172a;">${formattedDeliveryDate}</span></p>
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 125px; font-weight: 700; color: #94a3b8;">Jam:</span> <span style="color: #0f172a;">${formattedDeliveryTime}</span></p>
            </div>
          </div>

          <!-- Items Table -->
          <div style="padding: 12px 0;">
            <table style="width: 100%; text-align: left; border-collapse: collapse; border: 1px solid #0f172a; font-size: 10.5px; font-weight: 600;">
              <thead>
                <tr style="background-color: #f1f5f9; color: #0f172a; text-transform: uppercase; font-weight: 900; border-bottom: 1px solid #0f172a; font-size: 8.5px; letter-spacing: 0.05em;">
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 44px;">NO</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center;">NAMA BARANG</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 80px;">KOTOR</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 80px;">BERSIH</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 80px;">SELISIH</th>
                  <th style="padding: 8px 16px; text-align: center;">KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                ${roomRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Signatures block -->
          ${signaturesBlockHtml}
        </div>
      </div>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Form Serah Terima - ${transaction.form_number || 'Linen'}</title>
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
    <body onload="setTimeout(() => { window.print(); window.close(); }, 350);">
      <!-- PAGE 1: GLOBAL SUMMARY -->
      <div class="paper-card">
        <img src="${kopSuratIkm}" style="width: 100%; display: block;" />

        <div class="paper-content">
          <!-- Document Title -->
          <div style="text-align: center; margin-top: -55px; margin-bottom: 15px;">
            <h1 style="font-size: 20px; font-weight: 900; letter-spacing: 0.05em; color: #0f172a; margin: 0; line-height: 1.1; text-transform: uppercase;">FORM SERAH TERIMA LINEN</h1>
            <p style="font-size: 11px; font-weight: 800; color: #126776; margin-top: 5px; margin-bottom: 0; text-transform: uppercase; letter-spacing: 0.05em;">PT INTERSOLUSI KARYA MANDIRI</p>
            <p style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 4px; margin-bottom: 0; text-transform: uppercase; letter-spacing: 0.05em;">No. Form: ${transaction.form_number || '—'}</p>
          </div>

          <!-- Info Block -->
          <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #0f172a; font-size: 10.5px; font-weight: 600; color: #475569;">
            <div style="display: flex; flex-direction: column; gap: 5px;">
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 130px; font-weight: 700; color: #94a3b8;">Kepada Yth:</span> <span style="font-weight: 700; color: #0f172a;">${transaction.hospital_name || 'Rumah Sakit'}</span></p>
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 130px; font-weight: 700; color: #94a3b8;">Tanggal Pengambilan:</span> <span style="color: #0f172a; font-weight: 700;">${formattedPickupDate}</span></p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 5px; text-align: left;">
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 125px; font-weight: 700; color: #94a3b8;">Tanggal Pengiriman:</span> <span style="color: #0f172a;">${formattedDeliveryDate}</span></p>
              <p style="margin: 0; display: flex; align-items: center;"><span style="width: 125px; font-weight: 700; color: #94a3b8;">Jam:</span> <span style="color: #0f172a;">${formattedDeliveryTime}</span></p>
            </div>
          </div>

          <!-- Items Table -->
          <div style="padding: 12px 0;">
            <table style="width: 100%; text-align: left; border-collapse: collapse; border: 1px solid #0f172a; font-size: 10.5px; font-weight: 600;">
              <thead>
                <tr style="background-color: #f1f5f9; color: #0f172a; text-transform: uppercase; font-weight: 900; border-bottom: 1px solid #0f172a; font-size: 8.5px; letter-spacing: 0.05em;">
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 44px;">NO</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center;">NAMA BARANG</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 80px;">KOTOR</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 80px;">BERSIH</th>
                  <th style="padding: 8px 16px; border-right: 1px solid #0f172a; text-align: center; width: 80px;">SELISIH</th>
                  <th style="padding: 8px 16px; text-align: center;">KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                ${globalRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Signatures block -->
          ${signaturesBlockHtml}
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
