/**
 * wyglad/W-faktura-termin — A4 (D-20261017-0730-01 §2 A4; D-20261017-2130-01): sprawa HHL „Faktura … nieopłacona po terminie”,
 * raz na fakturę; „Otwórz fakturę” z „Do zrobienia” i Kokpitu; link do faktury otwiera ją w Fakturach; wiersz „Kto co dostaje”
 * i treść e-maila (rodzaj w bazie dopisuje wykonawca).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Bill } from '../src/types';
import {
  INVOICE_OVERDUE_KEY, INVOICE_OVERDUE_KIND, invoiceOverdueId, invoiceOverdueRisks, isInvoiceOverdue, refreshInvoiceOverdue, syncInvoiceOverdue,
} from '../src/lib/invoiceOverdue';
import { riskFromRow } from '../src/data/mappers';
import { riskText } from '../src/i18n/messages';
import { buildTodo, riskGo, visibleTodoRisks } from '../src/lib/p6Todo';
import { todoQueue } from '../src/lib/cockpitE9';
import { INVOICE_LINK_IDS, INVOICE_LINK_SAMPLE, MESSAGES, tokenLabelIn } from '../src/lib/p8Texts';
import { NOTIFY_CATALOG } from '../src/lib/notifyCatalog';

const NOW = '2026-11-20T10:00:00Z';
const bill = (o: Partial<Bill> = {}): Bill => ({
  id: 'bill-p-2026-W37', direction: 'PRZYCHOD', issuer: 'HHL', recipient: 'KSH', number: 'HHL/FV/2026/0901',
  issueDate: '2026-09-15', weekKey: '2026-W37', currency: 'EUR', net: 100, vat: 23, gross: 123,
  dueDate: '2026-10-15', dueFromDocument: false, verification: 'ZGODNA', payment: 'NIEOPLACONA', paidAt: null,
  pdfDocId: null, pdfName: null, lines: [], headerFlags: [], missingLoadIds: [], createdAt: '2026-09-15T09:00:00+02:00',
  ...o,
} as Bill);
const read = (p: string) => readFileSync(p, 'utf8');

describe('A4 — kiedy faktura jest „po terminie”', () => {
  it('nieopłacona po dniu terminu → sprawa; w dniu terminu — jeszcze nie; opłacona albo sporna — nie', () => {
    expect(isInvoiceOverdue(bill(), '2026-10-16')).toBe(true);
    expect(isInvoiceOverdue(bill(), '2026-10-15')).toBe(false);
    expect(isInvoiceOverdue(bill({ payment: 'OPLACONA', paidAt: '2026-10-20' }), '2026-11-20')).toBe(false);
    expect(isInvoiceOverdue(bill({ verification: 'SPORNA' }), '2026-11-20')).toBe(false);
  });

  it('jedna sprawa na fakturę: HHL, waga wysoka, klucz tekstu, parametry DD.MM.RRRR, link do faktury', () => {
    const [r, ...rest] = invoiceOverdueRisks([bill(), bill({ id: 'b2', payment: 'OPLACONA', paidAt: '2026-10-01' })], '2026-11-20', NOW);
    expect(rest).toEqual([]);
    expect(r).toMatchObject({
      id: invoiceOverdueId('bill-p-2026-W37'), owner: 'HHL', severity: 'HIGH', kind: INVOICE_OVERDUE_KIND,
      titleKey: INVOICE_OVERDUE_KEY, invoiceId: 'bill-p-2026-W37',
      titleParams: { number: 'HHL/FV/2026/0901', from: 'HHL', to: 'KSH', due: '15.10.2026' },
    });
    expect(r!.loadId).toBeUndefined();
    expect(riskText('pl', r!.title, r!.titleKey, r!.titleParams)).toBe('Faktura HHL/FV/2026/0901 (HHL\u00a0→\u00a0KSH) nieopłacona po terminie 15.10.2026');
    expect(r!.title).toBe('Faktura HHL/FV/2026/0901 (HHL\u00a0→\u00a0KSH) nieopłacona po terminie 15.10.2026');
  });
});

describe('A4 — wiersz bazy → sprawa (kontrakt dla wykonawcy)', () => {
  const row = {
    id: 'r1', load_id: null, kind: 'INVOICE_OVERDUE', severity: 'HIGH', title: 'Faktura SCX/FV/1 (SCX → HHL) nieopłacona po terminie 26.10.2026',
    title_key: 'rk_invoice_overdue', detected_at: '2026-10-27T05:00:00Z', dedup_key: 'INVOICE_OVERDUE:inv-1',
    detail: { owner: 'HHL', invoice_id: 'inv-1', params: { number: 'SCX/FV/1', from: 'SCX', to: 'HHL', due: '26.10.2026' } },
  };
  const r = riskFromRow(row, NOW);
  it('invoice_id → przycisk „Otwórz fakturę”; tekst z klucza', () => {
    expect(r.invoiceId).toBe('inv-1');
    expect(r.type).toBe('OPS');
    expect(riskGo(r)).toBe('INVOICE');
    expect(riskText('pl', r.title, r.titleKey, r.titleParams)).toBe('Faktura SCX/FV/1 (SCX\u00a0→\u00a0HHL) nieopłacona po terminie 26.10.2026');
  });
  it('sprawa liczy się u HHL (Administrator i Operacje), nie u SCX i KSH; osobna karta bez transportu', () => {
    expect(todoQueue('HHL', [r], 'HHL_ADMIN')?.total).toBe(1);
    expect(todoQueue('HHL', [r], 'HHL_OPS')?.total).toBe(1);
    expect(todoQueue('SCX', [r], 'CARRIER_DISPATCH')?.total).toBe(0);
    expect(todoQueue('KSH', [r], 'CLIENT_USER')).toBeNull();
    expect(visibleTodoRisks('SCX', [r])).toEqual([]);
    const cards = buildTodo({ risks: visibleTodoRisks('HHL', [r]), nowIso: NOW });
    expect(cards).toHaveLength(1);
    expect(cards[0]!.loadId).toBeNull();
    expect(cards[0]!.issues[0]!.go).toBe('INVOICE');
  });
});

describe('A4 — zmiana faktury zamyka albo przywraca sprawę', () => {
  const r0 = invoiceOverdueRisks([bill()], '2026-11-20', NOW);
  it('„Opłacona” i spór zamykają; cofnięcie opłaty po terminie przywraca tylko w demo', () => {
    expect(syncInvoiceOverdue(r0, bill({ payment: 'OPLACONA', paidAt: '2026-11-20' }), '2026-11-20', NOW, true)).toEqual([]);
    expect(syncInvoiceOverdue(r0, bill({ verification: 'SPORNA' }), '2026-11-20', NOW, false)).toEqual([]);
    expect(syncInvoiceOverdue([], bill(), '2026-11-20', NOW, true).map((x) => x.id)).toEqual([invoiceOverdueId('bill-p-2026-W37')]);
    expect(syncInvoiceOverdue([], bill(), '2026-11-20', NOW, false)).toEqual([]);
    expect(syncInvoiceOverdue(r0, bill(), '2026-11-20', NOW, true)).toBe(r0);
  });
  it('sklep: opłata, cofnięcie i spór przechodzą przez syncInvoiceOverdue (produkcja bez dodawania)', () => {
    const src = read('src/store/useTowerStore.ts');
    expect(src.match(/syncInvoiceOverdue\(/g)).toHaveLength(3);
    expect(src.match(/syncInvoiceOverdue\([^;]*!SUPABASE_AUTH_ENABLED\)/g)).toHaveLength(3);
  });
});

describe('A4 — przejście do faktury', () => {
  it('„Do zrobienia”: przycisk „Otwórz fakturę” ustawia fakturę i Faktury; „uzupełnia H&H Logistics”', () => {
    const card = read('src/components/risks/TodoCard.tsx');
    expect(card).toContain('data-rk-go="invoice"');
    expect(card).toContain("rt(locale, 'p6_invoice')");
    expect(card).toContain("const who = i.go === 'INVOICE' ? rtp(locale, 'p6_checks_pay', { org })");
    expect(read('src/i18n/p6.ts')).toContain("p6_checks_pay: 'sprawdza płatność {org}',");
    const panel = read('src/components/risks/TodoPanel.tsx');
    expect(panel).toMatch(/i\.go === 'INVOICE' && i\.risk\?\.invoiceId\) \{\s*setOpenInvoiceId\(i\.risk\.invoiceId\);\s*setView\('inv'\);/);
  });
  it('Kokpit „Najpilniejsze”: sprawa faktury otwiera fakturę', () => {
    expect(read('src/views/DashboardView.tsx')).toMatch(/else if \(inv\) \{ setOpenInvoiceId\(inv\); setView\('inv'\); \}/);
  });
  it('Faktury: link /finanse/faktury/<id> otwiera szczegóły, zakładkę kierunku i fokus (także dla starych e-maili faktur)', () => {
    const panel = read('src/views/BillsPanel.tsx');
    expect(panel).toContain('const openInvoiceId = useTowerStore((s) => s.openInvoiceId);');
    expect(panel).toMatch(/setOpenId\(id\);\s*setOpenInvoiceId\(null\);/);
    expect(panel).toContain("head?.focus({ preventScroll: true });");
    /* F7: przewija się tylko `main` — pasek górny zostaje; ukryte pole pliku nie wydłuża dokumentu */
    expect(panel).not.toContain("el?.scrollIntoView({ block: 'center' })");
    expect(panel).toContain("const box = head?.closest('main');");
    expect(read('src/components/invoices/invoices.css')).toContain('.inv-page{position:relative}');
    const view = read('src/views/InvoicesView.tsx');
    expect(view).toContain('if (openDirection) setTab(openDirection);');
    expect(view).toContain('const openDirection = target && sections.includes(target.direction) ? target.direction : undefined;');
  });
});

