/**
 * B5 (0249, D-20261019-1525-01) — Podgląd KSH / SCX w bazie.
 *
 * Produkcja: Administrator HHL przełącza widok funkcjami bazy. `admin_preview_start('KSH'|'SCX')` ustawia
 * Podgląd na pierwszym aktywnym koncie KSH Użytkownik / SCX Dyspozytor (`read_only = true`), więc dane czyta
 * baza tak jak to konto: bez numerów, kosztu i marży, bez czatu HHL–SCX. Zapis odrzuca baza (`42501`).
 * `admin_preview_stop()` wraca do własnego konta. Start i koniec zapisuje `audit_log`.
 * Demo (bez logowania): przełącznik zmienia tylko widok, jak dotąd.
 */
import { getAuthProfile, requestAuthReload } from './profile';
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

/** Po wczytaniu profilu z „acting_as”: czy to Podgląd (tylko odczyt), a nie „Działaj jako”. */
export async function readPreviewRo(call?: Rpc): Promise<boolean> {
  try {
    const r = await (call ?? (await rpc()))('is_preview_read_only');
    return !r.error && r.data === true;
  } catch {
    return false;
  }
}

/**
 * Przełącz widok. Zwraca `null` po sukcesie albo tekst błędu (pokazany też w powiadomieniu).
 * `deps` — do testów.
 */
export async function switchViewRole(
  next: ViewRoleId,
  deps?: { prod?: boolean; call?: Rpc; reload?: () => void; dbPreview?: boolean },
): Promise<string | null> {
  const store = useTowerStore.getState();
  const prod = deps?.prod ?? PROD_BUILD;
  if (!prod) {
    store.setRole(next);
    return null;
  }
  const inPreview = deps?.dbPreview ?? dbPreviewOn(getAuthProfile());
  if (next === 'HHL' && !inPreview) {
    store.setRole('HHL');
    return null;
  }
  if (next !== 'HHL' && inPreview && store.role === next) return null;
  try {
    const call = deps?.call ?? (await rpc());
    const { error } = next === 'HHL'
      ? await call('admin_preview_stop')
      : await call('admin_preview_start', { p_side: next });
    if (error) {
      const msg = previewErrorPl(error.message);
      store.pushToast(msg, 'HIGH');
      return msg;
    }
    (deps?.reload ?? requestAuthReload)();
    return null;
  } catch (e) {
    const msg = previewErrorPl(e instanceof Error ? e.message : String(e));
    store.pushToast(msg, 'HIGH');
    return msg;
  }
}
