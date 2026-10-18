/**
 * wyglad/P8-d — dane demo Automatyzacji (E35): po zmianie lista własnych reguł jest pusta (reguły START znikają albo
 * przechodzą do „Kto co dostaje”); przebiegi i historia jak w bazie 08.10 (E35 „Fakty”), pobyty w strefach SG-03 i SG-24
 * jak w `load_events` (E34). Zapis w pamięci strony. Tylko demo — `rulesOf()` w produkcji zwraca `null`.
 */
import {
  builtinOverlap, dwellHits, sameRules, type CheckHit, type CheckResult, type OwnRule, type RuleDraft, type RuleHist,
  type RuleRun, type Visit, type ZoneOption,
} from './p8dRules';
import { getNowIso } from './frozenNow';

const ME = 'Anna Wiśniewska';

const ZONES: ZoneOption[] = [
  { id: 'z-srem-buf', name: 'Bufor 50 km przed Śremem', type: 'PRE_ARRIVAL' },
  { id: 'z-srem', name: 'KSH Śrem · Grunwaldzka 27C', type: 'LOADING' },
  { id: 'z-gda-buf', name: 'Bufor 20 km przed Gdańskiem', type: 'PRE_PORT' },
  { id: 'z-gda', name: 'Terminal Polferries Gdańsk', type: 'PORT_OUT' },
  { id: 'z-gdy-buf', name: 'Bufor 20 km przed Gdynią', type: 'PRE_PORT' },
  { id: 'z-gdy', name: 'Terminal Stena Line Gdynia', type: 'PORT_OUT' },
  { id: 'z-nyn', name: 'Terminal Nynäshamn', type: 'PORT_IN' },
  { id: 'z-kar', name: 'Terminal Stena Line Karlskrona', type: 'PORT_IN' },
  { id: 'z-bod-buf', name: 'Bufor 50 km przed Boden', type: 'PRE_ARRIVAL' },
  { id: 'z-bod', name: 'Plac budowy Stegra Boden', type: 'SITE' },
];

/* E34 „Zdarzenia stref” (przegląd 18.10, B5: przed zegarem demo 23.09, 16:32, te same transporty co oś Status):
   T-11 Śrem ENTER 17.09 07:40 → EXIT 09:40, bufor Boden ENTER 22.09 05:22 → EXIT 09:55, plac ENTER 05:56 → EXIT 09:40
   (Dostarczone); SG-24 bufor Gdańsk ENTER 18.09 13:40 → EXIT 14:15 */
const VISITS: Visit[] = [
  { code: 'T-11', loadId: null, zoneId: 'z-srem', enter: '2026-09-17T05:40:00Z', exit: '2026-09-17T07:40:00Z' },
  { code: 'T-11', loadId: null, zoneId: 'z-bod-buf', enter: '2026-09-22T03:22:00Z', exit: '2026-09-22T07:55:00Z' },
  { code: 'T-11', loadId: null, zoneId: 'z-bod', enter: '2026-09-22T03:56:00Z', exit: '2026-09-22T07:40:00Z' },
  { code: 'SG-24', loadId: null, zoneId: 'z-gda-buf', enter: '2026-09-18T11:40:00Z', exit: '2026-09-18T12:15:00Z' },
];
/* zmiany statusu T-11 ze stref (E25, E34): Droga PL po wyjeździe ze Śremu, Na placu, Dostarczone */
const STATUS: { code: string; status: string; at: string }[] = [
  { code: 'T-11', status: 'IN_TRANSIT_PL', at: '2026-09-17T07:40:00Z' },
  { code: 'T-11', status: 'APPROACHING_SITE', at: '2026-09-22T03:56:00Z' },
  { code: 'T-11', status: 'DELIVERED', at: '2026-09-22T07:40:00Z' },
];
/* sprawy (przykład demo): brak awizacji SG-15 przed załadunkiem (E32), postój T-11 na placu */
const ISSUES: { code: string; issue: string; at: string }[] = [
  { code: 'SG-15', issue: 'AWIZ', at: '2026-09-20T04:00:00Z' },
  { code: 'T-11', issue: 'DWELL', at: '2026-09-22T07:56:00Z' },
];

