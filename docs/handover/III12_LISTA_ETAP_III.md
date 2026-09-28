# III-12 — otwarte pozycje Etapu III: co można robić bez właściciela (28.09.2026)

Źródło: PLAN.md „ETAP III — po pilotażu”, SCOPE.md (statusy), AUDYT_ZAKRESU.md (D4–D12).

## Zrobione 28.09 (bez udziału właściciela)
| Pozycja | Stan |
|---|---|
| III-10 EU Weekly Oil Bulletin | gotowe, wyłączone przełącznikiem do D-2 (0092, `fuel-wob`) |
| III-11 pogoda morska | raport `RAPORT_POGODA_MORSKA.md` (propozycja: FMI + DMI, CC BY 4.0) |
| Audyt dostępności (SCOPE 11.5) | wykonany — `RAPORT_DOSTEPNOSC.md`; nazwy pól i klawiatura naprawione; kontrast → D-27 |

## Niezależne od właściciela — można robić dalej
| Pozycja | Co zostało | Uwagi |
|---|---|---|
| Silnik Workflows (SCOPE 9.1–9.4) | **9.1–9.4 DONE 28.09** (0094/0095, POSTEP 9.1–9.4 i 9.4): widok „Automatyzacje” na danych z bazy dla HHL_ADMIN; reguły startowe wyłączone, bez zadania cyklicznego (decyzja właściciela); 0096: wyzwalacze „status promu” i „codziennie o 06:00” — włączenie z D-29 | największa pozycja; akcje wysyłające wiadomości zewnętrzne i tak blokuje `EXTERNAL_MESSAGING` do R-2 |
| Odsiewanie duplikatów powiadomień (9.8, I-23, audyt D12) | **DONE 28.09** — POSTEP 9.8 | czysto techniczne |
| Eksport PDF (10.8, I-24) | **DONE 28.09** — POSTEP 10.8 | czysto techniczne |
| Wersjonowanie i archiwum pliku harmonogramu (3.6, audyt D4) | **DONE 28.09** — migracja 0093 (historia wersji tylko do dopisywania), POSTEP 3.6 | techniczne |
| Wymuszenie w bazie: import tylko KSH, eksport tylko HHL (16.3, audyt D11) | **DONE 28.09** — reguła zastąpiona przez I-18 (import HHL, potwierdzanie dat KSH); sprawdzone testem `tests/db/import.sh` 60/60, eksport per rola (POSTEP 16.3) | techniczne (bezpieczeństwo) |
| Retencja `files/` w R2 | **CZEKA na logowanie do Cloudflare** (wrangler wylogowany; bez logowania z naszej strony — polecenie 28.09); pliki `docs/handover/r2/*.json` gotowe | bez nowych płatnych zasobów — tylko na istniejącym koncie |
| III-13: 36 ujęć wzorca (Harmonogram, Dokumenty) | **DONE 28.09** — 3 grupy, regresji 0 (`G4_WZORZEC.md`); brama wizualna 840/840 zielona na `42a72c7` (III-2 0.3/11.4 DONE) | pozycja robocza |
| Przekazanie Cursorowi | **DONE 28.09** — `PRZEKAZANIE_CURSOR.md` + `.cursor/rules/tower.mdc` | dokumentacja |
| Polisy z przypomnieniem o wygaśnięciu (6.6, audyt C4) | **część bazowa DONE 28.09** — 0097, `tests/db/insurance.sh` 33/33 | harmonogram, formularz polisy i notka w Dokumentach → **D-30** |
| Dostępność — reszta | `list` w kolejce wyjątków (12), mylący kursor (362) | poprawki bez zmiany wyglądu — tylko jeśli D-27 dopuści |

## Zależne od właściciela / osób trzecich
| Pozycja | Czeka na |
|---|---|
| III-1 kalibracja ETA | 5 prawdziwych transportów (dane) |
| Kontrast i kursor (11.5) | **D-27** (nowa) |
| 6.6 włączenie przypomnień o polisie | **D-30** (zadanie cykliczne, formularz, notka) |
| III-10 włączenie | D-2 (wybór indeksu z przewoźnikiem) |
| III-11 wdrożenie pogody | decyzja, czy wdrażać (propozycja FMI + DMI) |
| III-9 / 10.4 widok placu budowy | D-24 (zamknięte przez SCOPE 16.1 — nie robić) |
| Integracja SharePoint | zgoda IT KSH |
| SMS 6, 7, 10, 11 | D-4 (telefon i SIM), D-19 zakres pilotażu (1–5, 8, 9) |
| Kalendarz (9.10), e-CMR (6.9), ślad węglowy (10.9) | odłożone po 1.0 (dziennik odłożeń) — wznowienie decyzją właściciela |
