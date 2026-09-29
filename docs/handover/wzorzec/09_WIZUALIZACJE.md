# WIZUALIZACJE TOWER

> Diagramy w składni Mermaid — wyświetlają się w GitHub, w Cursorze
> (podgląd Markdown z rozszerzeniem Mermaid) i w pliku `09_WIZUALIZACJE.html`.

## 1. Architektura

```mermaid
flowchart LR
  subgraph Uzytkownicy
    HHL["HHL — admin, operacje"]
    KSH["KSH — klient"]
    SCX["Przewoźnik"]
    DRV["Kierowca — link 14 dni"]
  end
  subgraph Front
    V["Vercel — tower.log-mar.pl"]
    P["Cloudflare Pages — zapas"]
  end
  subgraph Supabase_UE
    AUTH["Logowanie — link e-mail, 2FA admina"]
    DB[("Postgres + RLS, 97 migracji")]
    EDGE["Funkcje Edge"]
    CRON["25 zadań cyklicznych"]
  end
  subgraph Zewnetrzne
    NBP["NBP — kursy"]
    AIS["Digitraffic — AIS promów"]
    ARM["Armator — komunikaty"]
    FUEL["OKQ8 + Orlen — ceny paliwa"]
    MET["FMI / DMI / SMHI — pogoda"]
    TRV["Trafikverket — drogi SE"]
    SP["SharePoint KSH — harmonogram"]
    RES["Resend — e-mail"]
    R2["R2 — kopia szyfrowana"]
    SMS["Telefon Android — bramka SMS"]
  end
  HHL & KSH & SCX & DRV --> V
  V --> AUTH --> DB
  EDGE <--> DB
  CRON --> EDGE
  EDGE --> NBP & AIS & ARM & FUEL & MET & TRV & RES & R2
  SP <--> EDGE
  SMS -- "pobiera co 15 s" --> DB
```

## 2. Kto widzi co

```mermaid
flowchart TB
  M["Marża"] --> H1["tylko HHL"]
  K["Koszt — cennik przewoźnika"] --> H2["HHL + przewoźnik"]
  R["Przychód — cennik HHL"] --> H3["HHL + KSH"]
  D["Dane kierowcy i auta"] --> H4["HHL + przewoźnik + KSH na stałe"]
  F1["Faktura HHL → KSH"] --> H5["HHL + KSH"]
  F2["Faktura przewoźnik → HHL"] --> H6["HHL + przewoźnik"]
  A["Dziennik audytu"] --> H7["tylko HHL_ADMIN"]
```

## 3. Droga transportu i statusy z GPS

```mermaid
stateDiagram-v2
  [*] --> Planowany: import z SharePoint KSH
  Planowany --> Gotowy: kierowca, auto, dokumenty, zezwolenia PL i SE
  Gotowy --> Zaladunek: wjazd w strefę Śrem
  Zaladunek --> W_drodze_PL: wyjazd ze strefy
  W_drodze_PL --> Port_Gdansk: strefa portu
  Port_Gdansk --> Prom: czas odejścia przypisanego rejsu
  Prom --> Port_Nynashamn: strefa portu SE
  Port_Nynashamn --> W_drodze_SE
  W_drodze_SE --> Na_placu: strefa Boden
  Na_placu --> Rozladowany: potwierdzenie kierowcy — data usługi
  Rozladowany --> Zafakturowany: faktura tygodniowa
  Zafakturowany --> [*]
```

## 4. Przepływ pieniędzy

```mermaid
flowchart LR
  C["Cennik — symbol, wariant, konwój"] --> FR["Fracht EUR"]
  S["SEFS — mnożnik tygodnia"] --> FR
  O["Opłaty: czas wolny, przestój, anulowanie"] --> SUM["Kwota transportu EUR"]
  FR --> SUM
  SUM --> KURS["Kurs NBP A — dzień roboczy przed rozładunkiem"]
  KURS --> FV1["Faktura przewoźnik → HHL, 35 dni"]
  KURS --> FV2["Faktura HHL → KSH, 30 dni"]
  FV2 -. "przychód − koszt" .-> MARZA["Marża — tylko HHL"]
  FV1 -.-> MARZA
```

