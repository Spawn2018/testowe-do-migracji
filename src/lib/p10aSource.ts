/**
 * wyglad/P10a-a — skąd pasek nowej wersji i znacznik „na żywo” biorą dane (E22; PLAN P10a). Produkcja przed
 * podłączeniem: paska nie ma (`false`), znacznika nie ma (`null`). Wykonawca podłącza:
 * - nowa wersja — `version.json` z buildu, sprawdzany co 5 min i po powrocie do karty (E22 pkt 3);
 * - „na żywo” — godzina ostatniego odświeżenia danych (Realtime albo zapas co 60 s) i brak połączenia (E22 pkt 2).
 * Demo: pasek przy `nowa-wersja=1` w adresie (dowody i testy), znacznik z godziny „teraz” i stanu sieci przeglądarki.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0). Bez zapytań.
 */
import { useEffect, useState } from 'react';
import { getNowMs } from './frozenNow';

export function useNewVersion(): boolean {
  const demo = import.meta.env.VITE_AUTH_MODE !== 'supabase';
  const read = () => demo && typeof window !== 'undefined' && /[?&]nowa-wersja=1\b/.test(window.location.hash);
  const [on, setOn] = useState(read);
  useEffect(() => {
    if (!demo) return;
    const f = () => setOn(read());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  });
  return on;
}

export interface LiveState { ok: boolean; atMs: number }

export function useLive(): LiveState | null {
  const demo = import.meta.env.VITE_AUTH_MODE !== 'supabase';
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const [since, setSince] = useState<number>(() => getNowMs());
  useEffect(() => {
    if (!demo) return;
    const up = () => { setOnline(true); setSince(getNowMs()); };
    const down = () => { setOnline(false); setSince(getNowMs()); };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [demo]);
  if (!demo) return null;
  return { ok: online, atMs: since };
}
