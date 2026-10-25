/**
 * A6 F7 #556 — pomijaj import_schedule tylko po udanym przebiegu z tym samym hashem.
 * Błąd parse/import zapisuje failed_hash (nie hash) → ten sam plik woła import ponownie.
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
  // Ten sam hash: pomiń, chyba że poprzednio był tylko dry_run, a teraz import_enabled.
  return !args.importEnabled || !args.prevDryOnly;
}
