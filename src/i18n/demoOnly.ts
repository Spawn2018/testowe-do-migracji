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
      rk_seed_gps_silent_33: 'Cichy GPS — bez nowej pozycji od 3\u00a0h 14\u00a0min',
      rk_seed_gps_silent_33_meta: 'Odpowiada: Scandinavian Express · ostatnia pozycja: E4 Umeå',
      rk_seed_permit_mismatch_34: 'Zezwolenie niezgodne z zestawem — przekroczona wysokość i szerokość',
      rk_seed_permit_mismatch_34_meta: 'Odpowiada: Scandinavian Express · zezwolenie nie pasuje do wymiarów',
      rk_seed_sequence_18_35: 'Sekwencja montażu — T-18 przed SG-35',
      rk_seed_sequence_18_35_meta: 'Odpowiada: H&H Logistics · sekwencja montażu: 35 → 18',
      rk_seed_weather_wind_35: 'Okno pogodowe — wiatr boczny 17\u00a0m/s',
      rk_seed_weather_wind_35_meta: 'Odpowiada: Scandinavian Express · pogoda: wiatr 17\u00a0m/s',
      rk_seed_doc_missing_36: 'Brak zezwolenia SE',
      rk_seed_doc_missing_36_meta: 'Odpowiada: Scandinavian Express · brak zezwolenia SE',
      rk_seed_escort_03: 'Brak eskorty — niekompletne zasoby',
      rk_seed_escort_03_meta: 'Termin uzupełnienia: 24.09.2026 · wymagany pilot',
      rk_seed_inv: 'Faktura zbiorcza tydzień 38 — rozbieżność 1 840\u00a0PLN',
      rk_seed_inv_meta: '2 pozycje rozliczone poza cennikiem',
    },
    en: {},
    sv: {},
  },
  ETAP4: {
    pl: {
      an5_banner_scx_title: '7 pól bez uzupełnienia.',
      an5_banner_scx_body: 'Trzy transporty z załadunkiem w ciągu 48\u00a0h nie mają zezwolenia. Lista w Ryzykach › Do zrobienia.',
      an5_banner_ksh_title: 'Dostawa 26.09.2026, 11:30.',
      an5_banner_ksh_body: 'Dźwig i ekipa potrzebne przez 3\u00a0h. Transport R-03 przekracza okno o 1\u00a0h 35\u00a0min — nowa propozycja godziny czeka na potwierdzenie.',
    },
    en: {},
    sv: {},
  },
};