/* E35 „Przebiegi” (workflow_runs) — zdania zamiast kodów */
const RUNS: RuleRun[] = [
  { id: 'r6', at: '2026-09-22T03:57:00Z', rules: ['Dojazd na plac'], code: 'T-11', loadId: null, result: { kind: 'nomatch', why: 'wjazd na plac, a reguła dotyczy strefy 50 km' } },
  { id: 'r5', at: '2026-09-22T03:57:00Z', rules: ['Wjazd przed port'], code: 'T-11', loadId: null, result: { kind: 'nomatch', why: 'to nie strefa przed portem' } },
  { id: 'r4', at: '2026-09-22T03:22:00Z', rules: ['Dojazd na plac'], code: 'T-11', loadId: null, result: { kind: 'done', notify: [{ who: 'KSH', n: 4 }, { who: 'SCX', n: 1 }] } },
  { id: 'r3', at: '2026-09-22T03:22:00Z', rules: ['Wjazd przed port'], code: 'T-11', loadId: null, result: { kind: 'nomatch', why: 'to strefa przed placem' } },
  { id: 'r1', at: '2026-09-18T11:40:00Z', rules: ['Dojazd na plac', 'Wjazd przed port'], code: 'SG-24', loadId: null, result: { kind: 'skipped', since: '2026-09-15T06:09:00Z' } },
];

/* E35 „Historia” (audit_log workflows) i zmiana z E35 pkt 2 (reguły START) */
const HIST: RuleHist[] = [
  { at: '2026-09-22T06:00:00Z', who: 'Administrator HHL', action: 'removed', rule: 'Rozładunek — wgraj POD', reason: 'bez POD — podpisany CMR jest w Dokumentach (decyzja 07.10.2026, 19:51)' },
  { at: '2026-09-22T06:00:00Z', who: 'Administrator HHL', action: 'removed', rule: 'Opóźnienie transportu · Krytyczna zmiana daty · Cichy pojazd', reason: 'wbudowane automaty robią to samo' },
  { at: '2026-09-22T06:00:00Z', who: 'Administrator HHL', action: 'removed', rule: 'Transport anulowany', reason: 'anulowanie liczy dopłatę i powiadamia według „Kto co dostaje”, bez sprawy „brak zasobów”' },
  { at: '2026-09-22T06:00:00Z', who: 'Administrator HHL', action: 'removed', rule: 'Dojazd na plac · Wjazd przed port', what: 'przeniesione do „Kto co dostaje”: „Auto 50 km przed placem / przed Śremem”, „Auto 20 km przed portem”', reason: 'ci sami odbiorcy co dziś' },
  { at: '2026-09-19T18:35:00Z', who: 'Administrator HHL', action: 'on', rule: 'Transport anulowany', reason: null },
  { at: '2026-09-15T15:42:00Z', who: 'Administrator HHL', action: 'on', rule: 'Dojazd na plac · Wjazd przed port · 4 inne', what: '12 przełączeń w minutę', reason: null },
  { at: '2026-09-15T06:09:00Z', who: 'migracja 0165', action: 'off', rule: 'wszystkie 7 reguł START', reason: 'każda dubluje wbudowany alarm' },
];

type State = { rules: OwnRule[]; hist: RuleHist[]; n: number };
const g = globalThis as unknown as { __p8dDemo?: State };
const st = (): State => (g.__p8dDemo ??= { rules: [], hist: [...HIST], n: 0 });

const copy = (r: OwnRule): OwnRule => ({ ...r, when: { ...r.when }, then: { ...r.then, notify: [...r.then.notify] } });

