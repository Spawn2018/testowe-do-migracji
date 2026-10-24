/**
 * Opcje › System › Historia zmian — produkcja w wyglądzie z audytu (E12 „Historia zmian”: filtry po polsku, wpis zdaniem,
 * „było → jest”, zmiany techniczne ukryte pod przełącznikiem). Ekran = `HistoryScreen` (ten sam co w demo).
 * Dane jak w dawnym `ChangeHistoryPanel`: `admin_audit_history` (zakres dat, osoba, obiekt, „Szukaj”, limit 200),
 * eksport CSV/XLSX pobranych wierszy. #484 (0290): Administrator i Operacje HHL — wszystko; KSH i SCX (Ustawienia) — wpisy
 * swoich transportów, ceny i numery drugiej strony ukrywa baza. Autor z innej firmy: „Inna firma” (bez e-maila).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { hasKey, t, tp } from '../i18n/messages';
import { formatListDateTime } from '../lib/format';
import { transportLabel } from '../lib/transportName';
import { HistoryScreen, type HistoryEntry, type HistoryFilters } from '../components/options/SystemScreens';
import type { Locale } from '../types';
import { downloadTable, errText, personName, type PersonDb } from './liveOpts';

export const HISTORY_LIMIT = 200;

type Row = {
  id: number; created_at: string; action: string; entity: string; entity_id: string | null;
  user_id: string | null; user_email: string | null; acting_as_user_id: string | null; acting_as_email: string | null;
  source: string | null; is_automatic: boolean; old_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null;
};

/** Zmiana techniczna = zapis wiersza tabeli (wyzwalacz audytu), ukryta domyślnie (E12 pkt 4). */
export const isTech = (action: string) => /^ROW_/.test(action);

/* #484 F7 #527 (obrona w głębi; główna redakcja — baza 0290): KSH/SCX bez kluczy pieniędzy, numerów zleceń i e-maili,
   także w zagnieżdżonych obiektach i tablicach */
const HIDDEN_KEY = /price|cost|revenue|margin|rate|amount|fee|baf|payout|net|gross|total|order_no|email/i;
/* KSH: bez danych kierowców i pilotów (jak widoki na żywo; decyzja koordynatora F7 #526 r3 N6) */
const HIDDEN_KSH = /driver|phone|pilot|escort_name|contact/i;
export function scrubForParty(v: unknown, ksh = false): unknown {
  if (Array.isArray(v)) return v.map((x) => scrubForParty(x, ksh));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (HIDDEN_KEY.test(k) || (ksh && HIDDEN_KSH.test(k))) continue;
      out[k] = scrubForParty(x, ksh);
    }
    return out;
  }
  return v;
}

function fmtVal(locale: Locale, raw: Record<string, unknown> | null, party = false, ksh = false): string | undefined {
  const v = party && raw ? (scrubForParty(raw, ksh) as Record<string, unknown>) : raw;
  if (!v || Object.keys(v).length === 0) return undefined;
  const keys = Object.keys(v);
  /* jedna wartość („enabled”, „value”) — sama wartość; więcej — klucz: wartość */
  const show = (x: unknown) => (typeof x === 'boolean' ? t(locale, x ? 'p3l_val_on' : 'p3l_val_off') : x == null ? '—' : typeof x === 'object' ? JSON.stringify(x) : String(x));
  if (keys.length === 1) return show(v[keys[0]]);
  return keys.map((k) => `${k}: ${show(v[k])}`).join(' · ');
}

export function historyText(locale: Locale, r: Pick<Row, 'action' | 'entity' | 'entity_id'>, objLabel: string): string {
  const what = hasKey(locale, `p3l_a_${r.action}`) ? t(locale, `p3l_a_${r.action}`) : r.action;
  const ent = hasKey(locale, `p3l_e_${r.entity}`) ? t(locale, `p3l_e_${r.entity}`) : r.entity;
  const obj = objLabel || r.entity_id || '';
  return obj ? `${what} · ${tp(locale, 'p3l_h_obj', { what: ent, id: obj })}` : `${what} · ${ent}`;
}

