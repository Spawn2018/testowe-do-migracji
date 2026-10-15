/**
 * wyglad/C — „Dla mnie › Ten telefon / komputer” (E5 img/e5-desk, prawa część: „Twoje urządzenia”).
 * Skąd ekran bierze listę urządzeń z powiadomieniami na telefon i przyciski „Wyślij powiadomienie testowe” /
 * „Usuń urządzenie”. Produkcja: `null` = nie podłączone (sekcja „Twoje urządzenia” ukryta) — listę z `push_subscriptions`,
 * powiadomienie testowe i usunięcie podłącza wykonawca w „Poprawki P2–P3 (audyt 15.10)” C2.
 * Demo: przykład. Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0). Bez zapytań i zapisów.
 */
export interface PushDevice {
  id: string;
  /** „Android · Chrome” */
  label: string;
  /** dzień zapisania urządzenia (ISO) */
  since: string;
  active: boolean;
  /** to urządzenie, na którym otwarty jest ekran */
  current?: boolean;
}

export interface PushDeviceSource {
  devices: PushDevice[];
  /** null = przycisk ukryty */
  sendTest: ((id: string) => Promise<boolean>) | null;
  remove: ((id: string) => Promise<boolean>) | null;
}

function demoDevices(): PushDeviceSource {
  return {
    devices: [{ id: 'dev-1', label: 'Android · Chrome', since: '2026-10-05T09:12:00+02:00', active: true, current: true }],
    sendTest: async () => true,
    remove: async () => true,
  };
}

export function pushDevicesOf(): PushDeviceSource | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoDevices() : null;
}
