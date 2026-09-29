---
name: tower-przekazanie
description: Przekazuje pracę nad TOWER innemu wykonawcy bez utraty stanu. Użyj przy końcu limitu, zmianie narzędzia lub przerwie dłuższej niż dzień.
---

# tower-przekazanie

Na ok. **10% limitu**, nie na 0%:
1. Bieżąca pozycja: dokończ albo opisz w POSTEP.md dokładnie, gdzie przerwałeś
2. `git status` czysty, commit, push; HEAD lokalny = zdalny
3. Migracje: lokalnie = produkcja
4. Pakiet przekazania: HEAD, ostatnia migracja, testy, pozycja w toku, gdzie leżą
   poświadczenia (bez wartości), dokładne polecenia testów i wdrożeń, znane pułapki
5. Nowy wykonawca: najpierw raport stanu **bez zmian w kodzie**; koordynator
   sprawdza produkcję; dopiero potem kolejka
6. Zmiana poświadczeń przy przekazaniu (hasło bazy) — nowe tylko u nowego wykonawcy
