/**
 * wyglad/P10a-a — E22 pkt 3 (makieta `E22/przel.html` „Po zmianie”): pasek pod paskiem górnym „Jest nowa wersja
 * Watch Tower. Odśwież, kiedy skończysz to, co robisz. Nic się nie zgubi.” + „Odśwież teraz”. Wpisany tekst i otwarte
 * okna zostają do kliknięcia. Kiedy pasek się pokazuje — `p10aSource` (produkcja: wykonawca, `version.json`).
 */
import { a10 } from '../../i18n/p10a';
import { useNewVersion } from '../../lib/p10aSource';

export function NewVersionBar() {
  const on = useNewVersion();
  if (!on) return null;
  return (
    <div className="subbar subbar-update" data-banner="new-version" role="status">
      <p className="subbar-tx"><b>{a10('a10_new_h')}</b><span className="subbar-body">{a10('a10_new_tx')}</span></p>
      <button type="button" className="subbar-btn" data-new-version-reload onClick={() => window.location.reload()}>{a10('a10_new_btn')}</button>
    </div>
  );
}
