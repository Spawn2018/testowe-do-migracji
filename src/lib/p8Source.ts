/**
 * wyglad/P8-a — skąd ekran „Treści wiadomości” (E43) bierze zapisane treści i jak je zapisuje.
 * Produkcja: `null` = nie podłączone (ekran pokazuje treści domyślne tylko do odczytu); dane, zapis, próbna wysyłka
 * i przywrócenie — wykonawca w P8 (tabela treści z Historią zmian; dopisek do PR wyglad/P8-a).
 * Demo: zapis w pamięci strony. Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0). Bez zapytań.
 */
import { demoSavedTexts, demoSavedNow, demoSaveText, demoResetText, demoSendTest, demoPreviewCode } from './p8Demo';

export interface SavedText {
  /** id wiadomości z `MESSAGES` */
  id: string;
  subject: string | null;
  body: string;
  /** kiedy zmieniono (ISO) */
  at: string;
  /** kto: „Anna Wiśniewska” */
  who: string;
}

export interface MessageTextsSource {
  saved: () => Promise<SavedText[]>;
  /** zapisane treści dostępne od razu (demo); produkcja — brak, ekran czeka na `saved()` */
  initial?: SavedText[];
  /** zapis treści (znaczniki `{{id}}`); w produkcji wpis w Historii zmian (kto, kiedy, było → jest) */
  save: ((id: string, subject: string | null, body: string) => Promise<{ ok: boolean; row?: SavedText }>) | null;
  /** „Przywróć domyślną treść” — usuwa zapis, wiadomość wraca do treści z kodu */
  reset: ((id: string) => Promise<{ ok: boolean }>) | null;
  /** próbny SMS na numer administratora albo e-mail na jego adres (G-14: tylko adres i numer właściciela) */
  sendTest: ((id: string, subject: string | null, body: string, loadCode: string | null) => Promise<{ ok: boolean; to?: string }>) | null;
  /** transport wybrany na starcie podglądu (demo: jak na obrazie E43); brak — pierwszy z listy */
  previewCode: string | null;
}

export function messageTextsOf(): MessageTextsSource | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase'
    ? { saved: demoSavedTexts, initial: demoSavedNow(), save: demoSaveText, reset: demoResetText, sendTest: demoSendTest, previewCode: demoPreviewCode() }
    : null;
}
