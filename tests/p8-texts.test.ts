/**
 * wyglad/P8-a (E43, img/e43-after): spis „Treści wiadomości”, klocki ↔ znaczniki, SMS bez polskich liter i limit 160,
 * e-maile logowania z obowiązkowym przyciskiem, brak danej → „—”, przykłady bez kodów z danych przykładowych (G-09).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  GROUPS, MESSAGES, SMS_MAX, TOKEN_LABEL, checkMessage, gsmBad, gsmLength, normalize, parseMarkers, previewLines, renderSegs, sampleOf,
  smsText, smsWorstLength, toMarkers, type Seg,
} from '../src/lib/p8Texts';
import { P8_PL } from '../src/i18n/p8';
import { P3C_I18N } from '../src/i18n/p3c';
import { SCREEN_KEY } from '../src/components/options/types';
import { loadSeedMarkers } from '../build/seedMarkers';

const by = (id: string) => {
  const m = MESSAGES.find((x) => x.id === id);
  if (!m) throw new Error(id);
  return m;
};
const load = {
  code: 'XX-00',
  hhlOrderNo: '0000/00/S/2026',
  plannedLoadDate: '2026-10-05',
  plannedDeliverDate: '2026-10-07',
  resources: { trailerPlate: 'AB 0000', tractorPlate: 'CD 1111' },
} as unknown as Parameters<typeof sampleOf>[0];

describe('spis wiadomości (E43 „Jeden ekran”)', () => {
  it('4 SMS, 37 rodzajów e-maili i wpisów w dzwonku (A4: OVERDUE + UPDATED + CORRECTED), 2 e-maile paczki (E40), 5 e-maili logowania — razem 48, id bez powtórzeń', () => {
    expect(MESSAGES.filter((m) => m.channel === 'SMS')).toHaveLength(4);
    expect(MESSAGES.filter((m) => m.channel === 'EMAIL' && !m.noBell)).toHaveLength(37);
    expect(MESSAGES.filter((m) => m.channel === 'EMAIL' && m.noBell).map((m) => m.id)).toEqual(['ACCOUNTING_KSH', 'ACCOUNTING_HHL']);
    expect(MESSAGES.filter((m) => m.channel === 'LOGIN')).toHaveLength(5);
    expect(new Set(MESSAGES.map((m) => m.id)).size).toBe(MESSAGES.length);
  });

  it('rodzaje = notifyTemplates.ts (L53 + C3 + A4 OVERDUE/UPDATED/CORRECTED); bez planned', () => {
    const src = readFileSync('supabase/functions/_shared/notifyTemplates.ts', 'utf8');
    const kinds = [...src.matchAll(/case '([A-Z_]+)':/g)].map((m) => m[1])
      .filter((k) => k !== 'DECISION_ESCALATED_BATCH')
      .sort();
    const planned = MESSAGES.filter((m) => m.planned).map((m) => m.id);
    /* A4 (D-20261017-2130-01): INVOICE_OVERDUE bez planned; + INVOICE_UPDATED / INVOICE_CORRECTED. */
    expect(planned).toEqual([]);
    expect(kinds).toHaveLength(37);
    expect(MESSAGES.filter((m) => m.channel === 'EMAIL' && !m.noBell && !m.planned).map((m) => m.id).sort()).toEqual(kinds);
  });

  it('C3 / wyglad/audyt-E (E-03): 6 zdarzeń z „Kto co dostaje” ma treść w notifyTemplates — E35, E49, E23, E47', () => {
    const six = ['SCX_DETOUR_CHOICE', 'PRE_ARRIVAL', 'PRE_PORT', 'SOURCE_DOWN', 'SOURCE_BACK', 'APP_ERROR'];
    expect(MESSAGES.filter((m) => six.includes(m.id)).map((m) => m.id)).toEqual(six);
    expect(MESSAGES.filter((m) => six.includes(m.id)).some((m) => m.planned)).toBe(false);
    for (const m of MESSAGES.filter((x) => six.includes(x.id))) {
      expect(m.channel, m.id).toBe('EMAIL');
      expect(m.tokens, m.id).toContain('link');
      expect(`${m.subject} ${m.body}`, m.id).not.toMatch(/\bE\d{1,2}\b/);
    }
    expect(renderSegs(parseMarkers(by('SOURCE_DOWN').subject ?? ''), sampleOf(null))).toBe('Telematyka naczep nie działa od 00:00');
    expect(renderSegs(parseMarkers(by('PRE_PORT').subject ?? ''), sampleOf(load))).toBe('XX-00: auto 20 km przed portem Gdynia');
  });

  it('grupy w kolejności z obrazu: SMS, Ryzyka i decyzje, Transport, Faktury, System, Logowanie; każda niepusta', () => {
    expect(GROUPS).toEqual(['zone', 'risk', 'load', 'inv', 'sys', 'login']);
    for (const g of GROUPS) expect(MESSAGES.some((m) => m.group === g)).toBe(true);
  });

  it('e-mail ma temat (tytuł w dzwonku), SMS nie ma; treści domyślne używają tylko klocków tej wiadomości', () => {
    for (const m of MESSAGES) {
      if (m.channel === 'SMS') expect(m.subject).toBeUndefined();
      else expect(m.subject?.trim()).toBeTruthy();
      const used = [...`${m.subject ?? ''} ${m.body}`.matchAll(/\{\{([a-zA-Z]+)\}\}/g)].map((x) => x[1]);
      for (const u of used) expect(m.tokens, `${m.id}: ${u}`).toContain(u);
    }
  });

  it('5 e-maili logowania: przycisk obowiązkowy, w treści domyślnej, z napisem', () => {
    for (const m of MESSAGES.filter((x) => x.channel === 'LOGIN')) {
      expect(m.needsButton).toBe(true);
      expect(m.buttonLabel).toBeTruthy();
      expect(m.body).toContain('{{button}}');
      expect(m.tokens).toEqual(['name', 'firm', 'account', 'inviter', 'validity', 'button']);
    }
  });

  it('„Nowe domyślne”: e-maile o transporcie mają kod transportu i link, a SMS niewysłany nie mówi „Zadzwoń do kierowcy”', () => {
    for (const m of MESSAGES.filter((x) => (x.group === 'risk' || x.group === 'load') && x.tokens.includes('code'))) expect(m.subject, m.id).toContain('{{code}}');
    for (const m of MESSAGES.filter((x) => x.channel === 'EMAIL' && !x.noBell && x.tokens.includes('link'))) expect(m.body, m.id).toContain('{{link}}');
    for (const m of MESSAGES) expect(m.body).not.toMatch(/zadzwo/i);
  });
});

