---
name: tower-przekazanie
description: Przekazuje pracę nad Watch Tower innej sesji lub innemu wykonawcy bez utraty stanu i bez zatrzymania kolejki. Użyj przy końcu limitu, zmianie narzędzia lub przerwie.
---

# tower-przekazanie (wersja 08.10.2026)

Na ok. **10% limitu**, nie na 0%:
1. Bieżąca pozycja: dokończ albo opisz w `POSTEP.md`, gdzie przerwałeś (gałąź, paczka, pozycja).
2. `git status` czysty, commit, push gałęzi; HEAD lokalny = zdalny.
3. Migracje: lokalnie = produkcja; migracje gałęzi niescalone — wypisane.
4. Pakiet przekazania: HEAD, paczka, ostatnia migracja, wyniki testów, dopiski niewłączone, gdzie leżą poświadczenia (bez wartości), znane pułapki.
5. Nowa sesja: raport stanu (HEAD, migracje lokalnie = produkcja, otwarta paczka) i **od razu dalej**; koordynator sprawdza produkcję równolegle.
6. Zmiana poświadczeń przy przekazaniu (hasło bazy) — nowe tylko u nowego wykonawcy.
