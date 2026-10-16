/**
 * wyglad/J4 — „Ocena przewoźników” w Kokpicie (E9; E11/E12: „ocena przewoźnika to raport, nie ustawienie → Kokpit”).
 * HHL: wiersz na przewoźnika. SCX: swój wiersz i ostatnie oceny swoich transportów. KSH: brak (E9).
 * Komputer — tabela; telefon (E8) — karty, tekst ≥ 12 px, przyciski ≥ 44 px. Daty DD.MM.RRRR.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Locale } from '../../types';
import type { CarrierRatingRow, MyRating, RatingRange } from '../../lib/carrierRating';
import { lateText, pctText } from '../../lib/carrierRating';
import { formatPlNumber } from '../../lib/format';
import { fmtDate } from '../../lib/time';
import { useIsPhone } from '../../lib/useIsPhone';
import { j4, j4p } from '../../i18n/j4';
import './carrierRating.css';

export interface CarrierRatingPanelProps {
  locale: Locale;
  carrier: boolean;
  range: RatingRange;
  onRange: (r: RatingRange) => void;
  rows: CarrierRatingRow[];
  mine?: MyRating[];
  /** Nazwa transportu według firmy (E41). */
  codeOf?: (loadId: string) => string;
  error?: string | null;
  mark?: ReactNode;
}

const MINE_SHORT = 5;

export function CarrierRatingPanel({ locale, carrier, range, onRange, rows, mine = [], codeOf, error, mark }: CarrierRatingPanelProps) {
  const phone = useIsPhone();
  const [allMine, setAllMine] = useState(false);
  const score = (r: CarrierRatingRow) => (r.avgScore == null ? '—' : j4p(locale, 'j4_score_val', { v: formatPlNumber(r.avgScore, 2), n: r.ratings }));
  const onTime = (r: CarrierRatingRow) => `${r.onTime} (${pctText(r.onTime, r.delivered)})`;
  const mineShown = allMine ? mine : mine.slice(0, MINE_SHORT);

  return (
    <section className="panel cr" data-cr-panel={carrier ? 'SCX' : 'HHL'} data-rows={rows.length}>
      <header className="panel-hd cr-hd">
        <h2>{j4(locale, carrier ? 'j4_h_scx' : 'j4_h_hhl')}</h2>
        <span className="sub">{j4(locale, 'j4_sub')}</span>
        {mark}
        <div className="spacer" />
        <div className="cr-range" role="group" aria-label={j4(locale, 'j4_range_label')}>
          {(['all', '4w'] as const).map((r) => (
            <button key={r} type="button" className="chipbtn" aria-pressed={range === r} data-cr-range={r} onClick={() => onRange(r)}>
              {j4(locale, r === '4w' ? 'j4_range_4w' : 'j4_range_all')}
            </button>
          ))}
        </div>
      </header>
      <div className="panel-bd cr-bd">
        {error ? <div className="cr-err" role="status">{error}</div> : null}
        {rows.length === 0 ? (
          <div className="cr-empty" data-cr-empty>{j4(locale, 'j4_empty')}</div>
        ) : phone ? (
          <ul className="cr-cards">
            {rows.map((r) => (
              <li key={r.carrierId} className="cr-card" data-cr-row={r.name}>
                {carrier ? null : <b className="cr-card-name">{r.name}</b>}
                <dl className="cr-kv">
                  <dt>{j4(locale, 'j4_c_delivered')}</dt><dd>{r.delivered}</dd>
                  <dt>{j4(locale, 'j4_c_on_time')}</dt><dd data-cr-ontime>{onTime(r)}</dd>
                  <dt>{j4(locale, 'j4_c_late')}</dt><dd>{r.lateCarrier}</dd>
                  <dt>{j4(locale, 'j4_c_avg_late')}</dt><dd>{lateText(r.avgLateMin)}</dd>
                  <dt>{j4(locale, 'j4_c_score')}</dt><dd data-cr-score>{score(r)}</dd>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <div className="cr-table-wrap">
            <table className="cr-table">
              <thead>
                <tr>
                  {carrier ? null : <th>{j4(locale, 'j4_c_carrier')}</th>}
                  <th className="num">{j4(locale, 'j4_c_delivered')}</th>
                  <th className="num">{j4(locale, 'j4_c_on_time')}</th>
                  <th className="num">{j4(locale, 'j4_c_late')}</th>
                  <th className="num">{j4(locale, 'j4_c_avg_late')}</th>
                  <th className="num">{j4(locale, 'j4_c_score')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.carrierId} data-cr-row={r.name}>
                    {carrier ? null : <td>{r.name}</td>}
                    <td className="num">{r.delivered}</td>
                    <td className="num" data-cr-ontime>{onTime(r)}</td>
                    <td className="num">{r.lateCarrier}</td>
                    <td className="num">{lateText(r.avgLateMin)}</td>
                    <td className="num" data-cr-score>{score(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {carrier && mine.length > 0 ? (
          <div className="cr-mine" data-cr-mine={mine.length}>
            <h3>{j4(locale, 'j4_mine_h')}</h3>
            <ul>
              {mineShown.map((m) => (
                <li key={m.loadId} data-cr-mine-row={m.score}>
                  <span className="cr-mine-code">{codeOf ? codeOf(m.loadId) : m.loadId}</span>
                  <b>{m.score} / 5</b>
                  <span className="cr-mine-date">{fmtDate(m.ratedAt)}</span>
                </li>
              ))}
            </ul>
            {mine.length > MINE_SHORT ? (
              <button type="button" className="btn ghost cr-more" onClick={() => setAllMine((v) => !v)}>
                {allMine ? j4(locale, 'j4_mine_less') : j4p(locale, 'j4_mine_more', { n: mine.length })}
              </button>
            ) : null}
          </div>
        ) : null}
        <p className="cr-note">{j4(locale, carrier ? 'j4_note_scx' : 'j4_note_hhl')}</p>
      </div>
    </section>
  );
}
