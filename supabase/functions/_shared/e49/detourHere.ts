/**
 * E49-b cz.1 (DP-206): HERE Routing v8 truck + avoid[areas] dla objazdu wokół zamknięcia.
 * Wymiary zestawu jak H-1 / corridor-obstacles (D1).
 */
export type TruckDims = {
  lengthM: number;
  widthM: number;
  heightM: number;
  weightT: number;
  axleCount: number;
  axleLoadT: number;
};

function cm(m: number): number {
  return Math.round(m * 100);
}

export type DetourRouteArgs = {
  apiKey: string;
  /** [lat, lon] */
  origin: readonly [number, number];
  destination: readonly [number, number];
  dims: TruckDims;
  /** Parametry avoid[areas] (bbox:… / polygon:…). */
  avoidAreas?: readonly string[];
  /** Via (opcjonalnie) — punkty pośrednie. */
  via?: readonly (readonly [number, number])[];
};

/** URL Routing v8 truck z opcjonalnym omijaniem zamkniętego obszaru. */
export function buildDetourRoutingUrl(args: DetourRouteArgs): string {
  const q = new URLSearchParams();
  q.set('transportMode', 'truck');
  q.set('origin', `${args.origin[0]},${args.origin[1]}`);
  q.set('destination', `${args.destination[0]},${args.destination[1]}`);
  for (const v of args.via ?? []) {
    q.append('via', `${v[0]},${v[1]}`);
  }
  for (const a of args.avoidAreas ?? []) {
    if (a.trim()) q.append('avoid[areas]', a.trim());
  }
  q.set('return', 'polyline,summary,actions,tolls');
  q.set('spans', 'notices,names,length,streetAttributes,countryCode,stateCode,truckAttributes');
  q.set('departureTime', 'any');
  q.set('vehicle[height]', String(cm(args.dims.heightM)));
  q.set('vehicle[width]', String(cm(args.dims.widthM)));
  q.set('vehicle[length]', String(cm(args.dims.lengthM)));
  q.set('vehicle[grossWeight]', String(Math.round(args.dims.weightT * 1000)));
  q.set('vehicle[currentWeight]', String(Math.round(args.dims.weightT * 1000)));
  q.set('vehicle[axleCount]', String(args.dims.axleCount));
  q.set('vehicle[weightPerAxle]', String(Math.round(args.dims.axleLoadT * 1000)));
  q.set('lang', 'pl-PL');
  q.set('apiKey', args.apiKey);
  return `https://router.hereapi.com/v8/routes?${q.toString()}`;
}

export type HereRouteSummary = {
  lengthM: number;
  durationSec: number;
  /** notices z trasą (ograniczenia zestawu). */
  notices: string[];
};

/** Skrót odpowiedzi HERE — długość, czas, notices. Bez polyline (oszczędność). */
export function summarizeHereRoute(body: unknown): HereRouteSummary | null {
  const routes = (body as { routes?: Array<{ sections?: Array<Record<string, unknown>> }> })?.routes;
  if (!routes?.length) return null;
  let lengthM = 0;
  let durationSec = 0;
  const notices: string[] = [];
  for (const section of routes[0]?.sections ?? []) {
    const sum = section.summary as { length?: number; duration?: number } | undefined;
    if (sum?.length != null) lengthM += Number(sum.length) || 0;
    if (sum?.duration != null) durationSec += Number(sum.duration) || 0;
    const spans = section.spans as Array<{ notices?: Array<{ code?: string; title?: string }> }> | undefined;
    for (const sp of spans ?? []) {
      for (const n of sp.notices ?? []) {
        const t = [n.code, n.title].filter(Boolean).join(' ');
        if (t) notices.push(t);
      }
    }
  }
  if (lengthM <= 0 && durationSec <= 0) return null;
  return { lengthM, durationSec, notices };
}

/** Uprość linię [lat,lon] do maxN punktów (co k-ty + końce). */
export function simplifyLine(
  line: readonly (readonly [number, number])[],
  maxN = 200,
): Array<[number, number]> {
  if (line.length <= maxN) return line.map((p) => [p[0], p[1]] as [number, number]);
  const step = Math.ceil(line.length / maxN);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < line.length; i += step) {
    const p = line[i]!;
    out.push([p[0], p[1]]);
  }
  const last = line[line.length - 1]!;
  const prev = out[out.length - 1];
  if (!prev || prev[0] !== last[0] || prev[1] !== last[1]) out.push([last[0], last[1]]);
  return out;
}

/**
 * Czy notices wskazują brak trasy dla zestawu (wymiary / masa) —
 * wtedy sprawa ma `{ none: true, why }`.
 */
export function noDetourWhy(notices: readonly string[], dimsLabel: string): string | null {
  const blob = notices.join(' ').toLowerCase();
  if (!blob) return null;
  if (
    /violat|exceed|too\s+(tall|wide|long|heavy)|height|width|length|weight|axle|ogranicz|przekrocz/.test(blob)
    && /truck|vehicle|vehicleRestriction|routingFailed|noRoute|could not/i.test(blob + notices.join(' '))
  ) {
    return `Brak objazdu dla tego zestawu (${dimsLabel}) — tylko postój`;
  }
  if (/noRoute|routingFailed|could not find|brak trasy/i.test(blob)) {
    return `Brak objazdu dla tego zestawu (${dimsLabel}) — tylko postój`;
  }
  return null;
}
