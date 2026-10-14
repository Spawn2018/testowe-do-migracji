/**
 * wyglad/P5 — Faktury (E4, img/e4-faktury-desk / -phone; E4b faktoring).
 * Jedna strona z modułem zapisującym w bazie (rejestracja, weryfikacja, opłacenie — bez zmian działania).
 * HHL: zakładki „Od przewoźnika · koszt” i „Do KSH · przychód”; KSH widzi tylko faktury od HHL, SCX tylko swoje.
 * Każda zakładka: kafelki (czeka na wystawienie, do weryfikacji, do zapłaty w 7 dni, po terminie), obieg (komputer),
 * lista z jednym statusem, nowa faktura. Panel makiety (porównanie trójstronne tygodnia 38, lokalne przyciski,
 * formularz oferty faktoringu) usunięty (E4 „Jedna strona”, E4b „Usunąć”). Telefon: kafelki 2 × 2 i karty, bez obiegu
 * i bez tabeli „Kto co widzi” (img/e4-faktury-phone, E8). Terminy: SCX → HHL 35 dni, HHL → KSH 30 dni (03_REJESTR).
 */
import { useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { attachDocumentFile } from '../lib/docFiles';
import { canSeeCost } from '../lib/permissions';
import { t } from '../i18n/messages';
import { ft } from '../i18n/p5';
import type { BillDirection, Document } from '../types';
import { DocPreview } from '../components/ui/DocPreview';
import { DocFileRow } from '../components/ui/DocFileRow';
import { BillsSection, WhoSees } from './BillsPanel';
import { isLoadCompleted } from '../lib/invoiceMatch';
import { getNowIso } from '../lib/frozenNow';
import { transportLabel } from '../lib/transportName';
import { useIsPhone } from '../lib/useIsPhone';
import { docCategoryLabel } from '../lib/enumLabels';
import { factoringTasksOf } from '../lib/p5Source';
import { FactoringTaskCard } from '../components/invoices/Factoring';
import { up } from '../components/options/up';
import '../components/finance/finance.css';
import '../components/invoices/invoices.css';

export function InvoicesView() {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const loads = useTowerStore((s) => s.loads);
  const bills = useTowerStore((s) => s.bills);
  const documents = useTowerStore((s) => s.documents);
  const phone = useIsPhone();
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const [attachLoadId, setAttachLoadId] = useState<string | null>(null);
  const sections: BillDirection[] = role === 'HHL' ? ['KOSZT', 'PRZYCHOD'] : role === 'SCX' ? ['KOSZT'] : ['PRZYCHOD'];
  const [tab, setTab] = useState<BillDirection>(sections[0]);
  const nowIso = getNowIso();
  const tasks = useMemo(() => (role === 'HHL' ? factoringTasksOf(bills, nowIso) : []), [role, bills, nowIso]);
  /* CMR do faktur: ostatnie dostarczone transporty (wgrywanie CMR z podpisem — jak dziś; okno „Wgraj dokument” E31 w P5) */
  const recent = useMemo(() => loads.filter(isLoadCompleted).slice(-6), [loads]);

  if (role === 'SCX' && !canSeeCost(role)) {
    return (
      <div className="fin-page" data-page="invoices">
        <p className="fin-muted fin-pad">{t(locale, 'inv_unavailable')}</p>
      </div>
    );
  }

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const n = sections.length;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
    setTab(sections[j]);
    document.getElementById(`inv-tab-${sections[j]}`)?.focus();
  };

  return (
    <div className="fin-page inv-page" data-page="invoices">
      <header className="fin-head inv-head">
        <h2>{ft(locale, 'p5_inv_h')}</h2>
        <span className="sub">{ft(locale, `p5_inv_sub_${role}`)}</span>
      </header>
      {sections.length > 1 ? (
        <div className="inv-tabs" role="tablist" aria-label={ft(locale, 'p5_inv_h')}>
          {sections.map((d, i) => (
            <button
              key={d}
              id={`inv-tab-${d}`}
              type="button"
              role="tab"
              data-inv-tab={d}
              aria-selected={tab === d}
              aria-controls={`inv-panel-${d}`}
              tabIndex={tab === d ? 0 : -1}
              className={tab === d ? 'on' : undefined}
              onClick={() => setTab(d)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {up(ft(locale, `p5_inv_tab_${d}`))}
            </button>
          ))}
        </div>
      ) : null}
      {sections.map((d) => (
        <div
          key={d}
          id={`inv-panel-${d}`}
          role={sections.length > 1 ? 'tabpanel' : undefined}
          aria-labelledby={sections.length > 1 ? `inv-tab-${d}` : undefined}
          hidden={sections.length > 1 && tab !== d}
          className="inv-panel"
        >
          <BillsSection direction={d} phone={phone} />
          {d === 'KOSZT' && tasks.length ? (
            <div className="inv-tasks">
              {tasks.map((x) => <FactoringTaskCard key={x.billId} task={x} nowIso={nowIso} locale={locale} />)}
            </div>
          ) : null}
        </div>
      ))}

      <section className="panel fin-panel" aria-labelledby="inv-cmr-h" data-inv-cmr>
        <header className="panel-hd fin-hd2 inv-list-hd">
          <h3 id="inv-cmr-h">{t(locale, 'inv_attachments')}</h3>
          <span className="sub">{ft(locale, 'p5_inv_cmr_sub')}</span>
          <div className="spacer" />
          {role === 'SCX' || role === 'HHL' ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                const id = recent[0]?.id;
                if (!id) return;
                setAttachLoadId(id);
                attachRef.current?.click();
              }}
            >
              {t(locale, 'btn_attach')}
            </button>
          ) : null}
        </header>
        <div className="fin-pad inv-cmr">
          {recent.length === 0 ? (
            <p className="fin-muted">{t(locale, 'inv_empty')}</p>
          ) : (
            recent.flatMap((l) => {
              const docs = documents.filter(
                (d) => d.loadId === l.id && d.category === 'CMR' && (d.status === 'UPLOADED' || d.status === 'MISSING'),
              );
              if (docs.length === 0) {
                return [
                  <div key={`${l.id}-empty`} className="mrow">
                    <span className="lbl"><span className="code">{transportLabel(l, role)}</span> · CMR</span>
                    <span className="neg">{t(locale, 'a6_inv_missing')}</span>
                  </div>,
                ];
              }
              return docs.map((d) => (
                <DocFileRow
                  key={d.id}
                  doc={d}
                  label={`${transportLabel(l, role)} · ${docCategoryLabel(d.category, locale)}`}
                  onPreview={setPreviewDoc}
                  showUpload={role === 'SCX' || role === 'HHL'}
                  onUploadClick={() => {
                    setAttachLoadId(l.id);
                    attachRef.current?.click();
                  }}
                />
              ));
            })
          )}
        </div>
        <input
          ref={attachRef}
          type="file"
          accept="image/*,application/pdf"
          className="sronly"
          aria-label={t(locale, 'a6_inv_pick_att')}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f || !attachLoadId) return;
            // BK4: tryb Supabase → Storage; demo → pamięć sesji.
            // B-4b: załącznik faktury = wyłącznie CMR (bez POD).
            void attachDocumentFile(f, attachLoadId, 'CMR');
          }}
        />
      </section>

      {phone ? null : <WhoSees />}
      <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
