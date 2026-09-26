import { useParams, Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useTowerStore, DRIVER_TOKENS } from '../store/useTowerStore';
import type { Locale } from '../types';
import { t } from '../i18n/messages';
import type { Document } from '../types';
import { DocPreview } from '../components/ui/DocPreview';
import { DocFileRow } from '../components/ui/DocFileRow';
import { attachDocumentFile } from '../lib/docFiles';
import {
  driverLocaleFrom, fixFromPosition, readDriverConsent, shouldSendFix, watchDriverPosition, writeDriverConsent,
  type DriverConsent, type DriverFix,
} from '../lib/driverTracking';
import { getNowIso } from '../lib/frozenNow';

export function DriverPwa() {
  const { token = 'demo-active' } = useParams();
  const driverMilestone = useTowerStore((s) => s.driverMilestone);
  const driverSharePosition = useTowerStore((s) => s.driverSharePosition);
  const loads = useTowerStore((s) => s.loads);
  const documents = useTowerStore((s) => s.documents);
  const driverReportFix = useTowerStore((s) => s.driverReportFix);
  /* M9 — język kierowcy z telefonu; zgoda przy pierwszym uruchomieniu na urządzeniu */
  const [locale, setLocale] = useState<Locale>(() => driverLocaleFrom(typeof navigator === 'undefined' ? null : navigator.language));
  const [consent, setConsent] = useState<DriverConsent>(() => readDriverConsent());
  const [lastFix, setLastFix] = useState<DriverFix | null>(null);
  const [geoError, setGeoError] = useState(false);
  const sentRef = useRef<DriverFix | null>(null);
  const [lastFile, setLastFile] = useState<string | null>(null);
  const [cat, setCat] = useState<'CMR' | 'POD'>('CMR');
  const [busy, setBusy] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const loadId = DRIVER_TOKENS[token];

  /* pozycja ciągła wyłącznie za zgodą i dla przypisanego transportu */
  useEffect(() => {
    if (consent !== 'granted' || !loadId) return;
    return watchDriverPosition(
      (p) => {
        const fix = fixFromPosition(p, getNowIso());
        setLastFix(fix);
        setGeoError(false);
        if (shouldSendFix(sentRef.current, fix)) {
          sentRef.current = fix;
          driverReportFix(token, fix);
        }
      },
      () => setGeoError(true),
    );
  }, [consent, loadId, token, driverReportFix]);

  const decide = (v: 'granted' | 'denied') => {
    writeDriverConsent(v);
    setConsent(v);
    setGeoError(false);
    if (v === 'denied') setLastFix(null);
  };
  const load = loadId ? loads.find((l) => l.id === loadId) : undefined;
  const vaultDocs = loadId
    ? documents.filter((d) => d.loadId === loadId && (d.category === 'CMR' || d.category === 'POD') && d.status === 'UPLOADED')
    : [];

  return (
    <div className="driver-pwa">
      <header className="driver-pwa-hd">
        <div className="font-cond" style={{ fontSize: 20, fontWeight: 700 }}>
          WATCH TOWER · {t(locale, 'drv_title')}
        </div>
        <div className="driver-meta">
          {load?.code ?? loadId} · token {token}
        </div>
        <div className="driver-pwa-tabs">
          {(['pl', 'en', 'sv'] as Locale[]).map((l) => (
            <button key={l} type="button" className="btn" aria-pressed={locale === l} onClick={() => setLocale(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <main className="driver-pwa-main">
        {!loadId && (
          <div className="driver-alert">
            Nieznany token kierowcy — użyj #/driver/demo-active lub demo-sg14
          </div>
        )}
        {consent === null && loadId ? (
          <div className="panel" data-driver-consent style={{ margin: 0 }}>
            <header className="panel-hd">
              <h2 style={{ fontSize: 16 }}>{t(locale, 'drv_consent_title')}</h2>
            </header>
            <div className="panel-bd">
              <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.45 }}>{t(locale, 'drv_consent_body')}</p>
              <div className="driver-btn-row">
                <button type="button" className="btn driver-btn-grow" data-consent="allow" onClick={() => decide('granted')}>
                  {t(locale, 'drv_consent_allow')}
                </button>
                <button type="button" className="btn ghost driver-btn-grow" data-consent="deny" onClick={() => decide('denied')}>
                  {t(locale, 'drv_consent_deny')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {consent === 'granted' && loadId ? (
          <div className="driver-attach-note" data-tracking="on">
            <b>{t(locale, 'drv_tracking_on')}</b>
            {' · '}
            {geoError ? (
              <span style={{ color: 'var(--wt-crit)' }}>{t(locale, 'drv_tracking_err')}</span>
            ) : lastFix ? (
              <span className="mono" data-last-fix>
                {t(locale, 'drv_tracking_last')} {new Date(lastFix.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} · {lastFix.lat.toFixed(4)}, {lastFix.lng.toFixed(4)}
                {lastFix.accuracy != null ? ` · ${t(locale, 'drv_accuracy')} ${lastFix.accuracy} m` : ''}
              </span>
            ) : (
              <span>{t(locale, 'drv_tracking_waiting')}</span>
            )}
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn ghost" data-consent="withdraw" onClick={() => decide('denied')}>
                {t(locale, 'drv_tracking_stop')}
              </button>
            </div>
          </div>
        ) : null}
        {consent === 'denied' && loadId ? (
          <div className="driver-attach-note" data-tracking="off">
            {t(locale, 'drv_consent_denied')}
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn" data-consent="allow" onClick={() => decide('granted')}>
                {t(locale, 'drv_consent_change')}
              </button>
            </div>
          </div>
        ) : null}
        {consent === 'granted' ? (
          <button
            type="button"
            className="btn driver-btn-block"
            style={{ height: 48, fontSize: 15 }}
            onClick={() => driverSharePosition(token)}
          >
            {t(locale, 'share_pos')}
          </button>
        ) : null}
        {(
          [
            ['LOADED', 'milestone_loaded'],
            ['ON_FERRY', 'milestone_ferry'],
            ['UNLOADED', 'milestone_unloaded'],
            ['PROBLEM', 'milestone_problem'],
          ] as const
        ).map(([m, key]) => (
          <button
            key={m}
            type="button"
            className="btn driver-btn-block"
            style={{
              height: 56,
              fontSize: 18,
              fontWeight: 700,
              fontFamily: 'var(--font-cond)',
              borderColor: m === 'PROBLEM' ? 'var(--wt-crit)' : 'var(--wt-border)',
              color: m === 'PROBLEM' ? 'var(--wt-crit)' : undefined,
            }}
            onClick={() => driverMilestone(token, m)}
          >
            {t(locale, key)}
          </button>
        ))}
        <div className="driver-btn-row">
          {(['CMR', 'POD'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className="btn driver-btn-grow"
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn driver-btn-block"
          disabled={!loadId || busy}
          title={!loadId ? 'Brak przypisanego transportu — nie można załączyć CMR/POD' : undefined}
          onClick={() => camRef.current?.click()}
        >
          {busy ? 'Zapisuję dokument…' : `Aparat / plik → ${cat}`}
        </button>
        <input
          ref={camRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="driver-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f || !loadId) return;
            setBusy(true);
            // BK4: tryb Supabase → prywatny koszyk Storage; demo → pamięć sesji (bez localStorage).
            void attachDocumentFile(f, loadId, cat, { driverToken: token }).then((ok) => {
              setLastFile(ok ? `${cat} · ${f.name} (${f.size} B)` : `Błąd odczytu: ${f.name}`);
              setBusy(false);
            });
          }}
        />
        {lastFile && (
          <div className="driver-attach-note" style={{ borderRadius: 2 }}>
            Załączono · {lastFile}
          </div>
        )}
        {vaultDocs.length > 0 && (
          <div className="panel" style={{ margin: 0 }}>
            <header className="panel-hd">
              <h2 style={{ fontSize: 16 }}>Dokumenty · {load?.code}</h2>
              <span className="sub">vault kierowcy — podgląd / pobierz</span>
            </header>
            <div className="panel-bd">
              {vaultDocs.map((d) => (
                <DocFileRow key={d.id} doc={d} onPreview={setPreviewDoc} />
              ))}
            </div>
          </div>
        )}
        <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      </main>
      <footer className="driver-pwa-ft">
        <Link to="/" className="driver-back-link">
          ← Wróć do wieży
        </Link>
      </footer>
    </div>
  );
}
