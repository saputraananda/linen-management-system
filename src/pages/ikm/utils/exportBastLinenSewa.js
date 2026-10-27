import kopSuratIkm from '../../../assets/images/kop_surat_ikm.png';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function terbilang(n) {
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const num = Math.floor(Math.abs(Number(n) || 0));
  if (num < 12) return satuan[num];
  if (num < 20) return `${terbilang(num - 10)} Belas`;
  if (num < 100) return `${terbilang(Math.floor(num / 10))} Puluh${num % 10 ? ` ${terbilang(num % 10)}` : ''}`;
  if (num < 200) return `Seratus${num % 100 ? ` ${terbilang(num % 100)}` : ''}`;
  if (num < 1000) return `${terbilang(Math.floor(num / 100))} Ratus${num % 100 ? ` ${terbilang(num % 100)}` : ''}`;
  if (num < 2000) return `Seribu${num % 1000 ? ` ${terbilang(num % 1000)}` : ''}`;
  if (num < 1000000) return `${terbilang(Math.floor(num / 1000))} Ribu${num % 1000 ? ` ${terbilang(num % 1000)}` : ''}`;
  return String(num);
}

function kalimatTanggal(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const weekday = DAYS[new Date(year, month - 1, date).getDay()];
  const monthName = MONTHS[month - 1] || '';
  const pad = String(date).padStart(2, '0');
  return `pada hari ${weekday} Tanggal ${terbilang(date)} ${monthName} ${terbilang(year)} ( ${pad} ${monthName} ${year})`;
}

function unitName(row) {
  return String(row.line_room_name || row.room_name || '').trim() || 'Tanpa Unit';
}

function linenRows(details) {
  const map = new Map();
  for (const row of details || []) {
    const kirim = Number(row.qty_pengiriman) || 0;
    const tarik = Number(row.qty_penarikan) || 0;
    if (!kirim && !tarik) continue;
    const key = String(row.hospital_linen_id || row.linen_name || '');
    const current = map.get(key) || {
      nama: String(row.hospital_linen_name || '').trim() || String(row.master_linen_name || '').trim() || String(row.linen_name || 'Linen'),
      ukuran: row.ukuran || row.size_name || '',
      bahan: row.bahan || row.material_name || '',
      warna: row.warna || row.color_name || '',
      kirim: 0,
      tarik: 0,
    };
    current.kirim += kirim;
    current.tarik += tarik;
    if (row.ukuran) current.ukuran = row.ukuran;
    if (row.bahan) current.bahan = row.bahan;
    if (row.warna) current.warna = row.warna;
    map.set(key, current);
  }
  const items = [...map.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  const anyTarik = items.some((item) => item.tarik > 0);
  const rows = [];
  for (const item of items) {
    if (item.kirim > 0) rows.push({ ...item, jumlah: item.kirim, ket: anyTarik ? 'Pengiriman' : '' });
    if (item.tarik > 0) rows.push({ ...item, jumlah: item.tarik, ket: 'Penarikan' });
  }
  return rows;
}

function partyBlock(people) {
  return people.map((person) => `
    <table class="party">
      <tr><td>Nama</td><td>:</td><td>${esc(person.nama)}</td></tr>
      <tr><td>Jabatan</td><td>:</td><td>${esc(person.jabatan || '-')}</td></tr>
    </table>
  `).join('');
}

function signatureImage(src) {
  const value = String(src || '');
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) return '';
  return `<img src="${value}" alt="" />`;
}

const ROWS_PER_PAGE = 20; // maksimal baris linen per halaman; lebih dari itu pindah halaman (kop diulang)

function itemRowsHtml(rows) {
  return rows.length
    ? rows.map((row, index) => `
      <tr${(index + 1) % ROWS_PER_PAGE === 0 && index + 1 < rows.length ? ' class="pb"' : ''}>
        <td class="mid">${index + 1}</td>
        <td>${esc(row.nama)}</td>
        <td class="mid">${esc(row.ukuran)}</td>
        <td class="mid">${esc(row.bahan)}</td>
        <td class="mid">${esc(row.warna)}</td>
        <td class="mid">${row.jumlah}${row.ket ? `<div class="ket">${esc(row.ket)}</div>` : ''}</td>
      </tr>
    `).join('')
    : '<tr><td class="mid" colspan="6">Tidak ada barang</td></tr>';
}

