import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    console.error('Error fetching signature image URL for PDF:', trimmed, err);
    return null;
  }
};

/**
 * Trims empty transparent/white canvas padding around signature stroke pixels
 */
const trimImageBase64 = (base64Data) => {
  return new Promise((resolve) => {
    if (!base64Data || typeof base64Data !== 'string' || !base64Data.startsWith('data:image')) {
      return resolve(null);
    }

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imgData.data;

        let minX = img.width;
        let minY = img.height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const idx = (y * img.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            const isFilled = a > 20 && !(r > 240 && g > 240 && b > 240);
            if (isFilled) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX < minX || maxY < minY) {
          return resolve({ base64: base64Data, width: img.width, height: img.height });
        }

        const padding = 12;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(img.width - 1, maxX + padding);
        maxY = Math.min(img.height - 1, maxY + padding);

        const cropWidth = maxX - minX + 1;
        const cropHeight = maxY - minY + 1;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropWidth;
        cropCanvas.height = cropHeight;
        const cropCtx = cropCanvas.getContext('2d');

        cropCtx.drawImage(
          canvas,
          minX, minY, cropWidth, cropHeight,
          0, 0, cropWidth, cropHeight
        );

        const trimmedBase64 = cropCanvas.toDataURL('image/png');
        resolve({ base64: trimmedBase64, width: cropWidth, height: cropHeight });
      } catch (err) {
        console.error('Error trimming signature image for PDF:', err);
        resolve({ base64: base64Data, width: img.width, height: img.height });
      }
    };
    img.onerror = () => {
      resolve({ base64: base64Data, width: 200, height: 100 });
    };
    img.src = base64Data;
  });
};

const fetchAndTrimSignature = async (imgUrl) => {
  const rawBase64 = await fetchImageAsBase64(imgUrl);
  if (!rawBase64) return null;
  return await trimImageBase64(rawBase64);
};

/**
 * Exports Serah Terima Linen transaction to a beautifully formatted PDF document
 */
