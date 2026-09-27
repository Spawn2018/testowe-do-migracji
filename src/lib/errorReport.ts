/**
 * I-6 — błędy przeglądarki do tabeli `client_errors` (RPC report_client_error, 0058). Tylko build produkcyjny
 * (leniwy import z main.tsx). Limity po stronie klienta: 10 zgłoszeń na kartę, ten sam komunikat raz na 60 s.
 * Ścieżka bez zapytania, a tokeny kierowcy i JWT wycięte (baza czyści drugi raz).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const MAX_PER_TAB = 10;
export const SAME_MSG_MS = 60_000;

export function safePath(href: string): string {
  try {
    const u = new URL(href);
    return (u.pathname + u.hash).replace(/wt_[0-9a-fA-F]{16,}/g, 'wt_…').replace(/#.*(access_token|refresh_token|token)=.*/i, '#…').slice(0, 300);
  } catch { return ''; }
}

export function buildId(doc: Pick<Document, 'querySelector'> = document): string {
  const src = doc.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.src ?? '';
  return /index-([A-Za-z0-9_-]+)\.js/.exec(src)?.[1] ?? 'dev';
}

export function makeGate(now: () => number = Date.now) {
  let sent = 0;
  const last = new Map<string, number>();
  return (msg: string): boolean => {
    if (sent >= MAX_PER_TAB) return false;
    const t = now(); const prev = last.get(msg);
    if (prev !== undefined && t - prev < SAME_MSG_MS) return false;
    last.set(msg, t); sent++;
    return true;
  };
}

function describe(reason: unknown): { message: string; stack: string | null } {
  if (reason instanceof Error) return { message: `${reason.name}: ${reason.message}`, stack: reason.stack ?? null };
  try { return { message: typeof reason === 'string' ? reason : JSON.stringify(reason) ?? String(reason), stack: null }; }
  catch { return { message: String(reason), stack: null }; }
}

export function installErrorReporter(getSb: () => Promise<SupabaseClient>): () => void {
  const gate = makeGate();
  const build = buildId();
  const send = (kind: 'error' | 'rejection', message: string, stack: string | null) => {
    const msg = message.trim().slice(0, 1000);
    if (!msg || !gate(msg)) return;
    void getSb().then((sb) => sb.rpc('report_client_error', {
      p_kind: kind, p_message: msg, p_stack: stack?.slice(0, 4000) ?? null,
      p_path: safePath(location.href), p_build: build, p_ua: navigator.userAgent.slice(0, 300),
    })).catch(() => { /* zgłaszanie nie może samo generować błędów */ });
  };
  const onError = (e: ErrorEvent) => {
    if (!e.message && !e.error) return;                 // błąd ładowania zasobu (img/script) — poza zakresem
    const d = e.error ? describe(e.error) : { message: e.message, stack: null };
    send('error', d.message, d.stack ?? (e.filename ? `\n    at ${safePath(e.filename)}:${e.lineno}:${e.colno}` : null));
  };
  const onRejection = (e: PromiseRejectionEvent) => { const d = describe(e.reason); send('rejection', d.message, d.stack); };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
}
