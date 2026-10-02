/**
 * Zastąpione przez jeden krok: node scripts/test-db-gate-step.mjs <zestaw>
 * Ten skrypt czyścił schemat przed każdym zestawem — już tego nie robi.
 */
console.error('ODMOWA: użyj node scripts/test-db-gate-step.mjs <prep|zestaw>');
console.error('Zestaw nie czyści schematu i nie nakłada migracji. Prep jest osobnym krokiem.');
process.exit(2);
