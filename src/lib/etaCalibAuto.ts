/**
 * wyglad/W-604 (#581 P4-k cz. 2, migracja 0320) — kalibracja ETA ciągła po stronie ekranu.
 *
 * Baza (0320): `eta_auto_apply_pending` sama stosuje propozycję ze zmianą ≤ 15 % i wysyła aktywnym
 * administratorom HHL powiadomienie `ETA_CALIBRATION_AUTO` (tylko IN_APP; payload: `version`, `undo_version`,
 * `max_change_pct`, `codes`, `title`, `summary`, `locale`, `matrix_event = 'eta_calib'`). Zmiana > 15 % otwiera
 * decyzję `ETA_CALIBRATION_APPROVAL` (detail: `version`, `max_change_pct`). Cofnięcie: `eta_calibration_undo(p_version)`
 * — tylko HHL_ADMIN, działa także przy zamrożeniu. Wersje: `eta_calibration_versions.undone_at / rejected_at`,
 * `note` z dopiskami `auto-applied`, `undone`, `rejected`, `superseded`.
 *
 * Tekst w dzwonku powstaje tu, a nie w `notifyTemplates.ts` (jak `KSH_IMPORT_SUMMARY`) — dzwonek tylko po polsku (8A).
 */

import type { CalibVersion } from './etaCalibSource';

export const ETA_CALIBRATION_AUTO = 'ETA_CALIBRATION_AUTO';
export const ETA_CALIBRATION_APPROVAL = 'ETA_CALIBRATION_APPROVAL';
/** Próg auto-zastosowania w bazie (`eta_auto_apply_pending`: > 0.15 → decyzja HHL). */
export const ETA_AUTO_MAX_PCT = 15;

/** Adres ekranu Opcje › Zasady transportu › Kalibracja ETA (`routes.ts`). */
export const CALIB_PATH = '/opcje/kalibracja-eta';

/** Krótkie nazwy odcinków (kody `eta_segment_params`); kod spoza listy zostaje kodem. */
export const SEGMENT_SHORT: Readonly<Record<string, string>> = {
  PL_ROAD: 'Droga PL',
  PL_ROAD_GDY: 'Droga PL (Gdynia)',
  PORT_CHECKIN: 'odprawa',
  CROSSING_DEFAULT: 'rejs',
  SE_ROAD: 'Droga SE',
  SE_ROAD_KAA: 'Droga SE (Karlskrona)',
  /* #619 / 27B:C: osobny odcinek kalibracji — wariant śródlądowy Karlskrona → Boden */
  SE_ROAD_KAA_INLAND: 'Droga SE (Karlskrona, śródlądowa)',
  SE_BREAKS: 'przerwy',
  SE_DAILY_REST: 'odpoczynek dobowy',
};

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
};

/** „18,4%” — procent po polsku, jedna cyfra po przecinku, bez odstępu (P11, E21). */
export function pctPl(v: number): string {
  return `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(v)}%`;
}

/** Numer wersji z payloadu `ETA_CALIBRATION_AUTO` (`undo_version`, inaczej `version`). */
export function calibVersionOf(template: string | null | undefined, payload: Record<string, unknown> | null | undefined): number | undefined {
  if (template !== ETA_CALIBRATION_AUTO || !payload) return undefined;
  const v = num(payload.undo_version) ?? num(payload.version);
  return v != null && v > 0 ? Math.trunc(v) : undefined;
}

/** Adres kliknięcia w dzwonku: ekran kalibracji z podświetloną wersją. */
export function calibPathOf(version: number | undefined): string {
  return version != null ? `${CALIB_PATH}?wersja=${version}` : CALIB_PATH;
}

/**
 * Tytuł i treść w dzwonku: „Wersja N · zmiana do X% · odcinki: Droga SE, przerwy”. Nazwy odcinków z `labels`
 * (np. `eta_segment_params.label`), potem krótkie nazwy, na końcu kod. Bez liczb — `payload.summary` z bazy.
 */
