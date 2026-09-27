/** Deterministic PL/LT/SE people, E.164 phones, plates — shared by loads.json + seed extras. */

export const SEED_DRIVERS: ReadonlyArray<{ name: string; phone: string }> = [
  { name: 'Marek Kowalski', phone: '+48000000001' },
  { name: 'Piotr Wiśniewski', phone: '+48000000002' },
  { name: 'Tomasz Wójcik', phone: '+48000000003' },
  { name: 'Andrzej Kamiński', phone: '+48000000004' },
  { name: 'Paweł Lewandowski', phone: '+48000000005' },
  { name: 'Krzysztof Zieliński', phone: '+48000000006' },
  { name: 'Marcin Szymański', phone: '+48000000007' },
  { name: 'Łukasz Woźniak', phone: '+48000000008' },
  { name: 'Jakub Kozłowski', phone: '+48000000009' },
  { name: 'Adam Jankowski', phone: '+48000000010' },
  { name: 'Michał Mazur', phone: '+48000000011' },
  { name: 'Rafał Krawczyk', phone: '+48000000012' },
  { name: 'Sebastian Piotrowski', phone: '+48000000013' },
  { name: 'Bartosz Grabowski', phone: '+48000000014' },
  { name: 'Dawid Nowak', phone: '+48000000015' },
  { name: 'Jonas Petrauskas', phone: '+37000000001' },
  { name: 'Andrius Kazlauskas', phone: '+37000000002' },
  { name: 'Mantas Jankauskas', phone: '+37000000003' },
  { name: 'Tomas Stankevičius', phone: '+37000000004' },
  { name: 'Vytautas Paulauskas', phone: '+37000000005' },
  { name: 'Erik Andersson', phone: '+46701740605' },
  { name: 'Lars Johansson', phone: '+46701740606' },
  { name: 'Johan Nilsson', phone: '+46701740607' },
  { name: 'Anders Eriksson', phone: '+46701740608' },
  { name: 'Per Svensson', phone: '+46701740609' },
  { name: 'Karl Gustafsson', phone: '+46701740610' },
  { name: 'Mikael Persson', phone: '+46701740611' },
  { name: 'Oskar Lindberg', phone: '+46701740612' },
  { name: 'Nils Holm', phone: '+46701740613' },
  { name: 'Fredrik Berg', phone: '+46701740614' },
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
