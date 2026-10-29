/**
 * #637 F7: prod wymaga write_test_ok_at; tryb test / udany test → idź do kolejki.
 * import_enabled nie bramkuje (osobno w SQL/Edge).
 */
export function outboundWriteProdGate(args: {
  fileMode?: 'test' | 'prod';
  writeTestOkAt?: string | null;
}): { block: true; write_reason: 'write_test_required' } | { block: false } {
  if (args.fileMode === 'prod' && !args.writeTestOkAt) {
    return { block: true, write_reason: 'write_test_required' };
  }
  return { block: false };
}
