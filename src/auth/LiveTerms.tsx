/**
 * Opcje › Pieniądze › Terminy płatności i adresy — produkcja (#412 E40, baza 0285). Ten sam ekran co w demo
 * (`TermsScreen`): terminy z `payment_terms_options()` (KSH płaci HHL / HHL płaci SCX, od daty wystawienia faktury),
 * adresy księgowości z `accounting_addresses_get()`. Zapis tylko Administrator HHL (`payment_terms_options_set`,
 * `accounting_addresses_set` — baza odmawia innym i zapisuje Historię zmian). Zmiana terminu tworzy nową wersję od dziś:
 * faktury wystawione wcześniej zostają ze starym terminem. Próbnego e-maila w produkcji nie ma (przycisk ukryty).
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { TermsScreen } from '../components/options/MoneyScreens';
import type { PaymentTermsView } from '../lib/p5bFuel';
import type { PackKey } from '../lib/p5Pack';

/** Wynik `payment_terms_options()` → widok; zły kształt → null (sekcja terminów bez zmyślonych liczb). */
export function termsFromDb(raw: unknown): PaymentTermsView | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { kshDays?: unknown; scxDays?: unknown; changed?: unknown };
  const days = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);
  const ksh = days(o.kshDays);
  const scx = days(o.scxDays);
  if (ksh == null || scx == null) return null;
  const c = o.changed && typeof o.changed === 'object' ? (o.changed as { at?: unknown; by?: unknown }) : null;
  const changed = c && typeof c.at === 'string' ? { at: c.at, by: typeof c.by === 'string' && c.by ? c.by : '—' } : null;
  return { kshDays: ksh, scxDays: scx, changed };
}

/** Wynik `accounting_addresses_get()` → listy KSH i HHL; zły kształt → null. */
export function addressesFromDb(raw: unknown): Record<PackKey, string[]> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : null);
  const ksh = list(o.KSH);
  const hhl = list(o.HHL);
  if (!ksh || !hhl) return null;
  return { KSH: ksh, HHL: hhl };
}

export default function LiveTerms({ readOnly = false }: { readOnly?: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const [terms, setTerms] = useState<PaymentTermsView | null | undefined>(undefined);
  const [addresses, setAddresses] = useState<Record<PackKey, string[]> | null | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const sb = await getSupabase();
      const [tr, ar] = await Promise.all([sb.rpc('payment_terms_options'), sb.rpc('accounting_addresses_get')]);
      setTerms(tr.error ? null : termsFromDb(tr.data));
      setAddresses(ar.error ? null : addressesFromDb(ar.data));
      setMsg(tr.error?.message ?? ar.error?.message ?? null);
    } catch (e) {
      /* F7 #415: wyjątek przy odczycie — komunikat zamiast pustego ekranu */
      setMsg(e instanceof Error ? e.message : t(locale, 'ol2_read_fail'));
      setTerms(null);
      setAddresses(null);
    }
  }, [locale]);
  useEffect(() => { void refresh(); }, [refresh]);

  const saveTerms = useCallback(async (side: 'KSH' | 'SCX', days: number): Promise<boolean> => {
    if (readOnly) return false;
    const sb = await getSupabase();
    const { error } = await sb.rpc('payment_terms_options_set', { p_side: side, p_days: days });
    if (error) { setMsg(error.message); return false; }
    setMsg(null);
    await refresh();
    return true;
  }, [readOnly, refresh]);

  const saveAddresses = useCallback(async (key: PackKey, list: string[]): Promise<boolean> => {
    if (readOnly) return false;
    const sb = await getSupabase();
    const { error } = await sb.rpc('accounting_addresses_set', { p_pack: key, p_emails: list });
    if (error) { setMsg(error.message); return false; }
    setMsg(null);
    await refresh();
    return true;
  }, [readOnly, refresh]);

  if (terms === undefined || addresses === undefined) {
    return <p className="note" role="status">{t(locale, 'ol2_loading')}</p>;
  }
  return (
    <div data-live-terms>
      {msg ? <div className="note" role="status">{msg}</div> : null}
      {terms || addresses ? (
        <TermsScreen
          locale={locale}
          readOnly={readOnly}
          terms={terms}
          onTermsSave={readOnly ? null : saveTerms}
          addresses={addresses}
          onAddrSave={readOnly ? null : saveAddresses}
          onTest={null}
        />
      ) : <p className="note">{t(locale, 'ol2_read_fail')}</p>}
    </div>
  );
}
