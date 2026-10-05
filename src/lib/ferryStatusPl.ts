/**
 * Krótkie etykiety statusów i portów widoczne w komunikacie armatora.
 * Pełny słownik PL-DATA (Trafikverket, HERE, DeepL) jest poza tą pozycją.
 */

const STATUS: Record<string, string> = {
  Arrived: 'Przypłynął',
  Departed: 'Wypłynął',
  Delayed: 'Opóźniony',
  Cancelled: 'Odwołany',
  Canceled: 'Odwołany',
  'On time': 'Planowo',
  'On Time': 'Planowo',
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
};

export function ferryStatusPl(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  if (!t) return '';
  if (/cancel|inställ|odwoł|odwol|anul/i.test(t)) return 'Odwołany';
  return STATUS[t] ?? t;
}

export function ferryPortPl(code: string | null | undefined): string {
  const t = (code ?? '').trim();
  return PORT[t] ?? PORT[t.toUpperCase()] ?? t;
}

export function canFileOperatorNotice(role: string | null | undefined): boolean {
  return role === 'HHL_ADMIN' || role === 'CARRIER_DISPATCH';
}
