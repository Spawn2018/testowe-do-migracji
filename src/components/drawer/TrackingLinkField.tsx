/**
 * wyglad/P4-c — pole „Link śledzenia” w oknie awizacji (E44 pkt 1, 5, 6, 8; E32 pkt 6 „link jak dziś”).
 * Zapisany link RIO: „RIO · <rejestracja> · ••••” zamiast adresu (klucz `secret` nie trafia do widoku), „Otwórz w RIO”,
 * „Zmień link”; pod spodem wynik zapytania testowego, gdzie jest lokalizator i ostrzeżenia (wygasa przed dostawą,
 * zacznie nadawać później, użyty przy innym transporcie, pojazd spoza awizacji).
 * Wklejony nowy link RIO z kluczem znika z pola od razu po wklejeniu (albo po wyjściu z pola) — „RIO · nowy link · ••••”.
 * Pole jest niekontrolowane: wartość z kluczem żyje tylko w stanie okna awizacji, nie w atrybucie `value` w drzewie strony.
 * „Zmień link” bez wklejenia nowego zostawia obecny (E44: „SCX zawsze musi dodać link”).
 * Wartość i zapis należą do okna awizacji (bez zmian); dane o linku z serwera — `load.trackingLink` (wykonawca).
 * DP-232 (#860): pole wyboru „emtrack” → stały `EMTRACK_APP_URL`, pole tekstowe nieaktywne.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { Load, Locale, TrackingLinkInfo } from '../../types';
import { t, tp } from '../../i18n/messages';
import { pt } from '../../i18n/p7';
import {
  EMTRACK_APP_URL,
  isMonitorujPojazdTrackingRef, isSafefleetTrackingRef, trackerKind,
} from '../../lib/trackerLink';
import { trailerHasManyPlates } from '../../lib/p7Awiz';
import { trackingLinkNotes } from '../../lib/p4c';
import { isoMs } from '../../lib/statusAxis';

/** pełny link RIO z kluczem (do ukrycia) */
const rioWithKey = (v: string) => trackerKind(v) === 'rio' && /[?&]secret=[^&\s]+/i.test(v);
/** #662: pełny link SafeFleet z tokenem (do ukrycia jak RIO) */
const safefleetWithToken = (v: string) =>
  trackerKind(v) === 'safefleet' && /^https:\/\/portal\.safefleet\.pl\//i.test(v.trim());
/** #837: pełny link monitorujpojazd z UUID (do ukrycia jak SafeFleet) */
const monitorujpojazdWithToken = (v: string) =>
  trackerKind(v) === 'monitorujpojazd' && /^https?:\/\/sledz\.monitorujpojazd\.pl\//i.test(v.trim());
const secretLikePaste = (v: string) => rioWithKey(v) || safefleetWithToken(v) || monitorujpojazdWithToken(v);


