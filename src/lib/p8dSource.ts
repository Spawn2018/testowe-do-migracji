/**
 * wyglad/P8-d — skąd Automatyzacje (E35) biorą własne reguły, przebiegi, historię i sprawdzenie „na ostatnich 30 dniach”
 * oraz jak zapisują zmianę z powodem. Produkcja: `null` = nie podłączone — zakładka „Własne reguły” zostaje przy dzisiejszej
 * liście i kreatorze do Twojego podłączenia w P8 (dopisek do PR wyglad/P8-d). Demo: zapis w pamięci strony.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0). Bez zapytań.
 */
import { demoRuleCheck, demoRuleHistory, demoRuleRemove, demoRuleRuns, demoRuleSave, demoRuleSetEnabled, demoRules, demoRulesNow, demoRuleZones } from './p8dDemo';
import type { CheckResult, OwnRule, RuleDraft, RuleHist, RuleRun, ZoneOption } from './p8dRules';

export interface RulesSource {
  rules: () => Promise<OwnRule[]>;
  /** reguły od razu (demo); produkcja — brak, strona czeka na `rules()` */
  initial?: OwnRule[];
  /** przebiegi z ostatnich 30 dni (wszystkie reguły, także dawne START) */
  runs: () => Promise<RuleRun[]>;
  /** historia zmian (najnowsze pierwsze): kto, kiedy, co, powód */
  history: () => Promise<RuleHist[]>;
  /** strefy do wyboru w „Gdy auto jest w strefie” (aktywne, według trasy) */
  zones: () => Promise<ZoneOption[]>;
  /** „Sprawdź na ostatnich 30 dniach”: kiedy reguła by zadziałała i co wbudowanego robi to samo */
  check: (d: RuleDraft, selfId: string | null) => Promise<CheckResult>;
  /** zapis (id null — nowa) z powodem (wymagany przy zmianie); tylko Administrator HHL; wpis w historii */
  save: ((id: string | null, d: RuleDraft, reason: string | null) => Promise<{ ok: boolean; rule?: OwnRule; error?: string }>) | null;
  setEnabled: ((id: string, on: boolean, reason: string) => Promise<{ ok: boolean }>) | null;
  remove: ((id: string, reason: string) => Promise<{ ok: boolean }>) | null;
}

export function rulesOf(): RulesSource | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase'
    ? {
      rules: demoRules, initial: demoRulesNow(), runs: demoRuleRuns, history: demoRuleHistory, zones: demoRuleZones,
      check: demoRuleCheck, save: demoRuleSave, setEnabled: demoRuleSetEnabled, remove: demoRuleRemove,
    }
    : null;
}
