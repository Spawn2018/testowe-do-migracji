/**
 * wyglad/P5 — E39 „Opłata paliwowa według tygodnia załadunku” (img/e39-after, część „Finanse”).
 * HHL, KSH i SCX widzą to samo (decyzja 07.10, 23:41, wariant A): tydzień obowiązywania, tydzień wskaźników,
 * OKQ8 i Orlen ze średnią i liczbą publikacji, stosowany mnożnik, stan, liczba transportów.
 * Wiersz rozwija listę transportów i publikacji cen. Telefon: karty (E8).
 */
import { Fragment, useState } from 'react';
import type { Locale } from '../../types';
import { formatPlNumber } from '../../lib/format';
import { weekLabel, type FuelSrc, type FuelWeekRow } from '../../lib/p5Finance';
import { up } from '../options/up';
import { ft, ftp } from '../../i18n/p5';
import { DemoMark } from '../ui/DemoMark';
import { PROD_BUILD } from '../../lib/prodFacade';

const x = (n: number) => `×${formatPlNumber(n, 2)}`;
const dm = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;

function src(locale: Locale, key: 'p5_fuel_okq8' | 'p5_fuel_orlen', s: FuelSrc | null): string {
  if (!s) return '—';
  if (s.avg == null) return x(s.mult);
  const publ = s.n != null ? ftp(locale, 'p5_fuel_publ', { n: s.n }) : '';
  return ftp(locale, key, { avg: formatPlNumber(s.avg, 2), mult: formatPlNumber(s.mult, 2), publ });
}

function stateTag(locale: Locale, r: FuelWeekRow) {
  const cls = r.state === 'OSTATECZNA' ? 'fin-tag go' : r.state === 'PROGNOZA' ? 'fin-tag warn' : 'fin-tag plain';
  return <span className={cls}>{up(ft(locale, `p5_fuel_state_${r.state}`))}</span>;
}

function stateNote(locale: Locale, r: FuelWeekRow): string | null {
  if (r.state === 'BRAK') return r.loads.length ? r.loads.length > 3 ? `${r.loads[0].code} – ${r.loads[r.loads.length - 1].code}` : r.loads.map((l) => l.code).join(', ') : null;
  if (r.state !== 'PROGNOZA') return null;
  return r.finalFrom ? ftp(locale, 'p5_fuel_final_from', { date: dm(r.finalFrom) }) : ft(locale, 'p5_fuel_final_later');
}

function weekText(locale: Locale, r: FuelWeekRow): string {
  return r.week ? weekLabel(r.week, r.weekLast) : ft(locale, 'p5_fuel_no_date');
}

function idxText(locale: Locale, r: FuelWeekRow): string {
  if (!r.idx) return '—';
  const label = weekLabel(r.idx, r.idxLast);
  return r.running ? ftp(locale, 'p5_fuel_idx_running', { label }) : label;
}

/** E41: nazwa transportu według firmy (z widoku Finanse); bez niej — kod. */
type NameOf = (id: string, code: string) => string;

