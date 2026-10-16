# wyglad/daty-rok — data zawsze z rokiem (DD.MM.RRRR), godzina GG:MM (PR #262)

Podstawa: właściciel 16.10.2026, 13:58 i 14:09, odpowiedź 4 — „Do każdej daty w każdym miejscu w całym systemie musisz dodać rok. Format daty w każdym polu, komórce, wizualizacji: DD.MM.RRRR; gdy jakiekolwiek miejsce używa godziny — GG:MM.” Zmienia E21, znosi D17 („bez roku w bieżącym roku”). Dopisek D-20261016-1410-01 pkt 4, DATY-BRIEF.

Zakres: wszystko, co widzi użytkownik w przeglądarce (ekrany, teksty, dane demo, eksporty z przeglądarki). Tylko wygląd, teksty i obliczenia widoku — bez `supabase/`, bez zmian zapytań. Gałąź scalona z `main` (bf4d9f5, P7-d — `sailView.ts`) przed zmianami.

## Formaty (jedyne na ekranie)

| Rodzaj | Format | Przykład |
|---|---|---|
| data | DD.MM.RRRR | `16.10.2026` |
| godzina | GG:MM, 24 h, dwie cyfry, północ `00:00` | `08:05` |
| data z godziną | data, przecinek, godzina | `16.10.2026, 08:05` |
| zakres dat | półpauza bez spacji | `12.10.2026–18.10.2026` |
| zakres godzin w dniu | | `16.10.2026, 08:00–12:00` |
| tydzień | | `t42 · 12.10.2026–18.10.2026` |
| dzień tygodnia przed datą | skrót z kropką | `czw. 16.10.2026` |

Bez zmian: pola `type="date"` / `datetime-local`, wartości ISO w danych i w `data-*`, nazwy plików eksportu z datą ISO (`Harmonogram_HHL_t40-t41_2026-10-08.xlsx`), czas względny („za 2 h”).

## Było → jest

