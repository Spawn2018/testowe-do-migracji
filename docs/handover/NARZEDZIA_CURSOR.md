# NARZĘDZIA CURSORA — WTYCZKI (MCP) I ZASADY UŻYCIA

> Właściciel zainstalował w Cursorze poniższe wtyczki (29.09.2026).
> **Wtyczka to dostęp do produkcji — zasady niżej obowiązują zawsze.**

| Wtyczka | Po co | Ustawienie | Wolno | Nie wolno |
|---|---|---|---|---|
| **Supabase** | zapytania do bazy, logi, dokumentacja, porady bezpieczeństwa | **tylko odczyt**, zawężona do projektu `nglnnrmzmhusvxslousq` | odczyt danych, schematu, logów (np. przyczyny błędów logowania, I-33) | zmieniać bazę przez wtyczkę — **zmiany wyłącznie migracjami** (`npx supabase db push`, skill `tower-migracja-bazy`) |
| **Resend** | konfiguracja domeny i szablonów e-maili | — | odczyt stanu domeny, szablonów, statystyk wysyłki | **wysyłać e-maile do kogokolwiek poza właścicielem** — wysyłka do użytkowników = STOP (konstytucja IX.3) |
| **Vercel** | stan wdrożeń, logi budowania i działania | konto właściciela | sprawdzanie wdrożeń, logów, domen | zmieniać ustawienia projektu, domen i zmiennych bez zlecenia |
| **Playwright** | przeglądarka do testów: przejścia użytkownika, widoki telefonu i tabletu, zrzuty | lokalnie | testy §14 (390 i 768 px), awizacja, logowanie, centrum decyzji | logować się na konta prawdziwych użytkowników |
| **Cloudflare** | kopie zapasowe w R2, Workery, logi — **I-33 zawieszona kopia** | konto właściciela | odczyt logów Workerów i stanu R2 | usuwać obiekty R2, zmieniać Workery bez zlecenia; logowanie wymaga obecności właściciela („Allow") |
| **Context7** | aktualna dokumentacja bibliotek (React, Vite, Supabase, libphonenumber…) | — | sprawdzanie API bibliotek przed użyciem | — |

## Zasady
1. **Produkcja zmienia się tylko przez migracje i wdrożenia z repozytorium** — nigdy
   „na skróty" przez wtyczkę
2. **Nic nie wysyłamy użytkownikom** bez decyzji właściciela (e-maile, SMS, zaproszenia)
3. **Sekrety z wtyczek nie trafiają do kodu, commitów, logów ani odpowiedzi**
4. Wynik ważnego sprawdzenia przez wtyczkę → zapis w `POSTEP.md` (co sprawdzone, wynik)
5. Wtyczka niedostępna albo wylogowana → napisz w raporcie, nie obchodź jej
6. **Aikido i CodeRabbit nie są wtyczkami tej listy i nie są warunkiem scalenia.** BLOKUJE: high/critical w zależnościach produkcyjnych (`npm audit --omit=dev --audit-level=high`). NIE BLOKUJE: zależności deweloperskie — wpis P3 i sprawdzenie w niedzielnej bramie, czy wyszła poprawka. Do scalenia także: zielone testy aplikacji, brama bazy gdy dotyczy SQL, gitleaks przy każdym commicie.

## Czego NIE instalujemy
- wtyczek z dostępem do poczty, kalendarza, SharePointa — integracja z SharePoint idzie
  przez aplikację (II-10) po zgodzie IT KSH (D-32), nie przez Cursora
- wtyczek płatnych i wymagających karty

