import { useEffect, useState } from 'react';

/** E8 (wyglad/P2-2): telefon = szerokość ≤ 768 px. Na komputerze widoki zostają przy tabelach (E8 pkt 9). */
export const PHONE_QUERY = '(max-width: 768px)';

function matchesPhone(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
}

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(matchesPhone);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}
