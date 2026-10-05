/**
 * HIST-11 / §11 — Historia zmian (HHL_ADMIN): filtry kto/kiedy/obiekt/rodzaj,
 * wyszukiwanie, było→jest, oznaczenie automatu, eksport CSV/XLSX.
 */
import { useCallback, useEffect, useState } from 'react';
import ExcelJS from 'exceljs';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import './auth.css';

type Row = {
  id: number;
  created_at: string;
  action: string;
  entity: string;
  entity_id: string | null;
  user_id: string | null;
  user_email: string | null;
  acting_as_user_id: string | null;
  acting_as_email: string | null;
  source: string | null;
  is_automatic: boolean;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

function fmtJson(v: Record<string, unknown> | null): string {
  if (!v || Object.keys(v).length === 0) return '—';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function triggerDownload(bytes: Uint8Array, filename: string, mime: string) {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? '');
          return /[;"\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(';'),
    )
    .join('\n');
}

function whoLabel(r: Row): string {
  if (r.is_automatic || (!r.user_email && r.source)) {
    return r.source ? `auto:${r.source}` : 'auto';
  }
  if (r.acting_as_email) {
    return `${r.user_email || '—'} → ${r.acting_as_email}`;
  }
  return r.user_email || '—';
}

export default function ChangeHistoryPanel() {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const refresh = useCallback(async () => {
    setBusy(true);
    const sb = await getSupabase();
    const { data, error } = await sb.rpc('admin_audit_history', {
      p_from: from ? new Date(from).toISOString() : null,
      p_to: to ? new Date(to + 'T23:59:59').toISOString() : null,
      p_user_id: null,
      p_entity: entity.trim() || null,
      p_action: action.trim() || null,
      p_q: q.trim() || null,
      p_limit: 200,
      p_offset: 0,
    });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      setRows([]);
      return;
    }
    setMsg(null);
    setRows((data ?? []) as Row[]);
  }, [action, entity, from, q, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(locale === 'sv' ? 'sv-SE' : locale === 'en' ? 'en-GB' : 'pl-PL');
    } catch {
      return iso;
    }
  };

  async function exportFmt(kind: 'csv' | 'xlsx') {
    const headers = [
      'created_at',
      'who',
      'acting_as',
      'action',
      'entity',
      'entity_id',
      'source',
      'was',
      'is',
    ];
    const dataRows = rows.map((r) => [
      r.created_at ?? '',
      r.user_email ?? (r.source ? `auto:${r.source}` : ''),
      r.acting_as_email ?? '',
      r.action ?? '',
      r.entity ?? '',
      r.entity_id ?? '',
      r.source ?? '',
      fmtJson(r.old_value),
      fmtJson(r.new_value),
    ]);
    const all = [headers, ...dataRows];
    if (kind === 'csv') {
      const enc = new TextEncoder().encode('\uFEFF' + toCsv(all));
      triggerDownload(enc, 'WATCH_TOWER_historia_zmian.csv', 'text/csv;charset=utf-8');
    } else {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'WATCH TOWER';
      const ws = wb.addWorksheet('Historia');
      for (const r of all) ws.addRow(r);
      ws.getRow(1).font = { bold: true };
      const raw = await wb.xlsx.writeBuffer();
      const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
      triggerDownload(
        bytes,
        'WATCH_TOWER_historia_zmian.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    }
    setMsg(tp(locale, 'opt_acc_hist_export_ok', { n: rows.length }));
  }

  return (
    <div data-panel="change-history">
      <div className="baf-form" style={{ marginBottom: 8 }}>
        <label>
          <span>{t(locale, 'opt_acc_hist_from')}</span>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span>{t(locale, 'opt_acc_hist_to')}</span>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          <span>{t(locale, 'opt_acc_hist_entity')}</span>
          <input
            className="input"
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            placeholder="loads"
          />
        </label>
        <label>
          <span>{t(locale, 'opt_acc_hist_action')}</span>
          <input
            className="input"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="ROW_UPDATE"
          />
        </label>
        <label className="wide">
          <span>{t(locale, 'opt_acc_hist_search')}</span>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(locale, 'opt_acc_hist_search_ph')}
          />
        </label>
      </div>
      <div className="inline-input" style={{ marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="chipbtn" disabled={busy} onClick={() => void refresh()}>
          {t(locale, 'opt_acc_hist_refresh')}
        </button>
        <button type="button" className="chipbtn" disabled={busy || rows.length === 0} onClick={() => void exportFmt('csv')}>
          CSV
        </button>
        <button type="button" className="chipbtn" disabled={busy || rows.length === 0} onClick={() => void exportFmt('xlsx')}>
          XLSX
        </button>
        <span className="note">{rows.length}</span>
      </div>
      {msg ? <div className="note">{msg}</div> : null}
      {rows.length === 0 && !msg ? (
        <div className="note option-note">{t(locale, 'opt_acc_hist_empty')}</div>
      ) : (
        <div className="settings-list" data-change-history-list style={{ maxHeight: 420 }}>
          {rows.map((r) => (
            <div className="settings-row" key={r.id} style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b data-content>
                  {r.action} · {r.entity}
                  {r.entity_id ? ` #${r.entity_id.slice(0, 12)}` : ''}
                </b>
                <span>
                  {fmt(r.created_at)} · {whoLabel(r)}
                  {r.is_automatic ? ` · ${t(locale, 'opt_acc_hist_auto')}` : ''}
                </span>
                <span style={{ display: 'block', marginTop: 4, wordBreak: 'break-word' }}>
                  <small>
                    {t(locale, 'opt_acc_hist_was')}: {fmtJson(r.old_value)}
                  </small>
                  <br />
                  <small>
                    {t(locale, 'opt_acc_hist_is')}: {fmtJson(r.new_value)}
                  </small>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="note option-note" style={{ marginTop: 8 }}>{t(locale, 'opt_acc_hist_note')}</div>
    </div>
  );
}
