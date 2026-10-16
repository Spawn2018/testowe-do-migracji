/**
 * wyglad/P6-b — przykłady demo panelu transportu (E17): wpisy Historii „było → jest” i rozmowa w Czacie.
 * Osoby zmyślone (G-09), te same co na stronie Ryzyka (`p6Demo.ts`). Strefy — z listy stref demo (po identyfikatorze).
 * Wywoływane wyłącznie z `p6bSource.ts` za warunkiem trybu demo wpisanym wprost (strażnik I-0).
 */
import type { Load, LoadEvent, LoadMessage } from '../types';
import { PROGRESS_OF } from './status';

const MIN = 60_000;
const ANNA = 'Anna Wiśniewska // H&H Logistics';
const JAN = 'Jan Nowak // Scandinavian Express';
const PEOPLE: Record<string, { userId: string; name: string; org: 'HHL' | 'SCX' | 'KSH' }> = {
  HHL: { userId: 'demo-hhl-1', name: 'Anna Wiśniewska', org: 'HHL' },
  SCX: { userId: 'demo-scx-1', name: 'Jan Nowak', org: 'SCX' },
  KSH: { userId: 'demo-ksh-1', name: 'Piotr Zieliński', org: 'KSH' },
};

/** Godzina „hh:mm” w strefie Europe/Warsaw danego dnia (czas letni i zimowy). */
function at(day: string, hm: string, plusDays = 0): number {
  const guess = Date.parse(`${day}T${hm}:00Z`) + plusDays * 24 * 60 * MIN;
  if (!Number.isFinite(guess)) return NaN;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const asIfUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  return guess - (asIfUtc - guess);
}

/** Ja w demo (do „przeczytali” i nieprzeczytanych): ta sama osoba co w odczytach tej firmy. */
export function demoMeId(org: 'HHL' | 'SCX' | 'KSH'): string {
  return PEOPLE[org].userId;
}

/**
 * Wpisy, które w produkcji zapisze baza (E17 pkt 3): numery „— → nowy”, zasoby, próba „Gotowy”, statusy z przyczyną,
 * strefy z nazwą; do tego dwa zapisy bez zmiany (ukryte i policzone). Tylko to, co pasuje do etapu transportu.
 */
export function demoHistoryEvents(load: Load, nowIso: string): LoadEvent[] {
  const now = Date.parse(nowIso);
  const p = PROGRESS_OF[load.status] ?? 0;
  const day = load.plannedLoadDate;
  const out: LoadEvent[] = [];
  let n = 0;
  const push = (ms: number, type: string, actor: string, payload?: Record<string, unknown>, note?: string) => {
    if (!Number.isFinite(ms) || ms >= now - MIN) return;
    out.push({ id: `p6b-${load.id}-${++n}`, loadId: load.id, type, at: new Date(ms).toISOString(), actor, ...(payload ? { payload } : {}), ...(note ? { note } : {}) });
  };
  const r = load.resources;
  if (r.driverName || r.tractorPlate) {
    push(at(day, '13:06', -3), 'RESOURCES_UPDATED', JAN, { driverName: true, tractorPlate: true, trailerPlate: true });
  }
  if (p >= PROGRESS_OF.READY && load.hhlOrderNo) {
    push(at(day, '13:07', -3), 'READY_BLOCKED', 'HHL', undefined, 'brak numeru zlecenia HHL');
  }
  if (load.hhlOrderNo) push(at(day, '13:08', -3), 'ORDER_NO_UPDATED', ANNA, { side: 'HHL', old: null, new: load.hhlOrderNo });
  if (load.carrierOrderNo) {
    push(at(day, '13:09', -3), 'ORDER_NO_UPDATED', JAN, { side: 'CARRIER', old: null, new: load.carrierOrderNo });
    /* zapis bez zmiany — ukryty i policzony (E17: powtórzony numer SCX) */
    push(at(day, '13:11', -3), 'ORDER_NO_UPDATED', 'SCX', { side: 'CARRIER', old: load.carrierOrderNo, new: load.carrierOrderNo });
  }
  if (p >= PROGRESS_OF.READY) {
    push(at(day, '13:10', -3), 'STATUS_READY', ANNA, { from: 'RESOURCES_PENDING' }, 'zasoby kompletne, zezwolenie bez blokady');
    push(at(day, '13:12', -3), 'STATUS_AUTO', 'system', { from: 'READY', to: 'READY' });
  }
  if (p >= PROGRESS_OF.IN_TRANSIT_PL) {
    push(at(day, '09:40'), 'STATUS_AUTO', 'system', { from: 'LOADING', to: 'IN_TRANSIT_PL', powod: 'wyjazd ze strefy załadunku', source: 'GPS', provider: 'emtrack' });
  }
  if (p >= PROGRESS_OF.AT_PORT) {
    push(at(day, '10:30'), 'GEOFENCE_ENTER', 'geofence-engine', { geofence_id: 'gf-03', source: 'GPS', provider: 'emtrack' });
  }
  if (p >= PROGRESS_OF.IN_TRANSIT_SE) {
    /* wyglad/P6-c (E17): „Droga SE GPS” — wyjazd ze strefy portu w Szwecji; pod nim wjazd w bufor 50 km przed Boden */
    push(at(load.plannedDeliverDate, '14:05', -1), 'STATUS_AUTO', 'system', { from: 'AT_PORT_SE', to: 'IN_TRANSIT_SE', powod: 'wyjazd ze strefy portu', source: 'GPS', provider: 'emtrack' });
  }
  if (p >= PROGRESS_OF.APPROACHING_SITE) {
    push(at(load.plannedDeliverDate, '05:22'), 'GEOFENCE_ENTER', 'geofence-engine', { geofence_id: 'gf-10', source: 'GPS', provider: 'emtrack' });
  }
  return out;
}