| Miejsce | Było | Jest |
|---|---|---|
| Harmonogram, układ pliku — Data załadunku / dostawy | `30.09` | `30.09.2026` |
| Harmonogram — ETA Boden | `10.10 14:30` | `10.10.2026, 14:30` (kolumna 100 → 124 px) |
| Harmonogram — Dokumenty | `rysunek, zezwolenie PL do 02.10` (nachodziło na kwotę) | `… do 02.10.2026` (kolumna 170 → 240 px, zawija się między słowami, data w całości) |
| Harmonogram — podpis wersji importu | `wersja 7 z 21.09.2026 14:08` | `wersja 7 z 21.09.2026, 14:08` (PL, EN, SV) |
| Harmonogram — Widok skrócony „Załadunek → dostawa” | `30.09 → 05.10` | `30.09.2026 → 05.10.2026` (łamie się przy strzałce) |
| Harmonogram — karta na telefonie | `śr. 30.09 → pon. 05.10` | `śr. 30.09.2026 → pon. 05.10.2026` |
| Harmonogram — kolumna „Rejs”, filtr rejsu | `Wawel · 08.10 18:00`, `08.10, 18:00` | `Wawel · 08.10.2026, 18:00` |
| Harmonogram › Rejsy — odejście, przypłynięcie | `08.10, 08:00`; rok tylko w innym roku | `08.10.2026, 08:00` zawsze |
| Harmonogram › Rejsy — zasięg rozkładu | `Stena Line do 18.10` | `Stena Line do 18.10.2026` |
| Panel transportu — nagłówek | `czw 01.10 · t40` | `czw. 01.10.2026 · t40` |
| Panel — Plan i ETA | `czw 01.10.2026 · 08:00–16:00` | `czw. 01.10.2026, 08:00–16:00` |
| Panel — „zmienił …”, terminy dokumentów, ETA, „Do zrobienia” | `07.10, 12:00` | `07.10.2026, 12:00` |
| Panel — Ceny (postój, kurs NBP, opłata paliwowa) | `07.10, 08:35`, `z 25.09` | `07.10.2026, 08:35`, `z 25.09.2026` |
| Awizacja — termin, konwój | `Pilne od 07.10, 12:00`, `Konwój czw 08.10` | `Pilne od 07.10.2026, 12:00`, `Konwój czw. 08.10.2026` |
| Link śledzenia RIO, oś statusów, pasek śledzenia, PDF panelu | `ważny do 08.10, 06:00`, `07.10, 12:19` | `08.10.2026, 06:00`, `07.10.2026, 12:19` |
| Mapa — wiersz (ETA, dzień załadunku), następne starty | `09.10, 13:05`, `dzień załadunku 10.10` | `09.10.2026, 13:05`, `dzień załadunku 10.10.2026` |
| Mapa — dopisek w Przeglądzie | `Śledzenie od 08.10, 03:00` | `Śledzenie od 08.10.2026, 03:00` |
| Kokpit — najbliższy prom | komputer `08.10, 18:00`, telefon `08.10 18:00` | komputer `08.10.2026, 18:00`; telefon liczba `18:00`, opis `08.10.2026 · fala 2,9 m · podwyższone` (liczba w jednej linii — E8 pkt 6) |
| Kokpit — terminowość | `plan 06.10, dostawa 06.10` | `plan 06.10.2026, dostawa 06.10.2026` |
| Kokpit, pasek — data (EN, SV) | `16/10/2026`, `2026-10-16` | `16.10.2026` we wszystkich językach |
| Pasek — rejs innego dnia | `Nova Star · 16.10, 17:00` | `Nova Star · 16.10.2026, 17:00`; przycisk na telefonie `Polferries 17:00` z odliczaniem (pełna data w liście po dotknięciu) |
| Postęp dostaw (wykres) | `dziś 23.09` | `dziś 23.09.2026` |
| Ryzyka — „Do zrobienia”, sprawy, zakaz ruchu | `21.09, 14:32`, `w dniu przejazdu 25.09` | `21.09.2026, 14:32`, `25.09.2026` |
| Ryzyka — tytuły spraw demo (PL, EN, SV) | `Rejs 24.09`, `przed 03.10` | `Rejs 24.09.2026`, `przed 03.10.2026` |
| Ryzyka — drogi SE (opis z Trafikverket) | `od 18.08, 06:51 do 31.12, 16:00` | `od 18.08.2026, 06:51 do 31.12.2026, 16:00` |
| Dokumenty — paczka tygodnia | `t39 · 21.09–27.09.2026` | `t39 · 21.09.2026–27.09.2026` |
| Dokumenty — zezwolenia „Ważne”, polisa | `01.10–31.12.2026` | `01.10.2026–31.12.2026` |
| Dokumenty — pliki „Wgrano”, termin | `08.10, 12:00`, `· 08.10` | `08.10.2026, 12:00`, `· 08.10.2026` |
| Finanse — tydzień opłaty paliwowej | `t41 · 05.10–11.10`, `t43–t51 · 19.10–20.12` | `t41 · 05.10.2026–11.10.2026`, `t43–t51 · 19.10.2026–20.12.2026` |
| Finanse — kurs NBP na telefonie | `z 25.09` | `z 25.09.2026` |
| Finanse — paczka dla księgowości | `Wysłano 08.10, 12:00`, `rozładunek 07.10` | `Wysłano 08.10.2026, 12:00`, `07.10.2026` |
| Faktury — tydzień, termin, wystawiona | `44 · 26.10–01.11`, `23.10` | `44 · 26.10.2026–01.11.2026`, `23.10.2026` |
| Faktury — kafelek „czeka na wystawienie” | `05.10–11.10` | `05.10.2026–11.10.2026` |
| Faktury — faktoring | `08.10, 12:00` | `08.10.2026, 12:00` |
| Opcje › Opłata paliwowa | `TEN TYDZIEŃ · 12–18.10`, `śr 14.10`, `publ. 13.10`, `Wczoraj 13.10:` | `12.10.2026–18.10.2026`, `śr. 14.10.2026`, `publ. 13.10.2026`, `Wczoraj 13.10.2026:` |
| Opcje › Dopłaty, Cennik, Terminy — „Ostatnia zmiana” | `07.10, 12:35` | `07.10.2026, 12:35` |
| Opcje › Treści wiadomości — podgląd, wybór transportu | `Plan dostawy: 07.10`, `SG-03 · 07.10` | `07.10.2026` (najdłuższa data przy limicie SMS 160: `00.00.0000`) |
| Opcje — Przełączniki, Użytkownicy, Logowania, Komunikat, Historia zmian (demo) | `05.10, 19:38`, `ważne do 16.10` | `05.10.2026, 19:38`, `ważne do 16.10.2026` |
| Opcje › Stan systemu | `Niedzielna brama 20.09, 22:00`, `Następny przebieg 25.09, 07:00` | `20.09.2026, 22:00`, `25.09.2026, 07:00` |
| Konta i dzienniki (logowania, urządzenia, SMS, BAF, cennik, komunikat, zatwierdzenie dat KSH, komunikaty armatora) | `16.10.2026, 08:05:00` (PL), `16/10/2026, 08:05` (EN) | `16.10.2026, 08:05` |
| Zezwolenia i polisy (formularze) | `01.10.2026 – 31.12.2026` | `01.10.2026–31.12.2026` |
| Historia (wartości z danych) | `07.10.2026 12:00` | `07.10.2026, 12:00` |
| Aplikacja kierowcy | `8:05 AM` (EN) | `08:05` |
| Automatyzacje — sprawdzenie reguły, decyzje | `plac od 07.10, 08:35 → 07.10, 11:35`, `wyłączone 05.10` | `07.10.2026, 08:35 → 07.10.2026, 11:35`, `05.10.2026` |
| Teksty decyzji w Opcjach (PL, EN, SV) | `decyzja właściciela 09.10` | `decyzja właściciela 09.10.2026` |
| XLSX Harmonogramu (przeglądarka) | `2026-10-08`, ETA w ISO | `08.10.2026`, `10.10.2026, 14:30` (czas Boden) |
| PDF Harmonogramu | `08.10.2026, 06:00` (już z rokiem) | bez zmian, przez wspólny formater |
| Komunikaty silnika pieniędzy | `koszt 2026-10-05, przychód 2026-10-12` | `koszt 05.10.2026, przychód 12.10.2026` |