## 5. Mnożnik paliwowy SEFS

```mermaid
flowchart TB
  A["OKQ8 — plik historii, kolumna Diesel"] --> A1["średnia pon–niedz, 2 miejsca"]
  B["Orlen API — zł/m³ ÷ 1000"] --> B1["średnia pon–niedz, 2 miejsca"]
  A1 --> T1["tabela SEK, 51 progów"]
  B1 --> T2["tabela PLN, 51 progów"]
  T1 --> MIN{"niższy z dwóch"}
  T2 --> MIN
  MIN --> ZAST["transporty z datą załadunku w tygodniu — D-34"]
  MIN -. "powyżej tabeli" .-> R1["ostatni wiersz + ryzyko"]
  A -. "awaria źródła" .-> R2["ostatni ustalony mnożnik + ryzyko"]
```

## 6. ETA i kalibracja ucząca się

```mermaid
flowchart LR
  GPS["Pozycja GPS"] --> PROJ["Rzut na korytarz OSM"]
  PROJ --> REM["Pozostałe km × tempo odcinka"]
  REM --> ETA["ETA + pasmo"]
  PROM["Następny rejs z rozkładu"] --> ETA
  ODP["Odpoczynek dobowy"] --> ETA
  POG["Pogoda i drogi"] --> ETA
  ETA --> DEL{"ETA > koniec okna?"}
  DEL -- "tak, > 30 min" --> RYZ["Ryzyko + powiadomienie"]
  ROZ["Rozładunek"] --> POM["Czasy odcinków — zapis na stałe"]
  POM --> CAL["Kalibracja"]
  CAL --> CHK{"Sprawdzenie wsteczne: lepiej?"}
  CHK -- "tak, max ±10%/tydz." --> REM
  CHK -- "nie" --> ODR["Zmiana odrzucona"]
```

## 7. SharePoint w obie strony

```mermaid
sequenceDiagram
  participant KSH as KSH w Excelu
  participant SP as SharePoint
  participant T as TOWER
  participant H as HHL i przewoźnik
  KSH->>SP: zmienia datę kratownicy
  T->>SP: co 10 min: czy plik się zmienił?
  SP-->>T: nowa wersja
  T->>T: różnica komórka po komórce, wpis do historii
  T->>H: powiadomienie: było → jest, kiedy
  T->>T: przeliczenie konwoju i ceny
  H->>T: przewoźnik wpisuje kierowcę i auto
  T->>SP: zapis do pustych kolumn: kierowca, telefon, nr zlecenia, rejestracja
```

## 8. Model pracy

```mermaid
flowchart LR
  W["Właściciel — decyzje"] -- "decyzje, dane" --> K["Koordynator — Claude"]
  K -- "rekomendacje, sprzeczności" --> W
  K -- "paczka: DOPISZ + zlecenia" --> E["Wykonawca — Grok → Cursor"]
  E -- "potwierdzenie odbioru, raport" --> K
  K -- "niezależne zapytania" --> PROD[("Produkcja")]
  E -- "migracje, wdrożenia" --> PROD
  E -- "pytanie" --> DO["Decyzje oczekujące w PLAN.md"]
  DO --> W
```

## 9. Oś czasu

```mermaid
gantt
  dateFormat YYYY-MM-DD
  title TOWER — wrzesień 2026
  section Projekt
  Makieta i zakres           :done, 2026-09-22, 1d
  Etapy A–D, fale 0–2        :done, 2026-09-23, 2d
  Pieniądze, statusy, źródła :done, 2026-09-24, 2d
  Etapy 4–6, produkcja       :done, 2026-09-26, 1d
  Audyt zakresu, etap I      :done, 2026-09-27, 2d
  Cennik, SEFS, ETA v2       :active, 2026-09-29, 1d
  section Przed pilotażem
  Cursor przejmuje           :2026-09-30, 2d
  Spotkanie z przewoźnikiem  :2026-09-30, 3d
  Pilotaż                    :2026-10-03, 7d
```

