import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { fmtDateTime } from '../lib/time';
import { lookupMult, type SefsTier } from '../lib/sefs';
import { prevWeekStatus, warsawDay } from '../lib/sefsWeek';
import './auth.css';
import { formatPlNumber } from '../lib/format';

const PROJECT_CODE = 'STEGRA_BODEN';

/**
 * I-2f — prawdziwy formularz BAF/SEFS dla HHL (zamiast fasady F2.4).
 * Parametry: wersjonowane (sefs_save_parameters), odczyty indeksu ze źródłem i datą (fuel_add_reading,
 * korekta = nowy wiersz z powodem), dziennik zmian (baf_change_log). Zapis wyłącznie RPC (0052).
 */
interface Params {
  version: number; valid_from: string; base_sek: number; base_pln: number; index_sek: string; index_pln: string;
  source_url_sek: string; source_url_pln: string; cycle: 'WEEKLY' | 'MONTHLY'; tiers_sek: SefsTier[]; tiers_pln: SefsTier[];
  agreed_with_carrier: boolean; agreement_ref: string | null; note: string | null; created_at: string;
  /** I-13 (0063): COST — koszt (przewoźnik), REVENUE — przychód (KSH), BOTH */
  applies_to?: 'COST' | 'REVENUE' | 'BOTH';
  /** #563: MIN ≤ t43 („od”), MAX od t44 („do X”) */
  tier_bound?: 'MIN' | 'MAX' | null;
}
interface Reading {
  id: number; index_code: 'SEK' | 'PLN'; period: string; reading_date: string; value: number; source_url: string;
  source_note: string | null; corrects_id: number | null; correction_reason: string | null; entered_at: string;
}
interface LogRow { at: string; actor: string; action: string; entity_id: string }

/** „lte;mult” w liniach → tablica progów (walidacja ostateczna w bazie: sefs_tiers_valid). */
export function parseTiers(text: string): SefsTier[] | null {
  const rows = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!rows.length) return null;
  const out: SefsTier[] = [];
  for (const r of rows) {
    const m = r.replace(/,/g, '.').split(/[;\s\t]+/).filter(Boolean);
    if (m.length !== 2) return null;
    const lte = Number(m[0]); const mult = Number(m[1]);
    if (!Number.isFinite(lte) || !Number.isFinite(mult)) return null;
    out.push({ lte, mult });
  }
  return out;
}
const tiersText = (x: SefsTier[] | undefined) => (x ?? []).map((r) => `${r.lte};${r.mult}`).join('\n');

/** Odczyty aktualne = bez korekty wskazującej na nie. */
export function currentReadings(rows: readonly Reading[]): Reading[] {
  const corrected = new Set(rows.map((r) => r.corrects_id).filter((x): x is number => x !== null));
  return rows.filter((r) => !corrected.has(r.id));
}

const EMPTY_P = { valid_from: '', base_sek: '', base_pln: '', index_sek: 'OKQ8 Diesel', index_pln: 'ORLEN ON', source_url_sek: '', source_url_pln: '', cycle: 'MONTHLY', tiers_sek: '', tiers_pln: '', agreed: false, agreement_ref: '', note: '', applies_to: 'BOTH' };
const EMPTY_R = { index_code: 'SEK', period: '', reading_date: '', value: '', source_url: '', note: '', corrects: '', reason: '' };

