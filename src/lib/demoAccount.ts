/**
 * wyglad/W-konta — rodzaj konta w trybie demo (audyt 17.10 §7: „Role HHL Operacje i SCX Użytkownik w demo nie istnieją
 * w przełączniku”). Demo bez logowania pokazuje domyślnie Administratora HHL, Użytkownika KSH i Dyspozytora SCX.
 * Tu można przejść na drugi rodzaj konta firmy: Operacje HHL albo Użytkownik SCX — żeby obejrzeć widok „tylko do odczytu”
 * (E9) bez produkcji. Wybór żyje w karcie przeglądarki (sessionStorage, z try/catch) albo w adresie `#/…?konto=operacje`.
 * Na produkcji nie działa: rodzaj konta pochodzi z profilu (`accountRole.ts`).
 */
export type DemoAccountKind = 'HHL_OPS' | 'CARRIER_USER';

const KEY = 'wt-demo-account';
const FROM_PARAM: Record<string, DemoAccountKind> = { operacje: 'HHL_OPS', uzytkownik: 'CARRIER_USER' };
let cached: DemoAccountKind | null | undefined;

function fromAddress(): DemoAccountKind | null | undefined {
  if (typeof window === 'undefined' || !window.location) return undefined;
  const hash = window.location.hash || '';
  const q = hash.indexOf('?');
  const v = (q >= 0 ? new URLSearchParams(hash.slice(q + 1)).get('konto') : null) ?? new URLSearchParams(window.location.search).get('konto');
  if (v == null) return undefined;
  return FROM_PARAM[v] ?? null;
}

/** Wybrany drugi rodzaj konta albo `null` (konto domyślne firmy). */
export function demoAccountKind(): DemoAccountKind | null {
  const addr = fromAddress();
  if (addr !== undefined) return addr;
  if (cached !== undefined) return cached;
  try {
    const v = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(KEY);
    cached = v === 'HHL_OPS' || v === 'CARRIER_USER' ? v : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function setDemoAccountKind(kind: DemoAccountKind | null): void {
  cached = kind;
  try {
    if (kind) sessionStorage.setItem(KEY, kind);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* tryb prywatny — wybór działa do przeładowania strony */
  }
}

/** Test: wyczyść pamięć modułu. */
export function resetDemoAccountCache(): void {
  cached = undefined;
}
