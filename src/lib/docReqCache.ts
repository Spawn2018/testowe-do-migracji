/**
 * wyglad/P5 — ostatnio odczytane wymagania dokumentów i ich stan (strona Dokumenty odczytuje je z bazy).
 * Panel transportu korzysta z tego samego odczytu zamiast własnego zapytania (F8); bez odczytu w produkcji
 * panel pokazuje tylko „jest / brak” bez terminów, żeby nie różnić się od strony Dokumenty.
 */
import type { DocRequirement, DocStatusRow } from './docRequirements';

let cache: { reqs: DocRequirement[]; status: DocStatusRow[] } | null = null;

export function setDocReqCache(reqs: DocRequirement[], status: DocStatusRow[]): void {
  cache = { reqs, status };
}

export function getDocReqCache(): { reqs: DocRequirement[]; status: DocStatusRow[] } | null {
  return cache;
}
