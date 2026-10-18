/**
 * wyglad/W-audyt (D-20261017-0730-01 §4; decyzje właściciela 17.10.2026, 07:20 — 5B, 6A):
 * 1. teksty o automatach mówią prawdę (`serverRuleOn`): Pomoc, „Działa samo”, dopisek pod mapą;
 * 2. bez wielkich liter wymuszanych w kodzie (6A);
 * 3. domyślna waluta widoku EUR (E16) z migracją zapisu przeglądarki v2 → v3;
 * 4. liczba przy dzwonku przed ucięciem listy; `lazyRetry` we wszystkich leniwych importach.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { migrateTowerPersist, STORE_SCHEMA_VERSION } from '../src/lib/storePersist';

async function prod<T>(fn: () => Promise<T>): Promise<T> {
  vi.resetModules();
  vi.stubEnv('VITE_AUTH_MODE', 'supabase');
  try {
    return await fn();
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe('teksty o automatach (serverRuleOn)', () => {
  it('demo: wszystko działa — teksty bez „włączamy wkrótce”', async () => {
    const { serverRuleOn } = await import('../src/lib/serverRules');
    expect(serverRuleOn('TRACKING_WINDOW')).toBe(true);
    const { helpVersion } = await import('../src/lib/helpContent');
    expect(helpVersion('HHL_ADMIN').steps.map((s) => s.text).join(' ')).not.toContain('włączamy wkrótce');
    const { wt } = await import('../src/i18n/p4cWf');
    expect(wt('pl', 'p4c_wf_r_gps_d')).toContain('wiatr w ETA (od 20 m/s wolniej, od 25 m/s postój)');
    expect(wt('pl', 'p4c_wf_r_gps_d')).not.toContain('wkrótce');
    const { p9m } = await import('../src/i18n/p9c');
    expect(p9m('pl', 'p9c_note')).toBe('Podkład i trasy: HERE · utrudnienia: Trafikverket (SE), HERE (PL) · statki: AIS Fintraffic / digitraffic.fi, CC BY 4.0');
  });

  it('produkcja po A2: okno 03:00 i wyjazd z placu działają; P6 i P9 nadal „włączamy wkrótce”; dopisek mapy bez utrudnień', async () => {
    await prod(async () => {
      const { serverRuleOn } = await import('../src/lib/serverRules');
      expect(serverRuleOn('TRACKING_WINDOW')).toBe(true);
      expect(serverRuleOn('SITE_EXIT_DELIVERED')).toBe(true);
      for (const k of ['WIND_E49', 'DETOUR_E49', 'ROAD_PL_HERE', 'ROAD_SITUATIONS_MAP'] as const) expect(serverRuleOn(k)).toBe(false);
      const { helpVersion, HELP_WINDOW } = await import('../src/lib/helpContent');
      for (const kind of ['HHL_ADMIN', 'HHL_OPS', 'CLIENT_USER', 'CARRIER_DISPATCH'] as const) {
        const map = helpVersion(kind).steps.find((s) => s.target === 'map');
        expect(map?.text).toContain(HELP_WINDOW);
        expect(map?.text).not.toContain(`${HELP_WINDOW} (włączamy wkrótce)`);
      }
      const { wt } = await import('../src/i18n/p4cWf');
      expect(wt('pl', 'p4c_wf_r_zones_d')).not.toContain('włączamy wkrótce');
      expect(wt('pl', 'p4c_wf_zt_site_out')).not.toMatch(/— włączamy wkrótce$/);
      const gps = wt('pl', 'p4c_wf_r_gps_d');
      expect(gps.startsWith('brak pozycji 30 min w ruchu / 3 h na postoju, opóźnienie po wyjeździe, rejs odwołany (E15, E45) · ')).toBe(true);
      expect(gps).toMatch(/„Objazd czy postój\?” przy zamkniętym moście lub drodze — włączamy wkrótce \(E49\)$/);
      const { p9m } = await import('../src/i18n/p9c');
      expect(p9m('pl', 'p9c_note')).toBe('Podkład i trasy: HERE · statki: AIS Fintraffic / digitraffic.fi, CC BY 4.0');
    });
  });

  it('przełącznik produkcji zmienia wykonawca w jednym miejscu (kontrakt D-20261017-0730-01 §4)', () => {
    const src = readFileSync('src/lib/serverRules.ts', 'utf8');
    expect(src).toMatch(/const ON_IN_PRODUCTION: Record<ServerRule, boolean> = \{/);
    expect(src).toContain("if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return true;");
  });
});

describe('bez wielkich liter wymuszanych w kodzie (6A)', () => {
  it('komponenty i widoki nie zamieniają tekstów na wielkie litery (poza kodami, tablicami i inicjałami)', () => {
    const allowed = /initials|words\[|[Pp]late|\.code\b|code\.|charAt\(0\)|DriverPwa\.tsx:.*\bl\.toUpperCase/;
    const hits: string[] = [];
    for (const f of [...walk('src/components'), ...walk('src/views')]) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/\.toLocaleUpperCase\(|\.toUpperCase\(/.test(line) && !allowed.test(`${f}:${line}`)) hits.push(`${f}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
  it('nagłówki „Działa samo” i etykiety ETA zwykłym zapisem', async () => {
    const { wt } = await import('../src/i18n/p4cWf');
    expect(['status', 'todo', 'msg', 'money'].map((g) => wt('pl', `p4c_wf_g_${g}`))).toEqual(['Statusy', 'Do zrobienia', 'Wiadomości', 'Pieniądze i dane']);
    const { t } = await import('../src/i18n/messages');
    expect(t('pl', 'p4b_eta_why')).toBe('Dlaczego tyle');
    expect(t('pl', 'p4b_eta_phone_lbl')).toBe('ETA Boden');
  });
  it('etykiety nie mają rozstrzelonych liter po zdjęciu wersalików (letter-spacing ≤ .03em poza logo i kodem)', () => {
    const wide: string[] = [];
    const css = readdirSync('src', { recursive: true }).map(String).filter((n) => n.endsWith('.css'));
    for (const n of css) {
      const src = readFileSync(join('src', n), 'utf8');
      for (const m of src.matchAll(/([^{}]+)\{[^}]*letter-spacing:\s*\.(\d+)em/g)) {
        const sel = m[1].trim();
        if (Number(`0.${m[2]}`) > 0.03 && !/\.brand b|\.wb-code|\.wb-fields b/.test(sel)) wide.push(`${n}: ${sel}`);
      }
    }
    expect(wide).toEqual([]);
  });
});

describe('waluta widoku EUR (E16)', () => {
  it('nowy zapis: EUR; zapis przeglądarki v2 z „PLN” (wartość domyślna) → EUR; v3 zostaje jak jest', () => {
    expect(STORE_SCHEMA_VERSION).toBe(4); /* v4 — W-demo (audyt 17.10, N6): stare dane startowe demo odrzucone */
    /* migracja nie przenosi waluty — wraca domyślna EUR; wybór z konta wraca przy logowaniu */
    expect('displayCurrency' in migrateTowerPersist({ displayCurrency: 'PLN', locale: 'pl' }, 2).state).toBe(false);
    expect(readFileSync('src/store/useTowerStore.ts', 'utf8')).toContain("displayCurrency: 'EUR',");
  });
});

