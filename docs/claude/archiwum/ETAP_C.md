# ETAP C — PAKIET PRZEKAZANIA (wersja rozszerzona)

> Do wklejenia w całości. Zastępuje etap C z promptu finalnego —
> rozszerzony o to, co wyszło z przekazania czterech agentów WT.
> Etapy A i B przyjęte. Wykonuj bez zmian w kodzie; naprawy to etap D.

---

# CO SIĘ ZMIENIŁO PO PRZECZYTANIU PRZEKAZANIA AGENTÓW

Przeczytałem przekazanie od WT — UX, Visual, Research i QA. Dobra robota,
szczególnie w części o tym, czego nie ma. Trzy rzeczy zmieniają etap C:

**Wiedza jest rozrzucona po około sześćdziesięciu plikach w trzech katalogach,
z dwoma równoległymi torami w `research-2026/` i z dokumentami, o których
sami autorzy piszą, że są nieaktualne.** Bez indeksu nikt tego nie przeczyta,
a builder trafi na nieaktualny dokument i cofnie decyzję, która już zapadła.
Stąd nowy punkt C4.

**Są trzy referencje wizualne na dysku i sprzeczność co do tego, która jest
kanoniczna.** Dokumentacja UX wskazuje `claude-makieta.html`, koordynator
`claude-v2.0/`. Bez rozstrzygnięcia nie wiadomo, wobec czego mierzyć
wierność wyglądu. Stąd C5.

**Brama wizualna działa „na oko", a nie na różnicy pikseli.** To wyłapuje
duże odchylenia, ale przepuszcza dryf poniżej progu oka — a przez osiem
sesji rozwoju taki dryf się sumuje. Potrzebne są oba mechanizmy: oko łapie
to, czego piksel nie rozumie, piksel łapie to, czego oko nie widzi.
Stąd rozbudowane C2.

---

# C1. Tabela „co działa, a co jest fasadą"

Plik `02_FASADA.md`. Najważniejsza pojedyncza tabela całego przekazania.

| Element | Plik : linia | Stan | Dowód | Uwaga |
|---|---|---|---|---|

Stany: `DZIAŁA` · `ATRAPA` (wygląda, nic nie robi) · `CZĘŚCIOWO` ·
`ZAKOMENTOWANE` · `PORZUCONE`

Obejmij: każdy przycisk, pole formularza, zakładkę, filtr, przełącznik,
element mapy, akcję w szufladzie, eksport, powiadomienie, regułę
automatyzacji.

**Nowy wymóg: uzgodnij tę tabelę z raportami QA.** W `qa-start/` są wyniki
klików — FINAL_SHIP, FUNCTIONAL_REQA_*, FINAL_FN3_CLICK, FINAL_FN4_CLICK,
P9_RECLICK2_READY, HOLLOW_FIX, HOLLOW_VERIFY. W kolumnie „Dowód" wskaż
raport i datę. Tam, gdzie Twoja ocena różni się od ostatniego raportu QA,
napisz to wprost — rozbieżność jest informacją, nie błędem.

Osobno wypisz:
- wartości zaszyte na sztywno zamiast liczonych
- liczby wymyślone w odróżnieniu od liczonych z danych
- funkcje zaczęte i porzucone
- **rzeczy oznaczone przez QA jako residual**, czyli niezamknięte,
  ale przepuszczone przez bramę

# C2. Zrzuty wzorcowe i test różnicy pikseli

## C2.1 Mechanizm zamrożenia zegara — najpierw

`?now=2026-09-23T14:32:00Z` albo `VITE_FROZEN_NOW`. Bez tego nagłówek
odlicza czas do rejsu i żaden zrzut nie jest powtarzalny. Wszystko poniżej
zależy od tego punktu.

Zamroź też wszystko inne, co się rusza samo: losowe kolejności, animacje
wejścia, dane generowane z bieżącej daty.

## C2.2 Skrypt generujący — potem

`scripts/baseline.mjs`. Pętla po widokach, rolach, językach, szerokościach
i motywach. Nazewnictwo `widok__rola__jezyk__szerokosc__motyw.png`.

Parametry: PNG, `deviceScaleFactor: 1`, `prefers-reduced-motion: reduce`,
oczekiwanie na `document.fonts.ready`, bez kompresji stratnej.

**Skrypt jest ważniejszy niż zrzuty, które wyprodukuje.** Zrzuty zestarzeją
się przy pierwszej zmianie, skrypt będzie uruchamiany do końca projektu.

## C2.3 Matryca — dopiero na końcu, jednym poleceniem

- widoki: Kokpit, Mapa, Harmonogram, Ryzyka, Dokumenty, Finanse, Faktury,
  Automatyzacje, Strefy, Opcje, Moje zadania, Moje stawki, Rozliczenia
- role: HHL, KSH, SCX
- języki: PL, EN, SV
- szerokości: 1920, 1440, 1280, 768, 390
- motywy: jasny i ciemny

