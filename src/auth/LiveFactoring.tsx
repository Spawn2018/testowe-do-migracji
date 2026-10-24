/**
 * #412 E4b — faktoring na produkcji (baza 0287). Te same widoki co w demo (`Factoring.tsx`, `FactoringOfferScreen`):
 *  • Opcje › Pieniądze › Faktoring — `factoring_offer_get` / `factoring_offer_set` (zapis tylko Administrator HHL;
 *    zmiana = nowa wersja od dziś, Europe/Warsaw; poprawka tego samego dnia bez nowej wersji);
 *  • wybór przy nowej fakturze SCX (oferta z bazy; zapis wyboru po rejestracji faktury — supabaseProvider);
 *  • szczegóły faktury SCX do akceptacji — zmiana wyboru `invoice_factoring_set` (baza odmawia po akceptacji, w sporze,
 *    po opłaceniu); HHL i SCX widzą wybór, prowizję, wypłatę i termin z bazy;
 *  • zadania HHL „Wypłata faktoringu” — `factoring_tasks`, „Oznacz jako wypłaconą” → `factoring_mark_paid`
 *    (baza ustawia też OPŁACONA, więc przypomnienia o płatności ustają).
 * Prowizję, wypłatę i termin liczy baza; ekran ich nie zmyśla.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { refreshFromServer } from '../data/supabaseBridge';
import { FactoringOfferScreen } from '../components/options/FactoringOfferScreen';
import { FactoringTaskCard, PaymentChoice } from '../components/invoices/Factoring';
import type { FactoringOfferView, FactoringTask } from '../lib/p5Source';
import type { Bill, FactoringOffer, Locale } from '../types';
import { ft } from '../i18n/p5';

export type LiveOffer = FactoringOfferView & { enabled: boolean };

const pos = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** Wynik `factoring_offer_get()` → oferta; null = brak oferty (albo SCX przy wyłączonej); zły kształt → null. */
export function offerFromDb(raw: unknown): LiveOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const feePct = pos(num(o.feePct));
  const hours = pos(o.hours);
  const version = pos(o.version);
  const from = str(o.from);
  if (feePct == null || hours == null || version == null || !from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
  return { feePct, hours, version, from, enabled: o.enabled === true };
}

/** Wynik `factoring_tasks()` → zadania; wpisy bez kwot lub terminów pominięte (bez zmyślonych liczb). */
export function tasksFromDb(raw: unknown): FactoringTask[] {
  if (!Array.isArray(raw)) return [];
  const out: FactoringTask[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const net = num(o.net); const gross = num(o.gross); const fee = num(o.fee); const payout = num(o.payout);
    const feePct = num(o.feePct); const hours = pos(o.hours);
    const billId = str(o.billId); const issuedAt = str(o.issuedAt); const acceptedAt = str(o.acceptedAt); const dueAt = str(o.dueAt);
    if (!billId || net == null || gross == null || fee == null || payout == null || feePct == null || hours == null || !issuedAt || !acceptedAt || !dueAt) continue;
    out.push({
      billId, number: str(o.number) ?? '—', issuer: str(o.issuer) ?? '—', currency: o.currency === 'PLN' ? 'PLN' : 'EUR',
      net, gross, fee, payout, feePct, hours, issuedAt, acceptedAt, dueAt, paidAt: str(o.paidAt),
    });
  }
  return out;
}

/** Godziny z ekranu (h albo dni) → `p_hours`. */
export function offerHours(o: FactoringOffer): number {
  return o.payoutDelayUnit === 'days' ? o.payoutDelayValue * 24 : o.payoutDelayValue;
}

const msgOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function loadOffer(): Promise<{ offer: LiveOffer | null; error: string | null }> {
  try {
    const sb = await getSupabase();
    const r = await sb.rpc('factoring_offer_get');
    if (r.error) return { offer: null, error: r.error.message };
    return { offer: offerFromDb(r.data), error: null };
  } catch (e) {
    return { offer: null, error: msgOf(e) };
  }
}

