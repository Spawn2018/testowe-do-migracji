import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { formatCalendarDay } from '../lib/time';
import './auth.css';

/**
 * SCOPE 6.4 (0086) — zezwolenia transportu w szufladzie (zakładka Dokumenty): lista powiązanych zezwoleń z oceną
 * zgodności z zestawem (permit_fits, RLS), formularz nowego zezwolenia (load_permit_save — zapis + powiązanie),
 * powiązanie istniejącego zezwolenia projektu (load_permit_link) i odłączenie przed „Gotowy” (load_permit_unlink).
 * Zapis: HHL i przewoźnik transportu (baza odmawia innym); KSH — tylko odczyt. Tylko build Supabase (chunk leniwy).
 */
type Permit = {
  id: string; country: string; permit_no: string; authority: string | null; valid_from: string; valid_until: string;
  max_length_m: number | null; max_width_m: number | null; max_height_m: number | null; max_weight_t: number | null;
  escort_required: number; route_desc: string | null;
};
const COLS = 'id,country,permit_no,authority,valid_from,valid_until,max_length_m,max_width_m,max_height_m,max_weight_t,escort_required,route_desc';
const PRE_READY = ['PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING'];
const EMPTY = { country: 'PL', no: '', authority: '', from: '', until: '', l: '', w: '', h: '', m: '', escort: '0', route: '' };

