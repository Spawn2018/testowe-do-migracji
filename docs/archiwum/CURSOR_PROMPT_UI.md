> **ARCHIWUM — nie wykonywać. Zastąpione 29.09.2026, patrz docs/handover/wzorzec/**

# PROMPT DO CURSORA — przeniesienie interfejsu (NIE projektowanie)

> Uruchom to **przed** `CURSOR_PROMPT.md`. Najpierw stoi interfejs,
> potem podpinasz pod niego dane.

---

Jesteś inżynierem front-endu. **Nie jesteś projektantem w tym zadaniu.**

Interfejs tej aplikacji **już istnieje i jest zatwierdzony** w pliku
`tower-makieta.html`. Twoim zadaniem jest przenieść go do Next.js
**bez jednej zmiany wizualnej**. Każda różnica w wyglądzie między makietą
a aplikacją jest błędem, nawet jeśli uważasz ją za ulepszenie.

## Pliki wejściowe

| Plik | Rola |
|---|---|
| `tower-makieta.html` | **źródło prawdy** — struktura DOM, klasy, treść, zachowanie |
| `app/tower.css` | arkusz stylów wyjęty z makiety 1:1, wchodzi do repo bez zmian |
| `DESIGN_SYSTEM.md` | dlaczego tak jest; czytaj przed każdą decyzją |

## Czego NIE WOLNO zmienić

- ani jednej wartości w `tower.css` — żadnego koloru, rozmiaru, odstępu, promienia
- ani jednej nazwy klasy CSS
- struktury DOM wewnątrz komponentów (kolejność elementów, zagnieżdżenie)
- krojów — **Barlow i Barlow Condensed**, wczytywane z Google Fonts
- treści polskich napisów i słownika `I18N` (pl / en / sv)
- kolejności kolumn w tabelach ani kolejności zakładek w szufladzie

## Czego NIE WOLNO dodać

- **Tailwind CSS w komponentach aplikacji.** `tower.css` jest kompletny.
  Jeśli instalujesz Tailwind dla czegokolwiek innego, wyłącz preflight
  albo ogranicz go do katalogu poza `app/`.
- **Motywu shadcn/ui.** Jego zmienne (`--background`, `--card`, `--radius`,
  `--muted`) kolidują z tokenami tego systemu. Jeśli potrzebujesz dostępnego
  dialogu, selecta albo tooltipa, bierz **sam prymityw Radix**
  (`@radix-ui/react-dialog` itd.) i styluj go klasami z `tower.css`.
- ikon emoji ani nowych znaków Unicode jako ikon
- cieni, gradientów, animacji wejścia, promieni większych niż 2 px
- bibliotek komponentów UI (MUI, Chakra, Mantine, Ant, DaisyUI)
- bibliotek wykresów — `.scurveHTML` i paski marży są ręcznym SVG i takie zostają

## Co MOŻESZ i POWINIENEŚ zmienić

- podmienić generator danych (`LOADS`, `RISKS`, `CHAT`, `WORKFLOWS`) na
  zapytania do Supabase — **funkcje renderujące mają produkować identyczny HTML**
- rozbić jeden plik na komponenty React (mapa niżej)
- zamienić `render()` i delegację zdarzeń na stan React
- dodać routing, autoryzację, obsługę błędów, stany ładowania
- dodać atrybuty dostępności, których w makiecie brakuje
  (`aria-label`, `role`, pułapka fokusu w szufladzie)
- dodać stany puste, ładowania i błędu — **w rytmie tabeli, nie spinnerem**

## Mapa komponentów

| Funkcja w makiecie | Komponent | Klasy, które posiada |
|---|---|---|
| `corridorHTML()` | `<CorridorSpine/>` | `.corridor`, `.corridor-inner`, `.stage` |
| `navHTML()` | `<SideNav/>` | `nav button`, `.glyph`, `.count`, `.sep` |
| `kpiHTML()` | `<KpiStrip role/>` | `.kpis`, `.kpi` |
| `exqHTML()` | `<ExceptionQueue limit/>` | `.exq`, `.gut`, `.age` |
| `scurveHTML()` | `<ProgressCurve/>` | inline `<svg>`, `.legendline` |
| `renderMapSVG()` | `<CorridorMap/>` | `.mapbox`, `.maplayers`, `.mapkey`, `.veh` |
| `tableHTML()` | `<LoadTable/>` | `.filters`, `.tablewrap`, `.pill`, `.flagrow`, `.note` |
| `drawerHTML()` | `<LoadDrawer/>` | `.scrim`, `.drawer`, `.dtabs`, `.dbody`, `.kv`, `.tl`, `.mrow`, `.msg` |
| `viewDash()` | `app/(app)/page.tsx` | `.banner`, `.grid2` |
| `viewSched()` | `app/(app)/harmonogram/page.tsx` | — |
| `viewMap()` | `app/(app)/mapa/page.tsx` | `.mapsplit`, `.mlist` |
| `viewRisk()` | `app/(app)/ryzyka/page.tsx` | `.two` |
| `viewDocs()` | `app/(app)/dokumenty/page.tsx` | — |
| `viewFin()` | `app/(app)/finanse/page.tsx` | `.locked` |
| `viewInv()` | `app/(app)/faktury/page.tsx` | — |
| `viewWf()` | `app/(app)/automatyzacje/page.tsx` | `.wf`, `.sw` |
| `viewGeo()` | `app/(app)/strefy/page.tsx` | — |
| `viewTasks()` | `app/(app)/zadania/page.tsx` | — |

`app/layout.tsx` zawiera `.topbar`, `<CorridorSpine/>`, `.body`, `<SideNav/>`
i `<main>` — dokładnie tak jak w makiecie. Korytarz jest **w layoucie**,
nie w widokach: ma być widoczny na każdym ekranie.

## Mapa i wykresy

`renderMapSVG()` jest schematem, nie warstwą kartograficzną, i **na tym etapie
zostaje bez zmian**. Projekcja, kontury, trasy, strefy i pojazdy są policzone
w JS i renderowane jako jeden `<svg>`. Przenieś tę logikę do
`lib/map/projection.ts` i `components/CorridorMap.tsx` bez zmiany wyniku.

Podmiana na MapLibre jest osobnym, późniejszym zadaniem i wymaga zachowania
tej samej palety, tych samych markerów i tego samego panelu warstw.

## Weryfikacja — obowiązkowa przed zgłoszeniem gotowości

1. Otwórz makietę i aplikację obok siebie w tej samej szerokości okna.
2. Przejdź wszystkie dziewięć widoków w trzech rolach (H&H, KSH, Scandinavian
   Express) i w trzech językach. **27 kombinacji.**
3. Sprawdź tryb jasny i ciemny oraz przełącznik motywu.
4. Sprawdź szerokości 1440, 1100 i 390 px.
5. Zrób zrzuty i porównaj. Każda różnica w kolorze, odstępie, rozmiarze tekstu
   albo promieniu jest błędem do naprawienia, nie decyzją do obrony.

Zalecane: test regresji wizualnej Playwright ze zrzutami makiety jako wzorcem.

## Kolejność pracy

1. Projekt Next.js, `tower.css` w `app/`, Barlow z Google Fonts w `layout.tsx`
2. `layout.tsx`: topbar, korytarz, nav, main — statycznie, z danymi z makiety
3. Komponenty listowe i tabelaryczne, nadal na danych z makiety
4. Szuflada transportu z pięcioma zakładkami
5. **Zrzuty porównawcze — punkt kontrolny, nie idź dalej bez zgody**
6. Dopiero teraz: Supabase, autoryzacja, role, prawdziwe dane

**Zacznij od przeczytania `tower-makieta.html` i `DESIGN_SYSTEM.md`.
Następnie wypisz, co w makiecie jest niejednoznaczne albo czego nie da się
odwzorować w React bez zmiany wyglądu. Nie zaczynaj kodować przed moją odpowiedzią.**
