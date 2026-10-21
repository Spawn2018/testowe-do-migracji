/**
 * Opcje › Powiadomienia › Kto co dostaje — produkcja w wyglądzie z audytu (E11, `img/e11-desk`, `img/e11-phone`).
 * Właściciel 21.10.2026 19:52: „wygląd strony z powiadomieniami miał być inny — dobrze jest w Dla mnie › Co dostaję”.
 * Ekran = `WhoGetsScreen` (ten sam co w demo), dane z `notification_matrix`, zapis `admin_notification_matrix_set`.
 * Wiersze i opisy z `NOTIFY_CATALOG` (te same co w „Co dostaję”); zaznaczenia z bazy; „—” tam, gdzie zdarzenie nie dotyczy konta.
 * Karta poczty: zużycie z `email_budget_status`. Przełączniki kart i stałe kanały — według bazy (#402).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { WhoGetsScreen, type WhoGetsCards } from '../components/options/WhoGetsScreen';
import type { Channel, MatrixCell, MatrixGroup } from '../components/options/channels';
import { ACCOUNT_KINDS, type AccountKind } from '../components/options/types';
import { NOTIFY_CATALOG } from '../lib/notifyCatalog';

type DbRow = {
  event_key: string;
  role: AccountKind;
  in_app: boolean;
  email: boolean;
  push: boolean;
  fixed_in_app: boolean | null;
  fixed_email: boolean | null;
  fixed_push: boolean | null;
};

const DB_FIELD: Record<Channel, 'in_app' | 'email' | 'push'> = { bell: 'in_app', mail: 'email', push: 'push' };

/** Katalog × wiersze z bazy → macierz ekranu. Komórka katalogu `null` zostaje „—”; brak wiersza w bazie = wszystko wyłączone. */
export function matrixFromDb(catalog: readonly MatrixGroup[], rows: readonly DbRow[]): MatrixGroup[] {
  const by = new Map(rows.map((r) => [`${r.event_key}|${r.role}`, r]));
  return catalog.map((g) => ({
    ...g,
    rows: g.rows.map((row) => {
      if (row.risksOnly) return row;
      const cells = {} as Record<AccountKind, MatrixCell>;
      for (const k of ACCOUNT_KINDS) {
        if (row.cells[k] === null) { cells[k] = null; continue; }
        const d = by.get(`${row.id}|${k}`);
        const fixed: Channel[] = [];
        if (d?.fixed_in_app) fixed.push('bell');
        if (d?.fixed_push) fixed.push('push');
        if (d?.fixed_email) fixed.push('mail');
        cells[k] = { bell: !!d?.in_app, push: !!d?.push, mail: !!d?.email, ...(fixed.length ? { fixed } : {}) };
      }
      return { ...row, cells };
    }),
  }));
}

export default function LiveWhoGets() {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<DbRow[] | null>(null);
  const [budget, setBudget] = useState<{ used: number; max: number; reserve: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ver, setVer] = useState(0);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const q = await sb.from('notification_matrix').select('event_key,role,in_app,email,push,fixed_in_app,fixed_email,fixed_push');
    if (q.error) { setMsg(q.error.message); return; }
    setRows((q.data ?? []) as DbRow[]);
    setVer((v) => v + 1);
    const b = await sb.rpc('email_budget_status');
    const j = (b.error ? null : b.data) as { immediate_n?: number; digest_n?: number; operational_limit?: number; auth_reserve?: number } | null;
    if (j) setBudget({ used: (j.immediate_n ?? 0) + (j.digest_n ?? 0), max: j.operational_limit ?? 90, reserve: j.auth_reserve ?? 10 });
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const groups = useMemo(() => (rows ? matrixFromDb(NOTIFY_CATALOG, rows) : null), [rows]);

  const anyMail = !!rows?.some((r) => r.email);
  const anyPush = !!rows?.some((r) => r.push);
  const cards: WhoGetsCards | undefined = budget
    ? { mail: { on: anyMail, ...budget }, push: { on: anyPush, devices: 0 }, last: { when: '—', text: '' } }
    : undefined;

  const onToggle = useCallback((rowId: string, kind: AccountKind, ch: Channel, next: boolean) => {
    void (async () => {
      const cur = rows?.find((r) => r.event_key === rowId && r.role === kind);
      const base = { in_app: !!cur?.in_app, email: !!cur?.email, push: !!cur?.push };
      const val = { ...base, [DB_FIELD[ch]]: next };
      const sb = await getSupabase();
      const { error } = await sb.rpc('admin_notification_matrix_set', {
        p_event_group: rowId, p_role: kind, p_in_app: val.in_app, p_email: val.email, p_push: val.push,
      });
      setMsg(error ? error.message : null);
      await refresh();
    })();
  }, [rows, refresh]);

  /* Karty „E-maile o zdarzeniach” / „Powiadomienia na telefon”: wyłączenie gasi kanał we wszystkich wierszach (zapis w bazie, z historią);
     włączenia hurtem nie ma — kanał włącza się w wybranych wierszach poniżej, żeby nie zalać skrzynek. */
  const onCard = useCallback((which: 'mail' | 'push', next: boolean) => {
    void (async () => {
      if (next) { setMsg('Włącz kanał w wybranych wierszach poniżej — hurtem tylko wyłączenie.'); await refresh(); return; }
      const field = which === 'mail' ? 'email' : 'push';
      const sb = await getSupabase();
      for (const r of (rows ?? []).filter((x) => x[field])) {
        const { error } = await sb.rpc('admin_notification_matrix_set', {
          p_event_group: r.event_key, p_role: r.role, p_in_app: r.in_app,
          p_email: field === 'email' ? false : r.email, p_push: field === 'push' ? false : r.push,
        });
        if (error) { setMsg(error.message); break; }
      }
      await refresh();
    })();
  }, [rows, refresh]);

  if (!groups) return msg ? <div className="note" role="status">{msg}</div> : null;
  return (
    <div data-panel="notification-matrix">
      {msg ? <div className="note" role="status">{msg}</div> : null}
      {/* klucz = wersja danych: ekran trzyma zaznaczenia lokalnie, po zapisie bierze stan z bazy */}
      <WhoGetsScreen key={ver} locale={locale} groups={groups} cards={cards} onToggle={onToggle} onCard={onCard} />
    </div>
  );
}
