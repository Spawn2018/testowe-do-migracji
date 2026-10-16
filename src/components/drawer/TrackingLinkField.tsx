/**
 * wyglad/P4-c — pole „Link śledzenia” w oknie awizacji (E44 pkt 1, 5, 6, 8; E32 pkt 6 „link jak dziś”).
 * Zapisany link RIO: „RIO · <rejestracja> · ••••” zamiast adresu (klucz `secret` nie trafia do widoku), „Otwórz w RIO”,
 * „Zmień link”; pod spodem wynik zapytania testowego, gdzie jest lokalizator i ostrzeżenia (wygasa przed dostawą,
 * zacznie nadawać później, użyty przy innym transporcie, pojazd spoza awizacji).
 * Wklejony nowy link RIO z kluczem znika z pola od razu po wklejeniu (albo po wyjściu z pola) — „RIO · nowy link · ••••”.
 * Pole jest niekontrolowane: wartość z kluczem żyje tylko w stanie okna awizacji, nie w atrybucie `value` w drzewie strony.
 * „Zmień link” bez wklejenia nowego zostawia obecny (E44: „SCX zawsze musi dodać link”).
 * Wartość i zapis należą do okna awizacji (bez zmian); dane o linku z serwera — `load.trackingLink` (wykonawca).
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { Load, Locale, TrackingLinkInfo } from '../../types';
import { t, tp } from '../../i18n/messages';
import { trackerKind } from '../../lib/trackerLink';
import { trackingLinkNotes } from '../../lib/p4c';
import { isoMs } from '../../lib/statusAxis';

/** pełny link RIO z kluczem (do ukrycia) */
const rioWithKey = (v: string) => trackerKind(v) === 'rio' && /[?&]secret=[^&\s]+/i.test(v);

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
}) {
  const id = useId();
  const saved = savedRef ?? '';
  const savedIsRio = info?.provider === 'RIO' || trackerKind(saved) === 'rio';
  const [editing, setEditing] = useState(false);
  /* to, co jest w polu (dla podpowiedzi); przy zapisanym RIO pole startuje puste */
  const [typed, setTyped] = useState(() => (savedIsRio ? '' : value));
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

  const chip = savedIsRio && !editing;
  const view = chip && info ? trackingLinkNotes(info, load, nowIso, locale) : null;
  const asset = (info?.asset ?? '').trim();
  const expired = !!info?.validTo && isoMs(info.validTo) <= isoMs(nowIso);
  const canOpen = !!onOpenRio && info?.check?.state !== 'invalid' && !expired;

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

  const kind = trackerKind(typed);
  const hint = kind === 'rio'
    ? t(locale, 'p4c_tl_typed_rio')
    : kind === 'emtrack'
      ? t(locale, 'p4c_tl_typed_emtrack')
      : kind === 'other'
        ? t(locale, 'p4c_tl_typed_other')
        : t(locale, 'p4c_tl_empty');

  return (
    <div className="form-field tlf" data-awiz-tracking data-tl-mode={chip ? 'saved' : masked ? 'new-rio' : editing ? 'change' : 'input'}>
      <span id={id} className={upper ? 'tlf-lbl up' : 'tlf-lbl'}>{upper ? t(locale, 'awiz_tracking').toLocaleUpperCase('pl') : t(locale, 'awiz_tracking')}</span>
      {chip ? (
        <div className="tlf-saved">
          <span className="tlf-chip" aria-describedby={id} data-tl-chip>
            {asset ? tp(locale, 'p4c_tl_rio_chip', { asset }) : t(locale, 'p4c_tl_rio_chip_noasset')}
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
      ) : (
        <>
          <input
            key={editing ? 'change' : 'input'}
            ref={inputRef}
            aria-labelledby={id}
            className="input"
            defaultValue={editing || savedIsRio ? '' : value}
            onPaste={() => {
              pasted.current = true;
            }}
            onChange={(e) => {
              const v = e.target.value;
              setTyped(v);
              push(v);
              if (pasted.current && rioWithKey(v)) setMasked(true);
              pasted.current = false;
            }}
            onBlur={(e) => {
              if (rioWithKey(e.target.value)) setMasked(true);
            }}
            placeholder={t(locale, 'awiz_tracking_ph')}
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
          />
          <small className="awiz-track-hint" data-awiz-tracking-kind={kind}>{hint}</small>
        </>
      )}
      {editing && !chip ? (
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