export function etaCalibAutoNotice(
  p: Record<string, unknown>,
  labels?: Readonly<Record<string, string>>,
): { subject: string; body: string } {
  const subject = 'Kalibracja ETA zastosowana automatycznie';
  const ver = num(p.undo_version) ?? num(p.version);
  const pct = num(p.max_change_pct);
  const codes = Array.isArray(p.codes) ? p.codes.filter((c): c is string => typeof c === 'string' && c.trim() !== '') : [];
  /* #616 D3: bez argumentu — nazwy odcinków z `payload.labels` (0327: kod → `eta_segment_params.label`). */
  const fromPayload = p.labels && typeof p.labels === 'object' && !Array.isArray(p.labels)
    ? (p.labels as Record<string, unknown>) : undefined;
  const lbl = (c: string): string | undefined => {
    const a = labels?.[c];
    if (typeof a === 'string' && a.trim()) return a.trim();
    const b = fromPayload?.[c];
    return typeof b === 'string' && b.trim() ? b.trim() : undefined;
  };
  const name = (c: string) => lbl(c) || SEGMENT_SHORT[c] || c;
  const parts = [
    ver != null ? `Wersja ${ver}` : null,
    pct != null ? `zmiana do ${pctPl(pct)}` : null,
    codes.length ? `odcinki: ${codes.map(name).join(', ')}` : null,
  ].filter(Boolean);
  if (ver != null && parts.length > 1) return { subject, body: parts.join(' · ') };
  const summary = typeof p.summary === 'string' && p.summary.trim() ? p.summary.trim() : null;
  return { subject, body: summary ?? (parts.length ? parts.join(' · ') : 'Otwórz Kalibrację ETA, aby zobaczyć zmienione czasy odcinków.') };
}

/* ── błędy bazy ─────────────────────────────────────────────────────────── */

export type CalibErrCode =
  | 'NOT_ADMIN' | 'APPLY_NEWER' | 'UNDO_NEWER' | 'BUSY' | 'FROZEN' | 'UNDO_MISSING' | 'UNDONE' | 'APPLY_MISSING';

/** Komunikat funkcji kalibracji (P0001 / 42501, kod w `message`) → kod błędu; `null` — nie z kalibracji. */
export function calibErrCode(e: { code?: string | null; message?: string | null } | null | undefined): CalibErrCode | null {
  const m = (e?.message ?? '').trim();
  if (!m) return null;
  if (/\bETA_NOT_ADMIN\b/.test(m)) return 'NOT_ADMIN';
  if (/\bETA_APPLY_NEWER\b/.test(m)) return 'APPLY_NEWER';
  if (/\bETA_UNDO_NEWER\b/.test(m)) return 'UNDO_NEWER';
  if (/\bETA_CALIB_BUSY\b/.test(m) || /^BUSY\b/.test(m)) return 'BUSY';
  if (/\bETA_FROZEN\b/.test(m) || /^kalibracja zamrożona/i.test(m)) return 'FROZEN';
  if (/\bETA_UNDO_MISSING\b/.test(m)) return 'UNDO_MISSING';
  if (/\bETA_APPLY_UNDONE\b/.test(m) || /^wersja cofnięta/i.test(m)) return 'UNDONE';
  if (/\bETA_APPLY_MISSING\b/.test(m)) return 'APPLY_MISSING';
  return null;
}

/** Klucz słownika ekranu (p3c.ts: `cal_err_*`); `null` — pokaż ogólny komunikat bazy. */
export function calibErrorKey(e: { code?: string | null; message?: string | null } | null | undefined): string | null {
  const c = calibErrCode(e);
  return c ? `cal_err_${c}` : null;
}

/* ── status wersji ──────────────────────────────────────────────────────── */

export type CalibVersionStatus = 'applied' | 'undone' | 'rejected' | 'superseded' | 'pending_auto' | 'pending_decision' | 'pending';

export interface CalibVersionDb {
  id: number;
  created_by: string | null;
  applied: boolean;
  undone_at?: string | null;
  rejected_at?: string | null;
  note: string | null;
  params_before?: Record<string, { hours?: number | string | null; spread_pct?: number | string | null }> | null;
  params_after?: Record<string, { hours?: number | string | null; spread_pct?: number | string | null }> | null;
  /* F7 r1 B2: warunki auto-zastosowania w bazie (D11: n ≥ 10; test wsteczny musi poprawiać błąd) */
  n_obs?: number | null;
  error_before_min?: number | string | null;
  error_after_min?: number | string | null;
}

/** D11 (0320): auto-zastosowanie tylko przy co najmniej tylu obserwacjach w wersji. */
export const ETA_AUTO_MIN_OBS = 10;

/** Największa zmiana wersji jako ułamek (0.1504 = 15,04%) — ta sama reguła co `eta_auto_apply_pending` (godziny względnie, rozrzut w pp). */
export function maxChangeRaw(v: Pick<CalibVersionDb, 'params_before' | 'params_after'>): number | null {
  const a = v.params_after ?? null;
  const b = v.params_before ?? null;
  if (!a || !b) return null;
  let max: number | null = null;
  for (const [k, x] of Object.entries(a)) {
    const y = b[k];
    if (!y) continue;
    const hn = num(x?.hours);
    const ho = num(y.hours);
    if (hn == null || ho == null || ho === 0) continue;
    let c = Math.abs(hn - ho) / ho;
    const sn = num(x?.spread_pct);
    const so = num(y.spread_pct);
    c = Math.max(c, Math.abs((sn ?? 0) - (so ?? 0)) / 100);
    max = Math.max(max ?? 0, c);
  }
  return max;
}

