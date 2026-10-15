/**
 * E44 pkt 8 / D-20261014-0640-01 H4 / D-20261014-1320-01 K2.1 —
 * klucz RIO (`secret`) nie trafia do zdarzeń ani payloadu klienta.
 * Pełny link z kluczem zapisuje wyzwalacz bazy → `rio_secret` + `telematics_vehicle_id = rio:<uuid>`.
 */
import { trackerKind } from './trackerLink';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Wyciąga uuid z `rio:<uuid>` albo z adresu RIO. */
export function rioTrackingId(ref: string | null | undefined): string | null {
  const s = (ref ?? '').trim();
  if (!s) return null;
  const m = /^rio:([0-9a-f-]{36})$/i.exec(s);
  if (m) return m[1].toLowerCase();
  if (trackerKind(s) !== 'rio') return null;
  return s.match(UUID_RE)?.[0]?.toLowerCase() ?? null;
}

/** Czy w tekście jest parametr secret (nie logować / nie wstawiać do zdarzeń). */
export function trackingRefHasSecret(ref: string | null | undefined): boolean {
  return /[?&]secret=[^&\s]+/i.test(ref ?? '');
}

/**
 * Wartość bezpieczna dla zdarzeń, toastów i lokalnego stanu po zapisie:
 * RIO z kluczem → `rio:<uuid>`; już `rio:` zostaje; emtrack/other bez secret bez zmian.
 */
export function redactTrackingRef(ref: string | null | undefined): string | null {
  if (ref == null) return null;
  const s = String(ref).trim();
  if (!s) return null;
  if (/^rio:[0-9a-f-]{36}$/i.test(s)) return `rio:${s.slice(4).toLowerCase()}`;
  const id = rioTrackingId(s);
  if (id) return `rio:${id}`;
  if (trackingRefHasSecret(s)) return null;
  return s;
}

/** Patch zasobów bez sekretu w `trackingRef` (przed appendEvent / lokalnym merge po zapisie). */
export function redactResourcesPatch<T extends { trackingRef?: string | null }>(patch: T): T {
  if (!('trackingRef' in patch)) return patch;
  return { ...patch, trackingRef: redactTrackingRef(patch.trackingRef) };
}
