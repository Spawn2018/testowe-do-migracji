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

/* ---------- przegląd 18.10 (B2): ten sam kierowca, ciągnik albo naczepa nie jedzie w dwóch transportach naraz ---------- */

/** Dodatkowi kierowcy demo (osoby zmyślone, numery z pul fikcyjnych: PL +48 000 000 0xx, SE +46 70 174 06 xx). */
const EXTRA_DRIVERS: ReadonlyArray<{ name: string; phone: string }> = [
  { name: 'Grzegorz Kaczmarek', phone: '+48000000016' },
  { name: 'Wojciech Piotrowicz', phone: '+48000000017' },
  { name: 'Mariusz Dąbrowski', phone: '+48000000018' },
  { name: 'Robert Pawlak', phone: '+48000000019' },
  { name: 'Dariusz Michalski', phone: '+48000000020' },
  { name: 'Kamil Zając', phone: '+48000000021' },
  { name: 'Artur Król', phone: '+48000000022' },
  { name: 'Sławomir Wieczorek', phone: '+48000000023' },
  { name: 'Damian Jabłoński', phone: '+48000000024' },
  { name: 'Przemysław Wróbel', phone: '+48000000025' },
  { name: 'Konrad Nowicki', phone: '+48000000026' },
  { name: 'Hubert Majewski', phone: '+48000000027' },
  { name: 'Norbert Olszewski', phone: '+48000000028' },
  { name: 'Radosław Stępień', phone: '+48000000029' },
  { name: 'Waldemar Malinowski', phone: '+48000000030' },
  { name: 'Zbigniew Jaworski', phone: '+48000000031' },
  { name: 'Ireneusz Adamczyk', phone: '+48000000032' },
  { name: 'Leszek Dudek', phone: '+48000000033' },
  { name: 'Patryk Nowakowski', phone: '+48000000034' },
  { name: 'Cezary Pietrzak', phone: '+48000000035' },
  { name: 'Gustav Lindqvist', phone: '+46701740616' },
  { name: 'Viktor Sandberg', phone: '+46701740617' },
  { name: 'Emil Forsberg', phone: '+46701740618' },
  { name: 'Axel Hedlund', phone: '+46701740619' },
  { name: 'Oskar Nyström', phone: '+46701740620' },
  { name: 'Linus Ekström', phone: '+46701740621' },
  { name: 'Hampus Sjöberg', phone: '+46701740622' },
  { name: 'Filip Wallin', phone: '+46701740623' },
  { name: 'Sixten Lundgren', phone: '+46701740624' },
  { name: 'Elias Bergström', phone: '+46701740625' },
];

const EXTRA_TRACTORS: readonly string[] = [
  'PO 1R118', 'PO 2R229', 'GS 3R331', 'GS 4R442', 'WZ 5R553', 'WZ 6R664', 'KR 7R775', 'KR 8R886', 'DW 9R997', 'DW 1S108',
  'LU 2S219', 'LU 3S321', 'CT 4S432', 'CT 5S543', 'NE 6S654', 'NE 7S765', 'BDA 214', 'CHL 325', 'DKT 436', 'EFR 547',
  'GLN 658', 'HMS 769', 'JRT 871', 'KVB 982', 'LXD 193', 'MZP 204', 'NRA 315', 'OSB 426', 'PTC 537', 'RUD 648',
];

const EXTRA_TRAILERS: readonly string[] = [
  'PO 1W118', 'PO 2W229', 'GS 3W331', 'GS 4W442', 'WZ 5W553', 'WZ 6W664', 'KR 7W775', 'KR 8W886', 'DW 9W997', 'DW 1X108',
  'LU 2X219', 'LU 3X321', 'CT 4X432', 'CT 5X543', 'NE 6X654', 'NE 7X765', 'BDA 81V', 'CHL 92V', 'DKT 13V', 'EFR 24V',
  'GLN 35V', 'HMS 46V', 'JRT 57V', 'KVB 68V', 'LXD 79V', 'MZP 81W', 'NRA 92W', 'OSB 13W', 'PTC 24W', 'RUD 35W',
];

