/**
 * PL/SE permit classification.
 * Prefer seeded SoT from PERMIT_BY_RATE_LINE.json / PERMIT_CLASSIFICATION.md.
 * Fallback: dimensional classifier from PERMITS_PL_SE.md.
 */
import cfg from '../data/permits-config.json';
import byRate from '../data/permit-by-rate-line.json';
import type { Document, Load, LoadPermit } from '../types';

export interface SetDims {
  lengthM: number;
  widthM: number;
  heightM: number;
  weightT: number;
  fridgeBody?: boolean;
  config?: 'artic' | 'truck_trailer' | 'motor';
}

export type PlCategory = 'NORMATIVE' | 'I' | 'II' | 'III' | 'IV' | 'V' | 'IV_OR_V';
export type SePath =
  | 'BASE_OK'
  | 'TSFS_2023_36_WIDE'
  | 'TSFS_2023_37_LONG'
  | 'DISPENS_REQUIRED'
  | 'CHECK_CLEARANCE';

export interface PermitClassification {
  pl: {
    normative: boolean;
    category: PlCategory;
    categoryLabel: string;
    pilots: 0 | 1 | 2;
    reasons: string[];
    corridorHint?: string;
  };
  se: {
    path: SePath;
    pathLabel: string;
    reasons: string[];
    notes: string[];
  };
  permitFits: boolean;
  sources: { label: string; url?: string }[];
  fromRateLine?: boolean;
}

type RateLine = (typeof byRate)[number];

function seCode(path: string): SePath {
  const up = path.toUpperCase();
  if (up.startsWith('DISPENS')) return 'DISPENS_REQUIRED';
  if (path.includes('2023:36') || (up.includes('TSFS') && path.includes('36'))) return 'TSFS_2023_36_WIDE';
  if (path.includes('2023:37') || (up.includes('TSFS') && path.includes('37'))) return 'TSFS_2023_37_LONG';
  if (up.includes('NORMIE')) return 'BASE_OK';
  return 'CHECK_CLEARANCE';
}

function katFromLine(pl: RateLine['PL'], zestawW: number): { cat: PlCategory; label: string; pilots: 0 | 1 | 2 } {
  // Kratownice W=3.6 special SoT
  if (Math.abs(zestawW - 3.6) < 1e-6) {
    return {
      cat: 'IV_OR_V',
      label: 'IV (tylko odcinki A/S dwujezdniowe) / V na pozostałych',
      pilots: 1,
    };
  }
  const min = pl.min_kat;
  const status = pl.status || '';
  if (!min) {
    if (status.toUpperCase().includes('NORMATYW')) {
      return { cat: 'NORMATIVE', label: status, pilots: 0 };
    }
    return { cat: 'II', label: status || '—', pilots: 0 };
  }
  const u = min.toUpperCase();
  let cat: PlCategory = 'II';
  if (u.includes('NORMATYW')) cat = 'NORMATIVE';
  else if (u.includes('IV') && u.includes('V')) cat = 'IV_OR_V';
  else if (min.trim().startsWith('III')) cat = 'III';
  else if (min.trim().startsWith('II')) cat = 'II';
  else if (min.trim().startsWith('IV')) cat = 'IV';
  else if (min.trim().startsWith('V')) cat = 'V';
  else if (min.trim().startsWith('I')) cat = 'I';

  const pilotTxt = (pl.pilot || '').toLowerCase();
  let pilots: 0 | 1 | 2 = 0;
  if (pilotTxt.includes('2 pojazd')) pilots = 2;
  else if (pilotTxt.includes('1 pojazd')) pilots = 1;
  return { cat, label: min, pilots };
}

/** Lookup SoT row by pozycja / pcs / base EUR. */
export function lookupRateLinePermit(opts: {
  pozycja?: string | null;
  pcsPerLoad?: number | string | null;
  baseEur?: number | null;
}): RateLine | null {
  const { pozycja, pcsPerLoad, baseEur } = opts;
  const rows = byRate as RateLine[];
  if (pozycja) {
    const exact = rows.filter((r) => r.pozycja === pozycja);
    if (exact.length) {
      const byPcs = exact.find(
        (r) => pcsPerLoad != null && (r.na_transport === pcsPerLoad || String(r.na_transport) === String(pcsPerLoad)),
      );
      return byPcs ?? exact[0];
    }
  }
  if (baseEur != null) {
    for (const r of rows) {
      const cb = r.cena_bazowa_EUR;
      const bases = Array.isArray(cb) ? cb : [cb];
      if (bases.includes(baseEur)) return r;
    }
  }
  return null;
}

