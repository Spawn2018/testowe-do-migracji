/**
 * wyglad/P9-a (E24-1) — zgłoszenie awarii podkładu mapy dla HHL („Zgłoszenie zapisane dla HHL.” w przypisie
 * komunikatu). Wygląd czyta tylko wynik: `true` = zgłoszenie zapisane (zdanie widoczne), `false` = nie zapisane albo
 * zapis jeszcze niepodpięty (zdanie ukryte — bez obietnicy, której nikt nie spełnił).
 *
 * Demo: `true` (przykład z makiety `raport/img/e24-after`). Produkcja: `false`, dopóki Cursor nie podepnie zapisu
 * (dopisek D-20261016-0445-01, pkt 1–4: wpis w błędach aplikacji widoczny dla HHL, jedna sprawa na kartę i epizod).
 */
export type BasemapFailureInfo = {
  /** Którędy szły próby (tileHealth.TileVia). */
  via: 'here-both' | 'here-proxy' | 'fallback';
  /** Liczba nieudanych prób (3). */
  tries: number;
  /** Miejsce mapy: widok Mapa, kokpit albo panel transportu. */
  slot: 'map' | 'kokpit' | 'drawer';
  /** Przyczyna: kafelki bez obrazu albo nie pobrał się plik aplikacji z podkładem (E22). */
  cause: 'tiles' | 'chunk';
};

export async function reportBasemapFailure(info: BasemapFailureInfo): Promise<boolean> {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return info.tries > 0;
  return false;
}
