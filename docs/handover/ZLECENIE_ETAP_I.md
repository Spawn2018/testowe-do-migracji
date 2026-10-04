> Odtworzone 04.10 z zapisów rozmów, wersja końcowa.

# ZLECENIE — ETAP I (PRZED PILOTAŻEM)

> 27.09.2026. Na podstawie `AUDYT_ZAKRESU.md` i Twoich odpowiedzi (`88c92cc`).
> Koordynator sprawdził produkcję: `tower.log-mar.pl` i Vercel — wersja
> produkcyjna, harmonogram i makieta 404; O3a — 3 konta nieaktywne,
> 0 sesji, 0 transportów, 0 faktur. **Pages `/tower-makieta` nadal 200,
> 92 717 B.**
>
> **Etap I to nie tylko sekcja B audytu.** Sekcja B to w większości sprawy
> właściciela. Etap I dla Ciebie to poniższe punkty I-0…I-9.
> **Wydanie 1.0 = etap I + O3b** (pierwszy prawdziwy transport).

---

## I-0 — NAJPIERW: WYCIEK PLIKÓW (dziś)

Bez logowania dało się pobrać `KSH_HARMONOGRAM.xlsx` — plik klienta —
i cztery kopie makiety.

1. **Cloudflare Pages trzyma każde poprzednie wdrożenie pod osobnym
   publicznym adresem `<hash>.tower-hhl.pages.dev` — bez żadnej ochrony**,
   inaczej niż Vercel. Przy jednym krótkim logowaniu: wypisz wszystkie
   wdrożenia Pages, **usuń wszystkie poza bieżącym**, sprawdź, że stare
   adresy nie zwracają plików. Wyczyść pamięć podręczną `/tower-makieta`
   i pozostałych ścieżek. Logout, `whoami`.
2. **Vercel: usuń 7 starych wdrożeń z makietą** — zgoda właściciela.
3. **Ocena ekspozycji** — do właściciela, dziś:
   - od kiedy każdy z plików był publiczny — na Vercel i na Pages
     (data pierwszego wdrożenia z plikiem, data usunięcia)
   - **jakie kolumny `KSH_HARMONOGRAM.xlsx` zawierają dane osobowe**:
     imiona, nazwiska, telefony, adresy e-mail. Tylko nazwy kolumn
     i liczba wierszy — bez wartości
   - czy są jakiekolwiek logi pobrań tych ścieżek (Vercel, analityka
     Pages). Jeśli nie ma — napisz wprost
4. **Strażnik:** test budowania, który w paczce produkcyjnej odrzuca
   pliki `*.xlsx`, `*makieta*`, `claude-*` i dane demonstracyjne
   (identyfikatory transportów z danych demo, „23.09", „R-03").
   Paczka produkcyjna z danymi demo = build czerwony

---

## I-1 — BLOKER: IMPORT W PRODUKCJI NIE ZAPISUJE TRANSPORTÓW

Bez tego nic nie trafi na produkcję. Import w trybie `supabase` zapisuje
transporty do `loads` z pozycjami wysyłek, w transakcji, z podglądem
zmian jak w trybie demo.
**Test na realnej skali w trybie produkcyjnym** (to był 25.1 — D23-S
działa tylko w demo): cały harmonogram na lokalnym Supabase, liczba
transportów, pozycji i czas.

---

## I-2 — ZERO FASADY

**Zasada:** każda funkcja widoczna na produkcji działa albo jest ukryta
czy oznaczona „brak źródła danych". Nigdy nie udaje.

| # | Co | Decyzja |
|---|---|---|
| a | przełącznik „Widok HHL/KSH/SCX" widoczny dla KSH i SCX | usunąć — tylko HHL |
| b | baner R-03 na kokpicie KSH, oś czasu „dziś 23.09" | pozostałości demo — usunąć, dane z bazy |
| c | **Workflows** — „Uruchom" zapisuje przebieg bez sprawdzenia warunku | **ukryć moduł w produkcji w 1.0**; silnik po 1.0 |
| d | **ETA** — liczona w przeglądarce z samego statusu | **ETA v1 w bazie:** bieżący odcinek + czasy odcinków + odejście i przypłynięcie przypisanego rejsu z `sailings`; przeliczana przy każdym zdarzeniu; pole ufności wypełnione uczciwie |
| e | pogoda morska, przeprawy alternatywne, objazdy SE | ukryć albo „brak źródła danych" — bez danych statycznych |
| f | **Opcje BAF — fasada (F2.4)** | prawdziwy formularz dla HHL: parametry SEFS i miesięczne odczyty indeksu ze źródłem i datą, dziennik zmian. Wartości poda właściciel po uzgodnieniu z przewoźnikiem |
| g | kody opóźnień (C8) | ukryć do czasu uzgodnienia z przewoźnikiem |

