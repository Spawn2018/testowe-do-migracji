---
name: tower-dopisek-do-planu
description: Wprowadza każdą zmianę, poprawkę albo nowe polecenie do PLAN.md jako dopisek, tak żeby plan był wykonywany dalej, a wykonawca nie mógł źle zrozumieć. Użyj za każdym razem, gdy zmienia się zakres pracy.
---

# tower-dopisek-do-planu (wersja 08.10.2026)

Plik: `docs/handover/dopiski/D-RRRRMMDD-GGMM-<nr>.md`
```
DOPISEK D-RRRRMMDD-GGMM-<nr>
Autor: właściciel | koordynator | wykonawca (słowa właściciela dosłownie, z godziną)
Rodzaj: BLOKER | DO PACZKI P<n> | NOWA POZYCJA | PO 1.0 (tylko gdy przeniesienie zdecydował właściciel — `PLAN.md` §6 część 3)
Powód: …
Zmiana: co, gdzie, dosłowne teksty — PEŁNY warunek, bez skrótów
Przykład liczbowy: wejście → oczekiwany wynik
Test odbioru: …
Czas: … h
Zastępuje: (jeśli zmienia decyzję lub rozstrzygnięcie — numer i brzmienie)
```
Zasady:
- **BLOKER** tylko przy: produkcja nie działa, ryzyko utraty danych, luka bezpieczeństwa, wysyłka do złych odbiorców, zła kwota na fakturze. Wszystko inne czeka na swoją paczkę.
- Wykonawca włącza dopisek po zakończeniu bieżącego commita: wpis w `PLAN.md` §4 (pozycja `D<nr>` w paczce) albo §6, wiersz w §8, commit `plan: dopisek …`.
- Poprawka do zamkniętej paczki = pozycja „Poprawki P<n>” na początku następnej paczki z kolejności (limit 1 h); większa — osobna pozycja ustawiona przez koordynatora.
- Reguła warunkowa zawsze w całości („gdy jest okno → od końca okna; gdy okna nie ma → od końca dnia”) — skrót zepsuł działający kod (I-25).
- Niczego nie kasujesz; zmiana = nowy wpis ze wskazaniem, co zastępuje.
- Pytanie rozstrzygnięte w `ROZSTRZYGNIECIA_LUK.md` nie jest dopiskiem.
