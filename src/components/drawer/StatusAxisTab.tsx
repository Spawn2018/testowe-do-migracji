/**
 * wyglad/P4-b — zakładka „Status” w panelu transportu (E25, img/e25-after, makieta E25/statusy.html).
 * Oś 14 statusów (nazwy z jednego słownika `statusLabel`, E25) w trzech grupach z godziną zdarzenia, AUTO / RĘCZNIE, autorem i przyczyną; przeskoki jako „pominięte”.
 * Telefon: najpierw „W trasie” i „Rozliczenie”, „Przygotowanie” zwinięte.
 * Stopka: kto zmienia + „Zmień status” (SCX i administrator HHL, decyzja 17:46). Okno — `StatusChangeModal`.
 */
import { useState, type ReactNode } from 'react';
import type { Bill, Document, Geofence, Load, LoadEvent, LoadStatus, Locale, OrgKind, ReadyGap } from '../../types';
import { t, tp } from '../../i18n/messages';
import { statusLabel } from '../../lib/statusLabel';
import { readyGapsText } from '../../lib/p4c';
import { axisActor, buildStatusAxis, dayOnly, dayTime, hoursMinutes, isoMs, timeOnly, type AxisHit, type AxisRow } from '../../lib/statusAxis';
import { axisMilestones, planNote, type PlanNote } from '../../lib/p6cAxis';
import { settlementGate } from '../../lib/statusSettlement';
import { fs6, fs6p } from '../../i18n/p6c';
import { ht } from '../../i18n/p6b';
import { whoOf } from '../../lib/p6History';

/* wyglad/P6-c (E17): „plan 07.10 · w terminie”, „plan 06.10 · +1 dzień”, „plan zał. 01.10” (załadunek zawsze „plan zał.”) */
function planText(n: PlanNote, locale: Locale, withDiff: boolean): string {
  const d = dayOnly(n.plan);
  const key = n.kind === 'load' ? 'p6c_plan_load' : 'p6c_plan';
  if (!withDiff || n.diff == null) return fs6p(locale, key, { d });
  const days = fs6(locale, Math.abs(n.diff) === 1 ? 'p6c_day_1' : 'p6c_day_n');
  const diff = n.diff === 0 || (n.kind === 'deliver' && n.diff < 0)
    ? fs6(locale, 'p6c_plan_ok')
    : n.diff > 0 ? fs6p(locale, 'p6c_plan_late', { n: n.diff, days }) : fs6p(locale, 'p6c_plan_early', { n: -n.diff, days });
  return `${fs6p(locale, key, { d })} · ${diff}`;
}

