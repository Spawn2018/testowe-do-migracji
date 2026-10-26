/**
 * A6 F7 #556 — pomijaj import_schedule tylko po udanym przebiegu z tym samym hashem.
 * Błąd parse/import zapisuje failed_hash (nie hash) → ten sam plik woła import ponownie.
 * #567 23B: przy wyłączonym imporcie (sam dry_run) NIGDY nie skipuj — lista zmian
 * musi liczyć się przy każdym przebiegu (WT mogło się zmienić przy tym samym pliku).
 */
export function shouldSkipUnchangedImport(args: {
  prevHash: string | null;
  hash: string;
  importEnabled: boolean;
  prevDryOnly: boolean;
  sourceOk: boolean;
  lastError: string | null | undefined;
}): boolean {
  if (!(args.sourceOk && !args.lastError)) return false;
  if (!args.prevHash || args.prevHash !== args.hash) return false;
  // 23B: podgląd zawsze przeliczaj.
  if (!args.importEnabled) return false;
  // Ten sam hash + import włączony: pomiń, chyba że poprzednio był tylko dry_run.
  return !args.prevDryOnly;
}
