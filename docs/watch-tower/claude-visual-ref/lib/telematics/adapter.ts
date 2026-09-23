/**
 * TOWER — warstwa telematyki
 *
 * Jeden interfejs, wiele źródeł pozycji. Powód jest prosty: dopóki
 * Scandinavian Express nie potwierdzi, jakiego systemu używa i czy dadzą
 * dostęp do API, nie wolno uzależnić architektury od jednego dostawcy.
 *
 * Priorytet źródeł (od najlepszego):
 *   1. WEBHOOK / PUSH  — dostawca sam wysyła. Zero pollingu, zero crona.
 *                        rFMS 5.0 (lipiec 2025) dodał metodę push obok pull.
 *   2. PULL / POLLING  — odpytujemy co N minut. Wymaga Vercel Pro
 *                        (plan Hobby dopuszcza cron tylko raz dziennie).
 *   3. DRIVER PWA      — kierowca klika status + przeglądarka wysyła pozycję.
 *                        Fallback, gdy API nie ma. Ograniczenie: przy
 *                        zablokowanym ekranie telefon przestaje raportować,
 *                        więc to źródło MILESTONE'ÓW, nie ciągłego trackingu.
 *   4. MANUAL          — dyspozytor wpisuje ręcznie. Ostatnia deska ratunku.
 *
 * ŚWIADOMIE NIE IMPLEMENTUJEMY scrapowania publicznego linku śledzenia
 * przez headless Chromium: łamie się bez ostrzeżenia, nie mieści się
 * w limitach funkcji serverless i zwykle narusza ToS dostawcy.
 */

export type TelematicsProviderId =
  | 'RFMS'          // standard ACEA — Scania, Volvo, MAN, DAF, Mercedes, Iveco
  | 'WEBFLEET'
  | 'TRANSICS'      // ZF
  | 'MAPON'
  | 'RUPTELA'
  | 'WIALON'        // Gurtam
  | 'FRAMELOGIC'
  | 'SAMSARA'
  | 'GENERIC_REST'  // dowolne API zmapowane konfiguracją
  | 'DRIVER_PWA'
  | 'MANUAL';

export interface VehiclePosition {
  vehicleId: string;
  plate?: string;
  lat: number;
  lon: number;
  ts: string;              // ISO 8601, ZAWSZE UTC
  speedKmh?: number;
  headingDeg?: number;
  ignition?: boolean;
  odometerKm?: number;
  fuelLevelPct?: number;
  raw?: unknown;
}

export interface TelematicsCredentials {
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  accountId?: string;
  /** Mapowanie nr rejestracyjny -> ID pojazdu w systemie dostawcy.
   *  PYTANIE DO PRZEWOŹNIKA: czy API pozwala szukać po rejestracji,
   *  czy musimy dostać listę ID? Bez tego nie podepniemy transportu. */
  vehicleIdByPlate?: Record<string, string>;
}

export interface TelematicsAdapter {
  readonly id: TelematicsProviderId;
  /** Czy dostawca potrafi pushować. Jeśli tak — nie odpytujemy. */
  readonly supportsPush: boolean;

  listVehicles(): Promise<Array<{ vehicleId: string; plate?: string }>>;
  getPositions(vehicleIds: string[], since?: Date): Promise<VehiclePosition[]>;

  /** Rejestracja webhooka, jeśli dostawca to umożliwia. */
  subscribe?(callbackUrl: string, secret: string): Promise<{ subscriptionId: string }>;
  /** Parsowanie i weryfikacja podpisu przychodzącego webhooka. */
  parseWebhook?(body: unknown, headers: Record<string, string>): VehiclePosition[];
}

/* =====================================================================
 * 1. rFMS — standard ACEA
 *
 * Interfejs FMS powstał w 2002 r. jako wspólna inicjatywa Mercedes-Benz,
 * MAN, Scania, Volvo (z Renault), DAF i Iveco, żeby umożliwić aplikacje
 * telematyczne niezależne od marki pojazdu. rFMS to jego zdalna, RESTowa
 * odmiana: HTTPS + JSON, wersja API wskazywana nagłówkiem Accept,
 * autoryzacja tokenem w nagłówku Authorization, limity w nagłówkach.
 *
 * Największa zaleta dla nas: JEDEN adapter obsługuje flotę mieszaną.
 * Subskrypcja i umowa są jednak po stronie producenta — stąd pytanie
 * do przewoźnika, kto za to płaci i czy mają ją aktywną.
 * ===================================================================== */
export class RfmsAdapter implements TelematicsAdapter {
  readonly id = 'RFMS' as const;
  readonly supportsPush = true;    // od rFMS 5.0.0

