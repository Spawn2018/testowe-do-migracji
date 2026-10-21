/**
 * wyglad/W-opcje-live-1 — wspólne pomocniki ekranów Opcji na produkcji (Live*.tsx): osoby z `app_users`,
 * rodzaj konta, pobieranie pliku, CSV i sygnał „ustawienia się zmieniły” (stany w menu i na kafelkach).
 * Tylko odczyt i te same RPC co dawne formularze w `src/auth/*`.
 */
import type { AccountKind } from '../components/options/types';

export type PersonDb = {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  org_id: string;
  must_set_password?: boolean | null;
};

/** Rola z bazy (7 wartości) → jeden z 5 rodzajów kont (E11 13:21: „KSH — administrator” i „Plac budowy” znikają). */
export function kindOf(role: string): AccountKind {
  if (role === 'HHL_ADMIN' || role === 'HHL_OPS' || role === 'CARRIER_DISPATCH' || role === 'CARRIER_USER') return role;
  return 'CLIENT_USER';
}

export function personName(u: Pick<PersonDb, 'full_name' | 'first_name' | 'last_name' | 'email'>): string {
  const parts = [u.first_name, u.last_name].filter((x) => x && x.trim()).join(' ').trim();
  return (u.full_name?.trim() || parts) || u.email || '—';
}

/** Pobranie pliku w przeglądarce (jak dawny eksport). */
export function triggerDownload(bytes: Uint8Array, filename: string, mime: string): void {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((c) => {
      const s = String(c ?? '');
      return /[;"\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(';'))
    .join('\n');
}

export async function downloadTable(all: (string | number)[][], base: string, fmt: 'csv' | 'xlsx', sheet: string): Promise<void> {
  if (fmt === 'csv') {
    triggerDownload(new TextEncoder().encode('﻿' + toCsv(all)), `${base}.csv`, 'text/csv;charset=utf-8');
    return;
  }
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WATCH TOWER';
  const ws = wb.addWorksheet(sheet);
  for (const r of all) ws.addRow(r);
  ws.getRow(1).font = { bold: true };
  const raw = await wb.xlsx.writeBuffer();
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
  triggerDownload(bytes, `${base}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/** Przełącznik 0/1 w `ops_thresholds` (0240): ciche uzupełnienie godzin z pliku KSH — nie jest progiem. */
export const QUIET_KEY = 'import_quiet_hours';

/** Po zapisie w ekranie: Opcje odświeżają stany przy pozycjach menu i na kafelkach telefonu. */
export const OPTIONS_CHANGED_EVENT = 'wt-options-changed';
export function announceOptionsChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPTIONS_CHANGED_EVENT));
}
