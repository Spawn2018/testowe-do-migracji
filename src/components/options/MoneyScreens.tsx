/**
 * wyglad/P5-b — Opcje › Pieniądze (dopisek D-20261015-0300-01, PLAN §4 P5 „Ekrany — wygląd”):
 * - Opłata paliwowa według E3 (img/e3-opcje-desk, img/e3-opcje-phone) i E39 (jedna nazwa, bez „SEFS”);
 * - Dopłaty: postój według E33 (bez „WSTĘPNE”, wybory przyciskami — E12);
 * - Cennik i opłaty: procenty za anulowanie (E33) i próg marży (E16) nad dzisiejszym formularzem cennika;
 * - Terminy płatności i adresy (E40, img/e40-after „Opcje › Adresy księgowości”).
 * Zmiana wartości jak w Opcje › Progi alarmów: „Zmień” → pole → „Zapisz” → pytanie „było → jest” → „Tak, zmień”.
 * Operacje HHL widzą wszystko tylko do odczytu (E12, pytanie 1). Dane i zapis: `p5bSource.ts` (wykonawca w P5).
 */
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Locale } from '../../types';
import type { PackKey } from '../../lib/p5Pack';
import { formatPlNumber } from '../../lib/format';
import { TZ_OPERACYJNA } from '../../lib/money/engine';
import {
  CANCEL_DAYS, feeOf, looksLikeEmail, pctOf, tierOf, tiersAround,
  type CancelRulesView, type DwellRulesView, type FuelActions, type FuelDayRow, type FuelScreenView, type FuelSource, type FuelTier, type PaymentTermsView,
} from '../../lib/p5bFuel';
import type { DwellPatch, TestMailResult } from '../../lib/p5bSource';
import { t } from '../../i18n/messages';
import { fb, fbp } from '../../i18n/p5b';
import { up } from './up';
import './money.css';

/* ---------- formaty ---------- */

const n2 = (n: number) => formatPlNumber(n, 2);
const n3 = (n: number) => formatPlNumber(n, 3);
const mult = (m: number | null) => (m == null ? '—' : formatPlNumber(m, 2));
const pctTxt = (m: number | null) => {
  const p = pctOf(m);
  return p == null ? '—' : formatPlNumber(p, p % 1 ? 1 : 0);
};
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
/** „05–11.10” w jednym miesiącu, „28.09–04.10” na przełomie. */
const range = (a: string, b: string) => (a.slice(5, 7) === b.slice(5, 7) ? `${a.slice(8, 10)}–${dm(b)}` : `${dm(a)}–${dm(b)}`);
const wd = (locale: Locale, d: string) => fb(locale, `p5b_wd_${(new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7}`);
const srcName = (s: FuelSource) => (s === 'OKQ8' ? 'OKQ8' : 'Orlen');
/** „07.10, 12:35” w czasie polskim, także gdy baza poda UTC. */
const changedAt = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('pl-PL', { timeZone: TZ_OPERACYJNA, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const g = (k: string) => parts.find((x) => x.type === k)?.value ?? '';
  return `${g('day')}.${g('month')}, ${g('hour')}:${g('minute')}`;
};
/** Zapis, który się wysypał, liczymy jak nieudany (komunikat zamiast zawieszonego przycisku). */
const safe = <T,>(p: Promise<T>, fail: T): Promise<T> => p.catch(() => fail);

/** Komunikat dla czytnika ekranu: element zawsze w drzewie, treść pojawia się po zapisie. */
function Live({ msg }: { msg: string | null }) {
  return <p className="ox-foot pm-live" role="status">{msg ?? ''}</p>;
}

/** Wybór przyciskami (wzór: Opcje › Użytkownicy): strzałki przenoszą wybór, Tab wchodzi tylko na zaznaczony. */
function SegRadio<V extends string>({ label, value, options, nameOf, disabled, onPick }: {
  label: string;
  value: V;
  options: readonly V[];
  nameOf: (v: V) => string;
  disabled: boolean;
  onPick: (v: V) => void;
}) {
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d || disabled) return;
    e.preventDefault();
    const next = options[(i + d + options.length) % options.length];
    const btns = e.currentTarget.parentElement?.querySelectorAll('button');
    (btns?.[options.indexOf(next)] as HTMLButtonElement | undefined)?.focus();
    onPick(next);
  };
  return (
    <span className="ox-seg" role="radiogroup" aria-label={label}>
      {options.map((v, i) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} tabIndex={value === v ? 0 : -1} disabled={disabled} onKeyDown={(e) => onKey(e, i)} onClick={() => onPick(v)}>{nameOf(v)}</button>
      ))}
    </span>
  );
}

/* ---------- wiersze wartości ze zmianą i pytaniem (wzór: Progi alarmów) ---------- */

interface ValueRow {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  fx?: ReactNode;
  min?: number;
  max?: number;
  /** liczba miejsc po przecinku w polu */
  digits?: number;
}

