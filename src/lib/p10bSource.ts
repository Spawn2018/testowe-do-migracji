/**
 * wyglad/P10b-a (E37 pkt 4 i 7) — źródła dla komunikatu HHL z „Zamknij”, tekstu „Nie pamiętam hasła” i ekranu
 * „Link wygasł”. Wygląd czyta tylko wyniki; dane i zapisy podłącza Cursor w P10b (dopisek D-20261016-0530-01).
 *
 * Demo: komunikat przykładowy przy `komunikat-hhl=1` w adresie (jak `nowa-wersja=1` w P10a-a).
 * Produkcja: komunikat z `system_broadcast_current` (jak dotąd), zamknięcie pamiętane w tej przeglądarce do czasu
 * zapisu „dla osoby” w bazie; informacja o wygasłym linku i ponowna wysyłka — `null` / `false` do podłączenia.
 */
import { useEffect, useState } from 'react';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import { getNowIso } from './frozenNow';

export type BroadcastRow = { id: number; body: string; expires_at: string };

/** Czas ważności linku „Nie pamiętam hasła” — `supabase/config.toml` `[auth.email] otp_expiry = 3600`. */
export const RECOVERY_LINK_TTL = '1 h';

/** Przykład z makiety E37 (`makiety_html/E37/pasek.html`); data końca = teraz + 20 h. */
function demoBroadcast(): BroadcastRow {
  return {
    id: -1,
    body: 'Prom Stena Estelle wypływa o 10:00 zamiast 08:00. Awizacje bez zmian.',
    expires_at: new Date(Date.parse(getNowIso()) + 20 * 3600_000).toISOString(),
  };
}

function demoBroadcastOn(): boolean {
  if (typeof window === 'undefined') return false;
  return /[?&]komunikat-hhl=1\b/.test(window.location.hash) || /[?&]komunikat-hhl=1\b/.test(window.location.search);
}

/** Bieżący komunikat HHL dla firmy zalogowanej osoby (albo `null`). */
export function useBroadcast(): BroadcastRow | null {
  const [row, setRow] = useState<BroadcastRow | null>(() => (
    import.meta.env.VITE_AUTH_MODE !== 'supabase' && demoBroadcastOn() ? demoBroadcast() : null
  ));
  useEffect(() => {
    if (!(import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED)) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const { getSupabase } = await import('../auth/client');
        const sb = await getSupabase();
        const { data, error } = await sb.rpc('system_broadcast_current');
        if (cancelled || error) return;
        const first = Array.isArray(data) ? data[0] : data;
        setRow((first as BroadcastRow) ?? null);
      } catch {
        /* demo / brak sesji */
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return row;
}

const closedKey = (id: number) => `wt-bcast-closed-${id}`;
const closedNow = new Set<number>();

function readClosed(id: number): boolean {
  if (closedNow.has(id)) return true;
  try { return localStorage.getItem(closedKey(id)) === '1'; } catch { return false; }
}

/** „Zamknij” — komunikat nie wraca. Do zapisu „dla osoby” w bazie: pamięć tej przeglądarki. */
export function dismissBroadcast(id: number): void {
  closedNow.add(id);
  try { localStorage.setItem(closedKey(id), '1'); } catch { /* tryb prywatny — zostaje do końca karty */ }
}

export function useBroadcastClosed(id: number | null | undefined): [boolean, () => void] {
  const [, setTick] = useState(0);
  const closed = id == null ? false : readClosed(id);
  return [closed, () => { if (id != null) { dismissBroadcast(id); setTick((n) => n + 1); } }];
}

/** Ekran „Link wygasł”: co wiadomo o linku (adres, rodzaj, ważność zaproszenia). `null` = nic (wersja ogólna). */
export type ExpiredLinkInfo = {
  /** Adres, na który pójdzie nowy link (pokazywany na przycisku). */
  email: string;
  kind: 'invite' | 'recovery';
  /** Ważność linku w e-mailu: zaproszenie 24 h, „Nie pamiętam hasła” 1 h (E37 pkt 8). */
  linkTtl: string;
  /** Do kiedy ważne jest zaproszenie (7 dni) — tylko `invite`. */
  inviteValidUntil: string | null;
  /** Konto albo zaproszenie jest ważne → wolno wysłać nowy link. */
  canResend: boolean;
};

export type PendingLink = { hash?: string; search?: string } | null;

/** Wygasły / zużyty / niepełny link (tekst z `authErrorPl` albo surowy błąd Auth). */
export function isExpiredLinkError(message: string): boolean {
  return /Link wygasł|expired|otp_expired|invalid or has expired|niekompletny/i.test(message);
}

export async function expiredLinkInfo(_link: PendingLink): Promise<ExpiredLinkInfo | null> {
  return null;
}

/** „Wyślij nowy link na …” — `true` = wysłany. */
export async function resendExpiredLink(_link: PendingLink): Promise<boolean> {
  return false;
}
