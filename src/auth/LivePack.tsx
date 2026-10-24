/**
 * Finanse › Paczka tygodnia dla księgowości — produkcja (#412 E40, baza 0286). Ten sam widok co w demo
 * (`AccountingPackSection`): adresy i dziennik z `accounting_pack_config()`, „Zleć wysyłkę” → `accounting_pack_send`
 * (HHL Administrator i Operacje). Do czasu wysyłki e-mail z serwera wpis ma stan „Zlecono” (bez „Wysłano”);
 * ponowne zlecenie tego samego tygodnia tylko po potwierdzeniu (`p_resend`). Blokady (brak faktury, PDF, CMR,
 * sporna, niezaakceptowana) liczy baza — komunikat z bazy nad paczkami. ZIP: prawdziwe PDF faktur i CMR z dokumentów.
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { AccountingPackSection } from '../components/finance/AccountingPack';
import type { PackConfig, PackKey, PackSent } from '../lib/p5Pack';
import type { PackActions } from '../lib/p5Source';
import type { Bill, Document, Load, Locale } from '../types';

const STATUSES: ReadonlySet<PackSent['status']> = new Set(['ZLECONO', 'WYSLANO', 'DORECZONO', 'BLAD']);

function sentFromDb(v: unknown): PackSent | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { at?: unknown; to?: unknown; status?: unknown; by?: unknown };
  if (typeof o.at !== 'string' || typeof o.status !== 'string' || !STATUSES.has(o.status as PackSent['status'])) return null;
  return {
    at: o.at,
    to: typeof o.to === 'number' && o.to > 0 ? o.to : 0,
    status: o.status as PackSent['status'],
    by: typeof o.by === 'string' && o.by ? o.by : '—',
  };
}

/** Wynik `accounting_pack_config()` → `PackConfig`; zły kształt → null (sekcji nie ma, bez zmyślonych adresów). */
export function packConfigFromDb(raw: unknown): PackConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { addresses?: unknown; sent?: unknown };
  const a = o.addresses && typeof o.addresses === 'object' ? (o.addresses as Record<string, unknown>) : null;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : null);
  const ksh = a ? list(a.KSH) : null;
  const hhl = a ? list(a.HHL) : null;
  if (!ksh || !hhl) return null;
  const sent: PackConfig['sent'] = {};
  if (o.sent && typeof o.sent === 'object') {
    for (const [k, v] of Object.entries(o.sent as Record<string, unknown>)) {
      if (!/^\d{4}-W\d{2}:(KSH|HHL)$/.test(k)) continue;
      const s = sentFromDb(v);
      if (s) sent[k] = s;
    }
  }
  return { addresses: { KSH: ksh, HHL: hhl }, sent };
}

/** PDF faktur paczki + CMR transportów (prawdziwe pliki z dokumentów; bez zestawienia demo). */
export function packZipDocs(billIds: readonly string[], bills: readonly Bill[], cmrDocs: readonly Document[], documents: readonly Document[]): Document[] {
  const want = new Set(bills.filter((b) => billIds.includes(b.id)).map((b) => b.pdfDocId).filter((x): x is string => !!x));
  return [...documents.filter((d) => want.has(d.id) && d.status === 'UPLOADED'), ...cmrDocs];
}

export default function LivePack({ locale, phone, loads, bills, documents, nowIso }: {
  locale: Locale; phone: boolean; loads: Load[]; bills: Bill[]; documents: Document[]; nowIso: string;
}) {
  const [cfg, setCfg] = useState<PackConfig | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const sb = await getSupabase();
      const r = await sb.rpc('accounting_pack_config');
      /* błąd odczytu po wcześniejszym udanym — zostaje ostatni stan i komunikat */
      if (r.error) { setNotice(r.error.message); setCfg((c) => (c === undefined ? null : c)); return; }
      setCfg(packConfigFromDb(r.data));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
      setCfg((c) => (c === undefined ? null : c));
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  if (!cfg) return null;

  const actions: PackActions = {
    send: async (key: PackKey, weekKey: string) => {
      setNotice(null);
      const resend = !!cfg.sent[`${weekKey}:${key}`];
      try {
        const sb = await getSupabase();
        const r = await sb.rpc('accounting_pack_send', { p_pack: key, p_week: weekKey, p_files: [], p_resend: resend });
        if (r.error) { setNotice(r.error.message); return null; }
        const s = sentFromDb(r.data);
        await refresh();
        return s;
      } catch (e) {
        setNotice(e instanceof Error ? e.message : String(e));
        return null;
      }
    },
    zip: async (pack, cmrDocs, codeOf) => {
      const { downloadDocumentsZip } = await import('../lib/zipDocs');
      const docs = packZipDocs(pack.bills.map((b) => b.id), bills, cmrDocs, documents);
      await downloadDocumentsZip(docs, `Paczka_t${Number(pack.weekKey.slice(-2))}_${pack.key}.zip`, codeOf);
    },
  };

  return (
    <AccountingPackSection
      locale={locale} phone={phone} loads={loads} bills={bills} documents={documents}
      cfg={cfg} actions={actions} nowIso={nowIso} orderOnly notice={notice}
    />
  );
}
