/**
 * BN3 decyzja 61 pkt 3 — RSS ERR (`news.err.ee/rss`) jako potwierdzenie odwołań.
 * F7 #699 r1 / decyzja 80: bez pisemnej zgody ERR źródło **domyślnie wyłączone**
 * (`ERR_RSS_ENABLED` / env). Przy włączonym: filtr → FERRY MEDIUM + sourceUrl.
 * Bez zmiany statusu. Decyzja 69: bez AUTO ODWOLANY. Yle: STOP W64.
 *
 * Detail ryzyka: tylko tytuł + link + pubDate (bez opisu/leadu — F7 B1).
 */
import type { RiskInput } from '../integrations/sync.ts';

export const ERR_RSS_URL = 'https://news.err.ee/rss';
/** Cron ferry-status co 10 min — UA zgodny z F7 #699. */
export const ERR_RSS_UA =
  'Watch Tower (https://tower.log-mar.pl; ferry cancel confirmation; read max every 10 min)';
export const ERR_ATTRIBUTION = 'Potwierdzenie: ERR (news.err.ee)';

/**
 * Decyzja 80: domyślnie wyłączone do pisemnej zgody ERR (regulamin info.err.ee/982667).
 * Włączenie: env `ERR_RSS_ENABLED=1` albo zmiana stałej po zgodzie właściciela.
 */
export const ERR_RSS_ENABLED = false;

/** Limit odpowiedzi RSS (bajty znaków UTF-16 ≈ górny szacunek) — F7 #699. */
export const ERR_RSS_MAX_CHARS = 1_500_000;

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
  /* Finlandia = Eckerö Line (nie Viking) — F7 #699 B5. */
  { re: /\bfinlandia\b/i, label: 'Finlandia', op: 'ECKERO' },
  /* Finbo Cargo = Eckerö Line (TLLA–HEL). */
  { re: /\bfinbo\b/i, label: 'Finbo', op: 'ECKERO' },
  /* bez \b po ö — w JS bez /u „ö” nie jest \w, więc granica słowa pada. */
  { re: /\becker[oö]/i, label: 'Eckerö', op: 'ECKERO' },
  { re: /\btallink\b/i, label: 'Tallink', op: 'TALLINK' },
  { re: /\bmystar\b/i, label: 'MyStar', op: 'TALLINK' },
  { re: /\bmegastar\b/i, label: 'Megastar', op: 'TALLINK' },
];

/**
 * F7 B5: tylko EN (kanał news.err.ee); granice słów.
 * cancel / cancels / cancelled / cancellation / canceled.
 * Bez „no/without cancellation” (M1 Q3 earnings).
 */
const CANCEL_RE = /(?<!\bno\s)(?<!\bwithout\s)\bcancel(?:s|l?ed|lation)?\b/i;

/** Kontekst promowy — łącznie z armator+cancel (F7 B5). */
const FERRY_CONTEXT_RE = /\b(?:ferry|ferries|sailing|sailings|departure|departures|route|vessel|vessels|laev|reis)\b/i;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

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

/** Czy źródło włączone (stała + env; decyzja 80). */
export function isErrRssEnabled(env?: Record<string, string | undefined>): boolean {
  const v = env?.ERR_RSS_ENABLED?.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return ERR_RSS_ENABLED;
}

/** Parser RSS 2.0 ERR — title/link/description/guid/pubDate. */
export function parseErrRss(xml: string): { items: ErrRssItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const trimmed = xml.trim();
  if (!trimmed) {
    warnings.push('ERR RSS: pusta odpowiedź.');
    return { items: [], warnings };
  }
  if (trimmed.length > ERR_RSS_MAX_CHARS) {
    warnings.push('ERR RSS: odpowiedź za duża (limit).');
    return { items: [], warnings };
  }
  if (!/<rss\b/i.test(trimmed) || !/<channel\b/i.test(trimmed)) {
    warnings.push('ERR RSS: struktura zmieniona (brak rss/channel).');
    return { items: [], warnings };
  }
  const items: ErrRssItem[] = [];
  for (const m of trimmed.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = m[1]!;
    const title = stripHtml(tagText(block, 'title'));
    const link = tagText(block, 'link');
    const description = stripHtml(tagText(block, 'description'));
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

/** F7 B3: tylko artykuły z ostatnich 24 h; bez pubDate → pomiń. */
export function isErrRssItemFresh(item: ErrRssItem, now: Date, maxAgeMs = 24 * 3600_000): boolean {
  if (!item.pubDate) return false;
  const t = Date.parse(item.pubDate);
  if (!Number.isFinite(t)) return false;
  const age = now.getTime() - t;
  /* lekki zapas zegara (+1 h w przyszłość). */
  return age <= maxAgeMs && age >= -3600_000;
}

/**
 * F7 B5: łącznie armator/statek + cancel* + kontekst promowy (AND).
 * Opis używany tylko do dopasowania — nie trafia do detail (B1).
 */
export function filterErrFerryCancel(items: ErrRssItem[]): ErrCancelHit[] {
  const out: ErrCancelHit[] = [];
  for (const item of items) {
    const text = `${item.title}\n${item.description}`;
    if (!CANCEL_RE.test(text)) continue;
    if (!FERRY_CONTEXT_RE.test(text)) continue;
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
    const ctx = text.match(FERRY_CONTEXT_RE)?.[0];
    if (ctx) matched.push(ctx);
    out.push({ item, operators: [...ops], matched });
  }
  return out;
}

export function errRssCancelRisk(hit: ErrCancelHit, nowIso?: string): RiskInput {
  const { item, operators, matched } = hit;
  const opLabel = operators.join('/');
  const validUntil = item.pubDate && Number.isFinite(Date.parse(item.pubDate))
    ? new Date(Date.parse(item.pubDate) + 24 * 3600_000).toISOString()
    : (nowIso
      ? new Date(Date.parse(nowIso) + 24 * 3600_000).toISOString()
      : null);
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
      pubDate: item.pubDate,
      trafienia: matched,
      armatorzy: operators,
      atrybucja: ERR_ATTRIBUTION,
      guid: item.guid,
    },
    dedup: `FERRY_ERR_RSS:${item.guid}`,
    sourceUrl: item.link || ERR_RSS_URL,
    validUntil,
  };
}

/** Dowód w detail/logach: tylko tytuł + link + pubDate (F7 B1 — bez leadu). */
export function errRssEvidenceNote(hit: ErrCancelHit): string {
  const { item } = hit;
  const parts = [item.title, item.link, item.pubDate].filter(Boolean);
  return parts.join(' — ').slice(0, 400);
}
