/**
 * wyglad/P6-f — „Ten telefon”: czy Watch Tower działa jako zainstalowana aplikacja i przycisk „Zainstaluj aplikację”
 * (D-20261016-0310-01 Cz19 pkt 5, Cz23 pkt 4; polecenie właściciela 16.10.2026, 02:57: powiadomienie ma otwierać
 * zainstalowaną aplikację, nie Chrome). Zdarzenie `beforeinstallprompt` przychodzi raz, przy starcie strony — łapane
 * w `main.tsx`, zanim ekran się otworzy. Bez zapisów.
 */
import { useEffect, useState } from 'react';

interface BipEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export type InstallState =
  /** strona uruchomiona z ikony (tryb aplikacji) — powiadomienia otwierają aplikację */
  | 'app'
  /** przeglądarka proponuje instalację — przycisk „Zainstaluj aplikację” */
  | 'can-install'
  /** zainstalowano przed chwilą z tego ekranu */
  | 'installed'
  /** przeglądarka bez propozycji: aplikacja już zainstalowana albo instalacja niedostępna (np. iPhone — Safari) */
  | 'browser';

let deferred: BipEvent | null = null;
let installedNow = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function captureInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BipEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return !!nav.standalone || (typeof window.matchMedia === 'function'
    && ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some((m) => window.matchMedia(`(display-mode: ${m})`).matches));
}

export function installStateNow(env: { standalone: boolean; canPrompt: boolean; installedNow: boolean }): InstallState {
  if (env.standalone) return 'app';
  if (env.installedNow) return 'installed';
  return env.canPrompt ? 'can-install' : 'browser';
}

export function useInstallState(): { state: InstallState; install: (() => Promise<boolean>) | null } {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null;
    mq?.addEventListener?.('change', f);
    return () => { subs.delete(f); mq?.removeEventListener?.('change', f); };
  }, []);
  const state = installStateNow({ standalone: isStandalone(), canPrompt: !!deferred, installedNow });
  const install = deferred
    ? async () => {
      const ev = deferred;
      if (!ev) return false;
      await ev.prompt();
      const r = await ev.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
      deferred = null;
      if (r.outcome === 'accepted') installedNow = true;
      emit();
      return r.outcome === 'accepted';
    }
    : null;
  return { state, install };
}
