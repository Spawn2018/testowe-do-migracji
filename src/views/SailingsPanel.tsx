/**
 * M10 — rozkład rejsów Gdańsk ⇄ Nynäshamn (STATUSY_AUTOMATYCZNE §4). Widzą wszystkie trzy strony,
 * zmienia HHL: dodanie, opóźnienie (nowy czas odejścia i przypłynięcia), odwołanie.
 * Źródło statusu Polferries — decyzja właściciela; do tego czasu dane startowe + ręcznie.
 * Wzorce makiety: tablewrap / kv / pill / filters / note / btn / chipbtn.
 */
import { useMemo, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { getNowIso } from '../lib/frozenNow';
import { effArrival, effDeparture, fmtLocal, hasDeparted, sailingStatusLabel, sailingStatusPill } from '../lib/sailings';
import { TZ_OPS, isoToDatetimeLocalValue, wallLocalToIso } from '../lib/time';
import type { Sailing } from '../types';
import { POLFERRIES_ATTRIBUTION } from '../lib/ferry/polferries';

const VESSELS = ['Wawel', 'Nova Star', 'Stena Spirit', 'Stena Estelle', 'Stena Ebba'] as const;

export function SailingsPanel() {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const sailings = useTowerStore((s) => s.sailings);
  const loads = useTowerStore((s) => s.loads);
  const addSailing = useTowerStore((s) => s.addSailing);
  const delaySailing = useTowerStore((s) => s.delaySailing);
  const cancelSailing = useTowerStore((s) => s.cancelSailing);
  const pushToast = useTowerStore((s) => s.pushToast);
  const isHhl = role === 'HHL';
  const now = getNowIso();

  const [showPast, setShowPast] = useState(false);
  const [adding, setAdding] = useState(false);
  const [delayId, setDelayId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(() => {
    const dayAgo = Date.parse(now) - 864e5;
    return [...sailings]
      .filter((s) => showPast || Date.parse(effArrival(s)) >= dayAgo)
      .sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b)));
  }, [sailings, showPast, now]);
  const countFor = (s: Sailing) => loads.filter((l) => l.sailingId === s.id).length;

  return (
    <div className="panel-bd flush" data-sailings>
      <div className="filters">
        <span>{t(locale, 'sail_source_note')}</span>
        <div className="spacer" />
        <button type="button" className="chipbtn" aria-pressed={showPast} data-sail-past onClick={() => setShowPast((v) => !v)}>
          {t(locale, 'sail_show_past')}
        </button>
        {isHhl ? (
          <button type="button" className="btn" data-sail-new onClick={() => { setAdding((v) => !v); setErr(null); }}>
            {t(locale, 'sail_add')}
          </button>
        ) : null}
      </div>

      {isHhl && adding ? (
        <form
          data-sail-form
          style={{ padding: '10px 13px' }}
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
                <option value="NYN-GDN">Nynäshamn → Gdańsk</option>
                <option value="GDY-KAA">Gdynia → Karlskrona</option>
                <option value="KAA-GDY">Karlskrona → Gdynia</option>
              </select>
            </dd>
            <dt>{t(locale, 'sail_col_dep')} / {t(locale, 'sail_col_arr')}</dt>
            <dd>
              <input name="dep" type="datetime-local" className="input" style={{ width: '48%' }} required />{' '}
              <input name="arr" type="datetime-local" className="input" style={{ width: '48%' }} required />
            </dd>
          </dl>
          <div className="filters" style={{ padding: '8px 0 0' }}>
            <span style={{ color: 'var(--ink-3)' }}>{t(locale, 'sail_time_note')}</span>
            <div className="spacer" />
            <button type="button" className="chipbtn" onClick={() => setAdding(false)}>{t(locale, 'bill_cancel')}</button>
            <button type="submit" className="btn" data-sail-submit>{t(locale, 'sail_save')}</button>
          </div>
          {err ? <div className="note" data-sail-error style={{ color: 'var(--red)', margin: '8px -13px -10px' }}>{err}</div> : null}
        </form>
      ) : null}

      {isHhl && delayId ? (() => {
        const s = sailings.find((x) => x.id === delayId);
        if (!s) return null;
        return (
          <form
            data-sail-delay-form
            style={{ padding: '10px 13px' }}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const ok = delaySailing(s.id, wallLocalToIso(String(fd.get('dep') || ''), TZ_OPS) ?? '', wallLocalToIso(String(fd.get('arr') || ''), TZ_OPS) ?? '');
              if (ok) { setDelayId(null); pushToast(`${t(locale, 'sail_delayed')} · ${s.vessel}`, 'MEDIUM'); } else pushToast(t(locale, 'sail_err_ORDER'), 'HIGH');
            }}
          >
            <h4 className="sec">{t(locale, 'sail_delay')} · {s.vessel} {fmtLocal(s.departureAt)}</h4>
            <dl className="kv">
              <dt>{t(locale, 'sail_new_times')}</dt>
              <dd>
                <input name="dep" type="datetime-local" className="input" style={{ width: '48%' }} defaultValue={isoToDatetimeLocalValue(effDeparture(s), TZ_OPS)} required />{' '}
                <input name="arr" type="datetime-local" className="input" style={{ width: '48%' }} defaultValue={isoToDatetimeLocalValue(effArrival(s), TZ_OPS)} required />
              </dd>
            </dl>
            <div className="filters" style={{ padding: '8px 0 0' }}>
              <div className="spacer" />
              <button type="button" className="chipbtn" onClick={() => setDelayId(null)}>{t(locale, 'bill_cancel')}</button>
              <button type="submit" className="btn" data-sail-delay-submit>{t(locale, 'sail_save')}</button>
            </div>
          </form>
        );
      })() : null}

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>{t(locale, 'sail_col_vessel')}</th>
              <th>{t(locale, 'sail_col_route')}</th>
              <th>{t(locale, 'sail_col_dep')}</th>
              <th>{t(locale, 'sail_col_arr')}</th>
              <th>{t(locale, 'sail_col_status')}</th>
              <th>{t(locale, 'sail_col_source')}</th>
              <th className="num">{t(locale, 'sail_col_loads')}</th>
              {isHhl ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const delayed = s.delayedDepartureAt != null;
              const gone = hasDeparted(s, now);
              return (
                <tr key={s.id} data-sailing={s.id} data-sail-status={s.status}>
                  <td><b>{s.vessel}</b></td>
                  <td className="mono">{
                    s.route === 'GDN-NYN' ? 'GDN → NYN'
                      : s.route === 'NYN-GDN' ? 'NYN → GDN'
                        : s.route === 'GDY-KAA' ? 'GDY → KAA'
                          : 'KAA → GDY'
                  }</td>
                  <td className="mono">
                    {delayed ? <><s style={{ color: 'var(--ink-3)' }}>{fmtLocal(s.departureAt)}</s> {fmtLocal(effDeparture(s))}</> : fmtLocal(s.departureAt)}
                  </td>
                  <td className="mono">
                    {s.delayedArrivalAt ? <><s style={{ color: 'var(--ink-3)' }}>{fmtLocal(s.arrivalAt)}</s> {fmtLocal(effArrival(s))}</> : fmtLocal(s.arrivalAt)}
                  </td>
                  <td>
                    <span className={`pill ${sailingStatusPill(s.status)}`}>{sailingStatusLabel(s.status, locale)}</span>
                    {gone && s.status !== 'ODWOLANY' ? <> <span className="pill p-plan">{t(locale, 'sail_departed')}</span></> : null}
                  </td>
                  <td data-sail-source={s.source} style={{ color: 'var(--ink-3)' }}>{t(locale, `sail_src_${s.source}`)}</td>
                  <td className="num">{countFor(s)}</td>
                  {isHhl ? (
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {s.status !== 'ODWOLANY' && !gone ? (
                        <>
                          <button type="button" className="chipbtn" data-sail-delay={s.id} onClick={() => setDelayId(delayId === s.id ? null : s.id)}>{t(locale, 'sail_delay')}</button>{' '}
                          <button
                            type="button"
                            className="chipbtn"
                            data-sail-cancel={s.id}
                            onClick={() => { if (cancelSailing(s.id)) pushToast(`${t(locale, 'sail_cancelled')} · ${s.vessel} ${fmtLocal(s.departureAt)}`, 'HIGH'); }}
                          >
                            {t(locale, 'sail_cancel')}
                          </button>
                        </>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="note">
        {t(locale, isHhl ? 'sail_note_hhl' : 'sail_note_ro')}
        {sailings.some((s) => s.source === 'POLFERRIES') ? <span data-attribution="polferries"> · {POLFERRIES_ATTRIBUTION}</span> : null}
      </div>
    </div>
  );
}
