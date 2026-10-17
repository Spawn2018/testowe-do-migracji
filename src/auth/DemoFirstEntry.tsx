/**
 * wyglad/P10b-d (E37 pkt 9): podgląd pierwszego wejścia w demo (`pierwsze-wejscie=1` / `=telefon`) zamiast aplikacji,
 * do „Zaczynam”. Produkcja: zawsze aplikacja — pierwsze wejście prowadzi logowanie (AuthGate). Warunek trybu wpisany
 * wprost (I-0): w buildzie produkcyjnym gałąź jest martwa i ekrany demo nie trafiają do paczki.
 */
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { firstEntryDemoMode } from '../lib/firstEntryFlag';
import { lazyRetry } from '../lib/lazyRetry';

const FirstEntryDemo = import.meta.env.VITE_AUTH_MODE !== 'supabase' ? lazy(lazyRetry(() => import('./FirstEntryDemo'))) : null;

export function DemoFirstEntry({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState(() => (FirstEntryDemo ? firstEntryDemoMode() : null));
  if (!mode || !FirstEntryDemo) return children;
  return <Suspense fallback={null}><FirstEntryDemo mode={mode} onDone={() => setMode(null)} /></Suspense>;
}