function Detail({ r, locale, nameOf }: { r: FuelWeekRow; locale: Locale; nameOf?: NameOf }) {
  return (
    <div className="fuel-detail" data-fuel-detail={r.key}>
      <div>
        <h4 className="sec">{ft(locale, 'p5_fuel_loads_h')} · {r.loads.length}</h4>
        <p className="fuel-codes" data-content>
          {r.loads.map((l, i) => <span key={l.id}>{i ? ', ' : ''}<span className="fuel-code">{nameOf ? nameOf(l.id, l.code) : l.code}</span></span>)}
        </p>
      </div>
      {r.idx ? (
        <div>
          <h4 className="sec">{ftp(locale, 'p5_fuel_publ_h', { label: weekLabel(r.idx) })}</h4>
          {r.publications && r.publications.length ? (
            <ul className="fuel-publ">
              {r.publications.map((p) => (
                <li key={`${p.date}-${p.source}`}>
                  <span>{dm(p.date)}</span>
                  <span>{p.source === 'OKQ8' ? 'OKQ8' : 'Orlen'}</span>
                  <span className="num">{formatPlNumber(p.price, 2)} {p.source === 'OKQ8' ? 'SEK/l' : 'PLN/l'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fin-muted">{ft(locale, 'p5_fuel_publ_none')}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function FuelWeekTable({ rows, locale, phone, nameOf }: { rows: FuelWeekRow[]; locale: Locale; phone: boolean; nameOf?: NameOf }) {
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (k: string) => setOpen((o) => (o === k ? null : k));
  return (
    <section className="panel fin-panel" id="fin-fuel" data-fin-fuel data-deur-exempt="fuel-index" aria-labelledby="fin-fuel-h">
      <header className="panel-hd fin-hd2">
        <h3 id="fin-fuel-h">{ft(locale, 'p5_fuel_h')}</h3>
        <span className="sub">{ft(locale, 'p5_fuel_sub')}</span>
        {/* G-08: średnie cen i publikacje w demo to przykład — oznaczenie tylko w buildzie demo */}
        {PROD_BUILD ? null : <DemoMark />}
      </header>
      {rows.length === 0 ? (
        <p className="fin-muted fin-pad">{ft(locale, 'p5_fuel_empty')}</p>
      ) : phone ? (
        <div className="fin-cards">
          {rows.map((r) => (
            <article key={r.key} className="fin-card" data-fuel-week={r.key}>
              <button type="button" className="fin-card-hd fin-card-btn" aria-expanded={open === r.key} onClick={() => toggle(r.key)}>
                <b data-content>{weekText(locale, r)}</b>
                {stateTag(locale, r)}
              </button>
              <dl className="fin-kv">
                <div><dt>{ft(locale, 'p5_fuel_col_idx')}</dt><dd>{idxText(locale, r)}</dd></div>
                <div><dt>OKQ8</dt><dd>{src(locale, 'p5_fuel_okq8', r.okq8)}</dd></div>
                <div><dt>Orlen</dt><dd>{src(locale, 'p5_fuel_orlen', r.orlen)}</dd></div>
                <div className="strong"><dt>{ft(locale, 'p5_fuel_col_applied')}</dt><dd>{r.applied == null ? '—' : x(r.applied)}</dd></div>
                <div><dt>{ft(locale, 'p5_fuel_col_loads')}</dt><dd>{r.loads.length}</dd></div>
              </dl>
              {stateNote(locale, r) ? <p className="fin-muted" data-content>{stateNote(locale, r)}</p> : null}
              {open === r.key ? <Detail r={r} locale={locale} nameOf={nameOf} /> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="fin-scroll">
          <table className="fin-table" data-fuel-table>
            <thead>
              <tr>
                <th>{up(ft(locale, 'p5_fuel_col_week'))}</th>
                <th>{up(ft(locale, 'p5_fuel_col_idx'))}</th>
                <th className="num">{up(ft(locale, 'p5_fuel_col_okq8'))}</th>
                <th className="num">{up(ft(locale, 'p5_fuel_col_orlen'))}</th>
                <th className="num">{up(ft(locale, 'p5_fuel_col_applied'))}</th>
                <th>{up(ft(locale, 'p5_fuel_col_state'))}</th>
                <th className="num">{up(ft(locale, 'p5_fuel_col_loads'))}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.key}>
                  <tr className={open === r.key ? 'is-open' : undefined} data-fuel-week={r.key} onClick={() => toggle(r.key)}>
                    {/* klawiatura i czytnik: przycisk w pierwszej komórce (wiersz klikalny myszą) */}
                    <td>
                      <button type="button" className="fuel-row-btn" data-fuel-toggle aria-expanded={open === r.key} onClick={(e) => { e.stopPropagation(); toggle(r.key); }}>
                        <b data-content>{weekText(locale, r)}</b>
                      </button>
                    </td>
                    <td data-content>{idxText(locale, r)}</td>
                    <td className="num">{src(locale, 'p5_fuel_okq8', r.okq8)}</td>
                    <td className="num">{src(locale, 'p5_fuel_orlen', r.orlen)}</td>
                    <td className="num"><b>{r.applied == null ? '—' : x(r.applied)}</b></td>
                    <td>
                      <span className="fin-state">{stateTag(locale, r)}{stateNote(locale, r) ? <span className="fin-muted" data-content>{stateNote(locale, r)}</span> : null}</span>
                    </td>
                    <td className="num">{r.loads.length}</td>
                  </tr>
                  {open === r.key ? (
                    <tr className="fin-detail-row">
                      <td colSpan={7}><Detail r={r} locale={locale} nameOf={nameOf} /></td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">{ft(locale, 'p5_fuel_foot')}</p>
    </section>
  );
}
