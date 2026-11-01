/**
 * BN9-c1 / decyzja 63b — Harmonogram › Rejsy › „Wczytaj rozkład Vikinga” (tylko Administrator HHL, jak „Dodaj rejs”).
 * Strona Viking Line Cargo blokuje odczyt z serwera (403), więc właściciel raz w miesiącu zapisuje ją w Chrome i wczytuje tutaj.
 * Przepływ: plik .html (≤ 3 MB) → Podgląd (`commit: false`) → Zatwierdź z potwierdzeniem na stronie (`commit: true`) → wynik.
 * Pod spodem historia importów (`viking_schedule_imports`). Kontrakt: PR #690 (`src/lib/vikingImport.ts`).
 * Demo i Podgląd innego widoku: zapis nieaktywny z wyjaśnieniem (baza i tak odmawia — `assert_not_preview`).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '../../types';
import { DemoMark } from '../ui/DemoMark';
import {
  departureCells,
  historyView,
  planReasonPl,
  rangePl,
  routePl,
  todayYmd,
  VIKING_HISTORY_LIMIT,
  VIKING_IMPORT_DAYS,
  VIKING_IMPORT_DEFAULT_DAYS,
  vikingBodyTooLarge,
  vikingFileError,
  vikingImportErrorPl,
  warningPl,
  type PlanSection,
  type VikingImportApi,
  type VikingImportCommit,
  type VikingImportHistoryRow,
  type VikingImportPreview,
  type VikingImportRequest,
  type VikingPlanRow,
} from '../../lib/vikingImport';

/** Ile rejsów pokazać w sekcji podglądu, zanim pojawi się „i jeszcze N”. */
export const VIKING_ROWS_SHOWN = 20;

const SECTIONS: { key: PlanSection; title: string; tone: string }[] = [
  { key: 'to_insert', title: 'Do dodania', tone: 'p-sea' },
  { key: 'to_take_over', title: 'Do przejęcia z danych portu', tone: 'p-plan' },
  { key: 'to_remove', title: 'Do usunięcia', tone: 'p-amber' },
  { key: 'blocked', title: 'Zablokowane (odwołane albo w rejsie)', tone: 'p-plan' },
  { key: 'risks', title: 'Ryzyka do sprawdzenia', tone: 'p-red' },
];

type Phase = 'idle' | 'reading' | 'previewing' | 'preview' | 'confirm' | 'committing' | 'done';

interface Props {
  /** `null` — moduł serwera jeszcze się ładuje. */
  api: VikingImportApi | null;
  /** demo — bez bazy: podgląd przykładowy, zapis wyłączony */
  demo: boolean;
  /** Podgląd innego widoku (tylko odczyt) */
  readOnly: boolean;
  nowIso: string;
  locale: Locale;
  phone: boolean;
  onClose: () => void;
}

async function readText(f: File): Promise<string> {
  if (typeof f.text === 'function') return f.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(f);
  });
}

