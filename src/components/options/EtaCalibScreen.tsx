/**
 * wyglad/W-eta — Opcje › Zasady transportu › Kalibracja ETA (E15 pkt 7, decyzja właściciela 07.10 22:15; 3A 17.10;
 * audyt 17.10 sekcja 08 N6). HHL widzi, czy ETA się poprawia, i zatwierdza nowe czasy odcinków jednym kliknięciem.
 * Trzy części: pomiary dostaw (błąd ETA 24 h, 6 h i 1 h przed przyjazdem; czasy odcinków), propozycja czasów odcinków
 * (po 5 dostawach; mediana z rozrzutem; ≤ 10 % — bez zmian), wersje czasów. Bez zatwierdzenia nic się nie zmienia.
 * Dane: `etaCalibSource.ts` (kody odcinków jak `eta_segment_params`).
 */
import { useState, type ReactNode } from 'react';
import type { Locale } from '../../types';
import { t, tp } from '../../i18n/messages';
import { formatListDateTime } from '../../lib/format';
import { etaDuration } from '../../lib/etaDuration';
import type { CalibApprove, CalibErr, CalibSegment, CalibVersion, EtaCalibration } from '../../lib/etaCalibSource';
import './etaCalib.css';

/** Cel z odbioru E15: błąd godzinę przed przyjazdem ≤ 30 min. */
const GOAL_MIN = 30;

