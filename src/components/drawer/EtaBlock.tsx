/**
 * wyglad/P4-b — blok ETA w Przeglądzie panelu (E15 pkt 2, 6, 8; img/e15-after „Panel transportu › Przegląd · blok ETA”).
 * Stany: przed wyjazdem ze Śremu („ETA: –” + plan dostawy KSH), w trasie (ETA, pasmo ± i słowo pewności, wiek pozycji, km, jazda,
 * okno dostawy), odpoczynek w toku, czeka przed placem, dostarczone. Telefon: „ETA BODEN” + „Dlaczego tyle”.
 * Szczegóły (odpoczynek, km, jazda, czekanie) z `load.etaDetail` — wypełnia wykonawca (E15); bez nich blok pokazuje ETA, pasmo i okno.
 */
import type { Load, Locale } from '../../types';
import { t, tp } from '../../i18n/messages';
import { etaConfidenceLabel } from '../../lib/enumLabels';
import { etaIsNightArrival, etaWindowKind } from '../../lib/time';
import { stageTileOf } from '../../lib/stageTiles';
import { dayOnly, dayTime, hoursMinutes, timeOnly } from '../../lib/statusAxis';
import { formatDelayPill } from '../ui/StatusPill';

const SE = 'Europe/Stockholm';
const up = (s: string) => s.toLocaleUpperCase('pl');

function ago(fromIso: string, nowIso: string, locale: Locale): string {
  const m = Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(fromIso)) / 60_000));
  if (m < 1) return t(locale, 'p4b_ago_now');
  if (m < 60) return tp(locale, 'p4b_ago_min', { n: m });
  return tp(locale, 'p4b_ago_h', { h: Math.floor(m / 60), m: m % 60 });
}

