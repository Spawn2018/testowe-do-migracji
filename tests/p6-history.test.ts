/**
 * wyglad/P6-b — panel transportu: Historia i Czat (E17, decyzje 07.10 20:57, img/e17-after).
 * Historia: „było → jest” po polsku, bez kodów (także w notatkach automatów), autor „Imię Nazwisko // Firma”, nazwa strefy,
 * wpisy bez zmiany ukryte (także powtórzenia), KSH bez numerów (E41), ceny według strony, filtry, dni od najnowszego.
 * Czat: KSH nie widzi „tylko HHL i SCX”, liczba nieprzeczytanych. Dane zmyślone (G-09). Przykłady demo tylko w demo (I-0).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LoadEvent, LoadMessage } from '../src/types';
import { buildHistory, dayLabel, histFiltersFor, histRow, isNoChange, noChangeIds, visibleFor, whoOf } from '../src/lib/p6History';
import { chatUnread, chatVisibleFor } from '../src/lib/p6bSource';
import { demoChat, demoHistoryEvents } from '../src/lib/p6bDemo';
import { buildDemoSnapshot } from '../src/data/demoProvider';

let n = 0;
const ev = (type: string, at: string, actor: string, payload?: Record<string, unknown>, note?: string): LoadEvent => ({
  id: `e${++n}`, loadId: 'L1', type, at, actor, ...(payload ? { payload } : {}), ...(note ? { note } : {}),
});
const zones = new Map([['gf-x', 'Bufor 50 km przed placem']]);
const CODE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b[a-z]+_[a-z_]+\b|\bREADY:|\bTRIP\b|vault/;
const text = (r: ReturnType<typeof histRow>) => [r.head, r.from, r.to, r.tail, r.who, r.src].filter(Boolean).join(' ');

describe('Historia — wpis po polsku „było → jest” (E17 pkt 2)', () => {
  it('status ze zmianą: przekreślone „było”, pogrubione „jest”, przyczyna po kropce', () => {
    const r = histRow(ev('STATUS_AUTO', '2026-10-07T10:19:00Z', 'system', { from: 'AT_SITE', to: 'DELIVERED', powod: 'wyjazd z placu', source: 'GPS', provider: 'emtrack' }), 'pl');
    expect(r).toMatchObject({ cat: 'STATUS', head: '', from: 'Na placu', to: 'Dostarczone', tail: 'wyjazd z placu', who: 'System // Watch Tower', src: 'GPS emtrack' });
  });
  it('status bez poprzedniego: sama nazwa, bez kodu; „Anulowany” po polsku', () => {
    const r = histRow(ev('STATUS_READY', '2026-10-05T11:10:00Z', 'Anna Testowa // HHL', undefined, 'zasoby kompletne'), 'pl');
    expect(r).toMatchObject({ head: '', from: null, to: 'Gotowy', tail: 'zasoby kompletne', who: 'Anna Testowa // H&H Logistics' });
    expect(histRow(ev('STATUS_CANCELLED', '2026-10-05T11:10:00Z', 'system'), 'pl').to).toBe('Anulowany');
    expect(histRow(ev('STATUS_AUTO', '2026-10-05T11:10:00Z', 'system', { from: 'PLANNED', to: 'CANCELLED' }), 'pl').to).toBe('Anulowany');
  });
  it('strefa z nazwą (z wpisu albo po identyfikatorze), autor — źródło pozycji (GPS z dostawcą, AIS)', () => {
    const r = histRow(ev('GEOFENCE_EXIT', '2026-10-07T11:34:00Z', 'geofence-engine', { geofence_id: 'gf-x', provider: 'emtrack' }), 'pl', zones);
    expect(r.head).toBe('Wyjazd ze strefy „Bufor 50 km przed placem”');
    expect(r.who).toBe('GPS emtrack');
    expect(r.cat).toBe('TRASA');
    expect(histRow(ev('GEOFENCE_ENTER', '2026-10-07T11:34:00Z', 'system', { geofence_id: 'zz', geofence_name: 'Port testowy' }), 'pl').head).toBe('Wjazd w strefę „Port testowy”');
    expect(histRow(ev('GEOFENCE_ENTER', '2026-10-07T11:34:00Z', 'system', { source: 'AIS' }), 'pl').who).toBe('AIS');
    expect(histRow(ev('GEOFENCE_ENTER', '2026-10-07T11:34:00Z', 'system'), 'pl').head).toBe('Wjazd w strefę (strefa bez nazwy)');
  });
  it('numer zlecenia: z wartością poprzednią „— → nowy”; z samej notatki bez zgadywania „było”; usunięcie po polsku', () => {
    const a = histRow(ev('ORDER_NO_UPDATED', '2026-10-05T11:09:00Z', 'Jan Testowy // SCX', { side: 'CARRIER', old: null, new: '0001/T/2026' }), 'pl');
    expect(a).toMatchObject({ cat: 'NUMER', head: 'Nr zlecenia SCX:', from: '—', to: '0001/T/2026', who: 'Jan Testowy // Scandinavian Express' });
    const b = histRow(ev('ORDER_NO_UPDATED', '2026-10-05T11:08:00Z', 'HHL', undefined, 'Nr zlecenia HHL: 0002/T/2026'), 'pl');
    expect(b).toMatchObject({ head: 'Nr zlecenia HHL:', from: null, to: '0002/T/2026', who: 'H&H Logistics (zapis bez osoby)' });
    expect(histRow(ev('ORDER_NO_UPDATED', '2026-10-05T11:08:00Z', 'SCX', undefined, 'Nr zlecenia przewoźnika: —'), 'pl'))
      .toMatchObject({ head: 'Nr zlecenia SCX:', from: null, to: 'usunięty' });
  });
  it('zasoby: nazwy pól po polsku zamiast kodu „RESOURCES_UPDATED”', () => {
    const r = histRow(ev('RESOURCES_UPDATED', '2026-10-05T11:08:00Z', 'SCX', { driverName: 'x', tractorPlate: 'y', trailerSwap: true, source: 'MANUAL' }), 'pl');
    expect(r.head).toBe('Zasoby: kierowca, ciągnik, przepięcie naczepy');
    expect(r.cat).toBe('ZASOBY');
  });
  it('daty planu (0192): „było → jest” załadunku, dostawa w dopisku', () => {
    const r = histRow(ev('PLAN_DATES_CHANGED', '2026-10-05T11:08:00Z', 'Ewa Testowa // KSH', { before_load_date: '2026-10-05', load_date: '2026-10-06', before_delivery_date: '2026-10-08', delivery_date: '2026-10-09' }), 'pl');
    expect(r).toMatchObject({ cat: 'PLAN', head: 'Zmiana dat i godzin planu · załadunek:', from: '05.10.2026', to: '06.10.2026', tail: 'dostawa 08.10.2026 → 09.10.2026' });
  });
  it('wartości po polsku: kod statusu, data, tak / nie; obiekt bez surowych danych', () => {
    expect(histRow(ev('STATUS_CHANGED', '2026-10-05T11:08:00Z', 'system', { from: 'READY', to: 'AT_LOADING' }), 'pl')).toMatchObject({ from: 'Gotowy', to: 'Załadunek' });
    expect(histRow(ev('AWIZACJA_UPDATED', '2026-10-05T11:08:00Z', 'system', { old: true, new: false }), 'pl')).toMatchObject({ from: 'tak', to: 'nie' });
    const o = histRow(ev('AWIZACJA_UPDATED', '2026-10-05T11:08:00Z', 'system', { old: { a: 1 }, new: { a: 2 } }), 'pl');
    expect(o).toMatchObject({ head: 'Awizacja zmieniona', from: null, to: null });
  });
  it('notatki automatów bez kodów: przyczyny blokady i kategorie dokumentów po polsku albo bez notatki', () => {
    expect(histRow(ev('READY_BLOCKED', '2026-10-05T11:08:00Z', 'HHL', undefined, 'READY: TRIP — brak linku load_id / window_id'), 'pl').tail).toBeNull();
    const m = histRow(ev('READY_BLOCKED', '2026-10-05T11:08:00Z', 'HHL', undefined, 'READY: MISMATCH document'), 'pl');
    expect(text(m)).not.toMatch(CODE);
    const d = histRow(ev('DOC_UPLOADED', '2026-10-05T11:08:00Z', 'SCX', undefined, 'LASHING_PHOTOS: zdjecie.jpg (12345 B) → vault'), 'pl');
    expect(d.tail).toMatch(/zdjecie\.jpg$/);
    expect(text(d)).not.toMatch(CODE);
    expect(histRow(ev('NOTE', '2026-10-05T10:00:00Z', 'HHL', undefined, 'Kierowca dzwonił, prom STENA później'), 'pl').tail).toBe('Kierowca dzwonił, prom STENA później');
    expect(histRow(ev('UNLOADED', '2026-10-05T10:00:00Z', 'driver-pwa', undefined, 'Rozładowany'), 'pl').tail).toBeNull();
  });
  it('każdy rodzaj zdarzenia z bazy (ograniczenie 0205) ma polską nazwę, bez kodów', () => {
    const sql = readFileSync('supabase/migrations/0205_p4_e25_status_codes.sql', 'utf8');
    const block = sql.slice(sql.indexOf('load_events_event_type_known check'), sql.indexOf('));', sql.indexOf('load_events_event_type_known check')));
    const types = block.match(/'[A-Z_]+'/g)?.map((x) => x.slice(1, -1)) ?? [];
    expect(types.length).toBeGreaterThan(40);
    for (const t of types) {
      const r = histRow(ev(t, '2026-10-05T10:00:00Z', 'system', { geofence_name: 'Strefa' }), 'pl');
      const shown = `${r.head} ${r.to ?? ''}`.trim();
      expect(shown, t).not.toBe('');
      expect(shown, t).not.toMatch(/Zmiana w transporcie|^—$/);
      expect(text(r), t).not.toMatch(CODE);
    }
    expect(whoOf('driver-pwa', 'pl')).toBe('Kierowca (aplikacja)');
    const odd = histRow(ev('SOMETHING_NEW_42', '2026-10-01T19:43:00Z', 'system'), 'pl');
    expect(odd.head).toBe('Zmiana w transporcie');
  });
  it('audyt-B B-08: status z automatu nazwą E25 i źródłem jak na osi Status (bez „Załadowano”, „Rozładowano”)', () => {
    expect(histRow(ev('LOADED', '2026-10-01T06:30:00Z', 'system', { source: 'GPS', provider: 'emtrack' }), 'pl'))
      .toMatchObject({ cat: 'STATUS', head: '', from: null, to: 'Załadunek', who: 'GPS emtrack', src: null, tail: null });
    expect(histRow(ev('ON_FERRY', '2026-10-01T09:15:00Z', 'system', { source: 'AIS' }), 'pl')).toMatchObject({ to: 'Na promie', who: 'AIS' });
    expect(histRow(ev('UNLOADED', '2026-10-06T10:00:00Z', 'system', { source: 'GPS', provider: 'emtrack' }), 'pl')).toMatchObject({ to: 'Dostarczone', who: 'GPS emtrack' });
    const r = histRow(ev('UNLOADED', '2026-10-06T10:00:00Z', 'driver-pwa', undefined, 'Rozładowany'), 'pl');
    expect(text(r)).not.toMatch(/Rozładowan|Załadowano/);
  });
  it('import harmonogramu: wersja i plik; stara notatka „KSH import …” bez dopisku', () => {
    expect(histRow(ev('SCHEDULE_IMPORTED', '2026-10-01T19:43:00Z', 'system', { version: 1, file_name: 'plik.xlsx' }), 'pl'))
      .toMatchObject({ cat: 'IMPORT', head: 'Dodany z harmonogramu KSH', tail: 'wersja 1, plik plik.xlsx' });
    expect(histRow(ev('SCHEDULE_IMPORTED', '2026-10-01T19:43:00Z', 'system', undefined, 'KSH import X-1'), 'pl').tail).toBeNull();
  });
});

describe('Historia — ukryte, kto co widzi, filtry, dni', () => {
  const list = [
    ev('ORDER_NO_UPDATED', '2026-10-05T11:09:00Z', 'SCX', { side: 'CARRIER', old: null, new: 'A/1' }),
    ev('ORDER_NO_UPDATED', '2026-10-05T11:11:00Z', 'SCX', { side: 'CARRIER', old: 'A/1', new: 'A/1' }),
    ev('STATUS_AUTO', '2026-10-05T11:12:00Z', 'system', { from: 'READY', to: 'READY' }),
    ev('STATUS_READY', '2026-10-05T11:13:00Z', 'HHL', { from: 'READY' }),
    ev('STATUS_FERRY', '2026-10-05T11:14:00Z', 'HHL', { from: 'ON_FERRY' }),
    ev('STATUS_AUTO', '2026-10-07T06:35:00Z', 'system', { from: 'IN_TRANSIT_SE', to: 'AT_SITE' }),
    ev('FEE_PROPOSED', '2026-10-06T08:00:00Z', 'HHL', { side: 'COST', old: null, new: '100' }),
    ev('FEE_PROPOSED', '2026-10-06T08:01:00Z', 'HHL', { side: 'REVENUE', old: null, new: '120' }),
    ev('PRICE_MARGIN', '2026-10-06T08:02:00Z', 'system', { side: 'MARGIN' }),
    ev('FEE_PROPOSED', '2026-10-06T08:03:00Z', 'HHL', {}),
    ev('AGREED_FEE_SET', '2026-10-06T08:04:00Z', 'HHL', { side: 'CARRIER' }),
    ev('DOC_UPLOADED', '2026-10-06T09:00:00Z', 'SCX', undefined, 'zezwolenie.pdf'),
  ];
  it('wpisy bez zmiany ukryte i policzone („Gotowy → Gotowy”, ten sam numer, „Prom → Na promie”)', () => {
    expect(list.filter(isNoChange)).toHaveLength(4);
    expect(buildHistory(list, 'HHL', 'ALL', 'pl').hidden).toBe(4);
    expect(buildHistory(list, 'HHL', 'PRICE', 'pl').hidden).toBe(0);
  });
  it('powtórzenia tego samego zapisu ukryte (numer z notatki, zasoby, „rejs usunięty” bez rejsu); ponowny wjazd w strefę zostaje', () => {
    const rep = [
      ev('ORDER_NO_UPDATED', '2026-10-05T11:08:00Z', 'SCX', undefined, 'Nr zlecenia przewoźnika: X/1'),
      ev('ORDER_NO_UPDATED', '2026-10-05T11:20:00Z', 'SCX', undefined, 'Nr zlecenia przewoźnika: X/1'),
      ev('ORDER_NO_UPDATED', '2026-10-05T11:21:00Z', 'HHL', undefined, 'Nr zlecenia HHL: X/1'),
      ev('RESOURCES_UPDATED', '2026-10-05T11:30:00Z', 'SCX', { driverName: 'A' }),
      ev('RESOURCES_UPDATED', '2026-10-06T11:30:00Z', 'SCX', { driverName: 'A' }),
      ev('SAILING_ASSIGNED', '2026-10-05T12:00:00Z', 'SCX', undefined, 'rejs usunięty'),
      ev('GEOFENCE_ENTER', '2026-10-05T13:00:00Z', 'system', { geofence_id: 'gf-x' }),
      ev('GEOFENCE_ENTER', '2026-10-05T15:00:00Z', 'system', { geofence_id: 'gf-x' }),
    ];
    const ids = noChangeIds(rep);
    expect([...ids].sort()).toEqual([rep[1].id, rep[4].id, rep[5].id].sort());
  });
  it('KSH bez numerów zleceń (E41) i bez filtra „Numery”', () => {
    expect(visibleFor(list[0], 'KSH')).toBe(false);
    expect(visibleFor(list[0], 'SCX')).toBe(true);
    expect(histFiltersFor('KSH')).not.toContain('NUM');
    expect(buildHistory(list, 'KSH', 'ALL', 'pl').days.flatMap((d) => d.rows).some((r) => r.cat === 'NUMER')).toBe(false);
  });
  it('ceny: HHL wszystkie; KSH tylko przychód, SCX tylko koszt; marża i cena bez strony — tylko HHL', () => {
    const prices = list.filter((e) => /FEE|PRIC/.test(e.type));
    const sides = (role: 'HHL' | 'KSH' | 'SCX') => prices.filter((e) => visibleFor(e, role)).map((e) => `${e.type}:${String(e.payload?.side ?? '')}`);
    expect(sides('HHL')).toHaveLength(5);
    expect(sides('KSH')).toEqual(['FEE_PROPOSED:REVENUE']);
    expect(sides('SCX')).toEqual(['FEE_PROPOSED:COST', 'AGREED_FEE_SET:CARRIER']);
  });
  it('filtry i dni od najnowszego', () => {
    const all = buildHistory(list, 'HHL', 'ALL', 'pl');
    expect(all.days.map((d) => d.day)).toEqual(['2026-10-07', '2026-10-06', '2026-10-05']);
    expect(all.days[0].rows[0]).toMatchObject({ from: 'Droga SE', to: 'Na placu' });
    expect(buildHistory(list, 'HHL', 'NUM', 'pl').total).toBe(1);
    expect(buildHistory(list, 'HHL', 'DOC', 'pl').total).toBe(1);
    expect(buildHistory(list, 'KSH', 'PRICE', 'pl').total).toBe(1);
    expect(buildHistory(list, 'HHL', 'ROUTE', 'pl').days.flatMap((d) => d.rows).every((r) => r.cat === 'STATUS' || r.cat === 'TRASA')).toBe(true);
    expect(dayLabel('2026-10-07')).toBe('07.10.2026 · środa');
  });
});

describe('Czat (E17, 20:57)', () => {
  const m = (id: string, org: 'HHL' | 'SCX' | 'KSH', at: string, extra: Partial<LoadMessage> = {}): LoadMessage => ({ id, loadId: 'L1', at, author: org, org, text: 't', ...extra });
  const msgs = [
    m('a', 'HHL', '2026-10-06T07:39:00Z'),
    m('b', 'SCX', '2026-10-06T08:00:00Z', { visibleTo: 'HHL_SCX' }),
    m('c', 'KSH', '2026-10-07T12:22:00Z', { reads: [{ userId: 'u-hhl', name: 'x', org: 'HHL', at: '2026-10-07T12:30:00Z' }] }),
  ];
  it('KSH nie widzi rozmów „tylko HHL i SCX”', () => {
    expect(chatVisibleFor(msgs, 'KSH').map((x) => x.id)).toEqual(['a', 'c']);
    expect(chatVisibleFor(msgs, 'SCX').map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('nieprzeczytane: cudze, niewidziane w zakładce w tej sesji, bez mojego odczytu', () => {
    expect(chatUnread(msgs, 'HHL', null, new Set())).toBe(2);
    expect(chatUnread(msgs, 'HHL', 'u-hhl', new Set())).toBe(1);
    expect(chatUnread(msgs, 'HHL', null, new Set(['b']))).toBe(1);
    expect(chatUnread(msgs, 'KSH', null, new Set())).toBe(1);
  });
});

describe('Demo i strażnik I-0', () => {
  const snap = buildDemoSnapshot();
  const now = '2026-10-14T10:00:00Z';
  it('przykłady demo: wcześniej niż „teraz”, z ukrytymi zapisami bez zmiany, bez kodów w treści', () => {
    for (const l of snap.loads.slice(0, 40)) {
      const extra = demoHistoryEvents(l, now);
      expect(extra.every((e) => Date.parse(e.at) < Date.parse(now))).toBe(true);
      const h = buildHistory([...snap.events.filter((e) => e.loadId === l.id), ...extra], 'HHL', 'ALL', 'pl', new Map(snap.geofences.map((g) => [g.id, g.name])));
      for (const r of h.days.flatMap((d) => d.rows)) expect(text(r)).not.toMatch(CODE);
    }
  });
  it('czat demo: rozmowa „tylko HHL i SCX”, odczyty spójne z nieprzeczytanymi, nie z przyszłości', () => {
    /* W-demo (audyt 17.10, N6): rozmowa demo przy transportach przed załadunkiem — pierwszy transport z wiadomościami */
    const l = snap.loads.find((x) => snap.messages.some((m) => m.loadId === x.id))!;
    const chat = demoChat(l, snap.messages.filter((x) => x.loadId === l.id), now);
    expect(chat.some((x) => x.visibleTo === 'HHL_SCX')).toBe(true);
    expect(chat.flatMap((x) => x.reads ?? []).every((r) => Date.parse(r.at) < Date.parse(now))).toBe(true);
    /* HHL nie otworzył jeszcze rozmowy SCX → u HHL nieprzeczytana; SCX przeczytał wiadomość HHL → u SCX nie */
    expect(chatUnread(chat, 'HHL', 'demo-hhl-1', new Set())).toBe(1);
    expect(chatUnread(chat, 'SCX', 'demo-scx-1', new Set())).toBe(0);
  });
  it('p6bSource woła przykłady wyłącznie za warunkiem trybu demo wpisanym wprost; p6bDemo tylko z p6bSource', () => {
    const src = readFileSync(new URL('../src/lib/p6bSource.ts', import.meta.url), 'utf8');
    const lines = src.split('\n').filter((x) => /\bdemo[A-Z]\w+\(/.test(x));
    expect(lines.length).toBe(3);
    for (const x of lines) expect(x).toMatch(/import\.meta\.env\.VITE_AUTH_MODE !== 'supabase' \? /);
    /* B4 (21.10.2026): wybór odbiorców włączony także na produkcji */
    expect(src).toMatch(/export function chatVisibilityOn\(\): boolean \{\s*return true;/);
    for (const f of ['chatReadsOn']) {
      expect(src).toMatch(new RegExp(`export function ${f}\\(\\): boolean \\{\\s*return import\\.meta\\.env\\.VITE_AUTH_MODE !== 'supabase';`));
    }
    for (const f of ['src/components/drawer/LoadDrawer.tsx', 'src/components/drawer/PanelHistory.tsx', 'src/components/drawer/PanelChat.tsx']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/p6bDemo/);
    }
  });
  it('panel: profil trasy ukryty, Czat bez innych przycisków niż wysyłka i wybór odbiorców (E17 test)', () => {
    const d = readFileSync('src/components/drawer/LoadDrawer.tsx', 'utf8');
    expect(d).not.toMatch(/RouteProfilePanel|data-route-profile/);
    const c = readFileSync('src/components/drawer/PanelChat.tsx', 'utf8');
    /* wyglad/P6-e: trzeci przycisk to rozwinięcie „Przeczytali” pod wiadomością (Cz11) — nie czynność poza czatem */
    expect((c.match(/<button\b/g) ?? []).length).toBe(3);
    expect(c).toMatch(/data-chat-read=\{mine \? 'yes' : 'list'\}/);
    expect(c).toMatch(/data-chat-vis/);
    expect(c).toMatch(/data-chat-send/);
  });
});
