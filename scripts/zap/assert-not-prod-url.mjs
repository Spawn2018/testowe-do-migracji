#!/usr/bin/env node
/**
 * Odrzuca URL produkcji Watch Tower — Active Scan zabroniony.
 * Exit 0 = OK (TEST), exit 3 = prod forbidden.
 */
import { isProdZapTarget, assertActiveScanAllowed } from './prodGuard.mjs';

const url = process.argv[2] || '';
try {
  assertActiveScanAllowed(url);
  console.log(`OK: Active Scan dozwolony dla ${url}`);
  process.exit(0);
} catch (e) {
  console.error(String(e.message || e));
  process.exit(isProdZapTarget(url) ? 3 : 1);
}
