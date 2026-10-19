/**
 * B9 / E27 pkt 5 — ten sam stan śledzenia w panelu (TrackingBar) i w PDF transportu.
 * W PDF (poza panelem) przed tekstem stoi nazwa transportu; w panelu nie (audyt-B B-15 — nazwa jest w nagłówku panelu).
 */
import { etaDuration } from './etaDuration';
import type { Load, LoadEvent, Locale, TrackingLinkInfo } from '../types';
import { t, tp } from '../i18n/messages';
import { trackingPhase } from './stageTiles';
import { buildStatusAxis, dayOnly, dayTime, isoMs } from './statusAxis';
import { hasAwizacja } from './awizacjaState';
import { trackerKind } from './trackerLink';
import { rioStartsLate, trackerBarRio } from './p4c';
import { transportLabel } from './transportName';
import type { OrgKind } from '../types';
import { serverRuleOn, SOON } from './serverRules';

/**
 * Audyt 17.10 (F7 do D-20261017-0730-01 §4): dopóki okno śledzenia nie działa na serwerze (A1, `TRACKING_WINDOW`),
 * zdania o samoczynnym włączeniu o 03:00 i wyłączeniu przy „Dostarczone” mają dopisek „włączamy wkrótce”.
 */
export function trkSub(locale: Locale, key: 'p4b_trk_before_sub' | 'p4b_trk_before_sub_noawiz' | 'p4b_trk_on_sub'): string {
  const base = t(locale, key);
  if (serverRuleOn('TRACKING_WINDOW')) return base;
  return key === 'p4b_trk_on_sub' ? `${base} — ${SOON}` : `${base} · start o 03:00 — ${SOON}`;
}


function trackerText(load: Pick<Load, 'resources' | 'plannedLoadDate'>, locale: Locale, link: TrackingLinkInfo | null, nowIso: string): string {
  const rio = trackerBarRio(link, nowIso, locale, load);
  if (rio) return rio;
  const kind = trackerKind(load.resources.trackingRef);
  const plate = (load.resources.trailerPlate ?? '').trim();
  if (kind === 'emtrack') return plate ? tp(locale, 'p4b_tracker_emtrack', { plate }) : t(locale, 'p4b_tracker_emtrack_noplate');
  if (kind === 'rio') return t(locale, 'p4b_tracker_rio');
  if (kind === 'other') return t(locale, 'p4b_tracker_other');
  return t(locale, 'p4b_tracker_none');
}

function ago(fromIso: string, nowIso: string, locale: Locale): string {
  const m = Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(fromIso)) / 60_000));
  if (m < 1) return t(locale, 'p4b_ago_now');
  if (m < 60) return tp(locale, 'p4b_ago_min', { n: m });
  return tp(locale, 'p4b_ago_dur', { d: etaDuration(m) }); /* D-071 */
}

/** Jedna linia stanu śledzenia (nagłówek + dopisek) — do PDF i testów. */
export function trackingStateLines(
  load: Load,
  events: readonly LoadEvent[],
  locale: Locale,
  nowIso: string,
  orgKind: OrgKind = 'HHL',
  trackingLink: TrackingLinkInfo | null = load.trackingLink ?? null,
): { head: string; sub: string } {
  const label = transportLabel(load, orgKind, 'plain');
  const phase = trackingPhase(load, nowIso);
  const tracker = trackerText(load, locale, trackingLink, nowIso);
  const trailer = (load.resources.trailerPlate ?? '').trim();

  if (phase === 'before') {
    const sub = [
      trkSub(locale, hasAwizacja(load) ? 'p4b_trk_before_sub' : 'p4b_trk_before_sub_noawiz'),
      trailer ? tp(locale, 'p4b_trailer', { plate: trailer }) : t(locale, 'p4b_no_trailer'),
      trackingLink?.provider === 'RIO'
        && (rioStartsLate(trackingLink, load, nowIso) || (trackingLink.validTo && isoMs(trackingLink.validTo) <= isoMs(nowIso)))
        ? tracker
        : null,
    ].filter(Boolean).join(' · ');
    return { head: `${label} · ${tp(locale, 'p4b_trk_before', { day: dayOnly(load.plannedLoadDate) })}`, sub };
  }

  if (phase === 'on') {
    const day = (load.plannedLoadDate ?? '').slice(0, 10);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(nowIso));
    const firstRoute = buildStatusAxis(load, events).groups.find((g) => g.key === 'route')?.rows.find((r) => r.hit)?.hit?.at ?? null;
    const start = day && day > today
      ? (firstRoute ? dayTime(firstRoute) : null)
      : !day || day === today ? '03:00' : `${dayOnly(day)}, 03:00`;
    const lastFix = load.etaDetail?.lastFixAt
      ?? (load.silentMinutes != null ? new Date(Date.parse(nowIso) - load.silentMinutes * 60_000).toISOString() : null);
    const head = [start ? tp(locale, 'p4b_trk_on', { start }) : t(locale, 'p4b_trk_on_nostart'), lastFix ? tp(locale, 'p4b_trk_on_last', { ago: ago(lastFix, nowIso, locale) }) : null]
      .filter(Boolean)
      .join(' · ');
    return { head, sub: [trkSub(locale, 'p4b_trk_on_sub'), tracker].join(' · ') };
  }

  if (load.status === 'CANCELLED') {
    return { head: `${label} · ${t(locale, 'p4b_trk_cancelled')}`, sub: '' };
  }

  const axis = buildStatusAxis(load, events);
  const done = axis.deliveredAt;
  const purge = done ? new Date(Date.parse(done) + 30 * 86_400_000).toISOString() : null;
  const sub = [
    done && axis.firstFixAt && isoMs(axis.firstFixAt) < isoMs(done)
      ? tp(locale, 'p4b_trk_after_trail', { from: dayTime(axis.firstFixAt), to: dayTime(done) })
      : null,
    purge ? tp(locale, isoMs(purge) > isoMs(nowIso) ? 'p4b_trk_after_purge_future' : 'p4b_trk_after_purge', { day: dayOnly(purge) }) : null,
  ].filter(Boolean).join(' · ');
  return {
    head: `${label} · ${done ? tp(locale, 'p4b_trk_after', { at: dayTime(done) }) : t(locale, 'p4b_trk_after_nodate')}`,
    sub,
  };
}

export function trackingStateOneLine(
  load: Load,
  events: readonly LoadEvent[],
  locale: Locale,
  nowIso: string,
  orgKind: OrgKind = 'HHL',
): string {
  const { head, sub } = trackingStateLines(load, events, locale, nowIso, orgKind);
  return sub ? `${head} · ${sub}` : head;
}
