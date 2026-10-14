/**
 * wyglad/P5 — panel transportu › „Ceny” (E33, img/e33-after; E16 kwoty i kurs, E39 karta opłaty paliwowej).
 * HHL: tabela „Koszt · SCX” / „Przychód · KSH” (fracht z cennika, opłata paliwowa z tygodniem i mnożnikiem, dopłaty,
 * razem), marża z progiem z Opcji (jedna reguła koloru — E16), linia w PLN z kursem, karta opłaty paliwowej.
 * KSH widzi tylko „Twoja cena”, SCX tylko „Twoja stawka” — bez napisu o cudzej cenie (ochrona zostaje w bazie).
 * Dopłaty: tylko postój i anulowanie; system podpowiada, firmy decydują (09.10 13:09 pkt 5) — okno „Dopłata”.
 * Zasady cennika z liczbami. Telefon: karty, szczegóły zwinięte, „+ Dopłata” 44 px (E8).
 * Bez podpowiedzi z bazy (`feeSuggestionsOf` = null) zostaje dzisiejszy formularz dopłat (`legacyFees`).
 */
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import type { Load, Locale } from '../../types';
import { useTowerStore } from '../../store/useTowerStore';
import { formatPlNumber } from '../../lib/format';
import { fuelWeeksOf, feeRulesOf, feeSuggestionsOf, marginThresholdOf } from '../../lib/p5Source';
import { isoWeek, marginPct, weekLabel } from '../../lib/p5Finance';
import { durText, type FeeDecision, type FeeSuggestion } from '../../lib/p5Fees';
import { lazyRetry } from '../../lib/lazyRetry';
import { localDateOf } from '../../lib/money/engine';
import { ft, ftp } from '../../i18n/p5';
import { up } from '../options/up';
import '../finance/finance.css';
import './panel.css';

const FeeModal = lazy(lazyRetry(() => import('./FeeModal').then((m) => ({ default: m.FeeModal }))));

const n2 = (n: number) => formatPlNumber(n, 2);
const x2 = (n: number) => `×${formatPlNumber(n, 2)}`;
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const hm = (iso: string) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const dmhm = (iso: string) => `${dm(localDateOf(iso))}, ${hm(iso)}`;

const TIER_TAG = { PROGNOZA: 'fin-tag plain', REALIZACJA: 'fin-tag sea', FAKTURA: 'fin-tag go' } as const;

interface Props {
  load: Load;
  role: 'HHL' | 'KSH' | 'SCX';
  locale: Locale;
  phone: boolean;
  nowIso: string;
  /** Dzisiejszy formularz dopłat (produkcja) — do czasu podpowiedzi z bazy. */
  legacyFees?: ReactNode;
}