export function classificationFromRateLine(row: RateLine): PermitClassification {
  const z = row.zestaw;
  const isKrat = row.pozycja.includes('Kratownic') || Math.abs(z.W - 3.6) < 1e-6;
  const { cat, label, pilots } = isKrat
    ? {
        cat: 'IV_OR_V' as const,
        label: 'IV (tylko odcinki A/S dwujezdniowe) / V na pozostałych',
        pilots: 1 as const,
      }
    : katFromLine(row.PL, z.W);
  const sePath = isKrat ? ('DISPENS_REQUIRED' as const) : seCode(row.SE.path);
  const seLabel = isKrat ? 'DISPENS (väghållare)' : row.SE.path;
  return {
    pl: {
      normative: cat === 'NORMATIVE',
      category: cat,
      categoryLabel: label,
      pilots,
      reasons: [row.PL.reason || row.PL.status, ...(row.PL.over || [])].filter(Boolean) as string[],
      corridorHint: row.PL.corridor_hint,
    },
    se: {
      path: sePath,
      pathLabel: seLabel,
      reasons: [row.SE.dispens].filter(Boolean) as string[],
      notes: row.SE.notes || [],
    },
    permitFits: true,
    fromRateLine: true,
    sources: [
      { label: 'PERMIT_BY_RATE_LINE / PERMIT_CLASSIFICATION' },
      { label: 'GDDKiA nienormatywne', url: cfg.pl.urls.gddkia },
      { label: 'Transportstyrelsen odelbar last', url: cfg.se.urls.transportstyrelsen },
      { label: 'TSFS 2023:36 / 2023:37' },
    ],
  };
}

export function classificationFromLoadPermit(p: LoadPermit): PermitClassification {
  return {
    pl: {
      normative: p.plCategory === 'NORMATIVE',
      category: p.plCategory as PlCategory,
      categoryLabel: p.plCategoryLabel,
      pilots: Math.min(2, Math.max(0, p.plPilotsRequired)) as 0 | 1 | 2,
      reasons: [p.plReason || p.plStatus, ...p.plOver].filter(Boolean) as string[],
      corridorHint: p.plCorridorHint || undefined,
    },
    se: {
      path: p.sePath as SePath,
      pathLabel: p.sePathLabel || p.sePath,
      reasons: p.seDispens ? [p.seDispens] : [],
      notes: p.seNotes,
    },
    permitFits: true,
    fromRateLine: true,
    sources: [
      { label: 'PERMIT_BY_RATE_LINE / PERMIT_CLASSIFICATION' },
      { label: 'GDDKiA', url: cfg.pl.urls.gddkia },
      { label: 'Transportstyrelsen', url: cfg.se.urls.transportstyrelsen },
    ],
  };
}

function plWidthLimit(fridge?: boolean) {
  return fridge ? cfg.pl.normative.widthFridgeM : cfg.pl.normative.widthM;
}

function plLengthLimit(config: SetDims['config']) {
  if (config === 'truck_trailer') return cfg.pl.normative.lengthTruckTrailerM;
  if (config === 'motor') return cfg.pl.normative.lengthMotorM;
  return cfg.pl.normative.lengthArticM;
}

