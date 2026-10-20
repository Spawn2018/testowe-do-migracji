/**
 * wyglad/P9-f — dopisek na mapie w Przeglądzie panelu transportu według E32 pkt 3 (zdecydowane 08.10 12:14) i E27:
 * bez pozycji — cała trasa i powód („Brak pozycji · Śledzenie od 08.10, 03:00 · Brak linku śledzenia — SCX”);
 * na placu — „Na placu od 07.10, 08:35” i strefa placu. Moduł czysty: powód tylko z danych (`trackingLink`), bez zgadywania.
 */
import type { Load } from '../types';
import { stageTileOf, trackingPhase } from './stageTiles';
import { formatCalendarDay } from './time';
import { trackingNoLink } from './trackerLink';

/** `lines` — P11 (e1, e32): dopisek w kilku liniach jak na makiecie; `alert` — numer linii na czerwono (brak linku śledzenia). */
export type DrawerNote = { kind: 'before' | 'after' | 'nopos' | 'site'; text: string; lines: string[]; alert?: number };

const note = (kind: DrawerNote['kind'], lines: (string | null)[], alertLine?: string | null): DrawerNote => {
  const ls = lines.filter((x): x is string => !!x);
  const i = alertLine ? ls.indexOf(alertLine) : -1;
  return { kind, text: ls.join(' · '), lines: ls, ...(i >= 0 ? { alert: i } : {}) };
};

export type NoteCtx = {
  nowIso: string;
  prod: boolean;
  /** Produkcja: pozycje z bazy już wczytane. */
  gpsReady: boolean;
  /** Transport ma pozycję (produkcja: `latest_vehicle_fixes`; demo: zawsze w oknie). */
  hasFix: boolean;
  tx: (key: string, params?: Record<string, string | number>) => string;
  /** „07.10, 08:35” */
  dt: (iso: string) => string;
  /** Wjazd do strefy placu (ostatnie `GEOFENCE_ENTER` SITE, jak „na placu od” w Kokpicie). */
  siteSince?: string | null;
  /** P11 (e32): nazwa strefy placu (Strefy, typ SITE) — trzecia linia dopisku na placu. */
  siteZone?: string | null;
  /** „09:22” — godzina ostatniej pozycji (druga linia dopisku na placu). */
  hm?: (iso: string) => string;
};

const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('pl') + s.slice(1) : s);

/** Powód braku pozycji z danych linku śledzenia (E44); `undefined` = serwer nie podaje stanu — bez powodu. */
export function linkWhy(l: Pick<Load, 'trackingLink'>, tx: NoteCtx['tx'], phase: 'before' | 'on'): string | null {
  if (l.trackingLink === undefined) return null;
  if (l.trackingLink === null) return tx('p9f_why_link');
  const st = l.trackingLink.check?.state;
  if (st === 'invalid') return cap(tx('p9c_pos_none_bad'));
  if (phase === 'before') return null;
  if (st === 'down') return cap(tx('p9c_pos_none_down'));
  return cap(tx('p9c_pos_none_wait'));
}

export function drawerMapNote(l: Load, ctx: NoteCtx): DrawerNote | null {
  const phase = trackingPhase(l, ctx.nowIso);
  /* decyzja właściciela 20.10 20:01: bez linku nie ma śledzenia — powód zamiast „Śledzenie od …” */
  if ((phase === 'before' || phase === 'on') && trackingNoLink(l, l.trackingLink, ctx.prod)) {
    const why = ctx.tx('p9f_why_link');
    return note('nopos', [ctx.tx('p9f_nopos'), why], why);
  }
  if (phase === 'before') {
    const day = (l.plannedLoadDate ?? '').slice(0, 10);
    const from = /^\d{4}-\d{2}-\d{2}$/.test(day)
      ? ctx.tx('p9f_track_from', { t: `${formatCalendarDay(day)}, 03:00` })
      : ctx.tx('p9f_track_from_day');
    const why = linkWhy(l, ctx.tx, 'before');
    return note('before', [ctx.tx('p9f_nopos'), from, why], l.trackingLink === null ? why : null);
  }
  if (phase === 'after') return note('after', [ctx.tx('p9f_track_done')]);
  if (ctx.prod && ctx.gpsReady && !ctx.hasFix) {
    const why = linkWhy(l, ctx.tx, 'on');
    return why ? note('nopos', [ctx.tx('p9f_nopos'), why], l.trackingLink === null ? why : null) : note('nopos', [ctx.tx('p9c_drawer_nogps')]);
  }
  if (stageTileOf(l) === 'SITE') {
    /* tylko fakty: wjazd do strefy placu, a bez niego początek czekania przed placem (E15) — bez ETA */
    const since = ctx.siteSince ?? l.etaDetail?.waitSince ?? null;
    if (since) {
      const last = l.etaDetail?.lastFixAt && ctx.hm ? ctx.tx('p9f_site_last', { t: ctx.hm(l.etaDetail.lastFixAt) }) : null;
      const zone = ctx.siteZone ? ctx.tx('p9f_site_zone', { z: ctx.siteZone }) : null;
      return note('site', [ctx.tx('p9f_site_since', { t: ctx.dt(since) }), last, zone]);
    }
  }
  return null;
}
