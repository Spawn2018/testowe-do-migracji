/**
 * wyglad/P4-b — zakładka „Status” w panelu transportu (E25, img/e25-after, makieta E25/statusy.html).
 * Oś 14 statusów (nazwy z jednego słownika `statusLabel`, E25) w trzech grupach z godziną zdarzenia, AUTO / RĘCZNIE, autorem i przyczyną; przeskoki jako „pominięte”.
 * Telefon: najpierw „W trasie” i „Rozliczenie”, „Przygotowanie” zwinięte.
 * Stopka: kto zmienia + „Zmień status” (SCX i administrator HHL, decyzja 17:46). Okno — `StatusChangeModal`.
 */
import { useState } from 'react';
import type { Geofence, Load, LoadEvent, LoadStatus, Locale } from '../../types';
import { t, tp } from '../../i18n/messages';
import { statusLabel } from '../../lib/statusLabel';
import { axisActor, buildStatusAxis, dayOnly, dayTime, hoursMinutes, isoMs, timeOnly, type AxisHit, type AxisRow } from '../../lib/statusAxis';

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
    if (s === 'READY_TO_INVOICE') return t(locale, phone ? 'p4b_sub_rti_wait_ph' : 'p4b_sub_rti_wait');
    if (s === 'INVOICED') return phone ? null : t(locale, 'p4b_sub_inv_wait');
    return null;
  }
  const h = r.hit;
  if (!h) return null;
  if (h.source === 'import') return t(locale, 'p4b_sub_import');
  const actor = axisActor(h.actor);
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
}: {
  load: Pick<Load, 'status' | 'stage' | 'unloadedAt' | 'resources'>;
  events: readonly LoadEvent[];
  geofences: readonly Pick<Geofence, 'id' | 'name'>[];
  locale: Locale;
  phone: boolean;
  canStatus: boolean;
  onChange: () => void;
}) {
  const [prepOpen, setPrepOpen] = useState(false);
  const axis = buildStatusAxis(load, events);
  const hits = new Map<LoadStatus, AxisHit | null>();
  for (const g of axis.groups) for (const r of g.rows) if (r.hit) hits.set(r.statuses[0], r.hit);
  const order = phone ? (['route', 'after', 'prep'] as const) : (['prep', 'route', 'after'] as const);
  const cancelEv = axis.cancelled
    ? [...events].filter((e) => e.type === 'STATUS_CANCELLED').sort((a, b) => isoMs(b.at) - isoMs(a.at))[0]
    : undefined;

  return (
    <div className="sax" data-status-axis>
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
                  const sub0 = rowSub(r, load, geofences, hits, phone, locale);
                  /* bez powtórzenia nazwy („Na promie · Na promie”) */
                  const sub = sub0 && sub0.trim().toLocaleLowerCase('pl') !== rowName(r, locale).toLocaleLowerCase('pl') ? sub0 : null;
                  const waiting = r.kind === 'pending' && r.statuses[0] === 'READY_TO_INVOICE' && axis.current === 'DELIVERED';
                  const tag = r.hit && (r.kind === 'done' || r.kind === 'current') && r.hit.source !== 'import'
                    ? r.hit.source === 'manual' ? 'manual' : 'auto'
                    : null;
                  return (
                    <li key={r.statuses.join('-')} className={`sax-row ${r.kind}`} data-axis-row={r.statuses.join(' ')} data-axis-kind={r.kind}>
                      <span className="sax-mk" aria-hidden />
                      <div className="sax-main">
                        <div className="sax-nm">
                          <span className="sax-name">{rowName(r, locale)}</span>
                          {tag ? <span className={`sax-tag ${tag}`}>{t(locale, tag === 'manual' ? 'p4b_tag_manual' : 'p4b_tag_auto')}</span> : null}
                        </div>
                        {sub ? <div className="sax-sub">{sub}</div> : null}
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
                        ) : (
                          '—'
                        )}
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
        {phone && canStatus ? null : <span className="sax-who">{t(locale, 'p4b_who')}</span>}
        {canStatus ? (
          <button type="button" className="btn ghost sax-change" data-action="change-status" onClick={onChange}>
            {t(locale, 'p4b_change')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
