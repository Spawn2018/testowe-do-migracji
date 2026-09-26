/**
 * ANEKS 3 §2.3 — link dla kierowcy (tylko build Supabase; w demo niewidoczny — baseline bez zmian).
 * Wydaje przewoźnik transportu albo HHL; nowy link unieważnia poprzedni; odwołanie jednym przyciskiem.
 * Token pokazywany jeden raz — w bazie wyłącznie skrót.
 */
import { useState } from 'react';

export function DriverLinkPanel({ loadId }: { loadId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rpc = async (fn: 'issue_driver_token' | 'revoke_driver_token') => {
    const { getSupabase } = await import('../../auth/client');
    const sb = await getSupabase();
    const r = await sb.rpc(fn, { p_load_id: loadId });
    if (r.error) throw new Error(r.error.message);
    return r.data as unknown;
  };
  const run = (fn: 'issue_driver_token' | 'revoke_driver_token') => {
    setBusy(true);
    setNote(null);
    rpc(fn)
      .then((data) => {
        if (fn === 'issue_driver_token') {
          const url = `${window.location.origin}${window.location.pathname}#/driver/${String(data)}`;
          setLink(url);
          setNote('Nowy link — poprzedni przestał działać. Ważny do 24 h po rozładunku, najwyżej 14 dni.');
        } else {
          setLink(null);
          setNote(`Odwołano linków: ${String(data)}`);
        }
      })
      .catch((e: unknown) => setNote(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };
  return (
    <div data-driver-link>
      <h4 className="sec" style={{ marginTop: 18 }}>Link dla kierowcy</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <button type="button" className="btn" disabled={busy} onClick={() => run('issue_driver_token')}>
          Wygeneruj nowy link
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => run('revoke_driver_token')}>
          Odwołaj link
        </button>
      </div>
      {link && (
        <div className="mono" style={{ marginTop: 8, wordBreak: 'break-all', fontSize: 12 }} data-driver-link-url>
          {link}
        </div>
      )}
      {note && <div className="note" style={{ margin: '8px 0 0' }}>{note}</div>}
    </div>
  );
}
