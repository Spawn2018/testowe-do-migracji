/**
 * wyglad/W-faktura-edycja — edycja faktury (decyzja właściciela 20.10.2026 01:13, D-20261020-0115-01).
 * SCX → HHL: zmienia SCX do akceptacji przez HHL, potem tylko Administrator HHL. HHL → KSH: zmienia HHL do akceptacji przez KSH,
 * potem tylko Administrator HHL. KSH nie zmienia żadnej faktury. Operacje HHL nie zmieniają faktury SCX.
 * Dane demo (zmyślone).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { billEditState, editIsCorrection, editNotifyTarget, isHhlAdmin, verificationAfterEdit } from '../src/lib/invoiceEdit';
import { buildDemoSnapshot, DEMO_TODAY_LOCAL } from '../src/data/demoProvider';
import { useTowerStore } from '../src/store/useTowerStore';
import { resetDemoAccountCache, setDemoAccountKind } from '../src/lib/demoAccount';
import { vatGrossOf, type BillDraft } from '../src/lib/invoices3';
import type { Bill } from '../src/types';
import { INVOICE_OVERDUE_KIND } from '../src/lib/invoiceOverdue';

const B = (issuer: 'SCX' | 'HHL', verification: Bill['verification']) => ({ issuer, verification });

describe('Kto zmienia fakturę (prod: konto z profilu)', () => {
  const prod = true;
  it('SCX → HHL: SCX do akceptacji, potem zablokowane; HHL_ADMIN zawsze; HHL_OPS nigdy; KSH nigdy', () => {
    expect(billEditState('SCX', 'CARRIER_DISPATCH', B('SCX', 'DO_WERYFIKACJI'), prod)).toBe('edit');
    expect(billEditState('SCX', 'CARRIER_DISPATCH', B('SCX', 'SPORNA'), prod)).toBe('edit');
    expect(billEditState('SCX', 'CARRIER_DISPATCH', B('SCX', 'ZAAKCEPTOWANA'), prod)).toBe('locked-accepted');
    expect(billEditState('HHL', 'HHL_ADMIN', B('SCX', 'DO_WERYFIKACJI'), prod)).toBe('edit');
    expect(billEditState('HHL', 'HHL_ADMIN', B('SCX', 'ZAAKCEPTOWANA'), prod)).toBe('edit');
    expect(billEditState('HHL', 'HHL_OPS', B('SCX', 'DO_WERYFIKACJI'), prod)).toBe('none');
    expect(billEditState('HHL', 'HHL_OPS', B('SCX', 'ZAAKCEPTOWANA'), prod)).toBe('none');
  });
  it('HHL → KSH: HHL (także Operacje) do akceptacji KSH, potem tylko HHL_ADMIN; KSH nigdy', () => {
    expect(billEditState('HHL', 'HHL_OPS', B('HHL', 'DO_WERYFIKACJI'), prod)).toBe('edit');
    expect(billEditState('HHL', 'HHL_OPS', B('HHL', 'ZAAKCEPTOWANA'), prod)).toBe('locked-accepted');
    expect(billEditState('HHL', 'HHL_ADMIN', B('HHL', 'ZAAKCEPTOWANA'), prod)).toBe('edit');
    expect(billEditState('KSH', 'CLIENT_USER', B('HHL', 'DO_WERYFIKACJI'), prod)).toBe('none');
    expect(billEditState('KSH', 'CLIENT_USER', B('HHL', 'ZAAKCEPTOWANA'), prod)).toBe('none');
  });
  it('prod bez profilu — nikt nie jest administratorem', () => {
    expect(isHhlAdmin('HHL', null, true)).toBe(false);
    expect(billEditState('HHL', null, B('SCX', 'DO_WERYFIKACJI'), true)).toBe('none');
  });
  it('demo: widok HHL bez „Operacje HHL” = Administrator HHL', () => {
    expect(isHhlAdmin('HHL', null, false)).toBe(true);
    expect(isHhlAdmin('HHL', 'HHL_OPS', false)).toBe(false);
  });
  it('po zmianie: wystawca → „Do weryfikacji” i powiadomienie odbiorcy; Administrator HHL na fakturze SCX → status zostaje, powiadomienie SCX (F7 P3)', () => {
    expect(verificationAfterEdit('SPORNA', true, false)).toBe('DO_WERYFIKACJI');
    expect(verificationAfterEdit('ZGODNA', true, true)).toBe('DO_WERYFIKACJI');
    expect(verificationAfterEdit('ZAAKCEPTOWANA', true, true)).toBe('ZAAKCEPTOWANA');
    expect(verificationAfterEdit('DO_WERYFIKACJI', false, true)).toBe('DO_WERYFIKACJI');
    expect(verificationAfterEdit('ZAAKCEPTOWANA', false, true)).toBe('ZAAKCEPTOWANA');
    expect(editNotifyTarget({ issuer: 'SCX', recipient: 'HHL' }, false)).toBe('SCX');
    expect(editNotifyTarget({ issuer: 'HHL', recipient: 'KSH' }, true)).toBe('KSH');
    expect(editNotifyTarget({ issuer: 'SCX', recipient: 'HHL' }, true)).toBe('HHL');
    expect(editIsCorrection({ verification: 'DO_WERYFIKACJI' }, false, true)).toBe(true);
    expect(editIsCorrection({ verification: 'ZAAKCEPTOWANA' }, true, true)).toBe(true);
    expect(editIsCorrection({ verification: 'SPORNA' }, true, false)).toBe(false);
  });
});

function draftOf(b: Bill, p: Partial<BillDraft> = {}): BillDraft {
  const net = p.net ?? b.net;
  const { vat, gross } = vatGrossOf(net);
  return {
    direction: b.direction, number: b.number, issueDate: b.issueDate, weekKey: b.weekKey, currency: b.currency,
    net, vat, gross, pdfName: b.pdfName ?? 'faktura.pdf', dueDateFromDocument: b.dueFromDocument ? b.dueDate : null,
    lines: b.lines.map((l) => ({ loadId: l.loadId, invoicedNet: l.invoicedNet, invoicedFuel: l.invoicedFuel ?? null, fx: l.fx ?? null })),
    ...p,
  };
}

describe('Akcja updateBill (demo)', () => {
  beforeEach(() => {
    resetDemoAccountCache();
    useTowerStore.setState({ ...buildDemoSnapshot(), role: 'HHL', notifications: [] });
  });
  afterEach(() => { setDemoAccountKind(null); resetDemoAccountCache(); });
  const koszt = () => useTowerStore.getState().bills.find((b) => b.direction === 'KOSZT')!;
  const przychod = () => useTowerStore.getState().bills.find((b) => b.direction === 'PRZYCHOD')!;

  it('KSH nie zmieni faktury HHL', () => {
    useTowerStore.setState({ role: 'KSH' });
    const p = przychod();
    expect(useTowerStore.getState().updateBill(p.id, draftOf(p, { number: 'X' }), null, 'próba')).toEqual({ ok: false, errors: ['ROLE'] });
    expect(przychod().number).toBe(p.number);
  });

  it('SCX zmienia swoją sporną fakturę: VAT i brutto przeliczone, wraca do „Do weryfikacji”, powiadomienie u HHL', () => {
    const k = koszt();
    useTowerStore.setState({ role: 'SCX', bills: useTowerStore.getState().bills.map((b) => (b.id === k.id ? { ...b, verification: 'SPORNA', disputeNote: 'zła kwota' } : b)) });
    const r = useTowerStore.getState().updateBill(k.id, draftOf(k, { number: `${k.number}-K`, net: 1000 }), null, 'korekta numeru');
    expect(r.ok).toBe(true);
    const after = koszt();
    expect(after.number).toBe(`${k.number}-K`);
    expect(after.net).toBe(1000);
    expect(after.vat).toBe(230);
    expect(after.gross).toBe(1230);
    expect(after.verification).toBe('DO_WERYFIKACJI');
    expect(useTowerStore.getState().notifications[0].roleScope).toEqual(['HHL']);
  });

  it('SCX nie zmieni faktury zaakceptowanej przez HHL; Administrator HHL zmieni — akceptacja zostaje, powiadomienie u SCX', () => {
    const k = koszt();
    useTowerStore.setState({ role: 'SCX', bills: useTowerStore.getState().bills.map((b) => (b.id === k.id ? { ...b, verification: 'ZAAKCEPTOWANA' } : b)) });
    expect(useTowerStore.getState().updateBill(k.id, draftOf(k, { number: 'Z' }), null, null).ok).toBe(false);
    useTowerStore.setState({ role: 'HHL' });
    const r = useTowerStore.getState().updateBill(k.id, draftOf(k, { issueDate: DEMO_TODAY_LOCAL }), null, 'błędna data');
    expect(r.ok).toBe(true);
    expect(koszt().verification).toBe('ZAAKCEPTOWANA');
    expect(useTowerStore.getState().notifications[0].roleScope).toEqual(['SCX']);
  });

  it('Operacje HHL nie zmienią faktury SCX, ale zmienią fakturę HHL przed akceptacją KSH', () => {
    setDemoAccountKind('HHL_OPS');
    const k = koszt();
    expect(useTowerStore.getState().updateBill(k.id, draftOf(k, { number: 'OPS' }), null, null).ok).toBe(false);
    const p = przychod();
    useTowerStore.setState({ bills: useTowerStore.getState().bills.map((b) => (b.id === p.id ? { ...b, verification: 'DO_WERYFIKACJI' } : b)) });
    expect(useTowerStore.getState().updateBill(p.id, draftOf(p, { number: `${p.number}-B` }), null, null).ok).toBe(true);
    expect(przychod().number).toBe(`${p.number}-B`);
  });

  it('Administrator HHL poprawia fakturę SCX przed akceptacją: status zostaje, powiadomienie u SCX (F7 P3)', () => {
    const k = koszt();
    useTowerStore.setState({ bills: useTowerStore.getState().bills.map((b) => (b.id === k.id ? { ...b, verification: 'DO_WERYFIKACJI' } : b)) });
    expect(useTowerStore.getState().updateBill(k.id, draftOf(k, { number: `${k.number}-A` }), null, 'literówka').ok).toBe(true);
    expect(koszt().verification).toBe('DO_WERYFIKACJI');
    expect(useTowerStore.getState().notifications[0].roleScope).toEqual(['SCX']);
  });

  it('nowy termin z dokumentu zamyka sprawę „po terminie”; nowy numer w sprawie (F7 P4)', () => {
    const mine = (id: string) => useTowerStore.getState().risks.filter((r) => r.kind === INVOICE_OVERDUE_KIND && r.invoiceId === id);
    const p = przychod();
    useTowerStore.setState({ bills: useTowerStore.getState().bills.map((b) => (b.id === p.id ? { ...b, verification: 'DO_WERYFIKACJI', payment: 'PO_TERMINIE', dueDate: '2026-01-01', dueFromDocument: true } : b)) });
    const q = przychod();
    /* nadal po terminie, nowy numer → sprawa z nowym numerem */
    expect(useTowerStore.getState().updateBill(q.id, draftOf(q, { number: 'HHL/FV/NOWY/1', dueDateFromDocument: '2026-01-01' }), null, 'numer').ok).toBe(true);
    expect(mine(q.id).length).toBe(1);
    expect(JSON.stringify(mine(q.id)[0])).toContain('HHL/FV/NOWY/1');
    /* nowy termin w przyszłości → sprawa znika */
    expect(useTowerStore.getState().updateBill(q.id, draftOf(przychod(), { dueDateFromDocument: '2099-12-31' }), null, 'termin').ok).toBe(true);
    expect(mine(q.id)).toHaveLength(0);
    expect(przychod().payment).not.toBe('PO_TERMINIE');
  });

  it('Podgląd innej firmy: bez zmiany faktury (F7 P1)', async () => {
    const pf = await import('../src/lib/prodFacade');
    expect(pf.isPreviewReadOnly({ prod: true, viewRole: 'SCX', orgCode: 'HHL' })).toBe(true);
  });

  it('pozycje tej faktury nie są „już zafakturowane” przy zapisie (bez błędu DOUBLE)', () => {
    const p = przychod();
    useTowerStore.setState({ bills: useTowerStore.getState().bills.map((b) => (b.id === p.id ? { ...b, verification: 'DO_WERYFIKACJI' } : b)) });
    const r = useTowerStore.getState().updateBill(p.id, draftOf(p), null, null);
    expect(r.ok).toBe(true);
  });
});