function PlanList({ section, rows, locale, phone }: { section: PlanSection; rows: VikingPlanRow[]; locale: Locale; phone: boolean }) {
  const shown = rows.slice(0, VIKING_ROWS_SHOWN);
  const more = rows.length - shown.length;
  if (phone) {
    return (
      <ul className="vi-cards">
        {shown.map((r, i) => {
          const t = departureCells(r, locale);
          return (
            <li key={`${r.route}-${r.departureUtc}-${i}`} className="vi-card" data-vi-row={section}>
              <b>{t.local}</b>
              {t.pl ? <span className="vi-muted">{t.pl}</span> : null}
              <span>{routePl(r.route, locale)} · {r.vessel || '—'}</span>
              <span className="vi-muted">{planReasonPl(section, r, locale)}</span>
            </li>
          );
        })}
        {more > 0 ? <li className="vi-more">i jeszcze {more}</li> : null}
      </ul>
    );
  }
  return (
    <div className="tablewrap">
      <table className="vi-tbl">
        <thead>
          <tr><th>Odejście (czas portu)</th><th>Czas PL</th><th>Trasa</th><th>Statek</th><th>Co się stanie</th></tr>
        </thead>
        <tbody>
          {shown.map((r, i) => {
            const t = departureCells(r, locale);
            return (
              <tr key={`${r.route}-${r.departureUtc}-${i}`} data-vi-row={section}>
                <td className="vi-time">{t.local}</td>
                <td className="vi-time">{t.pl ?? '—'}</td>
                <td>{routePl(r.route, locale)}</td>
                <td>{r.vessel || '—'}</td>
                <td className="vi-why">{planReasonPl(section, r, locale)}</td>
              </tr>
            );
          })}
          {more > 0 ? <tr><td colSpan={5} className="vi-more">i jeszcze {more}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function Count({ n, label, k }: { n: number; label: string; k: string }) {
  return (
    <div className="vi-count" data-vi-count={k}>
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}

export function VikingImportPanel({ api, demo, readOnly, nowIso, locale, phone, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [fromYmd, setFromYmd] = useState(() => todayYmd(nowIso));
  const [days, setDays] = useState<number>(VIKING_IMPORT_DEFAULT_DAYS);
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<VikingImportPreview | null>(null);
  const [result, setResult] = useState<VikingImportCommit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<VikingImportHistoryRow[] | null | 'loading'>('loading');

  const loadHistory = useCallback(async () => {
    if (!api) return;
    setHistory(await api.history(VIKING_HISTORY_LIMIT));
  }, [api]);
  useEffect(() => {
    let cancelled = false;
    if (!api) return undefined;
    void api.history(VIKING_HISTORY_LIMIT).then((h) => { if (!cancelled) setHistory(h); });
    return () => { cancelled = true; };
  }, [api]);

  /* podgląd dotyczy jednego pliku i jednego zakresu — zmiana unieważnia podgląd i potwierdzenie */
  const resetPlan = () => {
    setPreview(null);
    setResult(null);
    if (phase !== 'reading') setPhase('idle');
  };

  const commitBlocked = demo
    ? 'W wersji demonstracyjnej zapis jest wyłączony — podgląd pokazuje przykładowy wynik, a nie Twój plik.'
    : readOnly
      ? 'Podgląd innego widoku jest tylko do odczytu. Wróć do własnego widoku HHL, żeby zapisać rozkład.'
      : null;

  const request = (commit: boolean): VikingImportRequest | null => (file && html != null
    ? { html, file_name: file.name, commit, from_ymd: fromYmd || undefined, days }
    : null);

  async function onPick(f: File | null) {
    setError(null);
    setPreview(null);
    setResult(null);
    setHtml(null);
    setFile(f);
    const err = vikingFileError(f);
    if (err) { setError(err); setPhase('idle'); return; }
    setPhase('reading');
    try {
      const text = await readText(f!);
      if (!text.trim()) { setError('Plik jest pusty. Zapisz stronę jeszcze raz.'); setPhase('idle'); return; }
      setHtml(text);
      setPhase('idle');
    } catch {
      setError('Nie udało się odczytać pliku. Wybierz go jeszcze raz.');
      setPhase('idle');
    }
  }

  async function onPreview() {
    const req = request(false);
    if (!req || !api) return;
    if (vikingBodyTooLarge(req)) { setError(vikingImportErrorPl(413)); return; }
    setError(null);
    setResult(null);
    setPhase('previewing');
    const r = await api.run({ ...req, commit: false });
    if (!r.ok) { setError(vikingImportErrorPl(r.status, r.error)); setPreview(null); setPhase('idle'); return; }
    setPreview(r.data);
    setPhase('preview');
  }

  async function onCommit() {
    const req = request(true);
    if (!req || !api || !preview || commitBlocked) return;
    setError(null);
    setPhase('committing');
    const r = await api.run({ ...req, commit: true });
    if (!r.ok) {
      setError(vikingImportErrorPl(r.status, r.error));
      setPhase('preview');
      void loadHistory();
      return;
    }
    setResult(r.data);
    setPreview(null);
    setPhase('done');
    void loadHistory();
  }

  const busy = phase === 'reading' || phase === 'previewing' || phase === 'committing';
  const counts = useMemo(() => (preview ? {
    insert: preview.to_insert.length,
    take: preview.to_take_over.length,
    remove: preview.to_remove.length,
    blocked: preview.blocked.length,
    risks: preview.risks.length,
  } : null), [preview]);

  const steps: ReactNode = (
    <details className="vi-howto" data-vi-howto>
      <summary>Jak zapisać stronę Viking Cargo</summary>
      <ol>
        <li>Otwórz w Chrome stronę rozkładu Viking Line Cargo na trasie Tallinn – Helsinki (tę, którą zwykle sprawdzasz).</li>
        <li>Naciśnij <kbd>Ctrl</kbd> + <kbd>S</kbd> (na Macu <kbd>Cmd</kbd> + <kbd>S</kbd>).</li>
        <li>W polu „Zapisz jako typ” wybierz „Strona internetowa, tylko HTML”.</li>
        <li>Zapisz plik na komputerze i wybierz go poniżej.</li>
      </ol>
      <p>Kiedy: raz w miesiącu oraz zawsze, gdy armator ogłosi nowy sezon albo zmianę rozkładu. Serwer nie może sam pobrać tej strony, bo armator blokuje odczyt automatyczny.</p>
    </details>
  );

  return (
    <section className="sv-form vi" data-viking-import aria-labelledby="vi-h">
      <div className="vi-hd">
        <h4 className="sec" id="vi-h">Wczytaj rozkład Vikinga z pliku</h4>
        {demo ? <DemoMark /> : null}
        <div className="spacer" />
        <button type="button" className="chipbtn" data-vi-close onClick={onClose}>Zamknij</button>
      </div>
      <p className="vi-muted vi-lead">
        Rejsy Viking Line Tallinn A ⇄ Helsinki z zapisanej strony Viking Cargo. Najpierw podgląd zmian, zapis dopiero po zatwierdzeniu.
        Rejsy wpisane ręcznie, odwołane i w rejsie zostają bez zmian.
      </p>
      {steps}

      <div className="vi-pick">
        <label className="vi-field">
          <span>Plik strony (.html, najwięcej 3 MB)</span>
          <input
            type="file"
            accept=".html,.htm,text/html"
            className="input"
            data-vi-file
            disabled={busy}
            onChange={(e) => { void onPick(e.target.files?.[0] ?? null); }}
          />
        </label>
        <label className="vi-field">
          <span>Od dnia</span>
          <input
            type="date"
            className="input"
            value={fromYmd}
            data-vi-from
            disabled={busy}
            onChange={(e) => { setFromYmd(e.target.value); resetPlan(); }}
          />
        </label>
        <label className="vi-field">
          <span>Zakres</span>
          <select className="input" value={days} data-vi-days disabled={busy} onChange={(e) => { setDays(Number(e.target.value)); resetPlan(); }}>
            {VIKING_IMPORT_DAYS.map((d) => <option key={d} value={d}>{d} dni</option>)}
          </select>
        </label>
        <div className="vi-acts">
          <button
            type="button"
            className="btn"
            data-vi-preview
            disabled={busy || !html || !api}
            onClick={() => { void onPreview(); }}
          >
            {phase === 'previewing' ? 'Sprawdzam plik…' : 'Podgląd zmian'}
          </button>
        </div>
      </div>
      {file && html && phase !== 'reading' ? <p className="vi-muted" data-vi-file-ok>Wybrany plik: {file.name}</p> : null}
      {phase === 'reading' ? <p className="vi-muted" role="status">Czytam plik…</p> : null}
      {error ? <div className="note sv-err vi-err" role="alert" data-vi-error>{error}</div> : null}

      {preview && counts ? (
        <div className="vi-preview" data-vi-plan>
          <h4 className="sec">Podgląd: {rangePl(preview.from_at, preview.to_at)} · {preview.sailing_count} rejsów w pliku</h4>
          {demo ? <p className="vi-muted" data-vi-demo-note>Przykładowy wynik (demo) — w wersji demonstracyjnej plik nie jest porównywany z bazą.</p> : null}
          <div className="vi-counts">
            <Count n={counts.insert} label="do dodania" k="to_insert" />
            <Count n={counts.take} label="do przejęcia z danych portu" k="to_take_over" />
            <Count n={counts.remove} label="do usunięcia" k="to_remove" />
            <Count n={counts.blocked} label="zablokowane" k="blocked" />
            <Count n={counts.risks} label="ryzyka" k="risks" />
          </div>
          {preview.warnings.length ? (
            <ul className="vi-warn" data-vi-warnings>
              {preview.warnings.map((w, i) => <li key={i}>{warningPl(w)}</li>)}
            </ul>
          ) : null}
          {SECTIONS.map((s) => (preview[s.key].length ? (
            <div key={s.key} className="vi-sec" data-vi-section={s.key}>
              <h5><span className={`pill ${s.tone}`}>{preview[s.key].length}</span> {s.title}</h5>
              <PlanList section={s.key} rows={preview[s.key]} locale={locale} phone={phone} />
            </div>
          ) : null))}
          {counts.insert + counts.take + counts.remove === 0 ? (
            <p className="vi-muted" data-vi-nothing>Plik nie zmienia rozkładu w bazie.</p>
          ) : null}

          {phase === 'confirm' ? (
            <div className="vi-confirm" role="group" aria-label="Potwierdzenie zapisu" data-vi-confirm>
              <p>
                <b>Zapisać rozkład?</b> Dodamy {counts.insert}, przejmiemy {counts.take} i usuniemy {counts.remove} rejsów
                {counts.risks ? `; ${counts.risks} spraw trafi do Ryzyk` : ''}. Zmianę zapisze historia importów.
              </p>
              <div className="filters vi-confirm-acts">
                <button type="button" className="chipbtn" data-vi-back onClick={() => setPhase('preview')}>Wróć do podglądu</button>
                <button type="button" className="btn" data-vi-commit-yes onClick={() => { void onCommit(); }}>Tak, zapisz rozkład</button>
              </div>
            </div>
          ) : (
            <div className="filters vi-commit-bar">
              {commitBlocked ? <span className="vi-muted" data-vi-commit-why>{commitBlocked}</span> : null}
              <div className="spacer" />
              <button
                type="button"
                className="btn"
                data-vi-commit
                disabled={!!commitBlocked || busy}
                title={commitBlocked ?? undefined}
                onClick={() => setPhase('confirm')}
              >
                {phase === 'committing' ? 'Zapisuję…' : 'Zatwierdź import'}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {result ? (
        <div className="note vi-done" role="status" data-vi-result>
          <b>Rozkład zapisany.</b> Dodano {result.inserted}, przejęto {result.taken_over}, usunięto {result.removed} rejsów
          {result.risks ? `, ${result.risks} spraw w Ryzykach` : ''}
          {result.manual_kept ? `; ${result.manual_kept} rejsów wpisanych ręcznie bez zmian` : ''}. Zakres {rangePl(result.from_at, result.to_at)}.
          {result.warnings.length ? (
            <ul className="vi-warn">{result.warnings.map((w, i) => <li key={i}>{warningPl(w)}</li>)}</ul>
          ) : null}
        </div>
      ) : null}

      <div className="vi-hist" data-vi-history>
        <h4 className="sec">Historia importów</h4>
        {history === 'loading' ? <p className="vi-muted">Wczytuję…</p>
          : history == null ? <p className="vi-muted" data-vi-history-none>Historia będzie dostępna po aktualizacji bazy.</p>
            : history.length === 0 ? <p className="vi-muted" data-vi-history-empty>Jeszcze nie wczytano żadnego pliku.</p>
              : (
                <ul className="vi-hist-list">
                  {history.map(historyView).map((h) => (
                    <li key={h.id} className="vi-hist-row" data-vi-hist={h.status}>
                      <span className="vi-hist-t"><b>{h.when}</b> · {h.file}</span>
                      <span className="vi-muted">
                        {h.range} · {h.count} w pliku · dodane {h.added}, usunięte {h.removed}, przejęte {h.takenOver}, ryzyka {h.risks}
                      </span>
                      <span>
                        <span className={`pill ${h.status === 'OK' ? 'p-sea' : 'p-red'}`}>{h.status === 'OK' ? 'zapisany' : 'przerwany'}</span>
                        {h.threshold === 'NIEPELNY' ? <> <span className="pill p-amber" data-vi-threshold>niepełny plik — bez usuwania</span></> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
      </div>
    </section>
  );
}
