/**
 * wyglad/W-dane — E45 pkt 1 (decyzja 07.10.2026, 22:15; L56): przeprawy promowe na mapie mają się pokrywać z trasami
 * promów HERE. Serwer (P9, pozycja E45) dopisuje do `map_display_state` pole `ferries` — odcinki promowe z odpowiedzi
 * HERE Routing (`sections[].transport.mode = 'ferry'`), każdy jako `{ leg: 'FERRY-GDN-NYN' | 'FERRY-GDY-KAA',
 * points: [[szer., dł.], …] }`. Widok przyjmuje odcinek tylko wtedy, gdy zaczyna się i kończy przy właściwych portach
 * (do 10 km, w dowolnym kierunku), nie ma dziury (krok ≤ 150 km) i ma rozsądną długość (1,0–1,6 raza prostej). Bez danych albo przy złej geometrii zostają stałe tory wodne
 * (`WATER_GDN_NYN`, `WATER_GDY_KAA`) — dzisiejszy rysunek.
 */
import { haversineKm, lineLengthKm, maxSegmentKm, type LatLng } from './draw';
import { routeByCode, type WaterTrackId } from '../ferryCatalog';

export type FerryLeg = 'FERRY-GDN-NYN' | 'FERRY-GDY-KAA';

interface Port { lat: number; lng: number }
const PORTS: Record<FerryLeg, readonly [Port, Port]> = {
  /* Gdańsk (Westerplatte, Polferries) — Nynäshamn */
  'FERRY-GDN-NYN': [{ lat: 54.4, lng: 18.67 }, { lat: 58.9, lng: 17.95 }],
  /* Gdynia (Stena Line) — Karlskrona (Verkö) */
  'FERRY-GDY-KAA': [{ lat: 54.533, lng: 18.54 }, { lat: 56.15, lng: 15.62 }],
};

/** Koniec odcinka do 10 km od terminalu (Gdańsk i Gdynia dzieli 17 km — odcinek nie może pomylić portów). */
const PORT_KM = 10;
/** Długość odcinka wobec prostej między portami: od 1,0 do 1,6 raza. */
const MIN_RATIO = 1;
const MAX_RATIO = 1.6;
/** Najdłuższy krok między punktami — dłuższy oznacza dziurę w geometrii (na otwartym morzu HERE daje długie proste). */
const MAX_STEP_KM = 150;

/** Powód odrzucenia odcinka (do sprawdzenia na TEST, L56); null = odcinek dobry. */
export function ferryLineWhy(leg: FerryLeg, line: readonly LatLng[]): string | null {
  if (line.length < 2) return 'brak punktów';
  const [a, b] = PORTS[leg];
  const first = line[0];
  const last = line[line.length - 1];
  const near = (p: LatLng, port: Port) => haversineKm(p[0], p[1], port.lat, port.lng) <= PORT_KM;
  const ends = (near(first, a) && near(last, b)) || (near(first, b) && near(last, a));
  if (!ends) return `końce dalej niż ${PORT_KM} km od portów`;
  const step = maxSegmentKm(line);
  if (step > MAX_STEP_KM) return `krok ${Math.round(step)} km (dziura w geometrii)`;
  const straight = haversineKm(a.lat, a.lng, b.lat, b.lng);
  const len = lineLengthKm(line);
  if (len < straight * MIN_RATIO || len > straight * MAX_RATIO) return `długość ${Math.round(len)} km przy ${Math.round(straight)} km prostej`;
  return null;
}

/** Czy linia łączy porty odcinka (w jednym albo drugim kierunku) i ma rozsądną długość. */
export function ferryLineOk(leg: FerryLeg, line: readonly LatLng[]): boolean {
  return ferryLineWhy(leg, line) === null;
}

/** Odcinki promowe z `map_display_state.ferries`, które przeszły sprawdzenie (najwyżej jeden na przeprawę). */
export function acceptedFerries(rows: unknown): { leg: FerryLeg; line: LatLng[] }[] {
  return checkFerries(rows).accepted;
}

/**
 * Wynik sprawdzenia: przyjęte odcinki i powody odrzucenia. Mapa zapisuje skrót w `data-ferries` elementu mapy
 * (np. „FERRY-GDN-NYN: HERE · FERRY-GDY-KAA: tor — krok 210 km”), żeby na TEST było widać, czemu został stały tor.
 */
export function checkFerries(rows: unknown): { accepted: { leg: FerryLeg; line: LatLng[] }[]; rejected: { leg: string; why: string }[] } {
  const rejected: { leg: string; why: string }[] = [];
  if (!Array.isArray(rows)) return { accepted: [], rejected };
  const out: { leg: FerryLeg; line: LatLng[] }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const leg = String((row as { leg?: unknown }).leg ?? '') as FerryLeg;
    if (!(leg in PORTS) || out.some((x) => x.leg === leg)) continue;
    const points = (row as { points?: unknown }).points;
    if (!Array.isArray(points)) { rejected.push({ leg, why: 'brak punktów' }); continue; }
    const line: LatLng[] = [];
    for (const p of points) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const lat = Number(p[0]);
      const lng = Number(p[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) line.push([lat, lng]);
    }
    const why = ferryLineWhy(leg, line);
    if (why) rejected.push({ leg, why });
    else out.push({ leg, line });
  }
  return { accepted: out, rejected };
}

