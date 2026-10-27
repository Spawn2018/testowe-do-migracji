/**
 * W-567 (decyzja 23B) — Harmonogram: „Zmiany z pliku KSH do przejrzenia (N)”.
 * Tylko produkcja, tylko Administrator / Operacje HHL i tylko gdy import z pliku jest wyłączony (warunki w ScheduleView).
 * Domyślnie zwinięty; RPC `ksh_sync_preview_get()` wołane przy pierwszym rozwinięciu i po „Odśwież”.
 * Brak funkcji w bazie (PGRST202) → panel znika bez komunikatu; null → „Lista jeszcze nie przygotowana…”;
 * inny błąd → krótki komunikat w panelu (nad poprzednio wczytaną tabelą, jeśli była).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { getSupabase } from '../../auth/client';
import { useTowerStore } from '../../store/useTowerStore';
import { s7, s7p } from '../../i18n/sched7';
import {
  isMissingRpc, previewTotal, kshPreviewFromRpc, previewCounts, previewReadAt,
  type KshPreview,
} from '../../lib/kshPreviewView';
import { KshChangeList } from './KshChangeList';

export function KshPreviewPanel() {
  const locale = useTowerStore((s) => s.locale);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Ostatnio wczytana lista — zostaje na ekranie po błędzie „Odśwież” (komunikat nad nią). */
  const [data, setData] = useState<KshPreview | null>(null);
  /** RPC zwróciło null — lista jeszcze nie przygotowana (panel zostaje, z „Odśwież”). */
  const [notReady, setNotReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** Tylko PGRST202 (funkcji nie ma w bazie) chowa panel. */
  const [gone, setGone] = useState(false);
  const [onlyManual, setOnlyManual] = useState(false);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setStarted(true);
    setLoading(true);
    try {
      const sb = await getSupabase();
      const { data: raw, error } = await sb.rpc('ksh_sync_preview_get');
      if (error) {
        if (isMissingRpc(error)) setGone(true);
        else setErr(error.message);
        return;
      }
      const v = kshPreviewFromRpc(raw);
      setErr(null);
      setNotReady(!v);
      setData(v);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  const counts = useMemo(() => (data ? previewCounts(data.changes) : null), [data]);

  if (gone) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !started) void load();
  };
  const title = counts ? s7p(locale, 's7_kp_title_n', { n: previewTotal(counts) }) : s7(locale, 's7_kp_title');

  return (
    <section className="s7-kp" data-ksh-preview aria-label={s7(locale, 's7_kp_title')} aria-busy={loading}>
      <div className="s7-kp-hd">
        <button type="button" className="s7-kp-toggle" aria-expanded={open} data-ksh-preview-toggle onClick={toggle}>
          <span aria-hidden="true">{open ? '▾' : '▸'}</span> {title}
        </button>
        {open ? (
          <>
            <label className="s7-kp-filter">
              <input type="checkbox" checked={onlyManual} onChange={(e) => setOnlyManual(e.target.checked)} data-ksh-preview-manual />
              {s7(locale, 's7_kp_only_manual')}
            </label>
            <button type="button" className="chipbtn" aria-disabled={loading} data-ksh-preview-refresh onClick={() => { if (!loading) void load(); }}>
              {s7(locale, 's7_kp_refresh')}
            </button>
          </>
        ) : null}
      </div>
      {open ? (
        <div className="s7-kp-bd">
          <div aria-live="polite" data-ksh-preview-msg>
            {err ? <p className="s7-kp-err" data-ksh-preview-error>{s7p(locale, 's7_kp_error', { msg: err })}</p> : null}
            {loading && !data ? <p className="s7-kp-meta">{s7(locale, 's7_kp_loading')}</p> : null}
            {notReady && !loading ? <p className="s7-kp-meta" data-ksh-preview-not-ready>{s7(locale, 's7_kp_not_ready')}</p> : null}
          </div>
          {data && counts ? (
            <>
              <p className="s7-kp-meta" data-ksh-preview-head>
                {s7p(locale, 's7_kp_head', { at: previewReadAt(data.readAt), t: counts.transports, f: counts.fields })}
                {counts.manual ? s7p(locale, 's7_kp_head_manual', { m: counts.manual }) : ''}
                {counts.added ? s7p(locale, 's7_kp_head_added', { a: counts.added }) : ''}
                {counts.missing ? s7p(locale, 's7_kp_head_missing', { b: counts.missing }) : ''}
              </p>
              <p className="s7-kp-meta">{s7(locale, 's7_kp_note')}</p>
              <KshChangeList locale={locale} changes={data.changes} counts={counts} onlyManual={onlyManual} onOpenLoad={(id) => selectLoad(id)} />
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
