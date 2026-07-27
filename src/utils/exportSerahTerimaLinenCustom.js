import ExcelJS from 'exceljs';

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
 * Helper to fetch image URL or base64 string and convert to Data URL
 */
const fetchImageAsBase64 = async (imgUrl) => {
  if (!imgUrl || typeof imgUrl !== 'string') return null;

  const trimmed = imgUrl.trim();
  if (!trimmed) return null;

  // If already a Data URL (starts with data:image)
  if (trimmed.startsWith('data:image')) {
    return trimmed;
  }

  // If it's a URL path or HTTP URL, fetch it from the server
  try {
    const response = await fetch(trimmed);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string' && reader.result.startsWith('data:image')) {
          resolve(reader.result);
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Error fetching signature image URL:', trimmed, err);
    return null;
  }
};

/**
 * Embeds base64 image into ExcelJS worksheet with maximized bounds for clear, large signatures
 */
const embedSignature = (workbook, worksheet, base64Data, colStartZero, rowStartZero, colEndZero, rowEndZero) => {
  if (!base64Data || typeof base64Data !== 'string' || !base64Data.startsWith('data:image')) {
    return false;
  }

  try {
    let cleanBase64 = base64Data.trim();
    let extension = 'png';

    if (cleanBase64.includes('data:image/jpeg') || cleanBase64.includes('data:image/jpg')) {
      extension = 'jpeg';
    } else if (cleanBase64.includes('data:image/gif')) {
      extension = 'gif';
    }

    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }

    // Strip all whitespaces, quotes, and linebreaks
    cleanBase64 = cleanBase64.replace(/[\s\r\n"']/g, '').trim();

    if (!cleanBase64 || cleanBase64.length < 10) return false;

    // Auto-fix base64 padding to a multiple of 4
    const padNeeded = (4 - (cleanBase64.length % 4)) % 4;
    if (padNeeded > 0) {
      cleanBase64 += '='.repeat(padNeeded);
    }

    const imageId = workbook.addImage({
      base64: cleanBase64,
      extension: extension,
    });

    // Centered inside merged cell box with balanced margins
    worksheet.addImage(imageId, {
      tl: { col: colStartZero + 0.05, row: rowStartZero + 0.08 },
      br: { col: colEndZero + 0.95, row: rowEndZero + 0.92 },
      editAs: 'oneCell',
    });
    return true;
  } catch (err) {
    console.error('Error embedding signature image in ExcelJS:', err);
    return false;
  }
};

/**
 * Exports Serah Terima Linen Custom transaction details to Excel matching the exact reference layout
 */
export default async function exportSerahTerimaLinenCustom(transaction, details) {
  // Fetch and resolve all 6 signature images to Base64 Data URLs concurrently
  const [
    valetPickupSig,
    hospPickupSig,
    asstPickupSig,
    valetDeliverySig,
    hospDeliverySig,
    asstDeliverySig
  ] = await Promise.all([
    fetchImageAsBase64(transaction.signature_valet_pickup),
    fetchImageAsBase64(transaction.signature_hospital_pickup),
    fetchImageAsBase64(transaction.signature_assistant_pickup),
    fetchImageAsBase64(transaction.signature_valet_delivery),
    fetchImageAsBase64(transaction.signature_hospital_delivery),
    fetchImageAsBase64(transaction.signature_assistant_delivery)
  ]);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Serah Terima Khusus');

  // Set column widths (8 columns total)
  worksheet.columns = [
    { key: 'no', width: 8 },
    { key: 'jenis', width: 34 },
    { key: 'p', width: 12 },
    { key: 'l', width: 12 },
    { key: 'luas', width: 16 },
    { key: 'kotor', width: 12 },
    { key: 'bersih', width: 12 },
    { key: 'keterangan', width: 35 }
  ];

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
  };

  // 1. Company Header Title
  worksheet.mergeCells('A1:H1');
  const titleRow = worksheet.getCell('A1');
  titleRow.value = 'FORM SERAH TERIMA LINEN KHUSUS PT INTERSOLUSI KARYA MANDIRI';
  titleRow.font = { name: 'Plus Jakarta Sans', size: 12, bold: true };
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 34;

  // 2. Hospital Name
  worksheet.mergeCells('A2:H2');
  const hospitalRow = worksheet.getCell('A2');
  hospitalRow.value = transaction.hospital_name ? transaction.hospital_name.toUpperCase() : 'RUMAH SAKIT';
  hospitalRow.font = { name: 'Plus Jakarta Sans', size: 11, bold: true };
  hospitalRow.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 30;

  // 3. Date Row
  worksheet.mergeCells('A3:H3');
  const dateCell = worksheet.getCell('A3');
  const pickupDateObj = new Date(transaction.pickup_date);
  const formattedPickupDate = pickupDateObj.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  dateCell.value = formattedPickupDate;
  dateCell.font = { name: 'Plus Jakarta Sans', size: 10, italic: false };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(3).height = 24;

  // Set background fill for the entire header block (Light Blue: #D9E1F2)
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 8; c++) {
      worksheet.getCell(r, c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' }
      };
    }
  }

  // Row 4 is empty spacer (Height: 14px)
  worksheet.getRow(4).height = 14;

  // Row 5: Table Header (Height: 36px)
  const headerRow = worksheet.getRow(5);
  headerRow.values = ['No', 'Jenis Linen Khusus', 'P (m)', 'L (m)', 'Luas (m²)', 'Kotor', 'Bersih', 'Keterangan'];
  headerRow.height = 36;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Plus Jakarta Sans', size: 10, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2EFDA' } // Light green background matching standard
    };
    cell.border = thinBorder;
  });

  // 4. Data rows
  let currentRow = 6;
  details.forEach((item, index) => {
    const kotor = parseInt(item.qty_kotor || 0);
    const bersih = parseInt(item.qty_bersih || 0);
    const len = item.length_cm !== null ? parseFloat(item.length_cm).toFixed(1) : '—';
    const wid = item.width_cm !== null ? parseFloat(item.width_cm).toFixed(1) : '—';
    const area = item.area_m2 !== null ? parseFloat(item.area_m2).toFixed(2) : '—';
    const notes = item.notes || '';

    const row = worksheet.getRow(currentRow);
    row.values = [
      index + 1,
      getLinenDisplayName(item),
      len,
      wid,
      area,
      kotor,
      transaction.status === 'SELESAI' ? bersih : '—',
      notes
    ];
    row.height = 28;

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(8).alignment = { horizontal: 'left', vertical: 'middle' };

    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Plus Jakarta Sans', size: 10 };
      cell.border = thinBorder;
    }
    
    currentRow++;
  });

  // Empty row spacer (Height: 18px)
  worksheet.getRow(currentRow).height = 18;
  currentRow++;

  // Helper to draw signature block
  const drawSignatureBlock = (sectionTitle, labels, signatures, names, isDeliveryPending = false) => {
    // Section Header Row
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    const secCell = worksheet.getCell(`A${currentRow}`);
    secCell.value = sectionTitle;
    secCell.font = { name: 'Plus Jakarta Sans', size: 10, bold: true, color: { argb: 'FF1E5F74' } };
    secCell.alignment = { horizontal: 'left', vertical: 'middle' };
    secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    worksheet.getRow(currentRow).height = 30;
    for (let c = 1; c <= 8; c++) {
      worksheet.getCell(currentRow, c).border = thinBorder;
    }
    currentRow++;

    // Labels Row (Valet IKM, Petugas RS, Perawat RS) - height: 26px
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = labels[0];
    
    worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
    worksheet.getCell(`D${currentRow}`).value = labels[1];
    
    worksheet.mergeCells(`G${currentRow}:H${currentRow}`);
    worksheet.getCell(`G${currentRow}`).value = labels[2];

    worksheet.getRow(currentRow).height = 26;
    [1, 4, 7].forEach((colIdx) => {
      const cell = worksheet.getCell(currentRow, colIdx);
      cell.font = { name: 'Plus Jakarta Sans', size: 9, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } };
    });
    for (let c = 1; c <= 8; c++) {
      worksheet.getCell(currentRow, c).border = thinBorder;
    }
    currentRow++;

    // Image Block Area (5 rows tall, 26px each = 130px height)
    const imgStartRow = currentRow;
    const imgEndRow = currentRow + 4;
    
    worksheet.mergeCells(`A${imgStartRow}:C${imgEndRow}`);
    worksheet.mergeCells(`D${imgStartRow}:F${imgEndRow}`);
    worksheet.mergeCells(`G${imgStartRow}:H${imgEndRow}`);

    for (let r = imgStartRow; r <= imgEndRow; r++) {
      worksheet.getRow(r).height = 26;
      for (let c = 1; c <= 8; c++) {
        worksheet.getCell(r, c).border = thinBorder;
      }
    }

    if (isDeliveryPending) {
      const midR = imgStartRow + 2;
      worksheet.getCell(`A${midR}`).value = '(Belum Ada Pengiriman)';
      worksheet.getCell(`A${midR}`).font = { name: 'Plus Jakarta Sans', size: 8, italic: true, color: { argb: 'FF999999' } };
      worksheet.getCell(`A${midR}`).alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.getCell(`D${midR}`).value = '(Belum Ada Pengiriman)';
      worksheet.getCell(`D${midR}`).font = { name: 'Plus Jakarta Sans', size: 8, italic: true, color: { argb: 'FF999999' } };
      worksheet.getCell(`D${midR}`).alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.getCell(`G${midR}`).value = '(Belum Ada Pengiriman)';
      worksheet.getCell(`G${midR}`).font = { name: 'Plus Jakarta Sans', size: 8, italic: true, color: { argb: 'FF999999' } };
      worksheet.getCell(`G${midR}`).alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      // Embed signatures
      const hasSig1 = embedSignature(workbook, worksheet, signatures[0], 0, imgStartRow - 1, 2, imgEndRow - 1);
      if (!hasSig1) {
        const midR = imgStartRow + 2;
        worksheet.getCell(`A${midR}`).value = '(Belum Tanda Tangan)';
        worksheet.getCell(`A${midR}`).font = { name: 'Plus Jakarta Sans', size: 8, italic: true, color: { argb: 'FF999999' } };
        worksheet.getCell(`A${midR}`).alignment = { horizontal: 'center', vertical: 'middle' };
      }

      const hasSig2 = embedSignature(workbook, worksheet, signatures[1], 3, imgStartRow - 1, 5, imgEndRow - 1);
      if (!hasSig2) {
        const midR = imgStartRow + 2;
        worksheet.getCell(`D${midR}`).value = '(Belum Tanda Tangan)';
        worksheet.getCell(`D${midR}`).font = { name: 'Plus Jakarta Sans', size: 8, italic: true, color: { argb: 'FF999999' } };
        worksheet.getCell(`D${midR}`).alignment = { horizontal: 'center', vertical: 'middle' };
      }

      const hasSig3 = embedSignature(workbook, worksheet, signatures[2], 6, imgStartRow - 1, 7, imgEndRow - 1);
      if (!hasSig3) {
        const midR = imgStartRow + 2;
        worksheet.getCell(`G${midR}`).value = '(Belum Tanda Tangan)';
        worksheet.getCell(`G${midR}`).font = { name: 'Plus Jakarta Sans', size: 8, italic: true, color: { argb: 'FF999999' } };
        worksheet.getCell(`G${midR}`).alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }

    currentRow = imgEndRow + 1;

    // Names Row
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = `(${toTitleCase(names[0] || '—')})`;

    worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
    worksheet.getCell(`D${currentRow}`).value = `(${toTitleCase(names[1] || '—')})`;

    worksheet.mergeCells(`G${currentRow}:H${currentRow}`);
    worksheet.getCell(`G${currentRow}`).value = `(${toTitleCase(names[2] || '—')})`;

    worksheet.getRow(currentRow).height = 26;
    [1, 4, 7].forEach((colIdx) => {
      const cell = worksheet.getCell(currentRow, colIdx);
      cell.font = { name: 'Plus Jakarta Sans', size: 9, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    for (let c = 1; c <= 8; c++) {
      worksheet.getCell(currentRow, c).border = thinBorder;
    }
    currentRow++;
  };

  // 1. Session 1: Proses Pickup Linen Kotor
  drawSignatureBlock(
    'Pengambilan Linen Kotor',
    ['Valet IKM', 'Petugas RS', 'Perawat RS'],
    [valetPickupSig, hospPickupSig, asstPickupSig],
    [
      transaction.user_pickup_name,
      transaction.hospital_staff_pickup,
      transaction.hospital_assistant_pickup
    ],
    false
  );

  // Spacer between sessions
  worksheet.getRow(currentRow).height = 18;
  currentRow++;

  // 2. Session 2: Pengiriman Linen Bersih
  const isDeliveryPending = transaction.status !== 'SELESAI';
  drawSignatureBlock(
    'Pengiriman Linen Bersih',
    ['Valet IKM', 'Petugas RS', 'Perawat RS'],
    [valetDeliverySig, hospDeliverySig, asstDeliverySig],
    [
      transaction.user_delivery_name,
      transaction.hospital_staff_delivery,
      transaction.hospital_assistant_delivery
    ],
    isDeliveryPending
  );

  // Write file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Serah_Terima_Khusus_${transaction.form_number || 'Dokumen'}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}