describe('drobne z audytu', () => {
  it('dzwonek liczy wszystkie pozycje, lista pokazuje 40', () => {
    const src = readFileSync('src/components/shell/NotificationBell.tsx', 'utf8');
    expect(src).toContain('const visible = all.slice(0, 40);');
    expect(src).toContain('const unread = all.length;');
  });
  it('każdy leniwy import ma lazyRetry; udane wczytanie zdejmuje znacznik odświeżenia', () => {
    const bare: string[] = [];
    for (const f of walk('src')) {
      if (f.endsWith('lazyRetry.ts')) continue;
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => { if (/(?<![\w.])lazy\(\(\) =>/.test(line)) bare.push(`${f}:${i + 1}`); });
    }
    expect(bare).toEqual([]);
    expect(readFileSync('src/lib/lazyRetry.ts', 'utf8')).toContain("sessionStorage.removeItem('wt_chunk_reload')");
  });
  it('okno „Zmień status” ma pełną nazwę transportu (E41)', () => {
    expect(readFileSync('src/components/drawer/LoadDrawer.tsx', 'utf8')).toContain("code={transportLabel(load, role, 'plain')}");
  });
  it('liczby po polsku: „max 1 417 t”, kwoty z przecinkiem', async () => {
    const { formatPlNumber, formatPlMoney } = await import('../src/lib/format');
    expect(formatPlNumber(1417)).toBe('1\u00a0417');
    expect(formatPlMoney(150.5, 'EUR')).toBe('150,50\u00a0EUR');
    expect(readFileSync('src/components/chart/DeliveryProgress.tsx', 'utf8')).toContain('max {formatPlNumber(maxV)} t');
  });
  it('przepięcie w układzie pliku: komórki zestawu łamią się tylko przy „→”', () => {
    expect(readFileSync('src/components/schedule/sched7.css', 'utf8')).toContain('.s7-file td[data-col="driver"],.s7-file td[data-col="tractor"],.s7-file td[data-col="trailer"]{white-space:normal}');
    expect(readFileSync('src/components/schedule/SchedTables.tsx', 'utf8')).toContain('{swap ? <> → <span className="s7-nw">');
  });
});

describe('F7 do PR #277', () => {
  it('5B: KSH i SCX — bez spraw HHL (alarm, pobieranie, „Pobrane”, uzgodnienie), przykład na własnej stawce', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { FuelScreen } = await import('../src/components/options/MoneyScreens');
    const { demoFuelScreen, DEMO_EXAMPLE_BASE_EUR } = await import('../src/lib/p5bDemo');
    const view = demoFuelScreen('2026-09-23');
    const ksh = renderToStaticMarkup(createElement(FuelScreen, { locale: 'pl', view: { ...view, exampleBaseEur: DEMO_EXAMPLE_BASE_EUR.rev }, actions: null, readOnly: true, party: 'KSH' }));
    for (const x of ['data-pm-fetch', 'data-pm-alarm', 'pm-how-c', 'ox-tag-active']) expect(ksh).not.toContain(x);
    expect(ksh).toContain('7\u00a0245');
    expect(ksh).not.toContain('6\u00a0900');
    const hhl = renderToStaticMarkup(createElement(FuelScreen, { locale: 'pl', view, actions: null, readOnly: true }));
    expect(hhl).toContain('data-pm-fetch');
    expect(hhl).toContain('6\u00a0900');
  });
  it('pasek śledzenia po A1: produkcja bez „włączamy wkrótce” przy 03:00 i „Dostarczone”', async () => {
    const demo = await import('../src/lib/trackingStateText');
    expect(demo.trkSub('pl', 'p4b_trk_on_sub')).toBe('wyłączy się samo przy „Dostarczone”');
    await prod(async () => {
      const m = await import('../src/lib/trackingStateText');
      expect(m.trkSub('pl', 'p4b_trk_on_sub')).toBe('wyłączy się samo przy „Dostarczone”');
      expect(m.trkSub('pl', 'p4b_trk_before_sub')).not.toMatch(/włączamy wkrótce/);
    });
  });
});
