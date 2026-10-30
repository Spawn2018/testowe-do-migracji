# W-topbar-promy — kafelek promów w pasku (komputer) i rozmyte tło (telefon)

Koordynator (Claude), 30.10.2026. Gałąź `wyglad/W-topbar-promy` od `main` 799ea18. Tylko front: bez migracji, bez zmian w `supabase/`, uprawnieniach i zapisach.

## Podstawa
Polecenie właściciela 30.10, 15:48:
- pkt 2 — „Popraw widok na komputerze kafelka z widokiem promów w górnym pasku. Rozjechał się. Zaprojektuj tak, żeby był czytelny i wartościowy dla użytkownika. Nie zmieniaj widoku na urządzeniu mobilnym.”;
- pkt 3 — „Na urządzeniu mobilnym po kliknięciu obszarów promów oraz ikony z inicjałami konta tło ma się rozmazywać. Dokładnie w taki sam sposób jak po kliknięciu ikony dzwoneczka — bez ikony X. Nie zmieniaj nic w widoku na komputerze.”

## Przyczyna (pkt 2)
Od BN1/BN2 pasek pokazywał najbliższy rejs **każdego** armatora (Stena, Polferries + nowi z rozkładem) **jeden pod drugim**. Przy 4–6 armatorach blok rejsów miał 73 px wysokości w pasku o wysokości 52 px — wychodził ponad i pod pasek, nachodził na pasek etapów (`przed-komputer-*.webp`).

## Co zmienione
**Komputer (≥ 769 px):**
- w pasku **jeden** najbliższy rejs w jednej linii: odliczanie, statek, godzina, port wyjścia → port docelowy (od 1440 px; poniżej — jak dotąd bez portu docelowego, E20 pkt 2); przy rejsie opóźnionym znacznik „Opóźniony”;
- obok przycisk **„+N”** (N = pozostali armatorzy z rejsem) — lista „Najbliższe odjazdy promów”: odliczanie, armator, statek · godzina · trasa, status; zamyka Escape i kliknięcie obok;
- wysokość bloku rejsów 26 px (było 73 px), treść paska = 51 px w pasku 52 px przy 1280 / 1366 / 1440 / 1920;
- dymek `title` zaktualizowany (wcześniej „rozkład Polferries GDN↔NYN”).

**Telefon (≤ 768 px):** wygląd bez zmian (zrzuty zamknięte 360 / 390 / 430 — identyczne piksel w piksel z `main`). Po dotknięciu przycisku promu i inicjałów konta tło rozmywa się **tym samym elementem i stylem co dzwonek** (`.bell-scrim`, #594 B3: przyciemnienie + `blur(4px)`), przycisk nad tłem (drugie dotknięcie zamyka), dotknięcie tła zamyka (`onClick`, jak w dzwonku — bez kliknięcia w element pod spodem). Bez przycisku „✕”.

**Tryb pokazowy:** `#/?ferries=all` (tylko build demo) pokazuje 6 armatorów jak na produkcji — do zrzutów i testu. Domyślny pokaz bez zmian (zrzut `komputer-1440-demo` identyczny z `main`).

## Zrzuty
- `przed-komputer-1280/1440/1920-ciemny.webp`, `przed-komputer-1440-jasny.webp` — `main` z tymi samymi danymi (stos rejsów wychodzi poza pasek);
- `po-komputer-1280/1440/1920-ciemny.webp`, `po-komputer-1440-jasny.webp` — jeden rejs + „+3”;
- `po-komputer-1440-lista.webp`, `po-komputer-1440-lista-jasny.webp` — lista po „+3”;
- `przed/po-telefon-390.webp` — telefon zamknięty, bez zmian;
- `przed/po-telefon-390-promy.webp`, `przed/po-telefon-390-konto.webp` — po: tło rozmyte, bez „✕”.

## Testy
- `tests/e8-phone-gate.spec.ts` — blok „wyglad/W-topbar-promy”: komputer 1280–1920 (1 wiersz, treść paska ≤ pasek, „+N” → lista, Escape zamyka, bez tła), telefon 390 (tło przy promach i koncie, `backdrop-filter: blur`, bez „✕”, dotknięcie tła zamyka);
- `tests/w-topbar-promy.test.ts` — źródło: jeden rejs + `OpsFerries`, `bell-scrim` w obu miejscach, reguła przycisku nad tłem;
- dotychczasowe testy paska (E37, E13, E20 `c-wyglad-reszta`) zielone.

## Różnice, które zostają
- W trybie pokazowym rejsy Viking i Eckerö z terminalu A (`TLLA-HEL`) nie trafiają do „najbliższych” (`nearestCrossingByOperator` ich nie wybiera) — rozpoznanie tras Terminalu A naprawia #666 pkt C (Cursor). Pasek bierze listę z tej funkcji, więc po #666 pojawią się w „+N” bez zmian w tym kodzie.
