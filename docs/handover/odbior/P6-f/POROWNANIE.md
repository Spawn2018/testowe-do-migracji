# wyglad/P6-f — Dla mnie › Ten telefon / komputer: aplikacja zainstalowana i wiadomości z Czatu w powiadomieniu (16.10.2026, 03:50)

Podstawa:
- polecenie właściciela 16.10.2026, 02:57 („po kliknięciu w powiadomienie ma kierować do zainstalowanej aplikacji, a nie do Chrome”; przyciski „Oznacz jako odczytane” i „Odpowiedz”);
- 03:06 (rozmowy HHL ↔ SCX nigdy do KSH);
- dopiski D-20261016-0310-01 Cz13, Cz19 pkt 5, Cz23 pkt 4–5 i D-20261016-0315-01 Cz32.

PR złożony na #237 (`wyglad/push-w42` — to samo zdanie reguły na tym ekranie). Wygląd, teksty i nawigacja (F8). Bez zapisów.

| Element | Było | Jest |
|---|---|---|
| Reguła na górze | „Na telefon trafia tylko pilna sprawa »Do zrobienia«. …” | „Na telefon trafiają pilne sprawy »Do zrobienia« i wiadomości z Czatu. …” (Cz13) |
| Aplikacja na tym telefonie | — | Stan: „Działasz w zainstalowanej aplikacji…” / „Watch Tower nie jest zainstalowany — dotknięcie powiadomienia otworzy przeglądarkę” + **„Zainstaluj aplikację”** (gdy przeglądarka proponuje instalację) / „Zainstalowano…” / „Otwierasz Watch Tower w przeglądarce. Jeśli aplikacja jest zainstalowana, uruchamiaj ją z ikony…” |
| Samsung | wskazówki o powiadomieniach | + „instaluj z Chrome, nie z Samsung Internet — skrót z innej przeglądarki otwiera powiadomienia w Chrome” (Cz19 pkt 5 — przyczyna z S24) |
| Wiadomości z Czatu w powiadomieniu | — | 6 zdań: tytuł (transport, kto) i treść; „Oznacz jako odczytane” bez otwierania aplikacji; „Odpowiedz” wpisywane w powiadomieniu, do tych samych odbiorców; iPhone bez przycisków; ekran blokady („Ukryj treść…”); „tylko HHL i SCX” nigdy do KSH |

**Technicznie:** `src/lib/installPrompt.ts`:
- łapie `beforeinstallprompt` i `appinstalled` przy starcie (`main.tsx`);
- tryb aplikacji rozpoznaje z `display-mode` (standalone / fullscreen / minimal-ui) i `navigator.standalone` (iPhone).

**Sprawdzone:**
- e2e blok P6-f — 3/3: komputer HHL; telefon SCX i KSH — 0 w bramie E8 przy 360, 390, 768 px;
- regresja P3-c;
- unit `p6f-install` — 2; całość unit 147 plików;
- strażnik I-0: przykład bez kodu transportu w tekście;
- pierwsze wczytanie 396,8 kB gzip.

**Zrzuty:**
- `ten-telefon-HHL-1440.webp`
- `ten-telefon-SCX-390.webp`
