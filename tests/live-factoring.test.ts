/**
 * #412 E4b — faktoring na produkcji (baza 0287): mapowanie odpowiedzi RPC bez zmyślonych kwot, nazwy parametrów,
 * podłączenie ekranów (Opcje › Faktoring, nowa faktura SCX, szczegóły faktury, zadania HHL); demo bez zmian.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { offerFromDb, offerHours, tasksFromDb } from '../src/auth/LiveFactoring';
import { billFromRow, BILL_COLUMNS, type BillRow } from '../src/data/mappers';

describe('LiveFactoring — mapowanie', () => {
  it('oferta z bazy (HHL widzi też wyłączoną)', () => {
    expect(offerFromDb({ feePct: 1.5, hours: 48, version: 3, from: '2026-10-24', enabled: false }))
      .toEqual({ feePct: 1.5, hours: 48, version: 3, from: '2026-10-24', enabled: false });
    expect(offerFromDb({ feePct: '2.00', hours: 72, version: 1, from: '2026-10-01', enabled: true })?.feePct).toBe(2);
  });
  it('brak oferty / zły kształt → null', () => {
    for (const raw of [null, 'x', {}, { feePct: 0, hours: 48, version: 1, from: '2026-10-24' }, { feePct: 1, hours: 48, version: 1, from: '24.10.2026' }]) {
      expect(offerFromDb(raw)).toBeNull();
    }
  });
  it('zadania HHL; wpisy bez kwot lub terminów pominięte', () => {
    const ok = { billId: 'i1', number: 'FV/1', issuer: 'Scandinavian Express', currency: 'EUR', net: 10000, gross: 12300, fee: 100, payout: 12200, feePct: 1, hours: 48, issuedAt: '2026-10-20', acceptedAt: '2026-10-22T08:00:00Z', dueAt: '2026-10-24T08:00:00Z', paidAt: null };
    const t = tasksFromDb([ok, { ...ok, billId: 'i2', payout: null }, { ...ok, billId: 'i3', dueAt: null }, 'x']);
    expect(t.map((x) => x.billId)).toEqual(['i1']);
    expect(t[0]).toMatchObject({ payout: 12200, currency: 'EUR', paidAt: null });
    expect(tasksFromDb(null)).toEqual([]);
  });
  it('dni → godziny dla p_hours', () => {
    expect(offerHours({ enabled: true, feePercent: 1, payoutDelayValue: 2, payoutDelayUnit: 'days' })).toBe(48);
    expect(offerHours({ enabled: true, feePercent: 1, payoutDelayValue: 36, payoutDelayUnit: 'hours' })).toBe(36);
  });
  it('faktura z bazy: wybór i wyliczenie faktoringu; bez wyboru → null', () => {
    const base: BillRow = {
      id: 'i1', direction: 'KOSZT', issuer_org_id: null, recipient_org_id: null, invoice_number: 'FV/1', issue_date: '2026-10-20',
      receipt_date: null, week_key: '2026-W43', currency: 'EUR', net_total: 10000, vat_total: 2300, gross_total: 12300, due_date: '2026-11-24',
      due_date_from_document: false, verification_status: 'ZAAKCEPTOWANA', dispute_note: null, payment_status: 'NIEOPLACONA', paid_at: null,
      document_id: null, check_flags: [], missing_load_ids: [], submitted_at: '2026-10-20T10:00:00Z', invoice_lines: [],
    };
    const b = billFromRow({ ...base, factoring_selected: true, factoring_fee_pct: '1.00', factoring_fee_amount: '100.00', factoring_net_payout: '12200.00', factoring_hours: 48, factoring_accepted_at: '2026-10-22T08:00:00Z', factoring_due_at: '2026-10-24T08:00:00Z', factoring_paid_at: null }, [], []);
    expect(b?.factoring).toEqual({ selected: true, feePct: 1, fee: 100, payout: 12200, hours: 48, acceptedAt: '2026-10-22T08:00:00Z', dueAt: '2026-10-24T08:00:00Z', paidAt: null });
    expect(billFromRow(base, [], [])?.factoring).toBeNull();
    expect(BILL_COLUMNS).toContain('factoring_selected,factoring_fee_pct,factoring_fee_amount,factoring_net_payout,factoring_hours,');
  });
});

describe('LiveFactoring — podłączenie', () => {
  const live = readFileSync('src/auth/LiveFactoring.tsx', 'utf8');
  const prov = readFileSync('src/data/supabaseProvider.ts', 'utf8');
  const opt = readFileSync('src/views/OptionsView.tsx', 'utf8');
  const inv = readFileSync('src/views/InvoicesView.tsx', 'utf8');
  const bp = readFileSync('src/views/BillsPanel.tsx', 'utf8');
  it('RPC z 0287 i nazwy parametrów', () => {
    expect(live).toContain("sb.rpc('factoring_offer_get')");
    expect(live).toContain("sb.rpc('factoring_offer_set', { p_enabled: f.enabled, p_fee_pct: fee, p_hours: hours })");
    expect(live).toContain("sb.rpc('invoice_factoring_set', { p_invoice: bill.id, p_selected: v === 'FACTORING' })");
    expect(live).toContain("sb.rpc('factoring_tasks')");
    expect(live).toContain("sb.rpc('factoring_mark_paid', { p_invoice: billId })");
    expect(prov).toContain("sb.rpc('invoice_factoring_set', { p_invoice: String(res.data), p_selected: true })");
    expect(prov).toContain('warning: `Faktura zapisana, ale wybór faktoringu nie');
  });
  it('Opcje: produkcja → oferta z bazy (zapis Administrator HHL), demo — dotychczasowy ekran', () => {
    expect(opt).toContain("if (shows('factoringOffer')) {");
    expect(opt).toContain("money.push(scr('fact', block(<LiveFactoringOffer readOnly={ro} onSaved={saveMark} />), { right: change }));");
  });
  it('Faktury: zadania z bazy tylko HHL; szczegóły bez KSH; wybór tylko wystawca SCX', () => {
    expect(inv).toContain("d === 'KOSZT' && role === 'HHL' && LiveFactoringTasks");
    expect(bp).toContain("bill.direction === 'KOSZT' && role !== 'KSH' && LiveFactoringDetail");
    expect(bp).toContain("canChange={role === 'SCX' && bill.issuer === 'SCX' && !isPreviewReadOnly({ viewRole: role })}");
    expect(bp).toContain("!edit && direction === 'KOSZT' && role === 'SCX' && !offer ? LiveFactoringChoice : null");
    expect(bp).toContain("factoring: fact === 'FACTORING',");
  });
  it('wybór „Faktoring” nie zostaje bez włączonej oferty; po akceptacji/sporze/opłaceniu tylko odczyt', () => {
    expect(live).toContain("if (!offer && value === 'FACTORING') onChange('STANDARD');");
    expect(live).toContain("bill.verification !== 'ZAAKCEPTOWANA' && bill.verification !== 'SPORNA' && bill.payment !== 'OPLACONA'");
  });
  it('F7 #521: warunki z faktury przy wybranym faktoringu, rezygnacja bez oferty, zapis tylko przy zmianie, jednostka bez zmiany terminu', () => {
    expect(live).toContain('<FactoringFacts bill={bill} locale={locale} />');
    expect(live).toContain("onClick={() => void set('STANDARD')}");
    expect(live).toContain('if (l && l.enabled === f.enabled && l.fee === fee && l.hours === hours) return;');
    const scr = readFileSync('src/components/options/FactoringOfferScreen.tsx', 'utf8');
    expect(scr).toContain("onChange('payoutDelayValue', u === 'days' ? v / 24 : v * 24);");
    expect(scr).toContain("if (u === 'days' && v % 24 !== 0) return;");
    const br = readFileSync('src/data/supabaseBridge.ts', 'utf8');
    expect(br).toContain("if (res && res.warning) useTowerStore.getState().pushToast(res.warning, 'MEDIUM');");
  });
});
