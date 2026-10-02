/**
 * Werdykt bramy TEST. Zielony tylko gdy na BIEŻĄCYM commicie i ostatniej migracji
 * każdy krok (części nullguard/i2 zsumowane) ma ostatni status ok i oczekiwane OK.
 * Wpisy z innego commita są ignorowane. Ostatni wpis zestawu wygrywa
 * (wcześniejsze przerwanie nie blokuje, jeśli wznowienie jest ok).
 *
 *   node scripts/test-db-gate-summary.mjs
 */
import { gateSteps, EXPECTED } from './lib/gate-suites.mjs';
import { gitCommit, lastMigration, latestFor } from './lib/gate-results.mjs';

const { steps, order } = gateSteps();
const commit = gitCommit();
const migration = lastMigration();
const map = latestFor(commit, migration);

let green = true;
const groups = new Map();
console.log(`commit=${commit}`);
console.log(`migration=${migration}`);

for (const name of order) {
  const e = map.get(name);
  const exp = name === 'prep' ? 1 : steps[name].expected;
  if (!e) {
    console.log(`${name}: BRAK`);
    green = false;
    continue;
  }
  const countOk = e.status === 'ok' && e.fail === 0 && e.ok === exp;
  if (!countOk) green = false;
  console.log(`${name}: ${e.ok} OK, ${e.fail} FAIL, ${e.skip} SKIP (oczekiwano ${exp}) [${e.status}] ${countOk ? 'OK' : 'NIE'}`);
  const g = steps[name]?.group;
  if (g) {
    if (!groups.has(g)) groups.set(g, { ok: 0, fail: 0, parts: 0, bad: false });
    const bucket = groups.get(g);
    bucket.ok += Number(e.ok) || 0;
    bucket.fail += Number(e.fail) || 0;
    bucket.parts += 1;
    if (e.status !== 'ok') bucket.bad = true;
  }
}

for (const [g, b] of groups) {
  const exp = EXPECTED[g];
  const partCount = order.filter((n) => steps[n]?.group === g).length;
  const ok = !b.bad && b.parts === partCount && b.fail === 0 && b.ok === exp;
  if (!ok) green = false;
  console.log(`SUMA ${g}: ${b.ok}/${exp} OK, fail=${b.fail} [${ok ? 'OK' : 'NIE'}]`);
}

if (green) console.log('BRAMA: ZIELONA');
else console.log('BRAMA: CZERWONA');
process.exit(green ? 0 : 1);
