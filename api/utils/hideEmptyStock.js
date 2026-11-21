// Linen yang stok awal ruangannya masih 0 (dan belum ada aktivitas apa pun) tidak perlu ditampilkan.
// "Aktivitas" = terpakai, dirty utility, sedang dicuci, kurang kirim, atau hasil SO. Jika salah satunya > 0
// baris tetap tampil supaya data yang sudah tercatat tidak hilang dari layar.
const n = (v) => parseInt(v, 10) || 0;

export const roomLinenHasData = (rl) =>
  n(rl.stock_in_rs) > 0 ||
  n(rl.qty_terpakai) > 0 ||
  n(rl.qty_dirty) > 0 ||
  n(rl.qty_cuci) > 0 ||
  n(rl.qty_kurang) > 0 ||
  n(rl.so_result) > 0;

export const linenHasData = (hl) =>
  n(hl.stock_in_rs) > 0 ||
  n(hl.total_terpakai) > 0 ||
  n(hl.total_dirty) > 0 ||
  n(hl.total_cuci) > 0 ||
  n(hl.total_kurang) > 0 ||
  n(hl.total_so) > 0;

// Pengecualian: linen MILIK_RS stoknya tidak diketahui (milik RS, bukan stok IKM),
// jadi selalu ditampilkan walau semua angkanya 0. Aturan sembunyi hanya berlaku untuk linen sewa.
export function hideEmptyStock(allLinens, allRoomLinens) {
  const milikRsIds = new Set(allLinens.filter((hl) => hl.ownership_type === 'MILIK_RS').map((hl) => hl.id));
  const roomLinens = allRoomLinens.filter((rl) => milikRsIds.has(rl.hospital_linen_id) || roomLinenHasData(rl));
  const withRoomData = new Set(roomLinens.map((rl) => rl.hospital_linen_id));
  const linens = allLinens.filter((hl) => milikRsIds.has(hl.id) || linenHasData(hl) || withRoomData.has(hl.id));
  return { linens, roomLinens };
}
