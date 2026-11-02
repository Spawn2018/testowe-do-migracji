/**
 * BN9-c5 F7 r2 #740 (R2-W1): programowe ruchy mapy (`fitBounds`, `setView`, `setMaxZoom`) oznaczone na czas wywołania.
 * Leaflet wysyła zdarzenia (`zoomstart`, `movestart`…) synchronicznie, więc znacznik obejmuje cały łańcuch zdarzeń.
 * Licznik (nie flaga) — zagnieżdżone wywołania nie zdejmują znacznika za wcześnie. Bez Leaflet — mały moduł bez cykli
 * importu (`mapPool`, `applyBasemap`, `fallbackTiles`, `CorridorMap`).
 */
const depth = new WeakMap<object, number>();

/** Wykonuje `fn` jako ruch programowy tej mapy (nie ruch użytkownika). */
export function programmatic<T>(map: object, fn: () => T): T {
  depth.set(map, (depth.get(map) ?? 0) + 1);
  try {
    return fn();
  } finally {
    const d = (depth.get(map) ?? 1) - 1;
    if (d > 0) depth.set(map, d);
    else depth.delete(map);
  }
}

/** Czy trwa teraz ruch programowy tej mapy. */
export function isProgrammatic(map: object): boolean {
  return (depth.get(map) ?? 0) > 0;
}
