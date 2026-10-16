/**
 * wyglad/E6-tel — „Zadzwoń do kierowcy” wybiera sam numer kierowcy, który teraz wykonuje transport
 * (właściciel 16.10.2026, 13:34; doprecyzowanie E6 z 07.10, 15:13).
 *
 * Bez przepięcia naczepy: jeden kierowca „odbiór i dostawa”.
 * Z przepięciem: kierowca odcinka PL (odbiera, Śrem → prom) do chwili, gdy naczepę przejmie kierowca odcinka SE
 * (dostarcza, prom → Boden) — od przyjazdu do portu w Szwecji („Port SE”) do końca: kierowca SE.
 * Przy statusach bez odcinka (opóźniony, cisza GPS, brak dokumentów, anulowany) decyduje etap na pasku.
 */
import type { Load } from '../types';

export type DriverLeg = 'PL' | 'SE';

/** Statusy, przy których naczepa jest już u kierowcy odcinka SE (albo dostarczona przez niego). */
const SE_STATUSES: ReadonlySet<string> = new Set([
  'AT_PORT_SE', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'UNLOADING', 'DELIVERED', 'READY_TO_INVOICE', 'INVOICED',
]);
/** Etapy paska po stronie szwedzkiej (dla statusów bez odcinka). */
const SE_STAGES: ReadonlySet<string> = new Set(['APPROACH', 'SE_ROAD', 'SITE', 'DELIVERED']);

type DriverFields = Pick<Load['resources'], 'trailerSwap' | 'driverName' | 'driverPhone' | 'driverDeliveryName' | 'driverDeliveryPhone' | 'tractorPlate' | 'tractorDeliveryPlate'>;
type LegInput = Pick<Load, 'status' | 'stage'> & { resources: DriverFields };

/** Odcinek, którego kierowca teraz wykonuje transport. Bez przepięcia zawsze „PL” (jeden kierowca). */
export function activeLeg(l: LegInput): DriverLeg {
  if (!l.resources.trailerSwap) return 'PL';
  const s = String(l.status);
  if (SE_STATUSES.has(s)) return 'SE';
  if (['DELAYED', 'SILENT', 'DOC_MISSING', 'CANCELLED'].includes(s) && SE_STAGES.has(String(l.stage))) return 'SE';
  return 'PL';
}

export interface ActiveDriver {
  leg: DriverLeg;
  /** true — transport z przepięciem naczepy (dwa odcinki). */
  swap: boolean;
  name: string | null;
  /** Numer do wyświetlenia (jak w bazie). */
  phone: string | null;
  /** Numer do linku „tel:” (bez spacji); null — brak numeru kierowcy tego odcinka. */
  dial: string | null;
  tractor: string | null;
}

const clean = (v: string | null | undefined) => {
  const t = (v ?? '').trim();
  return t ? t : null;
};

/**
 * Kierowca do „Zadzwoń”. Przy przepięciu nie podstawia numeru drugiego odcinka:
 * gdy kierowca SE nie ma telefonu, ekran mówi „brak” zamiast dzwonić do kierowcy PL.
 * Bez przepięcia — jeden kierowca; gdy wpisano go tylko w polach odcinka SE, bierze te pola.
 */
export function activeDriver(l: LegInput): ActiveDriver {
  const r = l.resources;
  const swap = !!r.trailerSwap;
  const leg = activeLeg(l);
  let name: string | null;
  let phone: string | null;
  let tractor: string | null;
  if (swap && leg === 'SE') {
    name = clean(r.driverDeliveryName);
    phone = clean(r.driverDeliveryPhone);
    tractor = clean(r.tractorDeliveryPlate) ?? clean(r.tractorPlate);
  } else if (swap) {
    name = clean(r.driverName);
    phone = clean(r.driverPhone);
    tractor = clean(r.tractorPlate);
  } else {
    name = clean(r.driverName) ?? clean(r.driverDeliveryName);
    phone = clean(r.driverPhone) ?? clean(r.driverDeliveryPhone);
    tractor = clean(r.tractorPlate);
  }
  const dial = phone ? phone.replace(/[^\d+]/g, '') || null : null;
  return { leg, swap, name, phone, dial, tractor };
}