export default function PermitForm({ loadId }: { loadId: string }) {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const canWrite = role === 'HHL' || role === 'SCX';
  const [linked, setLinked] = useState<(Permit & { ok: boolean | null; breaches: string[] })[] | null>(null);
  const [other, setOther] = useState<Permit[]>([]);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const ld = await sb.from('loads').select('project_id,status').eq('id', loadId).maybeSingle();
    const pid = (ld.data as { project_id?: string } | null)?.project_id;
    setStatus((ld.data as { status?: string } | null)?.status ?? '');
    const lp = await sb.from('load_permits').select('permit_id').eq('load_id', loadId);
    const ids = ((lp.data ?? []) as { permit_id: string }[]).map((r) => r.permit_id);
    const all = pid ? await sb.from('permits').select(COLS).eq('project_id', pid).order('valid_until', { ascending: false }) : { data: [] };
    const rows = (all.data ?? []) as Permit[];
    const withFit = await Promise.all(rows.filter((p) => ids.includes(p.id)).map(async (p) => {
      const r = await sb.rpc('permit_fits', { p_load_id: loadId, p_permit_id: p.id });
      const fit = (Array.isArray(r.data) ? r.data[0] : r.data) as { ok?: boolean; breaches?: string[] } | null;
      return { ...p, ok: typeof fit?.ok === 'boolean' ? fit.ok : null, breaches: fit?.breaches ?? [] };
    }));
    setLinked(withFit);
    setOther(rows.filter((p) => !ids.includes(p.id)));
  }, [loadId]);
  useEffect(() => { void refresh(); }, [refresh]);

  const after = async (text: string) => {
    setMsg({ ok: true, text });
    await refresh();
    const { refreshFromServer } = await import('../data/supabaseBridge');
    await refreshFromServer({ keepSelection: true });
  };
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.rpc('load_permit_save', {
      p_load: loadId, p_country: f.country, p_permit_no: f.no, p_valid_from: f.from, p_valid_until: f.until,
      p_max_length_m: num(f.l), p_max_width_m: num(f.w), p_max_height_m: num(f.h), p_max_weight_t: num(f.m),
      p_escort_required: Number(f.escort) || 0, p_route_desc: f.route || null, p_authority: f.authority || null,
    });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: authErrorPl(error.message) }); return; }
    setF(EMPTY); setOpen(false);
    await after(t(locale, 'p64_saved'));
  };
  const link = async () => {
    if (!pick) return;
    setBusy(true); setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.rpc('load_permit_link', { p_load: loadId, p_permit: pick });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: authErrorPl(error.message) }); return; }
    setPick('');
    await after(t(locale, 'p64_linked'));
  };
  const unlink = async (id: string) => {
    setBusy(true); setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.rpc('load_permit_unlink', { p_load: loadId, p_permit: id });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: authErrorPl(error.message) }); return; }
    await after(t(locale, 'p64_unlinked'));
  };
  if (linked === null) return null;
  const lim = (v: number | null, u: string) => (v === null ? '—' : `${String(v).replace('.', locale === 'en' ? '.' : ',')} ${u}`);
  const P = (k: keyof typeof EMPTY, v: string) => setF((s) => ({ ...s, [k]: v }));
  const preReady = PRE_READY.includes(status);
  return (
    <div data-permit-form style={{ marginTop: 18 }}>
      <h4 className="sec">{t(locale, 'p64_h')}</h4>
      {linked.length === 0 ? <div className="note" data-permit-none>{t(locale, 'p64_none')}</div> : (
        <dl className="kv">
          {linked.map((p) => (
            <div key={p.id} style={{ display: 'contents' }} data-permit-row={p.permit_no}>
              <dt><span className="mono">{p.country}</span> · <span className="mono" data-content>{p.permit_no}</span></dt>
              <dd>
                <span className={`pill ${p.ok === false ? 'p-red' : p.ok ? 'p-go' : ''}`} data-permit-fit={p.ok === false ? 'no' : p.ok ? 'yes' : 'unknown'}>
                  {t(locale, p.ok === false ? 'p64_fit_no' : p.ok ? 'p64_fit_yes' : 'p64_fit_unknown')}
                </span>
                {p.breaches.length ? ` ${p.breaches.map((b) => t(locale, `p64_b_${b}`)).join(', ')}` : ''}
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4, fontWeight: 400 }}>
                  {formatCalendarDay(p.valid_from)} – {formatCalendarDay(p.valid_until)}{p.authority ? ` · ${p.authority}` : ''} · {t(locale, 'p64_limits')}: {lim(p.max_length_m, 'm')} × {lim(p.max_width_m, 'm')} × {lim(p.max_height_m, 'm')}, {lim(p.max_weight_t, 't')} · {t(locale, 'p64_escort')}: {p.escort_required}
                  {p.route_desc ? <><br />{t(locale, 'p64_route')}: {p.route_desc}</> : null}
                </div>
                {canWrite && preReady && (
                  <button type="button" className="btn ghost" style={{ marginTop: 6 }} disabled={busy} data-permit-unlink={p.permit_no} onClick={() => void unlink(p.id)}>{t(locale, 'p64_unlink')}</button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {canWrite && (
        <div style={{ marginTop: 10 }}>
          {other.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <select className="input" aria-label={t(locale, 'p64_pick')} value={pick} onChange={(e) => setPick(e.target.value)} data-permit-pick>
                <option value="">{t(locale, 'p64_pick')}</option>
                {other.map((p) => <option key={p.id} value={p.id}>{p.country} · {p.permit_no} · {p.valid_until}</option>)}
              </select>
              <button type="button" className="btn ghost" disabled={busy || !pick} onClick={() => void link()} data-permit-link>{t(locale, 'p64_link')}</button>
            </div>
          )}
          {!open ? (
            <button type="button" className="btn" onClick={() => setOpen(true)} data-permit-add>{t(locale, 'p64_add')}</button>
          ) : (
            <form className="baf-form" onSubmit={(e) => void save(e)} data-permit="form">
              <label>{t(locale, 'p64_country')}<select className="input" name="country" value={f.country} onChange={(e) => P('country', e.target.value)}><option value="PL">PL</option><option value="SE">SE</option></select></label>
              <label className="wide">{t(locale, 'p64_no')}<input className="input" name="permit_no" required maxLength={80} value={f.no} onChange={(e) => P('no', e.target.value)} /></label>
              <label>{t(locale, 'p64_authority')}<input className="input" name="authority" maxLength={200} value={f.authority} onChange={(e) => P('authority', e.target.value)} /></label>
              <label className="wide">{t(locale, 'p64_from')}<input type="date" className="input" name="valid_from" required value={f.from} onChange={(e) => P('from', e.target.value)} /></label>
              <label className="wide">{t(locale, 'p64_until')}<input type="date" className="input" name="valid_until" required min={f.from || undefined} value={f.until} onChange={(e) => P('until', e.target.value)} /></label>
              <label>{t(locale, 'p64_len')}<input className="input" name="max_length_m" inputMode="decimal" value={f.l} onChange={(e) => P('l', e.target.value)} /></label>
              <label>{t(locale, 'p64_wid')}<input className="input" name="max_width_m" inputMode="decimal" value={f.w} onChange={(e) => P('w', e.target.value)} /></label>
              <label>{t(locale, 'p64_hei')}<input className="input" name="max_height_m" inputMode="decimal" value={f.h} onChange={(e) => P('h', e.target.value)} /></label>
              <label>{t(locale, 'p64_mass')}<input className="input" name="max_weight_t" inputMode="decimal" value={f.m} onChange={(e) => P('m', e.target.value)} /></label>
              <label>{t(locale, 'p64_escort')}<select className="input" name="escort_required" value={f.escort} onChange={(e) => P('escort', e.target.value)}>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <label className="wide">{t(locale, 'p64_route')}<textarea className="input" name="route_desc" rows={2} maxLength={2000} value={f.route} onChange={(e) => P('route', e.target.value)} /></label>
              <label><button type="submit" className="btn" disabled={busy} data-permit-save>{t(locale, 'p64_save')}</button></label>
              <label><button type="button" className="btn ghost" onClick={() => { setOpen(false); setF(EMPTY); }}>{t(locale, 'p64_cancel')}</button></label>
            </form>
          )}
          <div className="note" style={{ margin: '8px 0 0' }}>{t(locale, 'p64_note')}</div>
        </div>
      )}
      {msg && <div className={`note ${msg.ok ? '' : 'err'}`} role="status" style={{ margin: '8px 0 0' }} data-permit-msg={msg.ok ? 'ok' : 'err'}>{msg.text}</div>}
    </div>
  );
}
