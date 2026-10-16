/**
 * wyglad/P8-a — odczyt pola z klockami (TokenEditor) do fragmentów treści. Osobny plik, żeby komponent eksportował
 * tylko komponent (szybkie odświeżanie) i żeby odczyt dało się sprawdzić testem.
 */
import { TOKEN_LABEL, normalize, parseMarkers, type Seg, type TokenId } from './p8Texts';

/** DOM pola → fragmenty. Inne elementy (np. <div> z Enter w niektórych przeglądarkach) dają nową linię; odstępy na samym końcu nie liczą się. */
export function readSegs(el: Node): Seg[] {
  const out: Seg[] = [];
  const walk = (n: Node, top: boolean) => {
    n.childNodes.forEach((c, i) => {
      if (c.nodeType === Node.TEXT_NODE) { out.push({ k: 'txt', v: c.textContent ?? '' }); return; }
      if (!(c instanceof HTMLElement)) return;
      const tok = c.dataset.tok as TokenId | undefined;
      if (tok && tok in TOKEN_LABEL) { out.push({ k: 'tok', id: tok }); return; }
      if (c.tagName === 'BR') { out.push({ k: 'txt', v: '\n' }); return; }
      if ((c.tagName === 'DIV' || c.tagName === 'P') && (i > 0 || !top)) out.push({ k: 'txt', v: '\n' });
      walk(c, false);
    });
  };
  walk(el, true);
  /* wpisany albo wklejony znacznik „{{code}}” liczy się jak klocek — podgląd i zapis od razu tak, jak po ponownym otwarciu */
  const segs = normalize(normalize(out).flatMap((x) => (x.k === 'txt' ? parseMarkers(x.v) : [x])));
  /* odstępy i nowe linie na samym końcu (także „\n” na zapas z Enter na końcu pola) nie są częścią treści */
  const last = segs[segs.length - 1];
  if (last?.k === 'txt') {
    const v = last.v.replace(/\s+$/, '');
    if (v) segs[segs.length - 1] = { k: 'txt', v };
    else segs.pop();
  }
  return segs;
}