const ITEMS_HEAD = `<thead>
        <tr>
          <th style="width:36px">No.</th>
          <th>Nama Linen</th>
          <th>Ukuran</th>
          <th>Bahan</th>
          <th>Warna</th>
          <th style="width:72px">Jumlah</th>
        </tr>
      </thead>`;

// Satu dokumen: halaman 1 = General (semua unit), lalu satu halaman per unit (bila lebih dari satu unit)
export function renderBastHtml(bast, kopUrl) {
  const hospital = String(bast.hospital_name || '').trim();
  const room = String(bast.room_name || '').trim();
  const place = !room || /seluruh|beberapa/i.test(room) ? hospital : `${hospital} ${room}`;
  const hasGa = Boolean(String(bast.ga_head_name || '').trim());
  const pertama = [];
  if (bast.ga_head_name) pertama.push({ nama: bast.ga_head_name, jabatan: bast.ga_head_position });
  if (bast.receiver_name) pertama.push({ nama: bast.receiver_name, jabatan: bast.receiver_position });
  const kedua = bast.sender_name ? [{ nama: bast.sender_name, jabatan: bast.sender_position }] : [];
  const sign = (label, role, src, name, position) => `
    <div>
      <div>${label}</div>
      ${role ? `<div class="role">${role}</div>` : '<div class="role">&nbsp;</div>'}
      <div class="sign">${signatureImage(src)}</div>
      <div class="who">${esc(name || '')}</div>
      <div>${esc(position || '')}</div>
    </div>
  `;

  // Halaman mengalir otomatis: kop ada di <thead> sehingga diulang di setiap halaman cetak.
  const page = (subtitle, unit, rows) => `
  <section class="page">
    <table class="sheet">
      <thead><tr><td><div class="kop-wrap"><img class="kop" src="${esc(kopUrl)}" alt="" /></div></td></tr></thead>
      <tfoot><tr><td><div class="foot-space"></div></td></tr></tfoot>
      <tbody><tr><td>
        <div class="doc">
          <h1>BERITA ACARA</h1>
          <h2>${esc(subtitle)}</h2>
          ${unit ? `<h2 class="unit-title">${esc(unit)}</h2>` : ''}
          <div class="nomor">${esc(bast.bast_number || '')}</div>
          <p>Kami yang bertandatangan dibawah ini, ${esc(kalimatTanggal(bast.bast_date))}, yang bertanda tangan di bawah :</p>
          ${partyBlock(pertama)}
          <div class="called">Selanjutnya disebut Pihak Pertama</div>
          ${partyBlock(kedua)}
          <div class="called">Selanjutnya disebut Pihak Kedua</div>
          <p>Pihak kedua menyerahkan barang atau linen sewa kepada pihak pertama dan pihak pertama menyatakan telah menerima barang atau linen dari pihak kedua dalam keadaan baru dan baik berupa:</p>
          <table class="items">${ITEMS_HEAD}<tbody>${itemRowsHtml(rows)}</tbody></table>
          <div class="closing">
            <p>Demikian berita serah terima barang atau linen ini dibuat oleh kedua belah pihak. Sejak penandatanganan Berita Acara ini maka barang atau linen menjadi tanggung jawab PIHAK PERTAMA untuk memelihara dan merawatnya dengan baik.</p>
            <div class="ttd${hasGa ? '' : ' two'}">
              ${sign('Yang menyerahkan,', 'PIHAK KEDUA', bast.signature_sender, bast.sender_name, bast.sender_position)}
              ${sign('Yang menerima,', 'PIHAK PERTAMA', bast.signature_receiver, bast.receiver_name, bast.receiver_position)}
              ${hasGa ? sign('Mengetahui,', '', bast.signature_ga, bast.ga_head_name, bast.ga_head_position) : ''}
            </div>
          </div>
        </div>
      </td></tr></tbody>
    </table>
  </section>`;
  const groups = new Map();
  for (const d of bast.details || []) {
    const key = unitName(d);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }
  const generalSubtitle = `SERAH TERIMA LINEN SEWA ${place}`.replace(/\s+/g, ' ').trim();
  const unitSubtitle = `SERAH TERIMA LINEN SEWA ${hospital}`.replace(/\s+/g, ' ').trim();
  const pages = [page(generalSubtitle, '', linenRows(bast.details))];
  if (groups.size > 1) {
    [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'id'))
      .forEach(([unit, list]) => pages.push(page(unitSubtitle, `UNIT ${unit}`, linenRows(list))));
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${esc(bast.bast_number || 'Berita Acara')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; background: #fff; color: #111; color-scheme: light; font-family: "Plus Jakarta Sans", Poppins, sans-serif; font-size: 12px; line-height: 1.45; }
    .page { break-after: page; page-break-after: always; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    .kop-wrap { height: 32mm; overflow: hidden; }
    table.sheet { width: 100%; border-collapse: collapse; }
    table.sheet > thead { display: table-header-group; }
    table.sheet > tfoot { display: table-footer-group; }
    table.sheet > thead > tr > td, table.sheet > tbody > tr > td, table.sheet > tfoot > tr > td { padding: 0; vertical-align: top; }
    .foot-space { height: 10mm; }
    table.items thead { display: table-header-group; }
    table.items tr { break-inside: avoid; page-break-inside: avoid; }
    table.items tr.pb { break-after: page; page-break-after: always; }
    .closing { break-inside: avoid; page-break-inside: avoid; }
    .kop { width: 100%; display: block; margin: 0; }
    .doc { margin-top: 2mm; padding: 0 14mm; }
    h1, h2 { margin: 0; text-align: center; font-size: 14px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
    h2 { margin-top: 2px; }
    .unit-title { margin-top: 4px; }
    .nomor { margin: 2px 0 12px; text-align: center; font-size: 12px; }
    p { margin: 8px 0; text-align: justify; }
    .party { margin: 2px 0 2px 36px; border-collapse: collapse; }
    .party td { padding: 0 4px 0 0; vertical-align: top; }
    .party td:first-child { width: 72px; }
    .party td:nth-child(2) { width: 12px; }
    .called { margin: 2px 0 10px 36px; font-weight: 700; }
    table.items { width: 100%; border-collapse: collapse; margin: 8px 0 12px; }
    table.items th, table.items td { border: 1px solid #111; padding: 3px 6px; }
    table.items th { text-align: center; font-weight: 700; }
    .mid { text-align: center; }
    .ket { font-size: 9px; font-style: italic; }
    .ttd { display: flex; margin-top: 22px; text-align: center; page-break-inside: avoid; }
    .ttd > div { width: 33.33%; padding: 0 8px; }
    .ttd.two { justify-content: space-around; }
    .ttd.two > div { width: 40%; }
    .role { font-weight: 700; }
    .sign { height: 78px; display: flex; align-items: flex-end; justify-content: center; }
    .sign img { max-height: 72px; max-width: 150px; object-fit: contain; }
    .who { margin-top: 2px; font-weight: 700; text-decoration: underline; }
  </style>
</head>
<body>${pages.join('')}
</body>
</html>`;
}
export default function exportBastLinenSewa(bast) {
  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) return false;
  const kopUrl = new URL(kopSuratIkm, window.location.href).href;
  win.document.open();
  win.document.write(renderBastHtml(bast, kopUrl));
  win.document.close();
  const print = () => {
    const go = () => setTimeout(() => win.print(), 200);
    const fonts = win.document.fonts;
    if (fonts?.ready) fonts.ready.then(go).catch(go);
    else go();
  };
  const image = win.document.querySelector('img.kop');
  if (!image || image.complete) print();
  else {
    image.onload = print;
    image.onerror = print;
  }
  return true;
}
