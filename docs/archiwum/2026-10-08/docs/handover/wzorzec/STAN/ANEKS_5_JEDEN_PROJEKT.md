# ANEKS 5 — JEDEN PROJEKT, ROCZNA SESJA UŻYTKOWNIKA

> **Wersja 2 — zastępuje wersję 1 w całości.** Poprawka właściciela: rok
> dotyczy **użytkowników programu**, nie kierowców. Jeżeli zacząłeś
> autoryzację urządzenia kierowcy na rok — wycofaj ją.

> Zapisz na końcu `docs/handover/ZLECENIE_FINAL.md` jako „ANEKS 5".
> **Zastępuje:** `DECYZJE_WYDANIE_1_0.md` sekcje 4.1 i 4.2 oraz linię
> o ważności tokenu w 2.3; `ANEKS_4` sekcję 1 i fragment PR2
> o odtwarzaniu do projektu testowego.

---

# 1. DECYZJE WŁAŚCICIELA

| # | Decyzja |
|---|---|
| A5.1 | **Jeden projekt Supabase — obecny — jest produkcją.** Drugiego projektu nie zakładamy |
| A5.2 | **Wykonujesz wszystkie kroki właściciela** — masz dostęp przez API |
| A5.3 | **Resend: konto założone, domena zweryfikowana, DNS potwierdzone** |
| A5.4 | Skrzynka konta Supabase jest czytana — ostrzeżenia o uśpieniu dotrą |
| A5.5 | **Logowanie użytkownika z linku e-mail — urządzenie pamięta je rok** |
| A5.6 | **Kierowca bez zmian: link ważny do 24 h po rozładunku, maksymalnie 14 dni** (sekcja 2.3 decyzji) |

---

# 2. SKUTKI JEDNEGO PROJEKTU — MUSISZ JE OBSŁUŻYĆ

Projekt, który był testowy, staje się produkcją. Trzy rzeczy przestają być
bezpieczne:

## 2.1 Sprzątanie przed pierwszym prawdziwym użytkownikiem

1. **najpierw kopia zapasowa (PR2)** — zanim cokolwiek usuniesz
2. usuń: **konta testowe** (w tym konta BK5), **faktury, transporty,
   zdarzenia i pozycje testowe**, ryzyka z testów
3. zostaw: migracje, `stegra.sql` (organizacje, projekt, strefy, statki,
   warunki płatności 30 i 35 dni), **147 prawdziwych rejsów**
4. lista usuniętego — liczbami, tabela po tabeli — w `POSTEP.md`
5. **napisz mi, zanim usuniesz** — lista do zatwierdzenia, potem usunięcie

## 2.2 Testy zapisujące dane — nigdy na tym projekcie

Od chwili sprzątania żaden test, który zapisuje albo zmienia dane, nie jest
uruchamiany na tym projekcie.
- `tests/db/run.sh` — działa na lokalnym Postgresie, bez zmian
- **BK5 (test API)** — przenieś na **lokalny Supabase przez CLI i Docker**.
  Jeżeli Dockera nie ma — napisz; nie uruchamiaj BK5 na produkcji
- **test odtworzenia kopii (PR2) — do lokalnego Postgresa** z migracjami,
  nie do projektu Supabase

## 2.3 Wdrożenia podglądowe — bez produkcji

Na planie darmowym Vercel podglądy są publiczne, a teraz jedyna baza
to produkcja. **Podglądy budowane w trybie `DemoProvider`** — bez połączenia
z Supabase. Produkcyjny build wyłącznie z gałęzi `main`.

---

# 3. POCZTA — PR3 GOTOWE DO URUCHOMIENIA

Domena zweryfikowana. Ty:
- ustaw Resend jako SMTP w Supabase Auth
- nadawca na domenie właściciela
- **wyślij link logowania na adres spoza zespołu projektu** i potwierdź
  dostarczenie — to jest kryterium, nie samo zapisanie ustawień
- sprawdź dzienny limit wysyłek darmowego planu Resend i napisz go w raporcie

---

# 4. SESJA UŻYTKOWNIKA — ROK

Pracownik HHL, KSH albo przewoźnika klika link z e-maila; to urządzenie
pozostaje zalogowane **365 dni od logowania**. Po roku — ponowne logowanie
linkiem.