## Formatery (jedno źródło: `src/lib/time.ts`)

- **`time.ts`** — nowe: `fmtDate`, `fmtTime`, `fmtDateTime`, `fmtDateRange`, `fmtDateTimeRange`, `fmtWeek`, `partsInZone` (zegar 24 h, `hourCycle: 'h23'`, północ = `00:00`); zawsze z rokiem: `formatTableDay`, `formatTableInZone`, `formatCompactInZone` / `formatEtaBodenCompact`, `formatSchedTableDay` (`16.10.2026, 08:05`, bez godziny `16.10.2026, –`), `formatInZone` / `formatOpsDateTime` / `formatLoadPl` / `formatUnloadSe` / `formatEtaBoden`; **`refYearInOps` i parametr `refYear` usunięte** (MapView, TasksView, ScheduleView, SchedTables, roadSeTitle).
- **`format.ts`** — `formatListDateTime`, `formatListCompact`.
- **`schedLayout.ts`** — `dmy` (zamiast `ddmm`; chwila ISO → dzień w strefie), `hmIn`; szerokości `eta` 124, `docs` 240.
- **`p7Awiz.ts`** — `dayShort` = `dayLong` (`czw. 08.10.2026`), `dmHm`, `hm`; skróty dni z kropką.
- **`p9cMap.ts`** — `hm`. **`sailings.ts`** — `fmtLocal`. **`sailView.ts`** — `sailTime`, `sailDay` (bez parametru „teraz”, rok zawsze).
- **`p6History.ts`** — `dmy`, `hhmm`, `dayLabel`, wartości dat w Historii. **`ferry.ts`** — `ferryWidgetLabel`. **`pl/describe.ts`** — czas w opisie dróg SE.
- **`statusAxis.ts`** — `dayTime`, `dayOnly`, `timeOnly`. **`voyage.ts`** — `formatVoyageDayLabel`.
- **Tygodnie** — `p5Finance.weekLabel`, `p5Invoices.weekKeyLabel`, `p5Pack.packWeekLabel`.
- Lokalne `dm` / `dmy` / `toLocaleString` w ekranach przepięte na formatery: BillsPanel, Factoring, DocsView, UploadDocModal, PanelDocs, PanelPrices, FeeModal, PanelOverview, StatusChangeModal, HelpPanel, AccountingPack, FuelWeekTable, MoneyScreens, MessageTexts, FactoringOfferScreen, FinanceView, DashboardView, Topbar, LiveMark, DeliveryProgress, RoutePanel, TodoCard, WorkflowsView, DriverPwa, PlanDatesPanel, OperatorNoticeForm, Mfa, MyDevices, LiveAccountScreen, SystemStatusPanel, BroadcastForm, ChangeHistoryPanel, AuthLoginLog, RateCardForm, SmsGateway, BafForm, InsurancePolicyForm, PermitForm, xlsxExport, sysDemo, p6Demo, p8Texts, money/engine, money/loadMoney.

