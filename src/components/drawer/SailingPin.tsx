/**
 * #557 cz. 2 — „Przypnij rejs” w wierszu „Rejs” karty transportu.
 * Widoczne tylko dla Administratora HHL we własnym widoku i tylko przy otwartym ostrzeżeniu o złym rejsie.
 * Przed zapisem — potwierdzenie w karcie (bez okien przeglądarki). Po zapisie dane karty pobierają się z bazy.
 * Rodzic montuje komponent z `key={load.id}` — wynik dla jednego transportu nie trafia do karty innego.
 */
import { useEffect, useRef, useState } from 'react';
import type { Locale, Sailing } from '../../types';
import { useTowerStore } from '../../store/useTowerStore';
import { pt, ptp } from '../../i18n/p7';
import { pinErrorKey, proposedText, sailingMismatchAssign, sailingMismatchSuggest, type PinSuggest } from '../../lib/sailingPin';

export function SailingPin({ loadId, locale, sailings }: { loadId: string; locale: Locale; sailings: readonly Sailing[] }) {
  const pushToast = useTowerStore((s) => s.pushToast);
  const [sug, setSug] = useState<PinSuggest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /* blokada synchroniczna: drugie kliknięcie przed odświeżeniem stanu nie wyśle drugiego zapisu */
  const sent = useRef(false);
  const pinBtn = useRef<HTMLButtonElement>(null);
  const yesBtn = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let live = true;
    sailingMismatchSuggest(loadId)
      .then((r) => {
        if (!live) return;
        setSug(r.data);
        setErr(r.error ? pt(locale, 'p7_pin_err_read') : null);
      })
      .catch(() => { if (live) setErr(pt(locale, 'p7_pin_err_read')); })
      .finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [loadId, locale]);

  useEffect(() => { if (ask) yesBtn.current?.focus(); }, [ask]);
  useEffect(() => { if (done) doneRef.current?.focus(); }, [done]);

  if (!loaded) return null;
  const label = sug ? proposedText(sug, sailings) : null;

  if (done) {
    return <p ref={doneRef} tabIndex={-1} className="po-ok" role="status" data-sail-pin-done>{ptp(locale, 'p7_pin_done', { sailing: done })}</p>;
  }
  if (!sug || !sug.mismatch) {
    return err ? <p className="po-set-err" role="alert" data-sail-pin-err>{err}</p> : null;
  }
  if (!sug.proposedSailingId || !label) {
    return <p className="po-muted" data-sail-pin-none>{pt(locale, 'p7_pin_none')}</p>;
  }
  const target = sug.proposedSailingId;

  const cancel = () => {
    setAsk(false);
    window.requestAnimationFrame(() => pinBtn.current?.focus());
  };
  const confirm = async () => {
    if (sent.current) return;
    sent.current = true;
    setBusy(true);
    setErr(null);
    try {
      const r = await sailingMismatchAssign(loadId, target);
      if (!r.ok) {
        sent.current = false;
        setErr(pt(locale, pinErrorKey(r.error)));
        return;
      }
      setAsk(false);
      setDone(label);
      pushToast(ptp(locale, 'p7_pin_done', { sailing: label }), 'LOW', loadId);
      /* warunek wprost (strażnik I-0/I-2): paczka demo nie zawiera mostu do bazy */
      if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
        const { refreshFromServer } = await import('../../data/supabaseBridge');
        await refreshFromServer({ keepSelection: true });
      }
    } catch {
      /* zapis mógł dojść do bazy — bez ponowienia; odświeżenie pokaże stan rzeczywisty */
      setErr(pt(locale, 'p7_pin_err'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="po-pin" data-sail-pin>
      <p className="po-miss" data-sail-pin-lead>{ptp(locale, 'p7_pin_lead', { sailing: label })}</p>
      {ask ? (
        <div role="group" aria-label={pt(locale, 'p7_pin_btn')} data-sail-pin-ask>
          <p>{ptp(locale, 'p7_pin_ask', { sailing: label })}</p>
          <div className="po-act">
            <button ref={yesBtn} type="button" className="btn" aria-disabled={busy || undefined} onClick={() => { void confirm(); }} data-sail-pin-yes>
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
