# FALA 1 PRZYJĘTA — TRZY DOMKNIĘCIA I GO NA FALĘ 2

`720/720 bez regeneracji wzorca` to najmocniejszy wynik, jaki mogłeś
przynieść. Usunięcie Tailwinda nie ruszyło układu — preflight nie robił
w tej aplikacji roboty, na którą ktoś polegał. Tego nie dało się
przewidzieć z zewnątrz, można to było tylko sprawdzić.

Inwentarz przed D1 też był właściwą decyzją: 26 klas użytkowych w 42 miejscach,
w dwóch komponentach. Mając to na papierze, usunięcie było mechaniczne.

Trzy rzeczy do domknięcia. Wszystkie krótkie, żadna nie blokuje startu fali 2 —
poza pierwszą, która blokuje jej **zamknięcie**.

---

# 1. Kolizja numeracji w `NAPRAWY.md` — załatw to teraz

Sam to wychwyciłeś: *stary JSONLogic w NAPRAWY = D9-legacy*. To znaczy,
że w `NAPRAWY.md` żyją **dwa systemy numeracji D**, które się nakładają.
W fali 1 trafiło na jedną kolizję. Fala 2 odwołuje się do D3, D4, D5, D7,
D8, D20 i D22 — szansa na kolejną jest wysoka, a pomyłka tam kosztuje
więcej niż cienie.

Uporządkuj raz:

- pozycje z mojej listy zostają **D1–D26**
- wszystko, co było w `NAPRAWY.md` wcześniej, dostaje przedrostek **`L`** —
  `L9` zamiast `D9-legacy`
- na górze pliku tabela przekładu: stary numer, nowy numer, czy pokrywa się
  z którąś pozycją z D1–D26

Jeżeli któraś pozycja `L` opisuje to samo co pozycja `D` — połącz je i zaznacz.
Jeżeli opisuje coś, czego w D nie ma — **zostaje jako otwarta**, nie znika.

# 2. D9 jest zamknięte częściowo, nie w całości

Napisałeś: *soft shadow → none (docpreview, wf-creator, sched-col-menu)*,
*inline radius 3 → 2*, *część `!important` wycięta*.

Z zewnętrznej inspekcji wdrożenia liczyłem: **10 użyć `box-shadow`,
5 promieni powyżej 2 px, 1 `!important`**. Trzy nazwane miejsca cieni
to nie jest dziesięć. „Część" to nie jest liczba.

Nie zgaduj i nie licz ręcznie — w paczce, którą dostałeś, jest
**`.stylelintrc.json`**, który odpowiada na to mechanicznie. Podepnij go
i uruchom:

```
npx stylelint "src/**/*.css" "src/**/*.{ts,tsx}"
```

Plik `app/tower.css` jest z tych reguł wyłączony, bo to on definiuje tokeny.
Reszta ma przechodzić. Podaj liczby: ile cieni, ile promieni, ile `!important`
zostało i **dlaczego** — jeżeli któryś jest uzasadniony, zapisz uzasadnienie,
a nie wyłączaj reguły komentarzem.

To samo narzędzie pilnuje potem, żeby nie wróciły. Bez niego D9 będzie
trzeba robić jeszcze raz za dwa miesiące.

# 3. D2 — pokaż dowód, nie deklarację

Kryterium akceptacji brzmiało: zero ciągów `--tw-` i zero odwołań do czcionki
systemowej w **zbudowanym** arkuszu. Dwie linie:

```
grep -c -- '--tw-' dist/assets/*.css
grep -oE 'font-family:[^;}]*' dist/assets/*.css | sort -u
```

Pierwsza ma dać zero. Druga wyłącznie Barlow i Barlow Condensed
z jawnym łańcuchem zastępczym.

---

# DO ZAŁATWIENIA PO STRONIE WŁAŚCICIELA

Hak `pre-push` to dobre obejście i uruchamia `test:unit` oraz Playwrighta.
Ale **nie uruchamia pełnych 720 ujęć**, a plik przepływu z `lfs: true`
nadal nie jest wypchnięty przez brak uprawnienia `workflow`.

