/**
 * PL-DATA — słownik kodów Trafikverket (Situation 1.6, RoadCondition, pogoda drogowa) na polski.
 * Opis w panelu bierze się z kodów. Surowy tekst szwedzki nie jest treścią główną.
 */

export type TvDomain =
  | 'messageType'
  | 'messageCode'
  | 'severity'
  | 'restriction'
  | 'direction'
  | 'condition'
  | 'weather';

const messageType: Record<string, string> = {
  Olycka: 'wypadek',
  Vägarbete: 'roboty drogowe',
  Hinder: 'przeszkoda',
  Färja: 'przeprawa promowa',
  Väglag: 'stan nawierzchni',
  'Viktig trafikinformation': 'ważna informacja drogowa',
  Restriktion: 'ograniczenie',
  Trafikmeddelande: 'komunikat drogowy',
  Vägavstängning: 'zamknięcie drogi',
  Djur: 'zwierzę na drodze',
  Halka: 'ślisko',
  Snöhalka: 'ślisko, śnieg',
  Information: 'informacja drogowa',
  MaintenanceWorks: 'roboty drogowe',
  Animal: 'zwierzę na drodze',
  Accident: 'wypadek',
  Roadworks: 'roboty drogowe',
  Obstruction: 'przeszkoda',
  Weather: 'ostrzeżenie pogodowe',
  Closure: 'zamknięcie drogi',
};

const messageCode: Record<string, string> = {
  accident: 'wypadek',
  secondaryAccident: 'wypadek wtórny',
  accidentInvolvingHazardousMaterials: 'wypadek z materiałami niebezpiecznymi',
  vehicleOnFire: 'pojazd w ogniu',
  overturnedVehicle: 'przewrócony pojazd',
  brokenDownVehicle: 'unieruchomiony pojazd',
  jackknifedArticulatedLorry: 'złamany zestaw ciężarowy',
  shedLoad: 'zgubiony ładunek',
  vehicleStuck: 'pojazd unieruchomiony',
  roadworks: 'roboty drogowe',
  maintenanceWorks: 'roboty utrzymaniowe',
  constructionWork: 'roboty budowlane',
  resurfacingWork: 'wymiana nawierzchni',
  roadMarkingWork: 'malowanie oznakowania',
  bridgeMaintenance: 'prace na moście',
  clearanceWorks: 'sprzątanie drogi',
  blastingWork: 'roboty strzałowe',
  installationWork: 'prace instalacyjne',
  grassCuttingWork: 'koszenie pobocza',
  treeAndVegetationCuttingWork: 'wycinka przy drodze',
  sweepingOfRoad: 'zamiatanie drogi',
  litterClearance: 'sprzątanie drogi',
  snowploughsInUse: 'pługi na drodze',
  saltAndGritSpreading: 'solenie i posypywanie',
  roadClosed: 'droga zamknięta',
  carriagewayClosures: 'zamknięta jezdnia',
  laneClosures: 'zamknięty pas',
  overnightClosures: 'zamknięcie nocne',
  contraflow: 'ruch wahadłowy',
  narrowLanes: 'zwężone pasy',
  lanesBlocked: 'zablokowane pasy',
  vehicleObstruction: 'pojazd blokuje pas',
  obstructionOnTheRoad: 'przeszkoda na drodze',
  objectOnTheRoad: 'przedmiot na drodze',
  peopleOnRoadway: 'ludzie na jezdni',
  animalPresence: 'zwierzę na drodze',
  blackIce: 'gołoledź',
  ice: 'lód',
  icyPatches: 'miejscami lód',
  snow: 'śnieg',
  heavySnow: 'intensywny śnieg',
  packedSnow: 'ubity śnieg',
  looseSnow: 'luźny śnieg',
  driftingSnow: 'zamieć',
  slush: 'błoto pośniegowe',
  slipperyRoad: 'śliska nawierzchnia',
  riskOfIce: 'ryzyko oblodzenia',
  riskOfSlippery: 'ryzyko śliskości',
  flooding: 'zalanie',
  flashFloods: 'gwałtowne zalanie',
  strongWinds: 'silny wiatr',
  fog: 'mgła',
  poorVisibility: 'słaba widoczność',
  slowTraffic: 'spowolniony ruch',
  queue: 'korek',
  earlierIncident: 'skutki wcześniejszego zdarzenia',
  roadSurfaceInPoorCondition: 'zła nawierzchnia',
  oilOnRoad: 'plama na drodze',
  speedRestriction: 'ograniczenie prędkości',
  weightRestriction: 'ograniczenie masy',
  heightRestriction: 'ograniczenie wysokości',
  widthRestriction: 'ograniczenie szerokości',
  lengthRestriction: 'ograniczenie długości',
  axleLoadRestriction: 'ograniczenie nacisku osi',
  noEntry: 'zakaz wjazdu',
  followDiversionSigns: 'objazd według znaków',
  trafficBeingManuallyDirected: 'ruch kierowany ręcznie',
  abnormalLoad: 'przejazd ponadnormatywny',
  convoy: 'kolumna pojazdów',
  policeCheckpoint: 'kontrola policyjna',
  bridgeSwingInOperation: 'most zwodzony w ruchu',
  levelCrossingFailure: 'awaria przejazdu kolejowego',
  signalFailure: 'awaria sygnalizacji',
  technicalProblems: 'problem techniczny',
  emergencyServices: 'służby ratunkowe',
  rescueAndRecoveryWork: 'akcja ratownicza',
  policeInvestigation: 'czynności policji',
  fire: 'pożar',
  smokeHazard: 'dym',
  avalancheRisk: 'ryzyko lawiny',
  rockfalls: 'obryw skalny',
  landslide: 'osuwisko',
  holidayTraffic: 'ruch świąteczny',
  majorEvent: 'duża impreza',
  closed: 'zamknięte',
  open: 'otwarte',
};

