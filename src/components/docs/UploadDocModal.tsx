/**
 * wyglad/P5 — okno „Wgraj dokument” (E31 pkt 6, img/e31-after): transport (szukaj po kodzie lub numerze zlecenia),
 * rodzaj (braki tego transportu na górze), przy zezwoleniu „Firma” albo „Trasa”, plik (przeciągnij, wybierz,
 * na telefonie zdjęcie z aparatu). Zapis jak dziś — `attachDocumentFile` do wybranego transportu i rodzaju.
 * Z panelu transportu okno otwiera się z wybranym transportem (`loadId`).
 * „Firma / Trasa” i nazwa pliku z kodem — gdy wykonawca podłączy (`permitScopeOf`), dziś tylko w demo.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DocCategory, Load, Locale } from '../../types';
import type { DocStatusRow } from '../../lib/docRequirements';
import { attachDocumentFile } from '../../lib/docFiles';
import { docCategoryLabel } from '../../lib/enumLabels';
import { kindOptions, searchLoads } from '../../lib/p5Docs';
import { transportLabel } from '../../lib/transportName';
import { permitScopeOf } from '../../lib/p5Source';
import { ft, ftp } from '../../i18n/p5';
import { useModal } from '../ui/useModal';
import { t } from '../../i18n/messages';
import './docs.css';
import { formatCalendarDay } from '../../lib/time';
import { transportsText } from '../../lib/p5Finance';

interface Props {
  locale: Locale;
  role: 'HHL' | 'SCX';
  phone: boolean;
  loads: Load[];
  statusRows: DocStatusRow[];
  allowed: DocCategory[];
  loadId?: string | null;
  onClose: () => void;
}

const dm = (d: string | null | undefined) => (d ? formatCalendarDay(d.slice(0, 10)) : '—');

export function UploadDocModal({ locale, role, phone, loads, statusRows, allowed, loadId, onClose }: Props) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string>(loadId ?? '');
  const [cat, setCat] = useState<DocCategory | ''>('');
  const [scope, setScope] = useState<'FIRMA' | 'TRASA'>('FIRMA');
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const scopeOn = permitScopeOf();

  const list = useMemo(() => searchLoads(loads, q).slice(0, 200), [loads, q]);
  const load = loads.find((l) => l.id === sel) ?? null;
  const kinds = useMemo(() => (sel ? kindOptions(sel, statusRows, allowed) : allowed.map((c) => ({ category: c, state: null }))), [sel, statusRows, allowed]);
  const kind = cat || kinds[0]?.category || '';
  const isPermit = kind === 'PERMIT_PL' || kind === 'PERMIT_SE';

  const boxRef = useRef<HTMLElement>(null);
  useModal(boxRef, onClose);
  /* fokus do okna po zapamiętaniu przycisku, który je otworzył (useModal) */
  /* telefon: bez automatycznego fokusu — klawiatura zasłoniłaby okno */
  useEffect(() => { if (!phone) firstRef.current?.focus(); }, [phone]);

  const stateText = (s: 'OVERDUE' | 'MISSING' | 'OK' | null) => (s ? ft(locale, `p5_up_state_${s}`) : '');
  const typeName = load?.itemType ?? '';
  const firmaCount = typeName ? loads.filter((l) => l.itemType === typeName && l.status !== 'CANCELLED').length : 0;

  const submit = async () => {
    if (!sel || !kind || !file) return;
    setBusy(true);
    try {
      const ok = await attachDocumentFile(file, sel, kind);
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="scrim" style={{ zIndex: 52 }} aria-label={t(locale, 'close')} onClick={onClose} />
      <section ref={boxRef} className="panel awiz-modal up-modal" role="dialog" aria-modal="true" aria-labelledby="up-title" data-upload-modal>
        <header className="panel-hd">
          <h2 id="up-title">{ft(locale, 'p5_up_h')}</h2>
          <div className="spacer" />
          <button type="button" className="iconbtn" aria-label={ft(locale, 'p5_up_cancel')} onClick={onClose}>✕</button>
        </header>
        <div className="panel-bd awiz-modal-bd up-bd">
          <div className="up-field">
            <label className="up-lbl" htmlFor="up-load">{ft(locale, 'p5_up_load')}</label>
            <input
              ref={firstRef}
              className="input"
              type="search"
              placeholder={ft(locale, 'p5_up_search')}
              aria-label={ft(locale, 'p5_up_search')}
              value={q}
              data-up-search
              onChange={(e) => {
                setQ(e.target.value);
                const hit = searchLoads(loads, e.target.value);
                if (e.target.value.trim() && !hit.some((l) => l.id === sel)) { setSel(hit[0]?.id ?? ''); setCat(''); }
              }}
            />
            <select id="up-load" className="input" value={sel} data-up-load onChange={(e) => { setSel(e.target.value); setCat(''); }}>
              <option value="" disabled>{list.length ? ft(locale, 'p5_up_pick_load') : ft(locale, 'p5_up_none')}</option>
              {list.map((l) => (
                <option key={l.id} value={l.id}>
                  {[transportLabel(l, role), l.itemType, l.plannedLoadDate ? ftp(locale, 'p5_up_load_date', { date: dm(l.plannedLoadDate) }) : null].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </div>
          <div className="up-field">
            <label className="up-lbl" htmlFor="up-kind">{ft(locale, 'p5_up_kind')}</label>
            <select id="up-kind" className="input" value={kind} data-up-kind onChange={(e) => setCat(e.target.value as DocCategory)}>
              {kinds.map((k) => (
                <option key={k.category} value={k.category}>
                  {docLabel(locale, k.category)}{k.state && k.state !== 'OK' ? ` · ${stateText(k.state)}` : ''}
                </option>
              ))}
            </select>
            {sel && kinds.length > 1 ? <span className="fin-muted">{ft(locale, 'p5_up_kind_hint')}</span> : null}
          </div>
          {isPermit && scopeOn ? (
            <div className="up-field" role="group" aria-labelledby="up-scope">
              <span className="up-lbl" id="up-scope">{ft(locale, 'p5_up_scope')}</span>
              <div className="up-seg">
                <button type="button" aria-pressed={scope === 'FIRMA'} data-up-scope="FIRMA" onClick={() => setScope('FIRMA')}>
                  {ftp(locale, 'p5_up_scope_firma', { type: typeName || ft(locale, 'p5_up_this_type') })}
                </button>
                <button type="button" aria-pressed={scope === 'TRASA'} data-up-scope="TRASA" onClick={() => setScope('TRASA')}>
                  {ft(locale, 'p5_up_scope_trasa')}
                </button>
              </div>
            </div>
          ) : null}
          <div className="up-field">
            <span className="up-lbl">{ft(locale, 'p5_up_file')}</span>
            <div
              className={drag ? 'up-drop is-drag' : 'up-drop'}
              data-up-drop
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
            >
              {file ? (
                <span data-content><b>{file.name}</b> ✓</span>
              ) : phone ? null : (
                <span>{ft(locale, 'p5_up_drop')} </span>
              )}
              <button type="button" className="linkbtn" data-up-pick onClick={() => fileRef.current?.click()}>
                {file ? ft(locale, 'p5_up_change') : phone ? ft(locale, 'p5_up_photo') : ft(locale, 'p5_up_pick')}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="sronly"
              aria-label={ft(locale, 'p5_up_file')}
              data-up-file
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFile(f); }}
            />
            {isPermit && scopeOn && scope === 'FIRMA' && load ? (
              /* P11 (e31): nazwa zapisywanego pliku i liczba transportów, do których się podepnie */
              <span className="fin-muted" data-content data-up-firma-n={firmaCount}>
                {typeName
                  ? ftp(locale, 'p5_up_firma_note_n', { file: `Zezwolenie_${kind === 'PERMIT_SE' ? 'SE' : 'PL'}_${typeName}.pdf`, loads: transportsText(firmaCount), type: typeName })
                  : ftp(locale, 'p5_up_firma_note', { type: ft(locale, 'p5_up_this_type') })}
              </span>
            ) : null}
          </div>
          <div className="up-acts">
            <button type="button" className="btn ghost" onClick={onClose}>{ft(locale, 'p5_up_cancel')}</button>
            <button type="button" className="btn" data-up-send disabled={!sel || !kind || !file || busy} onClick={() => void submit()}>
              {ft(locale, 'p5_up_send')}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

/** Nazwy rodzajów w oknie i na liście plików (E31: zezwolenia bez „dispens”, CMR podpisany). */
export function docLabel(locale: Locale, c: DocCategory): string {
  const k = `p5_doc_cat_${c}`;
  const v = ft(locale, k);
  return v === k ? docCategoryLabel(c, locale) : v;
}
