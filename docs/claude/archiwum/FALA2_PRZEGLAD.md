# PRZEGLĄD FALI 2 — WARUNKOWE GO NA FALĘ 3

Kod fali 2 jest dobry. Kilka rzeczy zasługuje na wyróżnienie, bo to jest
dokładnie ten poziom, o który chodziło:

- **D5** — znalazłeś przyczynę, nie tylko objaw: whitelist statusów pomijał
  `DELAYED` i `SILENT`. To tłumaczy rozjazd lepiej niż cokolwiek, co mogłem
  wywnioskować z zewnątrz
- **D4** — `SAIL_ROWS` z odwróconymi statkami na 24/25.09 to druga, ukryta
  kopia danych. Dokładnie ten rodzaj rzeczy, który rodzi sprzeczności
- **D22** — sprawdzenie `baseline.mjs` przed podbiciem wersji. Pułapka ominięta
- **D3** — uczciwa decyzja przy braku klucza
- **D9** — zamiany zamiast wyłączeń: `border-left` zamiast cienia, `outline`
  zamiast pierścienia, `50%` zamiast `9px`. I jedenaście pozostałych
  `!important` z uzasadnieniem, nie zamiecionych pod dywan

Ale przed falą 3 trzy rzeczy. Pierwsza jest poważna.

---

# 1. RYZYKA: 0 ZMIENIONYCH UJĘĆ — TO SIĘ NIE ZGADZA

W tabeli bramy: *ryzyka/docs/fin… 0*.

Dla dokumentów i finansów zero jest poprawne — nic ich nie dotykało.
**Dla widoku Ryzyka zero jest niemożliwe**, bo dwie naprawy tej fali
zmieniają go widocznie:

- **D3** dodało etykietę „dane demonstracyjne" na panelu warunków drogowych SE,
  który żyje w widoku Ryzyka
- **D4** zmieniło źródło danych rejsów, a tabela promowa w widoku Ryzyka
  pokazywała na 24/25.09 odwrócone statki — po naprawie powinny się zamienić

Trzy możliwe wyjaśnienia, każde z innymi skutkami:

1. **Tabela promowa w Ryzykach ma trzecią kopię danych rejsów**, niezależną
   od `SAIL_ROWS` i od `voyage.ts`. Wtedy D4 nie jest zamknięte
2. **Etykieta D3 trafiła gdzie indziej**, nie do widoku Ryzyka
3. **Widok Ryzyka nie jest objęty matrycą 720**

A wzorzec został już zregenerowany i otagowany. Jeżeli przyczyną jest (1)
albo (2), to **`baseline-fala-2` zamroził usterkę jako stan poprawny** —
dokładnie scenariusz, przed którym ostrzegałem przy regeneracji.

Nie ma paniki: wzorzec da się przebudować, a tag przesunąć. Ale najpierw
trzeba wiedzieć. Sprawdź:

```
ls shots-baseline | grep -i ryzyk | wc -l
grep -rn "SAIL_ROWS\|ferry-sailings\|voyage" src --include='*.tsx' --include='*.ts'
```

Pierwsze: ile ujęć Ryzyka jest w matrycy. Drugie: czy tabela promowa w widoku
Ryzyka czyta z `voyage.ts`, czy z czegoś jeszcze.

**Do czasu wyjaśnienia fala 3 nie startuje.**

# 2. PRÓG TESTU WIZUALNEGO JEST ZA LUŹNY DLA TREŚCI

Napisałeś: *wiele dat D8 poniżej progu 0.001*. To jest ważniejsze, niż
brzmi.

`maxDiffPixelRatio: 0.001` to jedna tysięczna **powierzchni ujęcia**.
Ujęcie pełnej strony harmonogramu z siedemdziesięcioma dwoma wierszami
ma kilka milionów pikseli, więc próg to kilka tysięcy pikseli. Zmiana jednej
godziny w komórce to kilkaset. **Błędna cyfra w tabeli przejdzie test
na zielono.**

I gorzej: próg liczony jako ułamek **luzuje się wraz z długością strony**.
Najdłuższa strona — harmonogram — jest najsłabiej chroniona. Dokładnie
ta, na której błąd kosztuje najwięcej.

