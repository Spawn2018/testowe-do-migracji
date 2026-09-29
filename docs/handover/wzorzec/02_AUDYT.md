# AUDYT GŁĘBOKI — OD POCZĄTKU PROJEKTU

> Źródła: 84 wypowiedzi właściciela z trzech zapisów (22–28.09), bieżąca sesja,
> dokumenty w katalogu projektu, **zapytania do produkcji 29.09, 07:08 UTC**.

## A. Oś czasu

| Data | Co się stało |
|---|---|
| 22.09 | Start. Makieta HTML z 50 transportami; decyzja: **wygląd identyczny w 100%** |
| 23.09 | Grok — etap 0: repozytorium, punkt odniesienia wyglądu, etapy A–D |
| 24.09 | **Pieniądze:** EUR wszędzie, kurs NBP A, faktury tygodniowe, widoczność faktur, terminy 30/35 dni. **Statusy z GPS:** strefy portów, prom z rozkładu |
| 25.09 | Źródła danych: AIS Digitraffic, komunikaty armatora, ruch drogowy |
| 26.09 | Etapy 4–6. **Wszystko za darmo — nigdy Pro.** Resend, sesja użytkownika rok / kierowca 14 dni, Cloudflare R2, kopie zapasowe |
| 27.09 | Domena `tower.log-mar.pl`. **Audyt zakresu.** Wyciek pliku harmonogramu — zamknięty. Decyzje: SMS z telefonu, SharePoint później, KSeF poza systemem. **Plan ciągły** |
| 28.09 | D-8/9/10, obsada jednoosobowa, odpoczynek na promie, plan 5 dni, daty podaje KSH. Etap I (I-0…I-28) zamknięty. Naprawiony wyciek danych kierowcy w eksporcie |
| 29.09 | 2FA, pogoda, reguły automatyzacji, **cenniki i załącznik SEFS**, nowy harmonogram, SharePoint w obie strony, **własny silnik ETA z kalibracją uczącą się**, przygotowanie przekazania do Cursora |

## B. Stan produkcji — sprawdzony 29.09, 07:08 UTC

| | |
|---|---|
| Migracje | **97**, ostatnia `0097 insurance_expiry` |
| Tabele | 58 — reguły wierszy na wszystkich poza `spatial_ref_sys` (chroniona wyzwalaczem) |
| Reguły dostępu | 72 |
| Zadania automatyczne | 25 |
| Transporty | **0** — pilotaż nie ruszył |
| Konta aktywne | 3: HHL_ADMIN (właściciel) + **2 × HHL_OPS `@hhlogistics.pl`** — zaproszone 28.09 o 15:16 z konta administratora, zalogowane 29.09 rano |
| Rozmiar bazy | 29,4 MB z 500 MB |
| Kopie zapasowe | 27.09 i 28.09 OK · **29.09 — zawieszona** |

## C. Ustalenia

### P0 — natychmiast
1. **Dzisiejsza kopia zapasowa wisi od 6 h 38 min.** Start 00:30, odczytała
   tabele (8 062 B), `finished_at` puste, status „w toku". Harmonogram zadań
   zgłasza sukces, bo sukcesem jest samo wywołanie. **Nikt nie został
   powiadomiony.** Potrzebne: wyjaśnienie przyczyny, ponowienie kopii,
   **strażnik: kopia w toku dłużej niż 30 min = błąd + e-mail**
2. **Hasło bazy** — fragment trafił do wyniku polecenia wykonawcy 28.09.
   **Decyzja właściciela 29.09: bez zmiany, ryzyko przyjęte.** Zamiast tego:
   unieważnienie tokenów Groka po przekazaniu

### P1 — przed pilotażem
3. **SPRZECZNOŚĆ — tydzień dopłaty paliwowej.** 24.09 właściciel: „patrzymy na
   datę realizacji usługi" (= rozładunek). Załącznik SEFS z 28.09: mnożnik dla
   zleceń z **datą załadunku** w danym tygodniu. Zlecenie I-31 przyjęło datę
   załadunku (umowa). Dla transportu ładowanego w piątek, a rozładowanego
   w środę — dwa różne mnożniki. **Decyzja D-34 do potwierdzenia**
4. **Paczki decyzji nie docierały do wykonawcy.** D-27 i pogoda czekały dwie
   rundy, bo bloki nie zostały wklejone, a nikt tego nie wykrył. Naprawa:
   potwierdzenie odbioru listą identyfikatorów (konstytucja IX.6)
5. **Paczka z 29.09 (cennik, SEFS, SharePoint, ETA) nadal niewysłana**
6. **Dwa konta HHL_OPS przyjęły zaproszenia 29.09 rano** (zaproszenia z konta administratora, 28.09 15:16–15:17, trzy sztuki — trzecie nieprzyjęte). Do potwierdzenia przez właściciela, że wysłał je sam. *Korekta: pierwsza wersja audytu błędnie podawała, że konta nigdy się nie logowały — złe połączenie tabel*
7. **I-18 „Potwierdź daty" w TOWER** kłóci się z nowym założeniem, że KSH
   prowadzi daty w SharePoint — do przeglądu w II-10
