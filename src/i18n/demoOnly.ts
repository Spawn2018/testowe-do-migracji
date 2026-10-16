/**
 * I-0 — teksty używane wyłącznie przez dane demo (identyfikatory transportów demo, statyczne banery kokpitu KSH/SCX).
 * W buildzie produkcyjnym (VITE_AUTH_MODE=supabase) moduł jest podmieniany na `demoOnly.prod.ts` (puste słowniki),
 * żeby dane demo nie trafiały do pakietu JS produkcji. Tryb demo i testy — bez zmian.
 */
import type { Locale } from '../types';

type Dict = Record<string, string>;

export const DEMO_ONLY_I18N: { RISK: Record<Locale, Dict>; ETAP4: Record<Locale, Dict> } = {
  RISK: {
    pl: {
      rk_seed_gps_silent_33: 'Cichy GPS — SG-33 bez pingu od 3 h 14 min',
      rk_seed_gps_silent_33_meta: 'Odpowiada: Scandinavian Express · ostatni ping: E4 Umeå',
      rk_seed_permit_mismatch_34: 'Permit mismatch — SG-34 przekracza wysokość i szerokość',
      rk_seed_permit_mismatch_34_meta: 'Odpowiada: Scandinavian Express · zezwolenie nie pasuje do wymiarów',
      rk_seed_sequence_18_35: 'Sekwencja montażu — T-18 przed SG-35',
      rk_seed_sequence_18_35_meta: 'Odpowiada: H&H Logistics · sekwencja montażu: 35 → 18',
      rk_seed_weather_wind_35: 'Okno pogodowe — wiatr boczny 17 m/s dla SG-35',
      rk_seed_weather_wind_35_meta: 'Odpowiada: Scandinavian Express · pogoda: wiatr 17 m/s',
      rk_seed_doc_missing_36: 'Brak zezwolenia SE — SG-36 T-48',
      rk_seed_doc_missing_36_meta: 'Odpowiada: Scandinavian Express · dokument PERMIT_SE missing',
      rk_seed_escort_03: 'Brak eskorty — R-03 niekompletne zasoby',
      rk_seed_escort_03_meta: 'Termin uzupełnienia: 24.09.2026 · wymagany pilot',
      rk_seed_inv: 'Faktura zbiorcza tydzień 38 — rozbieżność 1 840 PLN',
      rk_seed_inv_meta: '2 pozycje rozliczone poza cennikiem',
    },
    en: {
      rk_seed_gps_silent_33: 'Silent GPS — SG-33 no ping for 3 h 14 min',
      rk_seed_gps_silent_33_meta: 'Owner: Scandinavian Express · last ping: E4 Umeå',
      rk_seed_permit_mismatch_34: 'Permit mismatch — SG-34 exceeds height and width',
      rk_seed_permit_mismatch_34_meta: 'Owner: Scandinavian Express · permit does not match dimensions',
      rk_seed_sequence_18_35: 'Assembly sequence — T-18 before SG-35',
      rk_seed_sequence_18_35_meta: 'Owner: H&H Logistics · assembly sequence: 35 → 18',
      rk_seed_weather_wind_35: 'Weather window — crosswind 17 m/s for SG-35',
      rk_seed_weather_wind_35_meta: 'Owner: Scandinavian Express · weather: wind 17 m/s',
      rk_seed_doc_missing_36: 'Missing SE permit — SG-36 T-48',
      rk_seed_doc_missing_36_meta: 'Owner: Scandinavian Express · document PERMIT_SE missing',
      rk_seed_escort_03: 'Missing escort — R-03 incomplete resources',
      rk_seed_escort_03_meta: 'Completion deadline: 24.09.2026 · pilot required',
      rk_seed_inv: 'Collective invoice week 38 — discrepancy 1,840 PLN',
      rk_seed_inv_meta: '2 items billed outside the rate card',
    },
    sv: {
      rk_seed_gps_silent_33: 'Tyst GPS — SG-33 utan ping på 3 h 14 min',
      rk_seed_gps_silent_33_meta: 'Ansvarig: Scandinavian Express · senaste ping: E4 Umeå',
      rk_seed_permit_mismatch_34: 'Tillstånd matchar inte — SG-34 överskrider höjd och bredd',
      rk_seed_permit_mismatch_34_meta: 'Ansvarig: Scandinavian Express · tillståndet matchar inte måtten',
      rk_seed_sequence_18_35: 'Monteringsordning — T-18 före SG-35',
      rk_seed_sequence_18_35_meta: 'Ansvarig: H&H Logistics · monteringsordning: 35 → 18',
      rk_seed_weather_wind_35: 'Väderfönster — sidvind 17 m/s för SG-35',
      rk_seed_weather_wind_35_meta: 'Ansvarig: Scandinavian Express · väder: vind 17 m/s',
      rk_seed_doc_missing_36: 'SE-tillstånd saknas — SG-36 T-48',
      rk_seed_doc_missing_36_meta: 'Ansvarig: Scandinavian Express · dokument PERMIT_SE saknas',
      rk_seed_escort_03: 'Eskort saknas — R-03 ofullständiga resurser',
      rk_seed_escort_03_meta: 'Tidsfrist för komplettering: 24.09.2026 · pilot krävs',
      rk_seed_inv: 'Samlingsfaktura vecka 38 — avvikelse 1 840 PLN',
      rk_seed_inv_meta: '2 poster debiterade utanför prislistan',
    },
  },
  ETAP4: {
    pl: {
      an5_banner_scx_title: '7 pól bez uzupełnienia.',
      an5_banner_scx_body: 'Trzy transporty z załadunkiem w ciągu 48 h nie mają zezwolenia. Lista w zakładce Moje zadania.',
      an5_banner_ksh_title: 'Dostawa 26.09.2026, 11:30.',
      an5_banner_ksh_body: 'Dźwig i ekipa potrzebne przez 3 h. Transport R-03 przekracza okno o 1 h 35 min — nowa propozycja godziny czeka na potwierdzenie.',
    },
    en: {
      an5_banner_scx_title: '7 fields not filled in.',
      an5_banner_scx_body: 'Three loads loading within 48 h have no permit. List in the Tasks tab.',
      an5_banner_ksh_title: 'Delivery 26.09.2026, 11:30.',
      an5_banner_ksh_body: 'Crane and crew needed for 3 h. Load R-03 exceeds the window by 1 h 35 min — a new time proposal awaits confirmation.',
    },
    sv: {
      an5_banner_scx_title: '7 fält inte ifyllda.',
      an5_banner_scx_body: 'Tre transporter med lastning inom 48 h saknar tillstånd. Lista under fliken Uppgifter.',
      an5_banner_ksh_title: 'Leverans 26.09.2026, 11:30.',
      an5_banner_ksh_body: 'Kran och personal behövs i 3 h. Transport R-03 överskrider fönstret med 1 h 35 min — ett nytt tidsförslag väntar på bekräftelse.',
    },
  },
};