Dwie zmiany:

**a) Próg bezwzględny zamiast ułamkowego:**

```ts
await expect(page).toHaveScreenshot(nazwa, {
  fullPage: true,
  maxDiffPixels: 60,
  threshold: 0.15,
  animations: 'disabled',
});
```

`threshold` toleruje różnice wygładzania krawędzi na poziomie pojedynczego
piksela, `maxDiffPixels: 60` łapie każdą zmienioną cyfrę niezależnie
od długości strony. Dobierz wartość na jednym przebiegu — jeżeli daje
fałszywe czerwone przez wygładzanie, podnieś `threshold`, nie `maxDiffPixels`.

**b) Uznanie granicy między dwoma rodzajami testów.**
Test pikselowy pilnuje **wyglądu**: odstępów, krojów, kolorów, układu.
**Nie pilnuje poprawności treści** i nie powinien. Poprawność treści —
czy data jest w dobrej strefie, czy kwota ma dobry format, czy KPI zgadza
się z korytarzem — to asercje w testach jednostkowych i Playwrighcie.

To ma bezpośrednie znaczenie dla fali 3, która jest w całości zmianą treści.
Patrz niżej.

# 3. STYLELINT: 492 BŁĘDY TO W DUŻEJ CZĘŚCI MÓJ BŁĄD

Dwie przyczyny, obie po mojej stronie:

**Reguła odstępów zabrania nieparzystych pikseli — a mój własny kanon ich
używa.** `padding: 9px 13px`, `padding: 7px 9px`, `gap: 9px` są w makiecie
wszędzie. Reguła była życzeniowa i sprzeczna z systemem, który miała
chronić. **Usuń całą regułę `declaration-property-value-disallowed-list`.**

**Wzorzec `**/tower.css` nie trafia w nic**, bo arkusz nazywa się
`src/index.css`. Lint sprawdza więc plik, który definiuje tokeny.
Uprzedzałem, że tak będzie przy innej nazwie — ale rozwiązaniem nie jest
dopisanie `src/index.css` do wyłączeń, bo wtedy lint nie sprawdza niczego.

**Właściwe rozwiązanie:** zostaw `src/index.css` w lincie, ale wyłącz reguły
formatowania ze `stylelint-config-standard`, które kłócą się ze zwartym stylem
kanonu — zapis wielu deklaracji w jednej linii jest w makiecie celowy.
Konkretnie te, które dominują w Twoich 492, zapewne
`declaration-block-single-line-max-declarations` i pokrewne. Podaj pięć
najczęstszych reguł z wyniku, wyłączymy je świadomie.

Cel: **lint zielony**. Linter, który zawsze świeci na czerwono, jest ignorowany
po tygodniu i przestaje pilnować czegokolwiek.

---

# D7 — ODPOWIEDŹ ZMIENIA SENS NAPRAWY

Dlatego kazałem najpierw odpowiedzieć. Wzór **nie jest** tym, który
zakładałem:

> `appliedMult = Math.min(multSek, multPln)` — tablice przeliczeniowe
> SEFS_SEK i SEFS_PLN, potem `applySefsToRoadRate` tylko na stawkę drogową

Zakładałem `((bieżąca − bazowa) / bazowa) × udział`. Gdybyś „naprawił"
udział paliwa z 0% na coś sensownego, **nic by się nie zmieniło** — albo
zmieniło się coś, czego nikt nie chciał.

**D7 nie jest naprawą techniczną. Jest decyzją biznesową i nie należy
do Ciebie ani do mnie.** Co robisz teraz, bez kodu:

1. Zapisz wzór dokładnie w `03_PARAMETRY_BIZNESOWE.md` — plik, linia,
   postać, przykład wyliczenia na liczbach
2. Odpowiedz: **które pola w ekranie Opcje faktycznie zasilają
   `computeSefs`?** Cena bazowa, bieżąca, udział paliwa, próg, krok
   zaokrąglenia, minimum, maksimum. Te, które nie zasilają, są fasadą
   i trafiają do D25
3. Odpowiedz: czy `hybrid_min` stosowany jest po stronie kosztu,
   przychodu, czy obu
