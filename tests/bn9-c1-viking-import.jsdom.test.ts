/**
 * @vitest-environment jsdom
 * BN9-c1 / decyzja 63b — ekran „Wczytaj rozkład Vikinga z pliku” (Harmonogram › Rejsy).
 * Przepływ: plik → Podgląd (`commit: false`) → Zatwierdź z potwierdzeniem w stronie (`commit: true`) → wynik + historia;
 * błędy 403 / 413 / 400 / sieć; wejście ukryte dla kont bez prawa; demo i Podgląd — zapis nieaktywny z wyjaśnieniem.
 * Kontrakt PR #690 (`src/lib/vikingImport.ts`). Dane wymyślone (G-09).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type {
  VikingCall,
  VikingImportApi,
  VikingImportCommit,
  VikingImportHistoryRow,
  VikingImportPreview,
  VikingImportRequest,
} from '../src/lib/vikingImport';

beforeAll(() => {
  (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS ??= { escape: (s: string) => s };
  Element.prototype.scrollIntoView ??= function scrollIntoView() { /* jsdom */ };
});

const { useTowerStore } = await import('../src/store/useTowerStore');
const { SailingsPanel } = await import('../src/views/SailingsPanel');
const { VikingImportPanel, VIKING_ROWS_SHOWN } = await import('../src/components/schedule/VikingImportPanel');
const lib = await import('../src/lib/vikingImport');
const { setDemoAccountKind } = await import('../src/lib/demoAccount');
const { createVikingImportApi } = await import('../src/lib/vikingImportApi');

let host: HTMLDivElement;
let root: Root;
const mount = () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
};
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); });
const q = <T extends Element = HTMLElement>(sel: string) => host.querySelector(sel) as T | null;

afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  setDemoAccountKind(null);
});

const HTML = '<html><body><table><tr><td>Departure</td><td>Arrival</td><td>Day</td><td>Ship</td></tr></table></body></html>';

async function pickFile(name: string, content: string | { size: number }) {
  const input = q<HTMLInputElement>('[data-vi-file]')!;
  const file = typeof content === 'string'
    ? new File([content], name, { type: 'text/html' })
    : Object.defineProperty(new File(['x'], name, { type: 'text/html' }), 'size', { value: content.size });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  await flush();
}

const click = async (sel: string) => {
  const b = q<HTMLButtonElement>(sel);
  if (!b) throw new Error(`brak ${sel}`);
  await act(async () => { b.click(); });
  await flush();
};

function preview(over: Partial<VikingImportPreview> = {}): VikingImportPreview {
  return {
    ok: true, preview: true, file_name: 'viking.html', file_hash: 'abc', sailing_count: 120,
    from_at: '2026-11-02T04:00:00Z', to_at: '2026-12-31T17:30:00Z', horizon_days: 60,
    to_insert: [
      { route: 'TLLA-HEL', vessel: 'Viking XPRS', departureUtc: '2026-11-03T05:00:00Z' },
      { route: 'HELA-TLL', vessel: 'Viking XPRS', departureUtc: '2026-11-03T08:30:00Z' },
    ],
    to_remove: [{ route: 'TLLA-HEL', vessel: 'Viking XPRS', departureUtc: '2026-11-05T17:15:00Z', status: 'ZAPLANOWANY', reason: 'season' }],
    to_take_over: [{ route: 'TLLA-HEL', vessel: 'Viking XPRS', departureUtc: '2026-11-04T05:00:00Z', status: 'ZAPLANOWANY', reason: 'digitraffic_takeover' }],
    risks: [{ route: 'HELA-TLL', vessel: '', departureUtc: '2026-11-02T04:00:00Z', reason: 'VIKING_FILE_INCOMPLETE:HELA-TLL' }],
    blocked: [{ route: 'HELA-TLL', vessel: 'Viking XPRS', departureUtc: '2026-11-04T08:30:00Z', status: 'ODWOLANY', reason: 'blocked:ODWOLANY' }],
    inserted: 2, updated: 1, removed: 1, taken_over: 1,
    warnings: ['Viking plik: niepełny rozkład trasy HELA-TLL (10/40 < 50%) — bez kasowania.'],
    ...over,
  };
}

