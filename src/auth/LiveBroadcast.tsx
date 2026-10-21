/**
 * Opcje › Powiadomienia › Komunikat dla wszystkich — produkcja w wyglądzie z audytu (E37 „Opcje › Komunikat HHL”).
 * Ekran = `BroadcastScreen` (ten sam co w demo). Dane jak w dawnym `BroadcastForm`: aktywny komunikat z `system_broadcast`
 * (Operacje HHL: `system_broadcast_current()` — tabela tylko dla Administratora), historia ostatnich komunikatów,
 * zapis `admin_broadcast_set`, wycofanie `admin_broadcast_clear`. Operacje HHL — tylko odczyt (E12-1A).
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { formatListDateTime } from '../lib/format';
import { BroadcastScreen, type BroadcastHistoryRow } from '../components/options/PeopleScreens';
import { announceOptionsChanged, personName, type PersonDb } from './liveOpts';

type Firm = 'HHL' | 'KSH' | 'SCX';
type Db = { id: number; body: string; expires_at: string; for_forwarder: boolean; for_carrier: boolean; for_client: boolean; created_at: string; created_by: string | null; cleared_at: string | null };

export function firmsOf(r: Pick<Db, 'for_forwarder' | 'for_carrier' | 'for_client'>): Firm[] {
  return [r.for_forwarder ? 'HHL' : null, r.for_client ? 'KSH' : null, r.for_carrier ? 'SCX' : null].filter((x): x is Firm => !!x);
}

/** Domyślnie: widoczny do jutra o tej samej godzinie (jak dawny formularz). */
function defaultUntil(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function LiveBroadcast({ readOnly = false, admin = true }: { readOnly?: boolean; admin?: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const [active, setActive] = useState<{ text: string; until: string; firms: string } | null | undefined>(undefined);
  const [history, setHistory] = useState<BroadcastHistoryRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ver, setVer] = useState(0);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    if (!admin) {
      const c = await sb.rpc('system_broadcast_current');
      const r = ((c.data ?? []) as Array<{ body: string; expires_at: string }>)[0];
      setActive(r ? { text: r.body, until: formatListDateTime(r.expires_at), firms: '—' } : null);
      return;
    }
    const [q, u] = await Promise.all([
      sb.from('system_broadcast').select('id,body,expires_at,for_forwarder,for_carrier,for_client,created_at,created_by,cleared_at')
        .order('created_at', { ascending: false }).limit(10),
      sb.from('app_users').select('id,email,full_name,first_name,last_name,phone,role,active,org_id'),
    ]);
    if (q.error) { setMsg(q.error.message); setActive(null); return; }
    const rows = (q.data ?? []) as Db[];
    const people = new Map(((u.data ?? []) as PersonDb[]).map((p) => [p.id, p]));
    const now = Date.now();
    const cur = rows.find((r) => !r.cleared_at && Date.parse(r.expires_at) > now) ?? null;
    const firms = (r: Db) => firmsOf(r).join(', ') || t(locale, 'p3l_b_firms_none');
    setActive(cur ? { text: cur.body, until: formatListDateTime(cur.expires_at), firms: firms(cur) } : null);
    setHistory(rows.map((r) => {
      const p = r.created_by ? people.get(r.created_by) : undefined;
      return {
        id: String(r.id),
        when: formatListDateTime(r.created_at),
        who: p ? personName(p) : t(locale, 'p3l_h_auto'),
        text: r.body,
        line: `${firms(r)} · ${r.cleared_at
          ? tp(locale, 'p3l_b_cleared', { d: formatListDateTime(r.cleared_at) })
          : tp(locale, 'p3l_b_until', { d: formatListDateTime(r.expires_at) })}`,
      };
    }));
  }, [admin, locale]);
  useEffect(() => { void refresh(); }, [refresh]);

  const publish = (v: { text: string; firms: Firm[]; until: string }) => {
    if (readOnly) return;
    void (async () => {
      setBusy(true);
      const sb = await getSupabase();
      const { error } = await sb.rpc('admin_broadcast_set', {
        p_body: v.text,
        p_expires_at: new Date(v.until).toISOString(),
        p_forwarder: v.firms.includes('HHL'),
        p_carrier: v.firms.includes('SCX'),
        p_client: v.firms.includes('KSH'),
      });
      setBusy(false);
      if (error) { setMsg(error.message); return; }
      setMsg(t(locale, 'opt_acc_bcast_saved'));
      setVer((n) => n + 1);
      announceOptionsChanged();
      await refresh();
    })();
  };

  const clear = () => {
    if (readOnly) return;
    void (async () => {
      setBusy(true);
      const sb = await getSupabase();
      const { error } = await sb.rpc('admin_broadcast_clear');
      setBusy(false);
      if (error) { setMsg(error.message); return; }
      setMsg(t(locale, 'opt_acc_bcast_cleared'));
      await refresh();
    })();
  };

  if (active === undefined) return <div className="note" role="status">{msg ?? t(locale, 'p3l_loading')}</div>;
  return (
    <div data-panel="broadcast" data-live="broadcast">
      {msg ? <div className="note" role="status">{msg}</div> : null}
      <BroadcastScreen
        key={ver}
        locale={locale}
        draft={{ text: '', firms: ['HHL', 'KSH', 'SCX'], until: defaultUntil() }}
        history={history}
        readOnly={readOnly}
        onPublish={publish}
        active={active}
        onClear={clear}
        busy={busy}
      />
    </div>
  );
}
