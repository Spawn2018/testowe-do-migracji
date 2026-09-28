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
| Silnik Workflows (SCOPE 9.1–9.4) | reguły w bazie (warunek → akcja), wykonanie przez zadanie; dziś moduł ukryty w produkcji | największa pozycja; akcje wysyłające wiadomości zewnętrzne i tak blokuje `EXTERNAL_MESSAGING` do R-2 |
| Odsiewanie duplikatów powiadomień (9.8, I-23, audyt D12) | **DONE 28.09** — POSTEP 9.8 | czysto techniczne |
| Eksport PDF (10.8, I-24) | **DONE 28.09** — POSTEP 10.8 | czysto techniczne |
| Wersjonowanie i archiwum pliku harmonogramu (3.6, audyt D4) | **DONE 28.09** — migracja 0093 (historia wersji tylko do dopisywania), POSTEP 3.6 | techniczne |
| Wymuszenie w bazie: import tylko KSH, eksport tylko HHL (16.3, audyt D11) | **DONE 28.09** — reguła zastąpiona przez I-18 (import HHL, potwierdzanie dat KSH); sprawdzone testem `tests/db/import.sh` 60/60, eksport per rola (POSTEP 16.3) | techniczne (bezpieczeństwo) |
| Retencja `files/` w R2 | zasady jak dla dokumentów | bez nowych płatnych zasobów — tylko na istniejącym koncie |
| III-13: 36 ujęć wzorca (Harmonogram, Dokumenty) | znaleźć commity, zaklasyfikować (zamierzone → `G4_WZORZEC.md`, regresja → naprawa), odświeżyć | pozycja robocza, nie decyzja właściciela |
| Przekazanie Cursorowi | pakiet dokumentów przekazania | dokumentacja |
| Dostępność — reszta | `list` w kolejce wyjątków (12), mylący kursor (362) | poprawki bez zmiany wyglądu — tylko jeśli D-27 dopuści |

## Zależne od właściciela / osób trzecich
| Pozycja | Czeka na |
|---|---|
| III-1 kalibracja ETA | 5 prawdziwych transportów (dane) |
| Kontrast i kursor (11.5) | **D-27** (nowa) |
| III-10 włączenie | D-2 (wybór indeksu z przewoźnikiem) |
| III-11 wdrożenie pogody | decyzja, czy wdrażać (propozycja FMI + DMI) |
| III-9 / 10.4 widok placu budowy | D-24 (zamknięte przez SCOPE 16.1 — nie robić) |
| Integracja SharePoint | zgoda IT KSH |
| SMS 6, 7, 10, 11 | D-4 (telefon i SIM), D-19 zakres pilotażu (1–5, 8, 9) |
| Kalendarz (9.10), e-CMR (6.9), ślad węglowy (10.9) | odłożone po 1.0 (dziennik odłożeń) — wznowienie decyzją właściciela |
