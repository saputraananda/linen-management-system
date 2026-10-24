import { useEffect } from 'react';

let locks = 0;

// Kunci scroll halaman selama modal terbuka (aman untuk modal bertumpuk)
export default function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    if (locks++ === 0) document.body.style.overflow = 'hidden';
    return () => {
      if (--locks === 0) document.body.style.overflow = '';
    };
  }, [active]);
}