function ValueRows({ locale, rows, readOnly, onSave, allowEmpty }: {
  locale: Locale;
  rows: ValueRow[];
  readOnly: boolean;
  onSave: ((key: string, value: number | null) => Promise<boolean>) | null;
  /** Puste pole = brak wartości (np. próg marży wyłączony). */
  allowEmpty?: boolean;
}) {
  const [vals, setVals] = useState<Record<string, number | null>>(() => Object.fromEntries(rows.map((r) => [r.key, r.value])));
  const [edit, setEdit] = useState<{ key: string; draft: string; ask: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fmt = (n: number | null, digits = 0) => (n == null ? fb(locale, 'p5b_not_set') : formatPlNumber(n, Number.isInteger(n) ? 0 : digits || 2));
  const parse = (d: string): number | null => (d.trim() === '' ? null : Number(d.replace(',', '.').replace(/\s/g, '')));
  const valid = (r: ValueRow, v: number | null) => (v == null ? !!allowEmpty : Number.isFinite(v) && v >= (r.min ?? 0) && (r.max == null || v <= r.max));
  const canEdit = !readOnly && !!onSave;
  return (
    <>
      <ul className="ox-thr-list pm-rows">
        {rows.map((r) => {
          const editing = edit?.key === r.key;
          const v = vals[r.key] ?? null;
          const draftVal = editing ? parse(edit.draft) : null;
          const show = (n: number | null) => (n == null ? fmt(n) : `${fmt(n, r.digits)} ${r.unit}`);
          return (
            <li key={r.key} data-pm-row={r.key} className={editing ? 'is-edit' : undefined}>
              <span className="ox-thr-label">{r.label}</span>
              {editing ? (
                <span className="ox-thr-edit">
                  {edit.ask ? (
                    <span className="ox-thr-ask">{t(locale, 'p3c_thr_ask').replace('{name}', r.label).replace('{was}', show(v)).replace('{is}', show(draftVal))}</span>
                  ) : (
                    <label className="ox-thr-input">
                      <input className="input" inputMode="decimal" aria-label={r.label} value={edit.draft} onChange={(e) => setEdit({ ...edit, draft: e.target.value })} />
                      <span>{r.unit}</span>
                    </label>
                  )}
                  {r.fx ? <span className="ox-thr-val"><span>— {r.fx}</span></span> : null}
                </span>
              ) : (
                <span className="ox-thr-val"><b data-content>{show(v)}</b>{r.fx ? <span> — {r.fx}</span> : null}</span>
              )}
              {!canEdit ? null : editing ? (
                <span className="ox-thr-btns">
                  <button type="button" className="btn ghost ox-btn" onClick={() => setEdit(null)}>{t(locale, 'p3c_cancel')}</button>
                  {edit.ask ? (
                    <button
                      type="button"
                      className="btn ox-btn"
                      // eslint-disable-next-line jsx-a11y/no-autofocus -- fokus przechodzi z „Zapisz” na pytanie (ten sam wiersz)
                      autoFocus
                      onClick={() => {
                        const nv = draftVal;
                        setEdit(null);
                        setBusy(true);
                        void safe(onSave(r.key, nv), false).then((res) => {
                          setBusy(false);
                          if (res) setVals((s) => ({ ...s, [r.key]: nv }));
                          setMsg(fb(locale, res ? 'p5b_saved' : 'p5b_save_fail'));
                        });
                      }}
                    >
                      {t(locale, 'p3c_yes_change')}
                    </button>
                  ) : (
                    <button type="button" className="btn ox-btn" disabled={!valid(r, draftVal) || draftVal === v} onClick={() => setEdit({ ...edit, ask: true })}>{t(locale, 'p3c_m_save')}</button>
                  )}
                </span>
              ) : (
                <button type="button" className="btn ghost ox-btn" disabled={busy} onClick={() => { setMsg(null); setEdit({ key: r.key, draft: v == null ? '' : formatPlNumber(v, Number.isInteger(v) ? 0 : r.digits ?? 2).replace(/\s/g, ''), ask: false }); }}>{t(locale, 'p3c_thr_change')}</button>
              )}
            </li>
          );
        })}
      </ul>
      <Live msg={msg} />
    </>
  );
}

function Changed({ locale, changed }: { locale: Locale; changed: { at: string; by: string } | null }) {
  return changed ? <span className="ox-muted pm-changed">{fbp(locale, 'p5b_changed', { at: changedAt(changed.at), by: changed.by })}</span> : null;
}

/* ---------- Opłata paliwowa (E3, E39) ---------- */

function TierTable({ locale, head, tiers, avg, all }: { locale: Locale; head: string; tiers: FuelTier[]; avg: number | null; all: boolean }) {
  const near = tiersAround(tiers, avg);
  const rows = all ? tiers : near.rows;
  const hitRow = all ? tierOf(tiers, avg) : near.hit;
  const dig = 2;
  return (
    <table className="ox-table pm-tiers-t">
      <thead><tr><th scope="col">{up(head)}</th><th scope="col" className="num">{up(fb(locale, 'p5b_f_col_mult'))}</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.from}`} className={i === hitRow ? 'pm-hit' : undefined} data-pm-tier-hit={i === hitRow ? '' : undefined}>
            <th scope="row" className="tabular">
              {formatPlNumber(r.from, dig)} – {formatPlNumber(r.to, dig)}
              {i === hitRow && avg != null ? <span className="pm-at" aria-hidden> ◀ </span> : null}
              {i === hitRow && avg != null ? <span className="pm-at-v">{formatPlNumber(avg, 2)}</span> : null}
            </th>
            <td className="num tabular">{mult(r.mult)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function dayHow(locale: Locale, r: FuelDayRow): string {
  if (r.how === 'MISSING' && r.missing) return fbp(locale, 'p5b_f_how_missing', { src: srcName(r.missing.source), why: r.missing.why });
  if (r.how === 'FILLED') return fb(locale, 'p5b_f_how_filled');
  return fbp(locale, 'p5b_f_how_auto', { at: r.at ?? '' });
}

function FetchMark({ ok }: { ok: boolean | null }) {
  if (ok == null) return <span className="pm-fetch-wait" role="img" aria-label="jeszcze nie pobrano">—</span>;
  return ok ? <span className="pm-ok" role="img" aria-label="pobrano">✓</span> : <span className="pm-bad" role="img" aria-label="błąd">✕</span>;
}

export function FuelScreen({ locale, view, actions, readOnly }: {
  locale: Locale;
  view: FuelScreenView;
  actions: FuelActions | null;
  readOnly: boolean;
}) {
  const [allTiers, setAllTiers] = useState(false);
  const [fillMsg, setFillMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verNote, setVerNote] = useState(false);
  const { current: cur, next, fetch, alarm } = view;
  const exFee = feeOf(view.exampleBaseEur, cur.applied);
  const fill = actions?.fill ?? null;
  const fetchLine = (label: string, d: typeof fetch.today) => (
    <p className="pm-fetch">
      <span>{fbp(locale, label, { date: dm(d.date) })} </span>
      <span className={d.okq8 === false ? 'pm-bad' : d.okq8 ? 'pm-ok' : undefined}>OKQ8 <FetchMark ok={d.okq8} /></span>
      <span> · </span>
      <span className={d.orlen === false ? 'pm-bad' : d.orlen ? 'pm-ok' : undefined}>Orlen <FetchMark ok={d.orlen} /></span>
    </p>
  );
  return (
    <div className="pm-fuel" data-pm-fuel data-deur-exempt="fuel-index">
      <div className="pm-head">
        <span className="pm-head-sub">{fbp(locale, 'p5b_f_sub', { v: view.contract.version, date: dmy(view.contract.from) })}</span>
        <span className={`ox-tag${view.contract.agreed ? ' ox-tag-active' : ' ox-tag-unfinished'}`}>{up(fb(locale, view.contract.agreed ? 'p5b_f_agreed' : 'p5b_f_not_agreed'))}</span>
      </div>

      {alarm ? (
        <div className="pm-alarm" role="alert" data-pm-alarm={alarm.source}>
          <p className="pm-alarm-tx">
            <b>{fbp(locale, 'p5b_f_alarm_t', { src: srcName(alarm.source), date: dm(alarm.date) })}</b>{' '}
            {alarm.published != null
              ? fbp(locale, 'p5b_f_alarm_x', { at: alarm.at, src: srcName(alarm.source), price: `${n3(alarm.published)} ${alarm.source === 'OKQ8' ? 'SEK/l' : 'PLN/l'}`, week: range(alarm.affectsFrom, alarm.affectsTo) })
              : fbp(locale, 'p5b_f_alarm_x_np', { at: alarm.at, src: srcName(alarm.source), week: range(alarm.affectsFrom, alarm.affectsTo) })}
          </p>
          <div className="pm-alarm-act">
            {fill && !readOnly ? (
              <button
                type="button"
                className="btn ox-btn"
                data-pm-fill
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void safe(fill(alarm.source, alarm.date), false).then((res) => {
                    setBusy(false);
                    setFillMsg(res ? fbp(locale, 'p5b_f_filled', { src: srcName(alarm.source), date: dm(alarm.date) }) : fb(locale, 'p5b_f_fill_fail'));
                  });
                }}
              >
                {fbp(locale, 'p5b_f_fill', { src: srcName(alarm.source) })}
              </button>
            ) : null}
            <span className="ox-muted">{alarm.nextTry ? fbp(locale, 'p5b_f_next_try', { at: alarm.nextTry }) : fb(locale, 'p5b_f_no_try')}</span>
          </div>
          <Live msg={fillMsg} />
        </div>
      ) : null}

      <div className="pm-cards">
        <section className={`pm-card${cur.final ? ' is-now' : ''}`} data-pm-week="now">
          <span className="ox-eyebrow">{up(fbp(locale, 'p5b_f_now_h', { range: range(cur.from, cur.to) }))}</span>
          <span className="pm-big"><b className="tabular">+{pctTxt(cur.applied)} %</b> <span className="pm-x">×{mult(cur.applied)}</span></span>
          <span className="pm-card-l">{fbp(locale, cur.final ? 'p5b_f_final' : 'p5b_f_forecast_from', { range: range(cur.idxFrom, cur.idxTo) })}</span>
          <span className="pm-card-l">{fbp(locale, 'p5b_f_applies', { from: dm(cur.from), to: dm(cur.to) })}</span>
        </section>
        <section className="pm-card" data-pm-week="next">
          <span className="ox-eyebrow">{up(fbp(locale, 'p5b_f_next_h', { range: range(next.from, next.to) }))}</span>
          <span className="pm-big"><b className="tabular">+{pctTxt(next.forecast)} %</b> <span className="pm-fc">{fb(locale, 'p5b_f_forecast')}</span></span>
          <span className="pm-card-l">{fbp(locale, 'p5b_f_next_x', { date: dm(next.finalOn), range: range(next.idxFrom, next.idxTo) })}</span>
        </section>
        <section className="pm-card" data-pm-fetch>
          <span className="ox-eyebrow">{up(fbp(locale, 'p5b_f_fetch_h', { at: fetch.at }))}</span>
          {fetchLine('p5b_f_today', fetch.today)}
          {fetchLine('p5b_f_yesterday', fetch.yesterday)}
          <span className="pm-card-l">{fbp(locale, 'p5b_f_retries', { list: fetch.retries.join(' i ') })}</span>
        </section>
      </div>

      <h4 className="ox-eyebrow pm-h">{up(fb(locale, 'p5b_f_how_h'))}</h4>
      <div className="pm-how">
        <div className="pm-step"><b className="pm-step-h">{fb(locale, 'p5b_f_s1')}</b><span>{fb(locale, 'p5b_f_s1_x')}</span><b className="pm-step-v tabular">{fbp(locale, 'p5b_f_s1_v', { sek: cur.okq8.avg == null ? '—' : n2(cur.okq8.avg), pln: cur.orlen.avg == null ? '—' : n2(cur.orlen.avg) })}</b></div>
        <div className="pm-step"><b className="pm-step-h">{fb(locale, 'p5b_f_s2')}</b><span>{fb(locale, 'p5b_f_s2_x')}</span><b className="pm-step-v tabular">{fbp(locale, 'p5b_f_s2_v', { a: mult(cur.okq8.mult), b: mult(cur.orlen.mult) })}</b></div>
        <div className="pm-step"><b className="pm-step-h">{fb(locale, 'p5b_f_s3')}</b><span>{fb(locale, 'p5b_f_s3_x')}</span><b className="pm-step-v tabular">×{mult(cur.applied)}</b></div>
        <div className="pm-step"><b className="pm-step-h">{fb(locale, 'p5b_f_s4')}</b><span>{fb(locale, 'p5b_f_s4_x')}</span><b className="pm-step-v tabular">{fbp(locale, 'p5b_f_s4_v', { base: formatPlNumber(view.exampleBaseEur, 0), pct: pctTxt(cur.applied), fee: exFee == null ? '—' : formatPlNumber(exFee, exFee % 1 ? 2 : 0) })}</b></div>
      </div>

      <div className="pm-two">
        <section className="pm-days">
          <h4 className="ox-eyebrow pm-h">{up(fb(locale, 'p5b_f_days_h'))}</h4>
          <div className="pm-scroll">
            <table className="ox-table pm-days-t">
              <thead>
                <tr>
                  <th scope="col">{up(fb(locale, 'p5b_f_col_day'))}</th>
                  <th scope="col" className="num">{up(fb(locale, 'p5b_f_col_okq8'))}</th>
                  <th scope="col" className="num">{up(fb(locale, 'p5b_f_col_orlen'))}</th>
                  <th scope="col" className="pm-how-c">{up(fb(locale, 'p5b_f_col_how'))}</th>
                </tr>
              </thead>
              {view.days.map((g) => (
                <tbody key={g.from}>
                  <tr className="pm-grp">
                    <th scope="rowgroup" colSpan={4}>
                      {up(g.closed
                        ? fbp(locale, 'p5b_f_grp_closed', { range: range(g.from, g.to), sek: g.closed.okq8 == null ? '—' : n2(g.closed.okq8), pln: g.closed.orlen == null ? '—' : n2(g.closed.orlen), m: mult(g.closed.mult) })
                        : fbp(locale, 'p5b_f_grp_open', { range: range(g.from, g.to) }))}
                    </th>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.date} className={r.how === 'MISSING' ? 'pm-miss' : undefined} data-pm-day={r.date}>
                      <th scope="row">{wd(locale, r.date)} {dm(r.date)}</th>
                      <td className="num tabular">
                        {r.okq8 == null ? fb(locale, 'p5b_f_missing') : n2(r.okq8)}
                        {r.okq8Pub ? <small className="pm-pub"> {fbp(locale, 'p5b_f_pub', { date: dm(r.okq8Pub) })}</small> : null}
                      </td>
                      <td className="num tabular">
                        {r.orlen == null ? <b>{fb(locale, 'p5b_f_missing')}</b> : n3(r.orlen)}
                        {r.orlenPub ? <small className="pm-pub"> {fbp(locale, 'p5b_f_pub', { date: dm(r.orlenPub) })}</small> : null}
                      </td>
                      <td className="pm-how-c">{dayHow(locale, r)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <p className="ox-foot">{fb(locale, 'p5b_f_days_note')}</p>
        </section>

        <section className="pm-tiers" data-pm-tiers={allTiers ? 'all' : 'near'}>
          <h4 className="ox-eyebrow pm-h">{up(fb(locale, allTiers ? 'p5b_f_tiers_all_h' : 'p5b_f_tiers_h'))}</h4>
          <div className="pm-tiers-2">
            <TierTable locale={locale} head={fb(locale, 'p5b_f_col_sek')} tiers={view.tiers.sek} avg={cur.okq8.avg} all={allTiers} />
            <TierTable locale={locale} head={fb(locale, 'p5b_f_col_pln')} tiers={view.tiers.pln} avg={cur.orlen.avg} all={allTiers} />
          </div>
          <div className="ox-actions ox-actions-start">
            <button type="button" className="btn ghost ox-btn" onClick={() => setAllTiers((v) => !v)}>{fb(locale, allTiers ? 'p5b_f_tiers_near' : 'p5b_f_tiers_all')}</button>
            {actions?.newVersion && !readOnly ? (
              <button type="button" className="btn ghost ox-btn" data-pm-newver onClick={() => { setVerNote(true); actions.newVersion?.(); }}>{fb(locale, 'p5b_f_new_version')}</button>
            ) : null}
          </div>
          <Live msg={verNote ? fb(locale, 'p5b_f_new_version_x') : null} />
          <p className="ox-foot">{fb(locale, 'p5b_f_sources')}</p>
        </section>
      </div>
    </div>
  );
}

/* ---------- Dopłaty: postój (E33) ---------- */

export function DwellScreen({ locale, rules, readOnly, onSave }: {
  locale: Locale;
  rules: DwellRulesView;
  readOnly: boolean;
  onSave: ((patch: DwellPatch) => Promise<boolean>) | null;
}) {
  const [r, setR] = useState(rules);
  const [msg, setMsg] = useState<string | null>(null);
  const canEdit = !readOnly && !!onSave;
  const rows: ValueRow[] = [
    { key: 'freeLoadH', label: fb(locale, 'p5b_d_freeLoadH'), value: r.freeLoadH, unit: fb(locale, 'p5b_unit_h'), fx: fb(locale, 'p5b_d_freeLoadH_fx'), min: 0, max: 48 },
    { key: 'freeUnloadH', label: fb(locale, 'p5b_d_freeUnloadH'), value: r.freeUnloadH, unit: fb(locale, 'p5b_unit_h'), fx: fb(locale, 'p5b_d_freeUnloadH_fx'), min: 0, max: 48 },
    { key: 'hourEur', label: fb(locale, 'p5b_d_hourEur'), value: r.hourEur, unit: fb(locale, 'p5b_unit_eur'), fx: fb(locale, 'p5b_d_hourEur_fx'), min: 0 },
    { key: 'dayAfterH', label: fb(locale, 'p5b_d_dayAfterH'), value: r.dayAfterH, unit: fb(locale, 'p5b_unit_h'), fx: fb(locale, 'p5b_d_dayAfterH_fx'), min: 1, max: 96 },
    { key: 'dayEur', label: fb(locale, 'p5b_d_dayEur'), value: r.dayEur, unit: fb(locale, 'p5b_unit_eur'), fx: fb(locale, 'p5b_d_dayEur_fx'), min: 0 },
  ];
  /* przykład z bieżących zasad: 8 h 10 min na załadunku */
  const minutes = 8 * 60 + 10;
  const over = Math.max(0, minutes - r.freeLoadH * 60);
  const exEur = minutes > r.dayAfterH * 60
    ? Math.ceil(minutes / (24 * 60)) * r.dayEur
    : (r.hourMode === 'FULL' ? Math.ceil(over / 60) : over / 60) * r.hourEur;
  /* wybór przyciskiem też z pytaniem „było → jest” (jak wartości liczbowe) */
  const [pend, setPend] = useState<{ key: 'startFrom' | 'hourMode'; value: string } | null>(null);
  const pick = (key: 'startFrom' | 'hourMode', value: string) => {
    if (!canEdit || r[key] === value) return;
    setMsg(null);
    setPend({ key, value });
  };
  const choiceName = (key: 'startFrom' | 'hourMode', v: string) => fb(locale, `p5b_d_${key === 'startFrom' ? 'start' : 'mode'}_${v}`);
  const confirm = () => {
    if (!pend || !onSave) return;
    const { key, value } = pend;
    setPend(null);
    void safe(onSave({ [key]: value } as DwellPatch), false).then((res) => {
      if (res) setR((s) => ({ ...s, [key]: value }));
      setMsg(fb(locale, res ? 'p5b_saved' : 'p5b_save_fail'));
    });
  };
  return (
    <div className="pm-dwell" data-pm-dwell>
      <div className="pm-sec-hd"><h4 className="ox-eyebrow">{up(fb(locale, 'p5b_d_h'))}</h4><Changed locale={locale} changed={r.changed} /></div>
      <ValueRows
        locale={locale}
        rows={rows}
        readOnly={readOnly}
        onSave={onSave ? async (key, value) => {
          if (value == null) return false;
          const res = await safe(onSave({ [key]: value } as DwellPatch), false);
          if (res) setR((s) => ({ ...s, [key]: value }));
          return res;
        } : null}
      />
      <ul className="ox-thr-list pm-rows pm-choices">
        <li data-pm-row="startFrom">
          <span className="ox-thr-label">{fb(locale, 'p5b_d_start')}</span>
          <SegRadio label={fb(locale, 'p5b_d_start')} value={r.startFrom} options={['LATER', 'ENTRY'] as const} nameOf={(v) => choiceName('startFrom', v)} disabled={!canEdit} onPick={(v) => pick('startFrom', v)} />
        </li>
        <li data-pm-row="hourMode">
          <span className="ox-thr-label">{fb(locale, 'p5b_d_mode')}</span>
          <SegRadio label={fb(locale, 'p5b_d_mode')} value={r.hourMode} options={['FULL', 'FRACTION'] as const} nameOf={(v) => choiceName('hourMode', v)} disabled={!canEdit} onPick={(v) => pick('hourMode', v)} />
        </li>
      </ul>
      {pend ? (
        <div className="pm-ask" data-pm-ask={pend.key}>
          <span className="ox-thr-ask">
            {t(locale, 'p3c_thr_ask')
              .replace('{name}', fb(locale, pend.key === 'startFrom' ? 'p5b_d_start' : 'p5b_d_mode'))
              .replace('{was}', choiceName(pend.key, r[pend.key]))
              .replace('{is}', choiceName(pend.key, pend.value))}
          </span>
          <span className="ox-thr-btns">
            <button type="button" className="btn ghost ox-btn" onClick={() => setPend(null)}>{t(locale, 'p3c_cancel')}</button>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- fokus z wybranego przycisku na pytanie */}
            <button type="button" className="btn ox-btn" autoFocus onClick={confirm}>{t(locale, 'p3c_yes_change')}</button>
          </span>
        </div>
      ) : null}
      <Live msg={msg} />
      <p className="ox-note-box pm-ex" data-pm-example>{fbp(locale, 'p5b_d_example', { eur: n2(exEur) })}</p>
      <p className="ox-foot">{fb(locale, 'p5b_d_note')}</p>
    </div>
  );
}

/* ---------- Cennik i opłaty: procenty za anulowanie (E33) i próg marży (E16) ---------- */

export function RatesExtras({ locale, cancel, onCancelSave, margin, onMarginSave, readOnly }: {
  locale: Locale;
  cancel: CancelRulesView | null;
  onCancelSave: ((days: number, pct: number) => Promise<boolean>) | null;
  /** Próg w %; null = nie ustawiony (flaga wyłączona). `undefined` = pole niepodłączone (ukryte). */
  margin: number | null | undefined;
  onMarginSave: ((pct: number | null) => Promise<boolean>) | null;
  readOnly: boolean;
}) {
  const [pcts, setPcts] = useState<Record<number, number>>(cancel?.pct ?? {});
  const ex = cancel?.example ?? null;
  return (
    <div className="pm-rates" data-pm-rates>
      {cancel ? (
        <section className="pm-sec" data-pm-cancel>
          <div className="pm-sec-hd">
            <h4 className="ox-eyebrow">{up(fb(locale, 'p5b_c_cancel_h'))}</h4>
            <Changed locale={locale} changed={cancel.changed} />
          </div>
          <p className="ox-muted pm-sec-sub">{fb(locale, 'p5b_c_cancel_sub')}</p>
          <ValueRows
            locale={locale}
            readOnly={readOnly}
            rows={CANCEL_DAYS.map((d) => {
              const p = pcts[d] ?? cancel.pct[d] ?? 0;
              return {
                key: String(d),
                label: fb(locale, `p5b_c_days_${d}`),
                value: cancel.pct[d] ?? 0,
                unit: fb(locale, 'p5b_unit_pct'),
                fx: ex ? fbp(locale, 'p5b_c_cancel_fx', { label: ex.label, c: n2((ex.costEur * p) / 100), r: n2((ex.revEur * p) / 100) }) : undefined,
                min: 0,
                max: 100,
              };
            })}
            onSave={onCancelSave ? async (key, value) => {
              if (value == null) return false;
              const res = await safe(onCancelSave(Number(key), value), false);
              if (res) setPcts((s) => ({ ...s, [Number(key)]: value }));
              return res;
            } : null}
          />
          <p className="ox-foot">
            {ex ? `${fbp(locale, 'p5b_c_cancel_ex', { label: ex.label, c: formatPlNumber(ex.costEur, 0), r: formatPlNumber(ex.revEur, 0) })} ` : null}
            {fb(locale, 'p5b_c_cancel_days')}
          </p>
        </section>
      ) : null}
      {margin !== undefined ? (
        <section className="pm-sec" data-pm-margin>
          <div className="pm-sec-hd"><h4 className="ox-eyebrow">{up(fb(locale, 'p5b_c_margin_h'))}</h4></div>
          <ValueRows
            locale={locale}
            readOnly={readOnly}
            allowEmpty
            rows={[{ key: 'margin', label: fb(locale, 'p5b_c_margin'), value: margin, unit: fb(locale, 'p5b_unit_pct'), fx: fb(locale, 'p5b_c_margin_fx'), min: 0, max: 100, digits: 1 }]}
            onSave={onMarginSave ? (_k, v) => onMarginSave(v) : null}
          />
          <p className="ox-foot">{fb(locale, 'p5b_c_margin_off')}</p>
        </section>
      ) : null}
      {cancel || margin !== undefined ? <h4 className="ox-eyebrow pm-h">{up(fb(locale, 'p5b_c_rates_h'))}</h4> : null}
    </div>
  );
}

/* ---------- Terminy płatności i adresy (E40) ---------- */

type BookForm =
  | { mode: 'add'; key: PackKey; draft: string }
  | { mode: 'test'; to: string }
  | { mode: 'remove'; key: PackKey; addr: string };

/** img/e40-after „Opcje › Adresy księgowości”: dwie listy jedna pod drugą, przy adresie „usuń”, na dole
 *  „+ Dodaj adres” i „Wyślij próbny e-mail na ten adres” (wybór adresu z obu list). Usunięcie — z pytaniem (E12). */
function AddressBook({ locale, addresses, readOnly, onChange, onTest }: {
  locale: Locale;
  addresses: Record<PackKey, string[]>;
  readOnly: boolean;
  onChange: ((key: PackKey, next: string[]) => Promise<boolean>) | null;
  onTest: ((to: string) => Promise<TestMailResult>) | null;
}) {
  const [lists, setLists] = useState<Record<PackKey, string[]>>({ KSH: addresses.KSH ?? [], HHL: addresses.HHL ?? [] });
  const [form, setForm] = useState<BookForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canEdit = !readOnly && !!onChange;
  const canTest = !readOnly && !!onTest;
  const all = [...lists.KSH, ...lists.HHL];
  /* jedna zmiana naraz (przyciski nieaktywne do odpowiedzi); formularz zamyka się dopiero po udanym zapisie */
  const commit = (key: PackKey, next: string[]) => {
    if (!onChange || busy) return;
    setBusy(true);
    setMsg(null);
    void safe(onChange(key, next), false).then((res) => {
      setBusy(false);
      if (res) {
        setLists((s) => ({ ...s, [key]: next }));
        setForm(null);
      }
      setMsg(fb(locale, res ? 'p5b_saved' : 'p5b_save_fail'));
    });
  };
  const draft = form?.mode === 'add' ? form.draft.trim().toLowerCase() : '';
  const bad = form?.mode === 'add' && draft !== '' && !looksLikeEmail(draft);
  const dup = form?.mode === 'add' && lists[form.key].some((x) => x.toLowerCase() === draft);
  const errId = 'pm-add-err';
  return (
    <div className="pm-book" data-pm-book>
      {(['KSH', 'HHL'] as const).map((k) => (
        <section className="pm-addr" data-pm-addr={k} key={k}>
          <h5 className="pm-addr-h">{fb(locale, `p5b_t_addr_${k}`)}</h5>
          {lists[k].length === 0 ? <p className="ox-foot pm-none">{fb(locale, 'p5b_t_none')}</p> : (
            <ul className="pm-addr-list">
              {lists[k].map((a) => (
                <li key={a}>
                  <span className="pm-mail" data-content>{a}</span>
                  {canEdit ? <button type="button" className="pm-link" disabled={busy} aria-label={`${fb(locale, 'p5b_t_remove')} ${a}`} onClick={() => { setMsg(null); setForm({ mode: 'remove', key: k, addr: a }); }}>{fb(locale, 'p5b_t_remove')}</button> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {form == null ? (
        canEdit || (canTest && all.length > 0) ? (
          <div className="ox-actions ox-actions-start pm-book-act">
            {canEdit ? <button type="button" className="btn ghost ox-btn" disabled={busy} onClick={() => { setMsg(null); setForm({ mode: 'add', key: 'KSH', draft: '' }); }}>{fb(locale, 'p5b_t_add')}</button> : null}
            {canTest && all.length > 0 ? <button type="button" className="btn ghost ox-btn" disabled={busy} onClick={() => { setMsg(null); setForm({ mode: 'test', to: all[0] }); }}>{fb(locale, 'p5b_t_test')}</button> : null}
          </div>
        ) : null
      ) : form.mode === 'remove' ? (
        <div className="pm-ask" data-pm-form="remove">
          <span className="ox-thr-ask">{fbp(locale, 'p5b_t_remove_ask', { addr: form.addr, list: fb(locale, `p5b_t_list_${form.key}`) })}</span>
          <span className="ox-thr-btns">
            <button type="button" className="btn ghost ox-btn" onClick={() => setForm(null)}>{t(locale, 'p3c_cancel')}</button>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- fokus z „usuń” na pytanie */}
            <button type="button" className="btn ox-btn" autoFocus disabled={busy} onClick={() => commit(form.key, lists[form.key].filter((x) => x !== form.addr))}>{fb(locale, 'p5b_t_remove_yes')}</button>
          </span>
        </div>
      ) : form.mode === 'add' ? (
        <div className="pm-add" data-pm-form="add">
          <SegRadio label={fb(locale, 'p5b_t_list')} value={form.key} options={['KSH', 'HHL'] as const} nameOf={(k) => fb(locale, `p5b_t_list_${k}`)} disabled={busy} onPick={(k) => setForm({ ...form, key: k })} />
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="off"
            aria-label={fb(locale, `p5b_t_addr_${form.key}`)}
            aria-invalid={bad || dup ? true : undefined}
            aria-describedby={bad || dup ? errId : undefined}
            placeholder={fb(locale, 'p5b_t_ph')}
            value={form.draft}
            onChange={(e) => setForm({ ...form, draft: e.target.value })}
          />
          <button type="button" className="btn ghost ox-btn" onClick={() => setForm(null)}>{fb(locale, 'p5b_t_cancel')}</button>
          <button type="button" className="btn ox-btn" disabled={busy || !draft || bad || dup} onClick={() => commit(form.key, [...lists[form.key], draft])}>{fb(locale, 'p5b_t_add_ok')}</button>
          {bad || dup ? <span className="ox-alert pm-add-err" id={errId}>{fb(locale, bad ? 'p5b_t_bad' : 'p5b_t_dup')}</span> : null}
        </div>
      ) : (
        <div className="pm-add" data-pm-form="test">
          <select className="input" aria-label={fb(locale, 'p5b_t_test_to')} value={all.includes(form.to) ? form.to : all[0] ?? ''} onChange={(e) => setForm({ mode: 'test', to: e.target.value })}>
            {all.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button type="button" className="btn ghost ox-btn" onClick={() => setForm(null)}>{fb(locale, 'p5b_t_cancel')}</button>
          <button
            type="button"
            className="btn ox-btn"
            disabled={busy || all.length === 0}
            onClick={() => {
              const to = all.includes(form.to) ? form.to : all[0];
              if (!to || !onTest) return;
              setBusy(true);
              void safe(onTest(to), 'ERROR' as TestMailResult).then((res) => {
                setBusy(false);
                setForm(null);
                setMsg(res === 'SENT' ? fbp(locale, 'p5b_t_test_sent', { to }) : fb(locale, res === 'BLOCKED' ? 'p5b_t_test_blocked' : 'p5b_t_test_fail'));
              });
            }}
          >
            {fb(locale, 'p5b_t_send')}
          </button>
        </div>
      )}
      <Live msg={msg} />
    </div>
  );
}

export function TermsScreen({ locale, terms, onTermsSave, addresses, onAddrSave, onTest, readOnly }: {
  locale: Locale;
  terms: PaymentTermsView | null;
  onTermsSave: ((side: 'KSH' | 'SCX', days: number) => Promise<boolean>) | null;
  addresses: Record<PackKey, string[]> | null;
  onAddrSave: ((key: PackKey, list: string[]) => Promise<boolean>) | null;
  onTest: ((to: string) => Promise<TestMailResult>) | null;
  readOnly: boolean;
}) {
  return (
    <div className="pm-terms" data-pm-terms>
      {terms ? (
        <section className="pm-sec">
          <div className="pm-sec-hd"><h4 className="ox-eyebrow">{up(fb(locale, 'p5b_t_terms_h'))}</h4><Changed locale={locale} changed={terms.changed} /></div>
          <ValueRows
            locale={locale}
            readOnly={readOnly}
            rows={[
              { key: 'KSH', label: fb(locale, 'p5b_t_KSH'), value: terms.kshDays, unit: fb(locale, 'p5b_unit_days'), fx: fb(locale, 'p5b_t_KSH_fx'), min: 1, max: 120 },
              { key: 'SCX', label: fb(locale, 'p5b_t_SCX'), value: terms.scxDays, unit: fb(locale, 'p5b_unit_days'), fx: fb(locale, 'p5b_t_SCX_fx'), min: 1, max: 120 },
            ]}
            onSave={onTermsSave ? (key, v) => (v == null ? Promise.resolve(false) : onTermsSave(key as 'KSH' | 'SCX', v)) : null}
          />
        </section>
      ) : null}
      {addresses ? (
        <section className="pm-sec">
          <div className="pm-sec-hd"><h4 className="ox-eyebrow">{up(fb(locale, 'p5b_t_addr_h'))}</h4></div>
          <AddressBook locale={locale} addresses={addresses} readOnly={readOnly} onChange={onAddrSave} onTest={onTest} />
          <p className="ox-foot">{fb(locale, 'p5b_t_note')}</p>
        </section>
      ) : null}
    </div>
  );
}
