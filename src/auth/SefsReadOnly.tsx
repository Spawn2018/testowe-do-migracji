/**
 * I-13 (0063, D-10) — parametry SEFS tylko do odczytu dla KSH i przewoźnika (widok Ustawienia).
 * Zakres widoczności wyznacza baza (RLS): przewoźnik — COST i BOTH, wyłącznie wersje uzgodnione z przewoźnikiem;
 * KSH — REVENUE i BOTH. Brak zapisu (RPC tylko dla HHL).
 */
import { useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import './auth.css';

interface Row {
  version: number; valid_from: string; applies_to: 'COST' | 'REVENUE' | 'BOTH'; base_sek: number; base_pln: number;
  index_sek: string; index_pln: string; cycle: 'WEEKLY' | 'MONTHLY'; agreed_with_carrier: boolean; agreement_ref: string | null;
  source_url_sek: string; source_url_pln: string;
}

export default function SefsReadOnly() {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      const sb = await getSupabase();
      const r = await sb.from('sefs_parameters')
        .select('version,valid_from,applies_to,base_sek,base_pln,index_sek,index_pln,cycle,agreed_with_carrier,agreement_ref,source_url_sek,source_url_pln')
        .order('version', { ascending: false }).limit(12);
      if (!live) return;
      if (r.error) setErr(r.error.message); else setRows((r.data ?? []) as Row[]);
    })();
    return () => { live = false; };
  }, []);
  return (
    <section className="panel option-panel option-wide" data-sefs-readonly>
      <header className="panel-hd"><h2>{t(locale, 'i13_ro_h')}</h2><span className="sub">{t(locale, 'i13_ro_sub')}</span></header>
      <div className="panel-bd flush">
        {err ? <div className="auth-msg err auth-admin-row">{err}</div> : null}
        {rows && rows.length === 0 ? <div className="auth-admin-row" data-sefs-empty>{t(locale, 'i13_ro_empty')}</div> : null}
        {(rows ?? []).map((r) => (
          <div className="auth-admin-row" key={r.version} data-sefs-version={r.version} data-sefs-applies={r.applies_to}>
            <span className="grow">
              <b>{tp(locale, 'i13_ro_line', { v: String(r.version), d: r.valid_from })}</b> · {t(locale, `i13_${r.applies_to}`)} · {t(locale, r.cycle === 'WEEKLY' ? 'i2_baf_weekly' : 'i2_baf_monthly')}
              <small> · SEK {Number(r.base_sek).toFixed(2)} ({r.index_sek}, <a href={r.source_url_sek} target="_blank" rel="noreferrer">{t(locale, 'i2_baf_source')}</a>)
                · PLN {Number(r.base_pln).toFixed(3)} ({r.index_pln}, <a href={r.source_url_pln} target="_blank" rel="noreferrer">{t(locale, 'i2_baf_source')}</a>)
                {r.agreed_with_carrier ? ` · ${t(locale, 'i2_baf_agreed')}${r.agreement_ref ? ` (${r.agreement_ref})` : ''}` : ''}</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
