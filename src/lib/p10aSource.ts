/**
 * wyglad/P10a-a — skąd pasek nowej wersji i znacznik „na żywo” biorą dane (E22; PLAN P10a). Produkcja:
 * - nowa wersja — sygnał z `lazyRetry` (stary chunk po wdrożeniu; DP-224 C / #817 B2) oraz docelowo `version.json`;
 * - „na żywo” — godzina ostatniego odświeżenia danych (Realtime albo zapas co 60 s) i brak połączenia (E22 pkt 2).
 * Demo: pasek przy `nowa-wersja=1` w adresie (dowody i testy), znacznik z godziny „teraz” i stanu sieci przeglądarki.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0). Bez zapytań.
 */
import { useEffect, useState } from 'react';
import { getNowMs } from './frozenNow';
import { isNewVersionSignaled, subscribeNewVersion } from './newVersionSignal';

export function useNewVersion(): boolean {
  const demo = import.meta.env.VITE_AUTH_MODE !== 'supabase';
  const readDemo = () => demo && typeof window !== 'undefined' && /[?&]nowa-wersja=1\b/.test(window.location.hash);
  const read = () => (demo ? readDemo() : isNewVersionSignaled());
  const [on, setOn] = useState(read);
  useEffect(() => {
    if (demo) {
      const f = () => setOn(readDemo());
      window.addEventListener('hashchange', f);
      return () => window.removeEventListener('hashchange', f);
    }
    const f = () => setOn(isNewVersionSignaled());
    setOn(isNewVersionSignaled());
    return subscribeNewVersion(f);
  }, [demo]);
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
