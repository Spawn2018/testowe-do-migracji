/**
 * wyglad/P10b-d — dane pierwszego wejścia (E37 pkt 9). Demo: przykłady (G-09, osoby zmyślone). Produkcja: `null` /
 * `false`, dopóki wykonawca nie podłączy danych (D-20261016-0930-01) — do tego czasu logowanie działa jak dziś
 * (link → „Dalej” → hasło → Kokpit). Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import type { MatrixGroup } from '../components/options/channels';
import type { AccountKind } from './cockpitE9';
import type { PendingLink } from './p10bSource';

/** Krok 1: kto zaprasza, do jakiej firmy i na jakie konto (bez innych danych konta). */
export type InviteInfo = {
  /** „Anna Wiśniewska” */
  inviter: string;
  /** „H&H Logistics” */
  inviterCompany: string;
  /** Imię i nazwisko zaproszonej osoby z zaproszenia (E6). */
  person: string;
  /** Pełna nazwa firmy osoby: „H&H Logistics”, „KSH”, „Scandinavian Express”. */
  company: string;
  /** Rodzaj konta bez nazwy firmy: „Administrator”, „Operacje”, „Użytkownik”, „Dyspozytor”. */
  account: string;
};

export type NotifyResult = 'ok' | 'denied' | 'unsupported' | 'fail';

/** Czy ścieżka 4 ekranów jest podłączona (demo — tak; produkcja — po pkt 1–4 dopisku). */
export function firstEntryReady(): boolean {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase';
}

/** Krok 1 przed „Dalej” (link jeszcze nieużyty): dane zaproszenia. `null` — wersja ogólna bez nazwisk. */
export async function inviteInfo(_link: PendingLink, demoKind?: AccountKind): Promise<InviteInfo | null> {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    const { demoInvite } = await import('./firstEntryDemo');
    return demoInvite(demoKind ?? 'CLIENT_USER');
  }
  return null;
}

/** Krok 4: co trafia do konta według „Dla mnie” (E11). `null` — bez listy. */
export async function firstEntryReceives(): Promise<MatrixGroup[] | null> {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    const { DEMO_MATRIX } = await import('../components/options/demo');
    return DEMO_MATRIX;
  }
  return null;
}

/** Krok 3: zapis imienia, nazwiska i telefonu (E.164) w koncie. `null` — zapis niepodłączony. */
export function saveMyDetails(d: { first: string; last: string; phone: string }): Promise<boolean> | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    return new Promise((res) => { setTimeout(() => res(!!(d.first && d.last && d.phone)), 300); });
  }
  return null;
}

/** Krok 4: „Włącz powiadomienia na tym telefonie” (E5). Demo — bez prośby przeglądarki. */
export async function enableNotifications(): Promise<NotifyResult> {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    return new Promise((res) => { setTimeout(() => res('ok'), 300); });
  } else {
    try {
      const { enableWebPush } = await import('./webPush');
      const r = await enableWebPush();
      if (r.ok) return 'ok';
      return r.reason === 'denied' ? 'denied' : r.reason === 'unsupported' ? 'unsupported' : 'fail';
    } catch {
      return 'fail';
    }
  }
}