const severity: Record<string, string> = {
  '1': 'brak wpływu na ruch',
  '2': 'mały wpływ na ruch',
  '3': 'umiarkowany wpływ na ruch',
  '4': 'duży wpływ na ruch',
  '5': 'bardzo duży wpływ na ruch',
};

const restriction: Record<string, string> = {
  roadClosed: 'droga zamknięta',
  carriagewayClosed: 'jezdnia zamknięta',
  carriagewayClosures: 'jezdnia zamknięta',
  lanesBlocked: 'zablokowane pasy',
  laneClosed: 'pas zamknięty',
  speedRestriction: 'ograniczenie prędkości',
  speedLimit: 'ograniczenie prędkości',
  weightRestriction: 'ograniczenie masy',
  heightRestriction: 'ograniczenie wysokości',
  widthRestriction: 'ograniczenie szerokości',
  lengthRestriction: 'ograniczenie długości',
  axleLoad: 'ograniczenie nacisku osi',
  noOvertaking: 'zakaz wyprzedzania',
  noEntry: 'zakaz wjazdu',
  followDiversion: 'objazd',
};

const direction: Record<string, string> = {
  both: 'w obu kierunkach',
  bothDirections: 'w obu kierunkach',
  Both: 'w obu kierunkach',
  north: 'w kierunku północnym',
  northBound: 'w kierunku północnym',
  North: 'w kierunku północnym',
  south: 'w kierunku południowym',
  southBound: 'w kierunku południowym',
  South: 'w kierunku południowym',
  east: 'w kierunku wschodnim',
  eastBound: 'w kierunku wschodnim',
  East: 'w kierunku wschodnim',
  west: 'w kierunku zachodnim',
  westBound: 'w kierunku zachodnim',
  West: 'w kierunku zachodnim',
  withFlow: 'zgodnie z kierunkiem kilometrażu',
  againstFlow: 'pod prąd kilometrażu',
  positive: 'w kierunku rosnącego kilometrażu',
  negative: 'w kierunku malejącego kilometrażu',
  unknown: 'kierunek nieznany',
  '0': 'w obu kierunkach',
  '1': 'w kierunku rosnącego kilometrażu',
  '2': 'w kierunku malejącego kilometrażu',
};

/** RoadCondition.ConditionCode — skala Trafikverket (1 = norma). */
const condition: Record<string, string> = {
  '1': 'nawierzchnia normalna',
  '2': 'nawierzchnia umiarkowanie utrudniona',
  '3': 'ryzyko śliskości',
  '4': 'nawierzchnia śliska',
  '5': 'nawierzchnia bardzo śliska',
  '6': 'nawierzchnia zamknięta',
  '7': 'śnieg na nawierzchni',
  '8': 'lód na nawierzchni',
  '9': 'błoto pośniegowe',
};

const weather: Record<string, string> = {
  rain: 'deszcz',
  snow: 'śnieg',
  ice: 'lód',
  frost: 'szron',
  hail: 'grad',
  fog: 'mgła',
  wind: 'wiatr',
  gale: 'wichura',
  storm: 'burza',
  thunder: 'burza',
  slippery: 'ślisko',
  normal: 'bez ostrzeżenia',
  none: 'bez opadów',
};

const TABLES: Record<TvDomain, Record<string, string>> = {
  messageType, messageCode, severity, restriction, direction, condition, weather,
};

export function translateTvCode(domain: TvDomain, code: string | number | null | undefined): { pl: string; known: boolean } {
  if (code == null || code === '') return { pl: '', known: false };
  const key = String(code).trim();
  const table = TABLES[domain];
  if (Object.prototype.hasOwnProperty.call(table, key)) return { pl: table[key], known: true };
  return { pl: '', known: false };
}

/** Każdy kod, który słownik uznaje za występujący w API. Test wymaga tłumaczenia każdego z nich. */
export function trafikverketApiCodes(): { domain: TvDomain; code: string }[] {
  const out: { domain: TvDomain; code: string }[] = [];
  for (const domain of Object.keys(TABLES) as TvDomain[]) {
    for (const code of Object.keys(TABLES[domain])) out.push({ domain, code });
  }
  return out;
}

export const PANEL_FALLBACK = 'zdarzenie drogowe';
