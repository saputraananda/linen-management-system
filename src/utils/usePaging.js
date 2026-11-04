import { useCallback, useState } from 'react';
import { DEFAULT_PAGE_SIZE } from '../components/Pagination';

// State pagination server-side yang dipakai bersama semua halaman daftar.
//   const pg = usePaging();
//   request:   params: { page: pg.page, limit: pg.pageSize }      (deps: pg.page, pg.pageSize)
//   response:  pg.accept(data.pagination)                          (server merapikan halaman di luar jangkauan)
//   filter:    onChange -> pg.resetPage()                          (kembali ke halaman 1)
//   footer:    <Pagination pagination={pg.pagination} pageSize={pg.pageSize} onChange={pg.goTo} onPageSizeChange={pg.setPageSize} />
export default function usePaging() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE); // angka atau 'all'
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 });

  const accept = useCallback((p) => {
    if (!p) return;
    setPagination(p);
    setPage((cur) => (cur === p.page ? cur : p.page));
  }, []);
  const resetPage = useCallback(() => setPage(1), []);
  const setPageSize = useCallback((s) => { setPageSizeState(s); setPage(1); }, []);
  const goTo = useCallback((p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  return { page, pageSize, pagination, accept, resetPage, setPageSize, goTo };
}
