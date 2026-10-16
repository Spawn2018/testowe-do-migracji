/**
 * wyglad/E49 — linie wiatru, postoju przez wiatr, śliskości, zamknięcia i objazdu w szczegółach ETA (E15;
 * D-20261016-0230-01 Z1, Z3, Z4). Mały plik w pierwszym wczytaniu (panel transportu); sprawa „Objazd czy postój?”
 * jest w `e49Detour.ts` (kawałek Ryzyk).
 */

/** „35 min”, „1 h 05 min”, „3 h” — ze spacjami nierozdzielającymi (liczba i jednostka w jednej linii). */
export function minText(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')} min` : `${h} h`;
}

/* ---------- ETA: wiatr, postój, śliskość, objazd (E15, D-20261016-0230-01 Z1, Z3, Z4) ---------- */

export type EtaWxKind = 'WIND' | 'WIND_HOLD' | 'SLIPPERY' | 'CLOSURE_HOLD' | 'DETOUR';
export interface EtaWx {
  kind: EtaWxKind;
  /** ile minut dodaje do ETA */
  addMin: number;
  /** odcinek albo miejsce: „E4 Skellefteå–Piteå” */
  where: string;
  /** poryw z prognozy (m/s) — przy wietrze */
  gustMs?: number | null;
  /** wiatr z boku albo z przodu — przy WIND */
  side?: 'CROSS' | 'HEAD' | null;
  /** godzina prognozy / przejazdu odcinka */
  atIso?: string | null;
  /** postój od–do */
  fromIso?: string | null;
  untilIso?: string | null;
  source: 'SMHI' | 'TRAFIKVERKET' | 'HERE' | 'SCX';
}

/** Z `eta_basis.causes.weather` (serwer, Z1 pkt 4) — tylko poprawne wpisy, największy wpływ pierwszy. */
export function etaWxFromCauses(raw: unknown): EtaWx[] {
  if (!Array.isArray(raw)) return [];
  const kinds: EtaWxKind[] = ['WIND', 'WIND_HOLD', 'SLIPPERY', 'CLOSURE_HOLD', 'DETOUR'];
  return raw
    .filter((x): x is EtaWx => !!x && typeof x === 'object'
      && kinds.includes((x as EtaWx).kind) && Number.isFinite(Number((x as EtaWx).addMin)) && typeof (x as EtaWx).where === 'string')
    .map((x) => ({ ...x, addMin: Math.round(Number(x.addMin)) }))
    .sort((a, b) => b.addMin - a.addMin);
}
