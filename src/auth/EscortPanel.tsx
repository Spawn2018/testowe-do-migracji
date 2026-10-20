import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { toNationalPhone } from '../lib/phoneNational';
import './auth.css';

/**
 * III-4 (0087) — pojazdy pilotujące. TEL-1: telefon pilota = numer krajowy.
 */
type Row = {
  company: string;
  plate: string;
  scope: 'PL' | 'SE' | 'PL_SE';
  driver_name?: string;
  driver_phone?: string;
  driver_phone_country?: 'PL' | 'SE';
};
const SCOPES = ['PL_SE', 'PL', 'SE'] as const;

export default function EscortPanel({ loadId }: { loadId: string }) {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const canWrite = role === 'HHL' || role === 'SCX';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [req, setReq] = useState(0);
  const [saved, setSaved] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const [e, s] = await Promise.all([
      sb.from('load_escorts').select('seq,company,plate,scope').eq('load_id', loadId).order('seq'),
      sb.rpc('load_escort_status').eq('load_id', loadId),
    ]);
    /* D-20261020-1243-01: kontakty pilotów widzą HHL, SCX i KSH (zgody RODO) — zapis dalej tylko HHL i SCX */
    const c = await sb.rpc('load_escort_contacts').eq('load_id', loadId);
    const contacts = new Map(((c.data ?? []) as { seq: number; driver_name: string | null; driver_phone: string | null }[]).map((x) => [x.seq, x]));
    const list = ((e.data ?? []) as (Row & { seq: number })[]).map((r) => ({
      company: r.company,
      plate: r.plate,
      scope: r.scope,
      driver_name: contacts.get(r.seq)?.driver_name ?? '',
      driver_phone: contacts.get(r.seq)?.driver_phone ?? '',
      driver_phone_country: 'PL' as const,
    }));
    setRows(list);
    setSaved(list.length);
    const st = (Array.isArray(s.data) ? s.data[0] : null) as { required?: number } | null;
    setReq(st?.required ?? 0);
    setDirty(false);
  }, [loadId, canWrite]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (rows === null) return null;

  const set = (i: number, k: keyof Row, v: string) => {
    setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
    setDirty(true);
  };

  const onPhoneBlur = (i: number) => {
    const cur = rows[i];
    if (!cur?.driver_phone) return;
    const n = toNationalPhone(cur.driver_phone, cur.driver_phone_country ?? 'PL');
    setRows(rows.map((r, j) => (j === i
      ? { ...r, driver_phone: n.national, driver_phone_country: n.country === 'SE' ? 'SE' : 'PL' }
      : r)));
    setDirty(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const sb = await getSupabase();
    const payload = rows.map((r) => {
      const n = toNationalPhone(r.driver_phone ?? '', r.driver_phone_country ?? 'PL');
      return {
        ...r,
        plate: r.plate.trim().toUpperCase(),
        driver_name: (r.driver_name ?? '').trim() || null,
        driver_phone: n.national || null,
        driver_phone_country: n.country === 'SE' ? 'SE' : 'PL',
      };
    });
    const { error } = await sb.rpc('load_escorts_set', { p_load: loadId, p_escorts: payload });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: authErrorPl(error.message) });
      return;
    }
    setMsg({ ok: true, text: t(locale, 'e34_saved') });
    await refresh();
    const { refreshFromServer } = await import('../data/supabaseBridge');
    await refreshFromServer({ keepSelection: true });
  };

  const missing = Math.max(req - saved, 0);
  return (
    <div data-escorts={saved} data-escorts-required={req} style={{ marginTop: 18 }}>
      <h4 className="sec">{t(locale, 'e34_h')}</h4>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <span className={`pill ${missing > 0 ? 'p-red' : req > 0 ? 'p-go' : ''}`} data-escorts-state={missing > 0 ? 'missing' : 'ok'}>
          {tp(locale, 'e34_state', { a: String(saved), r: String(req) })}
        </span>
        {missing > 0 && <small>{tp(locale, 'e34_missing', { n: String(missing) })}</small>}
      </div>
      {!canWrite ? (
        rows.length === 0 ? <div className="note">{t(locale, 'e34_none')}</div> : (
          <dl className="kv">
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <dt>{tp(locale, 'e34_n', { n: String(i + 1) })}</dt>
                <dd><span className="mono" data-content>{r.plate}</span> · {r.company} · {t(locale, `e34_scope_${r.scope}`)}</dd>
              </div>
            ))}
          </dl>
        )
      ) : (
        <form className="baf-form" onSubmit={(e) => void save(e)} data-escorts-form>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'contents' }} data-escort-row={i + 1}>
              <label className="wide">{tp(locale, 'e34_company_n', { n: String(i + 1) })}<input className="input" name={`company${i}`} required maxLength={120} value={r.company} onChange={(e) => set(i, 'company', e.target.value)} /></label>
              <label>{t(locale, 'e34_plate')}<input className="input mono" name={`plate${i}`} required maxLength={15} value={r.plate} onChange={(e) => set(i, 'plate', e.target.value)} /></label>
              <label>{t(locale, 'e34_scope')}<select className="input" name={`scope${i}`} value={r.scope} onChange={(e) => set(i, 'scope', e.target.value)}>
                {SCOPES.map((s) => <option key={s} value={s}>{t(locale, `e34_scope_${s}`)}</option>)}
              </select></label>
              <label>{t(locale, 'd22_driver')}<input className="input" name={`driver${i}`} maxLength={120} autoComplete="off" value={r.driver_name ?? ''} onChange={(e) => set(i, 'driver_name', e.target.value)} /></label>
              <label>{t(locale, 'd22_phone')}<input className="input mono" name={`phone${i}`} type="tel" maxLength={20} placeholder="601234567" autoComplete="off" value={r.driver_phone ?? ''} onChange={(e) => set(i, 'driver_phone', e.target.value)} onBlur={() => onPhoneBlur(i)} /></label>
              <label className="wide"><button type="button" className="btn ghost" data-escort-remove={i + 1} onClick={() => { setRows(rows.filter((_, j) => j !== i)); setDirty(true); }}>{t(locale, 'e34_remove')}</button></label>
            </div>
          ))}
          <label className="wide"><button type="button" className="btn ghost" disabled={rows.length >= 5} data-escort-add onClick={() => { setRows([...rows, { company: '', plate: '', scope: 'PL_SE', driver_phone_country: 'PL' }]); setDirty(true); }}>{t(locale, 'e34_add')}</button></label>
          <div className="note" style={{ margin: 0, gridColumn: '1 / -1' }} data-escort-pii-note>{t(locale, 'd22_note')}</div>
          <label className="wide"><button type="submit" className="btn" disabled={busy || !dirty} data-escorts-save>{t(locale, 'e34_save')}</button></label>
        </form>
      )}
      {msg && <div className={`note ${msg.ok ? '' : 'err'}`} role="status" style={{ margin: '8px 0 0' }} data-escorts-msg={msg.ok ? 'ok' : 'err'}>{msg.text}</div>}
    </div>
  );
}
