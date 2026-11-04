/**
 * PL-DATA — tekst wolny komunikatu drogowego.
 * Kolejność: 1) słownik zwrotów, 2) pamięć tłumaczeń, 3) DeepL API Free (SV/EN/LT/LV/ET/FI → PL).
 * Do DeepL idzie wyłącznie publiczny komunikat drogowy. Nigdy dane transportu, kierowcy ani firmy.
 * Ten sam tekst nie jest wysyłany drugi raz. Błąd albo limit: opis z kodów, tekst w kolejce, bez wyjątku.
 * DP-172 (#742): LT/LV/ET/FI jak Szwecja (decyzja 89).
 */
import { applyPhrases } from './phrases.ts';

export const DEEPL_MONTHLY_LIMIT = 1_000_000;
export const DEEPL_WARN_AT = 0.8;
/** DP-204.1: limit nowych wywołań DeepL na jeden przebieg joba (reszta → translate-retry). */
export const DEEPL_MAX_CALLS_PER_RUN = 40;
/** DP-204.1: timeout pojedynczego POST /v2/translate. */
export const DEEPL_CALL_TIMEOUT_MS = 8_000;
/** DP-204.5 / #781 pkt 9: odczekanie przy HTTP 429 przed jedną ponowną próbą. */
export const DEEPL_429_RETRY_MS = 2_000;

