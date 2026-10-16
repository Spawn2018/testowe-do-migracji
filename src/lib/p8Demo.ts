/**
 * wyglad/P8-a — przykład demo ekranu „Treści wiadomości” (E43): jedna zmieniona treść (C · Auto czeka, „zmieniono 07.10”),
 * zapis i przywrócenie w pamięci strony. Osoba zmyślona (G-09). Wywoływane wyłącznie z `p8Source.ts` za warunkiem trybu
 * demo wpisanym wprost (strażnik I-0).
 */
import type { SavedText } from './p8Source';

/* tworzone przy pierwszym użyciu — bez kodu na poziomie modułu, który build produkcyjny musiałby zostawić (I-0) */
let store: Map<string, SavedText> | null = null;
function texts(): Map<string, SavedText> {
  store ??= new Map<string, SavedText>([
    ['SMS_C', {
      id: 'SMS_C',
      subject: null,
      body: '{{code}}: auto {{trailer}} stoi przy {{place}} od {{dwell}}. Plan dostawy: {{planDate}}.',
      at: '2026-10-07T20:42:00Z',
      who: 'Anna Wiśniewska',
    }],
  ]);
  return store;
}

export function demoSavedNow(): SavedText[] {
  return [...texts().values()];
}

export async function demoSavedTexts(): Promise<SavedText[]> {
  return demoSavedNow();
}

export async function demoSaveText(id: string, subject: string | null, body: string): Promise<{ ok: boolean; row: SavedText }> {
  const row: SavedText = { id, subject, body, at: new Date().toISOString(), who: 'Anna Wiśniewska' };
  texts().set(id, row);
  return { ok: true, row };
}

export async function demoResetText(id: string): Promise<{ ok: boolean }> {
  texts().delete(id);
  return { ok: true };
}

/** podgląd jak na obrazie E43 (SG-03) — kod z danych przykładowych, tylko w demo */
export function demoPreviewCode(): string {
  return 'SG-03';
}

export async function demoSendTest(): Promise<{ ok: boolean; to: string }> {
  return { ok: true, to: 'administrator@example.com' };
}
