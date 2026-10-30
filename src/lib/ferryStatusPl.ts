/**
 * PL-DATA — statusy Steny i AIS oraz kody portów po polsku.
 * Formularz komunikatu armatora korzysta z tych samych etykiet.
 */
import { FERRY_ROUTES, routeLabelPl } from './ferryCatalog';
import { portName } from './portName';

const STATUS: Record<string, string> = {
  Arrived: 'Przypłynął',
  Departed: 'Wypłynął',
  Delayed: 'Opóźniony',
  Cancelled: 'Odwołany',
  Canceled: 'Odwołany',
  'On time': 'Planowo',
  'On Time': 'Planowo',
  Scheduled: 'Zaplanowany',
  Planned: 'Zaplanowany',
  Expected: 'Oczekiwany',
  Estimated: 'Szacowany',
  Boarding: 'Zaokrętowanie',
  Berthed: 'Przy nabrzeżu',
  Moored: 'Przy nabrzeżu',
  Docked: 'Przy nabrzeżu',
  Sailed: 'Wypłynął',
  'Under way': 'W drodze',
  Underway: 'W drodze',
  'At anchor': 'Na kotwicy',
  Announced: 'Ogłoszony',
  ODWOLANY: 'Odwołany',
  OPOZNIONY: 'Opóźniony',
  ZAPLANOWANY: 'Zaplanowany',
  ZMIANA_GODZINY: 'Zmiana godziny',
};

const PORT: Record<string, string> = {
  PLGDY: 'Gdynia',
  SEKAA: 'Karlskrona',
  PLGDN: 'Gdańsk',
  SENYN: 'Nynäshamn',
  'GDY-KAA': 'Gdynia–Karlskrona',
  'KAA-GDY': 'Karlskrona–Gdynia',
  'GDN-NYN': 'Gdańsk–Nynäshamn',
  'NYN-GDN': 'Nynäshamn–Gdańsk',
  /* BN9-a: pozostałe trasy z katalogu promów („Tallinn–Helsinki”); #666 C: Terminal A przez routeLabelPl */
  ...Object.fromEntries(FERRY_ROUTES.map((r) => [r.code, `${portName('pl', r.from)}–${portName('pl', r.to)}`])),
  'TLLA-HEL': routeLabelPl('TLLA-HEL')!,
  'HELA-TLL': routeLabelPl('HELA-TLL')!,
};

/** AIS Navigational Status (ITU-R M.1371). */
const NAV: Record<number, string> = {
  0: 'w drodze, maszyna',
  1: 'na kotwicy',
  2: 'nie odpowiada za manewry',
  3: 'ograniczona zdolność manewrowa',
  4: 'ograniczony zanurzeniem',
  5: 'przy nabrzeżu',
  6: 'na mieliźnie',
  7: 'połów',
  8: 'w drodze, żagle',
  9: 'zarezerwowany',
  10: 'zarezerwowany',
  11: 'holowanie',
  12: 'pchanie',
  13: 'zarezerwowany',
  14: 'AIS-SART',
  15: 'nieokreślony',
};

export function ferryStatusPl(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  if (!t) return '';
  if (/cancel|inställ|odwoł|odwol|anul/i.test(t)) return 'Odwołany';
  return STATUS[t] ?? STATUS[t[0].toUpperCase() + t.slice(1).toLowerCase()] ?? t;
}

export function ferryPortPl(code: string | null | undefined): string {
  const t = (code ?? '').trim();
  return PORT[t] ?? PORT[t.toUpperCase()] ?? routeLabelPl(t) ?? t;
}

export function aisNavStatusPl(code: number | null | undefined): string {
  if (code == null || !Number.isFinite(code)) return '';
  return NAV[code] ?? 'status nieokreślony';
}

export function noticeKindPl(kind: string | null | undefined): string {
  return ferryStatusPl(kind);
}

export function canFileOperatorNotice(role: string | null | undefined): boolean {
  return role === 'HHL_ADMIN' || role === 'CARRIER_DISPATCH';
}
