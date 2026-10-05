/**
 * PL-DATA — tekst wolny komunikatu drogowego.
 * Kolejność: 1) słownik zwrotów, 2) pamięć tłumaczeń, 3) DeepL API Free (SV/EN → PL).
 * Do DeepL idzie wyłącznie publiczny komunikat drogowy. Nigdy dane transportu, kierowcy ani firmy.
 * Ten sam tekst nie jest wysyłany drugi raz. Błąd albo limit: opis z kodów, tekst w kolejce, bez wyjątku.
 */
import { applyPhrases } from './phrases.ts';

export const DEEPL_MONTHLY_LIMIT = 1_000_000;
export const DEEPL_WARN_AT = 0.8;

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
  source: 'SV' | 'EN',
): Promise<{ text: string; billed: number }> {
  const body = new URLSearchParams({ text, source_lang: source, target_lang: 'PL' });
  const res = await fetchFn('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) throw new Error(`deepl ${res.status}`);
  const json = await res.json() as { translations?: { text?: string }[] };
  const out = json.translations?.[0]?.text;
  if (typeof out !== 'string' || !out.trim()) throw new Error('deepl empty');
  return { text: out.trim(), billed: text.length };
}

export async function translateFreeText(args: {
  text: string;
  source: 'SV' | 'EN';
  used: number;
  limit?: number;
  memoryGet: (hash: string) => Promise<string | null> | string | null;
  memoryPut: (hash: string, source: string, pl: string) => Promise<void> | void;
  enqueue: (hash: string, reason: string) => Promise<void> | void;
  addUsage?: (n: number) => Promise<number> | number;
  deepl?: (text: string, source: 'SV' | 'EN') => Promise<{ text: string; billed: number }>;
}): Promise<TranslateResult> {
  const limit = args.limit ?? DEEPL_MONTHLY_LIMIT;
  const hash = textHash(args.text);
  const base = { used: args.used, limit, deeplCalls: 0, queued: false as boolean };
  if (!isPublicRoadText(args.text)) {
    await args.enqueue(hash, 'odrzucone');
    return { ...base, pl: null, from: 'codes', queued: true, level: usageLevel(args.used, limit) };
  }
  const phrased = applyPhrases(args.text);
  if (phrased.covered) {
    return { ...base, pl: phrased.pl, from: 'phrase', level: usageLevel(args.used, limit) };
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
  try {
    const out = await args.deepl(args.text, args.source);
    base.deeplCalls = 1;
    const used = args.addUsage ? await args.addUsage(out.billed) : args.used + out.billed;
    await args.memoryPut(hash, args.text, out.text);
    return { pl: out.text, from: 'deepl', deeplCalls: 1, queued: false, used, limit, level: usageLevel(used, limit) };
  } catch {
    return fail('blad');
  }
}
