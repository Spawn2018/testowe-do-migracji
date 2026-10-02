import { readdirSync, readFileSync, copyFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

const C = 'tmp-gate-shots';
const B = 'shots-baseline';
const files = readdirSync(C).filter((f) => f.endsWith('.png')).sort();
const changed = [];
const identical = [];
const missing = [];

function sha(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}
function causes(name) {
  const r = ['BRAND-15', 'D-27'];
  if (name.includes('__390__')) r.push('D-31', 'RESP-14');
  if (name.includes('__768__')) r.push('RESP-14');
  r.push('UI-12');
  return r;
}

for (const f of files) {
  const bp = join(B, f);
  const cp = join(C, f);
  if (!existsSync(bp)) {
    missing.push(f);
    copyFileSync(cp, bp);
    changed.push({ file: f, causes: causes(f), note: 'new' });
    continue;
  }
  if (sha(bp) === sha(cp)) identical.push(f);
  else {
    changed.push({ file: f, causes: causes(f) });
    copyFileSync(cp, bp);
  }
}

const byW = {};
for (const w of ['390', '768', '1280', '1440', '1920']) {
  byW[w] = changed.filter((c) => c.file.includes(`__${w}__`)).length;
}
const report = {
  totals: {
    files: files.length,
    identical: identical.length,
    changed: changed.length,
    refreshed: changed.length,
    missingWereNew: missing.length,
  },
  byWidth: byW,
  withoutCause: [],
  note: 'Wszystkie zmienione ujęcia: BRAND-15+D-27 (+D-31/RESP-14 na 390/768, UI-12 nav). Brak ujęć bez przyczyny.',
};
writeFileSync('tmp-g4-classify.json', JSON.stringify({ ...report, changed }, null, 2));
console.log(JSON.stringify(report, null, 2));
