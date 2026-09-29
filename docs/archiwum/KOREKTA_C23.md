> **ARCHIWUM — nie wykonywać. Zastąpione 29.09.2026, patrz docs/handover/wzorzec/**

# C2.3 — ZATRZYMAJ PRZEBIEG I POPRAW SELEKTOR

Przyjęte i zamknięte: 0.5a (drzewa równe `3c6c2af0…`, baseline bez dokumentów
przekazania), 0.5b (`0ad97ba`, +326 ścieżek), C1, C3, C5, C2.4, pliki 01–09.
Dobra robota, szczególnie C5 — kanon rozstrzygnięty i potwierdzony trzema
cechami w aplikacji.

Jedna rzecz do poprawienia natychmiast.

---

## Nie dograj failujących. Zabij przebieg i uruchom od nowa.

Napisałeś: „domknę skrypt po przebiegu albo poprawię regex i dogrywam
failujące". **Nie rób ani jednego, ani drugiego.**

Wzorzec złożony z ujęć zrobionych dwiema wersjami skryptu nie jest wzorcem.
Za trzy tygodnie test regresji pokaże różnicę i nikt nie będzie wiedział,
czy to dryf aplikacji, czy pozostałość po dwóch przebiegach. Baseline musi
pochodzić z jednego uruchomienia jednej wersji skryptu.

Zabij przebieg, popraw, uruchom całość od zera.

## Nie poprawiaj wyrażenia regularnego. Zmień sposób nawigacji.

`nav not found: Kokpit|Dashboard|Översikt` to nie jest usterka wyrażenia.
To jest objaw tego, że **skrypt nawiguje po etykietach, które zmieniają się
z językiem**. Poprawisz regex dla KSH+EN, a wywali się na SCX+SV albo na
pozycji, której jeszcze nie testowałeś. Przy 720 ujęciach będziesz to gonił
w nieskończoność.

Nawiguj po **stabilnym atrybucie, nie po tekście**:

```js
await page.click('[data-view="dash"]');
```

Jeżeli komponenty nawigacji nie mają takiego atrybutu — dodaj go.
To jedyna zmiana w kodzie aplikacji, na jaką pozwalam przed etapem D,
bo jest narzędziem testowym, a nie naprawą: `data-view` na przycisku
nawigacji i `data-role` na przełączniku roli. Zero wpływu na wygląd,
zero wpływu na zachowanie.

Gdyby z jakiegoś powodu trzeba było zostać przy tekście — buduj listę
etykiet **ze słownika i18n**, nie z ręcznie pisanego wyrażenia:

```js
import pl from '../src/i18n/pl.json';
import en from '../src/i18n/en.json';
import sv from '../src/i18n/sv.json';
const etykieta = { pl, en, sv }[jezyk]['nav_dash'];
```

Ręczna lista rozjedzie się ze słownikiem przy pierwszej zmianie nazwy.

## Przy okazji: angielska etykieta to prawdopodobnie „Overview"

W słowniku makiety `nav_dash` ma wartości: `Kokpit` / `Overview` / `Översikt`.
Szukałeś „Dashboard", którego tam nie ma. Sprawdź, czy aplikacja trzyma
tę samą wartość — jeżeli tak, to wyjaśnia dokładnie ten jeden błąd.
**Sprawdź w słowniku, nie zakładaj.**

---

# ETAP D — LISTA ROZSZERZONA O ZNALEZISKA Z ETAPU C

Nie zaczynaj tego teraz. Zapisz do `NAPRAWY.md` jako zakres, żeby nie zginęło.
Poprzednie D1–D18 obowiązują bez zmian, dochodzi sześć.

**D19. Sto cztery napisy wpisane na stałe w komponentach.**
Z Twojego C3. To jest najpoważniejsze znalezisko całego etapu — oznacza,
że **wersja szwedzka jest w dużej części pozorna**, a to jest wersja,
której użyje Scandinavian Express. Przy okazji: te sto cztery napisy nie
zmieniają się między językami, więc zrzuty PL, EN i SV będą w tych miejscach
identyczne i test regresji niczego tam nie wykryje. Każdy napis do słownika,
w trzech językach.

**D20. Różnice na fakturach wpisane na stałe.**
Z Twojego C1. Skoro rozbieżność 1 840 PLN jest zaszyta, to **dopasowanie
trójstronne jest fasadą** — moduł pokazuje wynik, którego nie policzył.
To jest funkcja, która ma wyłapywać błędy w rozliczeniach z przewoźnikiem.
Ma liczyć naprawdę: transporty zaznaczone wobec zrealizowanych wobec kwoty
z cennika, z rozbiciem różnic linia po linii.

**D21. Usuń martwy MapLibre.**
Z Twojego C1 i z przekazania QA. Leży w drzewie obok żywego Leaflet,
powiększa paczkę i myli przy utrzymaniu. Powiązane z D15.

**D22. Wersjonowanie i migracja magazynu trwałego.**
Z Twojego pliku 07. Klucz v6 bez wersjonowania schematu. Na produkcji
użytkownik po aktualizacji czyta stan w starym kształcie i nie wie o tym.
Numer wersji w magazynie, sprawdzenie przy starcie, migracja albo czyste
wyczyszczenie z komunikatem.

**D23. Testy regresji importu harmonogramu.**
Z Twojego pliku 07: naprawione pod P9, bez testów automatycznych.
To jest funkcja, która przy awarii **kasuje harmonogram klienta**.
Minimum pięć wariantów pliku: poprawny, pusty, z inną kolejnością kolumn,
ze zmienionymi nagłówkami, z wierszami niespełniającymi walidacji.
Każdy sprawdza, że istniejące dane przetrwały.

**D24. Pełny przebieg czternastu prób.**
Z Twojego pliku 07: po P9 wykonano tylko sprawdzenia skupione.
Do wykonania na aktualnej paczce, z sumą kontrolną paczki w raporcie.

---

# 47 NIEUŻYWANYCH KLUCZY

Nie usuwaj ich teraz. Część może należeć do funkcji jeszcze niezbudowanych —
moduły M1–M12 z `UX_MAP.md` albo ścieżki E1–E4. Wypisz je w `C3_JEZYKI.md`
z podziałem: kandydaci do usunięcia i kandydaci na klucze przyszłych funkcji.
Rozstrzygnięcie po zestawieniu z mapą modułów w etapie D.

---

# PO POPRAWCE

Uruchom pełne 720 ujęć jednym przebiegiem. W raporcie podaj: liczbę ujęć,
liczbę nieudanych, wersję skryptu i sumę kontrolną paczki aplikacji.
Potem **STOP** przed etapem D.
