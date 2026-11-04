/**
 * E49-b cz.1 (DP-206 / D-20261104-0105-01 Z3): plan sprawy SCX „Objazd czy postój?”
 * z zamknięcia drogi/mostu na dalszej trasie. Czyste funkcje — bez zapytań HERE.
 */
export type DetourCountry = 'PL' | 'SE' | 'LT' | 'LV' | 'EE' | 'FI';
export type ClosureReason = 'WIND' | 'ACCIDENT' | 'WORKS' | 'OTHER';
export type ClosureSource =
  | 'TRAFIKVERKET'
  | 'HERE'
  | 'EISMOINFO'
  | 'LVC'
  | 'TARKTEE'
  | 'DIGITRAFFIC';

export const DETOUR_RESUME_MIN = 30;
/** Promień bbox avoid[areas] wokół zamknięcia (stopnie ≈ 250 m). */
export const DETOUR_AVOID_DEG = 0.0025;

/** Dedup sprawy: jedna na transport i źródłowe zamknięcie. */
export function detourDedupKey(loadId: string, closureRef: string): string {
  const ref = closureRef.trim().replace(/\s+/g, '_').slice(0, 120);
  return `E49_DETOUR:${loadId}:${ref}`;
}

export function closureSourceOf(country: DetourCountry): ClosureSource {
  switch (country) {
    case 'SE':
      return 'TRAFIKVERKET';
    case 'PL':
      return 'HERE';
    case 'LT':
      return 'EISMOINFO';
    case 'LV':
      return 'LVC';
    case 'EE':
      return 'TARKTEE';
    case 'FI':
      return 'DIGITRAFFIC';
  }
}

/** Przyczyna z tekstu komunikatu (PL + lokalne słowa zamknięć bałtyckich / SE). */
export function classifyClosureReason(text: string | null | undefined): ClosureReason {
  const t = (text ?? '').toLowerCase();
  if (
    /wiatr|wind|vind|vėjo|veja|tuul|tuuli|storm|poryw|gust/.test(t)
  ) return 'WIND';
  if (
    /wypadek|accident|olycka|avaria|avarii|õnnetus|onnetomus|crash|collision/.test(t)
  ) return 'ACCIDENT';
  if (
    /roboty|works|arbete|road.?work|tietyö|remont|remonto|ehitus|budowa|construction/.test(t)
  ) return 'WORKS';
  return 'OTHER';
}

/** Czy tekst opisuje zamknięcie drogi/mostu (nie tylko pas / roboty obok). */
export function looksLikeRoadClosure(text: string | null | undefined, roadClosedFlag?: boolean): boolean {
  if (roadClosedFlag === true) return true;
  const t = (text ?? '').toLowerCase();
  return /zamkni[eę]t|closed|avstäng|avstang|väg(?:en)?\s+är\s+avstäng|bron\s+stäng|roadclosed|carriageway.?blocked|uždaryt|eismas\s+draudžiamas|suljet|tien\s+sulku|tie\s+suljet|ajorata\s*suljet|ceļš\s+slēg|cels\s+sleg|tee\s+sulet|sill\s+sulet/.test(
    t,
  );
}

export type HoldPlan = {
  untilIso: string | null;
  addMin: number;
  etaIso: string;
};

/**
 * Postój: do końca zamknięcia + DETOUR_RESUME_MIN; bez końca — addMin z ostatniej znanej
 * godziny dojścia do zjazdu (decideBy) do now+fallbackH (domyślnie 6 h) + resume.
 */
export function planHold(args: {
  nowIso: string;
  decideByIso: string;
  untilIso: string | null;
  baseEtaIso: string;
  resumeMin?: number;
  unknownFallbackH?: number;
}): HoldPlan {
  const resume = (args.resumeMin ?? DETOUR_RESUME_MIN) * 60_000;
  const decideBy = Date.parse(args.decideByIso);
  const baseEta = Date.parse(args.baseEtaIso);
  const now = Date.parse(args.nowIso);
  let holdEnd: number | null;
  if (args.untilIso) {
    holdEnd = Date.parse(args.untilIso) + resume;
  } else {
    holdEnd = now + (args.unknownFallbackH ?? 6) * 3600_000 + resume;
  }
  const waitMs = Math.max(0, holdEnd - decideBy);
  const addMin = Math.round(waitMs / 60_000);
  return {
    untilIso: args.untilIso ? new Date(holdEnd).toISOString() : null,
    addMin,
    etaIso: new Date(baseEta + addMin * 60_000).toISOString(),
  };
}

/** Bbox WGS84 wokół punktu zamknięcia → parametr HERE avoid[areas]. */
export function avoidBboxAround(
  lat: number,
  lon: number,
  deg = DETOUR_AVOID_DEG,
): { west: number; south: number; east: number; north: number; param: string } {
  const west = lon - deg;
  const east = lon + deg;
  const south = lat - deg;
  const north = lat + deg;
  return {
    west,
    south,
    east,
    north,
    param: `bbox:${west.toFixed(6)},${south.toFixed(6)},${east.toFixed(6)},${north.toFixed(6)}`,
  };
}

/**
 * Ryzyko zezwolenia na objeździe (Z3 / #783): zezwolenie z trasą → ostrzeżenie;
 * brak trasy w zezwoleniu → „sprawdź zezwolenie {kraj}”; kat. Firma PL → ok.
 */
export function permitDetourRisk(args: {
  country: DetourCountry;
  permitMode: 'TRASA' | 'FIRMA' | 'NONE' | 'UNKNOWN';
}): { kind: 'PERMIT'; level: 'warn' | 'ok'; text: string } {
  const kraj =
    args.country === 'PL' ? 'PL'
      : args.country === 'SE' ? 'SE'
        : args.country === 'LT' ? 'LT'
          : args.country === 'LV' ? 'LV'
            : args.country === 'EE' ? 'EE'
              : 'FI';
  if (args.permitMode === 'TRASA') {
    return {
      kind: 'PERMIT',
      level: 'warn',
      text: `objazd poza trasą w zezwoleniu ${kraj} — potrzebna zgoda wydającego`,
    };
  }
  if (args.permitMode === 'FIRMA' && args.country === 'PL') {
    return {
      kind: 'PERMIT',
      level: 'ok',
      text: 'zezwolenie kat. IV obejmuje drogi publiczne',
    };
  }
  if (args.permitMode === 'UNKNOWN') {
    return {
      kind: 'PERMIT',
      level: 'warn',
      text: `sprawdź zezwolenie ${kraj}`,
    };
  }
  return {
    kind: 'PERMIT',
    level: 'ok',
    text: `zezwolenie: transport bez warunku trasy w ${kraj} — objazd dozwolony`,
  };
}

/** Tytuł sprawy (E41 place + until). */
export function detourPlaceTitle(place: string, untilIso: string | null, timeOnly: (iso: string) => string): string {
  const until = untilIso ? `do ${timeOnly(untilIso)}` : 'bez godziny końca';
  return `${place} zamknięty ${until}`;
}
