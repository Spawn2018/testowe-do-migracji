/**
 * wyglad/P9-f — dopisek na mapie w Przeglądzie panelu transportu według E32 pkt 3 (zdecydowane 08.10 12:14) i E27:
 * bez pozycji — cała trasa i powód („Brak pozycji · Śledzenie od 08.10, 03:00 · Brak linku śledzenia — SCX”);
 * na placu — „Na placu od 07.10, 08:35” i strefa placu. Moduł czysty: powód tylko z danych (`trackingLink`), bez zgadywania.
 */
import type { Load } from '../types';
import { stageTileOf, trackingPhase } from './stageTiles';
import { formatCalendarDay } from './time';

export type DrawerNote = { kind: 'before' | 'after' | 'nopos' | 'site'; text: string };

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
  if (phase === 'before') {
    const day = (l.plannedLoadDate ?? '').slice(0, 10);
    const from = /^\d{4}-\d{2}-\d{2}$/.test(day)
      ? ctx.tx('p9f_track_from', { t: `${formatCalendarDay(day)}, 03:00` })
      : ctx.tx('p9f_track_from_day');
    return { kind: 'before', text: [ctx.tx('p9f_nopos'), from, linkWhy(l, ctx.tx, 'before')].filter(Boolean).join(' · ') };
  }
  if (phase === 'after') return { kind: 'after', text: ctx.tx('p9f_track_done') };
  if (ctx.prod && ctx.gpsReady && !ctx.hasFix) {
    const why = linkWhy(l, ctx.tx, 'on');
    return { kind: 'nopos', text: why ? `${ctx.tx('p9f_nopos')} · ${why}` : ctx.tx('p9c_drawer_nogps') };
  }
  if (stageTileOf(l) === 'SITE') {
    /* tylko fakty: wjazd do strefy placu, a bez niego początek czekania przed placem (E15) — bez ETA */
    const since = ctx.siteSince ?? l.etaDetail?.waitSince ?? null;
    if (since) return { kind: 'site', text: ctx.tx('p9f_site_since', { t: ctx.dt(since) }) };
  }
  return null;
}