/** Opcje › Pieniądze › Faktoring (HHL). `readOnly` — Operacje HHL widzą, zapisuje Administrator HHL. */
export function LiveFactoringOffer({ readOnly, onSaved }: { readOnly: boolean; onSaved: (what: string) => void }) {
  const locale = useTowerStore((s) => s.locale);
  const [view, setView] = useState<LiveOffer | null | undefined>(undefined);
  const [form, setForm] = useState<FactoringOffer | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  /* najnowsze wartości: przełącznik woła onChange i od razu zapis (stan Reacta jeszcze stary) */
  const cur = useRef<FactoringOffer | null>(null);

  const apply = useCallback((o: LiveOffer | null) => {
    setView(o);
    const f: FactoringOffer = o
      ? { enabled: o.enabled, feePercent: o.feePct, payoutDelayValue: o.hours % 24 === 0 && o.hours >= 24 ? o.hours / 24 : o.hours, payoutDelayUnit: o.hours % 24 === 0 && o.hours >= 24 ? 'days' : 'hours' }
      : { enabled: false, feePercent: 1, payoutDelayValue: 48, payoutDelayUnit: 'hours' };
    cur.current = f;
    setForm(f);
  }, []);

  useEffect(() => {
    void loadOffer().then(({ offer, error }) => { setMsg(error); if (!error) apply(offer); else setView(null); });
  }, [apply]);

  const change = <K extends keyof FactoringOffer>(key: K, value: FactoringOffer[K]) => {
    if (readOnly || !cur.current) return;
    cur.current = { ...cur.current, [key]: value };
    setForm(cur.current);
  };
  const save = (what: string) => {
    const f = cur.current;
    if (readOnly || !f) return;
    void (async () => {
      try {
        const sb = await getSupabase();
        const r = await sb.rpc('factoring_offer_set', { p_enabled: f.enabled, p_fee_pct: f.feePercent, p_hours: offerHours(f) });
        if (r.error) {
          setMsg(r.error.message);
          /* odmowa (np. prowizja poza 0,01–20 %) — ekran wraca do stanu z bazy */
          const back = await loadOffer();
          if (!back.error) apply(back.offer);
          return;
        }
        setMsg(null);
        apply(offerFromDb(r.data));
        onSaved(what);
      } catch (e) {
        setMsg(msgOf(e));
      }
    })();
  };

  if (view === undefined || (!form && !msg)) return <p className="note" role="status">{ft(locale, 'p5_fl_loading')}</p>;
  return (
    <div data-live-factoring>
      {msg ? <div className="note" role="status" data-fact-msg>{msg}</div> : null}
      {form ? (
        <FactoringOfferScreen locale={locale} offer={form} readOnly={readOnly} onChange={change} onSaved={save} view={view} />
      ) : null}
    </div>
  );
}

/** Nowa faktura SCX: wybór sposobu zapłaty, gdy HHL ma włączoną ofertę (oferta z bazy). */
export function LiveFactoringChoice({ net, gross, due, currency, value, onChange }: {
  net: number | null; gross: number | null; due: string; currency: string;
  value: 'STANDARD' | 'FACTORING'; onChange: (v: 'STANDARD' | 'FACTORING') => void;
}) {
  const [offer, setOffer] = useState<LiveOffer | null>(null);
  useEffect(() => {
    let live = true;
    void loadOffer().then(({ offer: o }) => { if (live) setOffer(o && o.enabled ? o : null); });
    return () => { live = false; };
  }, []);
  /* oferta wyłączona albo niedostępna — bez wyboru, faktura standardowo; wybór „Faktoring” nie zostaje bez oferty */
  useEffect(() => { if (!offer && value === 'FACTORING') onChange('STANDARD'); }, [offer, value, onChange]);
  if (!offer) return null;
  return <PaymentChoice offer={offer} net={net} gross={gross} due={due} currency={currency} value={value} onChange={onChange} />;
}

/**
 * Szczegóły faktury kosztowej: wybór i wyliczenie z bazy. Wystawca (SCX) zmienia wybór do akceptacji HHL;
 * po akceptacji, w sporze i po opłaceniu — tylko odczyt (baza i tak odmawia).
 */
