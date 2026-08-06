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

  if (trimmed.startsWith('data:image')) {
    return trimmed;
  }

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

    cleanBase64 = cleanBase64.replace(/[\s\r\n"']/g, '').trim();

    if (!cleanBase64 || cleanBase64.length < 10) return false;

    const padNeeded = (4 - (cleanBase64.length % 4)) % 4;
    if (padNeeded > 0) {
      cleanBase64 += '='.repeat(padNeeded);
    }

    const imageId = workbook.addImage({
      base64: cleanBase64,
      extension: extension,
    });

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
 * Exports Serah Terima Linen transaction details to Excel matching the exact reference layout
 */
export default async function exportSerahTerimaLinen(transaction, details) {
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

  const writeSheetData = (worksheet, sheetTitle, subtitle, itemsList) => {
    // Set column widths
    worksheet.columns = [
      { key: 'no', width: 8 },
      { key: 'jenis', width: 38 },
      { key: 'kotor', width: 16 },
      { key: 'bersih', width: 16 },
      { key: 'keterangan', width: 45 }
    ];

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };

    // 1. Company Header Title
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'FORM SERAH TERIMA LINEN PT INTERSOLUSI KARYA MANDIRI';
    titleCell.font = { name: 'Plus Jakarta Sans', size: 12, bold: true, color: { argb: 'FF126776' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 36;

    // 2. Subtitle / Unit
    worksheet.mergeCells('A2:E2');
    const subCell = worksheet.getCell('A2');
    subCell.value = subtitle ? `${transaction.hospital_name || 'RUMAH SAKIT'} - UNIT: ${subtitle.toUpperCase()}` : (transaction.hospital_name ? transaction.hospital_name.toUpperCase() : 'RUMAH SAKIT');
    subCell.font = { name: 'Plus Jakarta Sans', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 28;

    // 3. Date & Form Number
    worksheet.mergeCells('A3:E3');
    const dateCell = worksheet.getCell('A3');
    const pickupDateObj = new Date(transaction.pickup_date);
    const formattedPickupDate = pickupDateObj.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const formNum = transaction.form_number ? `No. Form: ${transaction.form_number}` : '';
    dateCell.value = `${formNum ? formNum + '  |  ' : ''}Tanggal: ${formattedPickupDate}`;
    dateCell.font = { name: 'Plus Jakarta Sans', size: 8.5, color: { argb: 'FF475569' } };
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(3).height = 24;

    // Set background fill for the entire header block (Light Teal: #EBF3F5)
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 5; c++) {
        worksheet.getCell(r, c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEBF3F5' }
        };
      }
    }

    // Row 4 is spacer
    worksheet.getRow(4).height = 14;

    // Row 5: Table Header
    const headerRow = worksheet.getRow(5);
    headerRow.values = ['No', 'Jenis Linen', 'Kotor', 'Bersih', 'Keterangan'];
    headerRow.height = 36;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Plus Jakarta Sans', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF126776' }
      };
      cell.border = thinBorder;
    });

    // 4. Data rows
    let currentRow = 6;
    itemsList.forEach((item, index) => {
      const kotor = parseInt(item.qty_kotor || 0);
      const bersih = parseInt(item.qty_bersih || 0);
      const notes = item.notes || '—';

      const row = worksheet.getRow(currentRow);
      row.values = [
        index + 1,
        getLinenDisplayName(item),
        kotor,
        transaction.status === 'SELESAI' ? bersih : '—',
        notes
      ];
      row.height = 28;

      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };

      for (let c = 1; c <= 5; c++) {
        const cell = row.getCell(c);
        cell.font = { name: 'Plus Jakarta Sans', size: 10 };
        cell.border = thinBorder;
        if (index % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          };
        }
      }
      currentRow++;
    });

    // Spacer
    worksheet.getRow(currentRow).height = 18;
    currentRow++;

    // Helper to draw signature block inside this worksheet
    const drawSignatureBlock = (sectionTitle, labels, signatures, names, isDeliveryPending = false, bgColor = 'FFE2EFDA', titleColor = 'FF1E4620') => {
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
      const secCell = worksheet.getCell(`A${currentRow}`);
      secCell.value = sectionTitle;
      secCell.font = { name: 'Plus Jakarta Sans', size: 9.5, bold: true, color: { argb: titleColor } };
      secCell.alignment = { horizontal: 'left', vertical: 'middle' };
      secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      worksheet.getRow(currentRow).height = 28;
      for (let c = 1; c <= 5; c++) {
        worksheet.getCell(currentRow, c).border = thinBorder;
      }
      currentRow++;

      // Labels row
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      worksheet.getCell(`A${currentRow}`).value = labels[0];

      worksheet.mergeCells(`C${currentRow}:D${currentRow}`);
      worksheet.getCell(`C${currentRow}`).value = labels[1];

      worksheet.getCell(`E${currentRow}`).value = labels[2];

      worksheet.getRow(currentRow).height = 24;
      [1, 3, 5].forEach((colIdx) => {
        const cell = worksheet.getCell(currentRow, colIdx);
        cell.font = { name: 'Plus Jakarta Sans', size: 9, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });
      for (let c = 1; c <= 5; c++) {
        worksheet.getCell(currentRow, c).border = thinBorder;
      }
      currentRow++;

      // Signature images area
      const imgStartRow = currentRow;
      const imgEndRow = currentRow + 4;
      worksheet.mergeCells(`A${imgStartRow}:B${imgEndRow}`);
      worksheet.mergeCells(`C${imgStartRow}:D${imgEndRow}`);
      worksheet.mergeCells(`E${imgStartRow}:E${imgEndRow}`);

      for (let r = imgStartRow; r <= imgEndRow; r++) {
        worksheet.getRow(r).height = 14;
        for (let c = 1; c <= 5; c++) {
          worksheet.getCell(r, c).border = thinBorder;
        }
      }

      // Embed signatures
      if (isDeliveryPending) {
        const midR = imgStartRow + 2;
        [1, 3, 5].forEach((colIdx) => {
          worksheet.getCell(midR, colIdx).value = '(Belum Ada Pengiriman)';
          worksheet.getCell(midR, colIdx).font = { name: 'Plus Jakarta Sans', size: 8, italic: true, color: { argb: 'FF999999' } };
          worksheet.getCell(midR, colIdx).alignment = { horizontal: 'center', vertical: 'middle' };
        });
      } else {
        const hasSig1 = embedSignature(workbook, worksheet, signatures[0], 0, imgStartRow - 1, 1, imgEndRow - 1);
        if (!hasSig1) {
          const midR = imgStartRow + 2;
          worksheet.getCell(`A${midR}`).value = '(Belum Tanda Tangan)';
          worksheet.getCell(`A${midR}`).font = { name: 'Plus Jakarta Sans', size: 8, italic: true, color: { argb: 'FF999999' } };
          worksheet.getCell(`A${midR}`).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        const hasSig2 = embedSignature(workbook, worksheet, signatures[1], 2, imgStartRow - 1, 3, imgEndRow - 1);
        if (!hasSig2) {
          const midR = imgStartRow + 2;
          worksheet.getCell(`C${midR}`).value = '(Belum Tanda Tangan)';
          worksheet.getCell(`C${midR}`).font = { name: 'Plus Jakarta Sans', size: 8, italic: true, color: { argb: 'FF999999' } };
          worksheet.getCell(`C${midR}`).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        const hasSig3 = embedSignature(workbook, worksheet, signatures[2], 4, imgStartRow - 1, 4, imgEndRow - 1);
        if (!hasSig3) {
          const midR = imgStartRow + 2;
          worksheet.getCell(`E${midR}`).value = '(Belum Tanda Tangan)';
          worksheet.getCell(`E${midR}`).font = { name: 'Plus Jakarta Sans', size: 8, italic: true, color: { argb: 'FF999999' } };
          worksheet.getCell(`E${midR}`).alignment = { horizontal: 'center', vertical: 'middle' };
        }
      }

      currentRow = imgEndRow + 1;

      // Names row
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      worksheet.getCell(`A${currentRow}`).value = `(${toTitleCase(names[0] || '—')})`;

      worksheet.mergeCells(`C${currentRow}:D${currentRow}`);
      worksheet.getCell(`C${currentRow}`).value = `(${toTitleCase(names[1] || '—')})`;

      worksheet.getCell(`E${currentRow}`).value = `(${toTitleCase(names[2] || '—')})`;

      worksheet.getRow(currentRow).height = 26;
      [1, 3, 5].forEach((colIdx) => {
        const cell = worksheet.getCell(currentRow, colIdx);
        cell.font = { name: 'Plus Jakarta Sans', size: 9, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      for (let c = 1; c <= 5; c++) {
        worksheet.getCell(currentRow, c).border = thinBorder;
      }
      currentRow++;
    };

    // Draw Stage 1 (Pickup)
    drawSignatureBlock(
      'Tahap 1: Pengambilan Linen Kotor (Pickup)',
      ['Valet IKM', 'Petugas RS', 'Perawat RS'],
      [valetPickupSig, hospPickupSig, asstPickupSig],
      [
        transaction.user_pickup_name,
        transaction.hospital_staff_pickup,
        transaction.hospital_assistant_pickup
      ],
      false,
      'FFE2EFDA',
      'FF1E4620'
    );

    // Spacer
    worksheet.getRow(currentRow).height = 14;
    currentRow++;

    // Draw Stage 2 (Delivery)
    const isDeliveryPending = transaction.status !== 'SELESAI';
    drawSignatureBlock(
      'Tahap 2: Pengiriman Linen Bersih (Delivery)',
      ['Valet IKM', 'Petugas RS', 'Perawat RS'],
      [valetDeliverySig, hospDeliverySig, asstDeliverySig],
      [
        transaction.user_delivery_name,
        transaction.hospital_staff_delivery,
        transaction.hospital_assistant_delivery
      ],
      isDeliveryPending,
      'FFD9E1F2',
      'FF1E2A4A'
    );
  };

  // 1. Build Ringkasan Global worksheet
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

  const globalSheet = workbook.addWorksheet('Ringkasan Global');
  const globalSummaryList = Object.values(globalSummary).map(group => ({
    ...group,
    notes: group.notesList.join('; ')
  }));
  writeSheetData(globalSheet, 'Ringkasan Global', null, globalSummaryList);

  // 2. Build Per-Room worksheets
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

  Object.entries(roomGroups).forEach(([rName, roomItems]) => {
    // Excel sheet name limit is 31 chars, strip characters like : \ / ? * [ ]
    const cleanSheetName = rName.replace(/[:\\/?*\[\]]/g, '').substring(0, 30);
    const roomSheet = workbook.addWorksheet(cleanSheetName || 'Tanpa Ruangan');
    writeSheetData(roomSheet, rName, rName, roomItems);
  });

  // Write file out
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Serah_Terima_${transaction.form_number || 'Dokumen'}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}
