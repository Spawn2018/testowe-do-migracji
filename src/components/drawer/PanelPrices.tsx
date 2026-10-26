/**
 * wyglad/P5 — panel transportu › „Ceny” (E33, img/e33-after; E16 kwoty i kurs, E39 karta opłaty paliwowej).
 * HHL: tabela „Koszt · SCX” / „Przychód · KSH” (fracht z cennika, opłata paliwowa z tygodniem i mnożnikiem, dopłaty,
 * razem), marża z progiem z Opcji (jedna reguła koloru — E16), linia w PLN z kursem, karta opłaty paliwowej.
 * KSH widzi tylko „Twoja cena”, SCX tylko „Twoja stawka” — bez napisu o cudzej cenie (ochrona zostaje w bazie).
 * Dopłaty: tylko postój i anulowanie; system podpowiada, firmy decydują (09.10 13:09 pkt 5) — okno „Dopłata”.
 * Zasady cennika z liczbami. Telefon: karty, szczegóły zwinięte, „+ Dopłata” 44 px (E8).
 * Bez podpowiedzi z bazy (`feeSuggestionsOf` = null) zostaje dzisiejszy formularz dopłat (`legacyFees`).
 */
import { useFuelPublications } from '../../lib/fuelPublSource';
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import type { Load, Locale } from '../../types';
import { useTowerStore } from '../../store/useTowerStore';
import { formatPlNumber } from '../../lib/format';
import { fmtTime, formatCalendarDay } from '../../lib/time';
import { fuelWeeksOf, feeRulesOf, feeSuggestionsOf, marginThresholdOf } from '../../lib/p5Source';
import { addDays, isoWeek, marginPct, mondayOf, weekLabel, weekOf } from '../../lib/p5Finance';
import { durText, reasonReaderOf, rejecterOf, rejectNeedsReason, rejectionVisibleTo, type FeeDecision, type FeeSide, type FeeSuggestion } from '../../lib/p5Fees';
import { lazyRetry } from '../../lib/lazyRetry';
import { localDateOf } from '../../lib/money/engine';
import { loadFxMid } from '../../lib/money/loadPln';
import { ft, ftp } from '../../i18n/p5';
import { fc, fcp } from '../../i18n/p5c';
import '../finance/finance.css';

/* F7 #303 D2: zdanie na początku karty opłaty — wielką literą (teksty „ostateczna …” stoją też w środku zdań) */
const capFirst = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
import './panel.css';

/** F7 (17.10): kwota nie łamie się w środku liczby (spacja tysięcy → niełamliwa). */
const nb = (s: string): string => s.replace(/ /g, '\u00a0');

const FeeModal = lazy(lazyRetry(() => import('./FeeModal').then((m) => ({ default: m.FeeModal }))));

