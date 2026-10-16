/**
 * wyglad/P6-c — zakładka „Status” według E17 („Po zmianie”, img/e17-after; nowsze niż E25 w tych punktach):
 * plan z różnicą przy Załadunku i „Na placu” („plan 07.10 · w terminie”), kamienie milowe pod statusem
 * (strefy, np. „Bufor 50 km przed Boden”). Czyste funkcje widoku: dane z transportu i dziennika zdarzeń
 * (`load_events`), bez zapytań i zapisów.
 */
import type { Geofence, Load, LoadEvent, LoadStatus } from '../types';
import { localDateOf } from './money/engine';
import { isoMs, type StatusAxis } from './statusAxis';

const DAY = 86_400_000;
const dayMs = (d: string) => Date.parse(`${d}T12:00:00Z`);

export interface PlanNote {
  /** Dzień z planu KSH (RRRR-MM-DD). */
  plan: string;
  /** load — dzień załadunku; deliver — dostawa „najpóźniej do” (E15 L1). */
  kind: 'load' | 'deliver';
  /** Dni: faktyczny dzień − plan (0 = tego dnia, < 0 — wcześniej); null — status jeszcze nie osiągnięty. */
  diff: number | null;
}

/** Plan dla wiersza osi: Załadunek — dzień załadunku, „Na placu” — dzień dostawy; pozostałe statusy bez planu. */
export function planNote(status: LoadStatus, hitAt: string | null, load: Pick<Load, 'plannedLoadDate' | 'plannedDeliverDate'>): PlanNote | null {
  const kind = status === 'LOADING' ? 'load' : status === 'APPROACHING_SITE' ? 'deliver' : null;
  if (!kind) return null;
  const plan = String((kind === 'load' ? load.plannedLoadDate : load.plannedDeliverDate) ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan)) return null;
  const at = hitAt && isoMs(hitAt) > 0 ? localDateOf(hitAt) : null;
  return { plan, kind, diff: at ? Math.round((dayMs(at) - dayMs(plan)) / DAY) : null };
}

export interface Milestone {
  at: string;
  /** dwell — postój w strefie potwierdzony (GEOFENCE_DWELL, np. „postój na placu potwierdzony” w img/e17-after) */
  kind: 'enter' | 'exit' | 'dwell';
  zone: string;
}

/**
 * Kamienie milowe pod statusem: wjazd, postój i wyjazd ze stref (GEOFENCE_ENTER / _DWELL / _EXIT) między wejściem w ten status
 * a następnym statusem. Pomijane: zdarzenie, które samo zmieniło status z automatu (ta sama chwila ±2 min), strefy dopisane przy
 * ustaleniu fazy z pierwszej pozycji (`synthetic`), strefy bez nazwy. Klucz mapy — `statuses.join(' ')` wiersza.
 */
export function axisMilestones(
  axis: StatusAxis,
  events: readonly LoadEvent[],
  geofences: readonly Pick<Geofence, 'id' | 'name'>[],
  max = 3,
): Map<string, Milestone[]> {
  const rows = axis.groups.flatMap((g) => g.rows).filter((r) => (r.kind === 'done' || r.kind === 'current') && r.hit);
  const starts = rows.map((r) => ({ key: r.statuses.join(' '), at: isoMs(r.hit!.at), auto: r.hit!.source === 'auto' })).sort((a, b) => a.at - b.at);
  const names = new Map(geofences.map((g) => [g.id, g.name]));
  const out = new Map<string, Milestone[]>();
  const KIND: Record<string, Milestone['kind']> = { GEOFENCE_ENTER: 'enter', GEOFENCE_EXIT: 'exit', GEOFENCE_DWELL: 'dwell' };
  const evs = [...events].filter((e) => KIND[e.type]).sort((a, b) => isoMs(a.at) - isoMs(b.at));
  for (const e of evs) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    if (p.synthetic === true) continue;
    const id = typeof p.geofence_id === 'string' ? p.geofence_id : null;
    const zone = (id && names.get(id)) || (typeof p.geofence_name === 'string' ? p.geofence_name : null) || (typeof p.zone_name === 'string' ? p.zone_name : null);
    if (!zone) continue;
    const t = isoMs(e.at);
    /* zdarzenie, które samo ustawiło status z automatu (ta sama chwila) — już widać je jako status */
    if (starts.some((s) => s.auto && Math.abs(s.at - t) < 120_000)) continue;
    let owner: string | null = null;
    for (const s of starts) if (s.at <= t) owner = s.key;
    if (!owner) continue;
    const list = out.get(owner) ?? [];
    list.push({ at: e.at, kind: KIND[e.type]!, zone });
    out.set(owner, list);
  }
  for (const [k, v] of out) out.set(k, v.slice(-max));
  return out;
}
