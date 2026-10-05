import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PANEL_FALLBACK, trafikverketApiCodes, translateTvCode } from '../src/lib/pl/codes';
import { describeCondition, describeDeviation } from '../src/lib/pl/describe';
import { deeplTranslate, isPublicRoadText, textHash, translateFreeText, usageLevel } from '../src/lib/pl/deepl';
import { formatGustPl, formatMarinePl, windDirectionPl } from '../src/lib/pl/weatherPl';
import { aisNavStatusPl, ferryPortPl, ferryStatusPl } from '../src/lib/ferryStatusPl';
import { renderNotice } from '../supabase/functions/_shared/notifyTemplates';
import { parseTrafikverketSituations } from '../supabase/functions/_shared/integrations/road';
import { buildRoutingUrl } from '../supabase/functions/_shared/here/routeCheck';
import { buildCorridorRouteUrl } from '../supabase/functions/_shared/here/corridorObstacles';
import { roadRiskSms } from '../src/lib/pl/notices';

const SW = /\b(vägarbete|olycka|avstängt|körfält|halka|vägen|norr om|södergående|trafikolycka)\b/i;

describe('PL-DATA', () => {
  it('każdy kod słownika ma polskie tłumaczenie', () => {
    const codes = trafikverketApiCodes();
    expect(codes.length).toBeGreaterThan(40);
    for (const row of codes) {
      const hit = translateTvCode(row.domain, row.code);
      expect(hit.known, `${row.domain}:${row.code}`).toBe(true);
      expect(hit.pl).not.toMatch(SW);
      expect(hit.pl.length).toBeGreaterThan(0);
    }
  });

  it('kody z fixture Trafikverket są w słowniku', () => {
    const sit = JSON.parse(readFileSync('tests/fixtures/trafikverket-situation-sample.json', 'utf8'));
    const rc = JSON.parse(readFileSync('tests/fixtures/trafikverket-roadcondition-sample.json', 'utf8'));
    const types = new Set<string>();
    for (const block of sit.RESPONSE.RESULT) {
      for (const s of block.Situation ?? []) {
        for (const d of s.Deviation ?? []) if (d.MessageType) types.add(d.MessageType);
      }
    }
    for (const mt of types) expect(translateTvCode('messageType', mt).known, mt).toBe(true);
    for (const block of rc.RESPONSE.RESULT) {
      for (const c of block.RoadCondition ?? []) {
        expect(translateTvCode('condition', c.ConditionCode).known).toBe(true);
      }
    }
  });

  it('roboty drogowe → opis po polsku, bez szwedzkiego', () => {
    const json = {
      RESPONSE: { RESULT: [{ Situation: [{ Deviation: [{
        Id: 'RW1', MessageType: 'Vägarbete', MessageCodeValue: 'roadworks', SeverityCode: 4,
        RoadNumber: 'E4', Message: 'E4 norr om Sundsvall: ett körfält avstängt, kö kan uppstå.',
        StartTime: '2026-10-05T06:00:00.000+02:00',
        Geometry: { WGS84: 'POINT (17.3312 62.4521)' },
      }] }] }] },
    };
    const parsed = parseTrafikverketSituations(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title.toLowerCase()).toContain('roboty drogowe');
    expect(`${parsed[0].title} ${parsed[0].detail}`).not.toMatch(SW);
    expect(parsed[0].original).toMatch(/körfält/);
  });

  it('nieznany kod → zdarzenie drogowe i ryzyko bez surowego tekstu w tytule', () => {
    const pl = describeDeviation({
      MessageType: 'ZzzNytt', MessageCodeValue: 'nieznanyKodX', SeverityCode: 4, Message: 'Helt ny svensk text om vägen',
    }, 'inne', 'E4');
    expect(pl.kindPl).toBe(PANEL_FALLBACK);
    expect(pl.title.startsWith(PANEL_FALLBACK)).toBe(true);
    expect(pl.title).not.toMatch(/ZzzNytt|nieznanyKodX|vägen/);
    expect(pl.unknownCodes.length).toBeGreaterThan(0);
    expect(pl.freeText).toBeTruthy();
  });

  it('HERE pyta o pl-PL, flagi zostają wyłączone w adresie (sam język)', () => {
    const url = buildRoutingUrl({
      apiKey: 'klucz-testowy',
      origin: [52.07, 17.02],
      destination: [54.40, 18.68],
      dims: { heightM: 4.5, widthM: 3.4, lengthM: 28, weightT: 60, axleCount: 8, axleLoadT: 10 },
    });
    expect(url).toContain('lang=pl-PL');
    expect(url).toContain('router.hereapi.com');
    const corridor = buildCorridorRouteUrl('klucz-testowy', {
      leg: 'SE-NYN', origin: [58.9, 17.95] as const, destination: [65.8, 21.7] as const,
    }, { heightM: 4.5, widthM: 3.4, lengthM: 28, weightT: 60, axleCount: 8, axleLoadT: 10 });
    expect(corridor).toContain('lang=pl-PL');
    expect(corridor).toContain('alternatives=3');
    expect(corridor).not.toContain('attributes');
  });

  it('Stena Departed → Wypłynął, porty po polsku', () => {
    expect(ferryStatusPl('Departed')).toBe('Wypłynął');
    expect(ferryStatusPl('Arrived')).toBe('Przypłynął');
    expect(ferryStatusPl('Cancelled')).toBe('Odwołany');
    expect(ferryPortPl('PLGDY')).toBe('Gdynia');
    expect(ferryPortPl('SEKAA')).toBe('Karlskrona');
    expect(ferryPortPl('PLGDN')).toBe('Gdańsk');
    expect(ferryPortPl('SENYN')).toBe('Nynäshamn');
    expect(aisNavStatusPl(5)).toBe('przy nabrzeżu');
  });

  it('e-mail i SMS ryzyka drogowego są po polsku także przy języku en', () => {
    const mail = renderNotice({ template: 'ROAD_RISK', payload: { event: 'roboty drogowe', road: 'E4', locale: 'en' } }, 'en');
    expect(mail.subject).toContain('roboty drogowe');
    expect(mail.subject).not.toMatch(/Decision needed|vägarbete/i);
    expect(mail.body).not.toMatch(SW);
    const sms = roadRiskSms('roboty drogowe', 'E4');
    expect(sms).toContain('roboty drogowe');
    expect(sms).not.toMatch(SW);
    const decision = renderNotice({ template: 'DECISION_OPEN', payload: { title: 'Warunki drogowe E4: roboty drogowe', locale: 'en' } }, 'en');
    expect(decision.subject.startsWith('Warunki drogowe')).toBe(true);
    expect(decision.body).not.toMatch(/Decision needed|one e-mail/i);
  });

  it('tekst szwedzki: fraza od razu, drugi raz z pamięci bez DeepL, błąd DeepL zostawia kody', async () => {
    const phrase = await translateFreeText({
      text: 'E4 norr om Sundsvall: ett körfält avstängt',
      source: 'SV', used: 38, memoryGet: () => null, memoryPut: () => {}, enqueue: () => {},
      deepl: async () => { throw new Error('nie wolno'); },
    });
    expect(phrase.from).toBe('phrase');
    expect(phrase.deeplCalls).toBe(0);
    expect(phrase.pl).not.toMatch(SW);

    const memory = new Map<string, string>();
    const calls = { n: 0 };
    const raw = 'Tillfällig avstängning av påfarten vid E4';
    const first = await translateFreeText({
      text: raw, source: 'SV', used: 38,
      memoryGet: (h) => memory.get(h) ?? null,
      memoryPut: (h, _s, pl) => { memory.set(h, pl); },
      enqueue: () => {},
      addUsage: (n) => 38 + n,
      deepl: async () => { calls.n += 1; return { text: 'Tymczasowe zamknięcie wjazdu przy E4', billed: raw.length }; },
    });
    expect(first.from).toBe('deepl');
    expect(first.pl).toContain('Tymczasowe');
    expect(calls.n).toBe(1);
    const second = await translateFreeText({
      text: raw, source: 'SV', used: 38 + raw.length,
      memoryGet: (h) => memory.get(h) ?? null,
      memoryPut: () => { throw new Error('zapis drugi raz'); },
      enqueue: () => {},
      deepl: async () => { calls.n += 1; return { text: 'x', billed: 1 }; },
    });
    expect(second.from).toBe('memory');
    expect(second.deeplCalls).toBe(0);
    expect(calls.n).toBe(1);
    expect(textHash(raw)).toBe(textHash(raw.toLowerCase()));

    const broken = await translateFreeText({
      text: raw + ' extra', source: 'SV', used: 10,
      memoryGet: () => null,
      memoryPut: () => {},
      enqueue: () => {},
      deepl: async () => { throw new Error('limit'); },
    });
    expect(broken.from).toBe('codes');
    expect(broken.pl).toBeNull();
    expect(broken.queued).toBe(true);

    const secretish = await translateFreeText({
      text: 'Transport WT-100 kierowca', source: 'SV', used: 10,
      memoryGet: () => null, memoryPut: () => {}, enqueue: () => {},
      deepl: async () => { throw new Error('nie wolno'); },
    });
    expect(secretish.deeplCalls).toBe(0);
    expect(secretish.queued).toBe(true);
    expect(isPublicRoadText('Transport WT-100 kierowca')).toBe(false);
    expect(usageLevel(800_000)).toBe('warn');
    expect(usageLevel(1_000_000)).toBe('full');
  });

  it('nawierzchnia i pogoda po polsku', () => {
    const c = describeCondition(3, 'Risk for halka', 'E4', 'E 4 Umea N');
    expect(c.title).toContain('ślisk');
    expect(c.title).not.toMatch(/halka/i);
    expect(formatGustPl(40)).toMatch(/węzłów/);
    expect(formatGustPl(40)).toMatch(/m\/s/);
    expect(windDirectionPl(0)).toBe('północny');
    expect(windDirectionPl(90)).toBe('wschodni');
    expect(formatMarinePl({ waveM: 3.8, gustKn: 40, tempC: 4, windDeg: 180 })).toMatch(/fala .* m/);
    expect(formatMarinePl({ waveM: 3.8, gustKn: 40, tempC: 4, windDeg: 180 })).toMatch(/°C/);
    expect(formatMarinePl({ waveM: 3.8, gustKn: 40, tempC: 4, windDeg: 180 })).toMatch(/południowy/);
  });

  it('DeepL dostaje tylko treść komunikatu, bez klucza w adresie', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? '');
      expect(body).toContain('Tillf');
      expect(body).not.toContain('klucz');
      expect(String(init?.headers && (init.headers as Record<string, string>).Authorization)).toContain('DeepL-Auth-Key');
      return new Response(JSON.stringify({ translations: [{ text: 'Tymczasowe' }] }), { status: 200 });
    });
    const out = await deeplTranslate(fetch as unknown as typeof globalThis.fetch, 'klucz-testowy', 'Tillfällig avstängning', 'SV');
    expect(out.text).toBe('Tymczasowe');
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = String(fetch.mock.calls[0][0]);
    expect(url).toBe('https://api-free.deepl.com/v2/translate');
    expect(url).not.toContain('klucz');
  });
});