## Sprawdzone (16.10.2026, z `/tmp/claude-0/wt-daty`)

- `npx tsc -p tsconfig.app.json --noEmit` — 0 błędów; `npm run lint:css` — 0 uwag.
- `npx oxlint` na 103 zmienionych plikach TS — 0 błędów, 37 ostrzeżeń, wszystkie sprzed zmiany (te same 37 na wersji przed zmianą: `set-state-in-effect`, `only-export-components`, dwa nieużyte importy w `seed.ts`).
- `npm run test:unit` — 171 plików zielonych, 6 pominiętych; 1390 testów zielonych, 35 pominiętych. Przepisane oczekiwane wartości w 23 plikach testów (22 jednostkowe i `e8-phone-gate.spec.ts`; bez osłabiania), nowy `tests/date-year-guard.test.ts` — 11 testów:
  - (a) 7 grup formaterów: dziś (`16.10.2026, 08:05`), inny rok (`31.12.2025, 13:00`, `09.01.2027, 18:00`), północ (`16.10.2026, 00:00`, nie `24:00`), czas letni (`01.07.2026, 12:00`) i zimowy (`15.01.2026, 11:00`), po zmianie czasu (`25.10.2026, 02:30`), zakresy, tydzień, dzień tygodnia;
  - (b) skan literałów tekstu (bez komentarzy) w `src/i18n/*.ts` (40 plików) i `src/data/seed.ts`, potem w całym `src`: 0 dat bez roku, 0 godzin „8:05”, 0 dat z godziną bez przecinka; 7 jawnych wyjątków z powodem (ścieżki SVG, krok pola `0.01`, przykład CSV BAF, przykład kwoty, szerokość w metrach, numer punktu SCOPE „8.10”) i test, że każdy wyjątek nadal czegoś dotyczy;
  - (c) w kodzie: 0 `Intl.DateTimeFormat` / `toLocale…String` z miesiącem bez roku, 0 `dateStyle`, 0 ręcznego „dd.mm” z fragmentów ISO; sprawdzone, że strażnik czerwienieje po cofnięciu formatera i tekstu.