/** Dimensional fallback (PERMITS_PL_SE.md) — used when no rate-line seed. */
export function classifyPermit(set: SetDims): PermitClassification {
  // Prefer exact W=3.6 kratownice rule even in fallback
  if (Math.abs(set.widthM - 3.6) < 1e-6) {
    return {
      pl: {
        normative: false,
        category: 'IV_OR_V',
        categoryLabel: 'IV (tylko A/S dwujezdniowe) / V poza A·S',
        pilots: 1,
        reasons: ['W=3.6 m: IV do 4.0 m tylko na A/S dwujezdniowej; poza tym V', 'Pilot ×1 (W>3.2; próg ×2 to W>3.60)'],
        corridorHint: 'Na A/S dwujezdniowej możliwa IV; odcinek jednojezdniowy / poza A·S → V',
      },
      se: {
        path: 'DISPENS_REQUIRED',
        pathLabel: 'DISPENS (väghållare)',
        reasons: ['W>3.50 m → zawsze dispens'],
        notes: ['Wysokość SE: brak ogólnego limitu — skrajnia / C17'],
      },
      permitFits: true,
      sources: [
        { label: 'PERMITS_PL_SE.md' },
        { label: 'GDDKiA', url: cfg.pl.urls.gddkia },
        { label: 'TSFS 2023:36' },
      ],
    };
  }

  const reasons: string[] = [];
  const wLim = plWidthLimit(set.fridgeBody);
  const lLim = plLengthLimit(set.config ?? 'artic');
  const hLim = cfg.pl.normative.heightM;
  const overW = set.widthM > wLim;
  const overH = set.heightM > hLim;
  const overL = set.lengthM > lLim;

  if (!overW && !overH && !overL && set.weightT <= 40) {
    return {
      pl: {
        normative: true,
        category: 'NORMATIVE',
        categoryLabel: 'NORMATYWNY',
        pilots: 0,
        reasons: ['W/H/L within Dz.U. 2024 poz. 502'],
      },
      se: {
        path: set.widthM > cfg.se.base.widthM ? 'TSFS_2023_36_WIDE' : 'BASE_OK',
        pathLabel: set.widthM > cfg.se.base.widthM ? 'TSFS 2023:36' : 'W NORMIE SE',
        reasons: [],
        notes: ['SE wysokość: skrajnia trasy'],
      },
      permitFits: true,
      sources: [{ label: 'PERMITS_PL_SE.md' }],
    };
  }

  const p1 = cfg.pl.pilots.one;
  const p2 = cfg.pl.pilots.two;
  let pilots: 0 | 1 | 2 = 0;
  if (set.lengthM > p2.lengthM || set.widthM > p2.widthM || set.heightM > p2.heightM || set.weightT > p2.massT) pilots = 2;
  else if (set.lengthM > p1.lengthM || set.widthM > p1.widthM || set.heightM > p1.heightM || set.weightT > p1.massT) pilots = 1;

  let category: PlCategory = 'II';
  if (set.weightT > 60 || set.widthM > 4.0 || set.heightM > 4.3 || set.lengthM > 30) category = 'V';
  else if (set.widthM > 3.4) category = 'IV_OR_V';
  else if (set.widthM <= 3.2 && set.lengthM <= 23 && set.heightM <= 4.3) category = 'II';
  else category = 'III';

  if (overW) reasons.push(`W ${set.widthM} > ${wLim}`);
  if (overL) reasons.push(`L ${set.lengthM} > ${lLim}`);
  if (overH) reasons.push(`H ${set.heightM} > ${hLim}`);

  let sePath: SePath = 'BASE_OK';
  const seReasons: string[] = [];
  if (set.weightT > 40) {
    sePath = 'DISPENS_REQUIRED';
    seReasons.push('Nadwaga → dispens');
  } else if (set.widthM > cfg.se.tsfs.wideOnlyMaxM) {
    sePath = 'DISPENS_REQUIRED';
    seReasons.push('W>3.50 → dispens');
  } else if (set.widthM > cfg.se.base.widthM && set.lengthM <= cfg.se.base.lengthM) {
    sePath = 'TSFS_2023_36_WIDE';
  } else if (set.lengthM > cfg.se.base.lengthM && set.widthM <= cfg.se.base.widthM) {
    sePath = set.lengthM <= cfg.se.tsfs.longOnlyMaxM ? 'TSFS_2023_37_LONG' : 'DISPENS_REQUIRED';
  } else if (set.widthM > cfg.se.base.widthM && set.lengthM > cfg.se.base.lengthM) {
    sePath = 'DISPENS_REQUIRED';
    seReasons.push('W+L combined → dispens');
  }

  return {
    pl: {
      normative: false,
      category,
      categoryLabel: category,
      pilots,
      reasons,
    },
    se: {
      path: sePath,
      pathLabel: sePath,
      reasons: seReasons,
      notes: ['SE wysokość: brak ogólnego limitu ustawowego'],
    },
    permitFits: true,
    sources: [
      { label: 'PERMITS_PL_SE.md' },
      { label: 'GDDKiA', url: cfg.pl.urls.gddkia },
      { label: 'Transportstyrelsen', url: cfg.se.urls.transportstyrelsen },
    ],
  };
}

export function permitFitsCheck(
  set: SetDims,
  uploaded: { plCategory?: string | null; seDispens?: boolean | null },
  seeded?: LoadPermit | null,
): { ok: boolean; detail: string; classification: PermitClassification } {
  const c = seeded ? classificationFromLoadPermit(seeded) : classifyPermit(set);
  if (c.pl.normative && (c.se.path === 'BASE_OK' || c.se.path === 'CHECK_CLEARANCE')) {
    return { ok: true, detail: 'Zestaw w normie', classification: c };
  }
  if (uploaded.plCategory && !c.pl.normative) {
    const order = ['NORMATIVE', 'I', 'II', 'III', 'IV', 'IV_OR_V', 'V'];
    const need = order.indexOf(c.pl.category);
    const have = order.indexOf(uploaded.plCategory);
    if (have >= 0 && need >= 0 && have < need) {
      return {
        ok: false,
        detail: `Zezwolenie PL ${uploaded.plCategory} < wymagane ${c.pl.categoryLabel}`,
        classification: c,
      };
    }
  }
  if (c.se.path === 'DISPENS_REQUIRED' && uploaded.seDispens === false) {
    return { ok: false, detail: `SE wymaga dispens / ${c.se.pathLabel}`, classification: c };
  }
  return { ok: true, detail: `PL ${c.pl.categoryLabel} · SE ${c.se.pathLabel}`, classification: c };
}

