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
import { dayOnly, dayTime, timeOnly } from '../../lib/statusAxis';
import { etaDuration } from '../../lib/etaDuration';
import { formatDelayPill } from '../ui/StatusPill';
import { minText, type EtaWx } from '../../lib/e49Wx';
import { e49wx } from '../../i18n/e49Wx';

const SE = 'Europe/Stockholm';

function ago(fromIso: string, nowIso: string, locale: Locale): string {
  const m = Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(fromIso)) / 60_000));
  if (m < 1) return t(locale, 'p4b_ago_now');
  if (m < 60) return tp(locale, 'p4b_ago_min', { n: m });
  /* D-071: „3 h 27 min temu”, „1 d 2 h temu” */
  return tp(locale, 'p4b_ago_dur', { d: etaDuration(m) });
}

export function EtaBlock({
  load,
  locale,
  phone,
  nowIso,
  deliveredAt,
  siteSince,
  delayMin,
  wx = [],
}: {
  load: Load;
  locale: Locale;
  phone: boolean;
  nowIso: string;
  deliveredAt: string | null;
  /** wjazd na plac (bieżący status „Na placu”) */
  siteSince: string | null;
  delayMin: number | null;
  /** wyglad/E49: wiatr, postój przez wiatr, śliskość, zamknięcie i objazd (`etaWxOf`) */
  wx?: readonly EtaWx[];
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

  /* P11 (e15, D-80): „Załadunek” (auto na terenie KSH) też „Przed wyjazdem ze Śremu” — ETA liczy się dopiero po wyjeździe ze strefy */
  if (tile === 'PREP' || tile === 'LOADING' || load.etaPreLoad) {
    return (
      <div className="etab pre" data-eta="pre-load" data-eta-block>
        <div className="etab-lbl">{t(locale, phone ? 'p4b_eta_phone_lbl' : 'p4b_eta_pre_lbl')}</div>
        <div className="etab-val">{t(locale, 'p4b_eta_pre_val')}</div>
        <div className="etab-sub">{tp(locale, 'p4b_eta_pre_sub', { day: dayOnly(load.plannedDeliverDate) })}</div>
      </div>
    );
  }

  const phase: 'DRIVE' | 'REST' | 'WAIT_SITE' | 'SITE' =
    d?.phase === 'REST' || d?.phase === 'WAIT_SITE' ? d.phase : tile === 'SITE' ? 'SITE' : 'DRIVE';
  const kind = load.etaBoden
    ? etaWindowKind(
        load.etaBoden,
        load.plannedDeliverDate,
        load.awizacja.unloadWindowStart ?? load.planDates?.deliveryFrom,
        load.awizacja.unloadWindowEnd ?? load.planDates?.deliveryTo,
      )
    : null;
  /* audyt 17.10 (F7): „po oknie” tylko, gdy ETA jest za oknem dostawy; bez ETA — znacznik opóźnienia z bazy */
  const late = kind ? kind === 'after' : !!load.delayed;
  const win = kind ? (late ? 'after' : kind === 'before' ? 'before' : 'in') : null;
  const winText = win ? t(locale, `p4b_eta_win_${win}`) : null;
  const osm = (load.etaMethod ?? '').includes('OSM') ? t(locale, 'i2_eta_osm_attr') : null;

  /* B7 / E15 pkt 8; P11 (e15): na promie główna wartość to ETA Boden (ta sama co w tabeli Mapy),
     wpłynięcie promu z AIS albo „czeka na pozycję AIS” w podpisie */
  if (d?.phase === 'FERRY' || load.status === 'ON_FERRY') {
    const aisEta = d?.ferryEtaAt ?? null;
    const waiting = d?.waitAis || !aisEta;
    return (
      <div className="etab ferry" data-eta="ferry" data-eta-block>
        <div className="etab-lbl">{t(locale, 'p4b_eta_ferry_lbl')}</div>
        <div className="etab-val">
          <span>{load.etaBoden ? dayTime(load.etaBoden, SE) : t(locale, 'p4b_eta_none')}</span>
          {win ? <span className={`pill ${win === 'after' ? 'p-red' : 'p-go'}`}>{t(locale, `p4b_eta_pill_${win}`)}</span> : null}
        </div>
        <div className="etab-sub">
          {[
            waiting ? t(locale, 'p4b_eta_ferry_wait_ais') : tp(locale, 'p4b_eta_ferry_in', { at: dayTime(aisEta) }),
            waiting ? t(locale, 'p4b_eta_ferry_wait_sub') : null,
            winText,
          ].filter(Boolean).join(' · ')}
        </div>
      </div>
    );
  }
  const reasons = !d && load.etaReasons?.length ? load.etaReasons.slice(0, 2).join(' · ') : null;

  /* pasmo ± minut i słowo pewności (E15-3) */
  const word = etaConfidenceLabel(load.etaConfidence, locale);
  const band = load.etaConfMin != null ? tp(locale, 'p4b_eta_band', { m: etaDuration(load.etaConfMin), word }) : word;
  const lastFix = d?.lastFixAt ?? null;

  let lbl: string;
  let value: string;
  let pill: { cls: string; text: string; db?: boolean } | null;
  let sub: (string | null)[];
  if (phase === 'REST') {
    lbl = tp(locale, 'p4b_eta_rest_lbl', { at: dayTime(d?.restFrom ?? load.etaUpdatedAt) });
    value = load.etaBoden ? dayTime(load.etaBoden, SE) : t(locale, 'p4b_eta_none');
    pill = { cls: 'p-sea', text: t(locale, 'p4b_eta_rest_pill') };
    sub = [
      d?.restFrom ? tp(locale, 'p4b_eta_rest_from', { from: timeOnly(d.restFrom) }) : null,
      d?.restUntil
        ? d.restHours
          ? tp(locale, 'p4b_eta_rest_until_h', { h: d.restHours, until: dayTime(d.restUntil) })
          : tp(locale, 'p4b_eta_rest_until', { until: dayTime(d.restUntil) })
        : null,
      d?.driveMin != null ? tp(locale, 'p4b_eta_rest_then', { dur: etaDuration(d.driveMin) }) : null,
      osm,
    ];
  } else if (phase === 'WAIT_SITE') {
    lbl = tp(locale, 'p4b_eta_wait_lbl', { at: dayTime(load.etaUpdatedAt) });
    value = tp(locale, 'p4b_eta_wait_val', { time: timeOnly(d?.waitSince) });
    pill = win ? { cls: win === 'after' ? 'p-red' : 'p-go', text: t(locale, `p4b_eta_pill_${win}`) } : null;
    sub = [
      t(locale, 'p4b_eta_wait_edge'),
      tp(locale, 'p4b_eta_wait_window', { day: dayOnly(load.plannedDeliverDate) }),
      lastFix ? tp(locale, 'p4b_eta_wait_quiet', { last: timeOnly(lastFix) }) : null,
    ];
  } else if (phase === 'SITE') {
    lbl = siteSince ? tp(locale, 'p4b_eta_site_lbl_at', { at: dayTime(siteSince) }) : t(locale, 'p4b_eta_site_lbl');
    value = siteSince ? tp(locale, 'p4b_eta_wait_val', { time: timeOnly(siteSince) }) : t(locale, 'p4b_eta_site_val');
    pill = win ? { cls: win === 'after' ? 'p-red' : 'p-go', text: t(locale, `p4b_eta_pill_${win}`) } : null;
    sub = [tp(locale, 'p4b_eta_wait_window', { day: dayOnly(load.plannedDeliverDate) })];
  } else {
    lbl = phone ? t(locale, 'p4b_eta_phone_lbl') : tp(locale, 'p4b_eta_route_lbl', { at: dayTime(load.etaUpdatedAt) });
    value = load.etaBoden ? dayTime(load.etaBoden, SE) : t(locale, 'p4b_eta_none');
    pill = load.etaBoden
      ? { cls: load.etaConfidence === 'LOW' ? 'p-red' : load.etaConfidence === 'HIGH' ? 'p-go' : 'p-amber', text: band, db: load.etaConfMin != null }
      : null;
    const drive = d?.driveMin != null
      ? tp(locale, d.restNeeded === false ? 'p4b_eta_drive_norest' : 'p4b_eta_drive', { dur: etaDuration(d.driveMin) })
      : null;
    sub = [
      lastFix ? tp(locale, 'p4b_eta_gps', { ago: ago(lastFix, nowIso, locale) }) : null,
      d?.distanceKm != null ? tp(locale, d.distanceTo === 'PORT' ? 'p4b_eta_km_port' : 'p4b_eta_km', { km: Math.round(d.distanceKm) }) : null,
      phone ? null : drive,
      winText,
      reasons,
      osm,
    ];
  }
  const subText = sub.filter(Boolean).join(' · ');

  /* telefon: „Dlaczego tyle” (E15 pkt 8) */
  const why: string[] = [];
  if (phone && phase === 'DRIVE' && d) {
    if (d.driveMin != null) why.push(tp(locale, 'p4b_eta_why_drive', { dur: etaDuration(d.driveMin) }));
    if (d.restDoneFrom && d.restDoneTo) why.push(tp(locale, 'p4b_eta_why_rest_done', { from: timeOnly(d.restDoneFrom), to: timeOnly(d.restDoneTo) }));
    if (d.restNeeded === false) why.push(t(locale, 'p4b_eta_why_norest'));
    else if (d.restNeeded && d.restHours) why.push(tp(locale, 'p4b_eta_why_rest_ahead', { h: d.restHours }));
  }

  /* wyglad/E49 (D-20261016-0230-01 Z1, Z3, Z4): co dolicza pogoda i zamknięcia — w trasie i na odpoczynku */
  const wxLines = phase === 'DRIVE' || phase === 'REST' ? wx.map((w) => {
    const vars = {
      d: minText(w.addMin), g: w.gustMs ?? '—', where: w.where,
      side: w.side ? e49wx(`e49_wx_side_${w.side}`) : '',
      at: w.atIso ? timeOnly(w.atIso) : '—',
      from: w.fromIso ? timeOnly(w.fromIso) : '—',
      to: w.untilIso ? timeOnly(w.untilIso) : '—',
    };
    return { kind: w.kind, text: e49wx(`e49_wx_${w.kind}`, vars).replace('  ', ' ') };
  }) : [];
  const smhi = phase === 'DRIVE' || phase === 'REST' ? wx.some((w) => w.source === 'SMHI') : false;

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
            <span className="pill" data-eta-night="1">{t(locale, 'a6_dr_night_arrival')}</span>
          ) : null}
        </div>
        {subText ? (
          <div className="etab-sub" {...(win ? { 'data-eta-window': win } : {})}>{subText}</div>
        ) : null}
        {wxLines.length ? (
          <ul className="etab-wx" data-eta-wx>
            {wxLines.map((l, k) => <li key={k} className={l.kind === 'WIND_HOLD' || l.kind === 'CLOSURE_HOLD' ? 'is-hold' : undefined} data-eta-wx-kind={l.kind}>{l.text}</li>)}
            {smhi ? <li className="etab-wx-attr">{e49wx('e49_wx_attr')}</li> : null}
          </ul>
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
