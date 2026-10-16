# wyglad/E49 — „Objazd czy postój?”, wiatr w ETA, progi wiatru (16.10.2026, 03:05)

Podstawa:
- etap E49 i odpowiedzi właściciela z 16.10.2026, 02:08 (pkt 1–5; pkt 3: „komunikat w Ryzykach dla SCX … ile więcej km i ile więcej czasu … z jakimi innymi ryzykami”);
- dopisek D-20261016-0230-01 Z1–Z4;
- dane do podłączenia: D-20261016-0305-01.

Wygląd i teksty (F8). Bez migracji, uprawnień i zapisów na serwer. Produkcja do podłączenia: brak spraw, przyciski zablokowane, linie ETA z `eta_basis.causes.weather`.

| Element | Było | Jest |
|---|---|---|
| Zamknięty most albo droga na dalszej trasie | — | Karta sprawy SCX w „Do zrobienia” (Ryzyka): „Högakustenbron (E4) zamknięty do 21:32 — objazd czy postój?”, pod tytułem powód, źródło, godzina komunikatu i termin decyzji. Pilna, gdy do decyzji ≤ 60 min. |
| Dwie możliwości | — | Obok siebie (telefon: jedna pod drugą). **Postój:** do kiedy (koniec zamknięcia + 30 min), +0 km, + czas, ETA. **Objazd:** którędy, + km, + czas, ETA. Szybsza oznaczona „szybciej o 3 h 19 min”. |
| Ryzyka każdej możliwości | — | Zdaniami. Najpierw „!” (do wzięcia pod uwagę), potem „✓” (sprawdzone, bez przeszkód). Rodzaje: zezwolenie „Trasa”, ograniczenia dla zestawu (HERE), zakazy czasowe, roboty, wiatr na objeździe, czas pracy kierowcy, prom, okno dostawy KSH, pilot. Czytnik ekranu: „uwaga:” / „sprawdzone:”. |
| Decyzja | — | SCX: „Stoimy” / „Jedziemy objazdem” + „Uwagi (dobrowolnie)”. Po decyzji: wpis w Historii („SCX: objazd przez …, +31 km, +35 min — … zamknięty”), komunikat „Zapisano: objazd. HHL dostanie powiadomienie, ETA liczy objazd.”, sprawa znika. HHL widzi tę samą kartę bez przycisków: „Decyduje SCX — czeka na decyzję.” KSH — bez sprawy (E7). |
| Brak objazdu dla zestawu | — | „Brak objazdu dla tego zestawu” + powód z HERE; zostaje tylko „Stoimy”. |
| Szczegóły ETA (panel transportu) | bez wiatru | Linie: „Postój: Högakustenbron (E4) zamknięty, do 22:02 · decyzja SCX”, „Wiatr +14 min · porywy 22 m/s z boku · E4 Skellefteå–Piteå, 22:32 · prognoza SMHI”, „Śliskość +9 min · E4 Hudiksvall (do 25 km) · Trafikverket”, po decyzji „Objazd +35 min …”. Podpis „Źródło: SMHI (CC BY 4.0), dane przetworzone”. Największy wpływ pierwszy. |
| Opcje › Progi | bez wiatru | 8 wartości ze zdaniem o skutku: wiatr — wolniej od 20 m/s; z boku +15 %; z przodu +5 %; postój od 25 m/s; ruszenie poniżej 20 m/s; czas na ruszenie 30 min; śliskość — zasięg 25 km i +15 %. Bez „15 m/s” (D-84 = 20 m/s). |
| Pierwsze wczytanie | 396,3 kB gzip | 397,2 kB gzip (budżet 400). Sprawa „Objazd czy postój?” i dane demo ładują się osobno (Ryzyka); w pierwszym wczytaniu są tylko linie ETA (`e49Wx.ts`, `i18n/e49Wx.ts`). |

Sprawdzone (podgląd demo, „teraz” 23.09.2026, 14:32; T-17; HHL, SCX; 1440, 768, 390, 360 px; jasny i ciemny):
- e2e `e8-phone-gate` blok „wyglad/E49” — 3/3:
  - SCX: decyzja „Jedziemy objazdem” → ETA z objazdem;
  - HHL: bez przycisków, Progi;
  - telefon: przyciski ≥ 44 px, pole 16 px, 0 w bramie E8;
- regresja P6, P6-b, P4-b — 13/13;
- unit — 147 plików, 1171 testów; `tests/e49-detour.test.ts` — 10 (szybsza możliwość, kolejność ryzyk, pilność, liczby po polsku, odczyt `causes.weather`, produkcja bez danych demo, teksty bez „sms:”, „mailto:”, „supabase” i „15 m/s”);
- przewijanie w poziomie: 0.

Zrzuty:
- `objazd-SCX-1440.webp`
- `objazd-HHL-1440.webp`
- `objazd-SCX-390.webp`
- `objazd-SCX-1440-ciemny.webp`
- `eta-wiatr-T-17-1440.webp`
- `progi-wiatr-1440.webp`

Osoby, miejsca i liczby w demo są przykładowe (G-09).