export function EtaBlock({
  load,
  locale,
  phone,
  nowIso,
  deliveredAt,
  delayMin,
}: {
  load: Load;
  locale: Locale;
  phone: boolean;
  nowIso: string;
  deliveredAt: string | null;
  delayMin: number | null;
}) {
  const tile = stageTileOf(load);
  if (tile == null) return null;
  const d = load.etaDetail ?? null;

  if (tile === 'DELIVERED' || tile === 'SETTLE') {
    return (
      <div className="etab done" data-eta="done" data-eta-block>
        <div className="etab-lbl">{t(locale, 'p4b_eta_done_lbl')}</div>
        <div className="etab-val">{dayTime(deliveredAt ?? load.unloadedAt ?? null)}</div>
        <div className="etab-sub">{t(locale, 'p4b_eta_done_sub')}</div>
      </div>
    );
  }

  if (tile === 'PREP' || load.etaPreLoad) {
    return (
      <div className="etab pre" data-eta="pre-load" data-eta-block>
        <div className="etab-lbl">{t(locale, phone ? 'p4b_eta_phone_lbl' : 'p4b_eta_pre_lbl')}</div>
        <div className="etab-val">{t(locale, 'p4b_eta_pre_val')}</div>
        <div className="etab-sub">{tp(locale, 'p4b_eta_pre_sub', { day: dayOnly(load.plannedDeliverDate) })}</div>
      </div>
    );
  }

  const phase = d?.phase === 'REST' || d?.phase === 'WAIT_SITE' ? d.phase : 'DRIVE';
  const kind = load.etaBoden
    ? etaWindowKind(
        load.etaBoden,
        load.plannedDeliverDate,
        load.awizacja.unloadWindowStart ?? load.planDates?.deliveryFrom,
        load.awizacja.unloadWindowEnd ?? load.planDates?.deliveryTo,
      )
    : null;
  const late = load.delayed || kind === 'after';
  const winText = kind ? t(locale, late ? 'p4b_eta_win_after' : kind === 'before' ? 'p4b_eta_win_before' : 'p4b_eta_win_in') : null;

  /* pasmo ± minut i słowo pewności (E15-3) */
  const word = etaConfidenceLabel(load.etaConfidence, locale);
  const band = load.etaConfMin != null ? tp(locale, 'p4b_eta_band', { m: load.etaConfMin, word }) : word;
  const lastFix = d?.lastFixAt ?? null;

  let lbl: string;
  let value: string;
  let pill: { cls: string; text: string; db?: boolean } | null;
  let sub: (string | null)[];
  if (phase === 'REST') {
    lbl = tp(locale, 'p4b_eta_rest_lbl', { at: dayTime(d?.restFrom ?? load.etaUpdatedAt) });
    value = load.etaBoden ? dayTime(load.etaBoden, SE) : t(locale, 'p4b_eta_none');
    pill = { cls: 'p-sea', text: up(t(locale, 'p4b_eta_rest_pill')) };
    sub = [
      tp(locale, 'p4b_eta_rest_sub', {
        from: timeOnly(d?.restFrom),
        h: d?.restHours ?? 11,
        until: dayTime(d?.restUntil),
        dur: d?.driveMin != null ? hoursMinutes(d.driveMin * 60_000) : '—',
      }),
    ];
  } else if (phase === 'WAIT_SITE') {
    lbl = tp(locale, 'p4b_eta_wait_lbl', { at: dayTime(load.etaUpdatedAt) });
    value = tp(locale, 'p4b_eta_wait_val', { time: timeOnly(d?.waitSince) });
    pill = winText ? { cls: late ? 'p-red' : 'p-go', text: up(winText.replace(' dostawy', '')) } : null;
    sub = [tp(locale, 'p4b_eta_wait_sub', { day: dayOnly(load.plannedDeliverDate), last: timeOnly(lastFix) })];
  } else {
    lbl = phone ? t(locale, 'p4b_eta_phone_lbl') : tp(locale, 'p4b_eta_route_lbl', { at: dayTime(load.etaUpdatedAt) });
    value = load.etaBoden ? dayTime(load.etaBoden, SE) : t(locale, 'p4b_eta_none');
    pill = load.etaBoden
      ? { cls: load.etaConfidence === 'LOW' ? 'p-red' : load.etaConfidence === 'HIGH' ? 'p-go' : 'p-amber', text: up(band), db: load.etaConfMin != null }
      : null;
    const drive = d?.driveMin != null
      ? tp(locale, d.restNeeded === false ? 'p4b_eta_drive_norest' : 'p4b_eta_drive', { dur: hoursMinutes(d.driveMin * 60_000) })
      : null;
    sub = [
      lastFix ? tp(locale, 'p4b_eta_gps', { ago: ago(lastFix, nowIso, locale) }) : null,
      d?.distanceKm != null ? tp(locale, 'p4b_eta_km', { km: Math.round(d.distanceKm) }) : null,
      phone ? null : drive,
      winText,
      !d && !load.etaBoden ? (load.etaReasons[0] ?? null) : null,
    ];
  }
  const subText = sub.filter(Boolean).join(' · ');

  /* telefon: „Dlaczego tyle” (E15 pkt 8) */
  const why: string[] = [];
  if (phone && phase === 'DRIVE' && d) {
    if (d.driveMin != null) why.push(tp(locale, 'p4b_eta_why_drive', { dur: hoursMinutes(d.driveMin * 60_000) }));
    if (d.restDoneFrom && d.restDoneTo) why.push(tp(locale, 'p4b_eta_why_rest_done', { from: timeOnly(d.restDoneFrom), to: timeOnly(d.restDoneTo) }));
    if (d.restNeeded === false) why.push(t(locale, 'p4b_eta_why_norest'));
    else if (d.restNeeded && d.restHours) why.push(tp(locale, 'p4b_eta_why_rest_ahead', { h: d.restHours }));
  }

  return (
    <>
      <div className={`etab ${phase === 'DRIVE' ? 'route' : phase === 'REST' ? 'rest' : 'wait'}`} data-eta="value" data-eta-block data-eta-phase={phase}>
        <div className="etab-lbl">{lbl}</div>
        <div className="etab-val">
          <span>{value}</span>
          {pill ? (
            <span className={`pill ${pill.cls}`} {...(pill.db ? { 'data-eta': 'db' } : {})}>
              {pill.text}
            </span>
          ) : null}
          {late && delayMin != null ? <span className="pill p-red" data-eta-delay>{formatDelayPill(delayMin)}</span> : null}
          {load.etaBoden && etaIsNightArrival(load.etaBoden) ? (
            <span className="pill" data-eta-night="1">{up(t(locale, 'a6_dr_night_arrival'))}</span>
          ) : null}
        </div>
        {subText ? (
          <div className="etab-sub" {...(kind ? { 'data-eta-window': late ? 'after' : kind } : {})}>{subText}</div>
        ) : null}
      </div>
      {why.length ? (
        <div className="etab why" data-eta-why>
          <div className="etab-lbl">{t(locale, 'p4b_eta_why')}</div>
          <div className="etab-sub">{why.join(' ')}</div>
        </div>
      ) : null}
    </>
  );
}