export function TrackingLinkField({
  value,
  onChange,
  savedRef,
  info,
  load,
  locale,
  nowIso,
  onOpenRio,
  upper = false,
  trailerPlate = '',
}: {
  value: string;
  onChange: (v: string) => void;
  /** link zapisany przy transporcie (dziś `resources.trackingRef`) */
  savedRef: string | null | undefined;
  info: TrackingLinkInfo | null;
  load: Pick<Load, 'plannedLoadDate' | 'plannedDeliverDate' | 'planDates'>;
  locale: Locale;
  nowIso: string;
  /** „Otwórz w RIO” w nowej karcie — adres z kluczem składa serwer (E44 pkt 8) */
  onOpenRio?: () => void;
  /** wyglad/P7-a (E32 „okno Awizacja”): etykieta wersalikami jak pozostałe pola okna */
  upper?: boolean;
  /** DP-232: numer naczepy z formularza — ostrzeżenie przy emtrack bez naczepy / z dwoma numerami */
  trailerPlate?: string;
}) {
  const id = useId();
  const saved = savedRef ?? '';
  const savedIsRio = info?.provider === 'RIO' || trackerKind(saved) === 'rio';
  const savedIsSafefleet = info?.provider === 'SAFEFLEET' || trackerKind(saved) === 'safefleet'
    || isSafefleetTrackingRef(saved);
  const savedIsMonitoruj = info?.provider === 'MONITORUJPOJAZD' || trackerKind(saved) === 'monitorujpojazd'
    || isMonitorujPojazdTrackingRef(saved);
  const savedSecret = savedIsRio || savedIsSafefleet || savedIsMonitoruj;
  const [editing, setEditing] = useState(false);
  /* to, co jest w polu (dla podpowiedzi); przy zapisanym RIO/SafeFleet pole startuje puste */
  const [typed, setTyped] = useState(() => (savedSecret ? '' : value));
  const [masked, setMasked] = useState(false);
  const pasted = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<'input' | 'change' | null>(null);

  useEffect(() => {
    if (focusNext.current === 'input') inputRef.current?.focus();
    if (focusNext.current === 'change') changeRef.current?.focus();
    focusNext.current = null;
  });

  const emtrackOn = trackerKind(value) === 'emtrack';
  const chip = savedSecret && !editing && !emtrackOn;
  const view = chip && info?.provider === 'RIO' ? trackingLinkNotes(info, load, nowIso, locale) : null;
  const asset = (info?.asset ?? '').trim();
  const expired = !!info?.validTo && isoMs(info.validTo) <= isoMs(nowIso);
  const canOpen = !!onOpenRio && savedIsRio && info?.check?.state !== 'invalid' && !expired;

  /* przy zmianie zapisanego linku puste pole = zostaje obecny link */
  const push = (v: string) => onChange(editing && !v.trim() ? saved : v);
  const startChange = () => {
    setEditing(true);
    setTyped('');
    setMasked(false);
    focusNext.current = 'input';
  };
  const keep = () => {
    setEditing(false);
    setTyped('');
    setMasked(false);
    onChange(saved);
    focusNext.current = 'change';
  };
  const repaste = () => {
    setMasked(false);
    setTyped('');
    onChange(editing ? saved : '');
    focusNext.current = 'input';
  };

  const setEmtrack = (on: boolean) => {
    if (on) {
      setEditing(false);
      setMasked(false);
      setTyped(EMTRACK_APP_URL);
      onChange(EMTRACK_APP_URL);
      return;
    }
    setTyped('');
    setMasked(false);
    onChange('');
    focusNext.current = 'input';
  };

  const kind = trackerKind(typed);
  const hint = emtrackOn
    ? t(locale, 'p4c_tl_emtrack_locked')
    : kind === 'rio'
      ? t(locale, 'p4c_tl_typed_rio')
      : kind === 'safefleet'
        ? (isSafefleetTrackingRef(typed) || !typed.trim()
          ? t(locale, 'p4c_tl_typed_safefleet')
          : t(locale, 'p4c_tl_typed_safefleet_bad'))
        : kind === 'monitorujpojazd'
          ? (isMonitorujPojazdTrackingRef(typed) || !typed.trim()
            ? t(locale, 'p4c_tl_typed_monitorujpojazd')
            : t(locale, 'p4c_tl_typed_monitorujpojazd_bad'))
          : kind === 'emtrack'
            ? t(locale, 'p4c_tl_typed_emtrack')
            : kind === 'other'
              ? t(locale, 'p4c_tl_typed_other')
              : t(locale, 'p4c_tl_empty');

  const trailerWarn = emtrackOn
    ? (!trailerPlate.trim()
      ? t(locale, 'p4c_tl_emtrack_need_trailer')
      : trailerHasManyPlates(trailerPlate)
        ? pt(locale, 'p7_m_trailer_many')
        : null)
    : null;

  return (
    <div className="form-field tlf" data-awiz-tracking data-tl-mode={chip ? 'saved' : masked ? 'new-rio' : emtrackOn ? 'emtrack' : editing ? 'change' : 'input'} data-tl-emtrack={emtrackOn ? '1' : '0'}>
      <span id={id} className={upper ? 'tlf-lbl up' : 'tlf-lbl'}>{t(locale, 'awiz_tracking')}</span>
      <label className="am-check tlf-emtrack" data-tl-emtrack-check>
        <input
          type="checkbox"
          checked={emtrackOn}
          onChange={(e) => setEmtrack(e.target.checked)}
          data-tl-emtrack-box
        />
        <span>{t(locale, 'p4c_tl_emtrack_check')}</span>
      </label>
      {chip ? (
        <div className="tlf-saved">
          <span className="tlf-chip" aria-describedby={id} data-tl-chip>
            {savedIsSafefleet
              ? t(locale, 'p4c_tl_safefleet_chip')
              : savedIsMonitoruj
                ? t(locale, 'p4c_tl_monitorujpojazd_chip')
              : asset
                ? tp(locale, 'p4c_tl_rio_chip', { asset })
                : t(locale, 'p4c_tl_rio_chip_noasset')}
          </span>
          <span className="tlf-acts">
            {canOpen ? (
              <button type="button" className="btn ghost tlf-btn" data-tl-open onClick={onOpenRio}>
                {t(locale, 'p4c_tl_open')} ↗
              </button>
            ) : null}
            <button type="button" ref={changeRef} className="btn ghost tlf-btn" data-tl-change onClick={startChange}>
              {t(locale, 'p4c_tl_change')}
            </button>
          </span>
        </div>
      ) : masked ? (
        <>
          <div className="tlf-saved" data-tl-new>
            <span className="tlf-chip" aria-describedby={id}>{t(locale, 'p4c_tl_new_chip')}</span>
            <span className="tlf-acts">
              <button type="button" className="btn ghost tlf-btn" data-tl-repaste onClick={repaste}>
                {t(locale, 'p4c_tl_repaste')}
              </button>
            </span>
          </div>
          <small className="awiz-track-hint" data-awiz-tracking-kind="rio">{t(locale, 'p4c_tl_typed_rio')}</small>
        </>
      ) : emtrackOn ? (
        <>
          <input
            aria-labelledby={id}
            className="input"
            value={EMTRACK_APP_URL}
            disabled
            readOnly
            data-tl-emtrack-url
            autoComplete="off"
            spellCheck={false}
          />
          <small className="awiz-track-hint" data-awiz-tracking-kind="emtrack">{hint}</small>
        </>
      ) : (
        <>
          <input
            key={editing ? 'change' : 'input'}
            ref={inputRef}
            aria-labelledby={id}
            className="input"
            defaultValue={editing || savedSecret ? '' : value}
            onPaste={() => {
              pasted.current = true;
            }}
            onChange={(e) => {
              const v = e.target.value;
              setTyped(v);
              if (trackerKind(v) === 'emtrack') {
                setMasked(false);
                setEditing(false);
                setTyped(EMTRACK_APP_URL);
                onChange(EMTRACK_APP_URL);
                pasted.current = false;
                return;
              }
              push(v);
              if (pasted.current && secretLikePaste(v)) setMasked(true);
              pasted.current = false;
            }}
            onBlur={(e) => {
              if (secretLikePaste(e.target.value)) setMasked(true);
            }}
            placeholder={t(locale, 'awiz_tracking_ph')}
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
          />
          <small className="awiz-track-hint" data-awiz-tracking-kind={kind}>{hint}</small>
        </>
      )}
      {trailerWarn ? (
        <small className="am-warn" role="status" data-tl-emtrack-trailer-warn>{trailerWarn}</small>
      ) : null}
      {editing && !chip && !emtrackOn ? (
        <div className="tlf-change">
          <small>{t(locale, 'p4c_tl_change_hint')}</small>
          <button type="button" className="tlf-keep" data-tl-keep onClick={keep}>
            {t(locale, 'p4c_tl_change_cancel')}
          </button>
        </div>
      ) : null}
      {view && (view.check || view.tracker || view.notes.length) ? (
        <ul className="tlf-notes" data-tl-notes>
          {view.check ? <li className={`tlf-n ${view.check.tone}`} data-tl-check={view.check.key}>{view.check.text}</li> : null}
          {view.tracker ? <li className="tlf-n info" data-tl-tracker>{view.tracker}</li> : null}
          {view.notes.map((n) => (
            <li key={n.key} className={`tlf-n ${n.tone}`} data-tl-note={n.key}>{n.text}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
