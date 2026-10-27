/**
 * Lista zmian z pliku KSH: „Nowe w pliku”, „Brak w pliku” i tabela zmian pól z kodem transportu w każdym wierszu.
 * Wspólna dla panelu „Zmiany z pliku KSH do przejrzenia” (Harmonogram, W-567) i okna „Zmiany z pliku KSH”
 * po imporcie (#594 B1, z dzwonka). Na telefonie tabela jako karty (`ox-cards-phone`), tekst zawija się w komórkach.
 */
import { Fragment, useMemo } from 'react';
import type { Locale } from '../../types';
import { s7, s7p } from '../../i18n/sched7';
import {
  groupPreview, previewKindCodes, previewNotes, previewValue,
  type KshPreviewChange, type KshPreviewCounts,
} from '../../lib/kshPreviewView';
import './sched7.css';

export function KshChangeList({ locale, changes, counts, onlyManual = false, onOpenLoad, emptyKey = 's7_kp_empty', skipKey = 's7_kp_skip' }: {
  locale: Locale;
  changes: readonly KshPreviewChange[];
  counts: KshPreviewCounts;
  onlyManual?: boolean;
  onOpenLoad: (loadId: string) => void;
  /** tekst przy braku zmian (panel: „Plik zgadza się z Watch Tower”) */
  emptyKey?: string;
  /** znacznik pominiętego pola: panel przed importem „nie zostanie zapisane”, okno po imporcie „nie zapisane” */
  skipKey?: string;
}) {
  const groups = useMemo(() => groupPreview(changes, onlyManual), [changes, onlyManual]);
  const added = useMemo(() => previewKindCodes(changes, 'added'), [changes]);
  const missing = useMemo(() => previewKindCodes(changes, 'missing'), [changes]);
  const lbl = {
    code: s7(locale, 's7_kp_c_code'), field: s7(locale, 's7_kp_c_field'), wt: s7(locale, 's7_kp_c_wt'),
    file: s7(locale, 's7_kp_c_file'), notes: s7(locale, 's7_kp_c_notes'),
  };
  const link = (code: string, loadId: string | null) => (loadId ? (
    <button type="button" className="s7-kp-link" aria-label={s7p(locale, 's7_kp_open', { code })} onClick={() => onOpenLoad(loadId)}>{code}</button>
  ) : code);

  return (
    <>
      {!onlyManual ? ([['added', added], ['missing', missing]] as const).map(([k, list]) => (list.length ? (
        <div key={k} className="s7-kp-codes" data-ksh-preview-kind={k}>
          <b>{s7p(locale, k === 'added' ? 's7_kp_added' : 's7_kp_missing', { n: list.length })}</b>
          <ul>
            {list.map((x) => <li key={x.code}>{link(x.code, x.loadId)}</li>)}
          </ul>
        </div>
      ) : null)) : null}
      {(added.length || missing.length) && groups.length ? <b className="s7-kp-sub">{s7p(locale, 's7_kp_fields', { n: counts.fields })}</b> : null}
      {groups.length === 0 && (onlyManual || (!added.length && !missing.length)) ? (
        <p className="s7-kp-meta" data-ksh-preview-empty>{s7(locale, onlyManual ? 's7_kp_empty_manual' : emptyKey)}</p>
      ) : groups.length === 0 ? null : (
        <table className="ox-table ox-cards-phone s7-kp-t" data-ksh-preview-table>
          <thead>
            <tr><th>{lbl.code}</th><th>{lbl.field}</th><th>{lbl.wt}</th><th>{lbl.file}</th><th>{lbl.notes}</th></tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.code}>
                {g.rows.map((r, i) => {
                  const notes = previewNotes(r);
                  return (
                    <tr key={`${r.field}-${i}`} data-ksh-preview-row={g.code} className={i === 0 ? 's7-kp-first' : 's7-kp-cont'}>
                      <th scope="row" data-label={lbl.code} className={i === 0 ? 's7-kp-code' : 's7-kp-code s7-kp-code-cont'}>
                        {/* Kod transportu w każdym wierszu (zgłoszenie właściciela 27.10, 14:24 — drugi wiersz BS-06 wyglądał na „bez numeru”). */}
                        {link(g.code, g.loadId)}
                      </th>
                      <td data-label={lbl.field}>{r.fieldLabel}</td>
                      <td data-label={lbl.wt}>{previewValue(r.wt, r.field)}</td>
                      <td data-label={lbl.file}>{previewValue(r.file, r.field)}</td>
                      <td data-label={lbl.notes} className="s7-kp-notes">
                        {notes.length === 0 ? '—' : notes.map((n) => (
                          <span key={n} className={`pill ${n === 'manual' ? 'p-amber' : n === 'skip' ? 'p-plan' : 'p-sea'}`} data-ksh-preview-note={n}>
                            {n === 'skip'
                              ? s7p(locale, skipKey, { reason: r.skipReason ?? '' })
                              : s7(locale, n === 'manual' ? 's7_kp_manual' : 's7_kp_pending')}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
