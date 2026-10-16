/**
 * wyglad/P8-d — kreator własnej reguły (E35 pkt 3, img/e35-after): „Gdy … wtedy …” z przyciskami i listami,
 * bez operatorów i JSON. Pod spodem „Sprawdź na ostatnich 30 dniach” (kiedy by zadziałała, co wbudowanego robi to samo,
 * własna reguła z tym samym „Gdy”). Zmiana istniejącej reguły wymaga powodu (historia, E35 pkt 4).
 * Komputer ≥ 1280 px — panel obok listy; węższy ekran i telefon — na całą szerokość zamiast listy.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatListDateTime } from '../../lib/format';
import { plPlural } from '../../lib/plPlural';
import {
  DAILY_CHECKS, DWELL_STEPS, ISSUE_KINDS, RULE_STATUSES, WHO, WITHIN_STEPS, durText, emptyDraft, validateRule, whenOf,
  type CheckResult, type OwnRule, type RuleDraft, type RuleError, type RuleThen, type RuleWhen, type SmsPlace, type Who, type ZoneOption,
} from '../../lib/p8dRules';
import type { RulesSource } from '../../lib/p8dSource';
import type { LoadStatus } from '../../types';
import { p8dt, type P8dKey } from '../../i18n/p8d';
import { up } from '../options/up';
import { statusName } from './ruleText';

const WHEN_KINDS: RuleWhen['kind'][] = ['zone', 'status', 'issue', 'daily'];
const PLACES: SmsPlace[] = ['SREM', 'BODEN'];
const dayOf = (iso: string) => formatListDateTime(iso).split(', ')[0] ?? '';
const timeOf = (iso: string) => formatListDateTime(iso).split(', ')[1] ?? '';

const ERR_KEY: Record<RuleError, P8dKey> = {
  name: 'p8d_e_name', zone: 'p8d_e_zone', then: 'p8d_e_then', todo: 'p8d_e_then', email: 'p8d_e_email', reason: 'p8d_e_reason',
};

export function RuleCreator({ rule, zones, src, phone, onClose }: {
  rule: OwnRule | null;
  zones: readonly ZoneOption[];
  src: RulesSource;
  phone: boolean;
  onClose: (result: { rule: OwnRule | null; created: boolean } | null) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<RuleDraft>(() => (rule
    ? { name: rule.name, when: { ...rule.when }, then: { ...rule.then, notify: [...rule.then.notify] }, enabled: rule.enabled }
    : emptyDraft(zones.find((z) => z.type === 'SITE')?.id ?? zones[0]?.id ?? '')));
  const [reason, setReason] = useState('');
  const [errs, setErrs] = useState<RuleError[]>([]);
  const [fail, setFail] = useState('');
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<{ res: CheckResult | null; state: 'wait' | 'ok' | 'fail' }>({ res: null, state: 'wait' });
  const busyRef = useRef(false);
  const alive = useRef(true);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const refs = useRef(new Map<RuleError, HTMLElement>());
  const editing = !!rule;

  useEffect(() => {
    alive.current = true;
    titleRef.current?.scrollIntoView({ block: 'nearest' });
    titleRef.current?.focus({ preventScroll: true });
    return () => { alive.current = false; };
  }, []);

  /* sprawdzenie na 30 dniach — po każdej zmianie „Gdy” albo „Wtedy” (z opóźnieniem, ostatnia odpowiedź wygrywa) */
  const key = JSON.stringify([draft.when, draft.then]);
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    setCheck((c) => ({ res: c.res, state: 'wait' }));
    const t = window.setTimeout(() => {
      void src.check(draft, rule?.id ?? null).then(
        (res) => { if (alive.current && n === seq.current) setCheck({ res, state: 'ok' }); },
        () => { if (alive.current && n === seq.current) setCheck({ res: null, state: 'fail' }); },
      );
    }, 250);
    return () => window.clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (p: Partial<RuleDraft>) => { setDraft((d) => ({ ...d, ...p })); setFail(''); };
  const setWhen = (w: RuleWhen) => { patch({ when: w }); setErrs((e) => e.filter((x) => x !== 'zone')); };
  const setThen = (p: Partial<RuleThen>) => { setDraft((d) => ({ ...d, then: { ...d.then, ...p } })); setFail(''); setErrs((e) => e.filter((x) => x !== 'then' && x !== 'email')); };
  const toggleWho = (w: Who) => setThen({ notify: draft.then.notify.includes(w) ? draft.then.notify.filter((x) => x !== w) : WHO.filter((x) => x === w || draft.then.notify.includes(x)) });

  const submit = async () => {
    if (busyRef.current) return;
    const e = validateRule(draft, reason, editing);
    setErrs(e);
    setFail('');
    if (e.length) { refs.current.get(e[0]!)?.focus(); return; }
    busyRef.current = true;
    setBusy(true);
    const r = await src.save!(rule?.id ?? null, { ...draft, name: draft.name.trim() }, editing ? reason.trim() : null).catch(() => ({ ok: false } as { ok: boolean; rule?: OwnRule }));
    busyRef.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (!r.ok) { setFail(p8dt('p8d_e_fail')); return; }
    onClose({ rule: r.rule ?? null, created: !editing });
  };

  const reg = (k: RuleError) => (el: HTMLElement | null) => { if (el) refs.current.set(k, el); else refs.current.delete(k); };
  const err = (k: RuleError) => (errs.includes(k) ? <span className="rl-ferr" id={`${id}-${k}-err`}>{p8dt(ERR_KEY[k])}</span> : null);
  const desc = (k: RuleError) => (errs.includes(k) ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-${k}-err` } : {});
  const title = editing ? p8dt('p8d_c_edit', { name: rule!.name }) : p8dt('p8d_c_new');
  const w = draft.when;
  const th = draft.then;

  const checkBox = useMemo(() => {
    if (check.state === 'fail') return <p className="rl-k-line">{p8dt('p8d_k_fail')}</p>;
    const res = check.res;
    if (!res) return <p className="rl-k-line">{p8dt('p8d_k_wait')}</p>;
    const lines = res.hits.slice(0, 5).map((h, i) => {
      let text: string;
      if (w.kind === 'zone' && h.from) {
        /* img/e35-after: „SG-03 · plac od 07.10, 08:35 → **07.10, 11:35** (wyjazd 12:19)” */
        const type = zones.find((z) => z.id === w.zoneId)?.type ?? '';
        const where = p8dt(type === 'SITE' ? 'p8d_k_where_SITE' : type === 'LOADING' ? 'p8d_k_where_LOADING' : type.startsWith('PORT') ? 'p8d_k_where_PORT' : 'p8d_k_where_ZONE');
        const tail = h.exit ? p8dt('p8d_k_exit', { t: dayOf(h.exit) === dayOf(h.at) ? timeOf(h.exit) : formatListDateTime(h.exit) }) : h.still ? p8dt('p8d_k_still') : '';
        return <li key={i}>{p8dt('p8d_k_zone', { code: h.code, where, from: formatListDateTime(h.from) })}<b>{formatListDateTime(h.at)}</b>{tail}</li>;
      } else if (w.kind === 'daily') {
        const n = h.n ?? 0;
        text = p8dt('p8d_k_daily', { at: dayOf(h.at), n, word: plPlural(n, 'transport', 'transporty', 'transportów') });
      } else {
        text = p8dt('p8d_k_at', { code: h.code, at: formatListDateTime(h.at) });
      }
      return <li key={i}>{text}</li>;
    });
    const n = res.hits.length;
    return (
      <>
        <p className="rl-k-line"><b>{p8dt('p8d_k_title')}</b> · {n ? p8dt('p8d_k_n', { n, word: plPlural(n, 'raz', 'razy', 'razy') }) : p8dt('p8d_k_none')}</p>
        {n ? <ul className="rl-k-hits">{lines}{n > 5 ? <li>{p8dt('p8d_k_more', { n: n - 5 })}</li> : null}</ul> : null}
        <p className="rl-k-line rl-k-muted">
          {res.builtins.length
            ? p8dt('p8d_k_builtin', { what: res.builtins.map((b) => p8dt(`p8d_b_${b}` as P8dKey)).join('; ') })
            : p8dt('p8d_k_builtin_none')}
        </p>
        {res.same.length ? <p className="rl-k-line rl-k-warn">{p8dt('p8d_k_same', { names: res.same.map((x) => `„${x}”`).join(', ') })}</p> : null}
      </>
    );
  }, [check, w, zones]);

  return (
    <section className={`panel rl-creator${phone ? ' is-phone' : ''}`} aria-labelledby={`${id}-t`} data-rule-creator={rule?.id ?? 'new'}>
      <header className="rl-c-hd">
        {phone ? <button type="button" className="rl-back" aria-label={p8dt('p8d_c_close')} onClick={() => onClose(null)}>‹</button> : null}
        <h2 id={`${id}-t`} ref={titleRef} tabIndex={-1}>{title}</h2>
        {!phone ? <button type="button" className="rl-x" aria-label={p8dt('p8d_c_close')} onClick={() => onClose(null)}>×</button> : null}
      </header>
      <div className="rl-c-bd">
        <div className="rl-f">
          <label htmlFor={`${id}-name`}>{up(p8dt('p8d_c_name'))}</label>
          <input ref={reg('name')} id={`${id}-name`} className="input" value={draft.name} maxLength={120} placeholder={p8dt('p8d_c_name_ph')} {...desc('name')}
            onChange={(e) => { patch({ name: e.target.value }); setErrs((x) => x.filter((k) => k !== 'name')); }} data-rule-f="name" />
          {err('name')}
        </div>

        <div className="rl-f" role="group" aria-labelledby={`${id}-when`}>
          <span className="rl-lbl" id={`${id}-when`}>{up(p8dt('p8d_c_when'))}</span>
          <div className="rl-seg">
            {WHEN_KINDS.map((k) => (
              <button key={k} type="button" className="rl-opt" aria-pressed={w.kind === k} onClick={() => { if (w.kind !== k) setWhen(whenOf(k, zones.find((z) => z.type === 'SITE')?.id ?? zones[0]?.id ?? '')); }} data-rule-when={k}>
                {p8dt(`p8d_c_w_${k}` as P8dKey)}
              </button>
            ))}
          </div>
        </div>

        {w.kind === 'zone' ? (
          <div className="rl-row2">
            <div className="rl-f">
              <label htmlFor={`${id}-zone`}>{up(p8dt('p8d_c_zone'))}</label>
              <select ref={reg('zone')} id={`${id}-zone`} className="input" value={w.zoneId} {...desc('zone')} onChange={(e) => setWhen({ ...w, zoneId: e.target.value })} data-rule-f="zone">
                {!w.zoneId ? <option value="">{p8dt('p8d_c_zone_pick')}</option> : null}
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              {err('zone')}
            </div>
            <div className="rl-f">
              <label htmlFor={`${id}-min`}>{up(p8dt('p8d_c_longer'))}</label>
              <select id={`${id}-min`} className="input" value={w.minutes} onChange={(e) => setWhen({ ...w, minutes: Number(e.target.value) })} data-rule-f="minutes">
                {DWELL_STEPS.map((m) => <option key={m} value={m}>{durText(m)}</option>)}
              </select>
            </div>
          </div>
        ) : w.kind === 'status' ? (
          <div className="rl-f">
            <label htmlFor={`${id}-st`}>{up(p8dt('p8d_c_status'))}</label>
            <select id={`${id}-st`} className="input" value={w.status} onChange={(e) => setWhen({ kind: 'status', status: e.target.value as LoadStatus | 'ANY' })} data-rule-f="status">
              {RULE_STATUSES.map((s) => <option key={s} value={s}>{statusName(s)}</option>)}
            </select>
          </div>
        ) : w.kind === 'issue' ? (
          <div className="rl-f">
            <label htmlFor={`${id}-is`}>{up(p8dt('p8d_c_issue'))}</label>
            <select id={`${id}-is`} className="input" value={w.issue} onChange={(e) => setWhen({ kind: 'issue', issue: e.target.value as typeof w.issue })} data-rule-f="issue">
              {ISSUE_KINDS.map((k) => <option key={k} value={k}>{p8dt(`p8d_i_${k}` as P8dKey)}</option>)}
            </select>
          </div>
        ) : (
          <div className="rl-row2">
            <div className="rl-f">
              <label htmlFor={`${id}-dc`}>{up(p8dt('p8d_c_check'))}</label>
              <select id={`${id}-dc`} className="input" value={w.check} onChange={(e) => setWhen({ ...w, check: e.target.value as typeof w.check })} data-rule-f="check">
                {DAILY_CHECKS.map((c) => <option key={c} value={c}>{p8dt(`p8d_dc_${c}` as P8dKey, { h: '…' }).replace(' w ciągu …', '')}</option>)}
              </select>
            </div>
            {w.check !== 'DATES_UNCONFIRMED' ? (
              <div className="rl-f">
                <label htmlFor={`${id}-h`}>{up(p8dt('p8d_c_within'))}</label>
                <select id={`${id}-h`} className="input" value={w.hours} onChange={(e) => setWhen({ ...w, hours: Number(e.target.value) })} data-rule-f="hours">
                  {WITHIN_STEPS.map((h) => <option key={h} value={h}>{durText(h * 60)}</option>)}
                </select>
              </div>
            ) : null}
          </div>
        )}

        <div className="rl-f" role="group" aria-labelledby={`${id}-then`} aria-describedby={errs.includes('then') ? `${id}-then-err` : undefined}>
          <span className="rl-lbl" id={`${id}-then`}>{up(p8dt('p8d_c_then'))}</span>
          <div className="rl-seg is-wrap">
            {WHO.map((x, i) => (
              <button key={x} ref={i === 0 ? reg('then') : undefined} type="button" className="rl-opt" aria-pressed={th.notify.includes(x)} onClick={() => toggleWho(x)} data-rule-then={`notify-${x}`}>
                {p8dt('p8d_c_notify', { who: p8dt(`p8d_w_${x}` as P8dKey) })}
              </button>
            ))}
            <button type="button" className="rl-opt" aria-pressed={!!th.todo} onClick={() => setThen({ todo: th.todo ? null : 'HHL_OPS' })} data-rule-then="todo">{p8dt('p8d_c_todo')}</button>
            <button ref={reg('email')} type="button" className="rl-opt" aria-pressed={th.email} {...desc('email')} onClick={() => setThen({ email: !th.email })} data-rule-then="email">{p8dt('p8d_c_email')}</button>
            {PLACES.map((p) => (
              <button key={p} type="button" className="rl-opt" aria-pressed={th.smsTo === p} onClick={() => setThen({ smsTo: th.smsTo === p ? null : p })} data-rule-then={`text-${p}`}>
                {p8dt('p8d_c_text', { place: p8dt(`p8d_p_${p}` as P8dKey) })}
              </button>
            ))}
          </div>
          {err('then')}
          {err('email')}
          {th.todo ? (
            <div className="rl-f rl-inline">
              <label htmlFor={`${id}-todo`}>{up(p8dt('p8d_c_todo_who'))}</label>
              <select id={`${id}-todo`} className="input" value={th.todo} onChange={(e) => setThen({ todo: e.target.value as Who })} data-rule-f="todo">
                {WHO.map((x) => <option key={x} value={x}>{p8dt(`p8d_w_${x}` as P8dKey)}</option>)}
              </select>
            </div>
          ) : null}
          {th.email ? <p className="rl-hint">{p8dt('p8d_c_email_note')}</p> : null}
          {th.smsTo ? <p className="rl-hint">{p8dt('p8d_c_sms_note')}</p> : null}
        </div>

        <div className="rl-check" data-rule-check aria-live="polite">{checkBox}</div>

        {editing ? (
          <div className="rl-f">
            <label htmlFor={`${id}-reason`}>{up(p8dt('p8d_c_reason'))}</label>
            <input ref={reg('reason')} id={`${id}-reason`} className="input" value={reason} placeholder={p8dt('p8d_c_reason_ph')} {...desc('reason')}
              onChange={(e) => { setReason(e.target.value); setErrs((x) => x.filter((k) => k !== 'reason')); }} data-rule-f="reason" />
            {err('reason')}
          </div>
        ) : null}

        {fail ? <p className="rl-err" role="alert">{fail}</p> : null}
        <div className="rl-c-ft">
          <label className="rl-enabled">
            <input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} data-rule-f="enabled" />
            <span>{p8dt('p8d_c_enabled')}</span>
          </label>
          <span className="rl-c-acts">
            <button type="button" className="btn ghost" onClick={() => onClose(null)}>{p8dt('p8d_c_cancel')}</button>
            <button type="button" className="btn" aria-disabled={busy || undefined} onClick={() => void submit()} data-rule-save>{p8dt('p8d_c_save')}</button>
          </span>
        </div>
      </div>
    </section>
  );
}
