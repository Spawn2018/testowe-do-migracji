# MOJE ZADANIA — KROK PO KROKU

> Rzeczy, których nie zrobi za Ciebie ani Grok, ani koordynator.
> Kolejność: od najszybszych i najdłużej trwających po stronie urzędów.
> **Żadnego klucza ani hasła nie wklejaj w treść rozmowy** — tylko
> w bezpieczne pole Groka.

---

# NAJPILNIEJSZE

## 0. Hasło bazy — BEZ ZMIANY (decyzja 29.09, ryzyko przyjęte)
Zamiast zmiany — odcięcie dostępu Groka, skoro nie pracuje · 10 min:
1. **supabase.com/dashboard → awatar → Access Tokens** — unieważnij token,
   którego używał Grok (nowy wydasz Cursorowi przez `supabase login`)
2. **GitHub → Settings → Applications / Personal access tokens** — unieważnij
   dostęp Groka do repozytorium, jeśli miał osobny
3. **Vercel → Account Settings → Tokens** — unieważnij token Groka
4. Na komputerze Groka: usunięcie `.env.local` i wylogowanie narzędzi —
   gdy Grok wróci po odnowieniu limitu, dostanie nowe tokeny
5. **Obecne hasło bazy jest w `.env.local` na komputerze Groka.** Jeśli go
   nie znasz — skopiuj je stamtąd do `.env.local` Cursora, zanim cokolwiek usuniesz

---

# DZIŚ — około 1,5 godziny łącznie

## 1. Vercel — wyłącz trenowanie modeli · 2 min
1. Wejdź na **vercel.com** i zaloguj się na konto, na którym jest TOWER
   (`watch-tower-makieta`)
2. Kliknij nazwę zespołu → **Settings**
3. Znajdź **Data Preferences**
4. Wybierz **Opt-out** i zapisz

## 2. Weryfikacja dwuetapowa na kontach usług · 30 min
Wszystko stoi na Twoim Gmailu — jego przejęcie to przejęcie całego systemu.
Zacznij od niego.

1. Zainstaluj na telefonie aplikację uwierzytelniającą: **Google Authenticator**
   albo **Microsoft Authenticator**
2. **Gmail:** myaccount.google.com → **Bezpieczeństwo** → **Weryfikacja
   dwuetapowa** → włącz, dodaj aplikację uwierzytelniającą → **pobierz kody
   zapasowe**
3. To samo w **GitHub, Supabase, Vercel, Cloudflare, Resend**: w każdym
   ustawienia konta → zakładka **Security** albo **Authentication** →
   **Two-factor authentication** → zeskanuj kod QR
4. **Kody zapasowe z każdego konta** zapisz tam, gdzie klucz do kopii:
   na pendrive i w menedżerze haseł

Nie używaj SMS jako drugiego składnika — aplikacja jest bezpieczniejsza.

## 3. Klucz Trafikverket (drogi w Szwecji) · 10 min
1. Wejdź na **trafikverket.se** → wyszukaj **„Trafikverkets öppna API för
   trafikinformation"** → przejdź do rejestracji
2. **Użyj Chrome albo Edge** — rejestracja miewa problemy w Firefoksie
3. Wypełnij dane — firma: ta, która prowadzi TOWER
4. **Zaakceptuj licencję** API
5. **Potwierdź adres e-mail** z wiadomości, którą dostaniesz
6. Zaloguj się → na koncie jest **klucz API**
7. Przekaż klucz Grokowi przez bezpieczne pole — ruszy pozycja II-6

## 4. Klucz HERE (czas przejazdu ciężarówki) · 15 min
HERE wymaga karty — koszt pozostanie zerowy dzięki twardemu limitowi,
który Grok ustawi w kodzie poniżej darmowego progu.
1. Wejdź na **platform.here.com** → załóż konto
2. Wybierz **Base Plan** i podaj kartę
3. W **Access Manager** utwórz aplikację, np. „TOWER"
4. W aplikacji wygeneruj **API Key**
5. Jeśli panel rozliczeń pozwala ustawić **powiadomienia o zużyciu** —
   włącz je na swój adres
6. Przekaż klucz Grokowi przez bezpieczne pole