describe('klocki ↔ znaczniki', () => {
  it('treść SMS C → fragmenty → znaczniki bez zmian', () => {
    const c = by('SMS_C');
    const segs = parseMarkers(c.body);
    expect(segs[0]).toEqual({ k: 'tok', id: 'code' });
    expect(segs.filter((x) => x.k === 'tok').map((x) => (x as { id: string }).id)).toEqual(['code', 'trailer', 'place', 'dwell', 'planDate']);
    expect(toMarkers(segs)).toBe(c.body);
  });

  it('nieznany znacznik zostaje zwykłym tekstem; sąsiednie teksty sklejone, puste wyrzucone', () => {
    expect(parseMarkers('A {{nieznany}} B')).toEqual([{ k: 'txt', v: 'A {{nieznany}} B' }]);
    expect(normalize([{ k: 'txt', v: 'a' }, { k: 'txt', v: '' }, { k: 'txt', v: 'b' }, { k: 'tok', id: 'code' }]))
      .toEqual([{ k: 'txt', v: 'ab' }, { k: 'tok', id: 'code' }]);
  });

  it('każdy klocek ma polską nazwę przycisku', () => {
    for (const m of MESSAGES) for (const tk of m.tokens) expect(TOKEN_LABEL[tk]).toBeTruthy();
  });
});

