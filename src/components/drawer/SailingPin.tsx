/**
 * #557 cz. 2 — „Przypnij rejs” w wierszu „Rejs” karty transportu.
 * Widoczne tylko dla Administratora HHL we własnym widoku i tylko przy otwartym ostrzeżeniu o złym rejsie.
 * Przed zapisem — potwierdzenie w karcie (bez okien przeglądarki). Po zapisie dane karty pobierają się z bazy.
 */
import { useEffect, useRef, useState } from 'react';
import type { Locale, Sailing } from '../../types';
import { useTowerStore } from '../../store/useTowerStore';
import { pt, ptp } from '../../i18n/p7';
import { proposedText, sailingMismatchAssign, sailingMismatchSuggest, type PinSuggest } from '../../lib/sailingPin';

export function SailingPin({ loadId, locale, sailings }: { loadId: string; locale: Locale; sailings: readonly Sailing[] }) {
  const pushToast = useTowerStore((s) => s.pushToast);
  const [sug, setSug] = useState<PinSuggest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pinBtn = useRef<HTMLButtonElement>(null);
  const yesBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    setLoaded(false);
    setSug(null);
    setAsk(false);
    setErr(null);
    void sailingMismatchSuggest(loadId).then((r) => {
      if (!live) return;
      setSug(r.data);
      setErr(r.error ? pt(locale, 'p7_pin_err_read') : null);
      setLoaded(true);
    });
    return () => { live = false; };
  }, [loadId, locale]);

  useEffect(() => { if (ask) yesBtn.current?.focus(); }, [ask]);

  if (!loaded) return null;
  const label = sug ? proposedText(sug, sailings) : null;

  if (!sug || !sug.mismatch) {
    return err ? <p className="po-set-err" role="alert" data-sail-pin-err>{err}</p> : null;
  }
  if (!sug.proposedSailingId || !label) {
    return <p className="po-muted" data-sail-pin-none>{pt(locale, 'p7_pin_none')}</p>;
  }

  const cancel = () => {
    setAsk(false);
    window.requestAnimationFrame(() => pinBtn.current?.focus());
  };
  const confirm = () => {
    if (busy || !sug.proposedSailingId) return;
    setBusy(true);
    setErr(null);
    void sailingMismatchAssign(loadId, sug.proposedSailingId).then(async (r) => {
      setBusy(false);
      if (!r.ok) {
        setErr(r.error === 'assign_failed' || !r.error ? pt(locale, 'p7_pin_err') : `${pt(locale, 'p7_pin_err')} ${r.error}`);
        return;
      }
      setAsk(false);
      pushToast(ptp(locale, 'p7_pin_done', { sailing: label }), 'LOW', loadId);
      /* warunek wprost (strażnik I-0/I-2): paczka demo nie zawiera mostu do bazy */
      if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
        const { refreshFromServer } = await import('../../data/supabaseBridge');
        await refreshFromServer({ keepSelection: true });
      }
    });
  };

  return (
    <div className="po-pin" data-sail-pin>
      <p className="po-miss" data-sail-pin-lead>{ptp(locale, 'p7_pin_lead', { sailing: label })}</p>
      {ask ? (
        <div role="group" aria-label={pt(locale, 'p7_pin_btn')} data-sail-pin-ask>
          <p>{ptp(locale, 'p7_pin_ask', { sailing: label })}</p>
          <div className="po-act">
            <button ref={yesBtn} type="button" className="btn" aria-disabled={busy || undefined} onClick={confirm} data-sail-pin-yes>
              {pt(locale, busy ? 'p7_pin_busy' : 'p7_pin_yes')}
            </button>
            <button type="button" className="btn ghost" onClick={cancel} disabled={busy} data-sail-pin-no>{pt(locale, 'p7_pin_no')}</button>
          </div>
        </div>
      ) : (
        <div className="po-act">
          <button ref={pinBtn} type="button" className="btn ghost" onClick={() => { setErr(null); setAsk(true); }} data-sail-pin-btn>
            {pt(locale, 'p7_pin_btn')}
          </button>
        </div>
      )}
      {err ? <p className="po-set-err" role="alert" data-sail-pin-err>{err}</p> : null}
    </div>
  );
}