const COMMIT: VikingImportCommit = {
  ok: true, preview: false, import_id: 'imp-1', file_name: 'viking.html', file_hash: 'abc', sailing_count: 120,
  from_at: '2026-11-02T04:00:00Z', to_at: '2026-12-31T17:30:00Z', horizon_days: 60, source_down_closed: true,
  inserted: 2, updated: 1, removed: 1, taken_over: 1, manual_kept: 3, risks: 1, warnings: [],
};

function fakeApi(opts: {
  preview?: VikingCall<VikingImportPreview>;
  commit?: VikingCall<VikingImportCommit>;
  history?: VikingImportHistoryRow[] | null;
} = {}) {
  const calls: VikingImportRequest[] = [];
  const history = vi.fn(async () => (opts.history === undefined ? [] : opts.history));
  const api = {
    run: vi.fn(async (req: VikingImportRequest) => {
      calls.push(req);
      return req.commit ? (opts.commit ?? { ok: true, data: COMMIT }) : (opts.preview ?? { ok: true, data: preview() });
    }),
    history,
  } as unknown as VikingImportApi;
  return { api, calls, history };
}

const panel = (api: VikingImportApi | null, p: { demo?: boolean; readOnly?: boolean; phone?: boolean } = {}) => createElement(VikingImportPanel, {
  api, demo: p.demo ?? false, readOnly: p.readOnly ?? false, nowIso: '2026-11-02T09:00:00Z', locale: 'pl', phone: p.phone ?? false, onClose: () => {},
});

describe('BN9-c1 · wejście w Harmonogram › Rejsy — tylko Administrator HHL', () => {
  it('HHL (Administrator, demo): przycisk „Wczytaj rozkład Vikinga” otwiera ekran', async () => {
    useTowerStore.setState({ role: 'HHL', locale: 'pl', sailingFocus: null });
    mount();
    await act(async () => { root.render(createElement(SailingsPanel, {})); });
    expect(q('[data-sail-viking]')?.textContent).toBe('Wczytaj rozkład Vikinga');
    expect(q('[data-viking-import]')).toBeNull();
    await click('[data-sail-viking]');
    expect(q('[data-viking-import]')).not.toBeNull();
    expect(q('[data-vi-howto]')?.textContent).toContain('Strona internetowa, tylko HTML');
    expect(q('[data-vi-howto]')?.textContent).toContain('raz w miesiącu');
    await click('[data-vi-close]');
    expect(q('[data-viking-import]')).toBeNull();
  });

  it('HHL Operacje, KSH i SCX nie widzą wejścia', async () => {
    for (const [role, kind] of [['HHL', 'HHL_OPS'], ['KSH', null], ['SCX', null], ['SCX', 'CARRIER_USER']] as const) {
      setDemoAccountKind(kind);
      useTowerStore.setState({ role, locale: 'pl', sailingFocus: null });
      mount();
      await act(async () => { root.render(createElement(SailingsPanel, {})); });
      expect(q('[data-sail-viking]'), `${role}/${kind}`).toBeNull();
      expect(q('[data-viking-import]')).toBeNull();
      act(() => { root.unmount(); });
      host.remove();
    }
  });

  it('demo: podgląd przykładowy, „Zatwierdź import” nieaktywny z wyjaśnieniem', async () => {
    useTowerStore.setState({ role: 'HHL', locale: 'pl', sailingFocus: null });
    mount();
    await act(async () => { root.render(createElement(SailingsPanel, {})); });
    await click('[data-sail-viking]');
    await flush();
    expect(q('[data-vi-history]')?.textContent).toContain('viking-cargo-wrzesien.html');
    await pickFile('viking-cargo.html', HTML);
    await click('[data-vi-preview]');
    expect(q('[data-vi-plan]')).not.toBeNull();
    expect(q('[data-vi-demo-note]')).not.toBeNull();
    const commit = q<HTMLButtonElement>('[data-vi-commit]')!;
    expect(commit.disabled).toBe(true);
    expect(q('[data-vi-commit-why]')?.textContent).toMatch(/demonstracyjnej zapis jest wyłączony/);
  });
});

