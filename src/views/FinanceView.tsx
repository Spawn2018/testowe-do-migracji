/**
 * wyglad/P5 — Finanse (E16, img/e16-after; E39 tabela tygodni, img/e39-after).
 * HHL: „Od przychodu do marży” według etapu rozliczenia, marża według rodzaju elementu, kurs NBP, flaga marży
 * (jeden próg z Opcji — bez progu wyłączona), opłata paliwowa według tygodnia załadunku.
 * KSH („Rozliczenia”) widzi tylko swoją cenę, SCX („Moje stawki”) tylko swoją stawkę — bez marży i ceny drugiej strony.
 * EUR jest źródłem; PLN — kurs NBP transportu, a przed rozładunkiem kurs bieżący (E16, 23:12). Telefon: karty (E8).
 * HHL: na końcu „Paczka tygodnia dla księgowości” (E40, img/e40-after) — gdy baza poda adresy i dziennik wysyłek.
 * Dane: `src/lib/p5Source.ts` (próg marży, średnie cen paliwa, adresy księgowości i wysyłkę paczek podłącza wykonawca).
 */
import { useMemo } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { up } from '../components/options/up';
import { ft, ftn, ftp } from '../i18n/p5';
import { formatPlNumber } from '../lib/format';
import { getNowIso } from '../lib/frozenNow';
import { localDateOf } from '../lib/money/engine';
import { useIsPhone } from '../lib/useIsPhone';
import { codeRange, marginPct, transportsText, type FinAmount, type FinSide, type FinStage, type FinStageRow } from '../lib/p5Finance';
import { accountingPackActionsOf, accountingPackConfigOf, belowOf, financeOf, fuelWeeksOf, marginThresholdOf } from '../lib/p5Source';
import { FuelWeekTable } from '../components/finance/FuelWeekTable';
import { transportLabel } from '../lib/transportName';
import { AccountingPackSection } from '../components/finance/AccountingPack';
import type { Locale } from '../types';
import '../components/finance/finance.css';

const STAGE_TAG: Record<FinStage, string> = { FAKTURA: 'fin-tag go', REALIZACJA: 'fin-tag sea', PROGNOZA: 'fin-tag plain' };
const PHONE_ORDER: FinStage[] = ['REALIZACJA', 'PROGNOZA', 'FAKTURA'];
const pctText = (p: number | null) => (p == null ? '—' : `${formatPlNumber(p, 2)}%`);

function sideOf(role: string): FinSide {
  return role === 'HHL' ? 'both' : role === 'KSH' ? 'rev' : 'cost';
}

function Head({ locale, title, sub, cur }: { locale: Locale; title: string; sub: string; cur: string }) {
  return (
    <header className="fin-head">
      <h2 id="fin-title">{title}</h2>
      <span className="sub" data-fin-sub>{sub}</span>
      <span className="fin-cur" data-fin-cur>{up(ftp(locale, 'p5_fin_cur', { cur }))}</span>
    </header>
  );
}

