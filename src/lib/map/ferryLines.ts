/**
 * wyglad/W-dane — E45 pkt 1 (decyzja 07.10.2026, 22:15; L56): przeprawy promowe na mapie mają się pokrywać z trasami
 * promów HERE. Serwer (P9, pozycja E45) dopisuje do `map_display_state` pole `ferries` — odcinki promowe z odpowiedzi
 * HERE Routing (`sections[].transport.mode = 'ferry'`), każdy jako `{ leg: 'FERRY-GDN-NYN' | 'FERRY-GDY-KAA',
 * points: [[szer., dł.], …] }`. Widok przyjmuje odcinek tylko wtedy, gdy zaczyna się i kończy przy właściwych portach
 * (do 10 km, w dowolnym kierunku), nie ma dziury (krok ≤ 150 km) i ma rozsądną długość (1,0–1,6 raza prostej). Bez danych albo przy złej geometrii zostają stałe tory wodne
 * (`WATER_GDN_NYN`, `WATER_GDY_KAA`) — dzisiejszy rysunek.
 */
import { haversineKm, lineLengthKm, maxSegmentKm, type LatLng } from './draw';

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
