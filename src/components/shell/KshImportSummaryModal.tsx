/**
 * #594 B1 (właściciel 27.10, 14:55): po kliknięciu zbiorczego powiadomienia o imporcie pliku KSH — okno ze szczegółami.
 * Tło rozmyte, zamknięcie ikoną ✕ (także Esc i dotknięcie tła), tło wraca do pełnej widoczności.
 * Na telefonie okno na cały ekran, tabela jako karty; tekst i liczby zawijają się w swoich sekcjach, czcionka maleje
 * (`clamp`) zamiast wychodzić poza komórki. Fokus zostaje w oknie (Tab / Shift+Tab), po zamknięciu wraca na dzwonek.
 * Dane: RPC `ksh_import_summary_get(p_id)` — migawka przefiltrowana wg roli w bazie (#601).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { s7, s7p } from '../../i18n/sched7';
import { previewReadAt } from '../../lib/kshPreviewView';
import { kshImportSummaryFromRpc, type KshImportSummary } from '../../lib/kshImportSummary';
import { KshChangeList } from '../schedule/KshChangeList';

type State = { kind: 'loading' } | { kind: 'error'; msg: string } | { kind: 'none' } | { kind: 'ok'; data: KshImportSummary };

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

export function KshImportSummaryModal() {
  const id = useTowerStore((s) => s.importSummaryId);
  if (!id) return null;
  return <SummaryDialog key={id} id={id} />;
}

function SummaryDialog({ id }: { id: string }) {
  const locale = useTowerStore((s) => s.locale);
  const close = useTowerStore((s) => s.closeImportSummary);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const boxRef = useRef<HTMLElement>(null);
  const xRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    /* warunek wpisany wprost — paczka demo bez klienta Supabase (I-2) */
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') { setState({ kind: 'none' }); return; }
    try {
      const { getSupabase } = await import('../../auth/client');
      const sb = await getSupabase();
      const { data, error } = await sb.rpc('ksh_import_summary_get', { p_id: id });
      if (error) { setState({ kind: 'error', msg: error.message }); return; }
      const v = kshImportSummaryFromRpc(data);
      setState(v ? { kind: 'ok', data: v } : { kind: 'none' });
    } catch (e) {
      setState({ kind: 'error', msg: e instanceof Error ? e.message : String(e) });
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const done = useCallback(() => {
    close();
    /* fokus wraca na dzwonek (okno otwiera się z jego listy) */
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.bell-trigger')?.focus());
  }, [close]);

  useEffect(() => {
    xRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        done();
        return;
      }
      if (e.key !== 'Tab' || !boxRef.current) return;
      const els = [...boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [done]);

  const d = state.kind === 'ok' ? state.data : null;
  const title = d ? s7p(locale, 's7_kis_title_at', { at: previewReadAt(d.importedAt) }) : s7(locale, 's7_kis_title');

  return (
    <>
      <div className="kis-scrim" aria-hidden="true" data-kis-scrim onClick={done} />
      <section ref={boxRef} className="panel kis-modal" role="dialog" aria-modal="true" aria-labelledby="kis-title" data-kis-modal aria-busy={state.kind === 'loading'}>
        <header className="panel-hd kis-hd">
          <h2 id="kis-title">{title}</h2>
          <div className="spacer" />
          <button ref={xRef} type="button" className="iconbtn kis-x" aria-label={s7(locale, 's7_kis_close')} data-kis-close onClick={done}>✕</button>
        </header>
        <div className="kis-bd s7-kp">
          <div aria-live="polite">
            {state.kind === 'loading' ? <p className="s7-kp-meta">{s7(locale, 's7_kp_loading')}</p> : null}
            {state.kind === 'error' ? (
              <p className="s7-kp-err" data-kis-error>
                {s7p(locale, 's7_kis_error', { msg: state.msg })}{' '}
                <button type="button" className="s7-kp-link" onClick={() => void load()}>{s7(locale, 's7_kp_refresh')}</button>
              </p>
            ) : null}
            {state.kind === 'none' ? <p className="s7-kp-meta" data-kis-none>{s7(locale, 's7_kis_none')}</p> : null}
          </div>
          {d ? (
            <>
              <p className="s7-kp-meta kis-sum" data-kis-sum>
                {s7p(locale, 's7_kis_sum', {
                  t: new Set(d.changes.map((c) => c.code)).size, f: d.counts.fields, a: d.counts.added, b: d.counts.missing,
                })}
              </p>
              {d.fileName ? <p className="s7-kp-meta kis-file">{s7p(locale, 's7_kis_file', { name: d.fileName })}</p> : null}
              <KshChangeList
                locale={locale}
                changes={d.changes}
                counts={d.counts}
                emptyKey="s7_kis_empty"
                onOpenLoad={(loadId) => { done(); selectLoad(loadId); }}
              />
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}
