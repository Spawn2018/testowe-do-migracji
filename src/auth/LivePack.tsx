/**
 * Finanse › Paczka tygodnia dla księgowości — produkcja (#412 E40, baza 0286). Ten sam widok co w demo
 * (`AccountingPackSection`): adresy i dziennik z `accounting_pack_config()`, „Zleć wysyłkę” → `accounting_pack_send`
 * (HHL Administrator i Operacje). Do czasu wysyłki e-mail z serwera wpis ma stan „Zlecono” (bez „Wysłano”);
 * ponowne zlecenie tego samego tygodnia tylko po potwierdzeniu (`p_resend`). Blokady (brak faktury, PDF, CMR,
 * sporna, niezaakceptowana) liczy baza — komunikat z bazy nad paczkami. ZIP: prawdziwe PDF faktur i CMR z dokumentów.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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

/** PDF faktur paczki (z faktury: plik w Storage, jak w szczegółach faktury — dokumenty faktur nie mają transportu,
 * więc nie ma ich w liście dokumentów) + CMR transportów. Bez zestawienia demo. F7 #518. */
export function packZipDocs(billIds: readonly string[], bills: readonly Bill[], cmrDocs: readonly Document[]): Document[] {
  const pdfs: Document[] = bills
    .filter((b) => billIds.includes(b.id) && b.pdfStoragePath && b.pdfDocId)
    .map((b) => ({
      id: b.pdfDocId as string, loadId: b.lines[0]?.loadId ?? '', category: 'INVOICE', name: b.pdfName ?? `${b.number}.pdf`,
      uploadedAt: b.createdAt, deadline: null, status: 'UPLOADED', permitFits: null, visibleTo: [b.issuer, b.recipient],
      dataUrl: null, mimeType: 'application/pdf', bytes: 0, source: 'tower', storagePath: b.pdfStoragePath,
    }));
  return [...pdfs, ...cmrDocs];
}

export default function LivePack({ locale, phone, loads, bills, documents, nowIso }: {
  locale: Locale; phone: boolean; loads: Load[]; bills: Bill[]; documents: Document[]; nowIso: string;
}) {
  const [cfg, setCfg] = useState<PackConfig | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  /* zlecenia z tej sesji — ponowienie po własnym zleceniu nawet, gdy odświeżenie dziennika się nie udało (F7 #518) */
  const ordered = useRef(new Set<string>());

  /* `quiet` (po udanym zleceniu): błąd odczytu nie zastępuje stanu „Zlecono” czerwonym komunikatem */
  const refresh = useCallback(async (quiet = false) => {
    try {
      const sb = await getSupabase();
      const r = await sb.rpc('accounting_pack_config');
      /* błąd odczytu po wcześniejszym udanym — zostaje ostatni stan i komunikat */
      if (r.error) { if (!quiet) setNotice(r.error.message); setCfg((c) => (c === undefined ? null : c)); return; }
      setCfg(packConfigFromDb(r.data));
    } catch (e) {
      if (!quiet) setNotice(e instanceof Error ? e.message : String(e));
      setCfg((c) => (c === undefined ? null : c));
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  if (cfg === undefined) return null;
  /* pierwszy odczyt nieudany — komunikat zamiast znikającej sekcji (F7 #518) */
  if (!cfg) return notice ? <p className="note" role="status" data-pack-notice>{notice}</p> : null;

  const actions: PackActions = {
    send: async (key: PackKey, weekKey: string) => {
      setNotice(null);
      const k = `${weekKey}:${key}`;
      const resend = !!cfg.sent[k] || ordered.current.has(k);
      try {
        const sb = await getSupabase();
        const r = await sb.rpc('accounting_pack_send', { p_pack: key, p_week: weekKey, p_files: [], p_resend: resend });
        /* np. ktoś inny zlecił w międzyczasie — odświeżony dziennik pokaże wpis i następne kliknięcie zapyta o ponowienie */
        if (r.error) { setNotice(r.error.message); await refresh(true); return null; }
        ordered.current.add(k);
        const s = sentFromDb(r.data);
        await refresh(true);
        return s;
      } catch (e) {
        setNotice(e instanceof Error ? e.message : String(e));
        return null;
      }
    },
    zip: async (pack, cmrDocs, codeOf) => {
      setNotice(null);
      try {
        const { downloadDocumentsZip } = await import('../lib/zipDocs');
        const docs = packZipDocs(pack.bills.map((b) => b.id), bills, cmrDocs);
        await downloadDocumentsZip(docs, `Paczka_t${Number(pack.weekKey.slice(-2))}_${pack.key}.zip`, codeOf);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : String(e));
      }
    },
  };

  return (
    <AccountingPackSection
      locale={locale} phone={phone} loads={loads} bills={bills} documents={documents}
      cfg={cfg} actions={actions} nowIso={nowIso} orderOnly notice={notice}
    />
  );
}
