import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { DIM_KEYS, EMPTY_ROW, buildRules, type FormRow } from '../lib/rateCard';
import './auth.css';

const PROJECT_CODE = 'STEGRA_BODEN';

/**
 * I-19 — formularz cennika HHL (0065). Koszt (przewoźnik) i przychód (klient) osobno; każda zmiana
 * to nowa wersja z kompletem pozycji (przedziały wymiarów + najwyżej jedna stawka STANDARD) i powodem;
 * dziennik zmian z audit_log (rate_card_change_log). Zapis wyłącznie RPC rate_card_save — walidacja
 * ostateczna w bazie (nakładanie przedziałów, organizacja zgodna ze stroną). Kwot nie wpisujemy (D-1).
 */
type Side = 'COST' | 'REVENUE';
interface Org { id: string; code: string; name: string; kind: string }
interface RuleRow {
  cargo_class: 'DIMENSIONED' | 'STANDARD'; length_from: number; length_to: number; width_from: number; width_to: number;
  height_from: number; height_to: number; weight_from: number; weight_to: number; base_rate: number; note: string | null;
}
interface Card { id: string; version: number; valid_from: string; note: string | null; created_at: string; currency: string; rate_rules: RuleRow[] }
interface LogRow { at: string; actor: string; entity_id: string; old_value: { rules?: unknown[] } | null; new_value: { side?: Side; version?: number; valid_from?: string; note?: string | null; rules?: unknown[] } | null }

const fmt = (n: number) => String(Number(n)).replace('.', ',');

