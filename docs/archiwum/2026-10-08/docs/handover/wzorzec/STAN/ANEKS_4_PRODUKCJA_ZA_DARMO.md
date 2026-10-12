# ANEKS 4 — PRODUKCJA W CAŁOŚCI ZA DARMO

> **Decyzja właściciela: wszystko na planach darmowych — Supabase, Vercel,
> integracje. Bez planów płatnych, nigdy.** Zapisz na końcu
> `docs/handover/ZLECENIE_FINAL.md` jako „ANEKS 4". Zastępuje w
> `DECYZJE_WYDANIE_1_0.md` sekcję 4.2 i doprecyzowuje sekcję 2.3.

Plan płatny daje sam z siebie cztery rzeczy, które na darmowym trzeba
zbudować: brak usypiania, kopie zapasowe, zapas limitów, pocztę. Ten aneks
je buduje. Wszystko poniżej sprawdzone 26.09.2026 — **warunki darmowych
planów zmieniają się; przy zakładaniu każdego konta sprawdź je jeszcze raz.**

---

# 1. SUPABASE — DWA PROJEKTY, TO CAŁY LIMIT

Plan darmowy pozwala na **dwa aktywne projekty**:
- **testowy** — obecny, zostaje
- **produkcyjny** — nowy, **region UE**

Trzeciego nie ma. Nie zakładaj tymczasowych projektów, nie usuwaj testowego.

---

# 2. USYPIANIE PO 7 DNIACH — PR1

Supabase usypia darmowy projekt przy zbyt małej **aktywności użytkowników
w bazie** w ciągu tygodnia. Codzienne użycie to zwykle wystarcza, ale
dwa tygodnie przerwy świątecznej już nie.

- **Cloudflare Worker, plan darmowy, wyzwalacz czasowy co 6 godzin**
  wywołuje funkcję `keep_alive()` w bazie produkcyjnej — prawdziwe zapytanie
  (zapis znacznika w tabeli `system_heartbeat`), nie sam ping adresu
- **nie opieraj tego na pg_cron** — zadania wewnątrz bazy mogą nie liczyć
  się jako aktywność użytkowników
- ten sam Worker sprawdza odpowiedź; błąd → e-mail do administratora HHL
  „baza produkcyjna nie odpowiada"
- **Supabase wysyła ostrzeżenie tydzień przed uśpieniem** na adres właściciela
  konta — to musi być skrzynka, którą ktoś czyta. Uśpiony projekt przywraca
  się jednym kliknięciem

*Kryterium:* Worker działa, znacznik w bazie odświeża się co 6 h, symulowany
błąd wysyła e-mail.

---

# 3. KOPIE ZAPASOWE — PR2

Na planie darmowym **kopii nie da się pobrać**; Supabase zaleca własne zrzuty.

**Codziennie o 02:30**, funkcja Edge `backup-export` (pg_cron):
- `COPY` wszystkich tabel biznesowych do CSV, kompresja gzip
- **szyfrowanie kluczem publicznym** (age, X25519). Klucz prywatny ma
  **wyłącznie właściciel, poza wszystkimi systemami** — zapis na papierze
  albo nośniku offline. W sekretach funkcji tylko klucz publiczny
- zapis do **Cloudflare R2, plan darmowy**: 10 GB, zero opłat za transfer,
  bez wygasania
- **surowe pozycje GPS pomijane** — dane osobowe, i tak kasowane po okresie
  retencji; zdarzenia biznesowe są w `load_events` i trafiają do kopii
- pliki (PDF, CMR, POD, zdjęcia): codziennie przyrostowo — tylko nowe

**Retencja w R2:** kopie dzienne 30 dni, miesięczne 12 miesięcy.

**Odtworzenie:** `scripts/restore.sh` — odszyfrowanie i załadowanie
do projektu **testowego**. **Test odtworzenia raz w miesiącu**, wynik
w `POSTEP.md`. Kopia, której nigdy nie odtworzono, nie jest kopią.

Utrata danych w najgorszym razie: **do 24 godzin** — zapisz to wprost
w dokumentacji dla właściciela.

Przy aktywacji R2 Cloudflare może poprosić o dane karty — w limicie planu
darmowego opłat nie ma. **Sprawdź przy zakładaniu i napisz mi.**

*Kryterium:* kopia powstaje, jest zaszyfrowana, odtworzenie do projektu
testowego przechodzi, liczba wierszy się zgadza.

---

# 4. POCZTA — PR3, BLOKUJE PRODUKCJĘ

**Domyślna poczta Supabase wysyła wyłącznie do adresów z zespołu projektu
i służy tylko do testów.** Bez własnej poczty użytkownicy KSH i przewoźnika
**nie dostaną linku do logowania**.

- **Resend, plan darmowy**, jako własny serwer SMTP w Supabase Auth
- **zweryfikowana domena nadawcy** — rekordy DNS (SPF, DKIM) po stronie
  właściciela
- ten sam Resend wysyła przypomnienia o płatnościach
- **dzienny limit wysyłek planu darmowego sprawdź przy zakładaniu** —
  i porównaj z budżetem: logowania + przypomnienia (sekcja 7)

