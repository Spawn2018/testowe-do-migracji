/**
 * wyglad/P5 — Opcje › Pieniądze › Faktoring: „Oferta HHL” (E4b, img/e4b-desk; decyzja 07.10).
 * Włącznik, kto wypłaca, prowizja % od netto, wypłata po akceptacji, dla kogo, wersja z datą, przykład wyliczenia.
 * Pola i zapis jak dziś (`factoringOffer` w demo; w produkcji ekran ukryty do podłączenia — `shows('factoringOffer')`).
 */
import type { FactoringOffer, Locale } from '../../types';
import { formatPlNumber } from '../../lib/format';
import { factoringPayout } from '../../lib/p5Invoices';
import { factoringOfferOf } from '../../lib/p5Source';
import { ft, ftp } from '../../i18n/p5';
import '../finance/finance.css';
import '../invoices/invoices.css';
import { formatCalendarDay } from '../../lib/time';

interface Props {
  locale: Locale;
  offer: FactoringOffer;
  readOnly: boolean;
  onChange: <K extends keyof FactoringOffer>(key: K, value: FactoringOffer[K]) => void;
  onSaved: (what: string) => void;
}

const n2 = (n: number) => formatPlNumber(n, 2);
const dmy = (d: string) => formatCalendarDay(d.slice(0, 10));

export function FactoringOfferScreen({ locale, offer, readOnly, onChange, onSaved }: Props) {
  const view = factoringOfferOf();
  /* przykład wyliczenia: okrągła kwota netto, VAT 23 % (E4) — bez danych z faktur */
  const net = 10000;
  const gross = 12300;
  const cur = 'EUR';
  const { fee, payout } = factoringPayout(net, gross, offer.feePercent);
  return (
    <div className="fact-offer" data-fact-offer>
      <dl className="fin-dl fact-dl">
        <dt>{ft(locale, 'p5_fo_on')}</dt>
        <dd>
          {/* P11 (e4b): przełącznik jak w innych ekranach Opcji (nie pole wyboru) */}
          <span className="ox-switchline">
            <button
              type="button"
              className="ox-switch"
              role="switch"
              aria-checked={offer.enabled}
              aria-label={ft(locale, 'p5_fo_on')}
              disabled={readOnly}
              data-fo-enabled
              onClick={() => { onChange('enabled', !offer.enabled); onSaved('factoring'); }}
            ><span className="ox-track"><i /></span></button>
            <span>{ft(locale, offer.enabled ? 'p5_fo_on_yes' : 'p5_fo_on_no')}</span>
          </span>
        </dd>
        <dt>{ft(locale, 'p5_fo_who')}</dt><dd>{ft(locale, 'p5_fo_who_v')}</dd>
        <dt>{ft(locale, 'p5_fo_fee')}</dt>
        <dd className="fact-inline">
          <input className="input" type="number" min="0" max="20" step="0.1" aria-label={ft(locale, 'p5_fo_fee')} value={offer.feePercent} disabled={readOnly}
            onChange={(e) => onChange('feePercent', Number(e.target.value) || 0)} onBlur={() => onSaved('prowizja')} />
          <span>{ft(locale, 'p5_fo_fee_v')}</span>
        </dd>
        <dt>{ft(locale, 'p5_fo_payout')}</dt>
        <dd className="fact-inline">
          <input className="input" type="number" min="1" aria-label={ft(locale, 'p5_fo_payout')} value={offer.payoutDelayValue} disabled={readOnly}
            onChange={(e) => onChange('payoutDelayValue', Number(e.target.value) || 1)} onBlur={() => onSaved('termin')} />
          <select className="input" aria-label={ft(locale, 'p5_fo_unit')} value={offer.payoutDelayUnit} disabled={readOnly}
            onChange={(e) => { onChange('payoutDelayUnit', e.target.value as FactoringOffer['payoutDelayUnit']); onSaved('termin'); }}>
            <option value="hours">h</option>
            <option value="days">{ft(locale, 'p5_fo_days')}</option>
          </select>
          <span>{ft(locale, 'p5_fo_payout_v')}</span>
        </dd>
        <dt>{ft(locale, 'p5_fo_for')}</dt><dd>Scandinavian Express</dd>
        {view ? <><dt>{ft(locale, 'p5_fo_from')}</dt><dd>{ftp(locale, 'p5_fo_from_v', { date: dmy(view.from), v: view.version })}</dd></> : null}
      </dl>
      <h4 className="sec fact-ex-h">{ft(locale, 'p5_fo_ex_h')}</h4>
      <dl className="inv-sum fact-ex" data-deur-exempt="invoice-currency">
        <div><dt>{ft(locale, 'p5_fo_ex_gross')}</dt><dd>{n2(gross)} {cur}</dd></div>
        <div><dt>{ftp(locale, 'p5_fo_ex_fee', { pct: formatPlNumber(offer.feePercent, offer.feePercent % 1 ? 1 : 0), net: n2(net) })}</dt><dd>− {n2(fee)} {cur}</dd></div>
        <div className="strong"><dt>{ft(locale, 'p5_fo_ex_pay')}</dt><dd>{n2(payout)} {cur}</dd></div>
      </dl>
      <p className="fin-muted">{ft(locale, 'p5_fo_note')}</p>
    </div>
  );
}
