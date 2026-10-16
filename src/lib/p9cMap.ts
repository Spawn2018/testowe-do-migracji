/**
 * wyglad/P9-c — liczenie widoku strony Mapa według E29 (zdecydowane 08.10 12:14; pyt. 1 A) i L20, L22.
 * Moduł czysty: bez zapytań i zapisów. Dane: pola transportu (`etaDetail.lastFixAt`, `silentMinutes`, `trackingLink`,
 * `delayMinutesDb`), pozycje z bazy (`hasFix`) i rejs (`Sailing`). Czego dane jeszcze nie dają, wiersz mówi wprost.
 *
 * Zakres (pkt 1, pyt. 1 A): mapa i tabela = transporty w oknie śledzenia (od 03:00 w dniu załadunku do „Dostarczone”);
 * kafelek paska E28 zmienia zakres (np. „Przygotowanie” → wszystkie w przygotowaniu, tabela mówi, czemu bez pozycji).
 */
import type { Load, RoleId, Sailing } from '../types';
import { stageTileOf, statusMarkers, trackingPhase, type StageTile } from './stageTiles';
import { delayMinutesVsPlan, fmtTime, TZ_OPS } from './time';
import { delayPillMinutes } from './prodDash';
import { formatListDateTime } from './format';
import { durText } from './p5Fees';
import { transportLabel, transportSearchBlob } from './transportName';

const TZ = 'Europe/Warsaw';
const PORT_PL: Record<string, string> = { GDN: 'Gdańsk', NYN: 'Nynäshamn', GDY: 'Gdynia', KAA: 'Karlskrona' };

/** „00:19” (czas polski). */
export function hm(iso: string | null | undefined): string {
  if (!iso) return '';
  const out = fmtTime(iso, TZ);
  return out === '—' ? '' : out;
}

/** Kolor znacznika według etapu E28 (pkt 4): załadunek, w drodze (PL, port, prom, SE), na placu. */
export type MarkerTone = 'load' | 'road' | 'site';
export function markerTone(tile: StageTile | null): MarkerTone {
  if (tile === 'SITE' || tile === 'DELIVERED' || tile === 'SETTLE') return 'site';
  if (tile === 'PREP' || tile === 'LOADING') return 'load';
  return 'road';
}
export const TONE_COLOR: Record<MarkerTone, string> = { load: '#E5A544', road: '#245C87', site: '#1B6E5D' };
export const NOGPS_COLOR = '#9AAAB6';
export const LATE_RING = '#B32639';

export type PosKind = 'fix' | 'ship' | 'nogps' | 'none';
export type MapRow = {
  id: string;
  label: string;
  tile: StageTile | null;
  stageKey: string;
  stageSub: string | null;
  pos: { kind: PosKind; text: string; sub: string | null; alarm: boolean };
  eta: { main: string; sub: string | null; late: boolean };
  /** Filtry (pkt 5, L22): opóźnienie tylko po wyjeździe; „Brak GPS” = cisza 30 min w ruchu; bez pozycji w oknie. */
  late: boolean;
  nogps: boolean;
  nopos: boolean;
  delayMin: number | null;
  lastFixAt: string | null;
  /** Odcinek kierowcy i zestawu (E6): PL do przepięcia, potem SE. */
  seg: 'PL' | 'SE';
  inWindow: boolean;
};

export type RowCtx = {
  role: RoleId;
  nowIso: string;
  prod: boolean;
  /** Produkcja: transport ma pozycję w bazie (`latest_vehicle_fixes`). */
  hasFix: (id: string) => boolean;
  sailingOf: (id: string | null | undefined) => Sailing | undefined;
  /** Teksty (p9m / p9mp) — moduł bez zależności od słowników. */
  tx: (key: string, params?: Record<string, string | number>) => string;
};

const SE_TILES: ReadonlySet<StageTile> = new Set(['PORT_SE', 'ROAD_SE', 'SITE', 'DELIVERED', 'SETTLE']);
const DEPARTED: ReadonlySet<StageTile> = new Set(['ROAD_PL', 'PORT_PL', 'FERRY', 'PORT_SE', 'ROAD_SE', 'SITE']);

/** Demo nie ma pozycji z bazy: transport w trasie „ma” pozycję sprzed `silentMinutes` (albo 4 min). */
function demoFixAt(l: Load, nowIso: string): string | null {
  const tile = stageTileOf(l);
  if (!tile || tile === 'PREP' || tile === 'DELIVERED' || tile === 'SETTLE') return null;
  if (l.progress <= 0 && tile === 'LOADING') return null;
  const ago = l.silentMinutes ?? 4;
  return new Date(Date.parse(nowIso) - ago * 60_000).toISOString();
}

