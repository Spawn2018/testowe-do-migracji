/**
 * III-2 (SCOPE 0.1, 0.3) — suma kontrolna arkusza wobec makiety v2.0: każda deklaracja z `docs/claude/referencje/tower.css`
 * (arkusz wyjęty z makiety 1:1) musi mieć w `src/index.css` tę samą wartość dla tego samego selektora (także w @media),
 * po rozwinięciu tokenów `var(--…)` z :root. Odstępstwa tylko z listy ODSTEPSTWA — każde z uzasadnieniem i źródłem.
 * Nowa różnica (zmiana koloru, odstępu, fontu, promienia) = test czerwony, zanim trafi do repozytorium.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import postcss, { type Rule } from 'postcss';

const REF = readFileSync('docs/claude/referencje/tower.css', 'utf8');
const APP = readFileSync('src/index.css', 'utf8');
const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim();

/** klucz „selektor|właściwość” → uzasadnienie (źródło w dokumentacji) */
const ODSTEPSTWA: Record<string, string> = {
  'th.stick|box-shadow': 'NAPRAWY D9: cień → border-left (zakaz cieni)',
  'td.stick|box-shadow': 'NAPRAWY D9: cień → border-left (zakaz cieni)',
  '.wf .sw|border-radius': 'NAPRAWY D9: 9px → 50% (promień > 2px), kształt bez zmian',
  '.tablewrap|overflow': 'CHAT_GAP_AUDIT BATCH-SCROLL: przewijanie strony zamiast wewnętrznego (wyjątek: geofence)',
  '.tablewrap|max-height': 'CHAT_GAP_AUDIT BATCH-SCROLL (geofence przywraca calc(100vh - 260px))',
  '.mlist|overflow-y': 'CHAT_GAP_AUDIT BATCH-SCROLL: lista mapy bez wewnętrznego przewijania',
  '.mlist|max-height': 'CHAT_GAP_AUDIT BATCH-SCROLL',
  '.sronly|clip': 'clip (przestarzałe) → clip-path:inset(50%), ten sam efekt',
  '@media (prefers-reduced-motion:reduce) *|transition': 'F2.3 (6f77f7e, stylelint): globalne !important zastąpione regułami celowanymi (.skel i, .wf .sw::after, .section-grip)',
  '@media (prefers-reduced-motion:reduce) *|animation': 'F2.3 (6f77f7e): jw.',
  '.mapbox svg|display': 'FIX_MORNING: jw. (reguła .mapbox svg usunięta)',
  '.mapbox svg|width': 'FIX_MORNING: rozciąganie SVG psuło warstwy Leaflet (mapa SVG makiety → Leaflet)',
  '.mapbox svg|height': 'FIX_MORNING: jw.',
};

function vars(css: string) {
  const v = new Map<string, string>();
  postcss.parse(css).walkRules((r) => { if (r.selector.trim() === ':root') r.walkDecls((d) => { if (d.prop.startsWith('--')) v.set(d.prop, norm(d.value)); }); });
  return v;
}
function resolve(value: string, v: Map<string, string>): string {
  let s = value;
  for (let i = 0; i < 5 && s.includes('var('); i++) s = s.replace(/var\((--[\w-]+)(?:,[^)]*)?\)/g, (_, n: string) => v.get(n) ?? `var(${n})`);
  return norm(s);
}
/** „selektor” (pojedynczy, z kontekstem @media) → właściwość → wartość (ostatnia wygrywa, jak w kaskadzie) */
function decls(css: string) {
  const v = vars(css);
  const m = new Map<string, Map<string, string>>();
  postcss.parse(css).walkRules((r: Rule) => {
    if (r.parent?.type === 'atrule' && /keyframes/.test((r.parent as { name?: string }).name ?? '')) return;
    const at = r.parent?.type === 'atrule' ? `@${(r.parent as { name: string }).name} ${norm((r.parent as { params: string }).params)} ` : '';
    for (const sel of r.selectors) {
      const k = at + norm(sel);
      const d = m.get(k) ?? new Map<string, string>();
      r.walkDecls((x) => { d.set(x.prop, resolve(x.value, v) + (x.important ? ' !important' : '')); });
      m.set(k, d);
    }
  });
  return m;
}
/** Rodzina fontu: porównujemy pierwszą (używaną) rodzinę — zapasowe mogą się różnić. */
const same = (prop: string, a: string, b: string) =>
  prop === 'font-family' ? a.split(',')[0].replace(/"/g, '') === b.split(',')[0].replace(/"/g, '') : a === b;

describe('III-2: arkusz aplikacji wobec makiety v2.0', () => {
  const ref = decls(REF);
  const app = decls(APP);

  it('arkusz referencyjny nie zmieniony (suma kontrolna)', () => {
    expect(ref.size).toBeGreaterThan(200);
    expect(createHash('sha256').update(REF).digest('hex').slice(0, 16)).toBe(SUMA_REF);
  });

  it('tokeny :root makiety mają te same wartości', () => {
    const rv = vars(REF), av = vars(APP);
    const zle = [...rv].filter(([k, x]) => av.get(k) !== x && !(k.startsWith('--font') && same('font-family', x, av.get(k) ?? '')));
    expect(zle).toEqual([]);
  });

  it('każda deklaracja makiety ma w aplikacji tę samą wartość (poza listą odstępstw)', () => {
    const roznice: string[] = [];
    for (const [sel, d] of ref) {
      const a = app.get(sel);
      for (const [prop, val] of d) {
        const key = `${sel}|${prop}`;
        if (ODSTEPSTWA[key]) continue;
        if (!a || !a.has(prop)) { roznice.push(`${key}: brak (makieta: ${val})`); continue; }
        if (!same(prop, val, a.get(prop)!)) roznice.push(`${key}: ${a.get(prop)} (makieta: ${val})`);
      }
    }
    expect(roznice).toEqual([]);
  });

  it('lista odstępstw bez martwych wpisów (każde nadal występuje)', () => {
    const martwe = Object.keys(ODSTEPSTWA).filter((key) => {
      const [sel, prop] = key.split('|');
      const r = ref.get(sel)?.get(prop);
      if (r === undefined) return true;
      const a = app.get(sel)?.get(prop);
      return a !== undefined && same(prop, r, a);
    });
    expect(martwe).toEqual([]);
  });
});
const SUMA_REF = '9eb97d583d327c1b';
