/**
 * wyglad/P4-c — pole „Link śledzenia” w oknie awizacji (E44 pkt 1, 5, 6, 8; E32 pkt 6 „link jak dziś”).
 * Zapisany link RIO: „RIO · <rejestracja> · ••••” zamiast adresu (klucz `secret` nie trafia do widoku), „Otwórz w RIO”,
 * „Zmień link”; pod spodem wynik zapytania testowego, gdzie jest lokalizator i ostrzeżenia (wygasa przed dostawą,
 * zacznie nadawać później, użyty przy innym transporcie, pojazd spoza awizacji).
 * Wartość pola i zapis należą do okna awizacji (bez zmian); dane o linku z serwera — `load.trackingLink` (wykonawca).
 */
import { useId, useState } from 'react';
import type { Load, Locale, TrackingLinkInfo } from '../../types';
import { t, tp } from '../../i18n/messages';
import { trackerKind } from '../../lib/trackerLink';
import { trackingLinkNotes } from '../../lib/p4c';

export function TrackingLinkField({
  value,
  onChange,
  savedRef,
  info,
  load,
  locale,
  nowIso,
  onOpenRio,
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
}) {
  const id = useId();
  const saved = savedRef ?? '';
  const savedIsRio = info?.provider === 'RIO' || trackerKind(saved) === 'rio';
  const [editing, setEditing] = useState(false);
  const chip = savedIsRio && !editing && value === saved;
  const kind = trackerKind(value);
  const view = chip && info ? trackingLinkNotes(info, load, nowIso, locale) : null;
  const asset = (info?.asset ?? '').trim();

  const hint = kind === 'rio'
    ? t(locale, 'p4c_tl_typed_rio')
    : kind === 'emtrack'
      ? t(locale, 'p4c_tl_typed_emtrack')
      : kind === 'other'
        ? t(locale, 'p4c_tl_typed_other')
        : t(locale, 'p4c_tl_empty');

  return (
    <div className="form-field tlf" data-awiz-tracking data-tl-mode={chip ? 'saved' : editing ? 'change' : 'input'}>
      <span id={id}>{t(locale, 'awiz_tracking')}</span>
      {chip ? (
        <div className="tlf-saved">
          <span className="tlf-chip" aria-describedby={id} data-tl-chip>
            {asset ? tp(locale, 'p4c_tl_rio_chip', { asset }) : t(locale, 'p4c_tl_rio_chip_noasset')}
          </span>
          <span className="tlf-acts">
            {onOpenRio ? (
              <button type="button" className="btn ghost tlf-btn" data-tl-open onClick={onOpenRio}>
                {t(locale, 'p4c_tl_open')} ↗
              </button>
            ) : null}
            <button
              type="button"
              className="btn ghost tlf-btn"
              data-tl-change
              onClick={() => {
                setEditing(true);
                onChange('');
              }}
            >
              {t(locale, 'p4c_tl_change')}
            </button>
          </span>
        </div>
      ) : (
        <>
          <input
            aria-labelledby={id}
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t(locale, 'awiz_tracking_ph')}
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
          />
          <small className="awiz-track-hint" data-awiz-tracking-kind={kind}>{hint}</small>
          {editing ? (
            <div className="tlf-change">
              <small>{t(locale, 'p4c_tl_change_hint')}</small>
              <button
                type="button"
                className="tlf-keep"
                data-tl-keep
                onClick={() => {
                  setEditing(false);
                  onChange(saved);
                }}
              >
                {t(locale, 'p4c_tl_change_cancel')}
              </button>
            </div>
          ) : null}
        </>
      )}
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