/** Skrót do `data-ferries`: każda przeprawa — „HERE” albo „tor” z powodem. */
export function ferrySummary(r: ReturnType<typeof checkFerries>): string {
  return (Object.keys(PORTS) as FerryLeg[])
    .map((leg) => {
      if (r.accepted.some((a) => a.leg === leg)) return `${leg}: HERE`;
      const why = r.rejected.find((x) => x.leg === leg)?.why;
      return `${leg}: tor${why ? ` — ${why}` : ''}`;
    })
    .join(' · ');
}

/* ---------- BN9-a: tory wodne nowych przepraw (Estonia ⇄ Finlandia / Szwecja) ---------- */

/** Tory nowych przepraw (id z katalogu promów); GDN-NYN i GDY-KAA rysuje dalej `mapPool` z `WATER_*` ([dł., szer.]). */
export type ExtraWaterTrack = Exclude<WaterTrackId, 'GDN-NYN' | 'GDY-KAA'>;

/**
 * Tory wodne [szer., dł.] — od terminalu wyjazdowego do docelowego, po wodzie (nie są geometrią HERE). Ten sam styl
 * linii co `WATER_GDN_NYN` / `WATER_GDY_KAA`. Rysowane tylko, gdy trasę ma widoczny transport (dziś żaden — mapa bez zmian).
 */
export const WATER_TRACKS_EXTRA: Record<ExtraWaterTrack, readonly LatLng[]> = {
  /* Tallinn (Vanasadam) → zatoka tallińska między Naissaar i Aegna → Zatoka Fińska → tor Länsisatama → West Harbour T2 */
  'TLL-HEL': [
    [59.443, 24.77], [59.475, 24.75], [59.52, 24.7], [59.62, 24.72], [59.75, 24.8], [59.88, 24.87],
    [60.0, 24.9], [60.08, 24.93], [60.105, 24.93], [60.125, 24.905], [60.14, 24.9], [60.153, 24.915],
  ],
  /* Muuga (HHLA TK) → zatoka Muuga → na zachód od Prangli i Keri → Zatoka Fińska → tor Vuosaari od południowego wschodu */
  'MUU-VUO': [
    [59.497, 24.96], [59.53, 24.94], [59.6, 24.9], [59.7, 24.95], [59.85, 25.05], [59.97, 25.15],
    [60.08, 25.24], [60.14, 25.245], [60.175, 25.22], [60.195, 25.2], [60.206, 25.19],
  ],
  /* Tallinn → między Naissaar i Aegna, na północ od Naissaar → Zatoka Fińska na zachód (między Hanko a Osmussaar, na
     południe od Bengtskär, Utö i Kökar) → Mariehamn (Västerhamn) → Morze Alandzkie → Söderarm → Furusund → Vaxholm →
     Lidingö → Värtahamnen */
  'TLL-STO': [
    [59.443, 24.77], [59.475, 24.75], [59.52, 24.7], [59.63, 24.62], [59.64, 24.3], [59.63, 24.0], [59.62, 23.4],
    [59.65, 22.7], [59.66, 22.0], [59.7, 21.4], [59.78, 20.8], [59.92, 20.3], [59.96, 20.02], [60.0, 19.9],
    [60.05, 19.905], [60.093, 19.925], [60.04, 19.86], [59.86, 19.56], [59.775, 19.45], [59.72, 19.2],
    [59.665, 18.93], [59.6, 18.84], [59.53, 18.7], [59.46, 18.52], [59.415, 18.4], [59.385, 18.3], [59.36, 18.2],
    [59.35, 18.105],
  ],
  /* Paldiski (port południowy) → zatoka Paldiski → na północ od półwyspu Pakri → zachód Zatoki Fińskiej (na południe od
     Bengtskär) → Bałtyk na południe od Wysp Alandzkich → Söderarm → Kapellskär */
  'PLD-KPS': [
    [59.335, 24.083], [59.37, 24.1], [59.43, 24.06], [59.5, 23.6], [59.55, 22.9], [59.6, 22.1], [59.62, 21.3],
    [59.65, 20.5], [59.68, 19.95], [59.715, 19.55], [59.735, 19.35], [59.73, 19.2], [59.721, 19.065],
  ],
};

/** Tory nowych przepraw dla użytych tras (np. trasy rejsów widocznych transportów); dzisiejsze trasy — pusto. */
export function extraWaterTracksFor(routes: Iterable<string | null | undefined>): { id: ExtraWaterTrack; line: readonly LatLng[] }[] {
  const ids = new Set<ExtraWaterTrack>();
  for (const code of routes) {
    const track = routeByCode(code)?.waterTrack;
    if (track && track in WATER_TRACKS_EXTRA) ids.add(track as ExtraWaterTrack);
  }
  return [...ids].map((id) => ({ id, line: WATER_TRACKS_EXTRA[id] }));
}