## 5. Rejestracja w KPD GDDKiA (drogi w Polsce) · 20 min + czekanie
Najdłuższa droga — dlatego dziś. Dwa etapy: najpierw rejestruje się firma,
potem użytkownik z dostępem przez API.

1. Wejdź na **kpd.gddkia.gov.pl** → **FAQ** → pobierz **formularz
   rejestracyjny Odbiorcy Danych**
2. **Zdecyduj, która firma się rejestruje** — HHL czy LOGMAR, czyli ta,
   która prowadzi TOWER. Osoba kontaktowa: Ty
3. Wypełnij, podpisz, zeskanuj
4. Wyślij na **kpd@gddkia.gov.pl** — albo pocztą: GDDKiA, ul. Wronia 53,
   00-874 Warszawa
5. Po rejestracji firmy dostaniesz powiadomienie → wtedy **drugi wniosek:
   użytkownik z dostępem do API**. Dostęp do danych wymaga **certyfikatu
   klienta** — gdy go dostaniesz, przekaż Grokowi

## 6. E-mail do armatora (komunikaty o rejsach) · 5 min
Bez zgody Grok nie włączy automatycznego odczytu komunikatów (II-5).
Wyślij do działu cargo POLSCA Baltic Ferries — adres na ich stronie
w zakładce kontakt / cargo:

> Temat: Zgoda na automatyczny odczyt komunikatów o kursowaniu promów
>
> Dzień dobry,
> H&H Logistics obsługuje regularne przewozy ładunków ponadnormatywnych
> na linii Gdańsk – Nynäshamn dla projektu budowlanego w Szwecji.
> Budujemy system monitorowania tych transportów i chcielibyśmy
> automatycznie odczytywać Państwa stronę z komunikatami o kursowaniu
> promów — kilka razy na godzinę, wyłącznie do informowania naszych
> dyspozytorów i przewoźnika o zmianach. Czy wyrażają Państwo na to zgodę?
> Jeśli udostępniają Państwo te informacje w innej formie, chętnie z niej
> skorzystamy.
> Z poważaniem, Sebastian Bożek, H&H Logistics

## 7. Umów spotkanie ze Scandinavian Express · 10 min
1. Zaproponuj termin — 60 minut, może być online
2. **Wyślij im wcześniej pięć pytań z bloku 1** programu `SPOTKANIE_SCX.md`
   i prośbę o dokumentację API telematyki — przyjdą przygotowani
3. Na spotkaniu miej otwarty `SPOTKANIE_SCX.md` i wypełniaj tabele

---

# W TYM TYGODNIU

## 8. Stawki — D-1 · ✅ PRZEKAZANE 30.09
Bez tego nie wejdzie na produkcję harmonogram ani żadna faktura.
1. Zbierz: **ofertę Scandinavian Express** — wszystkie strony, z dopłatami —
   oraz **umowę lub ofertę dla KSH** z załącznikiem cenowym
2. Sprawdź, czy jest w nich **stawka za transport standardowy**. Jeśli nie —
   to pytanie na spotkanie
3. Przekaż pliki Grokowi. **Nigdzie publicznie** — to dane poufne obu umów

## 9. Telefon i karta SIM do bramki SMS — D-4
1. **Telefon z Androidem**, osobny — nie Twój prywatny. Minimalną wersję
   systemu potwierdzi Grok
2. **Karta SIM firmowa**: nielimitowane SMS w Polsce **i SMS-y na numery
   szwedzkie +46**. Zapytaj operatora, czy **regulamin dopuszcza
   automatyczną wysyłkę** — część ofert tego zabrania
3. **Wyłącz PIN karty SIM** — telefon musi sam ruszyć po restarcie
4. Miejsce: stale podłączony do prądu, w zasięgu Wi-Fi, w zamkniętym
   pomieszczeniu
5. Napisz Grokowi, że telefon jest gotowy — instalację aplikacji zrobisz
   według jego instrukcji

## 10. Lista użytkowników do zaproszenia — potrzebna przed pilotażem
Dla każdej osoby: **imię i nazwisko, e-mail, firma, rola**.
- **HHL:** administrator (Ty), operacyjni
- **KSH:** kto potwierdza daty, kto widzi faktury
- **Scandinavian Express:** dyspozytorzy, administracja, księgowość —
  najlepiej zebrać na spotkaniu (pytanie 15)