const dur = (m: number | null | undefined) => (m == null ? '–' : etaDuration(m));
function errText(e: CalibErr): string {
  if (e == null) return '–';
  if (e === 0) return '0 min';
  return `${e > 0 ? '+' : '−'}${etaDuration(Math.abs(e))}`;
}
function errTone(e: CalibErr): string {
  if (e == null) return '';
  const a = Math.abs(e);
  return a <= GOAL_MIN ? 'ox-go' : a <= 60 ? 'cal-amber' : 'ox-alert';
}
const pct = (p: number) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}\u00a0%`;
const meanAbs = (xs: Array<number | null>) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round(v.reduce((s, x) => s + Math.abs(x), 0) / v.length) : null;
};
const dayOf = (iso: string) => formatListDateTime(iso).split(', ')[0];

export function EtaCalibScreen({ locale, data, readOnly, onApprove, mark }: {
  locale: Locale;
  data: EtaCalibration;
  readOnly?: boolean;
  /** „Zatwierdź nowe czasy”; `null` — zapis nie podłączony albo konto bez prawa zmiany. */
  onApprove: CalibApprove | null;
  mark?: ReactNode;
}) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [added, setAdded] = useState<CalibVersion | null>(null);
  const counted = data.observations.filter((o) => !o.skipped);
  const left = Math.max(0, data.needed - counted.length);
  const versions = added ? [added, ...data.versions.map((v) => ({ ...v, current: false }))] : data.versions;
  const proposal = added ? null : data.proposal;
  const avg = { h24: meanAbs(counted.map((o) => o.err24)), h6: meanAbs(counted.map((o) => o.err6)), h1: meanAbs(counted.map((o) => o.err1)) };
  const head = [
    t(locale, 'cal_c_load'), t(locale, 'cal_c_arrived'), t(locale, 'cal_c_24'), t(locale, 'cal_c_6'), t(locale, 'cal_c_1'),
    t(locale, 'cal_c_pl'), t(locale, 'cal_c_se'), t(locale, 'cal_c_rest'),
  ];
  const segHead = [t(locale, 'cal_s_seg'), t(locale, 'cal_s_now'), t(locale, 'cal_s_meas'), t(locale, 'cal_s_verdict')];

  const approve = () => {
    if (!onApprove || !data.proposal) return;
    setBusy(true);
    setFailed(false);
    void onApprove(data.proposal.id).then((r) => {
      setBusy(false);
      setAsk(false);
      if (r.ok && r.version) setAdded(r.version); else setFailed(true);
    }, () => { setBusy(false); setFailed(true); });
  };

  const verdict = (s: CalibSegment): ReactNode => {
    if (s.verdict === 'few') return <span className="cal-wait">{t(locale, 'cal_v_few')}</span>;
    if (s.verdict === 'same') return <span className="cal-wait">{tp(locale, 'cal_v_same', { p: pct(s.devPct ?? 0) })}</span>;
    if (added) return <span className="ox-go">{t(locale, 'cal_v_applied')}</span>;
    return <span><b>{dur(s.medianMin)}</b> <span className="cal-dev">({pct(s.devPct ?? 0)})</span></span>;
  };

  return (
    <div className="ox-cal" data-eta-calib>
      <div className="ox-count-line">
        <span data-cal-count={counted.length}>
          {added
            ? tp(locale, 'cal_count_done', { n: counted.length, no: added.no })
            : left
              ? tp(locale, 'cal_count_wait', { n: counted.length, need: data.needed, left })
              : data.proposal
                ? tp(locale, 'cal_count_ready', { n: counted.length })
                : tp(locale, 'cal_count_same', { n: counted.length })}
        </span>
        {mark}
      </div>

      <section className="ox-panel" data-cal-obs>
        <div className="ox-panel-hd"><h3>{t(locale, 'cal_obs_h')}</h3></div>
        <div className="ox-panel-note cal-note">{tp(locale, 'cal_obs_note', { goal: GOAL_MIN })}</div>
        {data.observations.length ? (
          <div className="cal-wrap"><table className="ox-table ox-cards-phone cal-obs-t">
            <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {data.observations.map((o) => (
                <tr key={o.id} data-cal-row={o.code} className={o.skipped ? 'cal-skip' : undefined}>
                  <th scope="row" data-label={head[0]}><b data-content>{o.code}</b></th>
                  <td data-content><span className="cal-line">{formatListDateTime(o.arrivedAt).split(', ')[0]}</span><span className="cal-line">{formatListDateTime(o.arrivedAt).split(', ')[1]}</span></td>
                  {o.skipped ? (
                    <td colSpan={6} className="cal-skip-cell" data-cal-skipped>{tp(locale, 'cal_skipped', { why: o.skipped })}</td>
                  ) : (
                    <>
                      <td className={`cal-num ${errTone(o.err24)}`}>{errText(o.err24)}</td>
                      <td className={`cal-num ${errTone(o.err6)}`}>{errText(o.err6)}</td>
                      <td className={`cal-num ${errTone(o.err1)}`} data-cal-err1={o.err1 ?? ''}>{errText(o.err1)}</td>
                      <td className="cal-num">{dur(o.plMin)}</td>
                      <td className="cal-num">{dur(o.seMin)}</td>
                      <td data-content>
                        {o.breaksMin == null && !o.rest ? '–' : null}
                        {o.breaksMin != null ? <span className="cal-line">{tp(locale, 'cal_breaks', { d: etaDuration(o.breaksMin) })}</span> : null}
                        {o.rest ? <span className="cal-line">{o.rest}</span> : null}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {counted.length ? (
                <tr className="cal-avg" data-cal-avg>
                  <th scope="row">{t(locale, 'cal_avg')}</th>
                  <td className="cal-avg-n">{tp(locale, 'cal_avg_n', { n: counted.length })}</td>
                  <td className="cal-num">{dur(avg.h24)}</td>
                  <td className="cal-num">{dur(avg.h6)}</td>
                  <td className={`cal-num ${avg.h1 != null && avg.h1 <= GOAL_MIN ? 'ox-go' : 'ox-alert'}`} data-cal-avg1={avg.h1 ?? ''}>{dur(avg.h1)}</td>
                  <td />
                  <td />
                  <td />
                </tr>
              ) : null}
            </tbody>
          </table></div>
        ) : (
          <div className="ox-panel-bd">{t(locale, 'cal_obs_none')}</div>
        )}
      </section>

      <section className="ox-panel" data-cal-proposal={proposal ? 'ready' : added ? 'approved' : left ? 'wait' : 'same'}>
        <div className="ox-panel-hd">
          <h3>{t(locale, 'cal_prop_h')}</h3>
          {proposal ? <span className="ox-tag ox-tag-unfinished">{tp(locale, 'cal_prop_tag', { d: dayOf(proposal.at) })}</span> : null}
          {added ? <span className="ox-tag ox-tag-active">{tp(locale, 'cal_prop_done', { no: added.no })}</span> : null}
        </div>
        <div className="ox-panel-note cal-note">{tp(locale, 'cal_prop_note', { need: data.needed })}</div>
        <div className="cal-wrap"><table className="ox-table ox-cards-phone cal-seg-t">
          <thead><tr>{segHead.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>
            {data.segments.map((s) => (
              <tr key={s.code} data-cal-seg={s.code} data-cal-verdict={s.verdict}>
                <th scope="row" data-label={segHead[0]}>{s.name}</th>
                {s.verdict === 'fixed' ? (
                  <>
                    <td className="cal-num">{dur(s.currentMin)}</td>
                    <td colSpan={2} className="cal-seg-note">{s.note}</td>
                  </>
                ) : (
                  <>
                    <td className="cal-num">{dur(added && s.verdict === 'propose' && s.medianMin != null ? s.medianMin : s.currentMin)}</td>
                    <td className="cal-num">
                      {s.verdict === 'few'
                        ? tp(locale, 'cal_s_few', { n: s.n, need: data.needed })
                        : tp(locale, 'cal_s_median', { d: dur(s.medianMin), m: s.spreadMin ?? 0, n: s.n })}
                    </td>
                    <td>{verdict(s)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="ox-panel-bd cal-act">
          {proposal ? (
            <p className="cal-gain" data-cal-gain>
              {tp(locale, 'cal_gain', { n: counted.length, after: etaDuration(proposal.errorAfterMin), before: etaDuration(proposal.errorBeforeMin) })}
            </p>
          ) : null}
          {added ? (
            <span className="ox-go">{tp(locale, 'cal_prop_applied', { no: added.no })}</span>
          ) : !proposal ? (
            <span className="cal-wait">{left ? tp(locale, 'cal_prop_wait', { left, need: data.needed }) : t(locale, 'cal_prop_none')}</span>
          ) : readOnly ? (
            <span className="cal-wait">{t(locale, 'cal_prop_ro')}</span>
          ) : ask ? (
            <span className="cal-ask" data-cal-ask>
              <span>{t(locale, 'cal_ask')}</span>
              <span className="cal-btns">
                <button type="button" className="btn ghost ox-btn" onClick={() => setAsk(false)}>{t(locale, 'p3c_cancel')}</button>
                <button type="button" className="btn ox-btn" disabled={busy} onClick={approve} data-cal-yes>{t(locale, 'cal_yes')}</button>
              </span>
            </span>
          ) : (
            <span className="cal-ask">
              <span>{t(locale, 'cal_prop_rule')}</span>
              <button type="button" className="btn ox-btn" disabled={!onApprove} onClick={() => setAsk(true)} data-cal-approve>{t(locale, 'cal_approve')}</button>
            </span>
          )}
          {failed ? <span className="ox-alert" role="alert">{t(locale, 'cal_failed')}</span> : null}
        </div>
      </section>

      <section className="ox-panel" data-cal-versions>
        <div className="ox-panel-hd"><h3>{t(locale, 'cal_ver_h')}</h3></div>
        <ul className="cal-ver">
          {versions.map((v) => (
            <li key={v.id} data-cal-ver={v.no}>
              <b>{tp(locale, 'cal_ver_no', { no: v.no })}{v.current ? <span className="ox-tag ox-tag-active cal-cur">{t(locale, 'cal_ver_cur')}</span> : null}</b>
              <span className="ox-nowrap" data-content>{formatListDateTime(v.at)}</span>
              <span data-content>{v.by}</span>
              <span className="cal-ver-what" data-content>{v.what}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
