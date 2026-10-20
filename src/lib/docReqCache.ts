/**
 * wyglad/P5 — ostatnio odczytane wymagania dokumentów i ich stan (strona Dokumenty odczytuje je z bazy).
 * Panel transportu korzysta z tego samego odczytu zamiast własnego zapytania (F8); bez odczytu w produkcji
 * panel pokazuje tylko „jest / brak” bez terminów, żeby nie różnić się od strony Dokumenty.
 * D-20261020-1118-01: Harmonogram i panel czytają stan sami (`useDocReqCache`), nie dopiero po wejściu na Dokumenty.
 */
import { useEffect, useState } from 'react';
import type { DocRequirement, DocStatusRow } from './docRequirements';
import { DEFAULT_DOC_REQUIREMENTS } from './docRequirements';

let cache: { reqs: DocRequirement[]; status: DocStatusRow[] } | null = null;
const listeners = new Set<() => void>();

export function setDocReqCache(reqs: DocRequirement[], status: DocStatusRow[]): void {
  cache = { reqs, status };
  for (const f of listeners) f();
}

export function getDocReqCache(): { reqs: DocRequirement[]; status: DocStatusRow[] } | null {
  return cache;
}

let inflight: Promise<void> | null = null;
/** Odczyt z bazy (produkcja); jeden naraz. Błąd — zostaje poprzedni stan. */
function fetchDocReqs(): Promise<void> {
  inflight ??= import('../data/docRequirementsServer')
    .then((m) => m.loadDocRequirements())
    .then((r) => setDocReqCache(r.reqs.length ? r.reqs : DEFAULT_DOC_REQUIREMENTS, r.status))
    .catch(() => { /* brak odczytu → bez terminów, jak dotąd */ })
    .finally(() => { inflight = null; });
  return inflight;
}

/**
 * Stan dokumentów z bazy dla widoku (produkcja): odczyt przy wejściu i przy zmianie `refreshKey`
 * (np. liczby dokumentów). Demo — bez odczytu. Zwraca aktualną pamięć podręczną.
 */
export function useDocReqCache(refreshKey: unknown): { reqs: DocRequirement[]; status: DocStatusRow[] } | null {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    void fetchDocReqs();
  }, [refreshKey]);
  return cache;
}