export function mapRow(l: Load, ctx: RowCtx): MapRow {
  const { tx, nowIso } = ctx;
  const tile = stageTileOf(l);
  const markers = statusMarkers(l, { hasDelayMinutes: true });
  const nogps = markers.includes('nogps');
  const lastFixAt = l.etaDetail?.lastFixAt ?? l.trackingLink?.check?.lastFixAt ?? (ctx.prod ? null : demoFixAt(l, nowIso));
  const hasPos = ctx.prod ? (ctx.hasFix(l.id) || !!lastFixAt) : !!lastFixAt;
  const inWindow = trackingPhase(l, nowIso) === 'on';
  const departed = tile != null && DEPARTED.has(tile);

  /* Etap (pkt 6): kafelek E28 + dopisek — dzień załadunku albo rejs */
  let stageSub: string | null = null;
  if (tile === 'PREP' || tile === 'LOADING') {
    const day = (l.plannedLoadDate ?? '').slice(0, 10);
    if (day && tile === 'PREP') stageSub = tx('p9c_stage_prep_day', { d: formatListDateTime(day) });
  } else if (tile === 'FERRY' || tile === 'PORT_PL') {
    const s = ctx.sailingOf(l.sailingId);
    const vessel = s?.vessel ?? l.ferry.vessel;
    if (vessel) {
      const [a, b] = (s?.route ?? 'GDN-NYN').split('-');
      stageSub = `${vessel} · ${PORT_PL[a] ?? a} → ${PORT_PL[b] ?? b}`;
    }
  }

  /* Pozycja (pkt 6, L22): godzina ostatniej pozycji; prom = statek (AIS); cisza = „brak GPS od”; bez pozycji = powód */
  let pos: MapRow['pos'];
  if (nogps) {
    const since = l.silentMinutes != null ? new Date(Date.parse(nowIso) - l.silentMinutes * 60_000).toISOString() : lastFixAt;
    pos = { kind: 'nogps', text: tx('p9c_pos_nogps', { t: hm(since) }), sub: tx('p9c_pos_nogps_sub'), alarm: true };
  } else if (tile === 'FERRY') {
    pos = hasPos
      ? { kind: 'ship', text: hm(lastFixAt) || tx('p9c_pos_ship'), sub: hm(lastFixAt) ? tx('p9c_pos_ship') : null, alarm: false }
      : { kind: 'ship', text: tx('p9c_pos_ship_none'), sub: null, alarm: false };
  } else if (hasPos) {
    const rest = l.etaDetail?.phase === 'REST' && l.etaDetail.restFrom ? tx('p9c_pos_rest', { t: hm(l.etaDetail.restFrom) }) : null;
    pos = { kind: 'fix', text: hm(lastFixAt) || tx('p9c_pos_gps'), sub: rest, alarm: false };
  } else {
    /* powód tylko z danych: `trackingLink === undefined` = serwer jeszcze nie podaje stanu linku (bez zgadywania) */
    const st = l.trackingLink?.check?.state;
    const why = l.trackingLink === undefined ? null
      : l.trackingLink === null ? 'p9c_pos_none_link'
        : st === 'invalid' ? 'p9c_pos_none_bad'
          : st === 'down' ? 'p9c_pos_none_down' : 'p9c_pos_none_wait';
    pos = { kind: 'none', text: tx('p9c_pos_none'), sub: inWindow && why ? tx(why) : null, alarm: inWindow };
  }

  /* ETA Boden (pkt 6, E15): „–” przed wyjazdem; na placu „od”; opóźnienie wobec okna KSH tylko po wyjeździe */
  const vsPlan = delayMinutesVsPlan(l.etaBoden, l.plannedDeliverDate, l.planDates?.deliveryTo);
  const delayMin = departed ? delayPillMinutes(l, vsPlan, ctx.prod) ?? (ctx.prod ? null : vsPlan) : null;
  const late = departed && (delayMin != null && delayMin > 0 || ((l.delayed || l.status === 'DELAYED') && tile !== 'SITE'));
  let eta: MapRow['eta'];
  if (!departed || !l.etaBoden) {
    eta = { main: tx('p9c_eta_none'), sub: null, late: false };
  } else if (tile === 'SITE') {
    const since = l.etaDetail?.waitSince ?? l.etaBoden;
    eta = { main: tx('p9c_eta_site', { t: hm(since) }), sub: null, late: false };
  } else {
    const sub = late && delayMin ? tx('p9c_eta_late', { d: durText(delayMin) }) : nogps ? tx('p9c_eta_from_last') : null;
    eta = { main: formatListDateTime(l.etaBoden, TZ_OPS), sub, late: late && !!delayMin };
  }

  return {
    id: l.id,
    label: transportLabel(l, ctx.role),
    tile,
    stageKey: tile ? `p4_tile_${tile}` : 'p4_tile_PREP',
    stageSub,
    pos,
    eta,
    late: !!late,
    nogps,
    nopos: inWindow && pos.kind === 'none',
    delayMin: late ? delayMin : null,
    lastFixAt,
    seg: tile != null && SE_TILES.has(tile) ? 'SE' : 'PL',
    inWindow,
  };
}

/** Nagłówek (pkt 2): w oknie, z pozycją, bez pozycji. */
export function headCounts(rows: readonly MapRow[]): { n: number; withPos: number; noPos: number } {
  const win = rows.filter((r) => r.inWindow);
  const noPos = win.filter((r) => r.pos.kind === 'none').length;
  return { n: win.length, withPos: win.length - noPos, noPos };
}

/**
 * Wyszukiwanie (pkt 5): kod, numery zleceń, które firma widzi (E41, 08.10), tablice ciągnika i naczepy.
 * HHL: kod + nr HHL i nr SCX; SCX: kod + swój i nr HHL; KSH: sam kod (bez numerów zleceń innych firm).
 * Nigdy numer z pliku KSH — ta sama zasada co Harmonogram (`transportSearchBlob`).
 */
export function rowMatches(l: Load, role: RoleId, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [transportSearchBlob(l, role), l.resources.tractorPlate, l.resources.trailerPlate]
    .filter(Boolean).join(' ').toLowerCase();
  return hay.includes(s);
}

/** Podpowiedź pola szukania według firmy: KSH bez „nr zlecenia” (E41). */
export function searchHintKey(role: RoleId): 'p9c_search' | 'p9c_search_ksh' {
  return role === 'KSH' ? 'p9c_search_ksh' : 'p9c_search';
}
