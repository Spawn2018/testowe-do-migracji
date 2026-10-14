/**
 * wyglad/P4-c — Automatyzacje › „Działa samo” (E35 pkt 1, img/e35-after; L13, E26 pkt 5).
 * Lista wbudowanych automatów zwykłymi słowami w grupach Statusy · Do zrobienia · Wiadomości · Pieniądze i dane.
 * Po prawej ostatnie działanie albo miejsce ustawień; kliknięcie wiersza rozwija pełny opis, ostatnie działanie i odnośnik.
 * „Status ze stref” po rozwinięciu: reguły strefa × wjazd × wyjazd (L13). Tylko odczyt — zmienia Administrator HHL (E34, E35).
 * Ostatnie działania podaje wykonawca (`meta`); bez nich — miejsce ustawień i „brak źródła danych”.
 */
import { useState } from 'react';
import type { Locale } from '../../types';
import type { OptScreenId } from '../options/types';
import { wt } from '../../i18n/p4cWf';
import { openOptionsScreen } from '../../lib/openOptions';
import { useTowerStore } from '../../store/useTowerStore';

export type AutoRowId = 'zones' | 'cases' | 'gps' | 'notify' | 'texts' | 'prices' | 'sched';
type Go = { screen: OptScreenId; label: string } | { view: 'geo'; label: string } | null;
type Row = { id: AutoRowId; go: Go; fixed?: string };

const GROUPS: { id: 'status' | 'todo' | 'msg' | 'money'; rows: Row[] }[] = [
  { id: 'status', rows: [{ id: 'zones', go: { view: 'geo', label: 'p4c_wf_link_geo' } }] },
  {
    id: 'todo',
    rows: [
      { id: 'cases', go: { screen: 'thr', label: 'p4c_wf_link_thr' } },
      { id: 'gps', go: { screen: 'thr', label: 'p4c_wf_link_thr' } },
    ],
  },
  {
    id: 'msg',
    rows: [
      { id: 'notify', go: { screen: 'who', label: 'p4c_wf_link_who' } },
      { id: 'texts', go: { screen: 'zones', label: 'p4c_wf_link_zones' } },
    ],
  },
  {
    id: 'money',
    rows: [
      { id: 'prices', go: { screen: 'fuel', label: 'p4c_wf_link_fuel' } },
      { id: 'sched', go: null, fixed: 'p4c_wf_meta_sched' },
    ],
  },
];

/** Reguły „strefa × wjazd × wyjazd” (L13; E25 statusy 5–12, E26). */
const ZONE_RULES = ['srem', 'portpl', 'portse', 'site', 'buf'] as const;

function ZoneTable({ locale }: { locale: Locale }) {
  return (
    <div className="arl-zt-wrap">
      <table className="arl-zt" data-auto-zone-rules>
        <thead>
          <tr>
            <th scope="col">{wt(locale, 'p4c_wf_zt_zone')}</th>
            <th scope="col">{wt(locale, 'p4c_wf_zt_in')}</th>
            <th scope="col">{wt(locale, 'p4c_wf_zt_out')}</th>
          </tr>
        </thead>
        <tbody>
          {ZONE_RULES.map((z) => (
            <tr key={z} data-zone-rule={z}>
              <th scope="row">{wt(locale, `p4c_wf_zt_${z}`)}</th>
              <td data-label={wt(locale, 'p4c_wf_zt_in')}>{wt(locale, `p4c_wf_zt_${z}_in`)}</td>
              <td data-label={wt(locale, 'p4c_wf_zt_out')}>{wt(locale, `p4c_wf_zt_${z}_out`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AutoRulesList({ locale, meta }: { locale: Locale; meta: Partial<Record<string, string>> }) {
  const [open, setOpen] = useState<AutoRowId | null>(null);
  const setView = useTowerStore((s) => s.setView);
  const follow = (go: Go) => {
    if (!go) return;
    if ('screen' in go) openOptionsScreen(go.screen);
    else setView(go.view);
  };

  return (
    <div className="arl" data-auto-rules>
      <p className="arl-lead">{wt(locale, 'p4c_wf_auto_lead')}</p>
      {GROUPS.map((g) => (
        <section key={g.id} className="arl-grp" data-auto-group={g.id}>
          <h3 className="arl-gh">{wt(locale, `p4c_wf_g_${g.id}`)}</h3>
          <ul className="arl-list">
            {g.rows.map((r) => {
              const last = meta[r.id];
              const right = last ?? (r.fixed ? wt(locale, r.fixed) : r.go ? wt(locale, r.go.label) : '');
              const isOpen = open === r.id;
              return (
                <li key={r.id} className={`arl-row${isOpen ? ' open' : ''}`} data-auto-row={r.id}>
                  <button
                    type="button"
                    className="arl-hd"
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? `arl-${r.id}` : undefined}
                    onClick={() => setOpen(isOpen ? null : r.id)}
                  >
                    <span className="arl-txt">
                      <span className="arl-name">{wt(locale, `p4c_wf_r_${r.id}`)}</span>
                      <span className="arl-desc">{wt(locale, `p4c_wf_r_${r.id}_d`)}</span>
                    </span>
                    <span className="arl-meta">{right}</span>
                    <span className="arl-chev" aria-hidden>›</span>
                  </button>
                  {isOpen ? (
                    <div className="arl-body" id={`arl-${r.id}`} data-auto-body={r.id}>
                      {r.id === 'zones' ? <ZoneTable locale={locale} /> : null}
                      <p className="arl-last">
                        {last ? wt(locale, r.id === 'texts' ? 'p4c_wf_state' : 'p4c_wf_last', { what: last }) : wt(locale, 'p4c_wf_last_none')}
                      </p>
                      {r.id === 'zones' ? <p className="arl-who">{wt(locale, 'p4c_wf_zt_who')}</p> : null}
                      {r.go ? (
                        <button type="button" className="btn ghost arl-go" data-auto-go={r.id} onClick={() => follow(r.go)}>
                          {wt(locale, 'p4c_wf_open', { where: wt(locale, r.go.label) })}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="arl-foot">{wt(locale, 'p4c_wf_auto_foot')}</p>
    </div>
  );
}
