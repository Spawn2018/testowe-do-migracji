/**
 * FERRY-STATUS / BN3 — ręczny komunikat armatora (Polferries, Stena, Tallink, Viking, Eckerö, DFDS).
 * Zapis przez operator_notice_apply: te same skutki co status automatyczny.
 * F7 #680 B4: wybór armatora → lista rejsów tylko tego armatora + p_operator.
 * BN9-c1: DP-86/DP-87 — lista z `noticeSailingsFor` (bez rejsów z przeszłości); DP-104 — w historii „automatyczny” /
 * „ręczny” (`source`, 0358) i link do źródła (`source_url`, tylko https, nowa karta).
 */
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../auth/client';
import { canFileOperatorNotice, ferryPortPl, noticeKindPl } from '../lib/ferryStatusPl';
import { effDeparture, fmtLocal } from '../lib/sailings';
import {
  FERRY_OPERATOR_CODES,
  isFerryOperator,
  operatorName,
  type FerryOperator,
} from '../lib/ferryCatalog';
import { fmtDateTime } from '../lib/time';
import { getNow } from '../lib/frozenNow';
import { noticeIsAuto, noticeSailingsFor, noticeSourceHref, noticeSourcePl } from '../lib/operatorNotices';
import { useTowerStore } from '../store/useTowerStore';

type Kind = 'ODWOLANY' | 'OPOZNIONY' | 'ZMIANA_GODZINY';


export interface NoticeRow {
  id: string;
  sailing_id: string;
  operator: string;
  kind: Kind;
  new_departure: string | null;
  note: string | null;
  created_at: string;
  /** 0358: AUTO (odczyt automatyczny) albo RECZNIE (formularz) */
  source?: string | null;
  /** 0358: adres źródła przy AUTO */
  source_url?: string | null;
}

/** DP-104: historia komunikatów — rodzaj, armator, źródło (automatyczny / ręczny + link https), treść, kiedy. */
export function NoticeHistory({ rows }: { rows: readonly NoticeRow[] }) {
  if (rows.length === 0) return null;
  return (
    <table style={{ width: '100%', fontSize: 13, marginTop: 8 }} data-notice-history>
      <tbody>
        {rows.map((h) => {
          const href = noticeSourceHref(h.source_url);
          return (
            <tr key={h.id} data-notice-row={h.id}>
              <td>{noticeKindPl(h.kind)}</td>
              <td>{isFerryOperator(h.operator) ? operatorName(h.operator) : h.operator}</td>
              <td data-notice-source={noticeIsAuto(h.source) ? 'AUTO' : 'RECZNIE'}>
                <span className={`pill ${noticeIsAuto(h.source) ? 'p-sea' : 'p-plan'}`}>{noticeSourcePl(h.source)}</span>
                {href ? (
                  <>
                    {' '}
                    <a href={href} target="_blank" rel="noopener noreferrer" data-notice-link>źródło</a>
                  </>
                ) : null}
              </td>
              <td>{h.note ?? '—'}</td>
              <td className="num">{fmtDateTime(h.created_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function OperatorNoticeForm() {
  const sailings = useTowerStore((s) => s.sailings);
  const [role, setRole] = useState<string | null>(null);
  const [operator, setOperator] = useState<FerryOperator | ''>('');
  const [sailingId, setSailingId] = useState('');
  const [kind, setKind] = useState<Kind>('ODWOLANY');
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<NoticeRow[]>([]);

  /* DP-87: „teraz” z dokładnością do minuty — rejs, który odszedł, znika z listy */
  const nowMin = Math.floor(getNow().getTime() / 60_000);
  const upcoming = useMemo(() => noticeSailingsFor(sailings, operator, nowMin * 60_000), [sailings, operator, nowMin]);

  useEffect(() => {
    if (sailingId && !upcoming.some((s) => s.id === sailingId)) setSailingId('');
  }, [upcoming, sailingId]);

  async function loadHistory() {
    const sb = await getSupabase();
    if (!sb) return;
    const { data } = await sb
      .from('operator_notices')
      .select('id,sailing_id,operator,kind,new_departure,note,created_at,source,source_url')
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
    if (!operator) { setMsg('Wybierz armatora.'); return; }
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
        p_operator: operator,
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
        Dla rejsów wszystkich armatorów, gdy komunikat nie wchodzi automatycznie. Zapisuje kto i kiedy.
      </p>
      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <label>
          Armator
          <select
            value={operator}
            onChange={(e) => {
              setOperator((e.target.value || '') as FerryOperator | '');
              setSailingId('');
            }}
            style={{ width: '100%' }}
          >
            <option value="">—</option>
            {FERRY_OPERATOR_CODES.map((op) => (
              <option key={op} value={op}>{operatorName(op)}</option>
            ))}
          </select>
        </label>
        <label>
          Rejs
          <select
            value={sailingId}
            onChange={(e) => setSailingId(e.target.value)}
            style={{ width: '100%' }}
            disabled={!operator}
          >
            <option value="">—</option>
            {upcoming.map((s) => (
              <option key={s.id} value={s.id}>
                {ferryPortPl(s.route)} · {isFerryOperator(s.source) ? operatorName(s.source) : (s.operator ?? '—')} · {s.vessel} · {fmtLocal(effDeparture(s))}
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
        <button type="button" disabled={busy || !operator} onClick={() => void submit()}>Zapisz komunikat</button>
        {msg ? <div className="note" data-notice-msg>{msg}</div> : null}
      </div>
      <NoticeHistory rows={history} />
    </div>
  );
}
