/**
 * FERRY-STATUS — ręczny komunikat armatora (POLSCA bez obchodzenia 403/503).
 * Zapis przez operator_notice_apply: te same skutki co status automatyczny.
 */
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../auth/client';
import { canFileOperatorNotice, ferryPortPl, noticeKindPl } from '../lib/ferryStatusPl';
import { effDeparture, fmtLocal } from '../lib/sailings';
import { fmtDateTime } from '../lib/time';
import { useTowerStore } from '../store/useTowerStore';

type Kind = 'ODWOLANY' | 'OPOZNIONY' | 'ZMIANA_GODZINY';


interface NoticeRow {
  id: string;
  sailing_id: string;
  operator: string;
  kind: Kind;
  new_departure: string | null;
  note: string | null;
  created_at: string;
}

export function OperatorNoticeForm() {
  const sailings = useTowerStore((s) => s.sailings);
  const [role, setRole] = useState<string | null>(null);
  const [sailingId, setSailingId] = useState('');
  const [kind, setKind] = useState<Kind>('ODWOLANY');
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<NoticeRow[]>([]);

  const upcoming = useMemo(
    () => [...sailings].sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b))).slice(0, 40),
    [sailings],
  );

  async function loadHistory() {
    const sb = await getSupabase();
    if (!sb) return;
    const { data } = await sb
      .from('operator_notices')
      .select('id,sailing_id,operator,kind,new_departure,note,created_at')
      .order('created_at', { ascending: false })
      .limit(8);
    setHistory((data ?? []) as NoticeRow[]);
  }

  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    let cancelled = false;
    void (async () => {
      const sb = await getSupabase();
      if (!sb || cancelled) return;
      const { data } = await sb.rpc('my_profile');
      const row = Array.isArray(data) ? data[0] : data;
      if (!cancelled) setRole(typeof row?.role === 'string' ? row.role : null);
      if (!cancelled) await loadHistory();
    })();
    return () => { cancelled = true; };
  }, []);

  if (import.meta.env.VITE_AUTH_MODE !== 'supabase' || !canFileOperatorNotice(role)) return null;

  async function submit() {
    setMsg(null);
    if (!sailingId) { setMsg('Wybierz rejs.'); return; }
    if (kind !== 'ODWOLANY' && !when) { setMsg('Podaj nową godzinę.'); return; }
    setBusy(true);
    try {
      const sb = await getSupabase();
      if (!sb) { setMsg('Brak połączenia.'); return; }
      const { error } = await sb.rpc('operator_notice_apply', {
        p_sailing: sailingId,
        p_kind: kind,
        p_new_departure: kind === 'ODWOLANY' ? null : new Date(when).toISOString(),
        p_note: note.trim() || null,
      });
      if (error) { setMsg(error.message); return; }
      setMsg('Zapisane. ETA i decyzja idą tak jak przy statusie automatycznym.');
      setNote('');
      await loadHistory();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-panel="operator-notice" style={{ marginTop: 16 }}>
      <h4 className="sec">Komunikat armatora</h4>
      <p className="note" style={{ border: 0 }}>
        Dla rejsów Polferries, gdy komunikat nie wchodzi automatycznie. Zapisuje kto i kiedy.
      </p>
      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <label>
          Rejs
          <select value={sailingId} onChange={(e) => setSailingId(e.target.value)} style={{ width: '100%' }}>
            <option value="">—</option>
            {upcoming.map((s) => (
              <option key={s.id} value={s.id}>
                {ferryPortPl(s.route)} · {s.vessel} · {fmtLocal(effDeparture(s))}
              </option>
            ))}
          </select>
        </label>
        <label>
          Typ
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} style={{ width: '100%' }}>
            {(['ODWOLANY', 'OPOZNIONY', 'ZMIANA_GODZINY'] as Kind[]).map((k) => <option key={k} value={k}>{noticeKindPl(k)}</option>)}
          </select>
        </label>
        {kind !== 'ODWOLANY' ? (
          <label>
            Nowa godzina
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
        ) : null}
        <label>
          Treść
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </label>
        <button type="button" disabled={busy} onClick={() => void submit()}>Zapisz komunikat</button>
        {msg ? <div className="note" data-notice-msg>{msg}</div> : null}
      </div>
      {history.length > 0 ? (
        <table style={{ width: '100%', fontSize: 13, marginTop: 8 }}>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{noticeKindPl(h.kind)}</td>
                <td>{h.operator === 'STENA' ? 'Stena Line' : 'Polferries'}</td>
                <td>{h.note ?? '—'}</td>
                <td className="num">{fmtDateTime(h.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