/* wyglad/P6-c (E17): rozliczenie z dokumentów i faktur, które firma widzi (te same warunki co okno „Zmień status”, A5) */
function settleText(
  s: LoadStatus, loadId: string, role: OrgKind, docs: readonly Document[], bills: readonly Bill[], canStatus: boolean, locale: Locale,
): string | null {
  const g = settlementGate(s, loadId, role, docs, bills);
  if (!g) return null;
  /* „można zmienić status” tylko u tego, kto ma przycisk „Zmień status” (SCX, administrator HHL) */
  if (g.kind === 'cmr') return fs6(locale, g.cmr ? (canStatus ? 'p6c_rti_cmr_ok' : 'p6c_rti_cmr_ok_ro') : 'p6c_rti_cmr_wait');
  if (g.missing.length === 2) return fs6(locale, 'p6c_inv_both');
  if (g.missing.length === 1) return fs6p(locale, 'p6c_inv_one', { list: t(locale, `scm_inv_${g.missing[0]}`) });
  const shown = g.rows.filter((r) => !r.hidden && r.bill);
  /* SCX i KSH widzą tylko swoją fakturę — „dołączona”, bez obietnicy o drugiej (sprawdzi baza przy zapisie) */
  if (g.rows.some((r) => r.hidden)) return shown.length ? fs6p(locale, 'p6c_inv_mine', { list: shown.map((r) => t(locale, `scm_inv_${r.dir}`)).join(' · ') }) : null;
  return fs6(locale, canStatus ? 'p6c_inv_ok' : 'p6c_inv_ok_ro');
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function rowName(r: AxisRow, locale: Locale): string {
  return r.statuses.map((s) => statusLabel(s, undefined, locale)).join(' · ');
}

function rowSub(
  r: AxisRow,
  load: Pick<Load, 'resources'>,
  geofences: readonly Pick<Geofence, 'id' | 'name'>[],
  hits: Map<LoadStatus, AxisHit | null>,
  phone: boolean,
  locale: Locale,
  readyGaps: readonly ReadyGap[] | null,
  settle: ((s: LoadStatus) => string | null) | null,
): string | null {
  const s = r.statuses[0];
  if (r.kind === 'skipped') {
    if (r.skipWhy === 'complete') return t(locale, 'p4b_skip_complete');
    if (r.skipWhy === 'trackerSe' || r.skipWhy === 'trackerPl') {
      const side = r.skipWhy === 'trackerSe' ? 'se' : 'pl';
      return t(locale, `p4b_skip_${r.skipTracker === 'trailer' ? 'trailer' : 'tracker'}_${side}`);
    }
    return t(locale, 'p4b_skip');
  }
  if (r.kind === 'pending') {
    /* wyglad/P4-c (L6, L9, L29): czego brakuje do „Gotowy” */
    if (s === 'READY' && readyGaps?.length) return tp(locale, 'p4c_ready_axis', { list: readyGapsText(readyGaps, locale).list });
    if ((s === 'READY_TO_INVOICE' || s === 'INVOICED') && settle) {
      const txt = settle(s);
      if (txt) return txt;
    }
    if (s === 'READY_TO_INVOICE') return t(locale, phone ? 'p4b_sub_rti_wait_ph' : 'p4b_sub_rti_wait');
    if (s === 'INVOICED') return phone ? null : t(locale, 'p4b_sub_inv_wait');
    return null;
  }
  const h = r.hit;
  if (!h) return null;
  if (h.source === 'import') return t(locale, 'p4b_sub_import');
  /* B5: zapis w Podglądzie — ten sam autor co w Historii („… jako … // KSH”) */
  const actor = h.previewAs && h.actor ? `${whoOf(h.actor, locale)} ${ht(locale, 'p6b_as')} ${whoOf(h.previewAs, locale)}` : axisActor(h.actor);
  if (h.source === 'manual') {
    const parts = [h.note, actor].filter(Boolean) as string[];
    if (s === 'DELIVERED') parts.push(t(locale, 'p4b_sub_delivered'));
    return parts.length ? parts.join(' · ') : null;
  }
  /* automat */
  if (h.phaseInfer) {
    const side = ['AT_PORT_SE', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'DELIVERED'].includes(s) ? 'se' : 'pl';
    const plate = (load.resources.trailerPlate ?? '').trim();
    if (/naczep/i.test(h.why ?? '') && plate) return tp(locale, `p4b_sub_infer_trailer_${side}`, { plate });
    return t(locale, `p4b_sub_infer_tracker_${side}`);
  }
  if (s === 'APPROACHING_SITE' && h.geofenceId) {
    const zone = geofences.find((g) => g.id === h.geofenceId)?.name;
    if (zone) return tp(locale, 'p4b_sub_enter', { zone });
  }
  if (s === 'DELIVERED') {
    const site = hits.get('APPROACHING_SITE');
    if (site && isoMs(site.at) < isoMs(h.at)) {
      const dur = hoursMinutes(Date.parse(h.at) - Date.parse(site.at));
      return tp(locale, phone ? 'p4b_sub_delivered_auto_ph' : 'p4b_sub_delivered_auto', { dur });
    }
    return t(locale, 'p4b_sub_delivered');
  }
  if (h.why) return cap(h.why);
  return h.note ?? (actor || null);
}

export function StatusAxisTab({
  load,
  events,
  geofences,
  locale,
  phone,
  canStatus,
  onChange,
  readyGaps = null,
  top = null,
  marks = null,
  role = null,
  documents = [],
  bills = [],
}: {
  load: Pick<Load, 'id' | 'status' | 'stage' | 'unloadedAt' | 'resources' | 'plannedLoadDate' | 'plannedDeliverDate'>;
  events: readonly LoadEvent[];
  geofences: readonly Pick<Geofence, 'id' | 'name'>[];
  locale: Locale;
  phone: boolean;
  canStatus: boolean;
  onChange: () => void;
  /** wyglad/P4-c — braki do „Gotowy” (L6, L9, L29) */
  readyGaps?: readonly ReadyGap[] | null;
  /** wyglad/P4-c — sprawa nad osią (E26 pkt 4, L14) */
  top?: ReactNode;
  /** wyglad/P6-c (E17) — oznaczenia przy aktualnym statusie (Opóźniony, Brak GPS, Brak dokumentów) */
  marks?: ReactNode;
  /** wyglad/P6-c (E17) — rozliczenie z dokumentów i faktur widocznych dla firmy */
  role?: OrgKind | null;
  documents?: readonly Document[];
  bills?: readonly Bill[];
}) {
  const axis = buildStatusAxis(load, events);
  const milestones = axisMilestones(axis, events, geofences);
  /* po dostawie: rozliczenie z danych firmy (A5); wcześniej — dotychczasowe zdania */
  const afterDelivery = axis.current === 'DELIVERED' || axis.current === 'READY_TO_INVOICE' || axis.current === 'INVOICED';
  const settle = role && afterDelivery ? (s: LoadStatus) => settleText(s, load.id, role, documents, bills, canStatus, locale) : null;
  /* telefon: „Przygotowanie” rozwinięte, gdy transport jeszcze w nim jest (widać „Brakuje: …” przy „Gotowy”) */
  const [prepOpen, setPrepOpen] = useState(() => axis.groups.find((g) => g.key === 'prep')?.rows.some((r) => r.kind === 'current') ?? false);
  const hits = new Map<LoadStatus, AxisHit | null>();
  for (const g of axis.groups) for (const r of g.rows) if (r.hit) hits.set(r.statuses[0], r.hit);
  const order = phone ? (['route', 'after', 'prep'] as const) : (['prep', 'route', 'after'] as const);
  const cancelEv = axis.cancelled
    ? [...events].filter((e) => e.type === 'STATUS_CANCELLED').sort((a, b) => isoMs(b.at) - isoMs(a.at))[0]
    : undefined;

  return (
    <div className="sax" data-status-axis>
      {top}
      {axis.cancelled ? (
        <div className="sax-cancel" data-axis-cancelled>
          <b>{t(locale, 'p4b_cancelled')}</b>
          {cancelEv ? <span> · {dayTime(cancelEv.at)}{cancelEv.note ? ` · ${cancelEv.note}` : ''}</span> : null}
        </div>
      ) : null}
      {order.map((key) => {
        const g = axis.groups.find((x) => x.key === key)!;
        const collapsed = phone && key === 'prep' && !prepOpen;
        return (
          <section key={key} className="sax-grp" data-axis-group={key}>
            <div className="sax-gh">
              <span>{t(locale, `p4b_g_${key}`)}</span>
              {phone && key === 'prep' ? (
                <button type="button" className="sax-more" aria-expanded={prepOpen} onClick={() => setPrepOpen((v) => !v)}>
                  {t(locale, prepOpen ? 'p4b_g_collapse' : 'p4b_g_expand')}
                </button>
              ) : (
                <span className="sax-gr">{t(locale, key === 'route' && phone ? 'p4b_g_route_r_ph' : `p4b_g_${key}_r`)}</span>
              )}
            </div>
            {collapsed ? null : (
              <ol className="sax-list">
                {g.rows.map((r) => {
                  const sub0 = rowSub(r, load, geofences, hits, phone, locale, readyGaps, settle);
                  /* bez powtórzenia nazwy („Na promie · Na promie”) */
                  const sub = sub0 && sub0.trim().toLocaleLowerCase('pl') !== rowName(r, locale).toLocaleLowerCase('pl') ? sub0 : null;
                  const waiting = r.kind === 'pending' && r.statuses[0] === 'READY_TO_INVOICE' && axis.current === 'DELIVERED';
                  /* E17: źródło przy statusie — IMPORT / RĘCZNIE / GPS / AIS (AUTO, gdy automat nie podał źródła) */
                  const tag = r.hit && (r.kind === 'done' || r.kind === 'current')
                    ? r.hit.source === 'manual' ? 'manual' : r.hit.source === 'import' ? 'IMPORT' : r.hit.channel ?? 'auto'
                    : null;
                  const key = r.statuses.join(' ');
                  const ms = r.kind === 'done' || r.kind === 'current' ? milestones.get(key) ?? [] : [];
                  /* plan: przy osiągniętym statusie z różnicą; pominięty Załadunek — „plan zał.”; przyszły — „plan” */
                  const planSt = r.statuses.find((x) => x === 'LOADING' || x === 'APPROACHING_SITE') ?? null;
                  const plan = planSt ? planNote(planSt, r.kind === 'done' || r.kind === 'current' ? r.hit?.at ?? null : null, load) : null;
                  const planTxt = plan ? planText(plan, locale, (r.kind === 'done' || r.kind === 'current') && !!r.hit) : null;
                  const late = plan?.diff != null && plan.diff > 0;
                  return (
                    <li key={r.statuses.join('-')} className={`sax-row ${r.kind}`} data-axis-row={r.statuses.join(' ')} data-axis-kind={r.kind}>
                      <span className="sax-mk" aria-hidden />
                      <div className="sax-main">
                        <div className="sax-nm">
                          <span className="sax-name">{rowName(r, locale)}</span>
                          {tag ? (
                            <span className={`sax-tag ${tag === 'manual' ? 'manual' : 'auto'}`} data-axis-src={tag}>
                              {tag === 'manual' ? t(locale, 'p4b_tag_manual') : tag === 'auto' ? t(locale, 'p4b_tag_auto') : fs6(locale, `p6c_tag_${tag}`)}
                            </span>
                          ) : null}
                          {r.kind === 'current' && marks ? <span className="sax-marks" data-axis-marks>{marks}</span> : null}
                        </div>
                        {sub ? <div className="sax-sub">{sub}</div> : null}
                        {ms.length ? (
                          <ul className="sax-ms" role="list" data-axis-ms={key}>
                            {ms.map((m) => (
                              <li key={`${m.at}-${m.kind}-${m.zone}`}>
                                {dayOnly(m.at) === dayOnly(r.hit?.at ?? null) ? timeOnly(m.at) : dayTime(m.at)} · {fs6p(locale, `p6c_ms_${m.kind}`, { zone: m.zone })}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div className="sax-ts">
                        {r.hit && r.kind !== 'pending' ? (
                          phone ? (
                            <>
                              <span>{dayOnly(r.hit.at)}</span>
                              <span>{timeOnly(r.hit.at)}</span>
                            </>
                          ) : (
                            dayTime(r.hit.at)
                          )
                        ) : waiting ? (
                          t(locale, 'p4b_waiting')
                        ) : planTxt ? null : (
                          '—'
                        )}
                        {planTxt ? <span className={`sax-plan${late ? ' late' : ''}`} data-axis-plan={plan?.diff ?? ''}>{planTxt}</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
      <div className="sax-ft">
        {/* telefon: sam przycisk na całą szerokość (img/e25-after); kto zmienia — gdy przycisku nie ma */}
        {phone && canStatus ? null : <span className="sax-who">{fs6(locale, 'p6c_legend')} {t(locale, 'p4b_who')}</span>}
        {canStatus ? (
          <button type="button" className="btn ghost sax-change" data-action="change-status" onClick={onChange}>
            {t(locale, 'p4b_change')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