Dodatkowo: przejrzyj **37 pozycji „częściowo"** i wypisz te, które
działają **tylko w demo**. Każda taka trafia do tej tabeli.

---

## I-3 — BRAMKA SMS

**Propozycja przyjęta:** własna minimalna aplikacja w Kotlinie, model
pobierania, kontrakt z `PROPOZYCJA_SMS.md`.

**Lista na pilotaż:** 1 link kierowcy · 2 zmiana okna ≥30 min ·
3 zmiana promu lub opóźnienie ≥30 min · 4 prom odwołany · 5 transport
anulowany · **8 brak GPS** · **9 prośba o potwierdzenie rozładunku** —
bo data rozładunku to data usługi i kurs na fakturze.
**Po pilotażu:** 6, 7, 10 (czeka na klucz Trafikverket), 11.

**Cztery decyzje:**
1. link tylko w pierwszym SMS — tak; kolejne odsyłają do niego;
   zgubiony link = nowy token i nowy SMS
2. e-mail zastępczy — tak, jak proponujesz
3. **język: kolumna `driver_locale` przy transporcie, domyślnie z prefiksu
   (+48 pl, +46 sv, reszta en), zmienialna przy wysyłce linku.** Sam prefiks
   nie wystarczy — kierowca szwedzkiego przewoźnika często ma szwedzki
   numer, a nie mówi po szwedzku
4. SIM firmowa, 150/dobę — tak

**Jedna poprawka w projekcie:** token w treści SMS żyje w `sms_outbox.body`
jeszcze 24 h po wysłaniu i trafia do nocnej kopii zapasowej. Zamiana treści
na `[link usunięty]` **od razu po `SENT`**; HHL w interfejsie nie widzi
treści z `contains_secret`; kopia zapasowa nie zawiera treści z tokenem.

---

## I-4 — INSTRUKCJE (B6)

Jedna strona dla kierowcy PL/EN/SV: link, cztery przyciski, zdjęcia,
co robić, gdy link nie działa. Krótkie instrukcje dla KSH i przewoźnika.
Dostępne w aplikacji.

## I-5 — 2FA DLA ADMINISTRATORÓW (B7)

TOTP z Supabase Auth. **Wymagane dla HHL_ADMIN**, wymuszone w bazie
(`aal2`) dla funkcji administracyjnych i finansowych. Test: administrator
bez drugiego składnika nie wykona funkcji administracyjnej.

## I-6 — MONITORING BŁĘDÓW (D1)

Błędy przeglądarek użytkowników do własnej tabeli przez funkcję SQL,
z limitem; dzienne podsumowanie i alarm przy skoku. Bez zewnętrznej usługi.

## I-7 — RETENCJA (D13)

Dane kierowcy 90 dni — zgodnie z `purge_personal_data`. Zdjęcia, CMR,
POD — **decyzja właściciela**; do tego czasu bez automatycznego kasowania.

## I-8 — WYDAJNOŚĆ (D3)

Lokalnie: cały harmonogram, pełny GPS według PR5, trzy role. Czasy widoków
i zapytań, porada wydajnościowa Supabase — wynik liczbami.

## I-9 — REJESTR ZAKRESU

Twój `SCOPE.md` w repo kończy się na §38; koordynator prowadzi wersję
do §52. **Właściciel dołącza `SCOPE.md` koordynatora — zastąp nim swój.**
Twoją sekcję §39 (statusy) przenieś jako **§53**, a statusy wpisz
do tabel sekcji 0–11.

---

## Kolejność

**I-0 dziś** → I-1 → I-2 → I-3 → I-5 → I-4, I-6, I-7, I-8 → I-9 na bieżąco.
Właściciel równolegle: stawki, parametry SEFS, umowy RODO, spotkanie
z przewoźnikiem.
