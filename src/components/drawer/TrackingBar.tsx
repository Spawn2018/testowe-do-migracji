/**
 * wyglad/P4-b — pasek śledzenia w panelu transportu, nad zakładkami (E27 pkt 5, img/e27-after; E1-2).
 * Przed oknem: „Śledzenie włączy się 21.10 o 03:00 · naczepa …”; w oknie: „Śledzenie trwa od 03:00 · ostatnia pozycja 2 min temu”;
 * po „Dostarczone”: „Śledzenie zakończone 07.10, 12:19” i ślad z przewozu (usuwany 30 dni po dostawie).
 * Opis lokalizatora (E44 pkt 6): emtrack = naczepa SCX (decyzja 21:43); link RIO — bez klucza (E44 pkt 8: „RIO · ••••”).
 * Czysty wygląd: dane z transportu i dziennika zdarzeń, bez zapytań.
 * audyt-B B-15: bez nazwy transportu w tekście — nazwa jest w nagłówku panelu.
 */
import { etaDuration } from '../../lib/etaDuration';
import type { Load, LoadEvent, Locale, TrackingLinkInfo } from '../../types';
import { t, tp } from '../../i18n/messages';
import { trackingPhase } from '../../lib/stageTiles';
import { buildStatusAxis, dayOnly, dayTime, isoMs } from '../../lib/statusAxis';
import { hasAwizacja } from '../../lib/awizacjaState';
import { trackerKind } from '../../lib/trackerLink';
import { rioStartsLate, trackerBarRio } from '../../lib/p4c';
import { trkSub } from '../../lib/trackingStateText';

function trackerText(load: Pick<Load, 'resources' | 'plannedLoadDate'>, locale: Locale, link: TrackingLinkInfo | null, nowIso: string): string {
  /* wyglad/P4-c (E44 pkt 5, 6): link RIO z serwera — pojazd z lokalizatorem, start i wygaśnięcie linku */
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

export function TrackingBar({
  load,
  events,
  locale,
  nowIso,
  trackingLink = null,
}: {
  load: Load;
  events: readonly LoadEvent[];
  locale: Locale;
  nowIso: string;
  /** wyglad/P4-c — link śledzenia z serwera (E44) */
  trackingLink?: TrackingLinkInfo | null;
}) {
  const phase = trackingPhase(load, nowIso);
  const tracker = trackerText(load, locale, trackingLink, nowIso);
  const trailer = (load.resources.trailerPlate ?? '').trim();

  if (phase === 'before') {
    const sub = [
      trkSub(locale, hasAwizacja(load) ? 'p4b_trk_before_sub' : 'p4b_trk_before_sub_noawiz'),
      trailer ? tp(locale, 'p4b_trailer', { plate: trailer }) : t(locale, 'p4b_no_trailer'),
      /* wyglad/P4-c (E44 pkt 5): link RIO nadaje później niż od 03:00 albo już wygasł */
      trackingLink?.provider === 'RIO' && (rioStartsLate(trackingLink, load, nowIso) || (trackingLink.validTo && isoMs(trackingLink.validTo) <= isoMs(nowIso)))
        ? tracker
        : null,
    ].filter(Boolean).join(' · ');
    return (
      <div className="trk before" data-tracking-bar="before">
        <span className="trk-mk" aria-hidden />
        <div className="trk-txt">
          <b>{tp(locale, 'p4b_trk_before', { day: dayOnly(load.plannedLoadDate) })}</b>
          <span>{sub}</span>
        </div>
      </div>
    );
  }

  if (phase === 'on') {
    const day = (load.plannedLoadDate ?? '').slice(0, 10);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(nowIso));
    /* start okna = 03:00 w dniu załadunku (L15, L16); gdy transport ruszył przed dniem z planu — od pierwszego statusu trasy */
    const firstRoute = buildStatusAxis(load, events).groups.find((g) => g.key === 'route')?.rows.find((r) => r.hit)?.hit?.at ?? null;
    const start = day && day > today
      ? (firstRoute ? dayTime(firstRoute) : null)
      : !day || day === today ? '03:00' : `${dayOnly(day)}, 03:00`;
    const lastFix = load.etaDetail?.lastFixAt
      ?? (load.silentMinutes != null ? new Date(Date.parse(nowIso) - load.silentMinutes * 60_000).toISOString() : null);
    const head = [start ? tp(locale, 'p4b_trk_on', { start }) : t(locale, 'p4b_trk_on_nostart'), lastFix ? tp(locale, 'p4b_trk_on_last', { ago: ago(lastFix, nowIso, locale) }) : null]
      .filter(Boolean)
      .join(' · ');
    return (
      <div className="trk on" data-tracking-bar="on">
        <span className="trk-mk" aria-hidden />
        <div className="trk-txt">
          <b>{head}</b>
          <span>{[trkSub(locale, 'p4b_trk_on_sub'), tracker].join(' · ')}</span>
        </div>
      </div>
    );
  }

  if (String(load.status) === 'CANCELLED') {
    return (
      <div className="trk after" data-tracking-bar="cancelled">
        <span className="trk-mk" aria-hidden />
        <div className="trk-txt">
          <b>{t(locale, 'p4b_trk_cancelled')}</b>
        </div>
      </div>
    );
  }

  const axis = buildStatusAxis(load, events);
  const done = axis.deliveredAt;
  const purge = done ? new Date(Date.parse(done) + 30 * 86_400_000).toISOString() : null;
  const sub = [
    done && axis.firstFixAt && isoMs(axis.firstFixAt) < isoMs(done)
      ? tp(locale, 'p4b_trk_after_trail', { from: dayTime(axis.firstFixAt), to: dayTime(done) })
      : null,
    purge ? tp(locale, 'p4b_trk_after_purge', { day: dayOnly(purge) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="trk after" data-tracking-bar="after">
      <span className="trk-mk" aria-hidden />
      <div className="trk-txt">
        <b>{done ? tp(locale, 'p4b_trk_after', { at: dayTime(done) }) : t(locale, 'p4b_trk_after_nodate')}</b>
        {sub ? <span>{sub}</span> : null}
      </div>
    </div>
  );
}
