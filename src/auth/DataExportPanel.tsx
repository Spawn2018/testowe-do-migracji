/**
 * DEC-6 — eksport danych: transporty / historia / decyzje (CSV lub XLSX),
 * z zasadami widoczności kolumn jak w harmonogramie.
 */
import { useState } from 'react';
import ExcelJS from 'exceljs';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { exportLoadsXlsx, exportRows } from '../lib/xlsxExport';
import { t, tp } from '../i18n/messages';
import './auth.css';

type Kind = 'loads' | 'audit' | 'decisions';
type Fmt = 'xlsx' | 'csv';

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

export default function DataExportPanel() {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const loads = useTowerStore((s) => s.loads);
  const [kind, setKind] = useState<Kind>('loads');
  const [fmt, setFmt] = useState<Fmt>('xlsx');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      if (kind === 'loads') {
        if (fmt === 'xlsx') {
          const r = await exportLoadsXlsx(loads, role, 'WATCH_TOWER_transporty.xlsx');
          setMsg(tp(locale, 'opt_acc_export_ok', { n: r.rows }));
        } else {
          const rows = exportRows(loads, role);
          const enc = new TextEncoder().encode('\uFEFF' + toCsv(rows));
          triggerDownload(enc, 'WATCH_TOWER_transporty.csv', 'text/csv;charset=utf-8');
          setMsg(tp(locale, 'opt_acc_export_ok', { n: loads.length }));
        }
        setBusy(false);
        return;
      }

      const sb = await getSupabase();
      let headers: string[];
      let dataRows: (string | number)[][];

      if (kind === 'audit') {
        const q = await sb
          .from('audit_log')
          .select('created_at,action,entity,entity_id,user_id')
          .order('created_at', { ascending: false })
          .limit(2000);
        if (q.error) throw new Error(q.error.message);
        headers = ['created_at', 'action', 'entity', 'entity_id', 'user_id'];
        dataRows = (q.data ?? []).map((r) => [
          r.created_at ?? '',
          r.action ?? '',
          r.entity ?? '',
          r.entity_id ?? '',
          r.user_id ?? '',
        ]);
      } else {
        const q = await sb
          .from('decisions')
          .select('id,type_code,status,created_at,resolved_at,load_id,title')
          .order('created_at', { ascending: false })
          .limit(2000);
        if (q.error) throw new Error(q.error.message);
        headers = ['id', 'type_code', 'status', 'created_at', 'resolved_at', 'load_id', 'title'];
        dataRows = (q.data ?? []).map((r) => [
          r.id ?? '',
          r.type_code ?? '',
          r.status ?? '',
          r.created_at ?? '',
          r.resolved_at ?? '',
          r.load_id ?? '',
          r.title ?? '',
        ]);
      }

      const all = [headers, ...dataRows];
      const base = kind === 'audit' ? 'WATCH_TOWER_historia' : 'WATCH_TOWER_decyzje';

      if (fmt === 'csv') {
        const enc = new TextEncoder().encode('\uFEFF' + toCsv(all));
        triggerDownload(enc, `${base}.csv`, 'text/csv;charset=utf-8');
      } else {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'WATCH TOWER';
        const ws = wb.addWorksheet(kind === 'audit' ? 'Historia' : 'Decyzje');
        for (const r of all) ws.addRow(r);
        ws.getRow(1).font = { bold: true };
        const raw = await wb.xlsx.writeBuffer();
        const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
        triggerDownload(
          bytes,
          `${base}.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
      }
      setMsg(tp(locale, 'opt_acc_export_ok', { n: dataRows.length }));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <div data-panel="data-export">
      {msg ? <div className="note">{msg}</div> : null}
      <div className="pref-list">
        <label className="switchline">
          <input type="radio" name="ex-kind" checked={kind === 'loads'} onChange={() => setKind('loads')} />
          <span>{t(locale, 'opt_acc_export_loads')}</span>
        </label>
        <label className="switchline">
          <input type="radio" name="ex-kind" checked={kind === 'audit'} onChange={() => setKind('audit')} />
          <span>{t(locale, 'opt_acc_export_audit')}</span>
        </label>
        <label className="switchline">
          <input type="radio" name="ex-kind" checked={kind === 'decisions'} onChange={() => setKind('decisions')} />
          <span>{t(locale, 'opt_acc_export_decisions')}</span>
        </label>
      </div>
      <div className="pref-list" style={{ marginTop: 8 }}>
        <label className="switchline">
          <input type="radio" name="ex-fmt" checked={fmt === 'xlsx'} onChange={() => setFmt('xlsx')} />
          <span>XLSX</span>
        </label>
        <label className="switchline">
          <input type="radio" name="ex-fmt" checked={fmt === 'csv'} onChange={() => setFmt('csv')} />
          <span>CSV</span>
        </label>
      </div>
      <div className="note option-note" style={{ marginTop: 8 }}>{t(locale, 'opt_acc_export_note')}</div>
      <button type="button" className="chipbtn" style={{ marginTop: 10 }} disabled={busy} onClick={() => void run()}>
        {t(locale, 'opt_acc_export_run')}
      </button>
    </div>
  );
}