export function demoRulesNow(): OwnRule[] { return st().rules.map(copy); }
export async function demoRules(): Promise<OwnRule[]> { return demoRulesNow(); }
export async function demoRuleRuns(): Promise<RuleRun[]> { return RUNS.map((r) => ({ ...r, rules: [...r.rules] })); }
export async function demoRuleHistory(): Promise<RuleHist[]> { return st().hist.map((h) => ({ ...h })); }
export async function demoRuleZones(): Promise<ZoneOption[]> { return ZONES.map((z) => ({ ...z })); }

export async function demoRuleCheck(d: RuleDraft, selfId: string | null): Promise<CheckResult> {
  const now = getNowIso();
  const since = Date.parse(now) - 30 * 86_400_000;
  let hits: CheckHit[] = [];
  const w = d.when;
  if (w.kind === 'zone') hits = dwellHits(VISITS, w.zoneId, w.minutes, now);
  else if (w.kind === 'status') hits = STATUS.filter((s) => (w.status === 'ANY' || s.status === w.status) && Date.parse(s.at) >= since).map((s) => ({ code: s.code, loadId: null, at: s.at }));
  else if (w.kind === 'issue') hits = ISSUES.filter((s) => s.issue === w.issue && Date.parse(s.at) >= since).map((s) => ({ code: s.code, loadId: null, at: s.at }));
  else {
    /* przegląd o 06:00: przykład demo — dni z liczbą transportów spełniających warunek */
    const per = w.check === 'DATES_UNCONFIRMED' ? 2 : w.hours >= 72 ? 4 : w.hours >= 48 ? 3 : 1;
    hits = [0, 1, 2, 3, 4, 5].map((i) => {
      const day = new Date(Date.parse(now) - i * 86_400_000);
      day.setUTCHours(4, 0, 0, 0);
      return { code: '', loadId: null, at: day.toISOString(), n: per + (i % 2) };
    });
  }
  return { hits: hits.sort((a, b) => b.at.localeCompare(a.at)), builtins: builtinOverlap(w, ZONES), same: sameRules(d, st().rules, selfId) };
}

export async function demoRuleSave(id: string | null, d: RuleDraft, reason: string | null): Promise<{ ok: boolean; rule?: OwnRule }> {
  const s = st();
  const at = new Date().toISOString();
  if (id) {
    const i = s.rules.findIndex((r) => r.id === id);
    if (i < 0) return { ok: false };
    const rule: OwnRule = { ...s.rules[i]!, ...d, when: { ...d.when }, then: { ...d.then, notify: [...d.then.notify] } };
    s.rules[i] = rule;
    s.hist.unshift({ at, who: ME, action: 'changed', rule: rule.name, reason });
    return { ok: true, rule: copy(rule) };
  }
  s.n += 1;
  const rule: OwnRule = { ...d, when: { ...d.when }, then: { ...d.then, notify: [...d.then.notify] }, id: `rule-${s.n}`, runs30: 0, lastRunAt: null };
  s.rules.push(rule);
  s.hist.unshift({ at, who: ME, action: 'created', rule: rule.name, reason });
  return { ok: true, rule: copy(rule) };
}

export async function demoRuleSetEnabled(id: string, on: boolean, reason: string): Promise<{ ok: boolean }> {
  const s = st();
  const r = s.rules.find((x) => x.id === id);
  if (!r) return { ok: false };
  r.enabled = on;
  s.hist.unshift({ at: new Date().toISOString(), who: ME, action: on ? 'on' : 'off', rule: r.name, reason });
  return { ok: true };
}

export async function demoRuleRemove(id: string, reason: string): Promise<{ ok: boolean }> {
  const s = st();
  const r = s.rules.find((x) => x.id === id);
  if (!r) return { ok: false };
  s.rules = s.rules.filter((x) => x.id !== id);
  s.hist.unshift({ at: new Date().toISOString(), who: ME, action: 'removed', rule: r.name, reason });
  return { ok: true };
}
