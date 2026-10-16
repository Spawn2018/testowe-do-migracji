/**
 * wyglad/P10b-b — dane Pomocy (E37 pkt 3): „Kontakt” (Operacje HHL z telefonem z kont, E6) i „Co nowego” (zmiany z datą
 * po wdrożeniu). Demo: przykłady (G-09: osoby i telefony zmyślone, pula +48 000 000 0xx). Produkcja: `null`, dopóki
 * wykonawca nie podłączy danych (D-20261016-0810-01). Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import { DEMO_PEOPLE } from './p6Demo';

export type HelpContact = { id: string; name: string; phone: string; email?: string | null };
export type WhatsNewItem = { at: string; title: string; text: string };

/** Operacje HHL z telefonem — bez wpisywania osobno (E37 pkt 3 „Kontakt”). */
export function helpContacts(): HelpContact[] | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    return DEMO_PEOPLE.filter((p) => p.org === 'HHL' && p.role === 'HHL_OPS' && p.phone)
      .map((p) => ({ id: p.id, name: p.name, phone: p.phone as string, email: null }));
  }
  return null;
}

const DEMO_NEWS: WhatsNewItem[] = [
  { at: '2026-10-16', title: 'Mapa', text: 'Tabela i mapa pokazują transporty w oknie śledzenia. Auta na promie i w jednej strefie mają jeden znacznik z liczbą.' },
  { at: '2026-10-16', title: 'Kokpit i Mapa', text: 'Mapa zawsze pokazuje całą trasę. Przegląd w panelu przybliża na pojeździe.' },
  { at: '2026-10-15', title: 'Powiadomienia na telefon', text: 'Pilne powiadomienie bez potwierdzenia w 5 minut idzie też e-mailem.' },
];

/** „Co nowego”: najnowsze pierwsze. */
export function whatsNew(): WhatsNewItem[] | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return DEMO_NEWS;
  return null;
}