export function LiveFactoringDetail({ bill, canChange, locale }: { bill: Bill; canChange: boolean; locale: Locale }) {
  const [offer, setOffer] = useState<LiveOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const open = canChange && bill.verification !== 'ZAAKCEPTOWANA' && bill.verification !== 'SPORNA' && bill.payment !== 'OPLACONA';
  useEffect(() => {
    if (!open) return;
    let live = true;
    void loadOffer().then(({ offer: o }) => { if (live) setOffer(o && o.enabled ? o : null); });
    return () => { live = false; };
  }, [open]);

  const set = async (v: 'STANDARD' | 'FACTORING') => {
    setBusy(true); setMsg(null);
    try {
      const sb = await getSupabase();
      const r = await sb.rpc('invoice_factoring_set', { p_invoice: bill.id, p_selected: v === 'FACTORING' });
      if (r.error) setMsg(r.error.message);
      await refreshFromServer({ keepSelection: true });
    } catch (e) {
      setMsg(msgOf(e));
    } finally {
      setBusy(false);
    }
  };

  const f = bill.factoring;
  if (open && offer) {
    return (
      <div data-fact-detail={bill.id} aria-busy={busy}>
        {msg ? <div className="note" role="status" data-fact-msg>{msg}</div> : null}
        <PaymentChoice offer={offer} net={bill.net} gross={bill.gross} due={bill.dueDate} currency={bill.currency}
          value={f?.selected ? 'FACTORING' : 'STANDARD'} onChange={(v) => { if (!busy) void set(v); }} />
      </div>
    );
  }
  if (!f?.selected) return null;
  return <FactoringFacts bill={bill} locale={locale} />;
}

/** Odczyt: „Faktoring HHL · prowizja · wypłata · termin” z bazy. */
function FactoringFacts({ bill, locale }: { bill: Bill; locale: Locale }) {
  const f = bill.factoring!;
  const n = (x: number | null) => (x == null ? '—' : `${x.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${bill.currency}`);
  const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : null);
  const state = f.paidAt
    ? `${ft(locale, 'p5_fl_paid')} ${when(f.paidAt)}`
    : f.dueAt ? `${ft(locale, 'p5_fl_due')} ${when(f.dueAt)}` : ft(locale, 'p5_fl_wait');
  return (
    <dl className="fin-dl fact-facts" data-fact-facts={bill.id} data-deur-exempt="invoice-currency">
      <dt>{ft(locale, 'p5_fact_pay_h')}</dt><dd><b>{ft(locale, 'p5_fact_hhl')}</b></dd>
      <dt>{ft(locale, 'p5_fl_fee')}</dt><dd>{f.feePct != null ? `${f.feePct.toLocaleString('pl-PL')}% · ` : ''}{n(f.fee)}</dd>
      <dt>{ft(locale, 'p5_fl_payout')}</dt><dd><b>{n(f.payout)}</b></dd>
      <dt>{ft(locale, 'p5_fl_state')}</dt><dd>{state}</dd>
    </dl>
  );
}

/** Faktury › Koszt (HHL): zadania „Wypłata faktoringu” z bazy, „Oznacz jako wypłaconą”. */
export function LiveFactoringTasks({ nowIso, locale }: { nowIso: string; locale: Locale }) {
  const [tasks, setTasks] = useState<FactoringTask[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  /* karta zaznacza „wypłacona” od razu — po odmowie bazy nowa karta (klucz) wraca do stanu z bazy */
  const [gen, setGen] = useState(0);
  const bills = useTowerStore((s) => s.bills);

  const refresh = useCallback(async () => {
    try {
      const sb = await getSupabase();
      const r = await sb.rpc('factoring_tasks');
      if (r.error) { setMsg(r.error.message); return; }
      setTasks(tasksFromDb(r.data));
    } catch (e) {
      setMsg(msgOf(e));
    }
  }, []);
  /* po akceptacji / wypłacie (odświeżenie faktur) lista zadań też się odświeża */
  useEffect(() => { void refresh(); }, [refresh, bills]);

  const markPaid = async (billId: string) => {
    setMsg(null);
    try {
      const sb = await getSupabase();
      const r = await sb.rpc('factoring_mark_paid', { p_invoice: billId });
      if (r.error) setMsg(r.error.message);
      await refreshFromServer({ keepSelection: true });
    } catch (e) {
      setMsg(msgOf(e));
    }
    await refresh();
    setGen((g) => g + 1);
  };

  if (!tasks.length && !msg) return null;
  return (
    <div className="inv-tasks" data-live-fact-tasks>
      {msg ? <div className="note" role="status" data-fact-msg>{msg}</div> : null}
      {tasks.map((x) => <FactoringTaskCard key={`${x.billId}:${gen}`} task={x} nowIso={nowIso} locale={locale} onMarkPaid={(id) => void markPaid(id)} />)}
    </div>
  );
}