export function setDimsFromLoad(
  resources: {
    setLengthM: number | null;
    setWidthM: number | null;
    setHeightM: number | null;
    setWeightT: number | null;
  },
  cargo: { lengthM: number; widthM: number; heightM: number; weightT: number },
): SetDims {
  return {
    lengthM: resources.setLengthM ?? cargo.lengthM + 1.2,
    widthM: resources.setWidthM ?? Math.max(cargo.widthM, 2.55),
    heightM: resources.setHeightM ?? Math.max(cargo.heightM, 2.5),
    weightT: resources.setWeightT ?? cargo.weightT + 14,
    config: 'artic',
  };
}

export const PERMIT_SOURCES = cfg;

/** Permit attachment document for cover() — PERMIT_ATTACHMENT_RULES.md */
export type PermitAttachmentKind = 'PERIOD' | 'TRIP' | 'REGULATION' | 'NONE';

export interface PermitAttachmentDoc {
  id: string;
  kind: PermitAttachmentKind;
  country: 'PL' | 'SE';
  validFrom?: string | null; // ISO date
  validTo?: string | null;
  plates?: string[];
  routeCompatible?: boolean;
  limits?: { L?: number; W?: number; H?: number; masa_max_t?: number };
  linkedLoadIds?: string[];
  windowId?: string | null;
  checklistComplete?: boolean;
}

export interface CoverLoadInput {
  id: string;
  loadDate: string; // YYYY-MM-DD
  plates?: { tractor?: string | null; trailer?: string | null };
  set: SetDims;
  routeHint?: string | null;
}

function dateInRange(d: string, from?: string | null, to?: string | null): boolean {
  if (!from && !to) return true;
  const x = d.slice(0, 10);
  if (from && x < from.slice(0, 10)) return false;
  if (to && x > to.slice(0, 10)) return false;
  return true;
}

function withinLimits(set: SetDims, lim?: PermitAttachmentDoc['limits']): boolean {
  if (!lim) return true;
  if (lim.L != null && set.lengthM > lim.L + 1e-6) return false;
  if (lim.W != null && set.widthM > lim.W + 1e-6) return false;
  if (lim.H != null && set.heightM > lim.H + 1e-6) return false;
  if (lim.masa_max_t != null && set.weightT > lim.masa_max_t + 1e-6) return false;
  return true;
}

function platesMatch(doc: PermitAttachmentDoc, load: CoverLoadInput): boolean {
  if (!doc.plates || doc.plates.length === 0) return true;
  const have = [load.plates?.tractor, load.plates?.trailer].filter(Boolean).map((p) => String(p).toUpperCase());
  if (!have.length) return false;
  return doc.plates.some((p) => have.includes(p.toUpperCase()));
}

/**
 * cover(doc, load) per PERMIT_ATTACHMENT_RULES.md
 * PERIOD: date ∈ [from,to] AND set ≤ limits AND plates/route if set
 * TRIP: explicit load_id (or window_id) link required
 * REGULATION / NONE: no permit file — REGULATION needs checklist before READY
 */
export function cover(doc: PermitAttachmentDoc, load: CoverLoadInput): { covered: boolean; reason: string } {
  if (doc.kind === 'NONE') {
    return { covered: true, reason: 'Brak wymogu pliku zezwolenia' };
  }
  if (doc.kind === 'REGULATION') {
    if (doc.checklistComplete) return { covered: true, reason: 'TSFS checklist OK' };
    return { covered: false, reason: 'REGULATION — checklista niekompletna' };
  }
  if (doc.kind === 'TRIP') {
    const linked = doc.linkedLoadIds?.includes(load.id) || (doc.windowId != null && doc.windowId.length > 0);
    if (!linked) return { covered: false, reason: 'TRIP — brak linku load_id / window_id' };
    if (!dateInRange(load.loadDate, doc.validFrom, doc.validTo)) {
      return { covered: false, reason: 'TRIP — data poza oknem' };
    }
    if (!platesMatch(doc, load)) return { covered: false, reason: 'TRIP — nr rej. niezgodne' };
    if (!withinLimits(load.set, doc.limits)) return { covered: false, reason: 'TRIP — zestaw poza limitami' };
    return { covered: true, reason: 'TRIP pokrywa transport' };
  }
  // PERIOD
  if (!dateInRange(load.loadDate, doc.validFrom, doc.validTo)) {
    return { covered: false, reason: 'PERIOD — data poza ważnością' };
  }
  if (!withinLimits(load.set, doc.limits)) {
    return { covered: false, reason: 'PERIOD — zestaw poza limitami dokumentu' };
  }
  if (!platesMatch(doc, load)) return { covered: false, reason: 'PERIOD — nr rej. nie pasują' };
  if (doc.routeCompatible === false) return { covered: false, reason: 'PERIOD — trasa niekompatybilna' };
  return { covered: true, reason: 'PERIOD auto-pokrycie' };
}