/** Największa zmiana w % z jedną cyfrą po przecinku (do wyświetlenia — progu nie porównujemy na zaokrągleniu). */
export function maxChangePct(v: Pick<CalibVersionDb, 'params_before' | 'params_after'>): number | null {
  const raw = maxChangeRaw(v);
  return raw == null ? null : Math.round(raw * 1000) / 10;
}

/**
 * Czy baza zastosuje tę wersję sama (`eta_apply_calibration_internal(p_auto => true)`): bez zamrożenia, n_obs ≥ 10,
 * test wsteczny poprawia błąd (gdy oba błędy są). Inaczej baza zwraca BLOCKED — wersja zwyczajnie czeka.
 */
export function autoApplicable(v: CalibVersionDb, frozen = false): boolean {
  if (frozen) return false;
  if ((v.n_obs ?? 0) < ETA_AUTO_MIN_OBS) return false;
  const before = num(v.error_before_min);
  const after = num(v.error_after_min);
  if (before != null && after != null && after >= before) return false;
  return true;
}

/**
 * Status wersji: cofnięta / zastosowana / zastąpiona / odrzucona / oczekuje. Propozycja ciągła ze zmianą > 15 % (surowa
 * wartość, jak w bazie) — decyzja HHL; ≤ 15 % — auto tylko gdy baza ją zastosuje (`autoApplicable`), inaczej zwykłe „oczekuje”.
 */
export function calibVersionStatus(v: CalibVersionDb, frozen = false): CalibVersionStatus {
  const note = (v.note ?? '').toLowerCase();
  if (v.undone_at) return 'undone';
  if (v.applied) return 'applied';
  if (note.includes('superseded')) return 'superseded';
  if (v.rejected_at || note.includes('rejected')) return 'rejected';
  if (!v.created_by && note.startsWith('propozycja ciągła')) {
    const raw = maxChangeRaw(v);
    if (raw != null && raw > ETA_AUTO_MAX_PCT / 100) return 'pending_decision';
    return autoApplicable(v, frozen) ? 'pending_auto' : 'pending';
  }
  return 'pending';
}

/** Wersja, którą można cofnąć: najnowsza zastosowana i niecofnięta. */
export function undoableVersionId(vers: readonly CalibVersionDb[]): number | null {
  const live = vers.filter((v) => v.applied && !v.undone_at);
  return live.length ? Math.max(...live.map((v) => v.id)) : null;
}

/** „Cofnij” widoczne: tylko HHL_ADMIN (ekran nie tylko do odczytu), podpięty zapis i wersja do cofnięcia. */
export function undoVisible(opts: { readOnly?: boolean; canUndo: boolean; undoable?: boolean; status?: CalibVersionStatus }): boolean {
  if (opts.readOnly || !opts.canUndo || !opts.undoable) return false;
  return opts.status == null || opts.status === 'applied';
}

/* ── decyzja ETA_CALIBRATION_APPROVAL ───────────────────────────────────── */

/** Wiersz karty decyzji z `detail`: „Wersja 17 · zmiana do 18,4%”; `null` — inna decyzja albo brak danych. */
export function etaCalibDecisionLine(typeCode: string | null | undefined, detail: Record<string, unknown> | null | undefined): string | null {
  if (typeCode !== ETA_CALIBRATION_APPROVAL || !detail) return null;
  const ver = num(detail.version);
  const pct = num(detail.max_change_pct);
  const parts = [ver != null ? `Wersja ${ver}` : null, pct != null ? `zmiana do ${pctPl(pct)}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * W-604: wersje z cofnięciem w tej sesji (demo — w pamięci; produkcja — do odświeżenia z bazy): cofnięta traci „obowiązuje”,
 * obowiązuje najnowsza zastosowana i niecofnięta.
 */
export function versionsAfterUndo(list: readonly CalibVersion[], undone: ReadonlySet<string>): CalibVersion[] {
  if (!undone.size) return [...list];
  const marked = list.map((v) => (undone.has(v.id) ? { ...v, status: 'undone' as const, current: false, undoable: false } : v));
  if (marked.some((v) => v.current)) return marked;
  const next = marked.find((v) => v.status == null || v.status === 'applied');
  return marked.map((v) => (v === next ? { ...v, current: true } : v));
}
