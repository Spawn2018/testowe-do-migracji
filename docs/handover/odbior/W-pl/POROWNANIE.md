# wyglad/W-pl — panel tylko po polsku (8A), audyt N20 w aplikacji (17.10.2026)

Podstawa:
- decyzja właściciela 17.10.2026, 07:20 — **8A** (bez EN i SV; aplikacja kierowcy zostaje w 3 językach);
- D-20261017-0730-01 §1 pkt 8 i B9;
- audyt 17.10, sekcja 5, N20 (strażnik tekstów PL).

Dopisek: D-20261017-0915-01. Tylko teksty i obliczenia widoku (F8). Bez bazy — tabele tłumaczeń usuwa wykonawca w B9.

| Miejsce | Było | Jest |
|---|---|---|
| Słowniki aplikacji | PL, EN i SV w 11 modułach (`messages`, `b5`, `b6`, `decisions`, `i2`, `ui6`, `p3c`, `d19Extra`, `etap4`, `risks`, `demoOnly`) | tylko PL. EN i SV zostają w `src/i18n/driver.ts` — 37 kluczy aplikacji kierowcy (etapy, przyciski, instrukcja, udostępnianie pozycji) |
| Brak klucza w EN/SV | tekst klucza albo PL bez polskiej odmiany | tekst PL z polską odmianą liczebników (`t`, `tp`) |
| Język panelu | brał `locale` z konta (`user_preferences`) i z przeglądarki | zawsze „pl”: zapisany „en” lub „sv” z konta albo przeglądarki nie przełącza panelu |
| Dzwonek, „Najpilniejsze”, „Kto co dostaje”, zezwolenia, Stan systemu | gałęzie z angielskim i szwedzkim („15 min ago”, „15 min sedan”, kropka dziesiętna w EN) | tylko polski („15 min temu”, „3 godz. temu”, przecinek) |
| `tests/d19-i18n.spec.ts`, `test:d19` | test EN/SV, wyłączony od 8322d02 (brak przełącznika języka) | usunięty razem z plikiem wzorca |
| Pierwsze wczytanie | 371,7 kB gzip | **317,6 kB gzip** (budżet 400 kB) |

**Wygląd bez zmian.** Panel był już tylko po polsku — przełącznik języka zniknął w 8322d02. Dlatego bez obrazów „przed / po”. Aplikacji kierowcy nie da się pokazać w demo: link demo jest nieaktywny (DRV-CLOSE, „Link nieaktywny”). Język kierowcy sprawdza test.

**Testy:**
- `tests/w-pl.test.ts` (5) — EN/SV mają tylko klucze kierowcy; komplet kluczy kierowcy bez polskich znaków; reszta po polsku z odmianą; panel zostaje „pl” po `applyUserPrefs({ locale: 'en' })` i `setLocale('sv')`; dzwonek bez EN/SV;
- zmienione pod regułę „tylko PL”: `risk-keys`, `ferry-status`, `order-numbers`, `pdf-export`, `pl-plural`, `session-year`, `store-persist`, `aud02-dzwonek`, `audyt-af`.

Unit: 1517 zielonych. Strażnik pakietu demo („sms:”, „mailto:”, „supabase”) — 0.

**Nie robione w tym PR (część wykonawcy):**
- B9 — tabele `translation_queue`, `translation_memory`, `deepl_usage`, funkcja `deepl_usage_view`, crony i wywołania DeepL;
- kolumna języka w `user_preferences`;
- N20 po stronie serwera — `sms_render` z 3 języków do 1 (P8).