export default function RateCardForm() {
  const locale = useTowerStore((s) => s.locale);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [side, setSide] = useState<Side>('COST');
  const [orgPick, setOrgId] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [validFrom, setValidFrom] = useState('');
  const [reason, setReason] = useState('');
  const [standard, setStandard] = useState('');
  const [rows, setRows] = useState<FormRow[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const sideOrgs = orgs.filter((o) => o.kind === (side === 'COST' ? 'CARRIER' : 'CLIENT'));
  const orgId = sideOrgs.some((o) => o.id === orgPick) ? orgPick : (sideOrgs[0]?.id ?? '');

  useEffect(() => {
    void (async () => {
      const sb = await getSupabase();
      const [pr, og] = await Promise.all([
        sb.from('projects').select('id').eq('code', PROJECT_CODE).maybeSingle(),
        sb.from('organizations').select('id, code, name, kind').in('kind', ['CARRIER', 'CLIENT']).order('code'),
      ]);
      setProjectId((pr.data as { id: string } | null)?.id ?? null);
      setOrgs((og.data ?? []) as Org[]);
    })();
  }, []);


  const refresh = useCallback(async () => {
    if (!projectId || !orgId) { setCards([]); return; }
    const sb = await getSupabase();
    const [c, l] = await Promise.all([
      sb.from('rate_cards').select('id, version, valid_from, note, created_at, currency, rate_rules(*)')
        .eq('project_id', projectId).eq('side', side).eq('org_id', orgId).order('version', { ascending: false }).limit(50),
      sb.rpc('rate_card_change_log', { p_project: projectId, p_limit: 30 }),
    ]);
    const list = (c.data ?? []) as Card[];
    setCards(list);
    setLog((l.data ?? []) as LogRow[]);
    const cur = list[0];
    setReason('');
    if (cur) {
      setValidFrom(cur.valid_from);
      const dims = cur.rate_rules.filter((r) => r.cargo_class !== 'STANDARD')
        .sort((a, b) => a.length_from - b.length_from || a.width_from - b.width_from || a.height_from - b.height_from || a.weight_from - b.weight_from);
      setRows(dims.map((r) => ({ ...Object.fromEntries(DIM_KEYS.map((k) => [k, fmt(r[k])])), base_rate: fmt(r.base_rate), note: r.note ?? '' }) as FormRow));
      const std = cur.rate_rules.find((r) => r.cargo_class === 'STANDARD');
      setStandard(std ? fmt(std.base_rate) : '');
    } else {
      setValidFrom(''); setRows([]); setStandard('');
    }
  }, [projectId, side, orgId]);
  useEffect(() => { void refresh(); }, [refresh]);

  const cur = cards[0] ?? null;
  const setRow = (i: number, k: keyof FormRow, v: string) => setRows((x) => x.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !orgId) return;
    const b = buildRules(rows, standard);
    if ('bad' in b) { setMsg({ ok: false, text: b.bad === 0 ? t(locale, 'i19_bad_standard') : tp(locale, 'i19_bad_row', { n: String(b.bad) }) }); return; }
    if (!b.rules.length) { setMsg({ ok: false, text: t(locale, 'i19_empty') }); return; }
    setBusy(true); setMsg(null);
    const sb = await getSupabase();
    const { data, error } = await sb.rpc('rate_card_save', { p_project: projectId, p_side: side, p_org: orgId, p: { valid_from: validFrom, note: reason, rules: b.rules } });
    setBusy(false);
    setMsg(error ? { ok: false, text: authErrorPl(error.message) } : { ok: true, text: tp(locale, 'i19_saved', { v: String(data) }) });
    if (!error) await refresh();
  };

  const orgCode = (id: string) => orgs.find((o) => o.id === id)?.code ?? '?';
  const logLabel = (l: LogRow) => {
    const [, s, o] = l.entity_id.split(':');
    return `${t(locale, s === 'COST' ? 'i19_side_COST' : 'i19_side_REVENUE')} · ${orgCode(o)} · ${tp(locale, 'i19_ver', { v: String(l.new_value?.version ?? '?') })}`;
  };

  return (
    <section className="panel option-panel option-wide pricing-panel" data-rate-card-form>
      <header className="panel-hd"><h2>{t(locale, 'i19_h')}</h2>
        <span className="sub" data-rate-card-current>{cur ? tp(locale, 'i19_sub_v', { v: String(cur.version), d: cur.valid_from }) : t(locale, 'i19_sub_none')}</span>
        <span className="sub">EUR</span>
      </header>
      {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'} auth-admin-row`} role="status">{msg.text}</div>}
      <div className="panel-bd">
        <div className="note option-note">{t(locale, 'i19_note')}</div>
        <form className="baf-form" onSubmit={save} data-rate-card="form">
          <label>{t(locale, 'i19_side')}<select className="input" value={side} onChange={(e) => setSide(e.target.value as Side)}>
            <option value="COST">{t(locale, 'i19_side_COST')}</option><option value="REVENUE">{t(locale, 'i19_side_REVENUE')}</option></select></label>
          <label>{t(locale, side === 'COST' ? 'i19_org_carrier' : 'i19_org_client')}<select className="input" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {sideOrgs.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}</select></label>
          <label>{t(locale, 'i19_valid_from')}<input className="input" type="date" required value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></label>
          <label>{t(locale, 'i19_standard')}<input className="input" inputMode="decimal" placeholder={t(locale, 'i19_standard_ph')} value={standard} onChange={(e) => setStandard(e.target.value)} /></label>
          <div className="wide" data-rate-card="rows">
            <h4 className="sec">{t(locale, 'i19_rows_h')}</h4>
            {rows.length === 0 ? <div className="note">{t(locale, 'i19_rows_none')}</div> : (
              <table className="rate-table">
                <thead><tr><th>{t(locale, 'i19_col_len')}</th><th>{t(locale, 'i19_col_wid')}</th><th>{t(locale, 'i19_col_hei')}</th><th>{t(locale, 'i19_col_wei')}</th><th>{t(locale, 'i19_col_rate')}</th><th>{t(locale, 'i19_col_note')}</th><th /></tr></thead>
                <tbody>{rows.map((r, i) => (
                  <tr key={i} data-rate-row={i + 1}>
                    {(['length', 'width', 'height', 'weight'] as const).map((d) => (
                      <td key={d}><input className="input" inputMode="decimal" size={5} aria-label={tp(locale, `i19_aria_${d}_from`, { n: String(i + 1) })} value={r[`${d}_from`]} onChange={(e) => setRow(i, `${d}_from`, e.target.value)} />
                        {' – '}<input className="input" inputMode="decimal" size={5} aria-label={tp(locale, `i19_aria_${d}_to`, { n: String(i + 1) })} value={r[`${d}_to`]} onChange={(e) => setRow(i, `${d}_to`, e.target.value)} /></td>
                    ))}
                    <td><input className="input" inputMode="decimal" size={8} aria-label={tp(locale, 'i19_aria_rate', { n: String(i + 1) })} value={r.base_rate} onChange={(e) => setRow(i, 'base_rate', e.target.value)} /></td>
                    <td><input className="input" size={12} aria-label={tp(locale, 'i19_aria_note', { n: String(i + 1) })} value={r.note} onChange={(e) => setRow(i, 'note', e.target.value)} /></td>
                    <td><button className="chipbtn" type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>{t(locale, 'i19_remove')}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            <button className="chipbtn" type="button" onClick={() => setRows((x) => [...x, { ...EMPTY_ROW }])}>{t(locale, 'i19_add_row')}</button>
          </div>
          <label className="wide">{t(locale, cur ? 'i19_reason_req' : 'i19_reason')}<input className="input full" required={!!cur} minLength={cur ? 3 : undefined} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <button className="btn" type="submit" disabled={busy || !projectId || !orgId}>{t(locale, 'i19_save')}</button>
        </form>

        <h4 className="sec">{t(locale, 'i19_versions_h')}</h4>
        <div className="panel-bd flush" data-rate-card="versions">
          {cards.length === 0 ? <div className="auth-admin-row">{t(locale, 'i19_versions_none')}</div> : cards.map((c) => (
            <div className="auth-admin-row" key={c.id} data-rate-version={c.version}>
              <span className="grow"><b>{tp(locale, 'i19_ver', { v: String(c.version) })}</b> · {tp(locale, 'i19_from', { d: c.valid_from })} · {tp(locale, 'i19_n_rules', { n: String(c.rate_rules.length) })}{c.rate_rules.some((r) => r.cargo_class === 'STANDARD') ? ` · ${t(locale, 'i19_has_std')}` : ` · ${t(locale, 'i19_no_std')}`}
                {c.note ? <small> · {c.note}</small> : null}</span>
            </div>
          ))}
        </div>

        <h4 className="sec">{t(locale, 'i19_log_h')}</h4>
        <div className="panel-bd flush" data-rate-card="log">
          {log.length === 0 ? <div className="auth-admin-row">{t(locale, 'i19_log_empty')}</div> : log.map((l, i) => (
            <div className="auth-admin-row" key={`${l.at}-${i}`}><span className="grow">{new Date(l.at).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })} · <b>{logLabel(l)}</b> · {tp(locale, 'i19_log_rules', { a: String(l.old_value?.rules?.length ?? 0), b: String(l.new_value?.rules?.length ?? 0) })}{l.new_value?.note ? ` · ${l.new_value.note}` : ''} <small>{l.actor}</small></span></div>
          ))}
        </div>
      </div>
    </section>
  );
}