Uwzględnij ustalenie z akceptacji #12: **pierwsze malowanie zależy od roli**
— HHL i SCX ciemny, KSH jasny. Zrób zrzuty obu motywów dla każdej roli,
a w nazwie pliku zaznacz, który był domyślny.

Stany osobno: spoczynek, najechanie na wiersz, fokus klawiatury, przycisk
zablokowany, ładowanie, lista pusta po filtrze, błąd, błąd walidacji,
oraz każda z pięciu zakładek szuflady transportu.

## C2.4 Test różnicy pikseli — nowy wymóg

Brama „na oko" zostaje, ale nie wystarcza. Dołóż automatyczne porównanie:

- `tests/visual.spec.ts` — Playwright, porównanie z katalogiem wzorcowym,
  próg `maxDiffPixelRatio: 0.001`
- wzorcem jest **aktualny stan po FINAL_SQUINT**, nie referencja HTML —
  chodzi o wykrywanie dryfu od dziś naprzód, nie o powtórzenie bramy Visual
- czerwony test blokuje wdrożenie

Jeżeli nie masz Playwrighta w środowisku — napisz to, a test dopiszemy
po naszej stronie. **Nie pomijaj punktu po cichu.**

# C3. Kompletność trzech języków

Nie zakładaj, że `src/i18n` jest kompletne. Podaj:

- liczbę kluczy w PL, EN, SV
- listę kluczy obecnych w PL, a brakujących w EN albo SV
- listę kluczy nieużywanych nigdzie w kodzie
- miejsca, gdzie tekst jest wpisany wprost w komponencie zamiast
  pochodzić ze słownika

Ostatni punkt jest najważniejszy — wpisany na stałe polski tekst nie
zgłasza się jako brakujące tłumaczenie, tylko cicho psuje wersję szwedzką.

# C4. Indeks wiedzy projektu — nowy punkt

Plik `09_INDEKS_WIEDZY.md`. Jedna tabela, cała rozproszona wiedza:

| Plik | Katalog | Autor | Co zawiera | Aktualny? | Zastąpiony przez |
|---|---|---|---|---|---|

Obejmij wszystko: `UX_MAP.md`, `VISUAL_BRIEF.md`, `VISUAL_ALIGN_CLAUDE.md`,
`VISUAL_BRIEF_ELITE.md`, `ADDRESSES.md`, `PERMIT_*`,
`QA_ELITE_UPGRADE_CHECKLIST.md`, `START_API_NOTES.md`, cały `research-2026/`
z oboma torami, wszystkie `visual-gate-*`, cały `qa-start/`,
`SOT_FLIP_CLAUDE_SHELL_2026-09-23.md`, `CLAUDE_SHELL_GATE.md`,
`ROZMOWA_CLAUDE.txt`, `CURSOR_PROMPT.md`.

**Kolumna „Aktualny?" jest obowiązkowa.** WT — Visual i WT — UX zgłosili
oboje, że dokumenty anti-slop nadal wskazują IBM Plex, choć decyzja
o kroju została odwrócona. Builder, który przeczyta nieaktualny dokument,
cofnie rozstrzygniętą decyzję.

Dla każdego dokumentu oznaczonego jako nieaktualny: albo dopisz na górze
widoczny nagłówek „NIEAKTUALNE — zastąpione przez X", albo przenieś plik
do `docs/archiwum/`. Nie usuwaj.

Wskaż też jawnie **regułę rozstrzygania sprzeczności**. Z README
w `research-2026/` wynika, że wygrywają `UX_MAP` / `VISUAL_BRIEF` /
`CURSOR_PROMPT`. Potwierdź, czy to nadal obowiązuje i czy obejmuje
oba tory plików w tym katalogu.

# C5. Rozstrzygnięcie referencji wizualnej — nowy punkt

Na dysku są trzy:

- `/workspace/watch-tower/claude-makieta.html`
- `/workspace/watch-tower/claude-visual-ref/tower-makieta.html`
- `/workspace/watch-tower/claude-v2.0/`

Dokumentacja UX wskazuje pierwsze dwie jako cel klonowania. Koordynator
w etapie zerowym wskazał trzecią. To są **różne pliki** — trzecia zawiera
poprawki, których nie ma w pierwszych dwóch: własne ikony zamiast znaków
Unicode, motyw tablicy wyróżniającej, podpowiedzi klawiszy na pasku etapów,
nagłówek szuflady w formie listu przewozowego, szkielety ładowania,
stany puste, mocniejszą skalę typograficzną.

Ustal i zapisz w `06_WYGLAD.md`:

1. **Wobec której referencji zbudowano obecną aplikację.** Sprawdź
   po obecności cech z trzeciej wersji: czy pasek etapów ma cyfry
   podpowiedzi w rogu, czy nagłówek szuflady ma rubryki listu przewozowego
   i linię perforacji, czy baner krytyczny ma ukośne pasy u góry.
   Podaj, które z nich są w aplikacji.