export default async function exportSerahTerimaLinenPDF(transaction, details) {
  // Fetch and trim all 6 signature images concurrently
  const [
    valetPickupSig,
    hospPickupSig,
    asstPickupSig,
    valetDeliverySig,
    hospDeliverySig,
    asstDeliverySig
  ] = await Promise.all([
    fetchAndTrimSignature(transaction.signature_valet_pickup),
    fetchAndTrimSignature(transaction.signature_hospital_pickup),
    fetchAndTrimSignature(transaction.signature_assistant_pickup),
    fetchAndTrimSignature(transaction.signature_valet_delivery),
    fetchAndTrimSignature(transaction.signature_hospital_delivery),
    fetchAndTrimSignature(transaction.signature_assistant_delivery)
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2); // 186mm

  let currentY = 12;

  // 1. Header Banner Box
  doc.setFillColor(235, 243, 245); // Light Teal
  doc.setDrawColor(18, 103, 118); // Teal border
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, contentWidth, 26, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(18, 103, 118);
  doc.text('FORM SERAH TERIMA LINEN PT INTERSOLUSI KARYA MANDIRI', pageWidth / 2, currentY + 7, { align: 'center' });

  const hospName = transaction.hospital_name ? transaction.hospital_name.toUpperCase() : 'RUMAH SAKIT';
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(hospName, pageWidth / 2, currentY + 14, { align: 'center' });

  const pickupDateObj = new Date(transaction.pickup_date);
  const formattedDate = pickupDateObj.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const formNum = transaction.form_number ? `No. Form: ${transaction.form_number}` : '';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${formNum ? formNum + '  |  ' : ''}Tanggal: ${formattedDate}`, pageWidth / 2, currentY + 20, { align: 'center' });

  currentY += 32;

  // Group details by hospital_linen_id to avoid double rows for the same linen
  const groupedDetailsMap = {};
  details.forEach(item => {
    const lid = item.hospital_linen_id;
    if (!groupedDetailsMap[lid]) {
      groupedDetailsMap[lid] = {
        ...item,
        qty_kotor: 0,
        qty_bersih: 0,
        notesList: []
      };
    }
    groupedDetailsMap[lid].qty_kotor += parseInt(item.qty_kotor || 0);
    if (item.qty_bersih !== null && item.qty_bersih !== undefined) {
      groupedDetailsMap[lid].qty_bersih += parseInt(item.qty_bersih || 0);
    }
    if (item.notes && item.notes.trim() !== '') {
      groupedDetailsMap[lid].notesList.push(item.notes.trim());
    }
  });

  const aggregatedDetails = Object.values(groupedDetailsMap).map(group => ({
    ...group,
    notes: group.notesList.join('; ')
  }));

  // 2. Table of Items
  const tableData = aggregatedDetails.map((item, index) => [
    index + 1,
    getLinenDisplayName(item),
    parseInt(item.qty_kotor || 0),
    transaction.status === 'SELESAI' ? parseInt(item.qty_bersih || 0) : '—',
    item.notes || '-'
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['No', 'Jenis Linen', 'Kotor', 'Bersih', 'Keterangan']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [18, 103, 118],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      valign: 'middle'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left', cellWidth: 70 },
      2: { halign: 'center', cellWidth: 26 },
      3: { halign: 'center', cellWidth: 26 },
      4: { halign: 'left' }
    },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // Helper to draw a Signature Block with 3 columns (Valet IKM, Petugas RS, Perawat RS)
  const drawSignatureBlockPDF = (sectionTitle, labels, signatures, names, isDeliveryPending = false) => {
    // Check if remaining page height is sufficient for signature block (~55mm)
    const pageHeight = doc.internal.pageSize.getHeight();
    if (currentY + 52 > pageHeight - 12) {
      doc.addPage();
      currentY = 14;
    }

    // Section Header Banner
    doc.setFillColor(226, 239, 218); // Light Green matching Excel
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(margin, currentY, contentWidth, 7, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 95, 116);
    doc.text(sectionTitle, margin + 4, currentY + 4.8);

    currentY += 7;

    const colGap = 4;
    const colWidth = (contentWidth - (colGap * 2)) / 3; // ~58mm per column box
    const boxHeight = 26; // Height for signature drawing area

    labels.forEach((label, idx) => {
      const boxX = margin + idx * (colWidth + colGap);
      const sigObj = signatures[idx];
      const name = names[idx];

      // 1. Column Header (Label)
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.rect(boxX, currentY, colWidth, 6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(label, boxX + (colWidth / 2), currentY + 4.2, { align: 'center' });

      const sigBoxY = currentY + 6;

      // 2. Signature Area Box
      doc.setFillColor(255, 255, 255);
      doc.rect(boxX, sigBoxY, colWidth, boxHeight, 'FD');

      if (isDeliveryPending) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('(Belum Ada Pengiriman)', boxX + (colWidth / 2), sigBoxY + (boxHeight / 2) + 1, { align: 'center' });
      } else if (sigObj && sigObj.base64) {
        // Embed signature image centered horizontally & vertically
        const imgW_orig = sigObj.width || 200;
        const imgH_orig = sigObj.height || 100;
        const ar = imgW_orig / imgH_orig;

        // Natural aspect-ratio-aware scale to prevent pixelation/thickening
        const maxBoxW = colWidth * 0.60; // ~35mm max width
        const maxBoxH = 12; // 12mm max height

        let targetW, targetH;

        if (ar > 1.2) {
          // Horizontal signature stroke (e.g. flat line or delivery signature)
          targetW = Math.min(maxBoxW, 35);
          targetH = targetW / ar;
          if (targetH > maxBoxH) {
            targetH = maxBoxH;
            targetW = targetH * ar;
          }
          // Allow thin horizontal lines to stay 2.5mm tall without vertical distortion
          if (targetH < 2.5) targetH = 2.5;
        } else {
          // Normal or vertical signature stroke
          targetH = Math.min(maxBoxH, 12);
          targetW = targetH * ar;
          if (targetW > maxBoxW) {
            targetW = maxBoxW;
            targetH = targetW / ar;
          }
          if (targetH < 5) targetH = 5;
          if (targetW < 8) targetW = 8;
        }

        const imgX = boxX + (colWidth - targetW) / 2;
        const imgY = sigBoxY + (boxHeight - targetH) / 2;

        try {
          doc.addImage(sigObj.base64, 'PNG', imgX, imgY, targetW, targetH);
        } catch (e) {
          console.error('Error adding signature image to PDF:', e);
        }
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('(Belum Tanda Tangan)', boxX + (colWidth / 2), sigBoxY + (boxHeight / 2) + 1, { align: 'center' });
      }

      const nameBoxY = sigBoxY + boxHeight;

      // 3. Name Label Box below signature
      doc.setFillColor(255, 255, 255);
      doc.rect(boxX, nameBoxY, colWidth, 6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const nameText = `(${toTitleCase(name || '—')})`;
      doc.text(nameText, boxX + (colWidth / 2), nameBoxY + 4.2, { align: 'center' });
    });

    currentY += 6 + boxHeight + 6 + 6; // advance Y for next section
  };

  // 1. Session 1: Proses Pickup Linen Kotor
  drawSignatureBlockPDF(
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

  // 2. Session 2: Pengiriman Linen Bersih
  const isDeliveryPending = transaction.status !== 'SELESAI';
  drawSignatureBlockPDF(
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

  // Save the generated PDF file
  const fileName = `Serah_Terima_${transaction.form_number || 'Dokumen'}.pdf`;
  doc.save(fileName);
}
