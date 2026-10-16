/**
 * wyglad/P8-d — zdania reguł, przebiegów i historii (E35 pkt 3–4): bez kodów (L3_AWIZ, SKIPPED, „warunek niespełniony”).
 */
import { formatListDateTime } from '../../lib/format';
import { plPlural } from '../../lib/plPlural';
import { durText, type RuleDraft, type RuleHist, type RuleRun, type RunResult, type ZoneOption } from '../../lib/p8dRules';
import { p8dt, type P8dKey } from '../../i18n/p8d';
import { statusLabel } from '../../lib/statusLabel';
import type { LoadStatus } from '../../types';

export const statusName = (s: LoadStatus | 'ANY') => (s === 'ANY' ? p8dt('p8d_c_status_any') : statusLabel(s));
const who = (w: string) => p8dt(`p8d_w_${w}` as P8dKey);
const people = (n: number) => `${n} ${plPlural(n, 'osoba', 'osoby', 'osób')}`;

/** „Gdy auto jest w strefie „Plac budowy Stegra Boden” dłużej niż 3 h” */
export function whenText(d: Pick<RuleDraft, 'when'>, zones: readonly ZoneOption[]): string {
  const w = d.when;
  switch (w.kind) {
    case 'zone': return p8dt('p8d_s_zone', { zone: zones.find((z) => z.id === w.zoneId)?.name ?? '—', d: durText(w.minutes) });
    case 'status': return w.status === 'ANY' ? p8dt('p8d_s_status_any') : p8dt('p8d_s_status', { s: statusName(w.status) });
    case 'issue': return p8dt('p8d_s_issue', { k: p8dt(`p8d_i_${w.issue}` as P8dKey) });
    case 'daily': return p8dt('p8d_s_daily', { c: p8dt(`p8d_dc_${w.check}` as P8dKey, { h: durText(w.hours * 60) }) });
  }
}

/** „powiadomienie: HHL Operacje, SCX · e-mail · SMS do odbiorców (Boden, E42)” */
export function thenText(d: Pick<RuleDraft, 'then'>): string {
  const t = d.then;
  return [
    t.notify.length ? p8dt('p8d_t_notify', { who: t.notify.map(who).join(', ') }) : '',
    t.todo ? p8dt('p8d_t_todo', { who: who(t.todo) }) : '',
    t.email ? p8dt('p8d_t_email') : '',
    t.smsTo ? p8dt('p8d_t_text', { place: p8dt(`p8d_p_${t.smsTo}` as P8dKey) }) : '',
  ].filter(Boolean).join(' · ');
}

export function ruleSentence(d: Pick<RuleDraft, 'when' | 'then'>, zones: readonly ZoneOption[]): string {
  return `${whenText(d, zones)} — ${p8dt('p8d_s_then', { what: thenText(d) })}`;
}

/** Wynik przebiegu zdaniem: „powiadomienie: KSH 4 osoby, SCX 1 osoba”, „nie pasuje: …”, „pominięte: reguły wyłączone (05.10)”. */
export function runText(r: RunResult, rules = 1): string {
  switch (r.kind) {
    case 'done': return [
      r.notify.length ? p8dt('p8d_r_done', { who: r.notify.map((x) => `${who(x.who)} ${people(x.n)}`).join(', ') }) : '',
      r.todo ? p8dt('p8d_r_done_todo', { who: who(r.todo) }) : '',
      r.email ? p8dt('p8d_r_done_email', { n: r.email }) : '',
      r.smsN ? p8dt('p8d_r_done_text', { n: r.smsN }) : '',
    ].filter(Boolean).join(' · ');
    case 'nomatch': return p8dt('p8d_r_nomatch', { why: r.why });
    case 'skipped': {
      const many = rules > 1;
      return r.since
        ? p8dt(many ? 'p8d_r_skipped_many_since' : 'p8d_r_skipped_since', { d: formatListDateTime(r.since).split(', ')[0] ?? '' })
        : p8dt(many ? 'p8d_r_skipped_many' : 'p8d_r_skipped');
    }
    case 'error': return p8dt('p8d_r_error', { t: r.text });
  }
}

export function runRules(r: RuleRun): string { return r.rules.join(', '); }

/** Wpis historii: „dodana · „Długi pobyt na placu” · powód: …” */
export function histText(h: RuleHist): string {
  return [
    p8dt(`p8d_h_${h.action}` as P8dKey),
    `„${h.rule}”`,
    h.what ?? '',
    h.reason ? p8dt('p8d_h_reason', { r: h.reason }) : h.action === 'created' ? '' : p8dt('p8d_h_noreason'),
  ].filter(Boolean).join(' · ');
}
