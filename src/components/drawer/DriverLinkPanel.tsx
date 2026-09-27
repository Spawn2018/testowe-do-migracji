/**
 * ANEKS 3 §2.3 — link dla kierowcy (tylko build Supabase; w demo niewidoczny — baseline bez zmian).
 * Wydaje przewoźnik transportu albo HHL; nowy link unieważnia poprzedni; odwołanie jednym przyciskiem.
 * Token pokazywany jeden raz — w bazie wyłącznie skrót.
 */
import { useState } from 'react';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';

type Fn = 'issue_driver_token' | 'revoke_driver_token' | 'issue_driver_token_sms';

export function DriverLinkPanel({ loadId }: { loadId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locale = useTowerStore((s) => s.locale);
  const rpc = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED
    ? async (fn: Fn) => {
        const { getSupabase } = await import('../../auth/client');
        const sb = await getSupabase();
        const r = await sb.rpc(fn, { p_load_id: loadId });
        if (r.error) throw new Error(r.error.message);
        return r.data as unknown;
      }
    : async (): Promise<unknown> => { throw new Error(t(locale, 'a6_dl_demo')); };
  const run = (fn: Fn) => {
    setBusy(true);
    setNote(null);
    rpc(fn)
      .then((data) => {
        if (fn === 'issue_driver_token' || fn === 'issue_driver_token_sms') {
          // I-3 (0067): issue_driver_token_sms zwraca {token, sms_id}
          const token = fn === 'issue_driver_token_sms' ? String((data as { token?: string }).token ?? '') : String(data);
          const url = `${window.location.origin}${window.location.pathname}#/driver/${token}`;
          setLink(url);
          setNote(t(locale, fn === 'issue_driver_token_sms' ? 'i3_dl_sms_queued' : 'a6_dl_new'));
        } else {
          setLink(null);
          setNote(t(locale, 'a6_dl_revoked').replace('{n}', String(data)));
        }
      })
      .catch((e: unknown) => setNote(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };
  return (
    <div data-driver-link>
      <h4 className="sec" style={{ marginTop: 18 }}>{t(locale, 'a6_dl_h')}</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <button type="button" className="btn" disabled={busy} onClick={() => run('issue_driver_token')}>
          {t(locale, 'a6_dl_gen')}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => run('issue_driver_token_sms')} data-driver-link-sms>
          {t(locale, 'i3_dl_sms_btn')}
        </button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => run('revoke_driver_token')}>
          {t(locale, 'a6_dl_revoke')}
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
