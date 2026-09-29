> **ARCHIWUM — nie wykonywać. Zastąpione 29.09.2026, patrz docs/handover/wzorzec/**

# PR #1 — ODPOWIEDŹ: ani A, ani B, ani C

D23 przyjęte. 8/8 zielonych, opis PR rzetelny, a najcenniejsze jest w nim
to, czego nie musiałeś pisać: **logika ochronna już była w kodzie**
(`dryRunFromXlsx` zawsze zwraca `removedIds: []`, `commitImport` ignoruje
usuwanie bez `allowRemovals`). Testy nie naprawiają — zamykają. Dokładnie
o to chodziło w fali 0.

Ale w tym samym opisie są dwa zdania, które są ważniejsze niż sam PR:

> `docs/handover/NAPRAWY.md` nie ma na main
> `test:visual` w tym repozytorium nie istnieje

Oraz w pytaniu: *lokalny box ma niezacommitowane data-view / handover*.

**Cały dorobek etapu C leży na jednym komputerze, poza repozytorium.**
Atrybuty `data-view`, skrypt `baseline.mjs`, 720 ujęć wzorcowych,
`tests/visual.spec.ts`, konfiguracja Playwrighta, pliki przekazania 01–09,
`NAPRAWY.md`, `C3_JEZYKI.md`, `C2_4_PIXEL.md`. To jest ten sam problem,
który zamykaliśmy przy 0.5 — tylko że teraz dotyczy czterech godzin pracy
i baseline'u, którego bez tych plików nie da się odtworzyć.

Do tego mamy już **dwa rozjeżdżające się światy**: gałąź agenta chmurowego
wyszła z `main`, który nie zna `data-view`. Im dłużej to potrwa, tym gorszy
będzie scalenie.

---

# KOLEJNOŚĆ

## 1. Scal PR #1 teraz

Mały, izolowany, zielony, dotyka tylko testów i CI. Oznacz gotowy i scal.
Robimy to **przed** wypchnięciem boxa, bo inaczej PR trzeba będzie
przestawiać na nową podstawę, a oba zmieniają `package.json`.

## 2. Zsynchronizuj boxa

```
cd /workspace/watch-tower-app
git status --short          # zobacz pełną listę niezacommitowanego
git pull --rebase origin main
```

W `package.json` będzie konflikt: PR dodał `test` i `test:unit`, box dodał
Playwrighta. **Zachowaj oba.** Po rozwiązaniu uruchom obie serie:

```
npm run test:unit
npx playwright test
```

Obie muszą być zielone, zanim cokolwiek wypchniesz.

## 3. Zdecyduj, co z 720 ujęciami — zmierz najpierw

```
du -sh shots-baseline
```

- **poniżej 100 MB** — zwykły commit, bez kombinowania
- **powyżej** — Git LFS (`git lfs track "shots-baseline/**/*.png"`).
  Bez tego repozytorium spuchnie i każdy klon będzie bolał

Ujęcia **muszą** trafić do repozytorium w jakiejś formie — bez nich test
regresji nie ma z czym porównywać i cały etap C traci sens.
Jeżeli LFS jest niedostępne, napisz — wymyślimy coś innego,
ale nie zostawiamy ich poza repo.

## 4. Wypchnij całą resztę

Jednym commitem albo kilkoma tematycznymi, jak wolisz, ale wszystko:
atrybuty `data-view` / `data-role` / `data-lang`, `scripts/baseline.mjs`,
`tests/visual.spec.ts`, konfiguracja Playwrighta, `shots-baseline/`,
`docs/handover/01`–`09`, `NAPRAWY.md`, `C3_JEZYKI.md`, `C2_4_PIXEL.md`.

Tag: `etap-c-2026-09-23`.

## 5. Zweryfikuj tak jak przy 0.5a

```
git fetch origin
git rev-parse HEAD^{tree}
git rev-parse origin/main^{tree}
```

Równe → box i zdalne są tym samym. Napisz wynik jedną linią.

## 6. Dopiero teraz D24

Pełny przebieg czternastu prób na paczce, która jest już w repozytorium.

---

# NOWA POZYCJA: D26

Z Twojego opisu PR:

> `diffSchedule` nadal widzi brakujące kody jako `removed`,
> a `dryRunFromXlsx(...).removedIds` jest `[]`

To znaczy, że **podgląd przed zapisem pokazuje użytkownikowi coś, czego
system nie zrobi**. KSH widzi „2 usunięte", klika Zatwierdź, nic nie zostaje
usunięte. Podgląd kłamie — w drugą stronę niż przy błędzie P9, więc jest
bezpiecznie, ale nadal kłamie.

Dwie dopuszczalne drogi, wybierz i napisz którą:

1. **Podgląd przestaje pokazywać usunięcia**, skoro import ich nie wykonuje.
   Zamiast tego jedna linia: „brakujące w pliku kody zostaną zachowane".
2. **Usunięcia stają się możliwe za wyraźną zgodą** — osobne pole wyboru
   w oknie podglądu, domyślnie odznaczone, z liczbą i listą kodów do usunięcia.

Druga jest lepsza operacyjnie, bo prędzej czy później KSH będzie chciał
wycofać element z zakresu. Ale wymaga, żeby `allowRemovals` dotarło
z interfejsu, a nie tylko istniało w kodzie.

Dopisz do `NAPRAWY.md`, fala 3.

---

# CO BYM SPRAWDZIŁ W SAMYM PR

Repozytorium jest prywatne, więc nie przeczytam go. Z opisu wynika, że jest
dobry, i nie blokowałbym na przeglądzie. Dwie drobne rzeczy na przyszłość,
nie na teraz:

**Skala.** Testy startują z sześciu ładunków, a usterka historyczna dotyczyła
siedemdziesięciu dwóch. Logika jest ta sama, ale jeden wariant na realnej
skali — siedemdziesiąt kilka wierszy — kosztuje minutę i wyłapałby coś,
co zależy od objętości. Dopisz przy okazji fali 3.

**Uruchamianie w CI.** `unit.yml` chodzi przy każdym wypchnięciu i żądaniu
scalenia — dobrze. Gdy trafi tam też test wizualny, upewnij się, że ma
zainstalowane te same przeglądarki co lokalnie, inaczej różnice w renderowaniu
czcionek dadzą fałszywe czerwone.
