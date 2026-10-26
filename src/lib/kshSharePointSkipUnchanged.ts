/**
 * A6 F7 #556 — lustro Edge `_shared/ksh/skipUnchanged.ts` (testy unit).
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
  return !args.importEnabled || !args.prevDryOnly;
}
