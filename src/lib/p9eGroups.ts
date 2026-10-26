/**
 * wyglad/P9-e — grupowanie znaczników na mapie według E45 pkt 5 (zdecydowane 07.10 22:42) i D-20261009-1309-01 R5
 * (decyzja 09.10 13:09). Moduł czysty: bez zapytań i zapisów, liczy tylko, gdzie i jak narysować znaczniki.
 *
 * 1. Auta na promie (etap „Prom”) grupuje rejs — jeden znacznik na pozycji statku z AIS z liczbą aut; bez AIS —
 *    ostatnia pozycja auta i „brak AIS”. Ma pierwszeństwo przed strefą.
 * 2. Więcej niż 1 auto w jednej strefie E34 rodzaju: załadunek, port PL, port SE, plac → jeden znacznik z liczbą
 *    na środku strefy. Bufory (20–50 km) się nie liczą. Poza strefami bez grupowania (W28 — do odpowiedzi tylko strefy).
 * 3. Po zejściu z promu albo wyjeździe ze strefy — znów osobne znaczniki (wynika z pozycji, bez pamięci).
 */
import type { StageTile } from './stageTiles';

export type GroupItem = {
  id: string;
  lat: number;
  lng: number;
  tile: StageTile | null;
  /** Rejs auta (`loads.sailing_id`, w demo prom + godzina wypłynięcia); null = bez rejsu. */
  ferryKey: string | null;
  lastFixAt: string | null;
  late: boolean;
};

export type GroupZone = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  radiusM: number;
  active: boolean;
};

export type ShipFix = {
  lat: number; lng: number; ts: string; stale: boolean; vessel: string;
  /** #429 C: pozycja szacowana z rozkładu; `lastAisTs` = ostatni AIS albo null. */
  estimated?: { lastAisTs: string | null };
};

/** R5 pkt 3: rodzaje stref, w których auta są grupowane (bez buforów PRE_PORT / PRE_ARRIVAL, punktów i parkingów). */
export const GROUP_ZONE_TYPES: ReadonlySet<string> = new Set(['LOADING', 'PORT_OUT', 'PORT_IN', 'SITE']);

export type Placed =
  | { kind: 'one'; id: string; lat: number; lng: number }
  | {
    kind: 'ferry';
    key: string;
    ferryKey: string;
    ids: string[];
    lat: number;
    lng: number;
    /** ok = świeży odczyt AIS, stale = stary odczyt, est = szacowana z rozkładu (#429 C), none = brak AIS (ostatnia pozycja auta). */
    ais: 'ok' | 'stale' | 'est' | 'none';
    /** Czas pozycji: odczyt AIS albo ostatnia pozycja auta. */
    at: string | null;
    vessel: string | null;
    late: boolean;
  }
  | {
    kind: 'zone';
    key: string;
    zoneId: string;
    zoneName: string;
    zoneType: string;
    ids: string[];
    lat: number;
    lng: number;
    late: boolean;
  };

const R = 6_371_000;
/** Odległość w metrach (haversine). */
export function distM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Strefa grupowania, w której jest pozycja (najmniejsza pasująca, gdy koła na siebie zachodzą). */
export function zoneOf(lat: number, lng: number, zones: readonly GroupZone[]): GroupZone | null {
  let best: GroupZone | null = null;
  for (const z of zones) {
    if (!z.active || !GROUP_ZONE_TYPES.has(z.type)) continue;
    if (!Number.isFinite(z.lat) || !Number.isFinite(z.lng) || !(z.radiusM > 0)) continue;
    if (distM(lat, lng, z.lat, z.lng) > z.radiusM) continue;
    if (!best || z.radiusM < best.radiusM) best = z;
  }
  return best;
}

