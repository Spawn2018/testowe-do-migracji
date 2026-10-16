import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { getAuthProfile } from './profile';
import { safeStorageTarget } from '../data/storagePath';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { fmtDateRange } from '../lib/time';
import './auth.css';

/**
 * D-30 / SCOPE 6.6 — formularz polisy OCP: przewoźnik wpisuje (PENDING), HHL zatwierdza;
 * HHL może też zapisać od razu jako APPROVED. Lista + notka wygaśnięcia z bazy (nie fasada).
 * Tylko build Supabase (chunk leniwy).
 */
type Policy = {
  id: string;
  org_id: string;
  org_name: string;
  policy_no: string;
  insurer: string | null;
  sum_insured: number | null;
  currency: string;
  covers_oversize: boolean;
  covers_sweden: boolean;
  valid_from: string;
  valid_until: string;
  document_id: string | null;
  days_left: number;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reject_reason: string | null;
};
type Org = { id: string; code: string; name: string };

const EMPTY = {
  orgId: '', no: '', insurer: '', from: '', until: '', sum: '', currency: 'EUR',
  oversize: true, sweden: true,
};

export default function InsurancePolicyForm() {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const canWrite = role === 'HHL' || role === 'SCX';
  const isHhl = role === 'HHL';
  const [rows, setRows] = useState<Policy[] | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const [list, og, pr] = await Promise.all([
      sb.rpc('insurance_policies_list'),
      sb.from('organizations').select('id, code, name').eq('kind', 'CARRIER').order('code'),
      sb.from('projects').select('id').in('code', ['STEGRA_BODEN', 'STEGRA']).limit(1),
    ]);
    if (list.error) {
      setRows([]);
      setMsg({ ok: false, text: authErrorPl(list.error.message) });
      return;
    }
    setRows((list.data ?? []) as Policy[]);
    setOrgs((og.data ?? []) as Org[]);
    setProjectId(((pr.data ?? []) as { id: string }[])[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (role !== 'HHL' && role !== 'SCX') return;
    void refresh();
  }, [role, refresh]);

  if (role !== 'HHL' && role !== 'SCX') return null;
  if (rows === null) return null;

  const profile = getAuthProfile();
  const myOrg = orgs.find((o) => o.code === profile?.org_code);
  const defaultOrg = isHhl ? (f.orgId || orgs[0]?.id || '') : (myOrg?.id || orgs[0]?.id || '');

  const P = (k: keyof typeof EMPTY, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  const uploadDoc = async (sb: Awaited<ReturnType<typeof getSupabase>>, orgId: string): Promise<string | null> => {
    if (!file || !projectId) return null;
    const created = await sb.rpc('create_document', {
      p_load_id: null,
      p_category: 'INSURANCE',
      p_file_name: file.name,
      p_mime: file.type || 'application/pdf',
      p_size: file.size,
      p_project_id: projectId,
    });
    if (created.error) throw new Error(created.error.message);
    const row = (Array.isArray(created.data) ? created.data[0] : created.data) as
      | { id: string; bucket: string; object_path: string } | undefined;
    if (!row) throw new Error('Brak rejestracji dokumentu');
    const stored = safeStorageTarget(row.bucket, row.object_path);
    const objectPath = stored.objectPath.replace(/\.\.\//g, '');
    const up = await sb.storage.from(stored.bucket).upload(objectPath, file, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    });
    if (up.error) {
      await sb.rpc('discard_document', { p_id: row.id });
      throw new Error(up.error.message);
    }
    void orgId;
    return row.id;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const sb = await getSupabase();
      const orgId = isHhl ? (f.orgId || defaultOrg) : defaultOrg;
      if (!orgId) throw new Error(t(locale, 'd30_err_org'));
      const docId = await uploadDoc(sb, orgId);
      const sum = f.sum.trim() === '' ? null : Number(f.sum.replace(',', '.'));
      const { error } = await sb.rpc('insurance_policy_save', {
        p_org: orgId,
        p_policy_no: f.no,
        p_valid_from: f.from,
        p_valid_until: f.until,
        p_insurer: f.insurer || null,
        p_covers_oversize: f.oversize,
        p_covers_sweden: f.sweden,
        p_sum_insured: sum,
        p_currency: f.currency,
        p_document: docId,
      });
      if (error) throw new Error(error.message);
      setF({ ...EMPTY, orgId: isHhl ? orgId : '' });
      setFile(null);
      setOpen(false);
      setMsg({ ok: true, text: t(locale, isHhl ? 'd30_saved_hhl' : 'd30_saved_carrier') });
      await refresh();
    } catch (err) {
      setMsg({ ok: false, text: authErrorPl(err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id: string, approve: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      const sb = await getSupabase();
      const { error } = await sb.rpc('insurance_policy_approve', {
        p_id: id,
        p_approve: approve,
        p_reason: approve ? null : rejectReason,
      });
      if (error) throw new Error(error.message);
      setRejectId(null);
      setRejectReason('');
      setMsg({ ok: true, text: t(locale, approve ? 'd30_approved' : 'd30_rejected') });
      await refresh();
    } catch (err) {
      setMsg({ ok: false, text: authErrorPl(err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  };

  const approved = rows.filter((r) => r.approval_status === 'APPROVED');
  const latest = approved[0] ?? null;
  const pending = rows.filter((r) => r.approval_status === 'PENDING');

  const statusLabel = (s: Policy['approval_status']) =>
    t(locale, s === 'PENDING' ? 'd30_st_pending' : s === 'APPROVED' ? 'd30_st_approved' : 'd30_st_rejected');

  return (
    <div data-insurance-form style={{ marginTop: 18 }}>
      <h4 className="sec">{t(locale, 'd30_h')}</h4>
      {latest ? (
        <div className="note" data-insurance-note>
          {tp(locale, 'd30_note', {
            carrier: latest.org_name,
            policy: latest.policy_no,
            date: latest.valid_until,
            days: String(latest.days_left),
          })}
        </div>
      ) : (
        <div className="note" data-insurance-none>{t(locale, 'd30_none')}</div>
      )}

      {rows.length === 0 ? null : (
        <dl className="kv" style={{ marginTop: 12 }}>
          {rows.map((p) => (
            <div key={p.id} style={{ display: 'contents' }} data-insurance-row={p.policy_no} data-status={p.approval_status}>
              <dt>
                <span className="mono">{p.policy_no}</span>
                {isHhl ? <> · {p.org_name}</> : null}
              </dt>
              <dd>
                <span className={`pill ${p.approval_status === 'APPROVED' ? 'p-go' : p.approval_status === 'PENDING' ? 'p-amber' : 'p-red'}`}>
                  {statusLabel(p.approval_status)}
                </span>
                {' '}
                {fmtDateRange(p.valid_from, p.valid_until)}
                {p.insurer ? ` · ${p.insurer}` : ''}
                {p.sum_insured != null ? ` · ${p.sum_insured} ${p.currency}` : ''}
                {p.approval_status === 'REJECTED' && p.reject_reason ? (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{p.reject_reason}</div>
                ) : null}
                {isHhl && p.approval_status === 'PENDING' ? (
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" className="btn" disabled={busy} data-insurance-approve={p.id} onClick={() => void decide(p.id, true)}>
                      {t(locale, 'd30_approve')}
                    </button>
                    {rejectId === p.id ? (
                      <>
                        <input
                          className="input"
                          style={{ minWidth: 160 }}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={t(locale, 'd30_reject_ph')}
                          aria-label={t(locale, 'd30_reject_ph')}
                        />
                        <button type="button" className="btn ghost" disabled={busy || !rejectReason.trim()} onClick={() => void decide(p.id, false)}>
                          {t(locale, 'd30_reject')}
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn ghost" disabled={busy} onClick={() => setRejectId(p.id)}>
                        {t(locale, 'd30_reject')}
                      </button>
                    )}
                  </div>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {pending.length > 0 && isHhl ? (
        <div className="note" data-insurance-pending-count style={{ marginTop: 8 }}>
          {tp(locale, 'd30_pending_n', { n: String(pending.length) })}
        </div>
      ) : null}

      {canWrite ? (
        open ? (
          <form className="auth-form" data-insurance-new onSubmit={(e) => void save(e)} style={{ marginTop: 12 }}>
            {isHhl ? (
              <label>
                {t(locale, 'd30_org')}
                <select className="input" required value={f.orgId || defaultOrg} onChange={(e) => P('orgId', e.target.value)}>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
            ) : null}
            <label>
              {t(locale, 'd30_no')}
              <input className="input" required maxLength={80} value={f.no} onChange={(e) => P('no', e.target.value)} />
            </label>
            <label>
              {t(locale, 'd30_insurer')}
              <input className="input" value={f.insurer} onChange={(e) => P('insurer', e.target.value)} />
            </label>
            <label>
              {t(locale, 'd30_from')}
              <input className="input" type="date" required value={f.from} onChange={(e) => P('from', e.target.value)} />
            </label>
            <label>
              {t(locale, 'd30_until')}
              <input className="input" type="date" required value={f.until} min={f.from || undefined} onChange={(e) => P('until', e.target.value)} />
            </label>
            <label>
              {t(locale, 'd30_sum')}
              <input className="input" inputMode="decimal" value={f.sum} onChange={(e) => P('sum', e.target.value)} />
            </label>
            <label>
              {t(locale, 'd30_currency')}
              <select className="input" value={f.currency} onChange={(e) => P('currency', e.target.value)}>
                <option value="EUR">EUR</option>
                <option value="PLN">PLN</option>
                <option value="SEK">SEK</option>
              </select>
            </label>
            <label className="switchline">
              <input type="checkbox" checked={f.oversize} onChange={(e) => P('oversize', e.target.checked)} />
              <span>{t(locale, 'd30_oversize')}</span>
            </label>
            <label className="switchline">
              <input type="checkbox" checked={f.sweden} onChange={(e) => P('sweden', e.target.checked)} />
              <span>{t(locale, 'd30_sweden')}</span>
            </label>
            <label>
              {t(locale, 'd30_file')}
              <input
                className="input"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" className="btn" disabled={busy}>{t(locale, 'd30_save')}</button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => { setOpen(false); setFile(null); }}>{t(locale, 'd30_cancel')}</button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn" style={{ marginTop: 10 }} data-insurance-add onClick={() => setOpen(true)}>
            {t(locale, 'd30_add')}
          </button>
        )
      ) : null}

      {msg ? <div className={`note ${msg.ok ? '' : 'err'}`} style={{ marginTop: 8 }} data-insurance-msg>{msg.text}</div> : null}
      <div className="note" style={{ marginTop: 8, fontSize: 11.5 }}>{t(locale, 'd30_help')}</div>
    </div>
  );
}
