/**
 * wyglad/P6-e — wejście do Czatu z powiadomienia (D-20261016-0310-01 Cz18 pkt 3–4, Cz23 pkt 1–2):
 * `?zakladka=czat&odpowiedz=1` — kursor w polu wiadomości; `&tekst=…` — tekst niewysłanej odpowiedzi wpisany w pole.
 * Adres → jednorazowe polecenie dla panelu Czatu tego transportu; parametry znikają z adresu po odczytaniu. Bez zapisów.
 */
export interface ChatCompose { focus: boolean; text: string | null }

let pending: { loadId: string; v: ChatCompose } | null = null;

/** Z adresu transportu: czy jest polecenie dla pola wiadomości. */
export function composeFromSearch(search: string): ChatCompose | null {
  const q = new URLSearchParams(search);
  const text = q.get('tekst');
  const focus = q.get('odpowiedz') === '1' || !!text;
  return focus ? { focus, text: text ? text.slice(0, 2000) : null } : null;
}

export function setChatCompose(loadId: string, v: ChatCompose): void {
  pending = { loadId, v };
}

/** Panel Czatu bierze polecenie raz (i czyści parametry w adresie). */
export function takeChatCompose(loadId: string): ChatCompose | null {
  if (!pending || pending.loadId !== loadId) return null;
  const v = pending.v;
  pending = null;
  stripComposeParams();
  return v;
}

function stripComposeParams(): void {
  if (typeof window === 'undefined' || !window.location || !window.history) return;
  const raw = window.location.hash ?? '';
  const q = raw.indexOf('?');
  if (q < 0) return;
  const params = new URLSearchParams(raw.slice(q + 1));
  if (!params.has('odpowiedz') && !params.has('tekst')) return;
  params.delete('odpowiedz');
  params.delete('tekst');
  const rest = params.toString();
  const next = `${raw.slice(0, q)}${rest ? `?${rest}` : ''}`;
  try {
    window.history.replaceState(window.history.state, '', next);
  } catch { /* adres zostaje — bez skutku dla pola */ }
}