export function FinanceView() {
  const role = useTowerStore((s) => s.role);
  const loads = useTowerStore((s) => s.loads);
  const locale = useTowerStore((s) => s.locale);
  const currency = useTowerStore((s) => s.displayCurrency);
  const bills = useTowerStore((s) => s.bills);
  const documents = useTowerStore((s) => s.documents);
  const phone = useIsPhone();
  const side = sideOf(role);
  const nowIso = getNowIso();
  const today = localDateOf(nowIso);
  const packCfg = useMemo(() => (role === 'HHL' ? accountingPackConfigOf(bills) : null), [role, bills]);
  const pack = packCfg ? (
    <AccountingPackSection
      locale={locale} phone={phone} loads={loads} bills={bills} documents={documents}
      cfg={packCfg} actions={accountingPackActionsOf()} nowIso={nowIso}
    />
  ) : null;

  const fin = useMemo(() => financeOf(loads, side), [loads, side]);
  const threshold = side === 'both' ? marginThresholdOf() : null;
  const below = useMemo(() => (side === 'both' ? belowOf(loads, threshold) : []), [loads, side, threshold]);
  const fuel = useMemo(() => fuelWeeksOf(loads, side === 'rev' ? 'rev' : 'cost', today), [loads, side, today]);
  /** E41: nazwa transportu według firmy, która patrzy. */
  const nameOf = (id: string, code: string) => { const l = loads.find((x) => x.id === id); return l ? transportLabel(l, role) : code; };

  const pln = currency === 'PLN' && fin.plnComplete && fin.nbpLatest != null;
  const cur = pln ? 'PLN' : 'EUR';
  const n = (a: FinAmount) => formatPlNumber(pln ? a.pln ?? 0 : a.eur, 2);
  const m = (a: FinAmount, b: FinAmount) => formatPlNumber(pln ? (a.pln ?? 0) - (b.pln ?? 0) : a.eur - b.eur, 2);

  const title = role === 'SCX' ? t(locale, 'nav_fin_scx') : role === 'KSH' ? t(locale, 'nav_fin_ksh') : t(locale, 'nav_fin');
  const unpriced = fin.unpricedCodes.length;
  const subFull =
    side === 'rev' ? ft(locale, 'p5_fin_sub_ksh')
    : side === 'cost' ? ft(locale, 'p5_fin_sub_scx')
    : unpriced
      ? `${transportsText(fin.all)}: ${fin.priced} z ceną, ${unpriced} bez ceny ${ftp(locale, 'p5_fin_unpriced_note', { codes: codeRange(fin.unpricedCodes), why: fin.unpricedNoDate ? ft(locale, 'p5_fin_unpriced_why_date') : '' })}`
      : `${transportsText(fin.all)}: ${ft(locale, 'p5_fin_priced_all').replace('{priced}', String(fin.priced))}`;
  const nbp = fin.nbpLatest;
  const nbpDate = nbp ? `${nbp.date.slice(8, 10)}.${nbp.date.slice(5, 7)}.${nbp.date.slice(0, 4)}` : '';

  const stageLabel = (k: FinStage) => (side === 'both' || k !== 'REALIZACJA' ? ft(locale, `p5_fin_stage_${k}`) : ft(locale, `p5_fin_stage_REALIZACJA_${side}`));
  const plnNote = currency === 'PLN'
    ? pln ? ftp(locale, 'p5_fin_pln_note', { table: nbp!.tableNo, date: nbpDate }) : ft(locale, 'p5_fin_pln_missing')
    : null;

  /* ---------- etapy: komputer ---------- */
  const stagesTable = (
    <table className="fin-table" data-fin-stages={side}>
      <thead>
        <tr>
          <th>{up(ft(locale, side === 'both' ? 'p5_fin_col_stage' : 'p5_fin_col_stage_s'))}</th>
          <th className="num">{up(ft(locale, 'p5_fin_col_loads'))}</th>
          {side === 'both' ? (
            <>
              <th className="num">{up(ft(locale, 'p5_fin_col_rev'))}</th>
              <th className="num">{up(ft(locale, 'p5_fin_col_cost'))}</th>
              <th className="num">{up(ft(locale, 'p5_fin_col_margin'))}</th>
              <th className="num">{up(ft(locale, 'p5_fin_col_pct'))}</th>
            </>
          ) : (
            <th className="num">{up(ftp(locale, side === 'rev' ? 'p5_fin_col_due_ksh' : 'p5_fin_col_due_scx', { cur }))}</th>
          )}
        </tr>
      </thead>
      <tbody>
        {fin.stages.map((s) => (
          <tr key={s.stage} data-fin-stage={s.stage} data-count={s.count}>
            <td>
              {side === 'both' ? (
                <span className="fin-stage"><span className={STAGE_TAG[s.stage]}>{up(stageLabel(s.stage))}</span> {ft(locale, `p5_fin_stage_${s.stage}_d`)}</span>
              ) : stageLabel(s.stage)}
            </td>
            <td className="num">{s.count}</td>
            {side === 'both' ? (
              <>
                <td className="num">{n(s.rev)}</td>
                <td className="num">{n(s.cost)}</td>
                <td className="num">{m(s.rev, s.cost)}</td>
                <td className="num">{s.count ? pctText(marginPct(s.rev.eur, s.cost.eur)) : '—'}</td>
              </>
            ) : (
              <td className="num">{n(side === 'rev' ? s.rev : s.cost)}</td>
            )}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr data-fin-stage-total data-count={fin.total.count}>
          <th scope="row">{side === 'both' ? ftp(locale, 'p5_fin_total', { cur }) : ft(locale, 'p5_fin_total_s')}</th>
          <td className="num">{fin.total.count}</td>
          {side === 'both' ? (
            <>
              <td className="num">{n(fin.total.rev)}</td>
              <td className="num">{n(fin.total.cost)}</td>
              <td className="num">{m(fin.total.rev, fin.total.cost)}</td>
              <td className="num">{pctText(marginPct(fin.total.rev.eur, fin.total.cost.eur))}</td>
            </>
          ) : (
            <td className="num">{n(side === 'rev' ? fin.total.rev : fin.total.cost)}</td>
          )}
        </tr>
      </tfoot>
    </table>
  );

  /* ---------- etapy: telefon ---------- */
  const stageCard = (s: FinStageRow) => (
    <article key={s.stage} className="fin-card" data-fin-stage={s.stage} data-count={s.count}>
      <header className="fin-card-hd">
        <span className="fin-card-tag"><span className={STAGE_TAG[s.stage]}>{up(stageLabel(s.stage))}</span> <b>{s.count}</b></span>
        {side === 'both' ? <b>{s.count ? pctText(marginPct(s.rev.eur, s.cost.eur)) : '—'}</b> : null}
      </header>
      {s.count ? (
        <dl className="fin-kv">
          {side === 'both' ? (
            <>
              <div className="strong"><dt>{ft(locale, 'p5_fin_card_margin')}</dt><dd>{m(s.rev, s.cost)} {cur}</dd></div>
              <div><dt>{ft(locale, 'p5_fin_card_revcost')}</dt><dd>{n(s.rev)} / {n(s.cost)}</dd></div>
            </>
          ) : (
            <div className="strong">
              <dt>{ft(locale, side === 'rev' ? 'p5_fin_card_due_ksh' : 'p5_fin_card_due_scx')}</dt>
              <dd>{n(side === 'rev' ? s.rev : s.cost)} {cur}</dd>
            </div>
          )}
        </dl>
      ) : null}
    </article>
  );
  const countOf = (k: FinStage) => fin.stages.find((s) => s.stage === k)?.count ?? 0;
  /* telefon (img/e16-after): etapy z transportami najpierw, puste na końcu */
  const phoneStages = [...PHONE_ORDER].sort((a, b) => (countOf(a) ? 0 : 1) - (countOf(b) ? 0 : 1));
  const totalAmt = side === 'rev' ? fin.total.rev : fin.total.cost;

  /* ---------- karty z boku (HHL) ---------- */
  const nbpCard = (
    <section className="panel fin-panel" data-fin-nbp data-deur-exempt="fx-nbp" aria-labelledby="fin-nbp-h">
      <header className="panel-hd fin-hd2"><h3 id="fin-nbp-h">{ft(locale, 'p5_fin_nbp_h')}</h3></header>
      {phone ? (
        <p className="fin-muted fin-pad">{nbp ? ftp(locale, 'p5_fin_nbp_short', { table: nbp.tableNo, date: nbpDate.slice(0, 5), mid: formatPlNumber(nbp.mid, 4) }) : ft(locale, 'p5_fin_nbp_none')}</p>
      ) : (
        <>
          <dl className="fin-dl">
            <dt>{ft(locale, 'p5_fin_nbp_last')}</dt>
            <dd>{nbp ? <><b>{nbp.tableNo}</b> {ftp(locale, 'p5_fin_nbp_last_v', { date: nbpDate, mid: formatPlNumber(nbp.mid, 4) })}</> : ft(locale, 'p5_fin_nbp_none')}</dd>
            <dt>{ft(locale, 'p5_fin_nbp_fetch')}</dt>
            <dd>{ft(locale, 'p5_fin_nbp_fetch_v')}</dd>
            <dt>{ft(locale, 'p5_fin_nbp_done')}</dt>
            <dd>{ft(locale, 'p5_fin_nbp_done_v')}</dd>
            <dt>{ft(locale, 'p5_fin_nbp_before')}</dt>
            <dd>{ft(locale, 'p5_fin_nbp_before_v')}</dd>
          </dl>
          <p className="fin-muted fin-pad">{ft(locale, 'p5_fin_nbp_foot')}</p>
        </>
      )}
    </section>
  );
  const flagCard = (
    <section className="panel fin-panel" data-fin-flag={threshold == null ? 'off' : 'on'} aria-labelledby="fin-flag-h">
      <header className="panel-hd fin-hd2"><h3 id="fin-flag-h">{ft(locale, 'p5_fin_flag_h')}</h3></header>
      <dl className="fin-dl fin-dl-rows">
        <dt>{ft(locale, 'p5_fin_flag_thr')}</dt>
        <dd><b>{threshold == null ? ft(locale, 'p5_fin_flag_thr_none') : `${formatPlNumber(threshold, 0)}%`}</b></dd>
        <dt>{ft(locale, 'p5_fin_flag_below')}</dt>
        <dd><b data-fin-below-count={below.length}>{threshold == null ? ft(locale, 'p5_fin_flag_off') : below.length}</b></dd>
      </dl>
      {below.length ? (
        <div className="fin-below" data-fin-below>
          <h4 className="sec">{ft(locale, 'p5_fin_flag_list_h')}</h4>
          <ul>
            {below.map((b) => (
              <li key={b.id} data-fin-below-row={b.code}>
                <span><b data-content>{nameOf(b.id, b.code)}</b> <span className="fin-muted" data-content>{b.type}</span></span>
                <span className="neg">{pctText(b.marginPct)} · {formatPlNumber(pln && b.marginPln != null ? b.marginPln : b.marginEur, 2)} {pln && b.marginPln != null ? 'PLN' : 'EUR'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="fin-muted fin-pad">{ft(locale, 'p5_fin_flag_note')}</p>
    </section>
  );
  const fuelCard = (
    <section className="panel fin-panel" data-fin-fuel-card aria-labelledby="fin-fuel-card-h">
      <header className="panel-hd fin-hd2"><h3 id="fin-fuel-card-h">{ft(locale, 'p5_fin_fuel_h')}</h3></header>
      <p className="fin-muted fin-pad">{ft(locale, 'p5_fin_fuel_p')}</p>
      <div className="fin-pad fin-links">
        <a className="btn ghost" href="#fin-fuel" onClick={(e) => { e.preventDefault(); document.getElementById('fin-fuel')?.scrollIntoView({ block: 'start' }); }}>
          {ft(locale, 'p5_fin_fuel_go_table')}
        </a>
      </div>
    </section>
  );

  /* ---------- marża według rodzaju (HHL) ---------- */
  const marginCls = (rev: number, cost: number) => {
    const p = marginPct(rev, cost);
    return threshold != null && p != null && p < threshold ? 'num neg' : 'num';
  };
  const typesBlock = side === 'both' ? (
    phone ? (
      <section className="fin-sec" aria-labelledby="fin-types-h">
        <h4 className="sec" id="fin-types-h">{ft(locale, 'p5_fin_types_h')} <span className="sub" data-fin-type-count>{ftn(locale, 'p5_fin_types_n', fin.types.length)}</span></h4>
        <div className="fin-cards" data-fin-type-cards>
          {fin.types.map((r) => (
            <article key={r.type} className="fin-card" data-fin-type-card={r.type}>
              <header className="fin-card-hd"><b data-content>{r.type}</b><span className="fin-muted">{r.priced} / {r.all}</span></header>
              <dl className="fin-kv">
                <div className="strong"><dt>{ft(locale, 'p5_fin_card_margin')}</dt><dd className={marginCls(r.rev.eur, r.cost.eur)}>{m(r.rev, r.cost)} · {pctText(marginPct(r.rev.eur, r.cost.eur))}</dd></div>
                <div><dt>{ft(locale, 'p5_fin_card_revcost')}</dt><dd>{n(r.rev)} / {n(r.cost)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    ) : (
      <section className="fin-sec" aria-labelledby="fin-types-h">
        <h4 className="sec" id="fin-types-h">{ft(locale, 'p5_fin_types_h')}</h4>
        <table className="fin-table" data-fin-types>
          <thead>
            <tr>
              <th>{up(ft(locale, 'p5_fin_col_type'))}</th>
              <th className="num">{up(ft(locale, 'p5_fin_col_priced'))}</th>
              <th className="num">{up(ft(locale, 'p5_fin_col_rev_s'))}</th>
              <th className="num">{up(ft(locale, 'p5_fin_col_cost_s'))}</th>
              <th className="num">{up(ft(locale, 'p5_fin_col_margin'))}</th>
              <th className="num">{up(ft(locale, 'p5_fin_col_pct'))}</th>
            </tr>
          </thead>
          <tbody>
            {fin.types.map((r) => (
              <tr key={r.type} data-fin-type={r.type}>
                <td data-content>{r.type}</td>
                <td className="num">{r.priced} / {r.all}</td>
                <td className="num">{n(r.rev)}</td>
                <td className="num">{n(r.cost)}</td>
                <td className={marginCls(r.rev.eur, r.cost.eur)}>{m(r.rev, r.cost)}</td>
                <td className={marginCls(r.rev.eur, r.cost.eur)}>{pctText(marginPct(r.rev.eur, r.cost.eur))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )
  ) : null;

  const stagesNote = ft(locale, side === 'both' ? 'p5_fin_stages_note' : side === 'rev' ? 'p5_fin_stages_note_ksh' : 'p5_fin_stages_note_scx');
  const stagesTitle = ft(locale, side === 'both' ? 'p5_fin_stages_h' : side === 'rev' ? 'p5_fin_stages_h_ksh' : 'p5_fin_stages_h_scx');

  if (phone) {
    const marginAll = fin.total.rev.eur - fin.total.cost.eur;
    return (
      <div className="fin-page" data-page="finance" data-fin-side={side}>
        <header className="fin-head">
          <h2>{title}</h2>
          <span className="fin-cur" data-fin-cur>{cur}</span>
        </header>
        <p className="fin-muted fin-line" data-fin-sub>
          {unpriced ? ftp(locale, 'p5_fin_priced_line', { priced: fin.priced, unpriced }) : ftp(locale, 'p5_fin_priced_all', { priced: fin.priced })}
        </p>
        <article className="fin-card fin-card-big" data-fin-total data-count={fin.total.count}>
          <header className="fin-card-hd">
            <b>{side === 'both' ? ft(locale, 'p5_fin_margin_total') : ft(locale, side === 'rev' ? 'p5_fin_card_due_ksh' : 'p5_fin_card_due_scx')}</b>
            {side === 'both' ? <b>{pctText(marginPct(fin.total.rev.eur, fin.total.cost.eur))}</b> : null}
          </header>
          <div className="fin-big">{side === 'both' ? `${formatPlNumber(pln ? (fin.total.rev.pln ?? 0) - (fin.total.cost.pln ?? 0) : marginAll, 2)} ${cur}` : `${n(totalAmt)} ${cur}`}</div>
          {side === 'both' ? <p className="fin-muted">{ftp(locale, 'p5_fin_margin_line', { rev: n(fin.total.rev), cost: n(fin.total.cost) })}</p> : null}
        </article>
        <div className="fin-cards" data-fin-stage-cards>{phoneStages.map((k) => stageCard(fin.stages.find((s) => s.stage === k)!))}</div>
        {plnNote ? <p className="fin-muted fin-line">{plnNote}</p> : null}
        {side === 'both' ? nbpCard : null}
        {side === 'both' ? flagCard : null}
        {typesBlock}
        <FuelWeekTable rows={fuel} locale={locale} phone nameOf={nameOf} />
        {pack}
      </div>
    );
  }

  return (
    <div className="fin-page" data-page="finance" data-fin-side={side}>
      <div className={side === 'both' ? 'fin-grid' : 'fin-grid one'}>
        <section className="panel fin-panel fin-main" aria-labelledby="fin-title">
          <Head locale={locale} title={title} sub={subFull} cur={cur} />
          <div className="fin-body">
            <section className="fin-sec" aria-labelledby="fin-stages-h">
              <h4 className="sec" id="fin-stages-h">{stagesTitle}</h4>
              {stagesTable}
              <p className="fin-muted">{stagesNote}</p>
              {plnNote ? <p className="fin-muted">{plnNote}</p> : null}
            </section>
            {typesBlock}
          </div>
        </section>
        {side === 'both' ? (
          <aside className="fin-side">
            {nbpCard}
            {flagCard}
            {fuelCard}
          </aside>
        ) : null}
      </div>
      <FuelWeekTable rows={fuel} locale={locale} phone={false} nameOf={nameOf} />
      {pack}
    </div>
  );
}