describe('podgląd i SMS', () => {
  it('SMS C na transporcie: kod, naczepa, miejsce, godzina postoju, data planu; bez polskich liter', () => {
    const txt = smsText(renderSegs(parseMarkers(by('SMS_C').body), sampleOf(load)));
    expect(txt).toBe('XX-00: auto AB 0000 stoi przy placu Stegra Boden od 12:35. Plan dostawy: 07.10.2026.');
    expect(txt).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
    expect(txt.length).toBeLessThanOrEqual(SMS_MAX);
  });

  it('brak naczepy → „—”, wiadomość i tak powstaje', () => {
    const noTrailer = { ...load, resources: { trailerPlate: null, tractorPlate: null } } as unknown as Parameters<typeof sampleOf>[0];
    expect(renderSegs(parseMarkers('{{code}}: auto {{trailer}}'), sampleOf(noTrailer))).toBe('XX-00: auto —');
  });

  it('bez transportu przykład bez kodów z danych przykładowych (G-09)', () => {
    const s = sampleOf(null);
    expect(s.code).toBe('XX-00');
    const seed = loadSeedMarkers();
    const all = JSON.stringify(s) + JSON.stringify(MESSAGES) + JSON.stringify(P8_PL);
    for (const c of seed.codes) expect(all, c).not.toMatch(new RegExp(`(?<![A-Za-z0-9-])${c}(?![A-Za-z0-9])`));
  });

  it('przycisk logowania w podglądzie — z klocka, nie z nawiasów w tekście', () => {
    const inv = by('INVITE');
    const lines = previewLines(parseMarkers(inv.body.replace('Dzień dobry,', 'Dzień dobry [uwaga],')), sampleOf(load), false, inv.buttonLabel);
    const btns = lines.flat().filter((x) => x.btn);
    expect(btns).toEqual([{ btn: true, v: 'Dołącz' }]);
    expect(lines[0]).toEqual([{ btn: false, v: 'Dzień dobry [uwaga],' }]);
  });

  it('podgląd SMS w liniach bez polskich liter, e-mail z polskimi', () => {
    const segs = parseMarkers('Śrem {{code}}');
    expect(previewLines(segs, sampleOf(load), true).flat().map((x) => x.v).join('')).toBe('Srem XX-00');
    expect(previewLines(segs, sampleOf(load), false).flat().map((x) => x.v).join('')).toBe('Śrem XX-00');
  });

  it('smsText: „—” → „-”, „→” → „->”, cudzysłowy proste', () => {
    expect(smsText('Łódź — „Śrem” → Boden')).toBe('Lodz - "Srem" -> Boden');
  });
});

describe('sprawdzenie przed zapisem', () => {
  const sample = sampleOf(load);
  it('pusta treść, pusty temat e-maila', () => {
    expect(checkMessage(by('SMS_A'), null, [{ k: 'txt', v: '  ' }], sample)).toEqual({ ok: false, error: 'empty', field: 'body' });
    expect(checkMessage(by('RISK_OPEN'), [{ k: 'txt', v: ' ' }], parseMarkers('x'), sample)).toEqual({ ok: false, error: 'subject_empty', field: 'subject' });
  });

  it('161 znaków SMS nie da się zapisać, 160 tak', () => {
    const at = (n: number): Seg[] => [{ k: 'txt', v: 'a'.repeat(n) }];
    expect(checkMessage(by('SMS_A'), null, at(160), sample)).toEqual({ ok: true });
    expect(checkMessage(by('SMS_A'), null, at(161), sample)).toEqual({ ok: false, error: 'sms_long', field: 'body' });
  });

  it('polskie litery liczą się po zamianie (ą → a, jeden znak)', () => {
    expect(checkMessage(by('SMS_A'), null, [{ k: 'txt', v: 'ą'.repeat(160) }], sample)).toEqual({ ok: true });
  });

  it('e-mail logowania bez przycisku z linkiem — zapis zablokowany', () => {
    const inv = by('INVITE');
    const noBtn = parseMarkers(inv.body).filter((x) => !(x.k === 'tok' && x.id === 'button'));
    expect(checkMessage(inv, parseMarkers(inv.subject ?? ''), noBtn, sample)).toEqual({ ok: false, error: 'no_button', field: 'body' });
    expect(checkMessage(inv, parseMarkers(inv.subject ?? ''), parseMarkers(inv.body), sample)).toEqual({ ok: true });
  });

  it('limit 160 przy najdłuższych danych: tekst mieszczący się na podglądzie, a za długi przy dłuższej rejestracji — zapis zablokowany', () => {
    const segs: Seg[] = [{ k: 'tok', id: 'trailer' }, { k: 'txt', v: ' ' + 'a'.repeat(148) }];
    /* podgląd: „AB 0000” (7) + 149 = 156; najdłuższa rejestracja (10) → 159 — mieści się */
    expect(checkMessage(by('SMS_A'), null, segs, sample)).toEqual({ ok: true });
    const longer: Seg[] = [{ k: 'tok', id: 'trailer' }, { k: 'txt', v: ' ' + 'a'.repeat(152) }];
    expect(smsWorstLength(longer)).toBeGreaterThan(SMS_MAX);
    expect(checkMessage(by('SMS_A'), null, longer, sample)).toEqual({ ok: false, error: 'sms_long', field: 'body' });
  });

  it('alfabet SMS: znaki rozszerzone liczą się podwójnie, znaki spoza alfabetu blokują zapis', () => {
    expect(gsmLength('a€[')).toBe(5);
    expect(gsmBad(smsText('Łódź – „Śrem” … ’ok’'))).toEqual([]);
    const c = checkMessage(by('SMS_A'), null, [{ k: 'txt', v: 'Auto 🚚 jedzie' }], sample);
    expect(c).toEqual({ ok: false, error: 'sms_chars', field: 'body', chars: ['🚚'] });
  });

  it('treści domyślne przechodzą sprawdzenie', () => {
    for (const m of MESSAGES) {
      expect(checkMessage(m, m.channel === 'SMS' ? null : parseMarkers(m.subject ?? ''), parseMarkers(m.body), sample), m.id).toEqual({ ok: true });
    }
  });
});

