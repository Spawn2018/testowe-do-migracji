/**
 * wyglad/W-cele-przejsc — dokąd prowadzi sprawa z „Do zrobienia” (i ten sam cel po wejściu z dzwonka: dzwonek otwiera kartę sprawy,
 * a jej przycisk prowadzi tu). Właściciel: „Powiadomienia z dzwoneczka i z ryzyk mają prowadzić precyzyjnie (i otwierać je)
 * do miejsca, w którym ma być przeprowadzona dana czynność”.
 * - „Wgraj” → okno „Wgraj dokument” z wybranym transportem i rodzajem (E31 pkt 6),
 * - ETA / „najpóźniej do” / cichy GPS / brak pozycji → zakładka Status,
 * - prom (anulowany, zmiana rejsu, spóźniony) → wiersz rejsu w Przeglądzie (bez otwierania okna Awizacji),
 * - braki do awizacji → okno Awizacja (jedyne miejsce, które otwiera je samo), dopłaty → Ceny; reszta — Przegląd.
 * Moduł czysty (testy bez DOM).
 */
import type { DocCategory } from '../types';
import type { TodoIssue } from './p6Todo';

/** Zakładka panelu transportu dla `drawerTab` w sklepie; `sailing` = Przegląd z przewinięciem do wiersza rejsu. */
export type DrawerGo = 'overview' | 'timeline' | 'docs' | 'pricing' | 'sailing' | null;

type IssueLike = Pick<TodoIssue, 'go'> & {
  risk?: { id: string; type?: string; kind?: string; code?: string; titleKey?: string; title?: string } | undefined;
  decision?: { typeCode: string } | undefined;
};

const TRACK_KINDS = new Set(['ETA_BREACH', 'SILENT_VEHICLE']);
const TRACK_DECISIONS = new Set(['ETA_AFTER_LATEST', 'NO_POSITION']);
/* demo: ryzyka z seed.ts bez `kind` — rozpoznanie po stałym id */
const TRACK_DEMO = /^risk-(eta-|silent|gps-silent)/;
const FERRY_CODES = new Set(['SAILING_CANCELLED', 'MISSED_SAILING', 'FERRY_OVERDUE']);
const FERRY_DECISIONS = new Set(['FERRY_CANCELLED']);

export function isTrackingIssue(i: IssueLike): boolean {
  if (i.decision) return TRACK_DECISIONS.has(i.decision.typeCode);
  const r = i.risk;
  if (!r) return false;
  return (!!r.kind && TRACK_KINDS.has(r.kind)) || (!r.kind && TRACK_DEMO.test(r.id));
}

export function isFerryIssue(i: IssueLike): boolean {
  if (i.decision) return FERRY_DECISIONS.has(i.decision.typeCode);
  const r = i.risk;
  if (!r) return false;
  return r.type === 'FERRY' || r.kind === 'FERRY' || (!!r.code && FERRY_CODES.has(r.code));
}

/** Przycisk główny sprawy (`onGo`) → zakładka panelu. */
export function issueDrawerGo(i: IssueLike): DrawerGo {
  if (i.go === 'AWIZACJA') return 'overview';
  if (i.go === 'DOCS') return 'docs';
  if (i.go === 'PRICING') return 'pricing';
  if (i.go === 'OPEN') {
    if (isFerryIssue(i)) return 'sailing';
    if (isTrackingIssue(i)) return 'timeline';
  }
  return null;
}

/** Podpowiedź po rozstrzygnięciu decyzji (`onResolved`) → zakładka panelu. */
export function hintDrawerGo(hint: string | null | undefined): DrawerGo {
  if (hint === 'OPEN_AWIZACJA' || hint === 'PICK_SAILING') return 'overview';
  if (hint === 'OPEN_DOC') return 'docs';
  if (hint === 'ADD_FEE') return 'pricing';
  return null;
}

/** Rodzaj dokumentu do wstępnego wybrania w oknie „Wgraj dokument” (null — pierwszy brak transportu, jak dotąd). */
export function issueUploadCategory(i: IssueLike): DocCategory | null {
  if (i.go !== 'DOCS') return null;
  if (i.decision?.typeCode === 'INSURANCE_EXPIRING') return 'INSURANCE';
  const r = i.risk;
  if (!r) return null;
  if (r.kind === 'INSURANCE') return 'INSURANCE';
  const txt = `${r.titleKey ?? ''} ${r.title ?? ''}`.toLowerCase();
  if (/cmr/.test(txt)) return 'CMR';
  if (/(\bse\b|_se\b|szwed|sweden|trafikverket)/.test(txt)) return 'PERMIT_SE';
  if (/(\bpl\b|_pl\b|gddkia|polsk)/.test(txt)) return 'PERMIT_PL';
  /* zezwolenie bez kraju (np. „niezgodne z zestawem”) — najpierw PL, jak w kolejności trasy */
  if (/(zezwol|permit)/.test(txt)) return 'PERMIT_PL';
  return null;
}

/**
 * Stan okna Awizacja w panelu transportu (LoadDrawer): zamknięte przy każdej zmianie transportu i przy zamknięciu panelu;
 * otwiera się wyłącznie na wyraźne żądanie (`drawerTab === 'overview'` z linku / sprawy albo przycisk w Przeglądzie).
 */
export function awizOpenAfter(prev: boolean, ev: { type: 'load'; prevId: string | null; nextId: string | null } | { type: 'tab'; tab: string | null }): boolean {
  if (ev.type === 'load') return ev.prevId === ev.nextId ? prev : false;
  return ev.tab === 'overview' ? true : prev;
}

/**
 * Wiersz „Promy dziś” (Sytuacja na trasie) → rejs w Harmonogramie › Rejsy (E7 pkt 4: „statek w porcie” i pomiary są w historii rejsu).
 * Produkcja: id wiersza = id rejsu; demo: ten sam statek w tym samym dniu, inaczej najbliższe odejście tego statku.
 */
export function ferryRowSailing(
  row: { id: string; vessel: string; depIso: string },
  sailings: readonly { id: string; vessel: string; departureAt: string }[],
): string | null {
  if (sailings.some((s) => s.id === row.id)) return row.id;
  const v = row.vessel.trim().toLowerCase();
  const same = sailings.filter((s) => s.vessel.trim().toLowerCase() === v);
  if (!same.length) return null;
  const t = Date.parse(row.depIso);
  const best = [...same].sort((a, b) => Math.abs(Date.parse(a.departureAt) - t) - Math.abs(Date.parse(b.departureAt) - t))[0];
  return best.id;
}
