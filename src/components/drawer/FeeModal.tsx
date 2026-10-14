/**
 * wyglad/P5 — okno „Dopłata” (E33, img/e33-after „Dopłata · okno HHL · podpowiedź systemu”; decyzja 09.10 13:09 pkt 5).
 * Rodzaj: postój albo anulowanie. Podpowiedź systemu z wyliczeniem (pomiar ze strefy × zasady cennika albo % frachtu
 * od dni do załadunku). HHL decyduje o swojej części (przychód — potem akceptuje KSH) i widzi część SCX
 * („decyduje SCX; dodaną akceptujesz Ty”); SCX decyduje o swojej (koszt — potem akceptuje HHL).
 * „Nie dodaję” zamyka podpowiedź tej firmy, „Dodaj” — dopłata czeka na akceptację drugiej strony.
 * Zapis (osobne kwoty kosztu i przychodu, wpis w Historii) podłącza wykonawca; w demo stan zostaje na ekranie.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Load, Locale } from '../../types';
import { formatPlNumber } from '../../lib/format';
import { localDateOf } from '../../lib/money/engine';
import { cancelFee, dwellFee, durText, type FeeDecision, type FeeKind, type FeeRules, type FeeSuggestion } from '../../lib/p5Fees';
import { ft, ftp } from '../../i18n/p5';
import { up } from '../options/up';
import '../docs/docs.css';
import './panel.css';

interface Props {
  load: Load;
  role: 'HHL' | 'SCX';
  locale: Locale;
  rules: FeeRules | null;
  suggestions: FeeSuggestion[];
  initial: FeeSuggestion | null;
  onClose: () => void;
  onDecide: (id: string, d: FeeDecision) => void;
}

const n2 = (n: number) => formatPlNumber(n, 2);
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const hm = (iso: string) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export function FeeModal({ load, role, locale, rules, suggestions, initial, onClose, onDecide }: Props) {
  const [kind, setKind] = useState<FeeKind>(initial?.kind ?? 'DWELL');
  const firstRef = useRef<HTMLButtonElement>(null);
  /* podpowiedź: wskazana w panelu albo pierwsza z kwotą danego rodzaju */
  const sug = useMemo(() => {
    if (initial && initial.kind === kind) return initial;
    const list = suggestions.filter((s) => s.kind === kind);
    return list.find((s) => s.costEur > 0 || s.revEur > 0) ?? list[0] ?? null;
  }, [initial, kind, suggestions]);
  const [desc, setDesc] = useState('');
  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  /* wyliczenie z zasad (te same kwoty po obu stronach przy postoju, ten sam % przy anulowaniu) */
  const calc = useMemo(() => {
    if (!sug || !rules) return null;
    if (sug.kind === 'DWELL' && sug.minutes != null && sug.place && sug.enterAt && sug.exitAt) {
      const f = dwellFee(sug.minutes, sug.place, rules);
      if (!f.eur) return null;
      return {
        lines: [
          ftp(locale, 'p5_fee_calc_dwell', { code: load.code, place: ft(locale, `p5_pr_place_${sug.place}`), where: sug.where, from: `${dm(localDateOf(sug.enterAt))}, ${hm(sug.enterAt)}`, to: hm(sug.exitAt) }),
          ftp(locale, 'p5_fee_calc_dwell2', { dur: durText(sug.minutes), free: rules.freeHours[sug.place], over: durText(f.overMin) }),
          ftp(locale, 'p5_fee_calc_dwell3', { hours: f.hours || f.days, rate: f.days ? rules.dayEur : rules.hourEur, fee: `${n2(f.eur)} EUR` }),
        ],
        cost: f.eur, rev: f.eur, costNote: null as string | null, revNote: null as string | null,
      };
    }
    if (sug.kind === 'CANCEL' && sug.cancelledAt && sug.days != null) {
      const c = cancelFee(load.pricing.costBase, load.pricing.revBase, sug.days, rules);
      return {
        lines: [ftp(locale, 'p5_fee_calc_cancel', { at: dm(sug.cancelledAt), load: load.plannedLoadDate ? dm(load.plannedLoadDate) : '—', days: sug.days, pct: c.pct })],
        cost: c.cost, rev: c.rev,
        costNote: ftp(locale, 'p5_fee_pct_of', { pct: c.pct, base: n2(load.pricing.costBase) }),
        revNote: ftp(locale, 'p5_fee_pct_of', { pct: c.pct, base: n2(load.pricing.revBase) }),
      };
    }
    return null;
  }, [sug, rules, locale, load]);

  const box = (title: string, eur: number | null, note: string | null, after: string, mine: boolean) => (
    <div className={mine ? 'fee-box is-mine' : 'fee-box'}>
      <span>{title}</span>
      <b>{eur != null ? `${n2(eur)} EUR` : '—'}</b>
      {note ? <span className="fin-muted">{note}</span> : null}
      <span className="fin-muted">{after}</span>
    </div>
  );

  const decide = (d: FeeDecision) => { if (sug) onDecide(sug.id, d); else onClose(); };

  return (
    <>
      <button type="button" className="scrim" style={{ zIndex: 54 }} aria-label={ft(locale, 'p5_fee_no')} onClick={onClose} />
      <section className="panel awiz-modal fee-modal" role="dialog" aria-modal="true" aria-labelledby="fee-title" data-fee-modal>
        <header className="panel-hd">
          <h2 id="fee-title">{ft(locale, 'p5_fee_h')} · {load.code}</h2>
          <div className="spacer" />
          <button type="button" className="iconbtn" aria-label={ft(locale, 'p5_up_cancel')} onClick={onClose}>✕</button>
        </header>
        <div className="panel-bd awiz-modal-bd fee-bd">
          <div className="up-field" role="group" aria-labelledby="fee-kind">
            <span className="up-lbl" id="fee-kind">{up(ft(locale, 'p5_fee_kind'))}</span>
            <div className="up-seg">
              {(['DWELL', 'CANCEL'] as const).map((k, i) => (
                <button key={k} ref={i === 0 ? firstRef : undefined} type="button" aria-pressed={kind === k} data-fee-kind={k} onClick={() => setKind(k)}>
                  {ft(locale, `p5_fee_${k}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="fee-calc" data-fee-calc data-content>
            {calc ? calc.lines.map((l, i) => (i === calc.lines.length - 1 ? <b key={l}>{l}</b> : <span key={l}>{l}</span>)) : <span>{ft(locale, 'p5_fee_calc_none')}</span>}
          </div>
          <div className="fee-boxes">
            {role === 'HHL' ? (
              <>
                {box(ft(locale, 'p5_fee_rev_mine'), calc?.rev ?? null, calc?.revNote ?? null, ft(locale, 'p5_fee_rev_after'), true)}
                {box(ft(locale, 'p5_fee_cost_scx'), calc?.cost ?? null, calc?.costNote ?? null, ft(locale, 'p5_fee_cost_hhl'), false)}
              </>
            ) : box(ft(locale, 'p5_fee_cost_mine'), calc?.cost ?? null, calc?.costNote ?? null, ft(locale, 'p5_fee_cost_after'), true)}
          </div>
          <label className="up-field">
            <span className="up-lbl">{up(ft(locale, 'p5_fee_desc'))}</span>
            <input className="input" value={desc} placeholder={ft(locale, 'p5_fee_desc_ph')} onChange={(e) => setDesc(e.target.value)} data-fee-desc />
          </label>
          <div className="up-acts">
            <button type="button" className="btn ghost" data-fee-no onClick={() => decide('NIE_DODAJE')}>{ft(locale, 'p5_fee_no')}</button>
            <button type="button" className="btn" data-fee-yes disabled={!calc} onClick={() => decide(role === 'HHL' ? 'CZEKA_KSH' : 'CZEKA_HHL')}>{ft(locale, 'p5_fee_yes')}</button>
          </div>
          <p className="fin-muted">{ft(locale, 'p5_fee_note')}</p>
        </div>
      </section>
    </>
  );
}
