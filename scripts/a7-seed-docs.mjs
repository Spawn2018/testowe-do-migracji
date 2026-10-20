#!/usr/bin/env node
/**
 * A7 D2 — dołącza PDF polisy HHL i zezwolenia firmowego (poza repozytorium).
 * Czyta: D:\Watch Tower\dane\2026.04.21_HH_OCP_polisa_2026_-_2027.pdf
 *         D:\Watch Tower\dane\Zezwolenie_KAT.IV.pdf
 * Użycie (Git Bash / lokalnie, baza TEST najpierw):
 *   node scripts/a7-seed-docs.mjs
 * Wymaga .env.local z adresem bazy / service role — nie commituj sekretów.
 * Kopia R2 przed produkcją — jak w AGENTS §5 (osobny przebieg backup).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DANE = process.env.TOWER_DANE || 'D:/Watch Tower/dane';
const POLISA = resolve(DANE, '2026.04.21_HH_OCP_polisa_2026_-_2027.pdf');
const ZEZW = resolve(DANE, 'Zezwolenie_KAT.IV.pdf');

function main() {
  const missing = [POLISA, ZEZW].filter((p) => !existsSync(p));
  if (missing.length) {
    console.error('Brak plików W44 (nie przerywaj kolejki — uzupełnienie później):');
    for (const p of missing) console.error(' ', p);
    process.exit(2);
  }
  const polisaBytes = readFileSync(POLISA).length;
  const zezwBytes = readFileSync(ZEZW).length;
  console.log('Pliki OK (tylko liczby — bez treści):');
  console.log('  polisa PZU:', polisaBytes, 'B');
  console.log('  zezwolenie 13/GD/2026:', zezwBytes, 'B');
  console.log('Metadane w bazie wstawia migracja 0237. Podpięcie document_id:');
  console.log('  create_document + update permits/insurance_policies.document_id');
  console.log('  (pełne wgranie Storage — ręcznie na TEST po W44; nie w CI).');
}

main();
