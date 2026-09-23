import { useParams, Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useTowerStore, DRIVER_TOKENS } from '../store/useTowerStore';
import type { Locale } from '../types';
import { t } from '../i18n/messages';
import type { Document } from '../types';
import { DocPreview } from '../components/ui/DocPreview';
import { DocFileRow } from '../components/ui/DocFileRow';

export function DriverPwa() {
  const { token = 'demo-active' } = useParams();
  const driverMilestone = useTowerStore((s) => s.driverMilestone);
  const driverSharePosition = useTowerStore((s) => s.driverSharePosition);
  const driverAttachDoc = useTowerStore((s) => s.driverAttachDoc);
  const loads = useTowerStore((s) => s.loads);
  const documents = useTowerStore((s) => s.documents);
  const [locale, setLocale] = useState<Locale>('pl');
  const [lastFile, setLastFile] = useState<string | null>(null);
  const [cat, setCat] = useState<'CMR' | 'POD'>('CMR');
  const [busy, setBusy] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const loadId = DRIVER_TOKENS[token];
  const load = loadId ? loads.find((l) => l.id === loadId) : undefined;
  const vaultDocs = loadId
    ? documents.filter((d) => d.loadId === loadId && (d.category === 'CMR' || d.category === 'POD') && d.status === 'UPLOADED')
    : [];

  return (
    <div className="min-h-full bg-[var(--wt-bg)] text-[var(--wt-ink)] flex flex-col max-w-md mx-auto">
      <header className="p-3 border-b border-[var(--wt-border)] bg-[var(--wt-surface)]">
        <div className="font-cond" style={{ fontSize: 20, fontWeight: 700 }}>
          WATCH TOWER · Kierowca
        </div>
        <div className="text-[12px] text-[var(--wt-ink-faint)]">
          {load?.code ?? loadId} · token {token}
        </div>
        <div className="flex gap-1 mt-2">
          {(['pl', 'en', 'sv'] as Locale[]).map((l) => (
            <button key={l} type="button" className="btn" aria-pressed={locale === l} onClick={() => setLocale(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <main className="p-3 flex flex-col gap-3 flex-1">
        {!loadId && (
          <div className="p-3 bg-[var(--wt-crit-bg)] text-[var(--wt-crit)] text-[13px]">
            Nieznany token kierowcy — użyj #/driver/demo-active lub demo-sg14
          </div>
        )}
        <button
          type="button"
          className="btn btn w-full"
          style={{ height: 48, fontSize: 15 }}
          onClick={() => driverSharePosition(token)}
        >
          {t(locale, 'share_pos')}
        </button>
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
            className="btn w-full"
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
        <div className="flex gap-1">
          {(['CMR', 'POD'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className="btn flex-1"
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn w-full"
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
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f || !loadId) return;
            setBusy(true);
            const reader = new FileReader();
            reader.onerror = () => {
              setBusy(false);
              setLastFile(`Błąd odczytu: ${f.name}`);
            };
            reader.onload = () => {
              const dataUrl = typeof reader.result === 'string' ? reader.result : '';
              if (!dataUrl) {
                setBusy(false);
                setLastFile(`Pusty odczyt: ${f.name}`);
                return;
              }
              driverAttachDoc(token, {
                filename: f.name,
                bytes: f.size,
                dataUrl,
                mimeType: f.type || 'application/octet-stream',
                category: cat,
              });
              setLastFile(`${cat} · ${f.name} (${f.size} B)`);
              setBusy(false);
            };
            reader.readAsDataURL(f);
          }}
        />
        {lastFile && (
          <div className="p-3 bg-[var(--wt-surface-2)] text-[13px]" style={{ borderRadius: 3 }}>
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
      <footer className="p-3 text-[12px] text-[var(--wt-ink-faint)]">
        <Link to="/" className="underline">
          ← Wróć do wieży
        </Link>
      </footer>
    </div>
  );
}
