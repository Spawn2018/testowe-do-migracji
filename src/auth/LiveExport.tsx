/**
 * Opcje › System › Eksport danych — produkcja w wyglądzie z audytu (E12 „Eksport danych”). Ekran = `ExportScreen` (ten sam co w demo).
 * Dane jak w dawnym `DataExportPanel`: transporty (kolumny według roli — `exportLoadsXlsx` / `exportRows`), historia zmian
 * (`audit_log`, do 2 000 wierszy) i sprawy (`decisions`, do 2 000 wierszy); XLSX albo CSV. Zakres dat zawęża wiersze
 * (puste pola = wszystko, jak dawniej). Historia zmian — tylko Administrator HHL (E12-1). Faktur i finansów dawny eksport nie miał.
 */
import { useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { exportLoadsXlsx, exportRows } from '../lib/xlsxExport';
import { transportLabel } from '../lib/transportName';
import { ExportScreen, type ExportKind } from '../components/options/SystemScreens';
import type { Load } from '../types';
import { downloadTable, errText, toCsv, triggerDownload, personName, type PersonDb } from './liveOpts';

const LIMIT = 2000;
const BASE: Record<'loads' | 'hist' | 'risks', string> = {
  loads: 'WATCH_TOWER_transporty', hist: 'WATCH_TOWER_historia', risks: 'WATCH_TOWER_sprawy',
};

/** Transporty w zakresie dat załadunku (puste pola = wszystkie). */
export function loadsInRange(loads: readonly Load[], r: { from: string; to: string }): Load[] {
  return loads.filter((l) => {
    const d = (l.plannedLoadDate ?? '').slice(0, 10);
    if (r.from && (!d || d < r.from)) return false;
    if (r.to && (!d || d > r.to)) return false;
    return true;
  });
}

export default function LiveExport({ admin = true }: { admin?: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const loads = useTowerStore((s) => s.loads);
  const [range, setRange] = useState({ from: '', to: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const kinds: ExportKind[] = admin ? ['loads', 'hist', 'risks'] : ['loads', 'risks'];
  const sfx = range.from || range.to ? `_${range.from || '…'}_${range.to || '…'}` : '';

  const run = (kind: ExportKind, fmt: 'xlsx' | 'csv') => {
    if (kind === 'fin') return;
    void (async () => {
      setBusy(true);
      setMsg(null);
      try {
        const base = `${BASE[kind]}${sfx}`;
        if (kind === 'loads') {
          const list = loadsInRange(loads, range);
          if (fmt === 'xlsx') {
            const r = await exportLoadsXlsx(list, role, `${base}.xlsx`);
            setMsg(tp(locale, 'opt_acc_export_ok', { n: r.rows }));
          } else {
            triggerDownload(new TextEncoder().encode('﻿' + toCsv(exportRows(list, role))), `${base}.csv`, 'text/csv;charset=utf-8');
            setMsg(tp(locale, 'opt_acc_export_ok', { n: list.length }));
          }
          return;
        }
        const sb = await getSupabase();
        const u = await sb.from('app_users').select('id,email,full_name,first_name,last_name,phone,role,active,org_id');
        const people = new Map(((u.data ?? []) as PersonDb[]).map((p) => [p.id, p]));
        const name = (id: string | null) => (id ? (people.get(id) ? personName(people.get(id)!) : id) : '');
        const load = (id: string | null) => {
          const l = id ? loads.find((x) => x.id === id) : undefined;
          return l ? transportLabel(l, role) : (id ?? '');
        };
        const from = range.from ? new Date(range.from).toISOString() : null;
        const to = range.to ? new Date(`${range.to}T23:59:59`).toISOString() : null;
        let all: (string | number)[][];
        if (kind === 'hist') {
          let q = sb.from('audit_log').select('created_at,action,entity,entity_id,user_id').order('created_at', { ascending: false }).limit(LIMIT);
          if (from) q = q.gte('created_at', from);
          if (to) q = q.lte('created_at', to);
          const r = await q;
          if (r.error) throw new Error(r.error.message);
          all = [
            [t(locale, 'p3c_l_when'), t(locale, 'p3c_hist_who'), t(locale, 'p3l_col_action'), t(locale, 'p3l_col_object'), t(locale, 'p3l_col_object_id')],
            ...(r.data ?? []).map((x) => [x.created_at ?? '', name(x.user_id), x.action ?? '', x.entity ?? '', x.entity === 'loads' ? load(x.entity_id) : (x.entity_id ?? '')]),
          ];
        } else {
          let q = sb.from('decisions').select('id,type_code,status,created_at,resolved_at,load_id,title').order('created_at', { ascending: false }).limit(LIMIT);
          if (from) q = q.gte('created_at', from);
          if (to) q = q.lte('created_at', to);
          const r = await q;
          if (r.error) throw new Error(r.error.message);
          all = [
            ['p3l_col_id', 'p3l_col_kind', 'p3l_col_state', 'p3l_col_created', 'p3l_col_closed', 'p3l_col_load', 'p3l_col_title'].map((k) => t(locale, k)),
            ...(r.data ?? []).map((x) => [x.id ?? '', x.type_code ?? '', x.status ?? '', x.created_at ?? '', x.resolved_at ?? '', load(x.load_id), x.title ?? '']),
          ];
        }
        await downloadTable(all, base, fmt, kind === 'hist' ? 'Historia' : 'Sprawy');
        setMsg(tp(locale, 'opt_acc_export_ok', { n: all.length - 1 }));
      } catch (e) {
        setMsg(errText(locale, e));
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div data-panel="data-export" data-live="export">
      {msg ? <div className="note" role="status">{msg}</div> : null}
      <ExportScreen
        locale={locale}
        kinds={kinds}
        range={range}
        onRange={setRange}
        busy={busy}
        fileName={(k) => `${k === 'fin' ? BASE.loads : BASE[k]}${sfx}.xlsx`}
        fileNote={(k) => (k === 'loads' ? t(locale, 'p3l_exp_all_loads') : tp(locale, 'p3l_exp_limit', { n: LIMIT }))}
        onDownload={run}
      />
      <p className="ox-foot">{t(locale, 'opt_acc_export_note')}</p>
    </div>
  );
}
