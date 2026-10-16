/**
 * wyglad/E49 — linie ETA dla panelu transportu bez danych demo w pierwszym wczytaniu: produkcja czyta
 * `load.etaDetail.weather` (serwer, D-20261016-0230-01 Z1 pkt 4); demo dociąga przykład z `e49Source` dopiero
 * po otwarciu panelu. Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import { useEffect, useState } from 'react';
import type { Load } from '../types';
import type { EtaWx } from './e49Wx';

export function useEtaWx(load: Load | null | undefined, loads: readonly Load[], nowIso: string): readonly EtaWx[] {
  const [demo, setDemo] = useState<readonly EtaWx[]>([]);
  const live = import.meta.env.VITE_AUTH_MODE === 'supabase';
  useEffect(() => {
    if (live || !load) return;
    let on = true;
    void import('./e49Source').then((m) => { if (on) setDemo(m.etaWxOf(load, loads, nowIso)); });
    return () => { on = false; };
  }, [live, load, loads, nowIso]);
  if (!load) return [];
  return live ? (load.etaDetail?.weather ?? []) : demo;
}
