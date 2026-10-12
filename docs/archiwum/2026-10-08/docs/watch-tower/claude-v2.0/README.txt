TOWER — makieta control tower (projekt KSH / Stegra Boden)
==========================================================

Artefakt składa się z JEDNEGO pliku. Cały HTML, CSS, JavaScript
i dane demonstracyjne (50 transportów, 13 ryzyk, 12 stref, 7 reguł)
są w środku. Nie ma kroku budowania ani zależności.

  index.html           plik dokładnie taki, jak opublikowany pod
                       https://claude.ai/artifact/CmYw3VeFSKZVME9PGttjD9
  tower-makieta.html   ta sama zawartość pod czytelniejszą nazwą

Otwierasz dwuklikiem w dowolnej przeglądarce. Z sieci pobiera tylko
krój Barlow z Google Fonts; bez internetu układ zadziała na czcionce
systemowej.

CO POKAZAĆ
  1. Przełącznik roli w nagłówku — kolumny z pieniędzmi znikają
     i pojawiają się (Shift+R przełącza z klawiatury)
  2. Pasek korytarza — klik na etap filtruje wszystko; klawisze 1-9
  3. Rola Scandinavian Express → "Moje zadania"
  4. Harmonogram → dowolny wiersz → zakładka "Przebieg"
  5. Ryzyka → panel promowy z alternatywami
  6. Faktury → tydzień 38, rozbieżność 1 840 PLN
  7. Klawisz ? — lista skrótów

CZEGO NIE OBIECYWAĆ
  Wszystkie dane są wygenerowane. Pozycje pojazdów są interpolowane
  po trasie, nie pochodzą z telematyki. Mapa to schemat korytarza,
  nie warstwa kartograficzna. Progi falowania są przykładowe
  i konfigurowalne — system nie przewiduje decyzji armatora.

RESZTA PROJEKTU
  Migracje SQL, parser harmonogramu, silnik cenowy, adapter telematyki,
  system projektowy i prompty do Cursora są w archiwum
  TOWER-stegra-boden.zip.