Sebastian: albo włączone rozliczenia Actions, albo token z zakresem
`workflow`, albo wypchnięcie `unit.yml` z Twojego konta. Do tego czasu
pełny test wizualny chodzi wyłącznie ręcznie na końcu fali — co dla fali 2
wystarczy, ale nie jest stanem docelowym.

---

# GO NA FALĘ 2 — PRAWDA DANYCH

Tu liczby na ekranie się zmienią i tak ma być. Test będzie czerwony
w trakcie fali i to jest poprawne.

## Kolejność

```
D7   odpowiedź, bez kodu        jaki wzór faktycznie liczy dopłatę
D22  wersjonowanie magazynu     bezpieczeństwo danych przed logiką
D5   KPI wobec korytarza        jedna funkcja, mały zasięg
D4   jedno źródło prawdy rejsu  średni zasięg
D3   endpoint Trafikverket      decyzja plus wykonanie
D20  dopasowanie trójstronne    największa nowa logika
D8   strefy czasowe             na końcu, bo dotyka wszystkich dat
```

D8 celowo ostatnie. Zmieni najwięcej ujęć ze wszystkich napraw w tej fali —
gdyby szło wcześniej, każda następna różnica tonęłaby w jego szumie.

## Szacunek zmian we wzorcu — do weryfikacji, nie do wiary

Policzyłem, ile ujęć z 720 **powinno** się zmienić po każdej naprawie.
Jeżeli wyjdzie Ci znacznie więcej — naprawa ruszyła coś, czego nie miała.
Jeżeli znacznie mniej — prawdopodobnie nie zadziałała.

| Pozycja | Gdzie widać | Szacunek |
|---|---|---|
| D22 | nigdzie, o ile migracja zachowa stan | **0** |
| D5 | kokpit | ~90 |
| D4 | kokpit i ryzyka | ~180 |
| D3 | ryzyka | ~90 |
| D20 | faktury, role HHL i SCX | ~60 |
| D8 | harmonogram, mapa, szuflada, kokpit | **400+** |

## D22 — jedna pułapka, którą trzeba ominąć świadomie

Wersjonowanie magazynu oznacza podbicie numeru. Jeżeli migracja **wyczyści
stan zamiast go przenieść**, przebieg wzorcowy zobaczy pustą aplikację
we wszystkich 720 ujęciach i uznasz to za katastrofę, a to będzie tylko
brak danych startowych.

Dwa warunki: migracja przenosi stan, a nie kasuje; skrypt `baseline.mjs`
startuje z jawnie zaszczepionego stanu, nie z tego, co akurat leży
w przeglądarce. Sprawdź drugi warunek **zanim** ruszysz D22 — jeżeli skrypt
polega na tym, co zostało po poprzednim przebiegu, popraw to najpierw.

## D7 — odpowiedź przed naprawą, przypominam

Plik, linia, postać wzoru. Bez tego nie naprawiaj. Jeżeli okaże się, że wzór
jest inny, niż zakładam, zmienia się treść naprawy, nie tylko jej wykonanie.

## D3 — decyzja przed wykonaniem

Wdrożyć prawdziwy endpoint czy widocznie oznaczyć panel jako dane
demonstracyjne. Napisz, co wybrałeś i dlaczego, **zanim** to zrobisz.
Przy braku klucza do Trafikverket druga droga jest uczciwsza.

## Brama fali 2

- `test:unit` i Playwright zielone, z liczbami
- pełny przebieg 720 **jednym skryptem**, bez dogrywek
- raport: **ile ujęć się zmieniło i dlaczego**, grupami, jedno zdanie na grupę,
  zestawione z szacunkiem z tabeli wyżej
- commit wzorca, tag `baseline-fala-2-<data>`
- `NAPRAWY.md` z uporządkowaną numeracją i liczbami z testów

Więcej zmienionych ujęć, niż potrafisz uzasadnić — **zatrzymanie, nie
regeneracja**.

Potem STOP przed falą 3.