4. Odpowiedz: skąd pochodzą wartości w tablicach SEFS_SEK i SEFS_PLN

Reszta idzie do właściciela.

---

# NUMERACJA: OSIEM POZYCJI L BEZ PRZYDZIAŁU

L1, L2, L4, L5, L7, L8, L9, L16 są otwarte i nie mają miejsca w żadnej fali.
Dopisz do każdej jedno zdanie opisu i przydział: fala 3, fala 4, albo
**fala 5 — nowa, po infrastrukturze**. Pozycja bez fali to pozycja, która
nie zostanie zrobiona.

# D8 — DROBNA UWAGA DO ZAPISU

`Europe/Warsaw` i `Europe/Stockholm` mają identyczne przesunięcie i identyczne
reguły czasu letniego. Rozróżnienie jest poprawne jako zapis intencji,
ale **liczbowo niczego nie zmienia**. Dopisz to zdanie do dokumentacji,
żeby nikt za pół roku nie szukał różnicy, której nie ma.

Dwie liczby do wyjaśnienia jednym zdaniem każda: **kokpit 54 zamiast
szacowanych 90** — czy to 30 ujęć roli KSH, która ma inne KPI? **Mapa 18,
wyłącznie przy 1920** — co jest widoczne tylko przy tej szerokości?

---

# FALA 3 — KOLEJNOŚĆ I JEDNO NOWE NARZĘDZIE

Fala 3 to w całości treść. Skoro test pikselowy nie pilnuje treści,
potrzebny jest test, który pilnuje. Najpierw on, potem naprawy.

## D19-T — test nieprzetłumaczonych napisów (nowy, przed D19)

W trybie EN i SV **żaden widok nie powinien zawierać polskich znaków
diakrytycznych** poza danymi — nazwiskami, nazwami miejscowości, kodami.
Litery `ą ć ę ł ń ó ś ź ż` w interfejsie angielskim albo szwedzkim to prawie
pewny znak napisu wpisanego na stałe.

Test Playwright: dla każdego widoku, dla EN i SV, pobierz tekst interfejsu
**z wyłączeniem komórek z danymi** (oznacz je atrybutem, np. `data-content`),
i sprawdź, że nie zawiera tych liter.

Dziś ten test będzie czerwony — to jest cel. Liczba trafień to Twój licznik
D19, który spada do zera. **Zamienia polowanie na sto cztery napisy
w test, który sam powie, kiedy skończyłeś.**

## Kolejność

```
D19-T  test diakrytyków              narzędzie, najpierw
D10    funkcja formatująca kwoty      czysta funkcja, test jednostkowy
D17    format daty w tabeli           czysta funkcja, test jednostkowy
D11    ciągi debugowe do słownika
D19    104 napisy do słownika         aż D19-T zielony
D12    dane prawdopodobne
D6     telefon: z tabeli do szuflady, ±24 h dla klienta — z testem uprawnień
D26    usunięcia za wyraźną zgodą — z testem w zestawie D23
D18    oznaczenie danych demonstracyjnych
D13    wzorce wizualne udokumentowane, konwencja nazw
D25    atrapy i porzucone z 02_FASADA, w tym pola Opcje z punktu D7
```

D10 i D17 na początku, bo to czyste funkcje — łatwo przetestować, a potem
wszystko inne z nich korzysta. D25 na końcu, bo dotyka najwięcej miejsc.

## Brama fali 3

- unit i Playwright zielone, z liczbami
- **D19-T zielony: zero polskich znaków w interfejsie EN i SV**
- stylelint zielony
- przebieg 720 z nowym progiem bezwzględnym, raport grupami, tag
  `baseline-fala-3-<data>`

---

# PODSUMOWANIE WARUNKÓW GO

1. Wyjaśnić zero zmian w widoku Ryzyka — jeżeli wzorzec zamroził usterkę,
   naprawić i przebudować wzorzec
2. Próg bezwzględny w teście wizualnym
3. Stylelint: usunąć regułę odstępów, wyłączyć świadomie reguły formatowania,
   lint zielony
4. D7: cztery odpowiedzi, bez kodu
5. Osiem pozycji L z przydziałem do fal

Potem fala 3 od D19-T.
