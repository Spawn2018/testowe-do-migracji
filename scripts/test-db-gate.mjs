/**
 * Pełny przebieg w jednym procesie jest wyłączony (zadanie w tle max 40 min).
 * Krok:  node scripts/test-db-gate-step.mjs <prep|zestaw>
 * Dalej: node scripts/test-db-gate-step.mjs next
 * Werdykt: node scripts/test-db-gate-summary.mjs
 */
console.error('ODMOWA: pełny przebieg bramy w jednym procesie jest wyłączony.');
console.error('Krok:    node scripts/test-db-gate-step.mjs <prep|zestaw>');
console.error('Następny: node scripts/test-db-gate-step.mjs next');
console.error('Werdykt: node scripts/test-db-gate-summary.mjs');
process.exit(2);
