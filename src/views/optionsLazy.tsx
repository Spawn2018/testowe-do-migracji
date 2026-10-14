/**
 * wyglad/P3-c — Opcje (HHL) i Ustawienia (KSH, SCX) poza pierwszym wczytaniem.
 * Ekrany E11/E12 z menu bocznym są duże, a pierwsze wczytanie ma budżet 400 kB gzip (`scripts/bundle-size.mjs`).
 * Bez zmiany działania: ekran wskazany z menu konta czeka w `openOptions.ts` (takeOptionsScreen) do zamontowania widoku.
 */
import { lazy, Suspense } from 'react';

const Options = lazy(() => import('./OptionsView').then((m) => ({ default: m.OptionsView })));
const Settings = lazy(() => import('./SettingsView').then((m) => ({ default: m.SettingsView })));

export function OptionsViewLazy() {
  return <Suspense fallback={null}><Options /></Suspense>;
}

export function SettingsViewLazy() {
  return <Suspense fallback={null}><Settings /></Suspense>;
}