export default function LiveHistory() {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const loads = useTowerStore((s) => s.loads);
  const [rows, setRows] = useState<Row[]>([]);
  const hhl = role === 'HHL';
  const [people, setPeople] = useState<PersonDb[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tech, setTech] = useState(false);
  const [f, setF] = useState<HistoryFilters>({ from: '', to: '', who: '', what: '', q: '' });

  const refresh = useCallback(async () => {
    try {
    setBusy(true);
    const sb = await getSupabase();
    const [h, u] = await Promise.all([
      sb.rpc('admin_audit_history', {
        p_from: f.from ? new Date(f.from).toISOString() : null,
        p_to: f.to ? new Date(`${f.to}T23:59:59`).toISOString() : null,
        p_user_id: f.who || null,
        p_entity: f.what || null,
        p_action: null,
        p_q: f.q.trim() || null,
        p_limit: HISTORY_LIMIT,
        p_offset: 0,
      }),
      sb.from('app_users').select('id,email,full_name,first_name,last_name,phone,role,active,org_id').order('created_at'),
    ]);
    setBusy(false);
    /* przed bazą 0290 KSH/SCX/Operacje dostają 42501 „Tylko administrator HHL” — neutralny komunikat */
    if (h.error) { setMsg((h.error as { code?: string }).code === '42501' ? t(locale, 'p3l_h_unavailable') : errText(locale, h.error)); setRows([]); return; }
    setMsg(null);
    setRows((h.data ?? []) as Row[]);
    setPeople((u.data ?? []) as PersonDb[]);
    } catch (e) {
      setBusy(false);
      setMsg(errText(locale, e));
    }
  }, [f, locale]);
  useEffect(() => { void refresh(); }, [refresh]);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const who = useCallback((r: Row) => {
    if (r.is_automatic || (!r.user_id && r.source)) return `${t(locale, 'p3l_h_auto')}${r.source ? ` · ${r.source}` : ''}`;
    const p = r.user_id ? byId.get(r.user_id) : undefined;
    /* KSH/SCX: osoby spoza własnej firmy (lista kont z RLS) — bez nazwiska i e-maila */
    const other = t(locale, 'p3l_h_other');
    const name = p ? personName(p) : hhl ? (r.user_email || t(locale, 'p3l_h_auto')) : r.user_id ? other : t(locale, 'p3l_h_auto');
    const as = r.acting_as_user_id ? byId.get(r.acting_as_user_id) : undefined;
    return r.acting_as_user_id ? tp(locale, 'p3l_h_as', { who: name, as: as ? personName(as) : hhl ? (r.acting_as_email ?? '—') : other }) : name;
  }, [byId, locale, hhl]);
  const obj = useCallback((r: Row) => {
    if (r.entity !== 'loads' || !r.entity_id) return '';
    const l = loads.find((x) => x.id === r.entity_id);
    return l ? transportLabel(l, role) : '';
  }, [loads, role]);

  const shown = tech ? rows : rows.filter((r) => !isTech(r.action));
  const entries: HistoryEntry[] = shown.map((r) => ({
    id: String(r.id),
    when: formatListDateTime(r.created_at),
    who: who(r),
    text: historyText(locale, r, obj(r)),
    was: fmtVal(locale, r.old_value, !hhl, role === 'KSH'),
    is: fmtVal(locale, r.new_value, !hhl, role === 'KSH'),
  }));
  /* KSH/SCX: tylko obszary z ich wpisów (bez list ustawień systemu) */
  const entityList = [...new Set([
    ...(hhl ? ['app_users', 'user_invites', 'security_flags', 'ops_thresholds', 'notification_matrix', 'rate_cards', 'sefs_parameters',
      'fuel_index_readings', 'loads', 'decisions', 'risk_signals', 'invoices', 'system_broadcast', 'doc_requirements', 'documents']
      : ['loads', 'documents', 'shipment_items', 'load_permits', 'load_escorts', 'permits', role === 'KSH' ? 'load_revenue' : 'load_cost']),
    ...rows.map((r) => r.entity),
  ])];

  const download = (fmt: 'csv' | 'xlsx') => {
    void (async () => {
      const head = [t(locale, 'p3c_l_when'), t(locale, 'p3c_hist_who'), t(locale, 'p3c_hist_what'), t(locale, 'p3c_hist_was'), t(locale, 'p3c_hist_is')];
      const data = shown.map((r) => [r.created_at, who(r), historyText(locale, r, obj(r)), fmtVal(locale, r.old_value, !hhl, role === 'KSH') ?? '', fmtVal(locale, r.new_value, !hhl, role === 'KSH') ?? '']);
      try {
        await downloadTable([head, ...data], 'WATCH_TOWER_historia_zmian', fmt, 'Historia');
        setMsg(tp(locale, 'opt_acc_hist_export_ok', { n: data.length }));
      } catch (e) {
        setMsg(errText(locale, e));
      }
    })();
  };

  return (
    <div data-panel="change-history" data-live="history">
      {msg ? <div className="note" role="status">{msg}</div> : null}
      <HistoryScreen
        locale={locale}
        entries={entries}
        techCount={rows.filter((r) => isTech(r.action)).length}
        people={people.map((p) => ({ value: p.id, label: personName(p) }))}
        areas={entityList.map((e) => ({ value: e, label: hasKey(locale, `p3l_e_${e}`) ? t(locale, `p3l_e_${e}`) : e }))}
        range={{ from: f.from, to: f.to }}
        filters={f}
        onFilters={setF}
        tech={tech}
        onTech={setTech}
        onRefresh={() => void refresh()}
        busy={busy}
        onDownload={download}
        note={`${tp(locale, 'p3l_h_tech_note', { n: HISTORY_LIMIT })} ${t(locale, hhl ? 'opt_acc_hist_note' : 'p3l_h_party_note')}`}
      />
    </div>
  );
}
