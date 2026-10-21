/**
 * #384 pkt 5 — KSH: propozycje innego terminu od Scandinavian Express (decyzja `KSH_DATE_COUNTER`, decider CLIENT).
 * KSH nie ma listy „Do zrobienia” (E9) — tu tylko te decyzje, z wyborem z katalogu (Przyjmuję / Odrzucam / Eskaluj do HHL).
 * Daty planu zmienia baza po przyjęciu (0251). Pusta lista — nic nie rysujemy.
 */
import { useState } from 'react';
import type { Load, Locale } from '../../types';
import type { DecisionsApi } from './useDecisions';
import type { TodoDecision } from '../../lib/p6Todo';
import { decText } from '../../i18n/decisions';
import { t } from '../../i18n/messages';
import { proposalOfDetail } from '../../lib/proposeDate';
import { mayResolveDecision } from '../../lib/decisionAccess';
import { transportLabel } from '../../lib/transportName';
import { isPreviewReadOnly } from '../../lib/prodFacade';
import { useTowerStore } from '../../store/useTowerStore';

export function kshProposalsOf(rows: readonly TodoDecision[]): TodoDecision[] {
  return rows.filter((d) => d.decider === 'KSH');
}

function Row({ d, api, locale, load, userRole }: { d: TodoDecision; api: DecisionsApi; locale: Locale; load?: Load; userRole: string | null }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /* „Przyjmuję” zmienia daty planu — najpierw potwierdzenie (F7 #390) */
  const [confirmAccept, setConfirmAccept] = useState(false);
  /* Podgląd KSH (B5) — bez rozstrzygania */
  const can = mayResolveDecision(d.deciderRole, userRole) && !isPreviewReadOnly({ viewRole: 'KSH' });
  const pick = async (code: string, needsNote: boolean) => {
    if (needsNote && note.trim().length < 3) {
      setMsg(t(locale, 'dec_need_comment'));
      return;
    }
    if (code === 'ACCEPT' && !confirmAccept) {
      setMsg(null);
      setConfirmAccept(true);
      return;
    }
    setConfirmAccept(false);
    setBusy(true);
    const r = await api.resolve(d.id, code, note.trim() || null);
    setBusy(false);
    if (r.error) {
      setMsg(r.error);
      return;
    }
    useTowerStore.getState().pushToast(decText(locale, code === 'ACCEPT' ? 'dec_ksh_done_accept' : 'dec_ksh_done_other'), 'LOW', d.loadId ?? undefined);
  };
  const prop = proposalOfDetail(d.detail);
  return (
    <li className="rk-ksh-prop" data-ksh-proposal={d.id}>
      <p className="rk-ksh-prop-hd"><b>{load ? transportLabel(load, 'KSH') : d.title}</b>{prop ? ` · ${prop}` : ''}</p>
      {can ? (
        <>
          {confirmAccept ? (
            <div className="rk-acts" role="group" data-ksh-confirm>
              <p className="rk-muted">{decText(locale, 'dec_ksh_accept_confirm')}{prop ? ` ${prop}.` : ''}</p>
              <button type="button" className="btn" disabled={busy} data-ksh-confirm-yes onClick={() => void pick('ACCEPT', false)}>{decText(locale, 'dec_ksh_confirm_yes')}</button>
              <button type="button" className="btn" disabled={busy} onClick={() => setConfirmAccept(false)}>{decText(locale, 'dec_ksh_confirm_no')}</button>
            </div>
          ) : null}
          <div className="rk-acts" hidden={confirmAccept}>
            {d.options.map((o) => (
              <button key={o.code} type="button" className="btn" disabled={busy} data-rk-opt={o.code} onClick={() => void pick(o.code, o.requires_comment)}>
                {decText(locale, o.label_key, o.code)}{o.requires_comment ? ' *' : ''}
              </button>
            ))}
          </div>
          <label className="rk-note">
            <span>{t(locale, 'dec_comment')}</span>
            <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </>
      ) : null}
      {msg ? <p className="rk-muted neg" role="status">{msg}</p> : null}
    </li>
  );
}

export function KshProposals({ api, locale, loads, userRole }: { api: DecisionsApi | null; locale: Locale; loads: readonly Load[]; userRole: string | null }) {
  if (!api) return null;
  const rows = kshProposalsOf(api.rows);
  if (!rows.length) return null;
  const byId = new Map(loads.map((l) => [l.id, l]));
  return (
    <section className="rk-sec-box rk-ksh-props" data-ksh-proposals>
      <h2 className="rk-sec">{decText(locale, 'dec_ksh_props_title')}</h2>
      <ul>
        {rows.map((d) => <Row key={d.id} d={d} api={api} locale={locale} load={d.loadId ? byId.get(d.loadId) : undefined} userRole={userRole} />)}
      </ul>
    </section>
  );
}