describe('ekran w Opcjach', () => {
  it('„Treści wiadomości” w menu (nazwa z G-11) z opisem', () => {
    expect(SCREEN_KEY.texts).toBe('p3c_s_texts');
    expect(P3C_I18N.pl.p3c_s_texts).toBe('Treści wiadomości');
    expect(P3C_I18N.pl.p3c_d_texts).toBeTruthy();
  });
});

describe('ekran — prawa (E43 „Bezpiecznie”)', () => {
  it('Administrator HHL: pola do edycji, „Wstaw dane”, Zapisz, próbny SMS; bez „Przywróć”, gdy treść domyślna', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { MessageTexts } = await import('../src/components/options/MessageTexts');
    const html = renderToStaticMarkup(createElement(MessageTexts, { readOnly: false }));
    expect(html).toContain('data-mt-save');
    expect(html).toContain('data-mt-test');
    expect(html).toContain('data-mt-insert="code"');
    expect(html).toContain('contentEditable="true"');
    expect(html).not.toContain('data-mt-ro');
    /* lista: 48 pozycji (A4 + INVOICE_UPDATED / INVOICE_CORRECTED), jedna w kolejności Tab */
    expect(html.match(/data-mt-item=/g)).toHaveLength(48);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(47);
  });

  it('Operacje HHL: tylko podgląd — bez zapisu, próbnej wysyłki i przycisków „Wstaw dane”', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { MessageTexts } = await import('../src/components/options/MessageTexts');
    const html = renderToStaticMarkup(createElement(MessageTexts, { readOnly: true }));
    expect(html).toContain('data-mt-ro');
    expect(html).toContain(P8_PL.p8_ro);
    expect(html).not.toContain('data-mt-save');
    expect(html).not.toContain('data-mt-test');
    expect(html).not.toContain('data-mt-insert');
    expect(html).toContain('contentEditable="false"');
  });

  it('produkcja (0289): treści z bazy — najpierw wczytywanie, bez próbnej wysyłki i bez zapisu przed wczytaniem', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    try {
      const { renderToStaticMarkup } = await import('react-dom/server');
      const { createElement } = await import('react');
      const { MessageTexts } = await import('../src/components/options/MessageTexts');
      const html = renderToStaticMarkup(createElement(MessageTexts, { readOnly: false }));
      expect(html).toContain(P8_PL.p8_loading);
      expect(html).not.toContain('data-mt-save');
      expect(html).not.toContain('data-mt-test');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
