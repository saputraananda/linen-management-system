// Helper paging server-side yang dipakai bersama semua daftar.
// Query: ?page=1&limit=10 (limit 1..100) atau limit=all (dibatasi ALL_CAP demi keamanan).
export const PAGE_SIZE = 10;
export const ALL_CAP = 2000;

export const parsePaging = (query) => ({
  page: Math.max(1, parseInt(query.page, 10) || 1),
  limit: query.limit === 'all' ? ALL_CAP : Math.min(100, Math.max(1, parseInt(query.limit, 10) || PAGE_SIZE)),
});

// Halaman di luar jangkauan (mis. baris terakhir halaman ini baru dihapus) dirapikan ke halaman terakhir.
export const buildPagination = (paging, total) => {
  const limit = paging.limit;
  const totalPages = Math.max(1, Math.ceil(Number(total) / limit));
  return { page: Math.min(paging.page, totalPages), limit, total: Number(total), totalPages };
};

export const offsetOf = (p) => (p.page - 1) * p.limit;
