/**
 * wyglad/E49 — nazwy i skutki progów wiatru i śliskości w Opcjach › Progi (D-20261016-0230-01 Z1 pkt 5, Z4).
 * Osobny plik w kawałku Opcji (nie w pierwszym wczytaniu). Interfejs tylko po polsku (E43).
 */
export const E49_THR: Record<string, string> = {
  WIND_SLOW_MS: 'Wiatr — wolniej od',
  WIND_SLOW_MS_fx: 'poryw z prognozy SMHI na odcinku przed autem; od tej wartości odcinek trwa dłużej i jest sprawa „Silny wiatr na trasie”',
  WIND_CROSS_PCT: 'Wiatr z boku — dłużej o',
  WIND_CROSS_PCT_fx: 'czas odcinka z wiatrem z boku (45–135° do kierunku jazdy)',
  WIND_HEAD_PCT: 'Wiatr z przodu — dłużej o',
  WIND_HEAD_PCT_fx: 'czas odcinka z wiatrem z przodu; z tyłu bez zmian',
  WIND_HOLD_MS: 'Wiatr — postój od',
  WIND_HOLD_MS_fx: 'auto stoi przed odcinkiem; sprawa pilna „Postój przez wiatr”',
  WIND_RESUME_MS: 'Wiatr — ruszenie poniżej',
  WIND_RESUME_MS_fx: 'postój kończy się, gdy prognoza na odcinku spadnie poniżej tej wartości',
  WIND_RESUME_MIN: 'Wiatr — czas na ruszenie',
  WIND_RESUME_MIN_fx: 'doliczane do końca postoju',
  SLIP_RADIUS_KM: 'Śliskość — zasięg',
  SLIP_RADIUS_KM_fx: 'odcinki do tej odległości od punktu z komunikatem Trafikverket jadą wolniej',
  SLIP_PCT: 'Śliskość — dłużej o',
  SLIP_PCT_fx: 'czas tych odcinków; reszta trasy bez zmian',
};
