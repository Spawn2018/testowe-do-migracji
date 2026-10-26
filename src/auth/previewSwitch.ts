/**
 * B5 (0300, D-20261019-1525-01) — Podgląd KSH / SCX w bazie.
 *
 * Produkcja: Administrator HHL przełącza widok funkcjami bazy. `admin_preview_start('KSH'|'SCX')` ustawia
 * Podgląd na pierwszym aktywnym koncie KSH Użytkownik / SCX Dyspozytor (`read_only = true`), więc dane czyta
 * baza tak jak to konto: bez numerów, kosztu i marży, bez czatu HHL–SCX. Zapis odrzuca baza (`42501`).
 * `admin_preview_stop()` wraca do własnego konta. Start i koniec zapisuje `audit_log`.
 * Demo (bez logowania): przełącznik zmienia tylko widok, jak dotąd.
 */
import { useSyncExternalStore } from 'react';
import { getAuthProfile, requestAuthReload, type AuthReloadResult } from './profile';
import { dbPreviewOn, PROD_BUILD } from '../lib/prodFacade';
import { useTowerStore } from '../store/useTowerStore';

export type ViewRoleId = 'HHL' | 'KSH' | 'SCX';

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

async function rpc(): Promise<Rpc> {
  /* I-2: paczka demo bez klienta Supabase — import tylko w buildzie z logowaniem */
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') throw new Error('Podgląd w bazie tylko po zalogowaniu.');
  const { getSupabase } = await import('./client');
  const sb = await getSupabase();
  return (fn, args) => sb.rpc(fn, args);
}

/** Komunikat dla Administratora HHL, gdy baza odmówi startu lub końca Podglądu. */
export function previewErrorPl(message: string | undefined): string {
  const m = String(message ?? '');
  if (/Tylko administrator HHL/i.test(m)) return 'Podgląd może włączyć tylko Administrator HHL z weryfikacją dwuetapową.';
  const none = /Brak aktywnego konta (KSH|SCX)/i.exec(m);
  if (none) return `Podgląd ${none[1].toUpperCase()} niedostępny — brak aktywnego konta ${none[1].toUpperCase()}.`;
  if (/Could not find the function|does not exist|PGRST202/i.test(m)) return 'Podgląd będzie dostępny po aktualizacji bazy.';
  return m || 'Nie udało się przełączyć Podglądu.';
}

/** Stan Podglądu z profilu (`my_profile.preview_read_only`, 0300); bez pola w bazie — dopytanie `is_preview_read_only`. */
export async function previewRoOf(p: { preview_read_only?: boolean | null }, call?: Rpc): Promise<boolean> {
  if (typeof p.preview_read_only === 'boolean') return p.preview_read_only;
  return readPreviewRo(call);
}

/**
 * Po wczytaniu profilu z „acting_as”: czy to Podgląd (tylko odczyt), a nie „Działaj jako”.
 * F7 #383 Ś1: błąd odczytu = Podgląd (bezpieczniej: brak zapisu); brak funkcji w bazie (przed 0300) = nie.
 */
export async function readPreviewRo(call?: Rpc): Promise<boolean> {
  try {
    const r = await (call ?? (await rpc()))('is_preview_read_only');
    if (r.error) return !/Could not find the function|does not exist|PGRST202/i.test(r.error.message);
    return r.data === true;
  } catch {
    return true;
  }
}

/**
 * F7 #383 B2: Administrator HHL we własnym widoku, a w bazie został wiersz Podglądu (np. konto oglądane
 * wyłączone w trakcie) — baza odrzucałaby jego zapisy bez paska „Wróć”. Kończymy taki Podgląd po cichu.
 */
export async function clearStalePreview(call?: Rpc): Promise<void> {
  try {
    const c = call ?? (await rpc());
    const r = await c('is_preview_read_only');
    if (!r.error && r.data === true) await c('admin_preview_stop');
  } catch {
    /* bez zmian — kolejne logowanie spróbuje ponownie */
  }
}

let busy = false;
const busySubs = new Set<() => void>();
function setBusy(v: boolean): void {
  busy = v;
  for (const f of busySubs) f();
}
/** Do testów: stan „przełączanie w toku” (trwa do końca przeładowania profilu i danych). */
export const previewSwitchBusy = (): boolean => busy;
/** F7 #383 r2: przyciski przełączania — `disabled` + `aria-busy` w trakcie. */
export function usePreviewSwitchBusy(): boolean {
  return useSyncExternalStore(
    (f) => { busySubs.add(f); return () => { busySubs.delete(f); }; },
    previewSwitchBusy,
    () => false,
  );
}

export const PREVIEW_RELOAD_FAIL = 'Nie udało się wczytać Podglądu — zostajesz we własnym widoku. Spróbuj ponownie.';
export const PREVIEW_BACK_FAIL = 'Nie udało się wrócić do widoku HHL — odśwież stronę.';
export const PREVIEW_SLOW = 'Wczytywanie trwa dłużej niż zwykle — ekran przełączy się, gdy dane dojdą.';

