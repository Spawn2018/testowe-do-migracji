/**
 * wyglad/P6 — skąd strona Ryzyka bierze dane, których aplikacja jeszcze nie ma (dopisek do PR wyglad/P6-a).
 * Produkcja: `null` / pusta lista = nie podłączone (przyciski i sekcje ukryte, nic nie zgadujemy);
 * demo: przykłady z `p6Demo.ts`. Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 * Bez zapytań i zapisów. To, co strona czyta już dziś (decyzje, rejsy, morze, drogi SE), zostaje przy dzisiejszych zapytaniach.
 */
import type { DeliveredCheck, Load, OrgKind, Risk, Sailing } from '../types';
import type { CaseEvent, CasePerson, TodoDecision, TodoIssue } from './p6Todo';
import type { FerryRowView, RoadRowView } from './p6Route';
import type { FeeSuggestion } from './p5Fees';
import { demoAssignments, demoDecisions, demoFerryRows, demoHistory, demoMe, demoStenaSailings, demoTimeBans, DEMO_PEOPLE } from './p6Demo';

/** E6: osoby firmy z telefonem (imię, nazwisko, rodzaj konta). null = nie podłączone — bez „Zadzwoń”. */
export function casePeopleOf(org: OrgKind): CasePerson[] | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? DEMO_PEOPLE.filter((p) => p.org === org) : null;
}

/** Ja (do „Moje”, „Biorę tę sprawę”). Demo — konto pokazowe; produkcja — z profilu, gdy przydział jest podłączony. */
export function caseMeOf(org: OrgKind): CasePerson | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoMe(org) : null;
}

/**
 * E6 (decyzja 15:13, E6-5): przydział sprawy — kto wziął. null = nie podłączone: bez filtra „Moje”
 * i bez „Biorę tę sprawę / Oddaj / Przejmij” (zapis przez `decision_assign` — wykonawca).
 */
export function caseAssignmentsOf(): Record<string, string> | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoAssignments() : null;
}

/** E6: historia sprawy z imieniem i nazwiskiem. null = nie podłączone (sekcja ukryta). */
export function caseHistoryOf(issueId: string, nowIso: string): CaseEvent[] | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoHistory(issueId, nowIso) : null;
}

/** Decyzje w demo (produkcja: dzisiejsze zapytanie `decisions` na stronie Ryzyka). */
export function sampleDecisionsOf(loads: readonly Load[], nowIso: string, role: OrgKind): TodoDecision[] {
  const all = import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoDecisions(loads, nowIso) : [];
  return role === 'KSH' ? [] : role === 'SCX' ? all.filter((d) => d.decider === 'SCX') : all;
}

/** Zakazy ruchu przy transporcie (informacja). Produkcja: ryzyka z bazy (`kind` ROAD_PL / ROAD_SE); demo — przykład. */
export function extraRisksOf(loads: readonly Load[], nowIso: string): Risk[] {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoTimeBans(loads, nowIso) : [];
}

/**
 * G-22: podpowiedzi dopłat jako sprawy (HHL — część przychodowa, SCX — kosztowa; dopłata SCX czeka na HHL);
 * L14: „czy dostarczono?” jako sprawa przewoźnika. Wejście — to, co dają `feeSuggestionsOf` i `deliveredCheckOf`.
 * Demo: tylko przy transportach, które mają już kartę (liczba w menu bez zmian do podłączenia E7).
 */
export function todoExtrasOf(
  role: OrgKind,
  items: readonly { load: Load; fees: FeeSuggestion[] | null; check: DeliveredCheck | null }[],
  cardLoads: ReadonlySet<string>,
): TodoIssue[] {
  if (role === 'KSH') return [];
  const out: TodoIssue[] = [];
  for (const { load, fees, check } of items) {
    for (const f of fees ?? []) {
      const amount = role === 'SCX' ? f.costEur : f.revEur;
      const mine = role === 'SCX' ? f.scx : f.hhl;
      /* HHL: także dopłata dodana przez SCX czeka na akceptację HHL */
      const waitHhl = role === 'HHL' && f.scx === 'CZEKA_HHL';
      if ((amount > 0 && mine == null) || waitHhl) {
        out.push({ id: `fee:${f.id}:${role}`, src: 'FEE', loadId: load.id, owner: role, severity: 'MEDIUM', dueAt: null, overdue: false,
          merged: 1, go: 'FEE', ageHours: 0, fee: f });
      }
    }
    if (check) {
      out.push({ id: `chk:${check.id}`, src: 'CHECK', loadId: load.id, owner: 'SCX', severity: 'HIGH', dueAt: check.exitAt, overdue: false,
        merged: 1, go: 'NONE', ageHours: 0, check });
    }
  }
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? out.filter((i) => i.loadId && cardLoads.has(i.loadId)) : out;
}

/** Promy w demo (produkcja: `ferryRowsFromDb` z `sailings` i `marine_conditions`). */
export function sampleFerryRowsOf(nowIso: string, onBoard: number): FerryRowView[] {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoFerryRows(nowIso, onBoard) : [];
}

/** Rozkład do propozycji drugiej przeprawy (8.4): produkcja — `sailings`; demo — przykład Steny. */
export function altSailingsOf(sailings: readonly Sailing[], nowIso: string): readonly Sailing[] {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoStenaSailings(nowIso) : sailings;
}

/** E2: drogi PL z HERE. null = nie podłączone („Brak danych”). */
export function roadPlOf(): RoadRowView[] | null {
  return null;
}