export function PanelPrices({ load, role, locale, phone, nowIso, legacyFees }: Props) {
  const currency = useTowerStore((s) => s.displayCurrency);
  const pr = load.pricing;
  const money = pr.money ?? null;
  const today = localDateOf(nowIso);
  const threshold = role === 'HHL' ? marginThresholdOf() : null;
  const rules = feeRulesOf();
  const suggestions = useMemo(() => feeSuggestionsOf(load), [load]);
  /* decyzje z tej sesji (w produkcji z bazy — wykonawca) */
  const [decided, setDecided] = useState<Record<string, FeeDecision>>({});
  const [feeOpen, setFeeOpen] = useState<FeeSuggestion | null | 'new'>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const fuelRow = useMemo(() => fuelWeeksOf([load], role === 'KSH' ? 'rev' : 'cost', today)[0] ?? null, [load, role, today]);

  const midCost = money && money.cost.fx.mid > 0 ? money.cost.fx.mid : null;
  const midRev = money && money.rev.fx.mid > 0 ? money.rev.fx.mid : null;
  const pln = currency === 'PLN' && (role !== 'HHL' ? (role === 'KSH' ? midRev : midCost) : midCost && midRev) != null;
  const cur = pln ? 'PLN' : pr.currency;
  const amt = (eur: number, side: 'cost' | 'rev') => n2(pln ? eur * ((side === 'cost' ? midCost : midRev) ?? 0) : eur);
  const showCost = role !== 'KSH';
  const showRev = role !== 'SCX';
  const both = role === 'HHL';
  const tier = money ? (both ? money.tier : role === 'KSH' ? money.rev.tier : money.cost.tier) : null;
  const fuelSide = money ? (role === 'KSH' ? money.rev : money.cost) : null;
  const fuelWeek = fuelSide ? `t${isoWeek(fuelSide.fuel.refDate)}` : null;
  const fuelLabel = fuelSide ? `${fuelWeek} · ${x2(fuelSide.fuel.applied)}` : null;
  const margin = pr.revTotal - pr.costTotal;
  const mPct = marginPct(pr.revTotal, pr.costTotal);
  const below = threshold != null && mPct != null && mPct < threshold;
  const fx = money ? (role === 'KSH' ? money.rev.fx : money.cost.fx) : null;
  const rateText = fx && fx.mid > 0 ? ftp(locale, fx.provisional ? 'p5_pr_rate_now' : 'p5_pr_rate_nbp', { table: fx.tableNo, date: dm(fx.date), mid: formatPlNumber(fx.mid, 4) }) : null;

  const dec = (s: FeeSuggestion): FeeDecision | null => decided[s.id] ?? (role === 'SCX' ? s.scx : s.hhl);
  const feeTag = (s: FeeSuggestion) => {
    const eur = role === 'KSH' ? s.revEur : role === 'SCX' ? s.costEur : Math.max(s.costEur, s.revEur);
    const d = dec(s);
    if (d) return <span className={d === 'ODRZUCONA' || d === 'NIE_DODAJE' ? 'fin-tag plain' : 'fin-tag warn'}>{up(ft(locale, `p5_pr_dec_${d}`))}</span>;
    if (s.noMeasure && !eur) return <span className="fin-tag plain">{ft(locale, 'p5_pr_none_tag')}</span>;
    return <span className={eur ? 'fin-tag warn' : 'fin-tag go'} data-fee-eur={eur}>{up(ftp(locale, 'p5_pr_eur_tag', { n: n2(eur) }))}</span>;
  };
  const feeTitle = (s: FeeSuggestion) => (s.kind === 'CANCEL' ? ft(locale, 'p5_pr_cancel') : ftp(locale, 'p5_pr_dwell', { place: ft(locale, `p5_pr_place_${s.place}`), where: s.where }));
  const feeLine = (s: FeeSuggestion) => {
    if (s.noMeasure) return s.noMeasure;
    if (s.kind === 'DWELL' && s.enterAt && s.exitAt && s.minutes != null && rules && s.place) {
      return ftp(locale, 'p5_pr_measured', { from: dmhm(s.enterAt), to: hm(s.exitAt), dur: durText(s.minutes), free: rules.freeHours[s.place] });
    }
    return '';
  };
  const canAdd = role === 'HHL' || role === 'SCX';

  const feeList = suggestions ? (
    <div className="pp-fees" data-fee-list>
      {suggestions.map((s) => {
        const mine = role === 'KSH' ? s.revEur : role === 'SCX' ? s.costEur : Math.max(s.costEur, s.revEur);
        const d = dec(s);
        const kshWait = role === 'KSH' && d === 'CZEKA_KSH';
        return (
          <article key={s.id} className={kshWait ? 'pp-fee is-wait' : 'pp-fee'} data-fee={s.kind} data-fee-place={s.place ?? ''}>
            <div className="pp-fee-tx">
              <b>{feeTitle(s)}</b>
              <span data-content>{feeLine(s)}</span>
              {s.zone && !s.noMeasure ? <span className="fin-muted" data-content>{ftp(locale, 'p5_pr_zone', { zone: s.zone })}</span> : null}
              {mine > 0 && s.kind === 'DWELL' && s.minutes != null && s.place && rules ? (
                <span className="pp-over" data-content>{ftp(locale, 'p5_pr_over', { dur: durText(s.minutes - rules.freeHours[s.place] * 60), fee: `${n2(mine)} EUR` })}</span>
              ) : role === 'SCX' && !s.noMeasure && !mine ? <span className="fin-muted">{ft(locale, 'p5_pr_fee_nothing')}</span> : null}
              {kshWait ? <span className="fin-muted">{ft(locale, 'p5_pr_fee_wait_KSH')}</span> : null}
            </div>
            <div className="pp-fee-act">
              {kshWait ? (
                <>
                  <button type="button" className="btn" onClick={() => setDecided((m) => ({ ...m, [s.id]: 'PRZYJETA' }))}>{ft(locale, 'p5_pr_fee_accept')}</button>
                  <button type="button" className="btn ghost" onClick={() => setDecided((m) => ({ ...m, [s.id]: 'ODRZUCONA' }))}>{ft(locale, 'p5_pr_fee_reject')}</button>
                </>
              ) : role === 'SCX' && !d ? (
                <button type="button" className="btn ghost" disabled={!mine} onClick={() => setFeeOpen(s)}>{ft(locale, 'p5_pr_fee_add_scx')}</button>
              ) : role === 'HHL' && mine > 0 && !d ? (
                <button type="button" className="pp-tag-btn" data-fee-open={s.id} onClick={() => setFeeOpen(s)}>{feeTag(s)}</button>
              ) : feeTag(s)}
            </div>
          </article>
        );
      })}
    </div>
  ) : null;

  const rulesBlock = rules ? (
    <section className="pp-sec" data-fee-rules aria-labelledby="pp-rules-h">
      <h4 className="sec" id="pp-rules-h">{ft(locale, 'p5_pr_rules_h')} <span className="sub">· {ft(locale, 'p5_pr_rules_sub')}</span></h4>
      <dl className="pp-rules">
        <dt>{ft(locale, 'p5_pr_rule_free')}</dt><dd>{ftp(locale, 'p5_pr_rule_free_v', { load: rules.freeHours.LOAD, unload: rules.freeHours.UNLOAD })}</dd>
        <dt>{ft(locale, 'p5_pr_rule_hour')}</dt><dd>{ftp(locale, 'p5_pr_rule_hour_v', { eur: rules.hourEur })}</dd>
        <dt>{ft(locale, 'p5_pr_rule_day')}</dt><dd>{ftp(locale, 'p5_pr_rule_day_v', { eur: rules.dayEur })}</dd>
        <dt>{ft(locale, 'p5_pr_rule_cancel')}</dt>
        <dd>{ftp(locale, 'p5_pr_rule_cancel_v', { d5: rules.cancelPct[5], d4: rules.cancelPct[4], d3: rules.cancelPct[3], d2: rules.cancelPct[2], d1: rules.cancelPct[1], d0: rules.cancelPct[0] })}</dd>
      </dl>
      <p className="fin-muted">{ft(locale, 'p5_pr_rules_note')}</p>
    </section>
  ) : null;

  const fuelCard = fuelRow && fuelRow.week ? (
    <div className="pp-fuel" data-pp-fuel data-deur-exempt="fuel-index">
      <b>{ftp(locale, 'p5_pr_fuel_card', { week: weekLabel(fuelRow.week) })}</b>
      {fuelRow.idx ? <span> · {ftp(locale, 'p5_pr_fuel_idx', { idx: weekLabel(fuelRow.idx) })}</span> : null}
      {fuelRow.okq8 ? <span>: OKQ8 {fuelRow.okq8.avg != null ? `${formatPlNumber(fuelRow.okq8.avg, 2)} SEK/l → ` : ''}{x2(fuelRow.okq8.mult)}</span> : null}
      {fuelRow.orlen ? <span> · Orlen {fuelRow.orlen.avg != null ? `${formatPlNumber(fuelRow.orlen.avg, 2)} PLN/l → ` : ''}{x2(fuelRow.orlen.mult)}</span> : null}
      {fuelRow.applied != null ? <span> · {ftp(locale, 'p5_pr_fuel_lower', { x: x2(fuelRow.applied) })}</span> : null}
      <span> · {ft(locale, `p5_fuel_state_${fuelRow.state}`).toLocaleLowerCase('pl-PL')}</span>
      <button type="button" className="linkbtn pp-link" onClick={() => useTowerStore.getState().setView('fin')}>▸ {ft(locale, 'p5_pr_fuel_link')}</button>
    </div>
  ) : null;

  const plnLine = rateText ? (
    <p className="fin-muted pp-pln" data-deur-exempt="fx-nbp">
      {pln
        ? ftp(locale, 'p5_pr_rate_pln', { rate: rateText })
        : both && midCost && midRev
          ? ftp(locale, 'p5_pr_pln', { rate: rateText, cost: n2(pr.costTotal * midCost), rev: n2(pr.revTotal * midRev), margin: n2(pr.revTotal * midRev - pr.costTotal * midCost) })
          : ftp(locale, 'p5_pr_pln_one', { rate: rateText, amount: n2((role === 'KSH' ? pr.revTotal : pr.costTotal) * (fx?.mid ?? 0)) })}
      {fx?.provisional ? ` ${ft(locale, 'p5_pr_rate_after')}` : ''}
    </p>
  ) : null;

  const header = (
    <header className="pp-hd">
      <h4 className="sec">{both ? ft(locale, 'p5_pr_h') : ft(locale, `p5_pr_h_${role}`)}</h4>
      {tier ? <span className={TIER_TAG[tier]} data-tier={tier}>{up(ft(locale, `tier_${tier}`))}</span> : null}
      {tier && both ? <span className="fin-muted">{ft(locale, `p5_pr_tier_${tier}`)}</span> : null}
    </header>
  );

  const noPrice = pr.moneyError ? (
    <div className="note pp-err" data-money-error>{ftp(locale, 'p5_pr_noprice', { why: pr.moneyError })}{/NO_CONVOY/.test(pr.moneyError) ? ` · ${ft(locale, 'p5_pr_konwoj')}` : ''}</div>
  ) : null;

  const addBtn = canAdd && suggestions ? (
    <button type="button" className={phone ? 'btn pp-add-big' : 'btn pp-add'} data-fee-add onClick={() => setFeeOpen('new')}>{ft(locale, 'p5_pr_fee_add')}</button>
  ) : null;

  const modal = feeOpen ? (
    <Suspense fallback={null}>
      <FeeModal
        load={load}
        role={role as 'HHL' | 'SCX'}
        locale={locale}
        rules={rules}
        suggestions={suggestions ?? []}
        initial={feeOpen === 'new' ? null : feeOpen}
        onClose={() => setFeeOpen(null)}
        onDecide={(id, d) => { setDecided((m) => ({ ...m, [id]: d })); setFeeOpen(null); }}
      />
    </Suspense>
  ) : null;

  if (phone) {
    const card = (key: string, title: ReactNode, body: ReactNode) => (
      <article className="fin-card pp-card" data-pp-card={key}>
        <button type="button" className="fin-card-btn pp-card-hd" aria-expanded={openCard === key} onClick={() => setOpenCard((o) => (o === key ? null : key))}>
          <span>{title}</span><span aria-hidden="true">{openCard === key ? '▴' : '▾'}</span>
        </button>
        {openCard === key ? body : null}
      </article>
    );
    const feeSum = suggestions ? suggestions.reduce((s, x) => s + (role === 'KSH' ? x.revEur : x.costEur), 0) : null;
    return (
      <div className="pp" data-pp-phone>
        {noPrice}
        <div className="fin-cards">
          {showCost ? <article className="fin-card pp-sum" data-pp-total="cost"><b>{ft(locale, 'p5_pr_col_cost')}</b><b>{amt(pr.costTotal, 'cost')} {cur}</b></article> : null}
          {showRev ? <article className="fin-card pp-sum" data-pp-total="rev"><b>{ft(locale, 'p5_pr_col_rev')}</b><b>{amt(pr.revTotal, 'rev')} {cur}</b></article> : null}
          {both ? (
            <article className="fin-card pp-sum" data-pp-margin><b>{ft(locale, 'p5_pr_margin')}</b><b className={below ? 'neg' : undefined}>{n2(margin)} · {mPct != null ? `${formatPlNumber(mPct, 2)} %` : '—'}</b></article>
          ) : null}
          {fuelLabel ? card('fuel', <><b>{ft(locale, 'p5_pr_fuel')}</b> <span className="fin-muted">{fuelLabel}</span></>, <>{fuelCard}{plnLine}</>) : null}
          {suggestions ? card('fees', <><b>{ft(locale, 'p5_pr_fees')}</b> <span className="fin-muted">· {ft(locale, 'p5_pr_fees_sub')} {n2(feeSum ?? 0)} EUR</span></>, feeList) : null}
          {rules ? card('rules', <b>{ft(locale, 'p5_pr_rules_h')}</b>, rulesBlock) : null}
        </div>
        {suggestions ? addBtn : legacyFees}
        {modal}
      </div>
    );
  }

  return (
    <div className="pp" data-pp>
      {header}
      {noPrice}
      <table className="fin-table pp-table" data-pp-table>
        {both ? (
          <thead>
            <tr>
              <th><span className="sronly">{ft(locale, 'p5_doc_col_doc')}</span></th>
              <th className="num">{up(ft(locale, 'p5_pr_col_cost'))}</th>
              <th className="num">{up(ft(locale, 'p5_pr_col_rev'))}</th>
            </tr>
          </thead>
        ) : null}
        <tbody>
          <tr data-pp-row="base">
            <td>{ft(locale, 'p5_pr_base')}{load.itemType ? <span className="fin-muted"> · {load.itemType}</span> : null}</td>
            {showCost ? <td className="num">{amt(pr.costBase, 'cost')}</td> : null}
            {showRev ? <td className="num">{amt(pr.revBase, 'rev')}</td> : null}
          </tr>
          <tr data-pp-row="fuel">
            <td>{ft(locale, 'p5_pr_fuel')}{fuelLabel ? <span className="fin-muted"> {fuelLabel}</span> : null}</td>
            {showCost ? <td className="num" data-fuel-side="cost" data-fuel-ref={money?.cost.fuel.refDate}>{amt(pr.costSefs, 'cost')}</td> : null}
            {showRev ? <td className="num" data-fuel-side="rev" data-fuel-ref={money?.rev.fuel.refDate}>{amt(pr.revSefs, 'rev')}</td> : null}
          </tr>
          <tr data-pp-row="fees">
            <td>{ft(locale, 'p5_pr_fees')}<span className="fin-muted"> · {ft(locale, 'p5_pr_fees_sub')}</span></td>
            {showCost ? <td className="num">{amt(pr.costExtras, 'cost')}</td> : null}
            {showRev ? <td className="num">{amt(pr.revExtras, 'rev')}</td> : null}
          </tr>
        </tbody>
        <tfoot>
          <tr data-pp-row="total">
            <th>{ftp(locale, 'p5_pr_total', { cur })}</th>
            {showCost ? <td className="num">{amt(pr.costTotal, 'cost')}</td> : null}
            {showRev ? <td className="num">{amt(pr.revTotal, 'rev')}</td> : null}
          </tr>
        </tfoot>
      </table>
      {both ? (
        <div className="pp-margin" data-pp-margin>
          <b>{ft(locale, 'p5_pr_margin')}</b>
          <b className={below ? 'neg' : undefined}>{n2(pln && midCost && midRev ? pr.revTotal * midRev - pr.costTotal * midCost : margin)} {cur} · {mPct != null ? `${formatPlNumber(mPct, 2)} %` : '—'}</b>
        </div>
      ) : null}
      {plnLine}
      {fuelCard}
      <section className="pp-sec" aria-labelledby="pp-fees-h">
        <header className="pp-sec-hd">
          <h4 className="sec" id="pp-fees-h">{ft(locale, 'p5_pr_fees_h')}</h4>
          {addBtn}
        </header>
        {suggestions ? feeList : legacyFees}
        {role !== 'HHL' && suggestions ? <p className="fin-muted">{ft(locale, `p5_pr_note_${role}`)}</p> : null}
      </section>
      {rulesBlock}
      {modal}
    </div>
  );
}
