# Audyt dostępności (SCOPE 11.5, PLAN Etap III „audyt dostępności”, III-12) — 28.09.2026

**Zakres:** build demo z HEAD (port 4189, zamrożony zegar jak w bramie wizualnej), 1440 × 900, język PL.
3 role (HHL, KSH, SCX) × 2 motywy × wszystkie widoki z menu = **54 widoki**.
**Narzędzie:** `npm run audit:a11y` (`scripts/a11y/audit.mjs`): axe-core 4.13 (reguły WCAG 2.0/2.1 poziom A i AA) oraz własny test
klawiatury (elementy z kursorem „rączka”, do których nie da się dojść klawiszem Tab). Wyniki: `docs/evidence/a11y-2026-09-28-przed.json`, `…-po.json`.
Czytnik ekranu: sprawdzony pośrednio przez reguły axe (nazwy dostępne, role, struktura list); bez testu z NVDA/VoiceOver.

## Wynik

| Reguła / test | Przed | Po poprawkach (ten commit) | Uwagi |
|---|---|---|---|
| `label` — pole formularza bez nazwy (krytyczne) | 14 (Faktury, Opcje: oferta faktoringu) | **0** | `aria-label` z etykiety `dt` — wygląd bez zmian |
| `select-name` — lista wyboru bez nazwy (krytyczne) | 22 (Opcje/Ustawienia: język, waluta, motyw; jednostka terminu) | **0** | jw. |
| `scrollable-region-focusable` — przewijana tabela bez klawiatury | 8 (Mapa, Harmonogram) | **0** | naprawione razem z wierszami (niżej) |
| Klawiatura: klikalne wiersze tabel nieosiągalne Tab-em | 1402 elementy | **362** | wiersze otwierające szufladę/edycję (Mapa, Harmonogram, Zadania, Rachunki ×2, Faktury, Drogi SE, Dokumenty, Strefy) mają teraz `tabIndex=0` + Enter/Spacja (`src/lib/clickableRow.ts`); obrys tylko przy `:focus-visible` (kliknięcie myszą wygląda jak dotąd) |
| `list` — `<ul class="exq">` z `<li role="button">` | 12 | **0** (28.09, druga poprawka) | `ExceptionRow`: bez `role="button"`, `clickableRow` (Tab + Enter/Spacja); DOM i klasy bez zmian — wygląd bez zmian |
| `color-contrast` — kontrast tekstu < 4,5 : 1 | ciemny 104 · jasny 1223 węzły | bez zmian | **wymaga decyzji — D-27** (zmiana tokenów = zmiana wyglądu makiety) |

Pozostałe 362 z testu klawiatury to elementy z „rączką” **bez żadnej akcji**: nagłówki tabel (`thead th{cursor:pointer}` w makiecie —
sortowania nie ma), wiersze tabel bez akcji (`tbody tr{cursor:pointer}` globalnie) i `div.mrow` w Ryzykach/Finansach. To mylący
kursor, nie brak dostępu — do rozstrzygnięcia razem z D-27 (usunięcie kursora zmienia makietę).

## Kontrast — co nie spełnia WCAG AA (do D-27)

| Token (src/index.css) | Motyw | Para kolorów | Kontrast | Gdzie | Propozycja (minimalna zmiana) |
|---|---|---|---|---|---|
| `--ink-3` `#6C7D8A` | jasny | na `#FFFFFF` / `#F4F7F9` / `#E3E9ED` | 4,25 / 3,95 / 3,47 | podpisy, `.sub`, meta w tabelach — ~1000 węzłów | `#5A6B78` (5,51 / 5,12 / 4,50) |
| `--ink-3` `#748896` | ciemny | na `#16242F` | 4,29 | jw. w panelach | `#788C9A` (4,53) |
| `--amber` `#C97E12` jako tekst | jasny | na `--amber-bg` `#FBEFD9` / biały | 2,84 / 3,24 | chipy „ostrzeżenie” | tekst `#A55A00` (4,54 / 5,17), tło bez zmian |
| `.bell-badge` biały na `--red` `#E8687C` | ciemny | | 3,13 (10 px) | licznik dzwonka | tekst ciemny `#0E1A24` albo czerwień ciemniejsza |

Test po zmianie: `npm run audit:a11y` + `npm run gate:visual` (zmienią się praktycznie wszystkie ujęcia — nowy wzorzec do zatwierdzenia).

## Druga poprawka (28.09, pozycja (1) planu)
`list` 12 → 0; `A11Y_STRICT=1 npm run audit:a11y` kończy się kodem 1 przy każdym naruszeniu poza kontrastem — stan: **0 naruszeń poza kontrastem** w 54 widokach (`docs/evidence/a11y-2026-09-28-po2.json`). Pozostaje: kontrast 1327 węzłów i kursor bez akcji (362) — D-27.
