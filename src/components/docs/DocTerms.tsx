/**
 * wyglad/P5 — Opcje › Zasady transportu › Zezwolenia i dokumenty: terminy dokumentów (E31 pkt 1, E12, L26).
 * Edytor przeniesiony ze strony Dokumenty bez zmiany zapisu (`doc_requirement_set`, tylko HHL, audit_log);
 * na stronie Dokumenty terminy są już tylko do odczytu. Zmienia Administrator HHL (E9), Operacje widzą.
 * Lista jak na stronie Dokumenty: zezwolenia PL i SE oraz CMR (bez rysunku, POD i zdjęć mocowania).
 */
import { useEffect, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { ft, ftp } from '../../i18n/p5';
import type { DocCategory } from '../../types';
import { DEFAULT_DOC_REQUIREMENTS, type DocRequirement } from '../../lib/docRequirements';
import { cmrKind, responsibleOrg } from '../../lib/p5Docs';
import { up } from '../options/up';
import '../finance/finance.css';
import './docs.css';

const KEYS: DocCategory[] = ['PERMIT_PL', 'PERMIT_SE', 'CMR'];
/* wyglad/audyt-E (E-07; 16.10, 01:13): zezwolenie PL i SE przy transporcie tylko „Trasa” (KR), „Firma” podpina się samo.
   Demo pokazuje regułę; produkcja — gdy baza policzy braki według rodzaju zezwolenia (wykonawca, D-04). */
const ROUTE_ONLY = import.meta.env.VITE_AUTH_MODE !== 'supabase';
const PERMITS: DocCategory[] = ['PERMIT_PL', 'PERMIT_SE'];

export default function DocTerms({ canEdit }: { canEdit: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const [reqs, setReqs] = useState<DocRequirement[]>(DEFAULT_DOC_REQUIREMENTS);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [edit, setEdit] = useState<DocRequirement | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    let alive = true;
    void import('../../data/docRequirementsServer')
      .then((m) => m.loadDocRequirements())
      .then((r) => { if (!alive) return; setProjectId(r.projectId); if (r.reqs.length) setReqs(r.reqs); })
      .catch(() => { /* brak odczytu → wartości startowe */ });
    return () => { alive = false; };
  }, [tick]);

  const save = async (r: DocRequirement) => {
    const st = useTowerStore.getState();
    try {
      if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
        if (!projectId) throw new Error('—');
        const m = await import('../../data/docRequirementsServer');
        await m.saveDocRequirement(projectId, r);
        setTick((x) => x + 1);
      }
      setReqs((xs) => xs.map((x) => (x.category === r.category ? r : x)));
      setEdit(null);
      st.pushToast(t(locale, 'iii6_saved'), 'MEDIUM');
    } catch (e) {
      st.pushToast(t(locale, 'iii6_err').replace('{msg}', e instanceof Error ? e.message : String(e)), 'HIGH');
    }
  };

  const label = (r: DocRequirement) => (r.category === 'CMR' ? ft(locale, `p5_doc_r_CMR_${cmrKind(r)}`) : ft(locale, `p5_doc_r_${r.category}`));
  const due = (r: DocRequirement) => (r.category === 'CMR' && cmrKind(r) === 'SIGNED'
    ? ftp(locale, 'p5_doc_due_CMR_SIGNED', { h: r.offsetHours })
    : t(locale, `iii6_a_${r.anchor}`).replace('{h}', String(r.offsetHours)));
  const rows = KEYS.map((k) => reqs.find((r) => r.category === k)).filter((r): r is DocRequirement => !!r);

  return (
    <section className="panel fin-panel doc-terms" aria-labelledby="doc-terms-h" data-doc-terms>
      <header className="panel-hd fin-hd2">
        <h3 id="doc-terms-h">{ft(locale, 'p5_terms_h')}</h3>
        <span className="sub">{ft(locale, canEdit ? 'p5_terms_sub' : 'p5_terms_sub_ro')}</span>
      </header>
      <div className="fin-scroll">
        <table className="fin-table">
          <thead>
            <tr>
              <th>{up(ft(locale, 'p5_doc_col_doc'))}</th>
              <th>{up(ft(locale, 'p5_doc_col_who'))}</th>
              <th>{up(ft(locale, 'p5_terms_col_req'))}</th>
              <th>{up(ft(locale, 'p5_doc_col_due'))}</th>
              {canEdit ? <th><span className="sronly">{t(locale, 'iii6_edit')}</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = edit?.category === r.category;
              return (
                <tr key={r.category} data-docreq={r.category}>
                  <td><b>{label(r)}</b></td>
                  <td>{responsibleOrg(r.responsible)}</td>
                  <td>
                    {on && edit ? (
                      <label className="doc-terms-chk">
                        <input type="checkbox" data-docreq-required="" checked={edit.required} onChange={(e) => setEdit({ ...edit, required: e.target.checked })} /> {t(locale, 'iii6_required')}
                      </label>
                    ) : r.required ? (ROUTE_ONLY && PERMITS.includes(r.category) ? ft(locale, 'p5_terms_req_route') : t(locale, 'iii6_required')) : t(locale, 'iii6_optional')}
                  </td>
                  <td data-docreq-text="">
                    {on && edit && edit.anchor !== 'ORG' ? (
                      <span className="doc-terms-h">
                        <input className="input" type="number" min={0} max={720} data-docreq-hours="" aria-label={t(locale, 'iii6_hours')} value={edit.offsetHours}
                          onChange={(e) => setEdit({ ...edit, offsetHours: Math.max(0, Math.min(720, Math.round(Number(e.target.value) || 0))) })} />
                        <span>h · {due({ ...edit })}</span>
                      </span>
                    ) : due(r)}
                  </td>
                  {canEdit ? (
                    <td className="num">
                      {on && edit ? (
                        <span className="doc-terms-acts">
                          <button type="button" className="btn" data-action="docreq-save" onClick={() => void save(edit)}>{t(locale, 'iii6_save')}</button>
                          <button type="button" className="btn ghost" onClick={() => setEdit(null)}>{t(locale, 'iii6_cancel')}</button>
                        </span>
                      ) : (
                        <button type="button" className="btn ghost" data-action="docreq-edit" onClick={() => setEdit(r)}>{t(locale, 'iii6_edit')}</button>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fin-muted doc-pad">{ft(locale, 'p5_terms_note')}{ROUTE_ONLY ? ` ${ft(locale, 'p5_terms_note_route')}` : ''}</p>
    </section>
  );
}
