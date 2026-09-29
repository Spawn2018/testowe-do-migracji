> **ARCHIWUM — nie wykonywać. Zastąpione 29.09.2026, patrz docs/handover/wzorzec/**

# FALA 0 PRZYJĘTA — WARUNKI PRZED FALĄ 1

D23 i D24 zamknięte, repozytorium zsynchronizowane, drzewa równe
`d305c245…`, LFS na miejscu, 720/720, 14/14 SHIP. Dobra robota —
szczególnie za to, że nie scaliłeś PR na czerwonym CI bez przeczytania
logu i nie uznałeś „padło" za wynik testów.

Dwie rzeczy do załatwienia, zanim ruszysz z D1. Obie krótkie.

---

# 1. CI nie działa, więc brama fali 1 jest pozorna

Napisałeś: *CI było czerwone tylko przez billing Actions (runner się nie
uruchomił)*. To znaczy, że **`unit.yml` nie chodzi**. Testy D23 są
w repozytorium, ale nikt ich nie uruchamia przy zmianach.

Cała fala 1 opiera się na jednym zdaniu: *test musi zostać zielony*.
Jeżeli test nie jest uruchamiany automatycznie, to zdanie nie znaczy nic —
zostaje pamięć o tym, żeby go odpalić ręcznie, a pamięć zawodzi w piątym
commicie o drugiej w nocy.

Jedna z trzech dróg, wybierz i napisz którą:

1. **Włączony billing Actions.** Najprościej, jeżeli właściciel może to zrobić
2. **Hak `pre-push`** uruchamiający `npm run test:unit` i `npx playwright test`.
   Działa bez CI, ale tylko na tym komputerze i da się ominąć przez `--no-verify`
3. **Samodzielny runner** na tej samej maszynie, na której pracujesz

Do czasu rozstrzygnięcia: **uruchamiaj obie serie ręcznie po każdym commicie
fali 1 i wpisuj wynik do `NAPRAWY.md`**. Nie „zielone", tylko liczby:
`test:unit 8/8`, `playwright 4/4`, `visual 720/720`.

# 2. LFS w CI — pułapka, na którą wchodzi każdy pierwszy raz

`shots-baseline` jest w Git LFS. Domyślna akcja pobierania kodu **nie ściąga
plików LFS**, tylko wskaźniki — kilkusetbajtowe pliki tekstowe udające PNG.
Test wizualny porówna wtedy zrzut ze wskaźnikiem i wywali się w sposób,
który wygląda jak katastrofalny dryf wyglądu, a jest błędem konfiguracji.

W kroku pobierania kodu:

```yaml
- uses: actions/checkout@v4
  with:
    lfs: true
```

Sprawdź to **zanim** brama fali 1 zacznie od tego zależeć.

# 3. Drobiazg do potwierdzenia jedną linią

Podałeś to samo drzewo `d305c245…` przy wypchnięciu etapu C i przy `86050d1`,
a raport D24 poszedł jako `71da774`. Potwierdź, że tag `etap-c-2026-09-23`
wskazuje commit z drzewem `d305c245…`, a `71da774` jest po nim. Jedna linia,
dla porządku w rejestrze.

---

# GO NA FALĘ 1 — po załatwieniu punktów 1 i 2

## Kolejność w fali: od izolowanych do najgroźniejszego

Nie w tej kolejności, w której je wypisałem w `ETAP_D.md`. Prawidłowa:

```
D21  martwy MapLibre        izolowane, zero wpływu na wygląd
D9   cienie, promienie      małe, punktowe
D16  motyw per rola         zmiana zachowania, nie wyglądu
D1   Tailwind               największe ryzyko
D2   czcionki systemowe     weryfikacja po D1
```

Powód: gdy największa zmiana ląduje na końcu, wiesz, że każde pęknięcie
po niej pochodzi od niej. Gdy idzie pierwsza, spędzasz wieczór na zgadywaniu.

## D1 — najpierw spis, potem usuwanie

Zanim wyrzucisz Tailwinda, zrób inwentarz: **każda klasa użytkowa, która jest
faktycznie używana, z plikiem i linią**. To jest mapa zamiany. Bez niej
będziesz usuwał na ślepo i gonił błędy przez pół nocy.

Dla każdej: nazwana klasa w arkuszu projektowym, opisująca **rolę** elementu,
nie jego wygląd. `.filters-row`, nie `.flex-gap-2`.

## D2 jest konsekwencją D1, nie osobną pracą

`--default-font-family` pochodzi z preflight Tailwinda. Zniknie razem z nim.
D2 to weryfikacja, że zniknęło i że w całym zbudowanym arkuszu nie ma
odwołania do czcionki systemowej.

---

# KOREKTA REGUŁY BRAMY — ważne, przeczytaj zanim zaczniesz D1

Napisałem: *test musi zostać zielony przez całą falę 1*. To wymaga
doprecyzowania, bo inaczej doprowadzi Cię do błędnej decyzji.

**Preflight Tailwinda robi realną robotę.** Zeruje marginesy nagłówków,
punktory list, obramowania tabel, style przycisków i pól formularza,
ustawia `box-sizing`. Jeżeli aplikacja na tym polegała, usunięcie Tailwinda
**przesunie rzeczy na ekranie i test pójdzie na czerwono**.

To jest sytuacja przewidziana, nie awaria. Ale reakcja musi być jedna:

> **Dopisz brakujące zerowanie do arkusza projektowego, aż test wróci
> do zieleni. Nie regeneruj wzorca.**

Regeneracja w fali 1 zamroziłaby przesunięty układ jako nowy wzorzec —
i od tej chwili aplikacja wyglądałaby inaczej niż zatwierdzona makieta,
a nikt by tego nie wiedział, bo test byłby zielony. To jest dokładnie ten
sposób, w jaki projekty tracą wierność wizualną: nie jednym dużym błędem,
tylko serią zielonych testów na przesuniętym wzorcu.

Jeżeli po dopisaniu zerowania nie da się wrócić do zieleni — **zatrzymaj się
i napisz, które ujęcia i czym się różnią**. Rozstrzygniemy razem.

## Brama fali 1

- `test:unit` 8/8
- `playwright` 4/4
- **`visual` 720/720 bez regeneracji wzorca**
- rozmiar paczki przed i po — po D1 i D21 powinien spaść zauważalnie
- `NAPRAWY.md` uzupełnione: pozycja, commit, pliki, liczby z testów

Potem STOP przed falą 2.