const NAME: Record<string, string> = { 'Anna Ops': 'Anna Wiśniewska', 'Erik Dispatch': 'Jan Nowak' };
const ACTOR: Record<string, string> = { 'Anna Ops': ANNA, 'Erik Dispatch': JAN };

/** Autorzy zdarzeń z danych startowych po imieniu i nazwisku z firmą (E6). */
export function demoActors(events: readonly LoadEvent[]): LoadEvent[] {
  return events.map((e) => (ACTOR[e.actor] ? { ...e, actor: ACTOR[e.actor] } : e));
}

const read = (org: 'HHL' | 'SCX' | 'KSH', ms: number, now: number) => ({ ...PEOPLE[org], at: new Date(Math.min(ms, now - MIN)).toISOString() });

/**
 * Czat demo: autorzy po imieniu i nazwisku, przykładowe odczyty i jedna rozmowa „tylko HHL i SCX” przy transportach
 * z wiadomościami. Spójnie z „nieprzeczytanymi”: wiadomość HHL przeczytał SCX (KSH jeszcze nie), wiadomość SCX — HHL i KSH,
 * rozmowy „tylko HHL i SCX” HHL jeszcze nie otworzył. Wiadomości wysłane w demo — bez odczytów.
 */
export function demoChat(load: Load, msgs: readonly LoadMessage[], nowIso: string): LoadMessage[] {
  const now = Date.parse(nowIso);
  const seeded = msgs.filter((m) => /^msg-\d+$/.test(m.id));
  const out = msgs.map((m) => {
    if (!/^msg-\d+$/.test(m.id)) return m;
    const t = Date.parse(m.at);
    const reads = m.org === 'HHL' ? [read('SCX', t + 12 * MIN, now)] : [read('HHL', t + 9 * MIN, now), read('KSH', t + 30 * MIN, now)];
    return { ...m, author: NAME[m.author] ?? m.author, reads: m.reads ?? reads };
  });
  if (seeded.length > 0) {
    const t = Math.min(Date.parse(seeded[0].at) + 35 * MIN, now - 5 * MIN);
    out.push({
      id: `p6b-msg-${load.id}`,
      loadId: load.id,
      at: new Date(t).toISOString(),
      author: 'Jan Nowak',
      org: 'SCX',
      text: 'Rejs zarezerwowany, numer rezerwacji wpisany w awizacji. Do KSH bez zmian.',
      visibleTo: 'HHL_SCX',
    });
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
