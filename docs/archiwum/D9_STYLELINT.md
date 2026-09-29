> **ARCHIWUM — nie wykonywać. Zastąpione 29.09.2026, patrz docs/handover/wzorzec/**

# D9 — SKĄD WZIĄĆ REGUŁY: ODPOWIEDŹ A

Plik dostaniesz w załączniku. Ale najpierw dwa sprostowania po mojej stronie,
bo oba zmieniają sens zadania.

---

# SPROSTOWANIE 1: moje liczby mogą być nieaktualne

Napisałem „10 cieni, 5 promieni powyżej 2 px, 1 `!important`" i zarzuciłem
Ci, że zgłosiłeś trzy miejsca.

**Te liczby policzyłem na zbudowanym arkuszu wdrożenia sprzed D1 — czyli
z Tailwindem w środku.** Część z tych cieni i promieni mogła pochodzić
z Tailwinda i zniknąć razem z nim. Twoje trzy miejsca mogą więc być
kompletnym wynikiem dla obecnego stanu, a nie „częścią".

Nie wiem tego i Ty też nie — **trzeba zmierzyć na obecnej paczce.**
Mój zarzut zawieszam do czasu pomiaru.

# SPROSTOWANIE 2: w moim pliku jest błąd

`.stylelintrc.json`, który dostałeś w paczce, ma komentarze zapisane jako
klucze **wewnątrz sekcji `rules`** — `"//odstepy"`, `"//gradienty"`,
`"//jednostki"`, `"//styl-w-komponentach"`. Stylelint waliduje nazwy reguł
i wywali się na nich z błędem „Unknown rule".

Poza tym miał nadpisanie dla plików `.tsx` przez `postcss-styled-syntax`,
którego nie potrzebujesz — w tej aplikacji nie ma stylowania w szablonach.

Poniżej wersja poprawiona i przycięta do tego, co ma sens teraz.
**Użyj tej, nie tej z paczki.**

---

# NAJPIERW POMIAR, POTEM NARZĘDZIE

Nie blokuj zamknięcia D9 na konfigurowaniu stylelinta. Liczby dostaniesz
w dziesięć sekund:

```
grep -rn 'box-shadow' src --include='*.css' --include='*.tsx' | grep -v 'none'
grep -rnE 'border-radius:\s*([3-9][0-9]*|[1-9][0-9]+)px' src
grep -rn '!important' src
```

Osobno arkusz projektowy, który ma własne reguły i jest wyłączony
z linta — sprawdź go tylko wzrokowo, nie licz do wyniku.

**Podaj trzy liczby i listę miejsc.** To zamyka D9 albo pokazuje, ile
jeszcze zostało. Stylelint jest potem, do pilnowania, żeby nie wróciły.

---

# KONFIGURACJA — WERSJA POPRAWIONA

Zapisz jako `.stylelintrc.json` w korzeniu repozytorium:

```json
{
  "extends": ["stylelint-config-standard"],
  "plugins": ["stylelint-declaration-strict-value"],
  "ignoreFiles": [
    "**/tower.css",
    "node_modules/**",
    "dist/**",
    "shots-baseline/**"
  ],
  "rules": {
    "scale-unlimited/declaration-strict-value": [
      [
        "color",
        "background-color",
        "background",
        "border-color",
        "border-top-color",
        "border-right-color",
        "border-bottom-color",
        "border-left-color",
        "outline-color",
        "fill",
        "stroke"
      ],
      {
        "ignoreValues": [
          "transparent",
          "inherit",
          "currentColor",
          "none",
          "initial",
          "unset",
          "revert",
          "auto"
        ],
        "disableFix": true
      }
    ],
    "declaration-property-value-allowed-list": {
      "border-radius": ["/^0$/", "/^2px$/", "/^50%$/", "/^var\\(--/"],
      "font-family": ["/Barlow/", "/^var\\(--/", "/^inherit$/"],
      "box-shadow": ["none", "/^var\\(--/"],
      "text-transform": ["none", "lowercase", "/^var\\(--/"]
    },
    "declaration-property-unit-allowed-list": {
      "letter-spacing": ["em"],
      "line-height": []
    },
    "declaration-property-value-disallowed-list": {
      "/^(padding|margin|gap|row-gap|column-gap)/": [
        "/^\\d*[13579]px$/",
        "/^\\d+\\.\\d+px$/"
      ]
    },
    "declaration-no-important": true,
    "function-disallowed-list": [
      "linear-gradient",
      "radial-gradient",
      "conic-gradient"
    ],
    "no-descending-specificity": null,
    "color-hex-length": "long",
    "alpha-value-notation": "number",
    "color-function-notation": "modern",
    "comment-empty-line-before": null,
    "declaration-empty-line-before": null,
    "custom-property-empty-line-before": null,
    "no-empty-source": null
  }
}
```

Instalacja:

```
npm i -D stylelint stylelint-config-standard stylelint-declaration-strict-value
npx stylelint "src/**/*.css"
```

## Co robi każda reguła

**`declaration-strict-value`** — kolor musi pochodzić z tokenu `var(--…)`.
To pilnuje zamkniętego systemu sygnałów: bursztyn uwaga, czerwony blokada
lub strata, zielony zamknięte poprawnie, morski w ruchu, szary nieaktywne.

**`border-radius`** — tylko 0, 2 px, 50% albo token. Panele i tabele mają zero,
kontrolki dwa piksele.

**`font-family`** — wyłącznie Barlow. To jest siatka bezpieczeństwa na D2:
jeżeli ktoś kiedyś wklei czcionkę systemową, lint to złapie.

**`box-shadow`** — tylko `none`. Hierarchia idzie przez włos linii
i stopień tła.

**odstępy** — blokuje nieparzyste piksele i ułamki. Rytm jest czterowarstwowy;
odstęp 7 px albo 13,5 px rozjeżdża siatkę w sposób, który widać, ale trudno
wskazać palcem.

**gradienty** — zakazane. `repeating-linear-gradient` nie jest na liście
celowo, bo to nim zrobiony jest motyw tablicy wyróżniającej i linia
perforacji — a te i tak żyją w wyłączonym `tower.css`.

## Dwie rzeczy, których świadomie nie włączyłem

**`selector-class-pattern`** — zgłosiłoby `section-card-hd--drag`, czyli
pozycję D13 z fali 3. Teraz dałoby tylko szum. Dołóż po D13.

**Sprawdzanie plików `.tsx`** — ma sens dopiero, gdyby ktoś zaczął stylować
w komponentach. Skoro po D1 tego nie ma, nie ma czego pilnować.

## Ścieżka do arkusza projektowego

`"**/tower.css"` zakłada, że nazwa pliku to `tower.css`. Jeżeli w repozytorium
nazywa się inaczej, popraw wzorzec — **inaczej lint zasypie Cię błędami
z pliku, który z założenia definiuje tokeny.**

---

# CO DALEJ

1. Trzy liczby z `grep`, lista miejsc → D9 zamknięte albo dokończone
2. Stylelint podpięty, wynik jedną linią
3. Dowód D2: `grep -c -- '--tw-' dist/assets/*.css` oraz lista `font-family`
4. Numeracja `NAPRAWY.md` z przedrostkiem `L` i tabelą przekładu
5. Dopiero D7 — sam wzór, bez kodu