export default function BafForm() {
  const locale = useTowerStore((s) => s.locale);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [params, setParams] = useState<Params | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [pf, setPf] = useState(EMPTY_P);
  const [rf, setRf] = useState(EMPTY_R);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const pr = await sb.from('projects').select('id').eq('code', PROJECT_CODE).maybeSingle();
    const pid = (pr.data as { id: string } | null)?.id ?? null;
    setProjectId(pid);
    if (!pid) return;
    const [p, r, l] = await Promise.all([
      sb.from('sefs_parameters').select('*').eq('project_id', pid).order('version', { ascending: false }).limit(1),
      sb.from('fuel_index_readings').select('*').eq('project_id', pid).in('index_code', ['SEK', 'PLN']).order('period', { ascending: false }).order('id', { ascending: false }).limit(60),
      sb.rpc('baf_change_log', { p_project: pid, p_limit: 30 }),
    ]);
    const cur = ((p.data ?? []) as Params[])[0] ?? null;
    setParams(cur);
    setReadings((r.data ?? []) as Reading[]);
    setLog((l.data ?? []) as LogRow[]);
    if (cur) {
      setPf({ valid_from: cur.valid_from, base_sek: String(cur.base_sek), base_pln: String(cur.base_pln), index_sek: cur.index_sek, index_pln: cur.index_pln,
        source_url_sek: cur.source_url_sek, source_url_pln: cur.source_url_pln, cycle: cur.cycle, tiers_sek: tiersText(cur.tiers_sek), tiers_pln: tiersText(cur.tiers_pln),
        agreed: cur.agreed_with_carrier, agreement_ref: cur.agreement_ref ?? '', note: cur.note ?? '', applies_to: cur.applies_to ?? 'BOTH' });
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const live = useMemo(() => currentReadings(readings), [readings]);
  const preview = useMemo(() => {
    if (!params) return null;
    const sek = live.find((r) => r.index_code === 'SEK');
    if (!sek) return null;
    const pln = live.find((r) => r.index_code === 'PLN' && r.period === sek.period);
    if (!pln) return null;
    const bound = params.tier_bound === 'MAX' ? 'MAX' : 'MIN';
    const ms = lookupMult(Number(sek.value), params.tiers_sek, bound);
    const mp = lookupMult(Number(pln.value), params.tiers_pln, bound);
    return { period: sek.period, ms, mp, applied: Math.min(ms, mp) };
  }, [params, live]);

  // B-6h — czy poprzedni tydzień ma odczyty do opłaty paliwowej (to samo okno co sefs_week_calc)
  const week = useMemo(() => prevWeekStatus(
    readings, warsawDay(new Date()),
    params ? { sek: params.tiers_sek, pln: params.tiers_pln } : null,
    params?.tier_bound === 'MAX' ? 'MAX' : 'MIN',
  ), [readings, params]);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    setMsg(error ? { ok: false, text: authErrorPl(error.message) } : { ok: true, text: ok });
    if (!error) await refresh();
    return !error;
  };

  const saveParams = async (e: React.FormEvent) => {
    e.preventDefault();
    const ts = parseTiers(pf.tiers_sek); const tpn = parseTiers(pf.tiers_pln);
    if (!ts || !tpn || !projectId) { setMsg({ ok: false, text: t(locale, 'i2_baf_tiers_bad') }); return; }
    const sb = await getSupabase();
    await run(() => sb.rpc('sefs_save_parameters', { p_project: projectId, p: {
      valid_from: pf.valid_from, base_sek: Number(pf.base_sek.replace(',', '.')), base_pln: Number(pf.base_pln.replace(',', '.')),
      index_sek: pf.index_sek, index_pln: pf.index_pln, source_url_sek: pf.source_url_sek.trim(), source_url_pln: pf.source_url_pln.trim(),
      cycle: pf.cycle, tiers_sek: ts, tiers_pln: tpn, agreed_with_carrier: pf.agreed, agreement_ref: pf.agreement_ref, note: pf.note, applies_to: pf.applies_to,
    } }), t(locale, 'i2_baf_params_saved'));
  };

  const addReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    const sb = await getSupabase();
    const done = await run(() => sb.rpc('fuel_add_reading', {
      // B-6h: odczyt dzienny — okres = data odczytu (tylko takie wchodzą do średniej tygodnia); korekta zostaje przy okresie wiersza
      p_project: projectId, p_index: rf.index_code, p_period: rf.corrects ? rf.period.trim() : rf.reading_date, p_reading_date: rf.reading_date,
      p_value: Number(rf.value.replace(',', '.')), p_source_url: rf.source_url.trim(), p_note: rf.note || null,
      p_corrects: rf.corrects ? Number(rf.corrects) : null, p_reason: rf.corrects ? rf.reason : null,
    }), t(locale, rf.corrects ? 'i2_baf_reading_corrected' : 'i2_baf_reading_saved'));
    if (done) setRf(EMPTY_R);
  };

  const P = <K extends keyof typeof EMPTY_P>(k: K, v: (typeof EMPTY_P)[K]) => setPf((x) => ({ ...x, [k]: v }));
  const R = <K extends keyof typeof EMPTY_R>(k: K, v: string) => setRf((x) => ({ ...x, [k]: v }));

  return (
    <section className="panel option-panel option-wide fuel-panel" data-baf-form>
      <header className="panel-hd"><h2>{t(locale, 'i2_baf_h')}</h2>
        <span className="sub">{params ? tp(locale, 'i2_baf_sub_v', { v: String(params.version), d: params.valid_from }) : t(locale, 'i2_baf_sub_none')}</span>
        {params && !params.agreed_with_carrier ? <span className="pill p-amber" data-baf-unagreed>{t(locale, 'i2_baf_unagreed')}</span> : null}
      </header>
      {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'} auth-admin-row`} role="status">{msg.text}</div>}
      <div className="panel-bd">
        <div className="note option-note">{t(locale, 'i2_baf_note')}</div>
        {preview ? (
          <div className="banner" data-baf-preview style={{ margin: '8px 0' }}>
            {tp(locale, 'i2_baf_preview', { p: preview.period, s: formatPlNumber(preview.ms, 3), l: formatPlNumber(preview.mp, 3), a: formatPlNumber(preview.applied, 3) })}
          </div>
        ) : (
          <div className="note" data-no-source="baf-preview" style={{ margin: '8px 0' }}>{t(locale, 'i2_baf_no_preview')}</div>
        )}

        <div className={`note${week.mult !== null ? '' : ' sefs-week-missing'}`} data-sefs-week={week.mult !== null ? 'ok' : 'missing'} style={{ margin: '0 0 8px' }}>
          {tp(locale, 'b6_sefs_week', { from: week.from, to: week.to, s: String(week.nSek), p: String(week.nPln) })}{' '}
          {week.mult !== null
            ? tp(locale, 'b6_sefs_week_ok', { as: formatPlNumber(week.avgSek ?? 0, 2), ap: formatPlNumber(week.avgPln ?? 0, 2), m: formatPlNumber(week.mult, 3) })
            : t(locale, 'b6_sefs_week_missing')}
        </div>

        <h4 className="sec">{t(locale, 'i2_baf_params_h')}</h4>
        <form className="baf-form" onSubmit={saveParams} data-baf="params">
          <label>{t(locale, 'i2_baf_valid_from')}<input className="input" type="date" required value={pf.valid_from} onChange={(e) => P('valid_from', e.target.value)} /></label>
          <label>{t(locale, 'i2_baf_cycle')}<select className="input" value={pf.cycle} onChange={(e) => P('cycle', e.target.value)}><option value="MONTHLY">{t(locale, 'i2_baf_monthly')}</option><option value="WEEKLY">{t(locale, 'i2_baf_weekly')}</option></select></label>
          <label>{t(locale, 'i2_baf_base_sek')}<input className="input" inputMode="decimal" required value={pf.base_sek} onChange={(e) => P('base_sek', e.target.value)} /></label>
          <label>{t(locale, 'i2_baf_base_pln')}<input className="input" inputMode="decimal" required value={pf.base_pln} onChange={(e) => P('base_pln', e.target.value)} /></label>
          <label>{t(locale, 'i2_baf_index_sek')}<input className="input" required value={pf.index_sek} onChange={(e) => P('index_sek', e.target.value)} /></label>
          <label>{t(locale, 'i2_baf_index_pln')}<input className="input" required value={pf.index_pln} onChange={(e) => P('index_pln', e.target.value)} /></label>
          <label>{t(locale, 'i2_baf_url_sek')}<input className="input" type="url" required value={pf.source_url_sek} onChange={(e) => P('source_url_sek', e.target.value)} /></label>
          <label>{t(locale, 'i2_baf_url_pln')}<input className="input" type="url" required value={pf.source_url_pln} onChange={(e) => P('source_url_pln', e.target.value)} /></label>
          <label className="wide">{t(locale, 'i2_baf_tiers_sek')}<textarea className="input" rows={5} required placeholder="18.50;1.00" value={pf.tiers_sek} onChange={(e) => P('tiers_sek', e.target.value)} /></label>
          <label className="wide">{t(locale, 'i2_baf_tiers_pln')}<textarea className="input" rows={5} required placeholder="5.90;1.00" value={pf.tiers_pln} onChange={(e) => P('tiers_pln', e.target.value)} /></label>
          <label>{t(locale, 'i13_applies')}<select className="input" data-baf-applies value={pf.applies_to} onChange={(e) => P('applies_to', e.target.value)}>
            <option value="BOTH">{t(locale, 'i13_BOTH')}</option><option value="COST">{t(locale, 'i13_COST')}</option><option value="REVENUE">{t(locale, 'i13_REVENUE')}</option></select></label>
          <label className="check"><input type="checkbox" checked={pf.agreed} onChange={(e) => P('agreed', e.target.checked)} />{t(locale, 'i2_baf_agreed')}</label>
          <label>{t(locale, 'i2_baf_agreement_ref')}<input className="input" value={pf.agreement_ref} onChange={(e) => P('agreement_ref', e.target.value)} /></label>
          <label className="wide">{t(locale, 'i2_baf_change_note')}<input className="input full" value={pf.note} onChange={(e) => P('note', e.target.value)} /></label>
          <button className="btn" type="submit" disabled={busy || !projectId}>{t(locale, 'i2_baf_save_version')}</button>
        </form>

        <h4 className="sec">{t(locale, 'i2_baf_readings_h')}</h4>
        <form className="baf-form" onSubmit={addReading} data-baf="reading">
          <label>{t(locale, 'i2_baf_index')}<select className="input" value={rf.index_code} onChange={(e) => R('index_code', e.target.value)}><option value="SEK">SEK (OKQ8)</option><option value="PLN">PLN (ORLEN)</option></select></label>
          <label>{t(locale, 'b6_baf_period_daily')}<input className="input" type="date" required value={rf.reading_date} onChange={(e) => R('reading_date', e.target.value)} /></label>
          <label>{t(locale, 'i2_baf_value')}<input className="input" inputMode="decimal" required value={rf.value} onChange={(e) => R('value', e.target.value)} /></label>
          <label className="wide">{t(locale, 'i2_baf_source_url')}<input className="input full" type="url" required value={rf.source_url} onChange={(e) => R('source_url', e.target.value)} /></label>
          <label className="wide">{t(locale, 'i2_baf_source_note')}<input className="input full" value={rf.note} onChange={(e) => R('note', e.target.value)} /></label>
          {rf.corrects ? <label className="wide">{tp(locale, 'i2_baf_reason', { id: rf.corrects })}<input className="input full" required minLength={3} value={rf.reason} onChange={(e) => R('reason', e.target.value)} /></label> : null}
          <button className="btn" type="submit" disabled={busy || !projectId}>{t(locale, rf.corrects ? 'i2_baf_save_correction' : 'i2_baf_add_reading')}</button>
          {rf.corrects ? <button className="chipbtn" type="button" onClick={() => setRf(EMPTY_R)}>{t(locale, 'i2_baf_cancel')}</button> : null}
        </form>
        <div className="panel-bd flush" data-baf="readings">
          {readings.length === 0 ? <div className="auth-admin-row">{t(locale, 'i2_baf_no_readings')}</div> : readings.map((r) => {
            const isLive = live.includes(r);
            return (
              <div className={`auth-admin-row${isLive ? '' : ' inactive'}`} key={r.id} data-reading={r.id}>
                <span className="grow"><b>{r.index_code} · {r.period}</b> {formatPlNumber(Number(r.value), 2)} {r.index_code}/l <small>{tp(locale, 'i2_baf_read_on', { d: r.reading_date })} · <a href={r.source_url} target="_blank" rel="noreferrer">{t(locale, 'i2_baf_source')}</a>{r.corrects_id ? ` · ${tp(locale, 'i2_baf_corrects', { id: String(r.corrects_id), why: r.correction_reason ?? '' })}` : ''}{isLive ? '' : ` · ${t(locale, 'i2_baf_superseded')}`}</small></span>
                {isLive ? <button className="chipbtn" type="button" disabled={busy} onClick={() => setRf({ ...EMPTY_R, index_code: r.index_code, period: r.period, corrects: String(r.id), source_url: r.source_url })}>{t(locale, 'i2_baf_correct')}</button> : null}
              </div>
            );
          })}
        </div>

        <h4 className="sec">{t(locale, 'i2_baf_log_h')}</h4>
        <div className="panel-bd flush" data-baf="log">
          {log.length === 0 ? <div className="auth-admin-row">{t(locale, 'i2_baf_log_empty')}</div> : log.map((l, i) => (
            <div className="auth-admin-row" key={`${l.at}-${i}`}><span className="grow">{fmtDateTime(l.at)} · <b>{t(locale, `i2_baf_act_${l.action}`)}</b> · {l.entity_id} <small>{l.actor}</small></span></div>
          ))}
        </div>
      </div>
    </section>
  );
}