## 4.1 Plan darmowy nie ma tego ustawienia

W Supabase sesja domyślnie trwa bez końca; **limit czasu sesji jest
dostępny wyłącznie od planu Pro.** Rok budujesz sam:

- **zadanie pg_cron raz dziennie usuwa z `auth.sessions` sesje utworzone
  ponad 365 dni temu.** Przy następnym odświeżeniu tokenu użytkownik
  trafia na ekran logowania z komunikatem: „Minął rok od logowania na tym
  urządzeniu — zaloguj się ponownie linkiem z e-maila" (PL/EN/SV)

## 4.2 Czego NIE robić

**Nie wydłużaj czasu ważności tokenu dostępu (JWT) do roku.** Zostaje
3 600 sekund. Rok ma żyć w sesji, którą da się usunąć — nie w tokenie,
którego nie da się odwołać. Token ważny rok oznaczałby, że zwolniony
pracownik albo skradziony laptop ma dostęp przez rok.

## 4.3 Link i sesja to dwie różne rzeczy

- **link w e-mailu: jednorazowy, ważny najwyżej godzinę** — sprawdź
  ustawienie i nie wydłużaj
- **sesja: 365 dni**

## 4.4 Odwoływanie

- **„Wyloguj ze wszystkich urządzeń"** w Ustawieniach użytkownika
- **HHL wylogowuje dowolnego użytkownika ze wszystkich urządzeń** —
  zgubiony laptop, odejście pracownika
- **dezaktywacja użytkownika odcina dane natychmiast**, nie po wygaśnięciu
  tokenu: funkcje używane w politykach RLS (`current_app_role()`,
  `current_org_id()`) zwracają pusto dla nieaktywnego użytkownika,
  a jego sesje są usuwane
- **„Moje urządzenia"** w Ustawieniach: przeglądarka, data logowania,
  data wygaśnięcia, ostatnia aktywność

## 4.5 Testy

- sesja starsza niż 365 dni usunięta przez zadanie; odświeżenie → ekran
  logowania z komunikatem
- sesja młodsza niż 365 dni nietknięta
- czas ważności tokenu dostępu = 3 600 s (test konfiguracji)
- link z e-maila użyty drugi raz — odrzucony
- użytkownik zdezaktywowany z wciąż ważnym tokenem — **zero wierszy**
  w każdej tabeli
- „wyloguj wszędzie" usuwa wszystkie sesje użytkownika
- HHL wylogowuje innego użytkownika; KSH i przewoźnik nie mogą wylogować
  nikogo poza sobą

# 5. KLUCZ DO KOPII — JEDYNY KROK WYŁĄCZNIE WŁAŚCICIELA

Robisz wszystko sam, z jednym wyjątkiem, bo wynika z celu zabezpieczenia:

- wygeneruj parę kluczy `age-keygen` **do pliku poza repozytorium**
- klucz publiczny — do sekretów funkcji `backup-export`
- **klucz prywatny przekaż właścicielowi do zapisania offline**
  (nośnik, drugi egzemplarz w menedżerze haseł właściciela), a następnie
  **usuń go z dysku** i potwierdź usunięcie
- nigdy w repozytorium, sekretach, rozmowie ani logach
- do comiesięcznego testu odtworzenia właściciel udostępnia klucz na czas
  testu; po teście usuwasz

Bez klucza prywatnego kopie są nie do odtworzenia — dlatego dwa egzemplarze
u właściciela.

---

# 6. KOLEJNOŚĆ

```
1   PR3 poczta: SMTP Resend + dostarczenie na adres spoza zespołu
2   PR2 kopie: klucz (sekcja 5), backup-export, R2, test odtworzenia lokalnie
3   2.1 sprzątanie: kopia → lista do zatwierdzenia → usunięcie → liczby
4   2.2 BK5 na lokalny Supabase; 2.3 podglądy w DemoProvider
5   4   sesja użytkownika rok + odwoływanie + testy
6   pozostałe PR z ANEKSU 4
7   wdrożenie produkcyjne, test dymny, raport, tag release-1.0
```

Lista kontrolna: dochodzą **A5-SPRZATANIE · A5-BK5-LOKALNIE · A5-PODGLADY ·
A5-SESJA-ROK · A5-KLUCZ**.
