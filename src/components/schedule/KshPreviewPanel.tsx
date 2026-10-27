/**
 * W-567 (decyzja 23B) — Harmonogram: „Zmiany z pliku KSH do przejrzenia (N)”.
 * Tylko produkcja, tylko Administrator / Operacje HHL i tylko gdy import z pliku jest wyłączony (warunki w ScheduleView).
 * Domyślnie zwinięty; RPC `ksh_sync_preview_get()` wołane przy pierwszym rozwinięciu i po „Odśwież”.
 * Brak funkcji w bazie (PGRST202) → panel znika bez komunikatu; null → „Lista jeszcze nie przygotowana…”;
 * inny błąd → krótki komunikat w panelu (nad poprzednio wczytaną tabelą, jeśli była).
 */
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { getSupabase } from '../../auth/client';
import { useTowerStore } from '../../store/useTowerStore';
import { s7, s7p } from '../../i18n/sched7';
import {
  groupPreview, isMissingRpc, previewKindCodes, previewTotal, kshPreviewFromRpc, previewCounts, previewNotes, previewReadAt, previewValue,
  type KshPreview,
} from '../../lib/kshPreviewView';

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

  const groups = useMemo(() => (data ? groupPreview(data.changes, onlyManual) : []), [data, onlyManual]);
  const counts = useMemo(() => (data ? previewCounts(data.changes) : null), [data]);
  const added = useMemo(() => (data ? previewKindCodes(data.changes, 'added') : []), [data]);
  const missing = useMemo(() => (data ? previewKindCodes(data.changes, 'missing') : []), [data]);

  if (gone) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !started) void load();
  };
  const title = counts ? s7p(locale, 's7_kp_title_n', { n: previewTotal(counts) }) : s7(locale, 's7_kp_title');
  const lbl = {
    code: s7(locale, 's7_kp_c_code'), field: s7(locale, 's7_kp_c_field'), wt: s7(locale, 's7_kp_c_wt'),
    file: s7(locale, 's7_kp_c_file'), notes: s7(locale, 's7_kp_c_notes'),
  };

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
              {!onlyManual ? ([['added', added], ['missing', missing]] as const).map(([k, list]) => (list.length ? (
                <div key={k} className="s7-kp-codes" data-ksh-preview-kind={k}>
                  <b>{s7p(locale, k === 'added' ? 's7_kp_added' : 's7_kp_missing', { n: list.length })}</b>
                  <ul>
                    {list.map((x) => (
                      <li key={x.code}>
                        {x.loadId ? (
                          <button type="button" className="s7-kp-link" aria-label={s7p(locale, 's7_kp_open', { code: x.code })} onClick={() => selectLoad(x.loadId)}>{x.code}</button>
                        ) : x.code}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null)) : null}
              {(added.length || missing.length) && groups.length ? <b className="s7-kp-sub">{s7p(locale, 's7_kp_fields', { n: counts.fields })}</b> : null}
              {groups.length === 0 && (onlyManual || (!added.length && !missing.length)) ? (
                <p className="s7-kp-meta" data-ksh-preview-empty>{s7(locale, onlyManual ? 's7_kp_empty_manual' : 's7_kp_empty')}</p>
              ) : groups.length === 0 ? null : (
                <table className="ox-table ox-cards-phone s7-kp-t" data-ksh-preview-table>
                  <thead>
                    <tr><th>{lbl.code}</th><th>{lbl.field}</th><th>{lbl.wt}</th><th>{lbl.file}</th><th>{lbl.notes}</th></tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <Fragment key={g.code}>
                        {g.rows.map((r, i) => {
                          const notes = previewNotes(r);
                          return (
                            <tr key={`${r.field}-${i}`} data-ksh-preview-row={g.code} className={i === 0 ? 's7-kp-first' : 's7-kp-cont'}>
                              <th scope="row" data-label={lbl.code} className={i === 0 ? 's7-kp-code' : 's7-kp-code s7-kp-code-cont'}>
                                {/* Kod transportu w każdym wierszu (zgłoszenie właściciela 27.10, 14:24 — drugi wiersz BS-06 wyglądał na „bez numeru”). */}
                                {g.loadId ? (
                                  <button type="button" className="s7-kp-link" aria-label={s7p(locale, 's7_kp_open', { code: g.code })} onClick={() => selectLoad(g.loadId)}>
                                    {g.code}
                                  </button>
                                ) : g.code}
                              </th>
                              <td data-label={lbl.field}>{r.fieldLabel}</td>
                              <td data-label={lbl.wt}>{previewValue(r.wt, r.field)}</td>
                              <td data-label={lbl.file}>{previewValue(r.file, r.field)}</td>
                              <td data-label={lbl.notes} className="s7-kp-notes">
                                {notes.length === 0 ? '—' : notes.map((n) => (
                                  <span key={n} className={`pill ${n === 'manual' ? 'p-amber' : n === 'skip' ? 'p-plan' : 'p-sea'}`} data-ksh-preview-note={n}>
                                    {n === 'skip'
                                      ? s7p(locale, 's7_kp_skip', { reason: r.skipReason ?? '' })
                                      : s7(locale, n === 'manual' ? 's7_kp_manual' : 's7_kp_pending')}
                                  </span>
                                ))}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
