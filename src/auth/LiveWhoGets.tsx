/**
 * Opcje › Powiadomienia › Kto co dostaje — produkcja w wyglądzie z audytu (E11, `img/e11-desk`, `img/e11-phone`).
 * Właściciel 21.10.2026 19:52: „wygląd strony z powiadomieniami miał być inny — dobrze jest w Dla mnie › Co dostaję”.
 * Ekran = `WhoGetsScreen` (ten sam co w demo), dane z `notification_matrix`, zapis `admin_notification_matrix_set`.
 * Wiersze i opisy z `NOTIFY_CATALOG` (te same co w „Co dostaję”); zaznaczenia z bazy; „—” tam, gdzie zdarzenie nie dotyczy konta.
 * Operacje HHL i Podgląd — tylko odczyt (E12-1A). Zapisy po kolei, każdy z pełnym stanem komórki (F7 #404 B3).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
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
  /* zdarzenie z niewdrożonej migracji (`pendingDb`) bez żadnego wiersza w bazie — nie pokazujemy (zapis by się nie udał) */
  const inDb = new Set(rows.map((r) => r.event_key));
  return catalog.map((g) => ({
    ...g,
    rows: g.rows.filter((row) => !row.pendingDb || inDb.has(row.id)).map((row) => {
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

/** Klucze z bazy, których ekran nie pokazuje (brak w katalogu) — komunikat zamiast cichego pominięcia. */
export function unknownKeys(catalog: readonly MatrixGroup[], rows: readonly DbRow[]): string[] {
  const known = new Set(catalog.flatMap((g) => g.rows.map((r) => r.id)));
  return [...new Set(rows.map((r) => r.event_key).filter((k) => !known.has(k)))];
}

/** Kanał „włączony gdziekolwiek” dla karty — bez kanałów stałych (nie do wyłączenia z karty). */
export function channelOn(rows: readonly DbRow[], field: 'email' | 'push'): boolean {
  const fx = field === 'email' ? 'fixed_email' : 'fixed_push';
  return rows.some((r) => r[field] && !r[fx]);
}

export default function LiveWhoGets({ readOnly = false }: { readOnly?: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<DbRow[] | null>(null);
  const rowsRef = useRef<DbRow[]>([]);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const [budget, setBudget] = useState<{ used: number; max: number; reserve: number } | null>(null);
  const [devices, setDevices] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const q = await sb.from('notification_matrix').select('event_key,role,in_app,email,push,fixed_in_app,fixed_email,fixed_push');
    if (q.error) { setMsg(q.error.message); return; }
    rowsRef.current = (q.data ?? []) as DbRow[];
    setRows(rowsRef.current);
    const b = await sb.rpc('email_budget_status');
    const j = (b.error ? null : b.data) as { immediate_n?: number; digest_n?: number; operational_limit?: number; auth_reserve?: number } | null;
    if (j) setBudget({ used: (j.immediate_n ?? 0) + (j.digest_n ?? 0), max: j.operational_limit ?? 90, reserve: j.auth_reserve ?? 10 });
    const d = await sb.from('push_subscriptions').select('id', { count: 'exact', head: true });
    setDevices(d.error ? null : d.count ?? 0);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const groups = useMemo(() => (rows ? matrixFromDb(NOTIFY_CATALOG, rows) : null), [rows]);
  const unknown = useMemo(() => (rows ? unknownKeys(NOTIFY_CATALOG, rows) : []), [rows]);

  const cards: WhoGetsCards | undefined = useMemo(() => (rows && budget
    ? { mail: { on: channelOn(rows, 'email'), ...budget }, push: { on: channelOn(rows, 'push'), devices: devices ?? 0 }, last: { when: '—', text: '' } }
    : undefined), [rows, budget, devices]);

  /* zapis jednej komórki: najpierw stan lokalny (kolejne kliknięcia liczą od niego), potem RPC w kolejce */
  const save = useCallback((rowId: string, kind: AccountKind, patch: Partial<Pick<DbRow, 'in_app' | 'email' | 'push'>>) => {
    const cur = rowsRef.current.find((r) => r.event_key === rowId && r.role === kind);
    const next = { in_app: !!cur?.in_app, email: !!cur?.email, push: !!cur?.push, ...patch };
    rowsRef.current = cur
      ? rowsRef.current.map((r) => (r === cur ? { ...r, ...next } : r))
      : [...rowsRef.current, { event_key: rowId, role: kind, ...next, fixed_in_app: null, fixed_email: null, fixed_push: null }];
    const run = async (): Promise<string | null> => {
      const sb = await getSupabase();
      const { error } = await sb.rpc('admin_notification_matrix_set', {
        p_event_group: rowId, p_role: kind, p_in_app: next.in_app, p_email: next.email, p_push: next.push,
      });
      return error ? error.message : null;
    };
    const p = chain.current.then(run);
    chain.current = p.catch(() => null);
    return p;
  }, []);

  const onToggle = useCallback((rowId: string, kind: AccountKind, ch: Channel, next: boolean) => {
    if (readOnly) return;
    void save(rowId, kind, { [DB_FIELD[ch]]: next }).then(async (err) => {
      setMsg(err);
      await refresh();
    });
  }, [readOnly, save, refresh]);

  /* Karty: wyłączenie gasi kanał we wszystkich wierszach poza stałymi; włączenia hurtem nie ma (kanał włącza się w wierszach). */
  const onCard = useCallback((which: 'mail' | 'push', next: boolean) => {
    if (readOnly) return;
    void (async () => {
      if (next) { setMsg(t(locale, 'p3c_card_on_rows')); await refresh(); return; }
      const field = which === 'mail' ? 'email' : 'push';
      const fx = which === 'mail' ? 'fixed_email' : 'fixed_push';
      const todo = rowsRef.current.filter((r) => r[field] && !r[fx]);
      let done = 0;
      for (const r of todo) {
        const err = await save(r.event_key, r.role, { [field]: false });
        if (err) { setMsg(tp(locale, 'p3c_card_off_part', { n: done, all: todo.length, err })); break; }
        done += 1;
      }
      if (done === todo.length) setMsg(null);
      await refresh();
    })();
  }, [readOnly, locale, save, refresh]);

  if (!groups) return msg ? <div className="note" role="status">{msg}</div> : null;
  return (
    <div data-panel="notification-matrix">
      {msg ? <div className="note" role="status">{msg}</div> : null}
      {unknown.length ? <div className="note" role="status">{tp(locale, 'p3c_unknown_rows', { keys: unknown.join(', ') })}</div> : null}
      <WhoGetsScreen locale={locale} groups={groups} cards={cards} readOnly={readOnly} onToggle={onToggle} onCard={onCard} />
    </div>
  );
}
