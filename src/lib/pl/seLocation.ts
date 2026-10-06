/**
 * AUD-04 (A4) — opis miejsca z Trafikverket (LocationDescriptor / tytuł sytuacji) po polsku ze słownika stałych słów,
 * BEZ DeepL. Nazwy miejscowości zostają oryginalne. Przykład:
 *   „E4: från Hörnefors till Stöcksjö båda riktningarna i Västerbottens län (AC)”
 *   → „E4: od Hörnefors do Stöcksjö, oba kierunki, region Västerbotten”
 * Zasady: „län” i kod litery regionu znikają; „båda riktningarna” → „oba kierunki”; „i riktning mot X” → „w kierunku X”;
 * „mellan X och Y” → „między X a Y”; „Trafikplats” → „węzeł”, „Cirkulationsplats” → „rondo”; „X kommun” → „gmina X”.
 * Funkcja jest czysta i idempotentna (tekst już polski przechodzi bez zmian) — używana przy pobraniu (Edge) i przy
 * wyświetlaniu tytułów zapisanych wcześniej w bazie.
 */

/** Regiony (län) — dopełniacz → mianownik. Nieznany region: zdjęte końcowe „s” dopełniacza. */
const LAN: Record<string, string> = {
  'blekinge': 'Blekinge', 'dalarnas': 'Dalarna', 'gotlands': 'Gotland', 'gävleborgs': 'Gävleborg', 'hallands': 'Halland',
  'jämtlands': 'Jämtland', 'jönköpings': 'Jönköping', 'kalmar': 'Kalmar', 'kronobergs': 'Kronoberg',
  'norrbottens': 'Norrbotten', 'skåne': 'Skåne', 'stockholms': 'Stockholm', 'södermanlands': 'Södermanland',
  'uppsala': 'Uppsala', 'värmlands': 'Värmland', 'västerbottens': 'Västerbotten', 'västernorrlands': 'Västernorrland',
  'västmanlands': 'Västmanland', 'västra götalands': 'Västra Götaland', 'örebro': 'Örebro', 'östergötlands': 'Östergötland',
};

const L = '\\p{L}';
/** Nazwa własna: 1–3 słowa od wielkiej litery (np. „Västra Götalands”). */
const NAME = `\\p{Lu}[${L}-]*(?:\\s\\p{Lu}[${L}-]*){0,2}`;

function genitiveToBase(name: string): string {
  const hit = LAN[name.toLowerCase()];
  if (hit) return hit;
  return /[^s]s$/u.test(name) && !/(?:ås|äs|ös|us|os|ss)$/u.test(name) ? name.slice(0, -1) : name;
}

/** Granica słowa zgodna z Unicode (å/ä/ö): `\b` w JS tego nie robi. */
function word(w: string): RegExp {
  return new RegExp(`(?<![${L}])${w}(?![${L}])`, 'giu');
}

/** Czy tekst wygląda na szwedzki opis miejsca (od tego zależy, czy w ogóle coś zmieniać). */
export const SE_LOCATION_RE = new RegExp(`(?<![${L}])(från|till|mellan|båda|riktning(?:arna|ar|en)?|län|länsgr\\.?|vid|mot|kommun|trafikplats|cirkulationsplats)(?![${L}])`, 'iu');

export function plSeLocation(text: string): string {
  if (!text || !SE_LOCATION_RE.test(text)) return text;
  let s = text;
  /* „E 4” → „E4” */
  s = s.replace(/(?<![\p{L}\d])E\s+(\d{1,3})(?!\d)/gu, 'E$1');
  /* „E4: E4 …” → „E4: …”; inny numer w środku („E4: E22 från …”) wygrywa — to droga zdarzenia („E22: od …”) */
  s = s.replace(/^(E\d{1,3}):\s*(E\d{1,3})(?![\d.])\s+/u, (_m, a: string, b: string) => `${a === b ? a : b}: `);
  /* granica regionów: „Länsgr. Västerbottens/Norrbottens län” → „granica regionów Västerbotten/Norrbotten” */
  s = s.replace(new RegExp(`länsgr(?:\\.|äns)?\\s+(${NAME})\\s*\\/\\s*(${NAME})\\s+län`, 'giu'),
    (_m, a: string, b: string) => `granica regionów ${genitiveToBase(a)}/${genitiveToBase(b)}`);
  /* region: „i Västerbottens län (AC)” → „, region Västerbotten” (kod litery znika) */
  s = s.replace(new RegExp(`\\s*,?\\s*(?:(?<![${L}])i\\s+)?(${NAME})\\s+län(?![${L}])(?:\\s*\\([A-ZÅÄÖ]{1,2}\\))?`, 'gu'),
    (_m, n: string) => `, region ${genitiveToBase(n)}`);
  /* gmina: „vid Söderköpings kommun” / „i Solna kommun” → „, gmina Söderköping” */
  s = s.replace(new RegExp(`\\s*,?\\s*(?:(?<![${L}])(?:vid|i)\\s+)?(${NAME})\\s+kommun(?![${L}])`, 'gu'),
    (_m, n: string) => `, gmina ${genitiveToBase(n)}`);
  /* kierunki */
  s = s.replace(new RegExp(`\\s*,?\\s*(?:(?<![${L}])i\\s+)?båda\\s+riktningar(?:na)?(?![${L}])`, 'giu'), ', oba kierunki');
  s = s.replace(new RegExp(`\\s*,?\\s*(?:(?<![${L}])i\\s+)?riktning\\s+mot(?![${L}])`, 'giu'), ', w kierunku');
  s = s.replace(new RegExp(`\\s*,?\\s*(?:(?<![${L}])i\\s+)?norrgående\\s+riktning(?![${L}])`, 'giu'), ', w kierunku północnym');
  s = s.replace(new RegExp(`\\s*,?\\s*(?:(?<![${L}])i\\s+)?södergående\\s+riktning(?![${L}])`, 'giu'), ', w kierunku południowym');
  /* odcinek */
  s = s.replace(new RegExp(`(?<![${L}])mellan\\s+(.+?)\\s+och(?![${L}])`, 'giu'), 'między $1 a');
  s = s.replace(word('från'), 'od');
  s = s.replace(word('till'), 'do');
  /* obiekty */
  s = s.replace(new RegExp(`(?<![${L}])vid\\s+trafikplats(?![${L}])`, 'giu'), 'przy węźle');
  s = s.replace(new RegExp(`(?<![${L}])vid\\s+cirkulationsplats(?![${L}])`, 'giu'), 'przy rondzie');
  s = s.replace(word('trafikplats'), 'węzeł');
  s = s.replace(word('cirkulationsplats'), 'rondo');
  s = s.replace(word('vid'), 'przy');
  /* dopełniacz po „od”/„do”: „od węzła”, „do ronda”, „od granicy regionów” */
  s = s.replace(/(?<![\p{L}])(od|do)\s+węzeł(?![\p{L}])/gu, '$1 węzła')
    .replace(/(?<![\p{L}])(od|do)\s+rondo(?![\p{L}])/gu, '$1 ronda')
    .replace(/(?<![\p{L}])(od|do)\s+granica regionów/gu, '$1 granicy regionów');
  /* porządek interpunkcji */
  s = s.replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,(\s*,)+/g, ',')
    .replace(/:\s*,\s*/g, ': ')
    .replace(/^\s*,\s*/, '')
    .replace(/\s*\.\s*$/, '')
    .trim();
  return s;
}