describe('A4 — „Kto co dostaje” i treść e-maila', () => {
  it('demo: wiersz „Faktura nieopłacona po terminie” w Pieniądzach — tylko HHL (Administrator: dzwonek i e-mail, Operacje: dzwonek)', () => {
    const src = read('src/components/options/demo.tsx');
    expect(src).toContain("{ id: 'inv_overdue', perDay: 1, title: 'Faktura nieopłacona po terminie', sub: 'raz na fakturę · tylko HHL · sprawa znika po „Opłacona” albo sporze', target: 'Faktury › ta faktura',");
    expect(src).toContain("cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(true), CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },");
  });
  it('produkcja: wiersz dopisuje wykonawca razem z macierzą (do tego czasu katalog bez niego)', () => {
    const ids = NOTIFY_CATALOG.flatMap((g) => g.rows.map((r) => r.id));
    const planned = MESSAGES.find((m) => m.id === 'INVOICE_OVERDUE')!.planned === true;
    expect(ids.includes('inv_overdue')).toBe(!planned);
  });
  it('treść domyślna: temat i treść z numerem, kwotą, terminem i linkiem', () => {
    const m = MESSAGES.find((x) => x.id === 'INVOICE_OVERDUE')!;
    expect(m.group).toBe('inv');
    expect(m.channel).toBe('EMAIL');
    expect(m.tokens).toEqual(['invoiceNo', 'week', 'amount', 'due', 'link']);
    expect(m.subject).toBe('Faktura {{invoiceNo}} nieopłacona po terminie {{due}}');
    expect(m.body).toBe('Faktura {{invoiceNo}} ({{week}}), {{amount}}: termin płatności {{due}} minął, a faktura nie jest oznaczona jako opłacona. Sprawdź płatność i oznacz fakturę: {{link}}');
  });
  it('w wiadomościach o fakturach klocek linku to „Link do faktury”, a podgląd prowadzi do faktury (wszystkie e-maile faktur)', () => {
    for (const id of ['INVOICE_NEW', 'PAYMENT_REMINDER', 'INVOICE_DISPUTED', 'INVOICE_DISPUTE_REPLY', 'INVOICE_DISPUTE_RESOLVED', 'INVOICE_OVERDUE']) {
      expect(tokenLabelIn('link', id), id).toBe('Link do faktury');
    }
    /* F7: „Polisa wygasa” (ta sama grupa) prowadzi do sprawy — zostaje „Link do transportu” */
    expect(tokenLabelIn('link', 'INSURANCE_EXPIRY')).toBe('Link do transportu');
    expect(tokenLabelIn('link', 'LOAD_STATUS_CHANGED')).toBe('Link do transportu');
    expect(INVOICE_LINK_IDS.has('INSURANCE_EXPIRY')).toBe(false);
    expect(INVOICE_LINK_SAMPLE).toMatch(/^tower\.log-mar\.pl\/#\/finanse\/faktury\//);
    const mt = read('src/components/options/MessageTexts.tsx');
    expect(mt).toContain("if (INVOICE_LINK_IDS.has(item.id)) s.link = INVOICE_LINK_SAMPLE;");
    expect(mt.match(/msgId=\{item\.id\}/g)).toHaveLength(2);
    expect(read('src/components/options/TokenEditor.tsx')).toContain('tokenLabelIn(id, msgId)');
  });
});

describe('A1 L17 — „Potwierdź dostawę” (D-20261017-2130-01 §5)', () => {
  it('nazwa karty w „Do zrobienia”; katalog spraw i opcja „Jeszcze w drodze” — z PR #296 wykonawcy (A1), gdy już jest w kodzie', () => {
    expect(read('src/i18n/p6.ts')).toContain("p6_dec_short_DELIVERY_UNCONFIRMED: 'Potwierdź dostawę',");
    const d = read('src/i18n/decisions.ts');
    expect(d).toContain("dec_opt_MANUAL_STATUS: 'Podaj status ręcznie',");
    if (d.includes('dec_type_DELIVERY_UNCONFIRMED')) {
      expect(d).toContain("dec_type_DELIVERY_UNCONFIRMED: 'Potwierdź dostawę — doba po planowanej dostawie bez „Dostarczone”',");
      expect(d).toContain("dec_opt_STILL_EN_ROUTE: 'Jeszcze w drodze — przypomnij jutro',");
      expect(read('src/lib/workflowCreator.ts')).toContain("'DELIVERY_UNCONFIRMED'] as const;");
    }
  });
});

describe('A4 — poprawki po F7', () => {
  it('„Otwórz fakturę” tylko dla sprawy „po terminie” — inna sprawa z invoice_id (np. INVOICE_MISMATCH) zostaje przy decyzji', () => {
    const base = { id: 'x', type: 'OPS' as const, severity: 'HIGH' as const, title: 't', detail: '', owner: 'HHL' as const, meta: '', nextAction: '', ageHours: 0, invoiceId: 'inv-1' };
    expect(riskGo({ ...base, kind: 'INVOICE_OVERDUE' })).toBe('INVOICE');
    expect(riskGo({ ...base, kind: 'INVOICE_MISMATCH' })).not.toBe('INVOICE');
  });
  it('tytuł nie łamie się w nawiasie: twarde spacje wokół „→”', () => {
    const [r] = invoiceOverdueRisks([bill()], '2026-11-20', NOW);
    expect(riskText('pl', r!.title, r!.titleKey, r!.titleParams)).toBe('Faktura HHL/FV/2026/0901 (HHL\u00a0→\u00a0KSH) nieopłacona po terminie 15.10.2026');
    expect(r!.title).toContain('(HHL\u00a0→\u00a0KSH)');
  });
  it('demo: przeliczenie spraw z faktur przy wczytaniu zapisanego stanu (nowa po terminie dochodzi, opłacona znika)', () => {
    const before = invoiceOverdueRisks([bill()], '2026-11-20', NOW);
    const paid = refreshInvoiceOverdue(before, [bill({ payment: 'OPLACONA', paidAt: '2026-11-01' })], '2026-11-20', NOW);
    expect(paid.filter((r) => r.kind === INVOICE_OVERDUE_KIND)).toEqual([]);
    const late = refreshInvoiceOverdue([], [bill({ id: 'b9', dueDate: '2026-11-19' })], '2026-11-20', NOW);
    expect(late.map((r) => r.id)).toEqual([invoiceOverdueId('b9')]);
    expect(refreshInvoiceOverdue(before, [bill()], '2026-11-20', NOW)).toBe(before);
    expect(read('src/store/useTowerStore.ts')).toContain('refreshInvoiceOverdue(st.risks, st.bills, localDateOf(now), now)');
  });
  it('adres: po otwarciu faktury wraca do widoku; niewidoczna albo nieistniejąca faktura — „Brak dostępu”', () => {
    const rs = read('src/hooks/useRouteSync.ts');
    expect(rs).toMatch(/if \(r\.kind === 'invoice'\) \{\s*if \(st\.openInvoiceId\) return;/);
    expect(rs).toContain('}, [view, selectedLoadId, loads, openInvoiceId, navigate]);');
    const iv = read('src/views/InvoicesView.tsx');
    expect(iv).toContain('const lost = !!openInvoiceId && bills.length > 0 && !openDirection;');
  });
});