export function placeMarkers(
  items: readonly GroupItem[],
  opts: { zones: readonly GroupZone[]; shipOf: (ferryKey: string) => ShipFix | null; grouping: boolean },
): Placed[] {
  if (!opts.grouping) return items.map((it) => ({ kind: 'one', id: it.id, lat: it.lat, lng: it.lng }));
  const out: Placed[] = [];
  const ferry = new Map<string, GroupItem[]>();
  const zoneIds = new Map<string, { zone: GroupZone; items: GroupItem[] }>();
  const order: string[] = [];
  for (const it of items) {
    if (it.tile === 'FERRY' && it.ferryKey) {
      const k = `ferry:${it.ferryKey}`;
      if (!ferry.has(it.ferryKey)) { ferry.set(it.ferryKey, []); order.push(k); }
      ferry.get(it.ferryKey)!.push(it);
      continue;
    }
    const z = zoneOf(it.lat, it.lng, opts.zones);
    if (z) {
      const k = `zone:${z.id}`;
      if (!zoneIds.has(z.id)) { zoneIds.set(z.id, { zone: z, items: [] }); order.push(k); }
      zoneIds.get(z.id)!.items.push(it);
      continue;
    }
    order.push(`one:${it.id}`);
  }
  const byId = new Map(items.map((it) => [it.id, it]));
  for (const k of order) {
    if (k.startsWith('one:')) {
      const it = byId.get(k.slice(4))!;
      out.push({ kind: 'one', id: it.id, lat: it.lat, lng: it.lng });
    } else if (k.startsWith('ferry:')) {
      const fk = k.slice(6);
      const list = ferry.get(fk)!;
      const ship = opts.shipOf(fk);
      /* bez AIS: ostatnia pozycja auta (najnowsza z grupy) */
      let last = list[0];
      for (const it of list) {
        if (it.lastFixAt && (!last.lastFixAt || Date.parse(it.lastFixAt) > Date.parse(last.lastFixAt))) last = it;
      }
      out.push({
        kind: 'ferry',
        key: k,
        ferryKey: fk,
        ids: list.map((it) => it.id),
        lat: ship ? ship.lat : last.lat,
        lng: ship ? ship.lng : last.lng,
        ais: ship ? (ship.estimated ? 'est' : ship.stale ? 'stale' : 'ok') : 'none',
        at: ship ? (ship.estimated ? ship.estimated.lastAisTs : ship.ts) : last.lastFixAt,
        vessel: ship ? ship.vessel : null,
        late: list.some((it) => it.late),
      });
    } else {
      const { zone, items: list } = zoneIds.get(k.slice(5))!;
      if (list.length < 2) {
        const it = list[0];
        out.push({ kind: 'one', id: it.id, lat: it.lat, lng: it.lng });
        continue;
      }
      out.push({
        kind: 'zone',
        key: k,
        zoneId: zone.id,
        zoneName: zone.name,
        zoneType: zone.type,
        ids: list.map((it) => it.id),
        lat: zone.lat,
        lng: zone.lng,
        late: list.some((it) => it.late),
      });
    }
  }
  return out;
}

/** Odmiana: 1 auto, 2–4 auta, 5+ aut (12–14 aut). */
export function carsWord(n: number): 'one' | 'few' | 'many' {
  if (n === 1) return 'one';
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14) ? 'few' : 'many';
}