## 11. RODO — D-5
Nie jestem prawnikiem — tę część daj do sprawdzenia prawnikowi albo
inspektorowi ochrony danych.
1. **Role:** przewoźnik jest administratorem danych swoich kierowców,
   HHL przetwarza je w TOWER → **umowa powierzenia HHL – Scandinavian Express**
2. **Klauzula informacyjna dla kierowców** — przekazuje ją przewoźnik: cel
   (monitorowanie przewozu), zakres (imię, telefon, pozycja GPS wyłącznie
   w czasie transportu, zdjęcia), okres (90 dni), odbiorcy (HHL; KSH —
   pozycja ładunku)
3. **Lista podmiotów przetwarzających:** Supabase (UE, Irlandia), Vercel,
   Cloudflare, Resend — każdy ma gotowe DPA na stronie prawnej;
   pobierz i zachowaj
4. **Rejestr czynności przetwarzania HHL** — dopisz TOWER

## 12. Retencja dokumentów — D-3
Rekomendacja do potwierdzenia z księgową:
- **CMR, POD, zdjęcia mocowania — 3 lata od rozładunku.** Roszczenia
  z konwencji CMR przedawniają się po roku, a przy winie umyślnej po
  trzech latach
- **PDF faktur — 5 lat od końca roku wystawienia**, jak dokumentacja podatkowa
Napisz Grokowi decyzję jednym zdaniem.

## 12a. Krótka rozmowa z KSH · 20 min
1. **Kto u Was potwierdza daty w TOWER?** Imiona i e-maile — do zaproszeń
2. **Na ile dni przed załadunkiem potwierdzacie daty?** System domyślnie
   pokazuje ryzyko przy 5 dniach — zgodzić z tym, czego potrzebuje przewoźnik
3. **Godzina załadunku.** Rejs odpływa o 18:00, odprawa do 15:00 — ciężarówka
   musi wyjechać ze Śremu około 7:30. **Czy możecie ładować wieczorem dzień
   wcześniej?** Wtedy każdy transport jest w Boden o dobę szybciej
4. **Załadunek w piątek lub sobotę = dodatkowa doba**, bo w niedzielę zwykle
   nie ma rejsu. Czy da się ich unikać przy planowaniu?
5. **Zmiana potwierdzonej daty** — kto płaci za przebukowanie promu albo pusty
   przejazd? Warto, żeby umowa mówiła to wprost

## 12b. Pytanie do księgowej — D-14 · 5 min
> Dzień dobry, w projekcie Stegra Boden rozliczamy przewozy w EUR, a do
> przeliczenia na PLN chcemy stosować **kurs średni NBP z tabeli A
> z ostatniego dnia roboczego poprzedzającego dzień rozładunku** — osobno
> dla każdej pozycji faktury tygodniowej, bo każdy transport ma inny dzień
> rozładunku. Czy ta reguła jest poprawna dla faktur wystawianych przez HHL
> dla KSH i dla faktur przewoźnika ze Szwecji wystawianych dla HHL?

---

# GDY GROK DA ZNAĆ

## 13. Weryfikacja dwuetapowa w TOWER — D-11 · **GOTOWE DO ZROBIENIA**
1. **tower.log-mar.pl** → **Opcje → Weryfikacja dwuetapowa**
2. Zeskanuj kod QR aplikacją uwierzytelniającą, wpisz 6 cyfr
3. **Dodaj drugie urządzenie** — drugi telefon albo menedżer haseł
4. Dopiero teraz **„Włącz wymaganie"**
5. Wyloguj się, zaloguj ponownie — system musi poprosić o kod

## 14. Instalacja aplikacji SMS — po I-3
Według instrukcji Groka.

## 15. Przed pierwszym prawdziwym transportem — D-21
**tower.log-mar.pl → Opcje → „Wymóg zezwoleń (transporty ponadnormatywne)" → włącz.**
Od tej chwili ładunek ponadnormatywny bez zezwolenia PL i SE nie przejdzie do „Gotowy".

---

# PO SPOTKANIU Z PRZEWOŹNIKIEM

Zrób zdjęcie wypełnionych tabel albo prześlij notatki koordynatorowi.
Zamkną się z tego: parametry paliwowe (D-2), termin potwierdzania dat (D-12),
kody opóźnień, telematyka, lista kont przewoźnika.
