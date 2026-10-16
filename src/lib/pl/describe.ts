/**
 * PL-DATA — opis zdarzenia drogowego po polsku z pól kodowych.
 * Tekst wolny (Message, ConditionText) nie wchodzi do treści głównej,
 * dopóki słownik zwrotów, pamięć albo DeepL nie dadzą polskiego odpowiednika.
 */
import { PANEL_FALLBACK, translateTvCode, type TvDomain } from './codes.ts';
import { applyPhrases, hasSwedishWords } from './phrases.ts';
import { plSeLocation } from './seLocation.ts';
import { fmtDateTime } from '../time.ts';

export interface RoadPolish {
  title: string;
  detail: string;
  /** Surowy tekst źródła — tylko pod „Pokaż oryginał”. */
  original: string | null;
  /** Polski dopisek z tekstu wolnego, gdy już przetłumaczony. */
  note: string | null;
  /** Tekst wolny jeszcze bez polskiego odpowiednika. */
  freeText: string | null;
  unknownCodes: string[];
  kindPl: string;
}

const INFO_TYPES = new Set(['Viktig trafikinformation', 'Information', 'Trafikmeddelande']);

function warsaw(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  /* „16.10.2026, 08:05” — rok zawsze (właściciel 16.10.2026) */
  return fmtDateTime(d, 'Europe/Warsaw');
}

function known(domain: TvDomain, code: unknown, unknown: string[]): string | null {
  if (code == null || code === '') return null;
  const hit = translateTvCode(domain, String(code));
  if (!hit.known) {
    unknown.push(`${domain}:${String(code)}`);
    return null;
  }
  return hit.pl;
}

function placePl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const cleaned = raw.replace(/^E\s*4\s+/i, '').replace(/^E\s*22\s+/i, '').trim();
  // AUD-04: „från X till Y båda riktningarna i Z län (AC)” → „od X do Y, oba kierunki, region Z” (słownik, bez DeepL)
  const phrased = applyPhrases(plSeLocation(cleaned));
  if (!phrased.covered || hasSwedishWords(phrased.pl)) return '';
  return phrased.pl;
}

export function describeDeviation(d: Record<string, unknown>, kind: string, _road: string | null = null): RoadPolish {
  const unknown: string[] = [];
  const mt = typeof d.MessageType === 'string' ? d.MessageType : '';
  const code = d.MessageCodeValue ?? d.MessageCode;
  const kindFromType = known('messageType', mt, unknown);
  const kindFromCode = known('messageCode', code, unknown);
  const kindPl = kind === 'roboty' ? 'roboty drogowe'
    : kind === 'wypadek' ? 'wypadek'
    : kind === 'zamkniecie' ? 'zamknięcie drogi'
    : kind === 'przeszkoda' ? 'przeszkoda'
    : kind === 'inne' ? (kindFromType || kindFromCode || PANEL_FALLBACK)
    : (kindFromType || kindFromCode || PANEL_FALLBACK);
  if (mt && !translateTvCode('messageType', mt).known && !INFO_TYPES.has(mt)) {
    /* known() już dopisał nieznany typ */
  }
  const sev = known('severity', d.SeverityCode, unknown);
  const dir = known('direction', d.AffectedDirection ?? d.DirectionCode ?? d.TrafficDirection, unknown);
  const restr = known('restriction', d.TrafficRestrictionType, unknown);
  const place = placePl(d.LocationDescriptor);
  const from = warsaw(d.StartTime);
  const to = warsaw(d.EndTime);
  const when = from && to ? `od ${from} do ${to}` : from ? `od ${from}` : to ? `do ${to}` : '';
  const bits = [kindPl, place, dir, restr, sev, when].filter((x): x is string => Boolean(x));
  const title = bits.join(', ') || PANEL_FALLBACK;
  const originalRaw = typeof d.Message === 'string' ? d.Message.trim() : '';
  const header = typeof d.Header === 'string' ? d.Header.trim() : '';
  const original = originalRaw || (header && hasSwedishWords(header) ? header : '');
  let note: string | null = null;
  let freeText: string | null = null;
  if (original) {
    const phrased = applyPhrases(original);
    if (phrased.covered && !hasSwedishWords(phrased.pl)) note = phrased.pl;
    else freeText = original;
  }
  return {
    title,
    detail: title,
    original: original || null,
    note,
    freeText,
    unknownCodes: [...new Set(unknown)],
    kindPl,
  };
}

export function describeCondition(code: number | null, rawText: string, _road: string | null, location: string): RoadPolish {
  const unknown: string[] = [];
  const fromCode = code != null ? translateTvCode('condition', code) : { pl: '', known: false };
  if (code != null && !fromCode.known) unknown.push(`condition:${code}`);
  const phrased = rawText ? applyPhrases(rawText) : { pl: '', covered: false };
  const phraseOk = Boolean(phrased.pl) && phrased.covered && !hasSwedishWords(phrased.pl);
  const label = phraseOk ? phrased.pl : (fromCode.known ? fromCode.pl : 'stan nawierzchni');
  const place = placePl(location);
  const title = place ? `${label}, ${place}` : label;
  const original = rawText.trim();
  const showOriginal = original && hasSwedishWords(original) ? original : null;
  return {
    title,
    detail: title,
    original: showOriginal,
    note: phraseOk ? phrased.pl : null,
    freeText: original && !phraseOk && hasSwedishWords(original) ? original : null,
    unknownCodes: unknown,
    kindPl: label,
  };
}

export function unknownCodeRiskInput(codeKey: string, day: string): {
  kind: 'ROAD_SE'; severity: 'LOW'; title: string; titleKey: string;
  params: Record<string, string | number>; detail: Record<string, unknown>; dedup: string;
} {
  return {
    kind: 'ROAD_SE',
    severity: 'LOW',
    title: 'Nieznany kod źródła drogowego — w panelu: zdarzenie drogowe',
    titleKey: 'rk_tv_unknown_code',
    params: {},
    detail: { kod: codeKey, zrodlo: 'Trafikverket', panel: PANEL_FALLBACK },
    dedup: `ROAD_SE:TV_CODE:${codeKey}:${day}`,
  };
}