/** Nazwa statku do porównania z AIS (bez wielkości liter i znaków diakrytycznych). */
export function vesselKey(name: string | null | undefined): string {
  /* 22.10.2026 (SG-17 „stoi w porcie”): AIS i rejsy z bazy mają „M/F Wawel”, a rejs w aplikacji „Wawel” —
     przedrostek statku (M/F, MF, M/S, MS) pomijany, żeby auto na promie stało na pozycji statku z AIS. */
  return String(name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    .replace(/^(m f|mf|m s|ms) /, '');
}

/* ── widok grupy: dymek i lista (E45 pkt 5 „najechanie — rejs i kody; kliknięcie — lista transportów”) ── */

export type GroupRow = { id: string; label: string; stageKey: string; late: boolean };
/** Nazwa transportu (E41) rozdzielona na kod i numer zlecenia: „SG-03 · HHL/2026/1244” → kod „SG-03”. */
export function splitLabel(label: string): { code: string; num: string | null } {
  const i = label.indexOf(' · ');
  return i < 0 ? { code: label, num: null } : { code: label.slice(0, i), num: label.slice(i + 3) };
}
export type GroupView = {
  key: string;
  kind: 'ferry' | 'zone';
  title: string;
  sub: string | null;
  note: string | null;
  rows: GroupRow[];
};

export type FerryInfo = { vessel: string | null; route: string | null; departureAt: string | null };

const PORT_PL: Record<string, string> = { GDN: 'Gdańsk', NYN: 'Nynäshamn', GDY: 'Gdynia', KAA: 'Karlskrona' };

export function groupView(
  g: Extract<Placed, { kind: 'ferry' | 'zone' }>,
  ctx: {
    nowIso: string;
    row: (id: string) => GroupRow | null;
    ferryInfo: (ferryKey: string) => FerryInfo | null;
    tx: (key: string, params?: Record<string, string | number>) => string;
    /** „14:28” */
    hm: (iso: string | null | undefined) => string;
    /** „24.09, 20:00” */
    dt: (iso: string) => string;
  },
): GroupView {
  const rows = g.ids.map((id) => ctx.row(id)).filter((r): r is GroupRow => !!r);
  const cars = ctx.tx(`p9e_cars_${carsWord(g.ids.length)}`, { n: g.ids.length });
  if (g.kind === 'zone') {
    return {
      key: g.key,
      kind: 'zone',
      title: ctx.tx('p9e_zone_title', { zone: g.zoneName, cars }),
      sub: ctx.tx(`p9e_zone_${g.zoneType}`),
      note: null,
      rows,
    };
  }
  const info = ctx.ferryInfo(g.ferryKey);
  const vessel = info?.vessel ?? g.vessel;
  const title = vessel ? ctx.tx('p9e_ferry_title', { vessel, cars }) : ctx.tx('p9e_ferry_title_bare', { cars });
  let sub: string | null = null;
  if (info) {
    const [a, b] = (info.route ?? 'GDN-NYN').split('-');
    const pa = PORT_PL[a] ?? a;
    const pb = PORT_PL[b] ?? b;
    if (info.departureAt) {
      const past = Date.parse(info.departureAt) <= Date.parse(ctx.nowIso);
      sub = ctx.tx(past ? 'p9e_ferry_dep_past' : 'p9e_ferry_dep_next', { a: pa, b: pb, t: ctx.dt(info.departureAt) });
    } else {
      sub = ctx.tx('p9e_ferry_route', { a: pa, b: pb });
    }
  }
  const note = g.ais === 'est' ? (g.at ? ctx.tx('p9e_ais_est', { t: ctx.dt(g.at) }) : ctx.tx('p9e_ais_est_none'))
    : g.ais === 'ok' ? ctx.tx('p9e_ais_ok', { t: ctx.hm(g.at) })
    : g.ais === 'stale' ? ctx.tx('p9e_ais_stale', { t: g.at ? ctx.dt(g.at) : '' })
      : g.at ? ctx.tx('p9e_ais_none', { t: ctx.hm(g.at) }) : ctx.tx('p9e_ais_none_bare');
  return { key: g.key, kind: 'ferry', title, sub, note, rows };
}

/**
 * Tryb demo (bez pozycji z bazy): auto stoi tam, gdzie jest jego etap — załadunek w strefie załadunku, port PL i SE
 * w strefie portu, plac w strefie placu, prom na linii promu Gdańsk → Nynäshamn (środek morza). Pozostałe etapy —
 * pozycja wzdłuż korytarza jak dotąd. Produkcja tego nie używa (pozycje tylko z bazy).
 */
const DEMO_SEA: { lat: number; lng: number } = { lat: 57.1, lng: 17.55 };
const STAGE_ZONE: Partial<Record<StageTile, string>> = { LOADING: 'LOADING', PORT_PL: 'PORT_OUT', PORT_SE: 'PORT_IN', SITE: 'SITE' };
export function demoStageAnchor(tile: StageTile | null, zones: readonly GroupZone[]): { lat: number; lng: number } | null {
  if (tile === 'FERRY') return DEMO_SEA;
  const type = tile ? STAGE_ZONE[tile] : undefined;
  if (!type) return null;
  const z = zones.find((x) => x.active && x.type === type);
  return z ? { lat: z.lat, lng: z.lng } : null;
}

/** J-17: dopisek pozycji szacowanej statku (#429 C) w dymku pojedynczego auta na promie — te same klucze co dymek grupy. */
export function estNote(
  lastAisAt: string | null | undefined,
  tx: (key: string, params?: Record<string, string | number>) => string,
  dt: (iso: string) => string,
): string {
  return lastAisAt ? tx('p9e_ais_est', { t: dt(lastAisAt) }) : tx('p9e_ais_est_none');
}