export function daysUntilExpiry(validTo?: string | null, today = '2026-09-23'): number | null {
  if (!validTo) return null;
  const a = Date.parse(today.slice(0, 10));
  const b = Date.parse(validTo.slice(0, 10));
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}


/** Build PermitAttachmentDoc from load + uploaded docs (makieta). */
export function attachmentDocForLoad(load: Load, docs: Document[]): PermitAttachmentDoc {
  const kind = (load.permit?.attachmentKind ?? 'NONE') as PermitAttachmentKind;
  const permitDoc = docs.find(
    (d) => d.loadId === load.id && (d.category === 'PERMIT_PL' || d.category === 'PERMIT_SE'),
  );
  const uploaded = permitDoc?.status === 'UPLOADED' || permitDoc?.status === 'MISMATCH';
  const mismatch = permitDoc?.status === 'MISMATCH' || permitDoc?.permitFits === false;
  const limits = load.permit
    ? {
        L: load.permit.zestaw.L,
        W: load.permit.zestaw.W,
        H: load.permit.zestaw.H,
        masa_max_t: load.permit.zestaw.masa_max_t,
      }
    : undefined;
  return {
    id: permitDoc?.id ?? `att-${load.id}`,
    kind,
    country: 'PL',
    validFrom: kind === 'NONE' ? null : '2026-01-01',
    validTo: kind === 'PERIOD' ? '2026-12-31' : kind === 'TRIP' ? '2026-10-15' : null,
    limits,
    // TRIP requires explicit link — only when UPLOADED (not MISSING)
    linkedLoadIds: kind === 'TRIP' && uploaded && !mismatch ? [load.id] : [],
    checklistComplete: kind === 'REGULATION' ? uploaded : undefined,
    plates: [],
    routeCompatible: mismatch ? false : true,
  };
}

export function evaluateLoadCover(load: Load, docs: Document[]): { covered: boolean; reason: string; kind: PermitAttachmentKind } {
  const kind = (load.permit?.attachmentKind ?? 'NONE') as PermitAttachmentKind;
  // MISMATCH / permitFits=false always wins — even when attachmentKind is NONE
  // (avoids cover(NONE)·OK contradicting a seeded MISMATCH doc).
  const bad = docs.find(
    (d) =>
      d.loadId === load.id &&
      (d.status === 'MISMATCH' || d.permitFits === false),
  );
  if (bad) {
    return { covered: false, reason: 'zezwolenie nie pasuje do wymiarów', kind };
  }
  const doc = attachmentDocForLoad(load, docs);
  const set = setDimsFromLoad(load.resources, load.dims);
  const cov = cover(doc, {
    id: load.id,
    loadDate: load.plannedLoadDate,
    plates: { tractor: load.resources.tractorPlate, trailer: load.resources.trailerPlate },
    set,
  });
  return { ...cov, kind };
}

/** READY blocked when cover gap / mismatch / permitFits false / docMissing. */
export function isReadyBlocked(load: Load, docs: Document[]): { blocked: boolean; reason: string } {
  if (load.docMissing) return { blocked: true, reason: 'docMissing flag' };
  if (load.permitFits === false) return { blocked: true, reason: 'permitFits=false' };
  const mismatch = docs.find(
    (d) =>
      d.loadId === load.id &&
      (d.status === 'MISMATCH' || d.permitFits === false),
  );
  if (mismatch) {
    return {
      blocked: true,
      reason: mismatch.status === 'MISMATCH' ? 'MISMATCH document' : 'permitFits=false',
    };
  }
  const cov = evaluateLoadCover(load, docs);
  if (!cov.covered) return { blocked: true, reason: cov.reason };
  return { blocked: false, reason: cov.reason };
}