8. **Harmonogram: 95 transportów HH, zapowiedziane 140** — 45 jeszcze nie ma w pliku
9. **Pilotaż blokują:** lista użytkowników (D-16), zgoda IT KSH (D-32),
   spotkanie z przewoźnikiem (pytania 5b–5d, 9–9b, 11–11b, PL-B, konwój > 3)

### P2
10. **Stare dokumenty obok aktualnych** — 30+ plików z wcześniejszych etapów,
    część sprzeczna z obecnymi decyzjami. Ryzyko, że Cursor przeczyta
    nieaktualny. Rozwiązanie: `11_INWENTARZ_PLIKOW.md`
11. Klucze i rejestracje: Trafikverket, KPD GDDKiA, e-mail do armatora — stan nieznany
12. Pytanie do księgowej o kurs NBP (D-14) — otwarte
13. **Błąd koordynatora w datach:** część plików z 29.09 ma w nazwie „30.09"
    (m.in. `PACZKA_DECYZJI_30_09.md`). Bez wpływu na treść; nazw nie zmieniam,
    żeby nie zepsuć odwołań

## D. Decyzje zmienione w czasie

| Sprawa | Było | Jest |
|---|---|---|
| Serwis tras | TomTom → HERE (29.09) | **własny silnik na korytarzu OSM** (29.09) |
| Kalibracja ETA | III-1: propozycja do zatwierdzenia | **II-7b: automatyczna, ucząca się, z zabezpieczeniami** |
| Dane kierowcy dla KSH | telefon, ±24 h, bez nazwiska; kasowanie po 90 dniach | **pełne dane na stałe; do wycofania zgody** |
| Plik KSH w SharePoint | „nie wolno zmieniać" (27.09) | **zapis zwrotny do uzgodnionych kolumn** (29.09) |
| Import harmonogramu | u KSH (SCOPE 16.3) → tylko HHL (I-1) | **automatyczna synchronizacja z SharePoint** (II-10) |
| Transporty „Standard" | klasa STANDARD, osobna stawka (D-8) | **cudze (NTG), nie importujemy** |
| Cennik | przedziały wymiarów (I-19) | **symbol + wariant + konwój** (I-30) |
| Pogoda | Open-Meteo (propozycja z Gemini) | **FMI/DMI/SMHI** — Open-Meteo darmowe tylko niekomercyjnie |
| Opóźnienie | od północy (0070, błąd) | **od końca okna, bez okna od końca dnia** (I-25) |

## E. Co zadziałało
- **Plan ciągły** — wykonawca zamknął etap I (29 pozycji) w dwa dni
- **Niezależna weryfikacja produkcji** wyłapała: błąd reguły opóźnienia (I-25),
  SMS bez rodzajów 8 i 9, dziurę w tabeli zezwoleń, uprawnienia anonima na
  22 tabelach, wyciek danych kierowcy w eksporcie, dzisiejszą zawieszoną kopię
- **Sprawdzanie regulaminów przed podpięciem** — zatrzymało Open-Meteo i HERE
- **Weryfikacja danych liczbowo** — cennik: 12 pozycji, narzut identyczny na każdej pozycji,
  tabele SEFS spójne; źródła cen dopasowane co do grosza do historii

## F. Co nie zadziałało — i zasada, która to naprawia
| Problem | Zasada |
|---|---|
| Skrócona reguła → wykonawca zepsuł działający kod (I-25) | pełny warunek + przykład liczbowy |
| Paczki nie docierały | potwierdzenie odbioru listą ID |
| Rozmowy z innymi modelami podawały nieprawdziwe warunki usług | każde twierdzenie o licencji i cenie sprawdzone u źródła |
| Limity użycia przerywały pracę w połowie | przekazanie na 10% limitu, nie na 0% |
| Wykonawca pytał o decyzje już podjęte | jeden rejestr decyzji (`03_REJESTR_DECYZJI.md`) |
| Kopia „udana" według harmonogramu, a faktycznie zawieszona | sukces = zakończony wynik, nie samo uruchomienie |

## G. Otwarte ryzyka
- **Brak dzisiejszej kopii** do czasu naprawy
- Przejęcie przez Cursora — nowy wykonawca, inne narzędzia, ryzyko utraty kontekstu
- Ochrona Cloudflare na stronie armatora może zablokować odczyt komunikatów
- Błędne daty kratownic w pliku KSH → niepewny konwój i cena najdroższego towaru
- Jeden projekt Supabase = test i produkcja w jednym
