/** A8 / C15: po 3× odmowie hasła (login_failed) — jedna próba na 6 h, aż zmieni się sekret.
 *  Wyjątek sieci, czas i 5xx nie wchodzą do serii (D-20261017-1920-01). */

export const EMTRACK_LOGIN_FAILS = 3;
export const EMTRACK_RETRY_MS = 6 * 60 * 60 * 1000;

export type EmtrackLoginState = {
  failStreak: number;
  skippedUntil: string | null;
  secretFp: string | null;
};

/** Odcisk loginu i hasła — tylko po to, żeby zauważyć zmianę sekretu. Nie jest hasłem. */
export function emtrackSecretFp(login: string, password: string): string {
  let h = 5381;
  const s = `${login}\0${password}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h, 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export function emtrackLoginFresh(prev: EmtrackLoginState | null, secretFp: string): EmtrackLoginState {
  if (!prev || prev.secretFp !== secretFp) {
    return { failStreak: 0, skippedUntil: null, secretFp };
  }
  return { ...prev, secretFp };
}

export function emtrackLoginSkipped(state: EmtrackLoginState, now: Date): boolean {
  if (state.skippedUntil == null) return false;
  return Date.parse(state.skippedUntil) > now.getTime();
}

export function emtrackLoginFail(state: EmtrackLoginState, now: Date): EmtrackLoginState {
  const failStreak = state.failStreak + 1;
  const skippedUntil = failStreak >= EMTRACK_LOGIN_FAILS
    ? new Date(now.getTime() + EMTRACK_RETRY_MS).toISOString()
    : state.skippedUntil;
  return { ...state, failStreak, skippedUntil };
}

export function emtrackLoginOk(state: EmtrackLoginState): EmtrackLoginState {
  return { failStreak: 0, skippedUntil: null, secretFp: state.secretFp };
}

/** Stan systemu: `SourceRow.nextTryAt` (D-20261017-1715-01 §2 pkt 5). Widok podłączy to przy danych P10b-c. */
export function emtrackNextTryAt(state: EmtrackLoginState | null): string | null {
  return state?.skippedUntil ?? null;
}
