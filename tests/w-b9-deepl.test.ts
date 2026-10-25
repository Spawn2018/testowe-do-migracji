import { describe, expect, it } from 'vitest';
import { deeplWarnText } from '../src/lib/deeplWarn';
import { t } from '../src/i18n/messages';

describe('B9 — kafelek DeepL: powód ostrzeżenia', () => {
  it('zużycie ≥ 80% → tekst o limicie; kolejka > 15 min → tekst o czekającym komunikacie; oba naraz', () => {
    expect(deeplWarnText({ characters: 850_000, monthly_limit: 1_000_000, level: 'warn' }, 'pl')).toContain('80%');
    const wait = deeplWarnText({ characters: 25_921, monthly_limit: 1_000_000, level: 'warn', oldest_age_min: 22.4 }, 'pl');
    expect(wait).toBe(' · komunikat drogowy czeka na tłumaczenie od 22 min');
    const both = deeplWarnText({ characters: 900_000, monthly_limit: 1_000_000, level: 'warn', oldest_age_min: 40 }, 'pl');
    expect(both.split(' · ').length).toBe(3);
  });
  it('bez ostrzeżenia → pusto; klucz ryzyka TRANSLATE_WAIT ma polski tekst', () => {
    expect(deeplWarnText({ characters: 1, monthly_limit: 1_000_000, level: 'ok' }, 'pl')).toBe('');
    expect(deeplWarnText(null, 'pl')).toBe('');
    expect(t('pl', 'rk_translate_wait')).toBe('Komunikat drogowy czeka na tłumaczenie');
  });
});
