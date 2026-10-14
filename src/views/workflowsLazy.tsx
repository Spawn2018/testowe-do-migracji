/**
 * wyglad/P4-c — Automatyzacje (zakładki „Działa samo” i „Własne reguły” z kreatorem) poza pierwszym wczytaniem.
 * Pierwsze wczytanie ma budżet 400 kB gzip (`scripts/bundle-size.mjs`); widok otwiera tylko HHL. Bez zmiany działania.
 */
import { lazy, Suspense } from 'react';

const Workflows = lazy(() => import('./WorkflowsView').then((m) => ({ default: m.WorkflowsView })));

export function WorkflowsViewLazy() {
  return <Suspense fallback={null}><Workflows /></Suspense>;
}
