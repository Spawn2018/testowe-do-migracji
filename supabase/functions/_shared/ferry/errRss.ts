/**
 * BN3 decyzja 61 pkt 3 — RSS ERR (`news.err.ee/rss`) jako potwierdzenie odwołań.
 * Filtr: armator/statek (Viking, XPRS, Eckerö, Finbo, Tallink…) + słowo odwołania
 * (tühist, peru; na feedzie EN także cancel*). → ryzyko FERRY MEDIUM + sourceUrl
 * (dowód). Bez zmiany statusu. Yle: STOP W64 — nie podłączamy.
 *
 * Decyzja 69: bez ODWOLANY historią jest ryzyko (nie fałszywy AUTO notice ODWOLANY).
 * Regulamin ERR (info.err.ee/982667): cytat tytułu + ≤5 zdań + link; bez pełnej kopii.
 */
import type { RiskInput } from '../integrations/sync.ts';

export const ERR_RSS_URL = 'https://news.err.ee/rss';
export const ERR_RSS_UA =
  'Watch Tower (https://tower.log-mar.pl; ferry cancel confirmation; read max every 15 min)';
export const ERR_ATTRIBUTION = 'Potwierdzenie: ERR (news.err.ee)';

export type ErrOperator = 'VIKING' | 'ECKERO' | 'TALLINK';

export interface ErrRssItem {
  guid: string;
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}

export interface ErrCancelHit {
  item: ErrRssItem;
  operators: ErrOperator[];
  /** Trafione etykiety ze specyfikacji (do szczegółu ryzyka). */
  matched: string[];
}

const FERRY_MARKERS: { re: RegExp; label: string; op: ErrOperator }[] = [
  { re: /\bviking\b/i, label: 'Viking', op: 'VIKING' },
  { re: /\bxprs\b/i, label: 'XPRS', op: 'VIKING' },
  { re: /\bfinlandia\b/i, label: 'Finlandia', op: 'VIKING' },
  /* Finbo Cargo = Eckerö Line (TLLA–HEL). */
  { re: /\bfinbo\b/i, label: 'Finbo', op: 'ECKERO' },
  /* bez \b po ö — w JS bez /u „ö” nie jest \w, więc granica słowa pada. */
  { re: /\becker[oö]/i, label: 'Eckerö', op: 'ECKERO' },
  { re: /\btallink\b/i, label: 'Tallink', op: 'TALLINK' },
  { re: /\bmystar\b/i, label: 'MyStar', op: 'TALLINK' },
  { re: /\bmegastar\b/i, label: 'Megastar', op: 'TALLINK' },
];

/** Spec: tühist, peru; feed EN news.err.ee → cancel* (POSTEP). peruutatud = peru… */
const CANCEL_RE = /t[uü]hist\w*|peru\w*|cancell?ed?\b|odwo[lł]/i;

function decodeXmlEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function tagText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? decodeXmlEntities(m[1]!).trim() : '';
}

/** Parser RSS 2.0 ERR — title/link/description/guid/pubDate. */
export function parseErrRss(xml: string): { items: ErrRssItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const trimmed = xml.trim();
  if (!trimmed) {
    warnings.push('ERR RSS: pusta odpowiedź.');
    return { items: [], warnings };
  }
  if (!/<rss\b/i.test(trimmed) || !/<channel\b/i.test(trimmed)) {
    warnings.push('ERR RSS: struktura zmieniona (brak rss/channel).');
    return { items: [], warnings };
  }
  const items: ErrRssItem[] = [];
  for (const m of trimmed.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = m[1]!;
    const title = tagText(block, 'title');
    const link = tagText(block, 'link');
    const description = tagText(block, 'description');
    const guidRaw = tagText(block, 'guid') || link;
    const pubDate = tagText(block, 'pubDate') || null;
    if (!title && !link) continue;
    const guid = guidRaw.replace(/\s+/g, ' ').slice(0, 240) || link.slice(0, 240);
    items.push({
      guid,
      title: title.slice(0, 400),
      link: link.slice(0, 500),
      description: description.slice(0, 800),
      pubDate,
    });
  }
  /* Pusty kanał (0 itemów) jest OK — brak newsów, nie awaria struktury. */
  return { items, warnings };
}

/** Decyzja 61 pkt 3: filtr słów → trafienia do ryzyka / notice. */
export function filterErrFerryCancel(items: ErrRssItem[]): ErrCancelHit[] {
  const out: ErrCancelHit[] = [];
  for (const item of items) {
    const text = `${item.title}\n${item.description}`;
    if (!CANCEL_RE.test(text)) continue;
    const matched: string[] = [];
    const ops = new Set<ErrOperator>();
    for (const m of FERRY_MARKERS) {
      if (m.re.test(text)) {
        matched.push(m.label);
        ops.add(m.op);
      }
    }
    if (!ops.size) continue;
    const cancelHit = text.match(CANCEL_RE)?.[0];
    if (cancelHit) matched.push(cancelHit);
    out.push({ item, operators: [...ops], matched });
  }
  return out;
}

export function errRssCancelRisk(hit: ErrCancelHit): RiskInput {
  const { item, operators, matched } = hit;
  const opLabel = operators.join('/');
  return {
    kind: 'FERRY',
    severity: 'MEDIUM',
    title: `ERR: możliwe odwołanie promu (${opLabel}) — weryfikacja HHL`,
    titleKey: 'rk_ferry_err_rss_cancel',
    params: { operator: opLabel, title: item.title.slice(0, 80) },
    detail: {
      zrodlo: 'ERR_RSS',
      tytul: item.title,
      link: item.link,
      fragment: item.description.slice(0, 400),
      trafienia: matched,
      armatorzy: operators,
      atrybucja: ERR_ATTRIBUTION,
      guid: item.guid,
    },
    dedup: `FERRY_ERR_RSS:${item.guid}`,
    sourceUrl: item.link || ERR_RSS_URL,
  };
}

/** Cytat do szczegółu ryzyka (tytuł + krótki lead + link; ≤5 zdań / regulamin ERR). */
export function errRssEvidenceNote(hit: ErrCancelHit): string {
  const { item } = hit;
  const lead = item.description.replace(/\s+/g, ' ').trim().slice(0, 280);
  const parts = [item.title, lead, item.link].filter(Boolean);
  return parts.join(' — ').slice(0, 400);
}