2. **Która jest kanoniczna od teraz.** Jedna. Pozostałe do
   `docs/archiwum/` z nagłówkiem wskazującym następcę.
3. **Co różni aplikację od kanonicznej.** Lista różnic, nie ocena.

Bez tego punktu nie da się zmierzyć wierności wyglądu, bo nie wiadomo,
wobec czego mierzyć.

# C6. Dowody QA do repozytorium — nowy punkt

WT — Visual zgłosił, że dowody końcowe leżą w `/tmp/wt-*.png`, czyli
w miejscu, które zniknie przy pierwszym restarcie maszyny. WT — QA ma
zrzuty w `qa-start/`.

Przenieś wszystko, co jest dowodem przejścia bramy, do repozytorium
pod `docs/evidence/`, z zachowaniem struktury i dat. To, co już zniknęło,
odnotuj jako utracone — nie odtwarzaj.

---

# PLIKI DO WYDANIA

Dziesięć plików tekstowych do bazy wiedzy. Kod, zrzuty i dowody zostają
w repozytorium.

| Plik | Zawartość |
|---|---|
| `00_KONTEKST.md` | etap A — gotowe |
| `01_HANDOVER.md` | architektura, drzewo plików z opisem, przepływ danych, uruchomienie lokalne |
| `02_FASADA.md` | C1 — co działa, co jest fasadą, uzgodnione z QA |
| `03_PARAMETRY_BIZNESOWE.md` | stawki, dopłata paliwowa, kursy, faktoring, kody opóźnień, progi, limity, cykl fakturowania — z oznaczeniem, co jest ustalone, a co demonstracyjne |
| `04_INTEGRACJE.md` | wszystkie wywołania zewnętrzne, stan każdego, klucze, `START_API_NOTES` wciągnięte |
| `05_DANE_I_LOGIKA.md` | encje, generator danych, role i uprawnienia, gdzie żyje stan, wzory cen i ETA, strefy, statusy, formatowanie |
| `06_WYGLAD.md` | tokeny, siatka, skala, breakpointy, kroje, ikony, kafelki, licencje, **C5** |
| `07_ZNANE_BLEDY.md` | znane błędy, testy, dostępność, obsługa błędów, monitoring, przeglądarki, wydajność |
| `08_MANIFEST.md` | etap B — gotowe |
| `09_INDEKS_WIEDZY.md` | C4 — indeks wszystkich dokumentów z oceną aktualności |

---

# RYZYKA ZGŁOSZONE PRZEZ AGENTÓW — POTWIERDŹ STAN

Trzy pozycje z przekazania QA wymagają potwierdzenia w `07_ZNANE_BLEDY.md`,
bo są poważniejsze niż cokolwiek, co znalazłem z zewnątrz.

**Import harmonogramu kasował tabelę.** QA zgłosił przebieg 72→1 przed
naprawą P9 i 72→73 po. Sam autor pisze, że rzecz jest wrażliwa na dane
wejściowe i regresja jest łatwa. Napisz: czy jest test, na ilu wariantach
pliku, i co się dzieje przy pliku pustym, z inną kolejnością kolumn
i ze zmienionymi nagłówkami. To jest funkcja, która przy awarii kasuje
harmonogram klienta.

**Magazyn trwały bez wersjonowania.** QA zgłosił, że bez wyczyszczenia
pamięci przeglądarki aplikacja czyta stan sprzed zmiany schematu.
Napisz, jaki jest obecny numer wersji magazynu, gdzie jest sprawdzany
i co się stanie użytkownikowi, który ma w przeglądarce stan poprzedniej wersji.

**Brak pełnego przebiegu po P9.** QA zgłosił, że po naprawie importu
i blokady gotowości wykonano tylko sprawdzenia skupione, bez pełnego
przebiegu czternastu prób na aktualnej paczce. Napisz, czy taki przebieg
był po tej dacie. Jeżeli nie — to jest pozycja do etapu D, nie do zamknięcia
teraz.

---

# KOLEJNOŚĆ

```
C2.1  zamrożenie zegara
C2.2  skrypt generujący
C1    tabela fasady, uzgodniona z raportami QA
C3    kompletność języków
C4    indeks wiedzy z oceną aktualności
C5    rozstrzygnięcie referencji wizualnej
C6    dowody do repozytorium
C2.3  uruchomienie matrycy zrzutów
C2.4  test różnicy pikseli
      → wydanie dziesięciu plików
      → STOP, czekaj na akceptację przed etapem D
```

Bez zmian w kodzie poza trzema wyjątkami, które są narzędziami, nie
naprawami: zamrożenie zegara, skrypt zrzutów, test różnicy pikseli.
Wszystko inne czeka na etap D.
