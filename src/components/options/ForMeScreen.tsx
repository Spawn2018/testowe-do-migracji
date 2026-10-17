/** wyglad/P3-c — Dla mnie › Co dostaję (E11 „Dla mnie”, E37 menu konta: „co dostaję”). Mały moduł — w pierwszym wczytaniu. */
import { useState, type ReactNode } from 'react';
import type { Locale } from '../../types';
import { t } from '../../i18n/messages';
import type { AccountKind } from './types';
import { CH_KEY, CHANNELS, ChannelChip, Icon, type Channel, type MatrixGroup } from './channels';
import type { MyNotifyPrefs } from '../../lib/forMeSource';

type Props = {
  locale: Locale;
  kind: AccountKind | null;
  groups: MatrixGroup[] | null;
  mark?: ReactNode;
  /** Ustawienia osoby zapisane do tej pory (brak kanału = wartość startowa z „Kto co dostaje”). */
  prefs?: MyNotifyPrefs | null;
  /** Zapis jednego kanału (jedno miejsce: `src/lib/forMeSource.ts`); brak — tylko podgląd. */
  onSave?: ((rowId: string, ch: Channel, on: boolean) => Promise<boolean>) | null;
};

/**
 * Dla mnie › Co dostaję — zdarzenia, które rodzaj konta dostaje według „Kto co dostaje”, z przełącznikami osoby
 * (dzwonek, telefon, e-mail). wyglad/audyt-E (E-05, W47 — właściciel 16.10, 13:58 i 14:09): każda osoba w HHL, KSH
 * i SCX ustawia swoje kanały sama; Administrator HHL daje wartości startowe. Kanał „zawsze” zostaje włączony.
 */
export function ForMeScreen({ locale, kind, groups, mark, prefs, onSave }: Props) {
  const [mine, setMine] = useState<MyNotifyPrefs>(() => prefs ?? {});
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  if (!(kind && groups)) return <div className="note option-note">{t(locale, 'p3c_no_source')}</div>;
  const edit = !!onSave;

  const set = async (rowId: string, title: string, ch: Channel, on: boolean) => {
    if (!onSave) return;
    const before = mine;
    setMine((m) => ({ ...m, [rowId]: { ...m[rowId], [ch]: on } }));
    const ok = await onSave(rowId, ch, on).catch(() => false);
    if (ok) {
      setStatus({ ok, text: t(locale, on ? 'p3c_f_saved_on' : 'p3c_f_saved_off').replace('{name}', title).replace('{ch}', t(locale, `p3c_chs_${ch}`)) });
    } else {
      setMine(before);
      setStatus({ ok, text: t(locale, 'p3c_f_save_fail') });
    }
  };

  return (
    <div className="ox-forme">
      <section className="ox-panel" data-forme={edit ? 'edit' : 'read'}>
        <header className="ox-panel-hd"><h3>{t(locale, 'p3c_f_mine').replace('{role}', t(locale, `p3c_role_${kind}`))}</h3>{mark}</header>
        <p className="ox-panel-note">{t(locale, edit ? 'p3c_f_mine_note_edit' : 'p3c_f_mine_note')}</p>
        <div className="ox-forme-legend">
          {CHANNELS.map((ch) => (
            <span key={ch} className="ox-forme-legend-item"><span className={`ox-ch ox-ch-${ch} is-on is-static`} aria-hidden="true"><Icon ch={ch} /></span>{t(locale, CH_KEY[ch])}</span>
          ))}
        </div>
        {edit ? (
          <p className={`ox-forme-status${status && !status.ok ? ' ox-alert' : ''}`} role="status" aria-live="polite" data-forme-status={status ? (status.ok ? 'saved' : 'fail') : undefined}>
            {status?.text ?? ''}
          </p>
        ) : null}
        {groups.map((g) => {
          const rows = g.rows.filter((r) => !r.risksOnly && r.cells[kind] && (r.cells[kind]!.bell || r.cells[kind]!.push || r.cells[kind]!.mail));
          if (!rows.length) return null;
          return (
            <div key={g.id} className="ox-forme-group">
              <h4 data-content>{g.title}</h4>
              <ul className="ox-list">
                {rows.map((r) => {
                  const cell = r.cells[kind]!;
                  return (
                    <li key={r.id} data-forme-row={r.id}>
                      <span className="ox-tile-copy"><b data-content>{r.title}</b>{r.sub ? <span data-content>{r.sub}</span> : null}</span>
                      <span className="ox-chips" role="group" aria-label={r.title}>
                        {CHANNELS.map((ch) => {
                          const fixed = cell.fixed?.includes(ch) ?? false;
                          const on = fixed || (mine[r.id]?.[ch] ?? cell[ch]);
                          return (
                            <ChannelChip
                              key={ch}
                              locale={locale}
                              ch={ch}
                              on={on}
                              fixed={fixed}
                              onClick={edit && !fixed ? () => { void set(r.id, r.title, ch, !on); } : undefined}
                            />
                          );
                        })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
