# wyglad/P6-e — Czat: „Przeczytali” (kto i kiedy), wiadomość w dzwonku, wejście z powiadomienia (16.10.2026, 03:30)

Podstawa:
- wiadomości właściciela 16.10.2026: 02:39 („nie widzę, kto i kiedy odczytał”), 02:57 (dzwonek: „SG-03 + kto + treść”), 03:06 (KSH nigdy nie dostaje rozmowy HHL ↔ SCX);
- E17 pkt 4, E19 (okno „Przeczytali”), decyzja 15.10, 03:12 (nazwiska i e-maile dla wszystkich firm), E41, E5;
- dopiski D-20261016-0250-01 Cz11, D-20261016-0310-01 Cz13 i Cz23, D-20261016-0315-01 Cz25; dane do podłączenia — D-20261016-0330-01.

Wygląd, teksty, obliczenia widoku i nawigacja (F8). Bez migracji, uprawnień i zapisów na serwer.

| Element | Było (P6-b) | Jest |
|---|---|---|
| Moja wiadomość bez odczytu | „✓ wysłane · nikt z SCX i KSH jeszcze nie otworzył” | „✓ Wysłane do HHL, SCX i KSH · nikt jeszcze nie otworzył” („tylko HHL i SCX” → „do HHL i SCX”) |
| Moja wiadomość z odczytami | „✓✓ przeczytali: SCX · KSH jeszcze nie” — same firmy | „✓✓ Przeczytali: 1 osoba · KSH jeszcze nie ⌄” → lista: **Jan Nowak** · SCX · 21.09, 11:12; pod listą „Jeszcze nie otworzyli: KSH”. Moje konto z dopiskiem „(Ty)”. Telefon: „✓✓ 1 osoba”, lista pod spodem, przycisk 44 px. |
| Cudza wiadomość | bez informacji | „Przeczytali: 1 osoba ⌄” → ta sama lista (E19: lista dla wiadomości, którą widzisz) |
| Wejście z powiadomienia | — | `?zakladka=czat&odpowiedz=1` → kursor w polu wiadomości; `&tekst=…` → tekst niewysłanej odpowiedzi w polu; parametry znikają z adresu |
| Dzwonek — wiadomość w Czacie | „SG-03 — Czat: 0005/09/S/2026” + „Anna: początek…” | „SG-01 · HHL/2026/1241 — Jan Nowak // Scandinavian Express” (KSH: „SG-01 — Anna Wiśniewska // H&H Logistics”, E41), w drugiej linii treść (do 160 znaków, dalej „…”), etykieta „tylko HHL i SCX”, godzina; kilka wiadomości jednego transportu — „3 nowe wiadomości”; „CZAT ›” otwiera Czat transportu |
| Otwarcie Czatu | dzwonek bez zmian | wiadomości tego transportu w dzwonku przeczytane (demo; produkcja — po podłączeniu, Cz22) |
| Opcje › Kto co dostaje, wiersz „Nowa wiadomość w czacie” | dzwonek; telefon tylko HHL Operacje i SCX Dyspozytor | dzwonek i telefon dla 5 rodzajów kont, bez e-maila (Cz13); opis „tylko do firm, które widzą wiadomość · „tylko HHL i SCX” nigdy do KSH, niezależnie od ustawień” (Cz25) |
| Dzwonek na telefonie | „Oznacz wszystkie…” i „Ryzyka” mniejsze niż 44 px | oba ≥ 44 px (E8) |

**Demo** (osoby zmyślone, G-09). SG-01:
- wiadomość HHL przeczytał SCX, KSH jeszcze nie — wpis w dzwonku u KSH;
- rozmowa „tylko HHL i SCX” od SCX — wpis w dzwonku tylko u HHL; u KSH ani w dzwonku, ani w Czacie.

**Sprawdzone** (podgląd demo, „teraz” 14.10.2026, 12:00; HHL, KSH, SCX; 1440, 768, 390, 360 px):
- e2e `e8-phone-gate`:
  - blok P6-e — 5/5 (HHL: lista i znikanie z dzwonka po otwarciu; KSH: brak „tylko HHL i SCX” w dzwonku; wejście z powiadomienia; telefon HHL i KSH — 0 w bramie E8);
  - regresja P6-b, P3-c, pasek górny, brama E8, P6 Ryzyka — zielone;
- unit `tests/p6e-chat.test.ts` — 10: kolejność odczytów, firmy bez odczytu, odmiana „osoba / osoby / osób”, parametry wejścia, tytuł E41, „3 nowe wiadomości”, skrócenie treści, demo bez rozmów HHL ↔ SCX u KSH, produkcja bez automatycznego odczytu dzwonka;
- całość unit: 147 plików, 1171 testów; pierwsze wczytanie 397,4 kB gzip (budżet 400).

**Do zrobienia po scaleniu #237:** Opcje › Dla mnie › „Ten telefon” — „Aplikacja zainstalowana: tak / nie”, „Zainstaluj aplikację”, zdania o przyciskach w powiadomieniu i o ekranie blokady (Cz23 pkt 4–5, Cz32). Wchodzą osobnym commitem po #237, żeby nie kolidować z tym samym ekranem.

**Zrzuty:**
- `czat-przeczytali-HHL-1440.webp`
- `czat-przeczytali-KSH-1440.webp`
- `czat-przeczytali-HHL-390.webp`
- `dzwonek-czat-HHL.webp`
- `dzwonek-czat-KSH.webp`
