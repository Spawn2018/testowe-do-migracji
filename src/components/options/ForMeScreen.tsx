/** wyglad/P3-c — Dla mnie › Co dostaję (E11 „Dla mnie”, E37 menu konta: „co dostaję”). Mały moduł — w pierwszym wczytaniu. */
import type { ReactNode } from 'react';
import type { Locale } from '../../types';
import { t } from '../../i18n/messages';
import type { AccountKind } from './types';
import { CHANNELS, ChannelChip, type MatrixGroup } from './channels';
import { up } from './up';

/** Dla mnie › Co dostaję — tylko podgląd tego, co trafia do konta osoby (E11 „Dla mnie”, E37 menu konta). */
export function ForMeScreen({ locale, kind, groups, mark, children }: { locale: Locale; kind: AccountKind | null; groups: MatrixGroup[] | null; mark?: ReactNode; children?: ReactNode }) {
  if (!(kind && groups) && !children) return <div className="note option-note">{t(locale, 'p3c_no_source')}</div>;
  return (
    <div className="ox-forme">
      {kind && groups ? (
        <section className="ox-panel">
          <header className="ox-panel-hd"><h3>{t(locale, 'p3c_f_mine').replace('{role}', t(locale, `p3c_role_${kind}`))}</h3>{mark}</header>
          <p className="ox-panel-note">{t(locale, 'p3c_f_mine_note')}</p>
          {groups.map((g) => {
            const rows = g.rows.filter((r) => !r.risksOnly && r.cells[kind] && (r.cells[kind]!.bell || r.cells[kind]!.push || r.cells[kind]!.mail));
            if (!rows.length) return null;
            return (
              <div key={g.id} className="ox-forme-group">
                <h4 data-content>{up(g.title)}</h4>
                <ul className="ox-list">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <span className="ox-tile-copy"><b data-content>{r.title}</b>{r.sub ? <span data-content>{r.sub}</span> : null}</span>
                      <span className="ox-chips">
                        {CHANNELS.map((ch) => <ChannelChip key={ch} locale={locale} ch={ch} on={r.cells[kind]![ch]} fixed={r.cells[kind]!.fixed?.includes(ch)} />)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      ) : null}
      {children ? (
        <section className="ox-panel">
          <header className="ox-panel-hd"><h3>{t(locale, 'p3c_f_browser')}</h3></header>
          <p className="ox-panel-note">{t(locale, 'p3c_f_browser_note')}</p>
          <div className="ox-panel-bd">{children}</div>
        </section>
      ) : null}
    </div>
  );
}
