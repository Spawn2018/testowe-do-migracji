/**
 * B-1 — znaczniki pojazdów.
 * Demo: pozycja wzdłuż korytarza wg postępu statusu (makieta, z lekkim dryfem).
 * Produkcja: wyłącznie prawdziwa pozycja GPS. Brak pozycji = brak znacznika.
 */
import { positionAlongCorridor } from './corridor';

export type VehicleMarkerIn = {
  id: string;
  code: string;
  status: string;
  progress: number;
  driver: string | null;
  plate: string | null;
};

export type VehicleMarker = VehicleMarkerIn & { lat: number; lng: number };

const MOVING = ['IN_TRANSIT_PL', 'ON_FERRY', 'IN_TRANSIT_SE', 'APPROACHING_SITE'];

/** Pozycja przykładowa — tylko tryb demo. */
export function demoFleetMarkers(loads: readonly VehicleMarkerIn[], tickBump: number): VehicleMarker[] {
  return loads.map((l) => {
    const drift = MOVING.includes(l.status) ? (tickBump % 40) * 0.00012 : 0;
    const pos = positionAlongCorridor(Math.min(1, l.progress + drift));
    return { ...l, lat: pos.lat, lng: pos.lng };
  });
}

/** Produkcja: współrzędne wyłącznie z przekazanych pozycji (baza). */
export function prodFleetMarkers(
  loads: readonly VehicleMarkerIn[],
  fixes: ReadonlyMap<string, { lat: number; lng: number }>,
): VehicleMarker[] {
  const out: VehicleMarker[] = [];
  for (const l of loads) {
    const f = fixes.get(l.id);
    if (!f || !Number.isFinite(f.lat) || !Number.isFinite(f.lng)) continue;
    out.push({ ...l, lat: f.lat, lng: f.lng });
  }
  return out;
}