*Kryterium:* link logowania dociera na adres spoza zespołu projektu.

---

# 5. LIMITY — PR4: CODZIENNA KONTROLA

Plan darmowy: baza **500 MB**, pliki **1 GB**, funkcje Edge **500 000
wywołań miesięcznie**, transfer **5 GB**.

Funkcja `usage-check` codziennie:
- mierzy zajętość bazy, plików, wywołania, transfer
- **70% → ryzyko dla HHL; 85% → ryzyko wysokie i e-mail**
- zapisuje historię — widać trend, nie tylko stan

---

# 6. BUDŻET BAZY 500 MB — PR5: POZYCJE GPS

Pozycje GPS to jedyna tabela, która może rozsadzić limit.

- aplikacja kierowcy: pozycja **co 2 minuty w ruchu, co 15 minut na postoju**
  (prędkość poniżej 5 km/h) — silnik stref potrzebuje dwóch kolejnych
  punktów, więc wjazd w strefę nadal wykrywany w kilka minut
- telematyka przewoźnika: ten sam limit w `process_position()` — punkt
  bliżej niż 60 s po poprzednim dla tego transportu jest pomijany
- **retencja: pozycje kasowane 30 dni po rozładunku** — sprawdź obecne
  ustawienie `purge_personal_data()` i dostosuj
- **zmierz:** ile bajtów zajmuje 1 000 pozycji z indeksami; podaj prognozę
  dla całego projektu

---

# 7. BUDŻET FUNKCJI EDGE 500 000 — PR6

**Doprecyzowanie sekcji 2.3 `DECYZJE_WYDANIE_1_0.md`:** pozycje i zdarzenia
etapów od kierowcy **nie przez funkcję Edge**, tylko przez funkcję SQL
`driver_post_position(token, …)` wywoływaną przez API bazy — sprawdzenie
skrótu tokenu i limit zapytań w SQL. Wywołanie funkcji bazy nie zużywa
limitu funkcji Edge. Wszystkie warunki tokenu z sekcji 2.3 zostają.
**Zdjęcia** — przez funkcję Edge, bo to kilka sztuk na transport.

| Funkcja | Wywołań miesięcznie |
|---|---|
| `ferry-status`, co 15 min | ~2 900 |
| `ferry-ais`, co 10 min | ~4 300 |
| `road-se`, co 10 min | ~4 300 |
| `traffic-flow`, 20 aut co 15 min | ~58 000 |
| `backup-export`, `usage-check`, przypomnienia | ~100 |
| zdjęcia kierowców | ~1 500 |
| **razem** | **~71 000 z 500 000** |

Zmierz rzeczywiste po miesiącu i porównaj.

---

# 8. PLIKI 1 GB — PR7

- **zdjęcia kompresowane w przeglądarce przed wysłaniem:** dłuższy bok
  1 600 px, JPEG jakość ok. 0,75 — typowo 200–400 kB zamiast kilku MB
- PDF: limit 10 MB na plik, większy odrzucany ze zrozumiałym komunikatem
- **archiwizacja od 70% zajętości:** pliki transportów rozładowanych ponad
  90 dni temu, zafakturowanych i opłaconych, przenoszone do R2; w bazie
  zostaje wskaźnik, pobranie przez podpisany link. Kopia zapasowa obejmuje
  oba miejsca

*Kryterium:* zdjęcie 5 MB z telefonu trafia do bazy jako < 500 kB;
archiwizacja przetestowana na projekcie testowym.

---

# 9. HOSTING — PR8

Bez zmian względem sekcji 4.3 `DECYZJE_WYDANIE_1_0.md`: Vercel na planie
darmowym, zapas na Cloudflare Pages w gotowości, domena pod kontrolą
właściciela, procedura przełączenia przetestowana raz.

---

# 10. DZIAŁANIA WŁAŚCICIELA — WSZYSTKIE BEZPŁATNE

| # | Działanie |
|---|---|
| 1 | projekt Supabase **produkcyjny, region UE, plan darmowy**; włączyć `pg_cron` |
| 2 | konto Cloudflare: Pages (zapas hostingu), R2 (kopie), Workers (podtrzymanie) |
| 3 | konto Resend, weryfikacja domeny — rekordy DNS |
| 4 | **para kluczy age** na własnym komputerze: `age-keygen`; **klucz prywatny offline**, do Groka trafia wyłącznie publiczny |
| 5 | adres e-mail konta Supabase — skrzynka, którą ktoś czyta codziennie |
| 6 | token Supabase do pliku środowiskowego, odwołanie po wdrożeniu |

---

# 11. MIEJSCE W KOLEJNOŚCI

Pozycje **PR1–PR8** — między punktem 7 (polskie znaki) a punktem 8
(produkcja) z sekcji 5 `DECYZJE_WYDANIE_1_0.md`. **PR3 (poczta) i PR2
(kopie) muszą działać przed pierwszym prawdziwym użytkownikiem.**
Tag `release-1.0` — po teście dymnym na produkcji, jak dotąd.

Lista kontrolna: dochodzą **PR1–PR8**.