type DeconflictLoad = {
  code: string;
  status: string;
  plannedLoadDate: string;
  plannedDeliverDate: string;
  unloadedAt?: string | null;
  resources: { driverName: string | null; driverPhone: string | null; tractorPlate: string | null; trailerPlate: string | null };
};

const DAY_MS = 864e5;
/** Powrót z Boden do Śremu i odpoczynek — kierowca i zestaw wolne dopiero po tym czasie. */
const RETURN_DAYS = 3;
/** Kolejność pierwszeństwa: transporty w drodze i na placu zachowują swój zestaw (to je widać w Kokpicie i na Mapie). */
const PRIORITY: Record<string, number> = {
  APPROACHING_SITE: 0, IN_TRANSIT_SE: 0, AT_PORT_SE: 0, ON_FERRY: 0, AT_PORT: 0, IN_TRANSIT_PL: 0, LOADING: 0,
  DELAYED: 0, SILENT: 0, UNLOADING: 1, DELIVERED: 2, READY_TO_INVOICE: 2, INVOICED: 2,
};

/**
 * Przydział zestawu bez nakładania się w czasie: okres zajęcia = dzień załadunku … rozładunek (albo dzień dostawy) + 3 dni.
 * Transport, którego kierowca, ciągnik albo naczepa jest już zajęty w tym okresie, dostaje wolny z puli dodatkowej.
 * Deterministyczne (te same dane przy każdym starcie demo).
 */
export function deconflictResources<T extends DeconflictLoad>(loads: readonly T[]): T[] {
  const span = (l: T): [number, number] => {
    const start = Date.parse(`${l.plannedLoadDate}T00:00:00+02:00`);
    const end = l.unloadedAt ? Date.parse(l.unloadedAt) : Date.parse(`${l.plannedDeliverDate}T23:59:00+02:00`);
    return [start, end + RETURN_DAYS * DAY_MS];
  };
  const busy = new Map<string, Array<[number, number]>>();
  const free = (key: string, [a, b]: [number, number]) => !(busy.get(key) ?? []).some(([c, d]) => a <= d && c <= b);
  const take = (key: string, s: [number, number]) => busy.set(key, [...(busy.get(key) ?? []), s]);
  const order = [...loads.keys()].sort((i, j) => {
    const a = loads[i]; const b = loads[j];
    const pa = PRIORITY[a.status] ?? 3; const pb = PRIORITY[b.status] ?? 3;
    return pa - pb || a.plannedLoadDate.localeCompare(b.plannedLoadDate) || a.code.localeCompare(b.code, 'pl', { numeric: true });
  });
  const out = [...loads];
  for (const i of order) {
    const l = loads[i];
    if (l.status === 'CANCELLED') continue;
    const s = span(l);
    const r = { ...l.resources };
    if (r.driverName) {
      if (!free(`d:${r.driverName}`, s)) {
        const d = [...SEED_DRIVERS, ...EXTRA_DRIVERS].find((x) => free(`d:${x.name}`, s));
        if (d) { r.driverName = d.name; r.driverPhone = d.phone; }
      }
      take(`d:${r.driverName}`, s);
    }
    if (r.tractorPlate) {
      if (!free(`t:${r.tractorPlate}`, s)) r.tractorPlate = [...SEED_TRACTORS, ...EXTRA_TRACTORS].find((x) => free(`t:${x}`, s)) ?? r.tractorPlate;
      take(`t:${r.tractorPlate}`, s);
    }
    if (r.trailerPlate) {
      if (!free(`n:${r.trailerPlate}`, s)) r.trailerPlate = [...SEED_TRAILERS, ...EXTRA_TRAILERS].find((x) => free(`n:${x}`, s)) ?? r.trailerPlate;
      take(`n:${r.trailerPlate}`, s);
    }
    out[i] = { ...l, resources: { ...l.resources, ...r } };
  }
  return out;
}
