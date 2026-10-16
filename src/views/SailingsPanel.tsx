/**
 * Harmonogram › Rejsy — M10 (dodanie, opóźnienie, odwołanie: tylko Administrator HHL, B-REJSY / E9 19:11)
 * w wyglądzie E30 pkt 7 (wyglad/P7-d, makieta `makiety_html/E30/harm.html`, raport `img/e30-after`):
 * domyślnie przyszłe rejsy do Szwecji, „Pokaż powroty”, kolumny Odejście · Statek · Trasa · Przypłynięcie · Źródło
 * · Transporty (kody — kliknięcie filtruje Harmonogram), pod tabelą zasięg rozkładów. Telefon: karty (E8).
 */
import { useMemo, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { sv, svp } from '../i18n/sail7';
import { getNowIso } from '../lib/frozenNow';
import { effArrival, effDeparture } from '../lib/sailings';
import { ROUTE_SHORT, reachOf, sailDay, sailRows, sailTime, sourceKey, type SailRow } from '../lib/sailView';
import { TZ_OPS, isoToDatetimeLocalValue, wallLocalToIso } from '../lib/time';
import { POLFERRIES_ATTRIBUTION } from '../lib/ferry/polferries';
import { getAuthProfile } from '../auth/profile';
import { PROD_BUILD } from '../lib/prodFacade';
import '../components/schedule/sail7.css';

const VESSELS = ['Wawel', 'Nova Star', 'Stena Spirit', 'Stena Estelle', 'Stena Ebba'] as const;

export function SailingsPanel({ phone = false, onShowLoads }: { phone?: boolean; onShowLoads?: (sailingId: string) => void }) {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const sailings = useTowerStore((s) => s.sailings);
  const loads = useTowerStore((s) => s.loads);
  const addSailing = useTowerStore((s) => s.addSailing);
  const delaySailing = useTowerStore((s) => s.delaySailing);
  const cancelSailing = useTowerStore((s) => s.cancelSailing);
  const pushToast = useTowerStore((s) => s.pushToast);
  const now = getNowIso();
  // B-REJSY: ręczna edycja tylko administrator (HHL_ADMIN); w demo — rola HHL.
  const canEditSailings = PROD_BUILD
    ? getAuthProfile()?.role === 'HHL_ADMIN'
    : role === 'HHL';

  /* E30 pkt 7: domyślnie przyszłe i tylko do Szwecji */
  const [future, setFuture] = useState(true);
  const [returns, setReturns] = useState(false);
  const [adding, setAdding] = useState(false);
  const [delayId, setDelayId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(() => sailRows(sailings, loads, now, { future, returns }), [sailings, loads, now, future, returns]);
  const reach = useMemo(() => reachOf(sailings), [sailings]);
  const reachLine = reach.length
    ? svp(locale, 'sv_reach', { list: reach.map((r) => svp(locale, 'sv_reach_item', { line: sv(locale, `sv_reach_${r.line}`), date: sailDay(r.untilIso, now) })).join(', ') })
    : null;

  const pills = (r: SailRow) => (
    <>
      {r.sailing.status === 'ODWOLANY' ? <span className="pill p-red">{sv(locale, 'sv_st_cancelled')}</span> : null}
      {r.sailing.status !== 'ODWOLANY' && (r.delayed || r.sailing.status === 'OPOZNIONY') ? <span className="pill p-amber">{sv(locale, 'sv_st_delayed')}</span> : null}
      {r.sailing.status !== 'ODWOLANY' && r.gone ? <span className="pill p-plan">{sv(locale, 'sv_st_gone')}</span> : null}
    </>
  );
  const depCell = (r: SailRow) => (r.sailing.delayedDepartureAt
    ? <><s className="sv-was">{sailTime(r.sailing.departureAt, now)}</s> {sailTime(r.dep, now)}</>
    : sailTime(r.dep, now));
  const arrCell = (r: SailRow) => (r.sailing.delayedArrivalAt
    ? <><s className="sv-was">{sailTime(r.sailing.arrivalAt, now)}</s> {sailTime(r.arr, now)}</>
    : sailTime(r.arr, now));
  const codesBtn = (r: SailRow) => (r.codes.length
    ? (
      <button type="button" className="sv-codes" data-sail-loads={r.sailing.id} title={sv(locale, 'sv_loads_title')} onClick={() => onShowLoads?.(r.sailing.id)}>
        {r.codes.join(', ')}
      </button>
    )
    : <span className="sv-dash">—</span>);
  const canAct = (r: SailRow) => canEditSailings && r.sailing.status !== 'ODWOLANY' && !r.gone;
  const actions = (r: SailRow) => (
    <>
      <button type="button" className="chipbtn" data-sail-delay={r.sailing.id} onClick={() => setDelayId(delayId === r.sailing.id ? null : r.sailing.id)}>{t(locale, 'sail_delay')}</button>
      <button
        type="button"
        className="chipbtn"
        data-sail-cancel={r.sailing.id}
        onClick={() => { if (cancelSailing(r.sailing.id)) pushToast(`${t(locale, 'sail_cancelled')} · ${r.sailing.vessel} ${sailTime(r.sailing.departureAt, now)}`, 'HIGH'); }}
      >
        {t(locale, 'sail_cancel')}
      </button>
    </>
  );

  return (
    <div className="panel-bd flush sv" data-sailings>
      <div className="filters sv-bar">
        <button type="button" className="chipbtn" aria-pressed={future} data-sail-future onClick={() => setFuture((v) => !v)}>
          {sv(locale, 'sv_future')}
        </button>
        <button type="button" className="chipbtn" aria-pressed={returns} data-sail-returns onClick={() => setReturns((v) => !v)}>
          {sv(locale, 'sv_returns')}
        </button>
        <div className="spacer" />
        {canEditSailings ? (
          <button type="button" className="btn" data-sail-new onClick={() => { setAdding((v) => !v); setErr(null); }}>
            {t(locale, 'sail_add')}
          </button>
        ) : null}
      </div>

      {canEditSailings && adding ? (
        <form
          data-sail-form
          className="sv-form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const routeRaw = String(fd.get('route') || 'GDN-NYN');
            const route =
              routeRaw === 'NYN-GDN' ? 'NYN-GDN'
                : routeRaw === 'GDY-KAA' ? 'GDY-KAA'
                  : routeRaw === 'KAA-GDY' ? 'KAA-GDY'
                    : 'GDN-NYN';
            const r = addSailing({
              vessel: String(fd.get('vessel') || ''),
              route,
              departureAt: wallLocalToIso(String(fd.get('dep') || ''), TZ_OPS) ?? '',
              arrivalAt: wallLocalToIso(String(fd.get('arr') || ''), TZ_OPS) ?? '',
            });
            if (r.ok) { setAdding(false); setErr(null); pushToast(t(locale, 'sail_added'), 'MEDIUM'); } else setErr(t(locale, `sail_err_${r.error}`));
          }}
        >
          <dl className="kv">
            <dt>{t(locale, 'sail_col_vessel')}</dt>
            <dd>
              <select name="vessel" className="input" defaultValue="Wawel">
                {VESSELS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </dd>
            <dt>{t(locale, 'sail_col_route')}</dt>
            <dd>
              <select name="route" className="input" defaultValue="GDN-NYN">
                <option value="GDN-NYN">Gdańsk → Nynäshamn</option>
                <option value="GDY-KAA">Gdynia → Karlskrona</option>
                <option value="NYN-GDN">Nynäshamn → Gdańsk</option>
                <option value="KAA-GDY">Karlskrona → Gdynia</option>
              </select>
            </dd>
            <dt>{t(locale, 'sail_col_dep')} / {t(locale, 'sail_col_arr')}</dt>
            <dd className="sv-times">
              <input name="dep" type="datetime-local" className="input" aria-label={t(locale, 'sail_col_dep')} required />
              <input name="arr" type="datetime-local" className="input" aria-label={t(locale, 'sail_col_arr')} required />
            </dd>
          </dl>
          <div className="filters sv-form-ft">
            <span className="sv-muted">{t(locale, 'sail_time_note')}</span>
            <div className="spacer" />
            <button type="button" className="chipbtn" onClick={() => setAdding(false)}>{t(locale, 'bill_cancel')}</button>
            <button type="submit" className="btn" data-sail-submit>{t(locale, 'sail_save')}</button>
          </div>
          {err ? <div className="note sv-err" data-sail-error>{err}</div> : null}
        </form>
      ) : null}

      {canEditSailings && delayId ? (() => {
        const s = sailings.find((x) => x.id === delayId);
        if (!s) return null;
        return (
          <form
            data-sail-delay-form
            className="sv-form"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const ok = delaySailing(s.id, wallLocalToIso(String(fd.get('dep') || ''), TZ_OPS) ?? '', wallLocalToIso(String(fd.get('arr') || ''), TZ_OPS) ?? '');
              if (ok) { setDelayId(null); pushToast(`${t(locale, 'sail_delayed')} · ${s.vessel}`, 'MEDIUM'); } else pushToast(t(locale, 'sail_err_ORDER'), 'HIGH');
            }}
          >
            <h4 className="sec">{t(locale, 'sail_delay')} · {s.vessel} {sailTime(s.departureAt, now)}</h4>
            <dl className="kv">
              <dt>{t(locale, 'sail_new_times')}</dt>
              <dd className="sv-times">
                <input name="dep" type="datetime-local" className="input" aria-label={t(locale, 'sail_col_dep')} defaultValue={isoToDatetimeLocalValue(effDeparture(s), TZ_OPS)} required />
                <input name="arr" type="datetime-local" className="input" aria-label={t(locale, 'sail_col_arr')} defaultValue={isoToDatetimeLocalValue(effArrival(s), TZ_OPS)} required />
              </dd>
            </dl>
            <div className="filters sv-form-ft">
              <div className="spacer" />
              <button type="button" className="chipbtn" onClick={() => setDelayId(null)}>{t(locale, 'bill_cancel')}</button>
              <button type="submit" className="btn" data-sail-delay-submit>{t(locale, 'sail_save')}</button>
            </div>
          </form>
        );
      })() : null}

      {rows.length === 0 ? (
        <div className="empty" data-sail-empty><p>{sv(locale, future && !returns ? 'sv_none_future' : 'sv_none')}</p></div>
      ) : phone ? (
        <ul className="sv-cards" data-sail-cards>
          {rows.map((r) => (
            <li key={r.sailing.id} className={`sv-card${r.sailing.status === 'ODWOLANY' ? ' is-off' : ''}`} data-sailing={r.sailing.id} data-sail-status={r.sailing.status}>
              <div className="sv-c1"><b>{depCell(r)}</b><span>· {r.sailing.vessel}</span>{pills(r)}</div>
              <div className="sv-c2">{ROUTE_SHORT[r.sailing.route]} · {svp(locale, 'sv_arr', { t: sailTime(r.arr, now) })}</div>
              <div className="sv-c3"><span>{sv(locale, sourceKey(r.sailing.source))}</span><span>·</span><span>{sv(locale, 'sv_loads_l')}</span>{codesBtn(r)}</div>
              {canAct(r) ? <div className="sv-acts">{actions(r)}</div> : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="tablewrap">
          <table className="sv-tbl">
            <thead>
              <tr>
                <th>{t(locale, 'sail_col_dep')}</th>
                <th>{t(locale, 'sail_col_vessel')}</th>
                <th>{t(locale, 'sail_col_route')}</th>
                <th>{t(locale, 'sail_col_arr')}</th>
                <th>{t(locale, 'sail_col_source')}</th>
                <th>{t(locale, 'sail_col_loads')}</th>
                {canEditSailings ? <th className="sv-act-h" aria-label={t(locale, 'sail_delay')} /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sailing.id} className={r.sailing.status === 'ODWOLANY' ? 'is-off' : undefined} data-sailing={r.sailing.id} data-sail-status={r.sailing.status}>
                  <td className="sv-time"><span className="sv-dep">{depCell(r)}</span>{pills(r)}</td>
                  <td>{r.sailing.vessel}</td>
                  <td className="sv-route">{ROUTE_SHORT[r.sailing.route]}</td>
                  <td className="sv-time">{arrCell(r)}</td>
                  <td data-sail-source={r.sailing.source}>{sv(locale, sourceKey(r.sailing.source))}</td>
                  <td>{codesBtn(r)}</td>
                  {canEditSailings ? <td className="sv-act">{canAct(r) ? actions(r) : null}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="note sv-foot">
        {reachLine ? <span data-sail-reach>{reachLine}</span> : null}
        <span>{sv(locale, canEditSailings ? 'sv_note_admin' : 'sv_note_ro')}</span>
        {sailings.some((s) => s.source === 'POLFERRIES') ? <span data-attribution="polferries">{POLFERRIES_ATTRIBUTION}</span> : null}
      </div>
    </div>
  );
}
