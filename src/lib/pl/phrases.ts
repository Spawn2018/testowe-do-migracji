/**
 * PL-DATA — słownik zwrotów (krok 1, przed pamięcią tłumaczeń i DeepL).
 * Dłuższe zwroty pierwsze. Wynik wolno pokazać tylko, gdy nie zostaje szwedzkie słowo.
 */

const PAIRS: [string, string][] = [
  ['ett körfält avstängt', 'jeden pas zamknięty'],
  ['ett korfalt avstangt', 'jeden pas zamknięty'],
  ['kö kan uppstå', 'może powstać korek'],
  ['ko kan uppsta', 'może powstać korek'],
  ['vägen avstängd', 'droga zamknięta'],
  ['vagen avstangd', 'droga zamknięta'],
  ['i södergående riktning', 'w kierunku południowym'],
  ['i norrgående riktning', 'w kierunku północnym'],
  ['i södergående', 'w kierunku południowym'],
  ['i norrgående', 'w kierunku północnym'],
  ['risk for halka', 'ryzyko śliskości'],
  ['risk för halka', 'ryzyko śliskości'],
  ['trafikolycka', 'wypadek drogowy'],
  ['blixthalka', 'gołoledź'],
  ['packad snö', 'ubity śnieg'],
  ['lös snö', 'luźny śnieg'],
  ['våt vägbana', 'mokra nawierzchnia'],
  ['torr vägbana', 'sucha nawierzchnia'],
  ['fläckvis halka', 'miejscami ślisko'],
  ['norr om', 'na północ od'],
  ['söder om', 'na południe od'],
  ['öster om', 'na wschód od'],
  ['väster om', 'na zachód od'],
  ['vägarbete', 'roboty drogowe'],
  ['olycka', 'wypadek'],
  ['halka', 'ślisko'],
  ['snöyra', 'śnieżyca'],
  ['snö', 'śnieg'],
  ['isigt', 'oblodzenie'],
  ['modd', 'błoto pośniegowe'],
  ['slask', 'mokry śnieg'],
  ['glatt', 'ślisko'],
  ['frost', 'szron'],
  ['normalt', 'normalnie'],
  ['avstängt', 'zamknięte'],
  ['avstängd', 'zamknięta'],
  ['körfält', 'pas ruchu'],
  ['vägen', 'droga'],
];

const SWEDISH_WORD = /\b(och|ett|en|av|på|for|för|med|som|vid|norr|söder|öster|väster|vägen|väg|körfält|avstängt|avstängd|kö|kan|uppstå|halka|olycka|vägarbete|trafikolycka|riktning|södergående|norrgående|besvärligt|normalt|snö|isigt|modd|slask|blixthalka|arbete|om|avstängning|påfarten|tillfällig|från|till|mellan|båda|riktningarna|län|mot|kommun|trafikplats|cirkulationsplats)\b/i;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function applyPhrases(text: string): { pl: string; covered: boolean } {
  let out = text;
  const sorted = [...PAIRS].sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of sorted) {
    out = out.replace(new RegExp(escapeRe(from), 'gi'), to);
  }
  const covered = out.trim().length > 0 && !SWEDISH_WORD.test(out);
  return { pl: out.trim(), covered };
}

export function hasSwedishWords(text: string): boolean {
  return SWEDISH_WORD.test(text);
}
