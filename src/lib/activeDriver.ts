/**
 * wyglad/E6-tel — „Zadzwoń do kierowcy” wybiera sam numer kierowcy, który teraz wykonuje transport
 * (właściciel 16.10.2026, 13:34; doprecyzowanie E6 z 07.10, 15:13).
 *
 * Bez przepięcia naczepy: jeden kierowca „odbiór i dostawa”.
 * Z przepięciem: kierowca odcinka PL (odbiera, Śrem → prom) do portu w Polsce włącznie; od wejścia na prom
 * („Prom”, właściciel 16.10, 13:58: „w trakcie promu ma dzwonić do kierowcy SE”) do końca — kierowca odcinka SE (dostarcza).
 * Przy statusach bez odcinka (opóźniony, cisza GPS, brak dokumentów, anulowany) decyduje etap na pasku.
 */
import type { Load } from '../types';
import { groupPhone } from './phoneDisplay';
import { toE164 } from './phoneNational';

export type DriverLeg = 'PL' | 'SE';

/** Statusy, przy których naczepa jest już u kierowcy odcinka SE (albo dostarczona przez niego). */
const SE_STATUSES: ReadonlySet<string> = new Set([
  'ON_FERRY', 'AT_PORT_SE', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'UNLOADING', 'DELIVERED', 'READY_TO_INVOICE', 'INVOICED',
]);
/** Etapy paska po stronie szwedzkiej (dla statusów bez odcinka). */
const SE_STAGES: ReadonlySet<string> = new Set(['FERRY', 'APPROACH', 'SE_ROAD', 'SITE', 'DELIVERED']);

type DriverFields = Pick<Load['resources'], 'trailerSwap' | 'driverName' | 'driverPhone' | 'driverDeliveryName' | 'driverDeliveryPhone' | 'tractorPlate' | 'tractorDeliveryPlate' | 'driverPhoneCountry' | 'driverDeliveryPhoneCountry'>;
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
  /** Numer jak w bazie. */
  phone: string | null;
  /** Numer do wyświetlenia: międzynarodowy, z odstępami („+48 501 111 222”). */
  display: string | null;
  /** Numer do linku „tel:” (E.164, bez spacji); null — brak numeru kierowcy tego odcinka. */
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
  let country: 'PL' | 'SE' | undefined;
  if (swap && leg === 'SE') {
    name = clean(r.driverDeliveryName);
    phone = clean(r.driverDeliveryPhone);
    country = r.driverDeliveryPhoneCountry;
    tractor = clean(r.tractorDeliveryPlate) ?? clean(r.tractorPlate);
  } else if (swap) {
    name = clean(r.driverName);
    phone = clean(r.driverPhone);
    country = r.driverPhoneCountry;
    tractor = clean(r.tractorPlate);
  } else {
    name = clean(r.driverName) ?? clean(r.driverDeliveryName);
    const own = clean(r.driverPhone);
    phone = own ?? clean(r.driverDeliveryPhone);
    country = own ? r.driverPhoneCountry : r.driverDeliveryPhoneCountry;
    tractor = clean(r.tractorPlate);
  }
  const { display, dial } = driverPhoneView(phone, country);
  return { leg, swap, name, phone, display, dial, tractor };
}

/**
 * Numer kierowcy do pokazania i do linku „tel:” — jedna funkcja dla Harmonogramu („☎”, kolumna „Telefon kierowcy”)
 * i panelu (Przegląd › Kierowcy i zestaw; audyt-B B-12 / F-06): „+48000000004” → „+48 000 000 004”.
 */
export function driverPhoneView(
  phone: string | null | undefined,
  country?: 'PL' | 'SE',
): { display: string | null; dial: string | null } {
  const p = clean(phone);
  if (!p) return { display: null, dial: null };
  const raw = p.replace(/[^\d+]/g, '');
  const dial = raw.startsWith('+') ? raw : toE164(raw, country ?? 'PL') ?? (raw || null);
  return { display: dial ? groupPhone(dial) : p, dial };
}