/** F7 #383 r2: po przeładowaniu fokus na pasek Podglądu („Wróć do HHL”) albo na główną treść. */
function focusAfterSwitch(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
  const raf = typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame.bind(window) : (f: () => void) => setTimeout(f, 0);
  raf(() => {
    const el = document.querySelector<HTMLElement>('[data-banner="preview"] button') ?? document.querySelector<HTMLElement>('main');
    if (el && el.tagName === 'MAIN' && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el?.focus();
  });
}

/**
 * Przełącz widok. Zwraca `null` po sukcesie albo tekst błędu (pokazany też w powiadomieniu).
 * F7 #383 B3: jedno przełączenie naraz — kolejne kliknięcia i Shift+R w trakcie są pomijane.
 * F7 #383 r2: „w toku” trwa do końca przeładowania; po przeładowaniu stan Podglądu w profilu musi zgadzać się
 * z celem — inaczej (np. błąd sieci przy `my_profile`) kończymy Podgląd w bazie, żeby UI i baza się nie rozjechały.
 * `deps` — do testów.
 */
export async function switchViewRole(
  next: ViewRoleId,
  deps?: {
    prod?: boolean;
    call?: Rpc;
    reload?: () => void | Promise<AuthReloadResult | void>;
    dbPreview?: boolean;
    /** stan Podglądu po przeładowaniu (domyślnie z profilu) */
    previewAfter?: () => boolean;
  },
): Promise<string | null> {
  const store = useTowerStore.getState();
  const prod = deps?.prod ?? PROD_BUILD;
  if (!prod) {
    store.setRole(next);
    return null;
  }
  if (busy) return null;
  const inPreview = deps?.dbPreview ?? dbPreviewOn(getAuthProfile());
  if (next !== 'HHL' && inPreview && store.role === next) return null;
  setBusy(true);
  try {
    const call = deps?.call ?? (await rpc());
    if (next === 'HHL' && !inPreview) {
      /* F7 #383 B2: zawsze kończymy Podgląd w bazie (bez wiersza — nic się nie dzieje); widok bez przeładowania */
      await call('admin_preview_stop');
      store.setRole('HHL');
      return null;
    }
    const { error } = next === 'HHL'
      ? await call('admin_preview_stop')
      : await call('admin_preview_start', { p_side: next });
    if (error) {
      const msg = previewErrorPl(error.message);
      store.pushToast(msg, 'HIGH');
      return msg;
    }
    const reload = deps?.reload ?? requestAuthReload;
    const res = await reload();
    if (res === 'timeout') {
      /* przeładowanie wciąż trwa — nie cofamy startu w bazie (ekran przełączy się po dojściu danych) */
      store.pushToast(PREVIEW_SLOW, 'MEDIUM');
      return PREVIEW_SLOW;
    }
    const after = (deps?.previewAfter ?? (() => dbPreviewOn(getAuthProfile())))();
    const want = next !== 'HHL';
    if (after !== want) {
      if (want) {
        /* baza w Podglądzie, ekran nie — kończymy Podgląd w bazie (zapisy nie dostaną 42501 bez paska „Wróć”)
           i jeszcze raz wczytujemy profil, żeby ekran zgadzał się z bazą */
        try { await call('admin_preview_stop'); } catch { /* kolejne logowanie wyczyści (clearStalePreview) */ }
        await reload();
        store.pushToast(PREVIEW_RELOAD_FAIL, 'HIGH');
        return PREVIEW_RELOAD_FAIL;
      }
      /* baza wróciła do HHL, ekran nie — jedna ponowna próba wczytania profilu */
      await reload();
      if ((deps?.previewAfter ?? (() => dbPreviewOn(getAuthProfile())))() === false) { focusAfterSwitch(); return null; }
      store.pushToast(PREVIEW_BACK_FAIL, 'HIGH');
      return PREVIEW_BACK_FAIL;
    }
    focusAfterSwitch();
    return null;
  } catch (e) {
    if (next === 'HHL' && !inPreview) {
      store.setRole('HHL');
      return null;
    }
    const msg = previewErrorPl(e instanceof Error ? e.message : String(e));
    store.pushToast(msg, 'HIGH');
    return msg;
  } finally {
    setBusy(false);
  }
}

/**
 * F7 #383 r2: wylogowanie w trakcie Podglądu kończy Podgląd w bazie — po ponownym logowaniu Administrator
 * wraca do własnego widoku, nie do KSH/SCX. Błąd nie blokuje wylogowania.
 */
export async function endPreviewBeforeLogout(deps?: { call?: Rpc; dbPreview?: boolean }): Promise<void> {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase' && !deps?.call) return;
  const on = deps?.dbPreview ?? dbPreviewOn(getAuthProfile());
  if (!on) return;
  try {
    await (deps?.call ?? (await rpc()))('admin_preview_stop');
  } catch {
    /* wylogowanie idzie dalej; przy kolejnym logowaniu clearStalePreview */
  }
}