describe('BN9-c1 · przepływ podgląd → zatwierdź', () => {
  it('podgląd pokazuje zakres, liczby, sekcje, czasy portu i PL, ostrzeżenia po polsku', async () => {
    const { api, calls } = fakeApi();
    mount();
    await act(async () => { root.render(panel(api)); });
    expect(q<HTMLButtonElement>('[data-vi-preview]')!.disabled).toBe(true);
    expect(q('[data-vi-commit]')).toBeNull();
    await pickFile('viking.html', HTML);
    await click('[data-vi-preview]');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ html: HTML, file_name: 'viking.html', commit: false, from_ymd: '2026-11-02', days: 60 });
    const plan = q('[data-vi-plan]')!;
    expect(plan.textContent).toContain('02.11.2026–31.12.2026');
    expect(plan.textContent).toContain('120 rejsów w pliku');
    const n = (k: string) => q(`[data-vi-count="${k}"] b`)?.textContent;
    expect([n('to_insert'), n('to_take_over'), n('to_remove'), n('blocked'), n('risks')]).toEqual(['2', '1', '1', '1', '1']);
    for (const s of ['to_insert', 'to_take_over', 'to_remove', 'blocked', 'risks']) expect(q(`[data-vi-section="${s}"]`), s).not.toBeNull();
    /* Tallinn — czas portu (UTC+2 w listopadzie) i PL (UTC+1) */
    const first = q('[data-vi-section="to_insert"] tr[data-vi-row]')!;
    expect(first.textContent).toContain('03.11.2026, 07:00 (Tallinn)');
    expect(first.textContent).toContain('06:00 PL');
    expect(first.textContent).toContain('Tallinn A → Helsinki');
    expect(q('[data-vi-section="blocked"]')?.textContent).toContain('odwołany');
    expect(q('[data-vi-section="risks"]')?.textContent).toContain('niepełny plik');
    const warn = q('[data-vi-warnings]')!.textContent!;
    expect(warn).toContain('niepełny rozkład trasy Helsinki → Tallinn A');
    expect(warn).not.toContain('Viking plik:');
  });

  it('zatwierdzenie wymaga potwierdzenia w stronie (bez window.confirm), potem wynik i odświeżona historia', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const { api, calls, history } = fakeApi();
    mount();
    await act(async () => { root.render(panel(api)); });
    await flush();
    expect(history).toHaveBeenCalledTimes(1);
    await pickFile('viking.html', HTML);
    await click('[data-vi-preview]');
    await click('[data-vi-commit]');
    expect(calls.filter((c) => c.commit)).toHaveLength(0);
    expect(q('[data-vi-confirm]')?.textContent).toContain('Dodamy 2, przejmiemy 1 i usuniemy 1');
    await click('[data-vi-back]');
    expect(q('[data-vi-confirm]')).toBeNull();
    expect(calls.filter((c) => c.commit)).toHaveLength(0);
    await click('[data-vi-commit]');
    await click('[data-vi-commit-yes]');
    expect(calls.filter((c) => c.commit)).toHaveLength(1);
    expect(calls[calls.length - 1]).toMatchObject({ commit: true, file_name: 'viking.html', html: HTML });
    expect(q('[data-vi-result]')?.textContent).toContain('Rozkład zapisany.');
    expect(q('[data-vi-result]')?.textContent).toContain('3 rejsów wpisanych ręcznie bez zmian');
    expect(q('[data-vi-plan]')).toBeNull();
    expect(history).toHaveBeenCalledTimes(2);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('zmiana daty po podglądzie unieważnia podgląd (zatwierdzenie tylko po nowym podglądzie)', async () => {
    const { api } = fakeApi();
    mount();
    await act(async () => { root.render(panel(api)); });
    await pickFile('viking.html', HTML);
    await click('[data-vi-preview]');
    expect(q('[data-vi-commit]')).not.toBeNull();
    const from = q<HTMLInputElement>('[data-vi-from]')!;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { set.call(from, '2026-11-10'); from.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(q('[data-vi-plan]')).toBeNull();
    expect(q('[data-vi-commit]')).toBeNull();
  });

  it('długa lista: najwyżej 20 rejsów w sekcji i „i jeszcze N”', async () => {
    const rows = Array.from({ length: 27 }, (_, i) => ({ route: 'TLLA-HEL', vessel: 'Viking XPRS', departureUtc: new Date(Date.parse('2026-11-03T05:00:00Z') + i * 3600_000).toISOString() }));
    const { api } = fakeApi({ preview: { ok: true, data: preview({ to_insert: rows }) } });
    mount();
    await act(async () => { root.render(panel(api)); });
    await pickFile('viking.html', HTML);
    await click('[data-vi-preview]');
    expect(host.querySelectorAll('[data-vi-section="to_insert"] tr[data-vi-row]')).toHaveLength(VIKING_ROWS_SHOWN);
    expect(q('[data-vi-section="to_insert"]')?.textContent).toContain('i jeszcze 7');
  });

  it('telefon: karty zamiast tabeli', async () => {
    const { api } = fakeApi();
    mount();
    await act(async () => { root.render(panel(api, { phone: true })); });
    await pickFile('viking.html', HTML);
    await click('[data-vi-preview]');
    expect(q('[data-vi-section="to_insert"] table')).toBeNull();
    expect(host.querySelectorAll('[data-vi-section="to_insert"] li[data-vi-row]')).toHaveLength(2);
  });

  it('Podgląd innego widoku: zapis nieaktywny z wyjaśnieniem', async () => {
    const { api } = fakeApi();
    mount();
    await act(async () => { root.render(panel(api, { readOnly: true })); });
    await pickFile('viking.html', HTML);
    await click('[data-vi-preview]');
    expect(q<HTMLButtonElement>('[data-vi-commit]')!.disabled).toBe(true);
    expect(q('[data-vi-commit-why]')?.textContent).toContain('tylko do odczytu');
  });
});

