/**
 * audyt-B B-04 — okno „Zmień status”: kolejność statusów i kierunek zmiany (E25, decyzja 07.10, 17:46:
 * „SCX może zmieniać status tylko do przodu. Cofnięcie robi tylko administrator HHL, z powodem”).
 * Czyste obliczenie widoku: lista do wyboru i to, czy wybrany status jest cofnięciem. Tę samą regułę w bazie dokłada wykonawca.
 */
import type { CorridorStage, LoadStatus } from '../types';

/** Spis E25 w kolejności (1–14); „Rozładowany” to „Dostarczone”, „Anulowany” poza ciągiem. */
export const MANUAL_STATUSES: readonly LoadStatus[] = [
  'PLANNED',
  'RESOURCES_PENDING',
  'DOC_MISSING',
  'READY',
  'LOADING',
  'IN_TRANSIT_PL',
  'AT_PORT',
  'ON_FERRY',
  'AT_PORT_SE',
  'IN_TRANSIT_SE',
  'APPROACHING_SITE',
  'DELIVERED',
  'READY_TO_INVOICE',
  'INVOICED',
];

/* „Opóźniony” i „Brak GPS” to w E25 oznaczenia obok statusu — miejsce w ciągu bierzemy z etapu */
const BY_STAGE: Record<CorridorStage, LoadStatus> = {
  PLAN: 'PLANNED',
  LOADING: 'LOADING',
  TO_PORT: 'IN_TRANSIT_PL',
  GDANSK: 'AT_PORT',
  FERRY: 'ON_FERRY',
  APPROACH: 'AT_PORT_SE',
  SE_ROAD: 'IN_TRANSIT_SE',
  SITE: 'APPROACHING_SITE',
  DELIVERED: 'DELIVERED',
};

/** Status z ciągu E25 odpowiadający bieżącemu (UNLOADING → DELIVERED; DELAYED / SILENT → według etapu). */
export function manualStatusOf(status: LoadStatus, stage?: CorridorStage | null): LoadStatus {
  if (status === 'UNLOADING') return 'DELIVERED';
  if (MANUAL_STATUSES.includes(status) || status === 'CANCELLED') return status;
  return stage ? BY_STAGE[stage] : 'PLANNED';
}

/** Miejsce w ciągu E25 (0–13); „Anulowany” = −1 (poza ciągiem). */
export function statusRank(status: LoadStatus, stage?: CorridorStage | null): number {
  const s = manualStatusOf(status, stage);
  return MANUAL_STATUSES.indexOf(s);
}

/** Wybrany status jest wcześniejszy niż bieżący (cofnięcie). */
export function isStepBack(next: LoadStatus, current: LoadStatus, stage?: CorridorStage | null): boolean {
  if (next === 'CANCELLED' || current === 'CANCELLED') return false;
  return statusRank(next) < statusRank(current, stage);
}

/**
 * Statusy do wyboru: administrator HHL — cały ciąg (cofnięcie z powodem) i „Anulowany”, gdy wolno;
 * SCX (i każdy inny) — bieżący i późniejsze.
 */
export function manualOptions(
  current: LoadStatus,
  stage: CorridorStage | null | undefined,
  opts: { hhlAdmin: boolean; canCancel: boolean },
): LoadStatus[] {
  const from = Math.max(0, statusRank(current, stage));
  const list = opts.hhlAdmin ? [...MANUAL_STATUSES] : MANUAL_STATUSES.slice(from);
  return opts.canCancel ? [...list, 'CANCELLED'] : list;
}