  constructor(private cfg: TelematicsCredentials & { apiVersion?: string }) {}

  private headers(accept: string) {
    return {
      Authorization: `Bearer ${this.cfg.apiKey}`,
      Accept: accept,
    };
  }

  async listVehicles() {
    const res = await fetch(`${this.cfg.baseUrl}/rfms/vehicles`, {
      headers: this.headers(
        `application/json;version=${this.cfg.apiVersion ?? '5.0'}`
      ),
    });
    if (!res.ok) throw new Error(`rFMS vehicles ${res.status}`);
    const data = await res.json();
    return (data.vehicleResponse?.vehicles ?? []).map((v: any) => ({
      vehicleId: v.vin ?? v.vehicleId,
      plate: v.customerVehicleName ?? v.registrationNumber,
    }));
  }

  async getPositions(vehicleIds: string[], since?: Date) {
    const qs = new URLSearchParams();
    if (since) qs.set('starttime', since.toISOString());
    qs.set('latestOnly', since ? 'false' : 'true');

    const res = await fetch(`${this.cfg.baseUrl}/rfms/vehiclepositions?${qs}`, {
      headers: this.headers(
        `application/json;version=${this.cfg.apiVersion ?? '5.0'}`
      ),
    });
    if (!res.ok) throw new Error(`rFMS positions ${res.status}`);
    const data = await res.json();

    return (data.vehiclePositionResponse?.vehiclePositions ?? [])
      .filter((p: any) => vehicleIds.length === 0 || vehicleIds.includes(p.vin))
      .map((p: any): VehiclePosition => ({
        vehicleId: p.vin,
        lat: p.gnssPosition?.latitude,
        lon: p.gnssPosition?.longitude,
        ts: p.gnssPosition?.positionDateTime ?? p.createdDateTime,
        speedKmh: p.gnssPosition?.speed,
        headingDeg: p.gnssPosition?.heading,
        ignition: p.triggerType?.triggerType === 'IGNITION_ON',
        odometerKm: p.tachographSpeed ? undefined : p.hrTotalVehicleDistance / 1000,
        raw: p,
      }))
      .filter((p: VehiclePosition) => p.lat != null && p.lon != null);
  }
}

/* =====================================================================
 * 2. GENERIC_REST — dowolne API opisane konfiguracją (JSONPath-lite)
 *
 * Pisany po to, żeby po jutrzejszym spotkaniu podpiąć system przewoźnika
 * BEZ pisania nowego adaptera — wystarczy wypełnić mapę pól.
 * ===================================================================== */
export interface GenericRestConfig extends TelematicsCredentials {
  positionsPath: string;                 // np. '/api/v1/objects/positions'
  method?: 'GET' | 'POST';
  authMode: 'BEARER' | 'HEADER_KEY' | 'QUERY_KEY' | 'BASIC';
  authHeaderName?: string;
  arrayField: string;                    // np. 'data.items'
  fieldMap: {
    vehicleId: string; lat: string; lon: string; ts: string;
    speed?: string; heading?: string; ignition?: string; plate?: string;
  };
  /** Jeśli API zwraca czas lokalny, podaj strefę, żeby przeliczyć na UTC. */
  tsTimezone?: string;
  /** Jeśli API zwraca epoch w sekundach zamiast ISO. */
  tsIsEpochSeconds?: boolean;
}

const dig = (obj: any, path: string) =>
  path.split('.').reduce((a, k) => (a == null ? a : a[k]), obj);

export class GenericRestAdapter implements TelematicsAdapter {
  readonly id = 'GENERIC_REST' as const;
  readonly supportsPush = false;

  constructor(private cfg: GenericRestConfig) {}

  async listVehicles() {
    const positions = await this.getPositions([]);
    const seen = new Map<string, string | undefined>();
    positions.forEach((p) => seen.set(p.vehicleId, p.plate));
    return [...seen].map(([vehicleId, plate]) => ({ vehicleId, plate }));
  }

