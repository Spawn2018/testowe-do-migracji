/**
 * E21 — reguły strażnika tekstów (P11 pkt 3), wspólne dla bram ekranów (`p11-bramy.spec.ts`) i treści wiadomości
 * (`p11-e21-wiadomosci.test.ts`). Bez zależności od przeglądarki.
 */
/** Odmiana po liczbie (E21 pkt 2): 1 — pierwsza forma, 2–4 (bez 12–14) — druga, reszta — trzecia. */
export const FORMS: string[][] = [
  ['pojazd', 'pojazdy', 'pojazdów'], ['transport', 'transporty', 'transportów'], ['sprawa', 'sprawy', 'spraw'],
  ['plik', 'pliki', 'plików'], ['wiersz', 'wiersze', 'wierszy'], ['minuta', 'minuty', 'minut'], ['godzina', 'godziny', 'godzin'],
  ['faktura', 'faktury', 'faktur'], ['dokument', 'dokumenty', 'dokumentów'], ['rejs', 'rejsy', 'rejsów'], ['strefa', 'strefy', 'stref'],
  ['kierowca', 'kierowcy', 'kierowców'], ['dopłata', 'dopłaty', 'dopłat'], ['zdarzenie', 'zdarzenia', 'zdarzeń'], ['konto', 'konta', 'kont'],
]
const FORM_OF = new Map<string, string[]>(FORMS.flatMap((f) => f.map((w) => [w, f] as [string, string[]])))
const formFor = (n: number, f: string[]) => (n === 1 ? f[0] : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? f[1] : f[2])
/* przyimki z dopełniaczem („z 3 transportów”, „dla 2 spraw”) — tam druga forma jest poprawna inaczej */
const GEN_PREP = /(?:^|[\s(„])(?:z|ze|do|od|dla|bez|około|ok\.|u|wśród|spośród|zamiast|według|wobec|ponad|brak|brakuje|dotyczy|w ciągu|sprzed)\s+$/i

export const RULES: [string, RegExp][] = [
  ['kod', /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g],
  ['klucz', /\b[a-z][a-z0-9]*(?:_[A-Za-z0-9]+)+\b|(?<![@/\w.-])[a-z]+(?:\.[a-z_]+){2,}(?![\w.-]*@)/g],
  ['numer wewnętrzny', /(?<!#)\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{8}\b|(?<!#)\b(?=[0-9A-F]*\d)(?=[0-9A-F]*[A-F])[0-9A-F]{8}\b/g],
  ['data ISO', /\b\d{4}-\d{2}-\d{2}(?=T|\b)/g],
  ['sekundy', /(?<!\d)\d{1,2}:\d{2}:\d{2}(?!\d)/g],
  ['data bez zera', /(?<![\d.])\d\.\d{1,2}\.\d{4}\b|(?<![\d.])\d{1,2}\.\d\.\d{4}\b/g],
  ['szwedzki', /(?<![\p{L}])(från|till|mellan|båda|riktningarna|riktning|län|kommun|vägarbete|olycka|körfält|avstängd)(?![\p{L}])/giu],
  ['pusta wartość', /\b(undefined|null|NaN|Invalid Date)\b|\[object Object\]/g],
  /* F7 #301 r2 P3: także po minusie i twardej spacji; 4 cyfry bez groszy przed walutą („4500 PLN”; kwoty mają odstęp tysięcy także przy 4 cyfrach, a „1050 km” — nie musi) */
  ['kwota bez odstępu tysięcy', /(?<![\d/.,])\d{4,},\d{1,2}(?!\d)|(?<![\d/.,])\d{4,}(?=[ \u00a0](?:PLN|EUR|SEK)\b)|(?<![\d/.,])\d{5,}(?=[ \u00a0](?:km|kg)\b)/g],
  /* P11 pkt 7 (po #303): kody etapów i punktów planu w tekstach („(E42)”, „jak w E41”, „(W12)”, „(III-4)”, „(I-21)”);
     drogi w nawiasie zostają („Högakustenbron (E4)”, E10, E12, E22, E45 — Szwecja) */
  ['kod etapu', /\((?!(?:E4|E10|E12|E22|E45)\))(?:E\d{1,2}(?:[ -](?:pkt )?[\w.]+)?|W\d{1,2}|I{1,3}-\d{1,2}|[A-Z]\d?-\d{1,2}(?:-[A-Z]\d)?)\)|\bjak w E\d{1,2}\b/g],
  /* procent bez odstępu („4%”, E21; partia 4 #303) */
  ['procent ze spacją', /\d[ \u00a0]%/g],
  ['data angielska', /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} \d{4}\b|\bGMT[+-]\d{4}\b/g],
]
/* E21 pkt 7: wyjątki — nazwy plików z rozszerzeniem (wielkość liter dowolna, także z łącznikiem), licencja „CC BY 4.0” */
export const EXCEPT = [
  /[\p{L}\p{N}_.-]+\.(?:pdf|xlsx|xls|csv|zip|png|jpe?g|webp|heic|docx?)\b/giu, /\bCC BY(?:-SA)? \d\.\d\b/g,
  /* F7 #301 r2 P3: adresy e-mail i nazwy domen (np. jan_kowalski@firma.pl, api.trafikinfo.trafikverket.se) */
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, /\b(?:[a-z0-9-]+\.)+(?:pl|se|com|eu|net|org|io)\b/g,
]

export function textHits(raw: string, where: string, o: { codesAllowed?: boolean } = {}): string[] {
  const out: string[] = []
  let text = raw
  for (const re of EXCEPT) text = text.replace(re, ' ')
  for (const line of text.split('\n')) {
    for (const [k, re] of RULES) {
      if (o.codesAllowed && (k === 'kod' || k === 'klucz' || k === 'numer wewnętrzny')) continue /* E21 pkt 3: kody tylko w Stanie systemu */
      re.lastIndex = 0
      for (const m of line.matchAll(re)) out.push(`${where} — ${k}: «${m[0]}» w «${line.trim().slice(0, 90)}»`)
    }
    /* kropka dziesiętna; „07.10” (dzień i miesiąc) to data — chyba że stoi przed walutą lub jednostką */
    for (const m of line.matchAll(/(?<![\d.])(\d+)\.(\d+)(?![\d.])/g)) {
      const [a, b] = [m[1], m[2]]
      const dateLike = a.length === 2 && b.length === 2 && +a >= 1 && +a <= 31 && +b >= 1 && +b <= 12
      const unit = /^[  ]?(?:PLN|EUR|SEK|%|km|kg|m\/s|m|t|h|min|l)(?![\p{L}])/u.test(line.slice((m.index ?? 0) + m[0].length))
      if (!dateLike || unit) out.push(`${where} — kropka dziesiętna: «${m[0]}» w «${line.trim().slice(0, 90)}»`)
    }
    /* odmiana */
    for (const m of line.matchAll(/(?<![\d,.])(\d+)[  ]([\p{L}]+)/gu)) {
      const f = FORM_OF.get(m[2].toLowerCase())
      if (!f) continue
      if (GEN_PREP.test(line.slice(0, m.index ?? 0))) continue
      const want = formFor(Number(m[1]), f)
      if (m[2].toLowerCase() !== want) out.push(`${where} — odmiana: «${m[0]}» (ma być „${m[1]} ${want}”) w «${line.trim().slice(0, 90)}»`)
    }
    if (!o.codesAllowed && /Nieznany kod/.test(line)) out.push(`${where} — „Nieznany kod…” poza Stanem systemu: «${line.trim().slice(0, 90)}»`)
  }
  return out
}

