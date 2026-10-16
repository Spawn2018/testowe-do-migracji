# wyglad/P10b-a — E37 pkt 4 i 7: komunikat HHL z „Zamknij”, „Nie pamiętam hasła”, „Link wygasł” (16.10.2026, 05:30)

Podstawa:
- E37 „Propozycja” pkt 4 (Komunikat HHL) i pkt 7 (Logowanie);
- makieta `makiety_html/E37/pasek.html` — tabela „Komunikaty — dziś i po zmianie”, ekran „Link wygasł”, pasek telefonu z „✕”;
- PLAN §4 P10b;
- dane do podłączenia: D-20261016-0530-01.

Wygląd, teksty i przejścia między ekranami (F8). Bez zapisów i zapytań.

| Element | Było | Jest |
|---|---|---|
| Komunikat HHL | bez zamknięcia | „Zamknij” po prawej (telefon: „✕” 44 × 44 px); zamknięty nie wraca; po dacie końca znika sam |
| „Nie pamiętam hasła” | „Jeśli adres ma dostęp, wysłaliśmy link do resetu hasła. Otwórz go w tej przeglądarce.” albo „Brak zaproszenia — skontaktuj się z HHL.” | zawsze: **„Jeśli adres ma konto, wysłaliśmy link. Działa na każdym urządzeniu przez 1 h.”** — także przy braku zaproszenia; własny tekst tylko przy zbyt wielu próbach, nieudanej wysyłce e-maila i złym adresie |
| Wygasły link z e-maila („Dalej”) | czerwone „Link wygasł lub został już użyty. Poproś o nowy.” i „Wyloguj” | ekran **„Link wygasł”** |
| Powrót z Auth z `#error_code=otp_expired` | adres szedł do routera — ekran logowania bez wyjaśnienia | ten sam ekran „Link wygasł”, adres wyczyszczony |
| „Link wygasł” — wersja pełna (po podłączeniu) | — | „Link w e-mailu działa 24 h. Twoje zaproszenie jest ważne do 21.10, 12:00.” · „Wyślij nowy link na …” · „Nowy link przychodzi w ciągu minuty. Problem? Zadzwoń do Operacji HHL.” · „Wróć do logowania” |
| „Link wygasł” — zaproszenie też wygasło | — | „Twoje zaproszenie też wygasło. Poproś Operacje HHL o nowe.” · „Wróć do logowania” |
| „Link wygasł” — bez informacji o linku (produkcja do podłączenia) | — | „Poproś o nowy link: wpisz swój adres w »Nie pamiętam hasła«.” · „Nie pamiętam hasła” · „Wróć do logowania” |

**Produkcja przed podłączeniem:**
- „Zamknij” działa od razu; zamknięcie pamiętane w tej przeglądarce. Zapis „dla osoby” (inne urządzenia) i pojawienie się w ciągu minuty — D-20261016-0530-01 pkt 1–2.
- Tekst „Nie pamiętam hasła” i ekran „Link wygasł” w wersji ogólnej działają od razu.
- Wersja pełna z „Wyślij nowy link na …” — po podłączeniu (pkt 3–4).

**Demo:** komunikat przykładowy przy `&komunikat-hhl=1` w adresie. Ekranów logowania w demo nie ma (tylko build z logowaniem).

**Sprawdzone:**
- e2e blok P10b-a — 4/4:
  - komputer: treść, data końca, „Zamknij”; po zamknięciu i przeładowaniu nie wraca;
  - telefon 360 / 390 / 430: „Komunikat HHL:” i „✕” 44 × 44 px, nic uciętego, tekst ≥ 12 px;
- build z logowaniem (adres Supabase fałszywy, bez sieci; skrypt `.coord-out/tools/p10b-shot.mjs`):
  - „Nie pamiętam hasła” przy odpowiedzi „TOWER_NO_INVITE” → ten sam tekst co przy wysłaniu;
  - `#error=access_denied&error_code=otp_expired` → „Link wygasł”, adres wyczyszczony;
  - „Nie pamiętam hasła” z ekranu → formularz resetu;
- wersja pełna i „zaproszenie też wygasło”: render ekranu z przykładowymi danymi (`p10b-ssr.mjs`);
- unit `p10b-look` (12) i `auth-password` (A3: klucz tekstu zmieniony na `p10b_reset_sent`); cały zestaw unit zielony;
- tekst przykładowy komunikatu nie trafia do buildu produkcyjnego.

**Zrzuty:**
- `komunikat-1440.webp`, `komunikat-390.webp`;
- `nie-pamietam-1440.webp`, `nie-pamietam-390.webp`;
- `link-wygasl-1440.webp`, `link-wygasl-390.webp` — wersja ogólna;
- `link-wygasl-zaproszenie-1440.webp`, `link-wygasl-zaproszenie-390.webp` — wersja pełna;
- `link-wygasl-wygaslo-390.webp`.