describe('BN9-c1 · plik i błędy', () => {
  it('plik ponad 3 MB — komunikat, bez wywołania serwera', async () => {
    const { api, calls } = fakeApi();
    mount();
    await act(async () => { root.render(panel(api)); });
    await pickFile('viking.html', { size: lib.VIKING_IMPORT_MAX_BYTES + 1 });
    expect(q('[data-vi-error]')?.textContent).toContain('za duży (najwięcej 3 MB)');
    expect(q<HTMLButtonElement>('[data-vi-preview]')!.disabled).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('zły typ pliku — komunikat', async () => {
    const { api } = fakeApi();
    mount();
    await act(async () => { root.render(panel(api)); });
    await pickFile('rozklad.pdf', 'x');
    expect(q('[data-vi-error]')?.textContent).toContain('.html');
  });

  for (const [status, error, want] of [
    [403, 'Tylko Administrator HHL z 2FA', 'weryfikacją dwuetapową (2FA)'],
    [403, 'Brak uprawnień do importu', 'Brak uprawnień'],
    [413, 'Plik zbyt duży (max 3 MB)', 'za duży'],
    [400, 'Nieprawidłowa data from_ymd (YYYY-MM-DD)', 'Nieprawidłowa data'],
    [400, 'Nieczytelne ciało żądania', 'nie odczytał pliku'],
    [0, 'network', 'Brak połączenia'],
  ] as const) {
    it(`podgląd: błąd ${status} (${error}) — po polsku`, async () => {
      const { api } = fakeApi({ preview: { ok: false, status, error } });
      mount();
      await act(async () => { root.render(panel(api)); });
      await pickFile('viking.html', HTML);
      await click('[data-vi-preview]');
      expect(q('[data-vi-error]')?.textContent).toContain(want);
      expect(q('[data-vi-plan]')).toBeNull();
    });
  }

  it('zapis: 403 po podglądzie — komunikat, podgląd zostaje, historia odświeżona', async () => {
    const { api, history } = fakeApi({ commit: { ok: false, status: 403, error: 'Tylko Administrator HHL z 2FA' } });
    mount();
    await act(async () => { root.render(panel(api)); });
    await flush();
    await pickFile('viking.html', HTML);
    await click('[data-vi-preview]');
    await click('[data-vi-commit]');
    await click('[data-vi-commit-yes]');
    expect(q('[data-vi-error]')?.textContent).toContain('2FA');
    expect(q('[data-vi-plan]')).not.toBeNull();
    expect(q('[data-vi-result]')).toBeNull();
    expect(history).toHaveBeenCalledTimes(2);
  });

  it('komunikaty: 401, 500 przerwany', () => {
    expect(lib.vikingImportErrorPl(401)).toContain('Zaloguj się');
    expect(lib.vikingImportErrorPl(500, 'Import przerwany')).toContain('przerwany');
  });
});

describe('BN9-c1 · historia importów', () => {
  it('wiersze: kiedy, plik, zakres, liczby, status i próg', async () => {
    const { api } = fakeApi({
      history: [
        { id: 'h1', imported_at: '2026-11-01T08:00:00Z', file_name: 'pazdziernik.html', sailing_count: 118, from_at: '2026-11-01T04:00:00Z', to_at: '2026-12-30T17:30:00Z', stats: { inserted: 5, removed: 2, taken_over: 1, risks: 0, clean_threshold_passed: true } },
        { id: 'h2', imported_at: '2026-10-01T08:00:00Z', file_name: 'wrzesien.html', sailing_count: 20, from_at: null, to_at: null, stats: { interrupted: true, clean_threshold_passed: false } },
      ],
    });
    mount();
    await act(async () => { root.render(panel(api)); });
    await flush();
    const rows = host.querySelectorAll('[data-vi-hist]');
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('data-vi-hist')).toBe('OK');
    expect(rows[0].textContent).toContain('01.11.2026, 09:00');
    expect(rows[0].textContent).toContain('pazdziernik.html');
    expect(rows[0].textContent).toContain('01.11.2026–30.12.2026');
    expect(rows[0].textContent).toContain('dodane 5, usunięte 2, przejęte 1');
    expect(rows[1].getAttribute('data-vi-hist')).toBe('PRZERWANY');
    expect(rows[1].textContent).toContain('przerwany');
    expect(rows[1].querySelector('[data-vi-threshold]')).not.toBeNull();
  });

  it('pusta i nieczytelna historia', async () => {
    const a = fakeApi({ history: [] });
    mount();
    await act(async () => { root.render(panel(a.api)); });
    await flush();
    expect(q('[data-vi-history-empty]')).not.toBeNull();
    act(() => { root.unmount(); });
    host.remove();
    const b = fakeApi({ history: null });
    mount();
    await act(async () => { root.render(panel(b.api)); });
    await flush();
    expect(q('[data-vi-history-none]')).not.toBeNull();
  });
});

describe('BN9-c1 · klient Edge (kontrakt #690)', () => {
  const client = (token: string | null) => async () => ({
    auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) },
  }) as never;

  it('POST na viking-schedule-import z tokenem sesji; odpowiedź ok → dane', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(preview()), { status: 200 }));
    const api = createVikingImportApi({ baseUrl: 'https://przyklad.test/', anonKey: 'anon', client: client('tok'), fetchImpl: fetchImpl as never });
    const r = await api.run({ html: HTML, file_name: 'v.html', commit: false, from_ymd: '2026-11-02', days: 60 });
    expect(r.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://przyklad.test/functions/v1/viking-schedule-import');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(init.body))).toEqual({ html: HTML, file_name: 'v.html', commit: false, from_ymd: '2026-11-02', days: 60 });
  });

  it('kody 403 / 413 / 400 i komunikat serwera; sieć → 0; brak sesji → 401', async () => {
    for (const status of [403, 413, 400]) {
      const api = createVikingImportApi({ baseUrl: 'https://x.test', anonKey: 'a', client: client('t'), fetchImpl: (async () => new Response(JSON.stringify({ ok: false, error: `e${status}` }), { status })) as never });
      expect(await api.run({ html: HTML, file_name: 'v.html', commit: false })).toEqual({ ok: false, status, error: `e${status}` });
    }
    const down = createVikingImportApi({ baseUrl: 'https://x.test', anonKey: 'a', client: client('t'), fetchImpl: (async () => { throw new TypeError('Failed to fetch'); }) as never });
    expect(await down.run({ html: HTML, file_name: 'v.html', commit: true })).toMatchObject({ ok: false, status: 0 });
    const noSession = createVikingImportApi({ baseUrl: 'https://x.test', anonKey: 'a', client: client(null), fetchImpl: vi.fn() as never });
    expect(await noSession.run({ html: HTML, file_name: 'v.html', commit: false })).toMatchObject({ ok: false, status: 401 });
  });

  it('plik i ciało: rozszerzenie, rozmiar, ciało ponad 3 MB po zamianie na tekst', () => {
    expect(lib.vikingFileError({ name: 'a.htm', size: 10 })).toBeNull();
    expect(lib.vikingFileError({ name: 'a.HTML', size: 10 })).toBeNull();
    expect(lib.vikingFileError({ name: 'a.txt', size: 10 })).toMatch(/\.html/);
    expect(lib.vikingFileError({ name: 'a.html', size: 0 })).toMatch(/pusty/);
    expect(lib.vikingFileError(null)).toMatch(/Wybierz/);
    const big = '"'.repeat(1_600_000);
    expect(lib.vikingBodyTooLarge({ html: big, file_name: 'a.html', commit: false })).toBe(true);
    expect(lib.vikingBodyTooLarge({ html: 'x'.repeat(1000), file_name: 'a.html', commit: false })).toBe(false);
  });
});