- `npx vite build` + `node scripts/bundle-size.mjs dist` — pierwsze wczytanie **368,4 kB gzip** (przed zmianą 368,7 kB; budżet 400 kB).
- e2e (Playwright, własny podgląd `127.0.0.1:4190`, Chromium 1194) — 14 plików bez bazy i bez wzorców zrzutów: **170 zielonych**, 2 pominięte, 2 czerwone sprzed zmiany (tak samo czerwone na wersji przed zmianą, podgląd `:4191`): `d19-i18n.spec.ts:183` („lang missing: en”) i `e8-phone-gate.spec.ts:912` (oczekiwane 8 nagłówków „Widoku skróconego”, a od E6-tel jest 9 — „Telefon kierowcy”). Brama E8 telefon (HHL, SCX, KSH; 360, 390, 430 px) — zielona.
- Wzrokowo (własny podgląd, `#/?now=2026-09-23T14:32:00Z`): Kokpit, Harmonogram (układ pliku i Widok skrócony), panel transportu, Ryzyka, Dokumenty, Finanse, Faktury, Mapa, Opcje › Opłata paliwowa — HHL, KSH, SCX, 1440 i 390 px, **68 ujęć, 3286 dat zmierzonych w DOM**: 0 dat łamanych w środku, 0 uciętych, 0 nachodzących na sąsiednią komórkę, 0 przewijania w bok, 0 dat bez roku (jedyne zgłoszenie — „niedziela 24:00”, niżej). Dodatkowo pasek przy 360–1440 px z rejsem innego dnia (`now=2026-10-15T18:00:00Z`): nic poza ekranem; Opcje › Opłata paliwowa przy 1280 px bez przewijania w bok.
- Zrzuty (WebP): `harmonogram-plik-1440`, `harmonogram-plik-eta-dokumenty-1440`, `harmonogram-skrocony-1440`, `panel-transportu-1440`, `ryzyka-1440`, `dokumenty-1440`, `finanse-1440`, `faktury-1440`, `oplata-paliwowa-1440`, `oplata-paliwowa-tabela-1440`, `harmonogram-telefon-390`, `panel-transportu-telefon-390`, `ryzyka-telefon-390`, `kokpit-scx-telefon-390`, `oplata-paliwowa-telefon-390`.
- Wzorce `tests/__screenshots__` nie odświeżone — odświeża koordynator przez CI (`visual.yml update=true`); `visual.spec.ts` i `visual-states.spec.ts` będą do tego czasu czerwone (daty z rokiem na ekranach).

## Poza zakresem (serwer) — dla wykonawcy

Widok tylko wyświetla gotowy tekst z bazy — zostawiony. Miejsca, które po stronie serwera składają datę bez roku albo bez przecinka przed godziną:
- `supabase/functions/_shared/integrations/sync.ts` (`warsaw()`, ok. l. 112) — tekst sprawy statusu rejsu `dd.mm, gg:mm` bez roku;
- `supabase/functions/_shared/integrations/road.ts` — korzysta z `src/lib/pl/describe.ts` (tu już z rokiem): nowe tytuły ROAD_SE będą z rokiem **po wdrożeniu funkcji**; stare wpisy w bazie (także 13 tytułów z nałożonej migracji `0195_e18_p15_poprawka.sql`) zostają bez roku do poprawki danych;
- sprawy promu, parametry `dep` / `arr` w `title_params` (`'DD.MM HH24:MI'`): `0160_ferry_status.sql` (odwołanie, opóźnienie), `0042_risk_title_key.sql` (`FERRY_OVERDUE`) — widok wstawia gotowy parametr do tytułu;
- SMS: `0158_sms_ksh_1h_eta_pre_load.sql` (`'DD.MM HH24:MI'`), `0067_sms_gateway_base.sql` (funkcja czasu SMS), `0167_sms_silent_fix.sql` (`'DD.MM.YYYY HH24:MI'` bez przecinka);
- powiadomienia, e-maile i zestawienia z `'DD.MM.YYYY HH24:MI'` bez przecinka: `0036_watch_send_notifications.sql`, `0035_job_watchdog.sql`, `0130_daily_digest_distinct_errors.sql`, `0143_l3_thresholds.sql`, `0049_null_guard.sql`;
- e-maile z `supabase/functions/_shared/notifyTemplates.ts` (data już z rokiem — sprawdzić godzinę i przecinek), PDF i XLSX z serwera, notatki Historii zapisywane w bazie.

## Zostawione z powodem

- Faktury — opis obiegu „System · niedziela 24:00” (koniec doby, nie godzina zdarzenia).
- Godzina bez daty tam, gdzie mowa o dziś albo data stoi obok: pasek „Wawel · 17:00” (dziś), „Promy dziś” w Ryzykach, „na żywo · 16:32”, przycisk promu na telefonie z odliczaniem.
- Wzorce zrzutów `tests/__screenshots__` nie odświeżone (koordynator przez CI) — `visual*.spec.ts` będą czerwone do odświeżenia.
