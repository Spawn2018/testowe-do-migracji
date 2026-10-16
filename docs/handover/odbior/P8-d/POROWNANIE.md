# wyglad/P8-d — Automatyzacje (E35) — 16.10.2026, 02:20

| Element E35 (`img/e35-after`) | Przed (demo i produkcja) | P8-d |
|---|---|---|
| Zakładki | „Działa samo” · „Własne reguły · 12” | „Działa samo” · „Własne reguły · N” · „Przebiegi” · „Historia zmian”; na telefonie „Własne · N” i „Historia”, zakładki mieszczą się od 360 px |
| Własne reguły | 7 reguł START i 5 przykładowych, kody wyzwalaczy | po zmianie lista pusta (E35 pkt 2): „Brak własnych reguł. Wszystko, co działa bez człowieka, jest w zakładce „Działa samo”.”; reguła zdaniem „Gdy auto jest w strefie „Plac budowy Stegra Boden” dłużej niż 3 h — wtedy powiadomienie: HHL Operacje, SCX”, liczba przebiegów w 30 dniach, „Zmień”, „Wyłącz” / „Włącz”, „Usuń” |
| Kreator | okno z wyzwalaczem w 4 grupach, polem, operatorem („==”, „<”), wartością albo JSON | panel „Nowa reguła” obok listy (≥ 1280 px), na węższym ekranie zamiast listy, na telefonie na cały ekran: Nazwa; Gdy — „auto jest w strefie” / „zmienia się status” / „powstaje sprawa” / „codziennie o 06:00”; Strefa i „Dłużej niż” z list; Wtedy — powiadomienie (HHL Operacje, HHL Administrator, KSH, SCX), sprawa w Do zrobienia, e-mail (szablon E43), SMS do odbiorców Śrem / Boden według E42 (pytanie 1 = B); „włączona” (nowa reguła startuje wyłączona, jak na obrazie); Anuluj / Zapisz |
| Sprawdzenie | „Ostrzeżenie o duplikacie” po zapisie | „Sprawdź na ostatnich 30 dniach · zadziałałaby 1 raz: SG-03 · plac od 07.10, 08:35 → **07.10, 11:35** (wyjazd 12:19)”, „Wbudowane automaty robiące to samo: brak.”; przy powtórce „Własna reguła z tym samym „Gdy” i odbiorcą: …” |
| Przebiegi | niewidoczne | tabela Kiedy / Reguła / Transport / Wynik zdaniami: „nie pasuje: wjazd na plac, a reguła dotyczy strefy 50 km”, „powiadomienie: KSH 4 osoby, SCX 1 osoba”, „pominięte: reguły wyłączone (05.10)”; kliknięcie wiersza otwiera transport; telefon — karty |
| Historia | rozwijana lista z kodami akcji | „Historia zmian”: kiedy · kto · co · „„nazwa”” · powód; dawne przełączenia „powód: — (wtedy pola nie było)”; zmiana, wyłączenie, włączenie i usunięcie wymagają powodu |
| Prawa | Operacje HHL przekierowane na Kokpit | Administrator HHL zmienia; bez prawa zapisu — „Tylko podgląd · reguły zmienia Administrator HHL” (menu dla Operacji HHL — dopisek, P8) |

Sprawdzone (demo, 1440 / 1280 / 1100 / 768 / 430 / 390 / 360 px, jasny i ciemny):
- axe WCAG 2 A/AA — 0 (Działa samo, kreator z wypełnionym „Gdy” i „Wtedy”, pytanie o powód, Przebiegi, Historia);
- tekst < 12 px — 0, przewijanie strony w bok — 0;
- brama E8 telefonu: blok „wyglad/P8-d” 3 / 3 (Działa samo, Własne, kreator z błędami, Przebiegi, Historia — 360, 390, 430, 768); blok P4-c „Automatyzacje” przepisany (E35 pkt 2 — lista własnych pusta);
- fokus:
  - tytuł kreatora po „+ Nowa reguła” i „Zmień”;
  - pierwsze błędne pole po „Zapisz” (nazwa; przy zmianie — powód);
  - nazwa nowej reguły po zapisie;
  - pole powodu po „Wyłącz” / „Włącz” / „Usuń”; przycisk przełącznika po potwierdzeniu;
  - przycisk, który otworzył kreator, po „Anuluj”;
- jeden obszar komunikatów: „Dodano regułę…”, „Zapisano…”, „Reguła wyłączona.” / „włączona.”, „Reguła usunięta…”;
- testy `p8d-rules` 18 / 18; `b5-workflow-creator` przepisany na tryb produkcji (widok B-5 zostaje do podłączenia); cały `test:unit` zielony; pierwsze wczytanie 390,8 kB gzip (budżet 400); build produkcyjny bez danych demo reguł.

Produkcja: źródło `null` (`rulesOf()`, `rulesReady()`), więc zostaje dzisiejszy widok z kreatorem B-5 do podłączenia w P8 (dopisek D-20261016-0220-01).

Odstępstwa od obrazu (świadome):
- „Wtedy” ma też „powiadomienie: HHL Administrator”, „powiadomienie: KSH” i dwa przyciski SMS — obraz pokazywał przykład; SMS według Twojej odpowiedzi na pytanie 1 (B, 08.10, 12:14);
- „Włącz” też pyta o powód (historia ma powód przy każdym wpisie).

Zrzuty: `p8d-komputer-kreator.webp`, `p8d-komputer-kreator-ciemny.webp`, `p8d-komputer-przebiegi.webp`, `p8d-komputer-historia.webp`, `p8d-telefon-390.webp` (Działa samo, kreator, Własne, Przebiegi).
