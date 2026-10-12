# Makiety HTML etapów audytu (źródła)

- Każdy folder `E<nr>/` zawiera źródło makiety etapu (to samo, co obraz `../raport/img/e<nr>-after.webp`) i lokalne obrazy, których używa.
- Czcionki ładowane z Google Fonts (Barlow, Barlow Condensed) — w aplikacji czcionki są w `public/fonts` (bez Google Fonts).
- **Poprawione 08.10.2026:** separator w nazwie transportu „●” → „·” (decyzja 12:14) i zakładka „Ustalenia” → „Czat” (E17). Pozostałe „●” w E41 i E42 to opis albo znak w zdaniu, nie nazwa transportu.
- **Nadal może się zdarzyć** treść sprzed decyzji. Wtedy obowiązują `../DECYZJE_08_10.md` i `../ROZSTRZYGNIECIA_LUK.md`, w szczególności:
  - G-01c: bez CMR z załadunku; „Firma” = jedno zezwolenie firmowe;
  - L3 i G-11: nazwy ekranów Opcji;
  - G-12: „Twoja stawka”;
  - L39: bez e-maila w komunikacie HHL;
  - L49: bez wyboru języka przy odbiorcach SMS.
- Teksty oznaczone „Przykład” i dane w makietach (kody, numery, nazwiska, telefony) to przykłady — nie przenosić do produkcji (G-09).
- Nazwa folderu = numer etapu. E36 nie ma makiety (zamknięty w E9). E2, E13, E14 i E44 nie mają osobnej makiety — obowiązuje treść etapu i wygląd ekranu, na którym element się znajduje (np. panel dróg PL na ekranie E7, dzwonek w pasku E37 i na telefonie E8).
