/**
 * wyglad/W-audyt-teksty — nazwa polisy HHL, limit listy plików w Dokumentach, Strefy na telefonie,
 * nowe klucze „Kto co dostaje” z migracji 0255 (bezpieczne przed jej wdrożeniem).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ft } from '../src/i18n/p5';
import { matrixFromDb, unknownKeys } from '../src/auth/LiveWhoGets';
import { NOTIFY_CATALOG, NOTIFY_CATALOG_READY, NOTIFY_EVENT_IDS } from '../src/lib/notifyCatalog';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const row = (event_key: string, role: string, in_app: boolean, email: boolean) =>
  ({ event_key, role, in_app, email, push: false, fixed_in_app: null, fixed_email: null, fixed_push: null }) as never;
const NEW = ['workflow', 'email_budget', 'fuel_miss', 'ext_mail'];

describe('W-audyt-teksty', () => {
  it('(a) polisa HHL: „OC przewoźnika — PZU”', () => {
    expect(ft('pl', 'p5_doc_r_OCS')).toBe('OC przewoźnika — PZU');
  });

  it('(c) Dokumenty: 20 wierszy / 10 kart i „Pokaż wszystkie (N)”', () => {
    const s = read('src/views/DocsView.tsx');
    expect(s).toContain('const MAX_FILES_DESK = 20;');
    expect(s).toContain('const MAX_FILES_PHONE = 10;');
    expect(s).toContain('data-doc-files-all');
    expect(ft('pl', 'p5_doc_files_all')).toBe('Pokaż wszystkie ({all})');
  });

  it('(d) Strefy na telefonie: liczba w nagłówku, „+ Strefa” pod listą, Boden pierwszy', () => {
    const s = read('src/views/ZonesView.tsx');
    expect(s).toContain("phone ? zones.length : p8ct('p8c_sub'");
    expect(s).toContain('zv-add-row');
    expect(s).toMatch(/phone \? \[\.\.\.byRoute\.filter\(\(g\) => g\.group === 'boden'\)/);
    expect(read('src/components/zones/zones.css')).toContain('.zv.is-phone .zv-item{border:1px solid var(--rule)');
  });

  it('(e) cztery klucze z 0255 w grupie System, tylko HHL; ext_mail tylko Administrator HHL i e-mail', () => {
    const sys = NOTIFY_CATALOG.find((g) => g.id === 'system')!.rows;
    for (const id of NEW) {
      const r = sys.find((x) => x.id === id)!;
      expect(r, id).toBeTruthy();
      expect(r.pendingDb).toBe(true);
      expect(r.cells.CLIENT_USER).toBeNull();
      expect(r.cells.CARRIER_DISPATCH).toBeNull();
      expect(r.cells.CARRIER_USER).toBeNull();
    }
    expect(sys.find((x) => x.id === 'workflow')!.title).toBe('Alert automatyzacji (reguła zgłosiła problem)');
    const ext = sys.find((x) => x.id === 'ext_mail')!;
    expect(ext.cells.HHL_OPS).toBeNull();
    expect(ext.cells.HHL_ADMIN).toEqual({ bell: false, push: false, mail: true });
  });

  it('(e) przed wdrożeniem 0255: ekran ich nie pokazuje i nie zgłasza; po wdrożeniu — wiersze z bazy, bez komunikatu', () => {
    const before = matrixFromDb(NOTIFY_CATALOG, [row('dec_new', 'HHL_ADMIN', true, false)]).flatMap((g) => g.rows.map((r) => r.id));
    for (const id of NEW) expect(before).not.toContain(id);
    const db = NEW.map((k) => row(k, 'HHL_ADMIN', true, true));
    const after = matrixFromDb(NOTIFY_CATALOG, db).flatMap((g) => g.rows);
    for (const id of NEW) expect(after.map((r) => r.id)).toContain(id);
    expect(after.find((r) => r.id === 'workflow')!.cells.HHL_ADMIN).toEqual({ bell: true, push: false, mail: true });
    expect(unknownKeys(NOTIFY_CATALOG, db)).toEqual([]);
  });

  it('(e) „Co dostaję” i lista kluczy migracji bez czekających kluczy', () => {
    const ready = NOTIFY_CATALOG_READY.flatMap((g) => g.rows.map((r) => r.id));
    for (const id of NEW) {
      expect(ready).not.toContain(id);
      expect(NOTIFY_EVENT_IDS).not.toContain(id);
    }
    expect(read('src/views/OptionsView.tsx')).toContain('groups={NOTIFY_CATALOG_READY}');
    expect(read('src/views/SettingsView.tsx')).toContain('groups={NOTIFY_CATALOG_READY}');
  });
});
