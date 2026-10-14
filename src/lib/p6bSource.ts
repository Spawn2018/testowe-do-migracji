/**
 * wyglad/P6-b — skąd panel transportu (E17: Historia i Czat) bierze dane, których aplikacja jeszcze nie ma.
 * Produkcja: to, co jest dziś (zdarzenia i wiadomości z bazy); wybór „tylko HHL i SCX”, „przeczytali” i liczba
 * nieprzeczytanych wyłączone, dopóki aplikacja ich nie zapisuje i nie czyta (dopisek do PR wyglad/P6-b).
 * Baza ma już `load_messages.visible_to` (0001) i RLS `msgs_read` (0037) — brakuje zapisu przy wysyłce,
 * zwrotu w `list_load_messages_ui` i odczytu w aplikacji. Demo: przykłady z `p6bDemo.ts`.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0). Bez zapytań i zapisów.
 */
import type { Load, LoadEvent, LoadMessage, OrgKind } from '../types';
import { getAuthProfile } from '../auth/profile';
import { demoActors, demoChat, demoHistoryEvents, demoMeId } from './p6bDemo';

/** E17 (20:57): HHL i SCX wybierają „HHL, SCX, KSH” albo „tylko HHL i SCX”. Produkcja — po podłączeniu `visible_to` w aplikacji. */
export function chatVisibilityOn(): boolean {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase';
}

/**
 * E17: „Przeczytali” i liczba nieprzeczytanych liczą się dopiero po otwarciu zakładki przez daną osobę.
 * Produkcja — wyłączone: dziś aplikacja oznacza jako przeczytane 40 ostatnich wiadomości przy każdym wczytaniu.
 */
export function chatReadsOn(): boolean {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase';
}

/** Ja (do „nieprzeczytanych”): produkcja — konto z logowania; demo — osoba pokazowa tej firmy. */
export function chatMeOf(role: OrgKind): string | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoMeId(role) : getAuthProfile()?.user_id ?? null;
}

/** Historia: demo — autorzy z imieniem i przykładowe wpisy „było → jest”; produkcja — zdarzenia z bazy bez zmian. */
export function historyEventsOf(load: Load, events: readonly LoadEvent[], nowIso: string): LoadEvent[] {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? [...demoActors(events), ...demoHistoryEvents(load, nowIso)] : [...events];
}

/** Czat: demo — autorzy, odczyty i rozmowa HHL ↔ SCX; produkcja — wiadomości bez zmian. */
export function chatMessagesOf(load: Load, msgs: LoadMessage[], nowIso: string): LoadMessage[] {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoChat(load, msgs, nowIso) : msgs;
}

/** KSH nie widzi rozmów „tylko HHL i SCX” (E17; w produkcji pilnuje tego baza — RLS po `visible_to`). */
export function chatVisibleFor(msgs: readonly LoadMessage[], role: OrgKind): LoadMessage[] {
  return role === 'KSH' ? msgs.filter((m) => m.visibleTo !== 'HHL_SCX') : [...msgs];
}

/**
 * Liczba nieprzeczytanych na zakładce „Czat” (E17): cudze wiadomości, których nie było przy ostatnim otwarciu zakładki
 * w tej sesji i bez mojego odczytu. Samo otwarcie niczego nie zapisuje (zapis odczytu — wykonawca).
 */
export function chatUnread(
  msgs: readonly LoadMessage[],
  role: OrgKind,
  myUserId: string | null,
  seenIds: ReadonlySet<string>,
): number {
  return chatVisibleFor(msgs, role).filter((m) => m.org !== role
    && !seenIds.has(m.id)
    && !(myUserId && (m.reads ?? []).some((r) => r.userId === myUserId))).length;
}