const n2 = (n: number) => formatPlNumber(n, 2);
const x2 = (n: number) => `×${formatPlNumber(n, 2)}`;
/* rok zawsze — właściciel 16.10.2026: „08.10.2026”, „08.10.2026, 12:00” */
const dm = (d: string) => formatCalendarDay(d.slice(0, 10));
const hm = (iso: string) => fmtTime(iso, 'Europe/Warsaw');
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
  /* wyglad/P5-c (E33): odrzucenie dopłaty z powodem — HHL odrzuca dopłatę SCX (powód wymagany), KSH dopłatę HHL */
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<{ id: string; side: FeeSide; draft: string } | null>(null);
  const publV = useFuelPublications();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- publV: publikacje z bazy wczytane później
  const fuelRow = useMemo(() => fuelWeeksOf([load], role === 'KSH' ? 'rev' : 'cost', today)[0] ?? null, [load, role, today, publV]);

  /* E16 (audyt-F F-04): kurs transportu z jednej funkcji — ta sama w Harmonogramie (`loadPln.ts`) */
  const midCost = loadFxMid(load, 'cost');
  const midRev = loadFxMid(load, 'rev');
  const pln = currency === 'PLN' && (role !== 'HHL' ? (role === 'KSH' ? midRev : midCost) : midCost && midRev) != null;
  const cur = pln ? 'PLN' : pr.currency;
  const amt = (eur: number, side: 'cost' | 'rev') => n2(pln ? eur * ((side === 'cost' ? midCost : midRev) ?? 0) : eur);
  const showCost = role !== 'KSH';
  const showRev = role !== 'SCX';
  const both = role === 'HHL';
  const tier = money ? (both ? money.tier : role === 'KSH' ? money.rev.tier : money.cost.tier) : null;
  const fuelSide = money ? (role === 'KSH' ? money.rev : money.cost) : null;
  /* produkcja: brak daty załadunku → `fuel_ref_date` null → refDate '' (bez tygodnia i mnożnika) */
  const fuelRef = fuelSide && /^\d{4}-\d{2}-\d{2}/.test(fuelSide.fuel.refDate) ? fuelSide.fuel.refDate : null;
  /* img/e39-after: „Opłata paliwowa t43 · ×1,13 prognoza” — stan z tej samej funkcji co Finanse */
  const fuelLabel = fuelSide && fuelRef ? `t${isoWeek(fuelRef)} · ${x2(fuelSide.fuel.applied)}${fuelRow?.state === 'PROGNOZA' ? ` ${fc(locale, 'p5c_bd_fuel_fc')}` : ''}` : null;
  const margin = pr.revTotal - pr.costTotal;
  const mPct = marginPct(pr.revTotal, pr.costTotal);
  const below = threshold != null && mPct != null && mPct < threshold;
  const fx = money ? (role === 'KSH' ? money.rev.fx : money.cost.fx) : null;
  const rateText = fx && fx.mid > 0 ? ftp(locale, fx.provisional ? 'p5_pr_rate_now' : 'p5_pr_rate_nbp', { table: fx.tableNo, date: dm(fx.date), mid: formatPlNumber(fx.mid, 4) }) : null;

  /* decyzje osobno po stronie HHL (przychód — akceptuje KSH) i SCX (koszt — akceptuje HHL); klucz „id:strona” */
  const hhlDec = (s: FeeSuggestion): FeeDecision | null => decided[`${s.id}:hhl`] ?? s.hhl;
  const scxDec = (s: FeeSuggestion): FeeDecision | null => decided[`${s.id}:scx`] ?? s.scx;
  const dec = (s: FeeSuggestion): FeeDecision | null => (role === 'SCX' ? scxDec(s) : hhlDec(s));
  const setDec = (s: FeeSuggestion, side: FeeSide, d: FeeDecision, reason?: string) => {
    setDecided((m) => ({ ...m, [`${s.id}:${side}`]: d }));
    if (reason) setReasons((m) => ({ ...m, [`${s.id}:${side}`]: reason }));
  };
  const reasonOf = (s: FeeSuggestion, side: FeeSide) => reasons[`${s.id}:${side}`] ?? (side === 'hhl' ? s.hhlReason : s.scxReason) ?? null;
  /* kto odrzucił: dopłatę HHL odrzuca KSH, dopłatę SCX — HHL; widzi to strona dopłaty i HHL */
  const rejectedLine = (s: FeeSuggestion, side: FeeSide) => {
    const r = reasonOf(s, side);
    const who = rejecterOf(side);
    return <span className="pp-rej-by" data-fee-rejected={side} tabIndex={-1}>{r ? fcp(locale, 'p5c_rej_by', { who, reason: r }) : fcp(locale, 'p5c_rej_by_nr', { who })}</span>;
  };
  const feeTag = (s: FeeSuggestion) => {
    const eur = role === 'KSH' ? s.revEur : role === 'SCX' ? s.costEur : Math.max(s.costEur, s.revEur);
    const d = dec(s);
    if (d) return <span className={d === 'ODRZUCONA' || d === 'NIE_DODAJE' ? 'fin-tag plain' : 'fin-tag warn'}>{ft(locale, `p5_pr_dec_${d}`)}</span>;
    if (s.noMeasure && !eur) return <span className="fin-tag plain">{ft(locale, 'p5_pr_none_tag')}</span>;
    return <span className={eur ? 'fin-tag warn' : 'fin-tag go'} data-fee-eur={eur}>{ftp(locale, 'p5_pr_eur_tag', { n: n2(eur) })}</span>;
  };
  const feeTitle = (s: FeeSuggestion) => (s.kind === 'CANCEL' ? ft(locale, 'p5_pr_cancel') : ftp(locale, 'p5_pr_dwell', { place: ft(locale, `p5_pr_place_${s.place}`), where: s.where }));
  const feeLine = (s: FeeSuggestion) => {
    if (s.noMeasure) return s.noMeasure;
    if (s.kind === 'DWELL' && s.enterAt && s.exitAt && s.minutes != null && rules && s.place) {
      return ftp(locale, 'p5_pr_measured', { from: dmhm(s.enterAt), to: hm(s.exitAt), dur: durText(s.minutes), free: rules.freeHours[s.place] });
    }
    return '';
  };

  const feeList = suggestions ? (
    <div className="pp-fees" data-fee-list>
      {suggestions.map((s) => {
        const mine = role === 'KSH' ? s.revEur : role === 'SCX' ? s.costEur : Math.max(s.costEur, s.revEur);
        const d = dec(s);
        const kshWait = role === 'KSH' && d === 'CZEKA_KSH';
        /* dopłata dodana przez SCX czeka na HHL: „Akceptuję” / „Odrzucam” (09.10 13:09 pkt 5) */
        const hhlWait = role === 'HHL' && scxDec(s) === 'CZEKA_HHL';
        /* formularz tylko dla firmy, która odrzuca tę stronę (Podgląd może zmienić rolę przy otwartym panelu) */
        const rej = rejecting?.id === s.id && rejecterOf(rejecting.side) === role ? rejecting : null;
        const rejNeed = rej ? rejectNeedsReason(rej.side) : false;
        const rejWho = rej ? reasonReaderOf(rej.side) : 'HHL';
        const showHhlRej = rejectionVisibleTo(role, 'hhl') && hhlDec(s) === 'ODRZUCONA';
        const showScxRej = rejectionVisibleTo(role, 'scx') && scxDec(s) === 'ODRZUCONA';
        /* fokus po zamknięciu formularza: „Odrzuć” po anulowaniu, karta po odrzuceniu */
        const refocus = (sel: string) => window.setTimeout(() => (document.querySelector(`[data-fee-id="${s.id}"] ${sel}`) as HTMLElement | null)?.focus(), 0);
        const closeRej = () => { setRejecting(null); refocus('[data-fee-reject]'); };
        return (
          <article key={s.id} className={kshWait || hhlWait ? 'pp-fee is-wait' : 'pp-fee'} data-fee={s.kind} data-fee-place={s.place ?? ''} data-fee-id={s.id}>
            <div className="pp-fee-tx">
              <b>{feeTitle(s)}</b>
              <span data-content>{feeLine(s)}</span>
              {s.zone && !s.noMeasure ? <span className="fin-muted" data-content>{ftp(locale, 'p5_pr_zone', { zone: s.zone })}</span> : null}
              {mine > 0 && s.kind === 'DWELL' && s.minutes != null && s.place && rules ? (
                <span className="pp-over" data-content>{ftp(locale, 'p5_pr_over', { dur: durText(s.minutes - rules.freeHours[s.place] * 60), fee: `${n2(mine)} EUR` })}</span>
              ) : role === 'SCX' && !s.noMeasure && !mine ? <span className="fin-muted">{ft(locale, 'p5_pr_fee_nothing')}</span> : null}
              {kshWait ? <span className="fin-muted">{ft(locale, 'p5_pr_fee_wait_KSH')}</span> : null}
              {hhlWait ? <span className="fin-muted" data-content>{ftp(locale, 'p5_pr_fee_wait_HHL', { fee: `${n2(s.costEur)} EUR` })}</span> : null}
              {showHhlRej ? rejectedLine(s, 'hhl') : null}
              {showScxRej ? rejectedLine(s, 'scx') : null}
              {rej ? (
                <form
                  className="pp-rej"
                  data-fee-reject-form={rej.side}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (rejNeed && !rej.draft.trim()) return;
                    setDec(s, rej.side, 'ODRZUCONA', rej.draft.trim() || undefined);
                    setRejecting(null);
                    refocus('[data-fee-rejected]');
                  }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); closeRej(); } }}
                >
                  <label className="pp-rej-l">
                    <span>{fc(locale, 'p5c_rej_label')}</span>
                    <input
                      className="input"
                      // eslint-disable-next-line jsx-a11y/no-autofocus -- fokus z „Odrzuć” na pole powodu
                      autoFocus
                      value={rej.draft}
                      placeholder={fc(locale, 'p5c_rej_ph')}
                      aria-describedby={`pp-rej-h-${s.id}`}
                      aria-required={rejNeed || undefined}
                      onChange={(e) => setRejecting({ ...rej, draft: e.target.value })}
                    />
                  </label>
                  <span className="fin-muted" id={`pp-rej-h-${s.id}`}>{fcp(locale, rejNeed ? 'p5c_rej_need' : 'p5c_rej_opt', { who: rejWho })}</span>
                  <span className="pp-rej-act">
                    <button type="button" className="btn ghost" onClick={closeRej}>{fc(locale, 'p5c_rej_cancel')}</button>
                    <button type="submit" className="btn" data-fee-reject-ok disabled={rejNeed && !rej.draft.trim()}>
                      {fc(locale, 'p5c_rej_ok')}
                    </button>
                  </span>
                </form>
              ) : null}
            </div>
            <div className="pp-fee-act">
              {rej ? null : kshWait || hhlWait ? (
                <>
                  <button type="button" className="btn" data-fee-accept onClick={() => setDec(s, kshWait ? 'hhl' : 'scx', 'PRZYJETA')}>{ft(locale, 'p5_pr_fee_accept')}</button>
                  <button type="button" className="btn ghost" data-fee-reject onClick={() => setRejecting({ id: s.id, side: kshWait ? 'hhl' : 'scx', draft: '' })}>{ft(locale, 'p5_pr_fee_reject')}</button>
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
        <dt>{ftp(locale, 'p5_pr_rule_day', { h: rules.dayAfterH })}</dt><dd>{ftp(locale, 'p5_pr_rule_day_v', { eur: rules.dayEur })}</dd>
        <dt>{ft(locale, 'p5_pr_rule_cancel')}</dt>
        <dd>{ftp(locale, 'p5_pr_rule_cancel_v', { d5: rules.cancelPct[5], d4: rules.cancelPct[4], d3: rules.cancelPct[3], d2: rules.cancelPct[2], d1: rules.cancelPct[1], d0: rules.cancelPct[0] })}</dd>
      </dl>
      <p className="fin-muted">{ft(locale, 'p5_pr_rules_note')}</p>
    </section>
  ) : null;

  /* P11 (e39, E39 „karta w panelu”): karta „Opłata paliwowa ×…” ze znacznikiem stanu i polami — obowiązuje w tygodniu,
     wskaźniki z tygodnia, OKQ8 i Orlen (średnia, liczba publikacji, mnożnik), stosowany; zdanie wyjaśnienia i publikacje */
  const src = (s: { avg: number | null; n: number | null; mult: number }, unit: 'SEK/l' | 'PLN/l', n: string) => (
    <>{s.avg != null ? `${formatPlNumber(s.avg, 2)}\u00a0${unit}${n ? `\u00a0${n}` : ''} → ` : ''}{x2(s.mult)}</>
  );
  const fuelCard = fuelRow && fuelRow.week ? (
    <div className="pp-fuel" data-pp-fuel data-deur-exempt="fuel-index">
      <div className="pp-fuel-hd">
        <b>{ft(locale, 'p5_pr_fuel')}{fuelRow.applied != null ? ` ${x2(fuelRow.applied)}` : ''}</b>
        <span className={fuelRow.state === 'OSTATECZNA' ? 'fin-tag go' : fuelRow.state === 'PROGNOZA' ? 'fin-tag plain' : 'fin-tag warn'} data-pp-fuel-state={fuelRow.state}>
          {ft(locale, `p5_fuel_state_${fuelRow.state}`)}
        </span>
      </div>
      <dl className="pp-fuel-kv">
        <dt>{ft(locale, 'p5_pr_fuel_k_week')}</dt><dd>{weekLabel(fuelRow.week)}</dd>
        {fuelRow.idx ? <><dt>{ft(locale, 'p5_pr_fuel_k_idx')}</dt><dd>{weekLabel(fuelRow.idx)}</dd></> : null}
        {fuelRow.okq8 ? <><dt>{ft(locale, 'p5_fuel_col_okq8')}</dt><dd>{src(fuelRow.okq8, 'SEK/l', fuelRow.okq8.n ? fcp(locale, 'p5c_fuel_n', { n: fuelRow.okq8.n }) : '')}</dd></> : null}
        {fuelRow.orlen ? <><dt>{ft(locale, 'p5_fuel_col_orlen')}</dt><dd>{src(fuelRow.orlen, 'PLN/l', fuelRow.orlen.n ? fcp(locale, 'p5c_fuel_n', { n: fuelRow.orlen.n }) : '')}</dd></> : null}
        {fuelRow.applied != null ? (
          <>
            <dt>{ft(locale, 'p5_pr_fuel_k_applied')}</dt>
            <dd>{fuelRow.state === 'PROGNOZA' && fuelRow.running && fuelRow.idx
              ? fcp(locale, 'p5c_fuel_running', { x: x2(fuelRow.applied), last: `t${weekOf(addDays(mondayOf(today), -7)).no}` })
              : ftp(locale, 'p5_pr_fuel_lower', { x: x2(fuelRow.applied) })}</dd>
          </>
        ) : null}
      </dl>
      <p className="pp-fuel-note">
        {fuelRow.state === 'PROGNOZA' ? (
          <span data-pp-final={fuelRow.finalFrom ?? ''}>{capFirst(fuelRow.finalFrom ? fcp(locale, 'p5c_fuel_final_from', { date: dm(fuelRow.finalFrom) }) : fc(locale, 'p5c_fuel_until'))}. </span>
        ) : null}
        {ft(locale, 'p5_pr_fuel_note')}{' '}
        <button type="button" className="linkbtn pp-link" onClick={() => useTowerStore.getState().setView('fin')}>▸ {ft(locale, 'p5_pr_fuel_link')}</button>
      </p>
    </div>
  ) : null;

  const plnLine = rateText ? (
    <p className="fin-muted pp-pln" data-deur-exempt="fx-nbp">
      {pln
        ? ftp(locale, 'p5_pr_rate_pln', { rate: rateText })
        : both && midCost && midRev
          ? ftp(locale, 'p5_pr_pln', { rate: rateText, cost: nb(n2(pr.costTotal * midCost)), rev: nb(n2(pr.revTotal * midRev)), margin: nb(n2(pr.revTotal * midRev - pr.costTotal * midCost)) })
          : ftp(locale, 'p5_pr_pln_one', { rate: rateText, amount: nb(n2((role === 'KSH' ? pr.revTotal : pr.costTotal) * (fx?.mid ?? 0))) })}
      {fx?.provisional ? ` ${ft(locale, 'p5_pr_rate_after')}` : ''}
    </p>
  ) : null;

  const header = (
    <header className="pp-hd">
      <h4 className="sec">{both ? ft(locale, 'p5_pr_h') : ft(locale, `p5_pr_h_${role}`)}</h4>
      {tier ? <span className={TIER_TAG[tier]} data-tier={tier}>{ft(locale, `tier_${tier}`)}</span> : null}
      {tier && both ? <span className="fin-muted">{ft(locale, `p5_pr_tier_${tier}`)}</span> : null}
    </header>
  );

  const noPrice = pr.moneyError ? (
    <div className="note pp-err" data-money-error>{ftp(locale, 'p5_pr_noprice', { why: pr.moneyError })}{/NO_CONVOY/.test(pr.moneyError) ? ` · ${ft(locale, 'p5_pr_konwoj')}` : ''}</div>
  ) : null;

  /* P11 (e33): „+ Dopłata” nad listą tylko u HHL; SCX proponuje dopłatę przyciskiem przy wierszu, gdy pomiar przekroczy czas wolny */
  const addBtn = role === 'HHL' && suggestions ? (
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
        onDecide={(id, d) => { setDecided((m) => ({ ...m, [`${id}:${role === 'SCX' ? 'scx' : 'hhl'}`]: d })); setFeeOpen(null); }}
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
          {/* P11 pkt 7 (e33): KSH i SCX — „Twoja cena” / „Twoja stawka”, jak na komputerze; HHL — obie strony */}
          {showCost ? <article className="fin-card pp-sum" data-pp-total="cost"><b>{ft(locale, both ? 'p5_pr_col_cost' : 'p5_pr_h_SCX')}</b><b>{amt(pr.costTotal, 'cost')} {cur}</b></article> : null}
          {showRev ? <article className="fin-card pp-sum" data-pp-total="rev"><b>{ft(locale, both ? 'p5_pr_col_rev' : 'p5_pr_h_KSH')}</b><b>{amt(pr.revTotal, 'rev')} {cur}</b></article> : null}
          {both ? (
            <article className="fin-card pp-sum" data-pp-margin><b>{ft(locale, 'p5_pr_margin')}</b><b className={below ? 'neg' : undefined}>{n2(pln && midCost && midRev ? pr.revTotal * midRev - pr.costTotal * midCost : margin)} {cur} · {mPct != null ? `${formatPlNumber(mPct, 2)}%` : '—'}</b></article>
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
              <th className="num">{ft(locale, 'p5_pr_col_cost')}</th>
              <th className="num">{ft(locale, 'p5_pr_col_rev')}</th>
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
          <b className={below ? 'neg' : undefined}>{n2(pln && midCost && midRev ? pr.revTotal * midRev - pr.costTotal * midCost : margin)} {cur} · {mPct != null ? `${formatPlNumber(mPct, 2)}%` : '—'}</b>
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
