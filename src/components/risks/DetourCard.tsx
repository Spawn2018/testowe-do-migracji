/**
 * wyglad/E49 — sprawa SCX „Objazd czy postój?” (decyzja właściciela 16.10.2026, 02:08, odpowiedź 3;
 * dopisek D-20261016-0230-01 Z3). Dwie możliwości obok siebie (telefon — jedna pod drugą): postój do końca zamknięcia
 * + 30 min albo objazd (HERE dla ciężarówki z wymiarami i masą zestawu: + km, + czas, ETA, którędy); przy każdej ryzyka
 * zdaniami. Decyduje SCX („Stoimy” / „Jedziemy objazdem” + uwagi); HHL widzi to samo bez przycisków.
 */
import { useId, useState } from 'react';
import { formatListDateTime } from '../../lib/format';
import { timeOnly } from '../../lib/statusAxis';
import { fasterOf, hasDetour, kmText, minText, sortRisks, type DetourCase, type DetourRisk } from '../../lib/e49Detour';
import { e49t } from '../../i18n/e49';

function Risks({ list, id }: { list: readonly DetourRisk[]; id: string }) {
  if (!list.length) return null;
  return (
    <>
      <h5 className="dtr-rh" id={id}>{e49t('e49_risks').toLocaleUpperCase('pl-PL')}</h5>
      <ul className="dtr-risks" aria-labelledby={id}>
        {sortRisks(list).map((r, k) => (
          <li key={k} className={r.level === 'warn' ? 'is-warn' : 'is-ok'} data-detour-risk={r.kind}>
            <span className="dtr-mark" aria-hidden="true">{r.level === 'warn' ? '!' : '✓'}</span>
            <span className="sr-only">{e49t(r.level === 'warn' ? 'e49_risk_warn' : 'e49_risk_ok')}: </span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function DetourCard({ c, nowIso, canDecide, busy = false, onDecide }: {
  c: DetourCase;
  nowIso: string;
  /** SCX Dyspozytor / SCX Użytkownik przewoźnika transportu */
  canDecide: boolean;
  busy?: boolean;
  /** null — zapis nie podłączony (przyciski zablokowane) */
  onDecide: ((pick: 'HOLD' | 'DETOUR', note: string | null) => void) | null;
}) {
  const uid = useId();
  const [note, setNote] = useState('');
  const fast = fasterOf(c);
  const late = Date.parse(c.decideByIso) < Date.parse(nowIso);
  const until = c.untilIso ? e49t('e49_until', { t: timeOnly(c.untilIso) }) : e49t('e49_until_none');
  const reason = [e49t(`e49_reason_${c.reason}`), c.reasonDetail].filter(Boolean).join(', ');
  const sub = e49t(late ? 'e49_sub_late' : 'e49_sub', {
    reason,
    src: e49t(`e49_src_${c.source}`),
    at: timeOnly(c.noticeIso),
    by: timeOnly(c.decideByIso),
  });
  const wired = canDecide && !!onDecide;
  const decide = (pick: 'HOLD' | 'DETOUR') => { if (wired && !busy) onDecide!(pick, note.trim() || null); };
  const d = c.detour;
  const fasterTag = (pick: 'HOLD' | 'DETOUR') => (fast?.pick === pick
    ? <span className="dtr-fast">{e49t('e49_faster', { d: minText(fast.byMin) })}</span>
    : null);

  return (
    <section className="dtr" data-detour={c.id} aria-labelledby={`${uid}-t`}>
      <div className="dtr-hd">
        <h3 className="dtr-t" id={`${uid}-t`}>{e49t('e49_title', { place: c.place, until })}</h3>
        <p className={`dtr-s${late ? ' is-late' : ''}`}>{sub}</p>
      </div>
      <div className="dtr-opts">
        <section className={`dtr-opt${fast?.pick === 'HOLD' ? ' is-fast' : ''}`} data-detour-opt="HOLD" aria-labelledby={`${uid}-h`}>
          <header className="dtr-oh"><h4 id={`${uid}-h`}>{e49t('e49_hold_h')}</h4>{fasterTag('HOLD')}</header>
          <p className="dtr-big">{c.hold.untilIso ? e49t('e49_hold_until', { t: timeOnly(c.hold.untilIso) }) : e49t('e49_hold_unknown')}</p>
          <p className="dtr-nums">
            <b>{e49t('e49_km0')}</b> · <b>+{minText(c.hold.addMin)}</b>
          </p>
          <p className="dtr-eta">{e49t('e49_eta', { t: formatListDateTime(c.hold.etaIso) })} · {e49t('e49_eta_add', { d: minText(c.hold.addMin) })}</p>
          <Risks list={c.hold.risks} id={`${uid}-hr`} />
          {canDecide ? (
            <button type="button" className={`btn${fast?.pick === 'DETOUR' ? ' ghost' : ''}`} disabled={!wired || busy} onClick={() => decide('HOLD')} data-detour-pick="HOLD">
              {e49t('e49_hold')}
            </button>
          ) : null}
        </section>
        <section className={`dtr-opt${fast?.pick === 'DETOUR' ? ' is-fast' : ''}${hasDetour(d) ? '' : ' is-none'}`} data-detour-opt="DETOUR" aria-labelledby={`${uid}-d`}>
          <header className="dtr-oh"><h4 id={`${uid}-d`}>{e49t('e49_detour_h')}</h4>{fasterTag('DETOUR')}</header>
          {hasDetour(d) ? (
            <>
              <p className="dtr-big">{d.via}</p>
              <p className="dtr-nums"><b>{kmText(d.addKm)}</b> · <b>+{minText(d.addMin)}</b></p>
              <p className="dtr-eta">{e49t('e49_eta', { t: formatListDateTime(d.etaIso) })} · {e49t('e49_eta_add', { d: minText(d.addMin) })}</p>
              <Risks list={d.risks} id={`${uid}-dr`} />
              {canDecide ? (
                <button type="button" className={`btn${fast?.pick === 'HOLD' ? ' ghost' : ''}`} disabled={!wired || busy} onClick={() => decide('DETOUR')} data-detour-pick="DETOUR">
                  {e49t('e49_detour')}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <p className="dtr-big">{e49t('e49_none')}</p>
              <p className="dtr-eta">{d.why}</p>
            </>
          )}
        </section>
      </div>
      {canDecide ? (
        <label className="dtr-note">
          <span>{e49t('e49_note')}</span>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} data-detour-note />
        </label>
      ) : (
        <p className="dtr-wait" data-detour-wait>{e49t('e49_wait_scx')}</p>
      )}
      <p className="dtr-src">{e49t('e49_src_line')}</p>
    </section>
  );
}