export class DeeplRateLimitError extends Error {
  constructor(message = 'deepl 429') {
    super(message);
    this.name = 'DeeplRateLimitError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Języki źródłowe DeepL Free używane w Watch Tower (komunikaty drogowe). */
export type DeeplSourceLang = 'SV' | 'EN' | 'LT' | 'LV' | 'ET' | 'FI';

export const DEEPL_SOURCE_LANGS: readonly DeeplSourceLang[] = [
  'SV', 'EN', 'LT', 'LV', 'ET', 'FI',
] as const;

export function isDeeplSourceLang(v: string): v is DeeplSourceLang {
  return (DEEPL_SOURCE_LANGS as readonly string[]).includes(v);
}

/** Mapowanie kraju BN6 → kod źródła DeepL (Estonia = ET). */
export function deeplSourceForBalticCountry(country: 'LT' | 'LV' | 'EE' | 'FI'): DeeplSourceLang {
  return country === 'EE' ? 'ET' : country;
}

export interface MemoryRow { hash: string; pl: string }
export interface TranslateResult {
  pl: string | null;
  from: 'phrase' | 'memory' | 'deepl' | 'codes';
  deeplCalls: number;
  queued: boolean;
  used: number;
  limit: number;
  level: 'ok' | 'warn' | 'full';
}

export function textHash(text: string): string {
  const s = text.normalize('NFC').trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = Math.imul(h, 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

/** Odrzuca wszystko, co nie jest publicznym komunikatem drogowym. */
export function isPublicRoadText(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 600) return false;
  if (/@/.test(t)) return false;
  if (/\b(kierowca|przewoźnik|przewoznik|transport|ładun|ladun|zlecen|faktura|HHL|KSH|SCX|MMSI|IMO)\b/i.test(t)) return false;
  if (/\b\d{9}\b/.test(t)) return false;
  if (/\b[A-Z]{2,}-\d{2,}\b/.test(t)) return false;
  return true;
}

export function usageLevel(used: number, limit = DEEPL_MONTHLY_LIMIT): 'ok' | 'warn' | 'full' {
  if (used >= limit) return 'full';
  if (used >= limit * DEEPL_WARN_AT) return 'warn';
  return 'ok';
}

export async function deeplTranslate(
  fetchFn: typeof fetch,
  apiKey: string,
  text: string,
  source: DeeplSourceLang,
  opts?: { timeoutMs?: number; retry429Ms?: number },
): Promise<{ text: string; billed: number }> {
  const body = new URLSearchParams({ text, source_lang: source, target_lang: 'PL' });
  const timeoutMs = opts?.timeoutMs ?? DEEPL_CALL_TIMEOUT_MS;
  const retry429Ms = opts?.retry429Ms ?? DEEPL_429_RETRY_MS;
  const post = () => fetchFn('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  let res = await post();
  /* DP-204.5: 429 → odczekaj i jedna ponowna próba (nie oznaczaj od razu jako blad). */
  if (res.status === 429) {
    await sleep(retry429Ms);
    res = await post();
    if (res.status === 429) throw new DeeplRateLimitError();
  }
  if (!res.ok) throw new Error(`deepl ${res.status}`);
  const json = await res.json() as { translations?: { text?: string }[] };
  const out = json.translations?.[0]?.text;
  if (typeof out !== 'string' || !out.trim()) throw new Error('deepl empty');
  return { text: out.trim(), billed: text.length };
}

export async function translateFreeText(args: {
  text: string;
  source: DeeplSourceLang;
  used: number;
  limit?: number;
  /** DP-204.1: ile wywołań DeepL już w tym przebiegu (przed tą pozycją). */
  runCalls?: number;
  /** DP-204.1: maks. nowych wywołań DeepL na przebieg (domyślnie DEEPL_MAX_CALLS_PER_RUN). */
  maxCallsPerRun?: number;
  memoryGet: (hash: string) => Promise<string | null> | string | null;
  memoryPut: (hash: string, source: string, pl: string) => Promise<void> | void;
  enqueue: (hash: string, reason: string) => Promise<void> | void;
  addUsage?: (n: number) => Promise<number> | number;
  deepl?: (text: string, source: DeeplSourceLang) => Promise<{ text: string; billed: number }>;
}): Promise<TranslateResult> {
  const limit = args.limit ?? DEEPL_MONTHLY_LIMIT;
  const maxRun = args.maxCallsPerRun ?? DEEPL_MAX_CALLS_PER_RUN;
  const runCalls = args.runCalls ?? 0;
  const hash = textHash(args.text);
  const base = { used: args.used, limit, deeplCalls: 0, queued: false as boolean };
  if (!isPublicRoadText(args.text)) {
    await args.enqueue(hash, 'odrzucone');
    return { ...base, pl: null, from: 'codes', queued: true, level: usageLevel(args.used, limit) };
  }
  /* DP-172: słownik zwrotów tylko SV (EN bez szwedzkich fraz) — LT/LV/ET/FI nie mają „covered” bez DeepL. */
  if (args.source === 'SV' || args.source === 'EN') {
    const phrased = applyPhrases(args.text);
    if (phrased.covered) {
      return { ...base, pl: phrased.pl, from: 'phrase', level: usageLevel(args.used, limit) };
    }
  }
  const remembered = await args.memoryGet(hash);
  if (remembered) {
    return { ...base, pl: remembered, from: 'memory', level: usageLevel(args.used, limit) };
  }
  const fail = async (reason: string): Promise<TranslateResult> => {
    await args.enqueue(hash, reason);
    const level = usageLevel(args.used, limit);
    return { ...base, pl: null, from: 'codes', queued: true, level: reason === 'limit' ? 'full' : level };
  };
  if (!isPublicRoadText(args.text)) return fail('odrzucone');
  if (args.used >= limit || !args.deepl) return fail(args.used >= limit ? 'limit' : 'brak');
  /* DP-204.1: limit na przebieg — kolejne teksty do translate-retry. */
  if (runCalls >= maxRun) return fail('limit_przebiegu');
  try {
    const out = await args.deepl(args.text, args.source);
    base.deeplCalls = 1;
    const used = args.addUsage ? await args.addUsage(out.billed) : args.used + out.billed;
    await args.memoryPut(hash, args.text, out.text);
    return { pl: out.text, from: 'deepl', deeplCalls: 1, queued: false, used, limit, level: usageLevel(used, limit) };
  } catch (err) {
    /* DP-204.5: 429 → rate_limit (kolejne przebiegi), nie masowe „blad”. */
    const msg = err instanceof Error ? err.message : String(err);
    if (
      err instanceof DeeplRateLimitError
      || /deepl\s*429|\b429\b/i.test(msg)
      || (err instanceof Error && err.name === 'DeeplRateLimitError')
    ) {
      return fail('rate_limit');
    }
    return fail('blad');
  }
}