  async getPositions(vehicleIds: string[], since?: Date) {
    const url = new URL(this.cfg.positionsPath, this.cfg.baseUrl);
    const headers: Record<string, string> = {};

    switch (this.cfg.authMode) {
      case 'BEARER':     headers.Authorization = `Bearer ${this.cfg.apiKey}`; break;
      case 'HEADER_KEY': headers[this.cfg.authHeaderName ?? 'X-API-Key'] = this.cfg.apiKey!; break;
      case 'QUERY_KEY':  url.searchParams.set('key', this.cfg.apiKey!); break;
      case 'BASIC':
        headers.Authorization =
          'Basic ' + Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString('base64');
        break;
    }
    if (since) url.searchParams.set('from', since.toISOString());

    const res = await fetch(url, { method: this.cfg.method ?? 'GET', headers });
    if (!res.ok) throw new Error(`${this.cfg.baseUrl} -> ${res.status} ${await res.text()}`);

    const json = await res.json();
    const rows: any[] = dig(json, this.cfg.arrayField) ?? [];
    const m = this.cfg.fieldMap;

    return rows
      .map((r): VehiclePosition => {
        const rawTs = dig(r, m.ts);
        return {
          vehicleId: String(dig(r, m.vehicleId)),
          plate: m.plate ? dig(r, m.plate) : undefined,
          lat: Number(dig(r, m.lat)),
          lon: Number(dig(r, m.lon)),
          ts: this.cfg.tsIsEpochSeconds
            ? new Date(Number(rawTs) * 1000).toISOString()
            : new Date(rawTs).toISOString(),
          speedKmh: m.speed ? Number(dig(r, m.speed)) : undefined,
          headingDeg: m.heading ? Number(dig(r, m.heading)) : undefined,
          ignition: m.ignition ? Boolean(dig(r, m.ignition)) : undefined,
          raw: r,
        };
      })
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .filter((p) => vehicleIds.length === 0 || vehicleIds.includes(p.vehicleId));
  }
}

/* =====================================================================
 * 3. DRIVER_PWA — fallback, który budujemy ZAWSZE
 *
 * Kierowca dostaje SMS-em link z tokenem. Otwiera stronę (PL/EN/SV),
 * klika "Udostępniaj pozycję" i ma cztery duże przyciski milestone'ów.
 * Pozycje wpadają tą samą drogą co z telematyki — process_position().
 * ===================================================================== */
export class DriverPwaAdapter implements TelematicsAdapter {
  readonly id = 'DRIVER_PWA' as const;
  readonly supportsPush = true;          // przeglądarka sama POST-uje

  async listVehicles() { return []; }
  async getPositions() { return []; }    // czysto push

  parseWebhook(body: any): VehiclePosition[] {
    if (!body?.loadId || !Number.isFinite(body.lat) || !Number.isFinite(body.lon)) return [];
    return [{
      vehicleId: body.loadId,
      lat: Number(body.lat),
      lon: Number(body.lon),
      ts: body.ts ?? new Date().toISOString(),
      speedKmh: body.speed != null ? Number(body.speed) : undefined,
      headingDeg: body.heading != null ? Number(body.heading) : undefined,
      raw: body,
    }];
  }
}

/* ===================================================================== */

export function createAdapter(
  provider: TelematicsProviderId,
  cfg: TelematicsCredentials | GenericRestConfig
): TelematicsAdapter {
  switch (provider) {
    case 'RFMS':       return new RfmsAdapter(cfg as TelematicsCredentials);
    case 'DRIVER_PWA': return new DriverPwaAdapter();
    default:           return new GenericRestAdapter(cfg as GenericRestConfig);
  }
}

/**
 * KONFIGURACJE DO WYPEŁNIENIA PO SPOTKANIU Z PRZEWOŹNIKIEM.
 * Zostawiam szkielety najczęstszych w regionie bałtyckim systemów —
 * dokładne ścieżki i nazwy pól trzeba wziąć z ICH dokumentacji,
 * nie z pamięci. Nie zgaduj endpointów.
 */
export const PROVIDER_TEMPLATES: Partial<Record<TelematicsProviderId, Partial<GenericRestConfig>>> = {
  WEBFLEET:   { authMode: 'QUERY_KEY',  arrayField: '', fieldMap: { vehicleId: '', lat: '', lon: '', ts: '' } },
  MAPON:      { authMode: 'QUERY_KEY',  arrayField: '', fieldMap: { vehicleId: '', lat: '', lon: '', ts: '' } },
  RUPTELA:    { authMode: 'HEADER_KEY', arrayField: '', fieldMap: { vehicleId: '', lat: '', lon: '', ts: '' } },
  WIALON:     { authMode: 'QUERY_KEY',  arrayField: '', fieldMap: { vehicleId: '', lat: '', lon: '', ts: '' } },
  TRANSICS:   { authMode: 'BASIC',      arrayField: '', fieldMap: { vehicleId: '', lat: '', lon: '', ts: '' } },
  FRAMELOGIC: { authMode: 'BEARER',     arrayField: '', fieldMap: { vehicleId: '', lat: '', lon: '', ts: '' } },
  SAMSARA:    { authMode: 'BEARER',     arrayField: '', fieldMap: { vehicleId: '', lat: '', lon: '', ts: '' } },
};
