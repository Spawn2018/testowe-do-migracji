export type ImportSkips = { carrier?: number | null; empty?: number | null; standard?: number | null };
export function importSkipText(_s: ImportSkips): string | null { return null; }
export function standardSkipMessage(imported: number, _skipped: number, _more: Omit<ImportSkips, 'standard'> = {}): string {
  return `Zaimportowano ${imported} transporty.`;
}
