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

export function hideEmptyStock(allLinens, allRoomLinens) {
  const roomLinens = allRoomLinens.filter(roomLinenHasData);
  const withRoomData = new Set(roomLinens.map((rl) => rl.hospital_linen_id));
  const linens = allLinens.filter((hl) => linenHasData(hl) || withRoomData.has(hl.id));
  return { linens, roomLinens };
}
