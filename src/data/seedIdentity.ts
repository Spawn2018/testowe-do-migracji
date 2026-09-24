/** Deterministic PL/LT/SE people, E.164 phones, plates — shared by loads.json + seed extras. */

export const SEED_DRIVERS: ReadonlyArray<{ name: string; phone: string }> = [
  { name: 'Marek Kowalski', phone: '+48601234821' },
  { name: 'Piotr Wiśniewski', phone: '+48502341756' },
  { name: 'Tomasz Wójcik', phone: '+48603458219' },
  { name: 'Andrzej Kamiński', phone: '+48504569320' },
  { name: 'Paweł Lewandowski', phone: '+48605671432' },
  { name: 'Krzysztof Zieliński', phone: '+48506782543' },
  { name: 'Marcin Szymański', phone: '+48607893654' },
  { name: 'Łukasz Woźniak', phone: '+48508914765' },
  { name: 'Jakub Kozłowski', phone: '+48609025876' },
  { name: 'Adam Jankowski', phone: '+48500136987' },
  { name: 'Michał Mazur', phone: '+48601247098' },
  { name: 'Rafał Krawczyk', phone: '+48502358109' },
  { name: 'Sebastian Piotrowski', phone: '+48603469210' },
  { name: 'Bartosz Grabowski', phone: '+48504570321' },
  { name: 'Dawid Nowak', phone: '+48605681432' },
  { name: 'Jonas Petrauskas', phone: '+37061234567' },
  { name: 'Andrius Kazlauskas', phone: '+37062345678' },
  { name: 'Mantas Jankauskas', phone: '+37063456789' },
  { name: 'Tomas Stankevičius', phone: '+37064567890' },
  { name: 'Vytautas Paulauskas', phone: '+37065678901' },
  { name: 'Erik Andersson', phone: '+46701234567' },
  { name: 'Lars Johansson', phone: '+46702345678' },
  { name: 'Johan Nilsson', phone: '+46703456789' },
  { name: 'Anders Eriksson', phone: '+46704567890' },
  { name: 'Per Svensson', phone: '+46705678901' },
  { name: 'Karl Gustafsson', phone: '+46706789012' },
  { name: 'Mikael Persson', phone: '+46707890123' },
  { name: 'Oskar Lindberg', phone: '+46708901234' },
  { name: 'Nils Holm', phone: '+46709012345' },
  { name: 'Fredrik Berg', phone: '+46700123456' },
];

export const SEED_TRACTORS = [
  'PO 3K821', 'PO 5S147', 'GS 4821A', 'GS 5912B', 'WZ 2341C', 'WZ 3482D',
  'KR 7A291', 'KR 8B302', 'DW 1C413', 'DW 2D524', 'LU 3E635', 'LU 4F746',
  'CT 5G857', 'CT 6H968', 'NE 7J179', 'NE 8K280',
  'KNB 12C', 'PJD 34E', 'WRT 56G', 'XFA 78H', 'YBG 90J', 'ZCK 11K',
  'MHL 22L', 'NJT 33M', 'RKP 44N', 'SLV 55P',
  'JNA 482', 'KOB 591', 'LPD 603', 'MRE 714', 'NSF 825', 'OTG 936',
] as const;

export const SEED_TRAILERS = [
  'PO 8T201', 'PO 9T312', 'GS 1N423', 'GS 2N534', 'WZ 3N645', 'WZ 4N756',
  'KR 5N867', 'KR 6N978', 'DW 7N189', 'DW 8N290', 'LU 9N301', 'LU 1N412',
  'KNB 67T', 'PJD 78T', 'WRT 89T', 'XFA 90T', 'YBG 12U', 'ZCK 23U',
  'JNA 201', 'KOB 312', 'LPD 423', 'MRE 534', 'NSF 645', 'OTG 756',
  'CT 2P867', 'CT 3P978', 'NE 4P189', 'NE 5P290', 'PO 6P301', 'GS 7P412',
] as const;

export const SEED_ESCORTS = [
  'PO 1P501', 'PO 2P612', 'GS 3P723', 'WZ 4P834', 'KR 5P945', 'DW 6P156',
  'KNB 81E', 'PJD 92E', 'JNA 501', 'KOB 612', 'LU 7P267', 'CT 8P378',
] as const;

/** KSH / HHL / SCX order numbers in demo-stable formats. */
export function seedOrders(sequenceOrder: number) {
  const seq = sequenceOrder;
  return {
    orderNo: `KSH/2026/${(1000 + seq).toString().padStart(4, '0')}`,
    hhlOrderNo: `HHL/2026/${1240 + seq}`,
    carrierOrderNo: `SCX-26-${(8000 + seq).toString().padStart(4, '0')}`,
  };
}

export function seedResourcesForIndex(
  index: number,
  opts: { pending?: boolean; escort?: boolean } = {},
) {
  if (opts.pending) {
    return {
      driverName: null as string | null,
      driverPhone: null as string | null,
      tractorPlate: null as string | null,
      trailerPlate: null as string | null,
      escortPlate: null as string | null,
    };
  }
  const d = SEED_DRIVERS[index % SEED_DRIVERS.length];
  return {
    driverName: d.name,
    driverPhone: d.phone,
    tractorPlate: SEED_TRACTORS[index % SEED_TRACTORS.length] as string,
    trailerPlate: SEED_TRAILERS[index % SEED_TRAILERS.length] as string,
    escortPlate: opts.escort ? (SEED_ESCORTS[index % SEED_ESCORTS.length] as string) : null,
  };
}
