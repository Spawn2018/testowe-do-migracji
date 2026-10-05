# Poczekalnia — uwagi poza bieżącą sekcją listy

| Data (PL) | Kto | Treść | Docelowa pozycja listy |
|-----------|-----|-------|------------------------|
| 2026-10-05 14:31 | executor (obserwacja przy 1.1) | Górny pasek: widoczne PL / EN / SV | P8 |
| 2026-10-05 14:31 | executor (obserwacja przy 1.1) | Zegar w prawym górnym rogu (np. 14:31) | P10 |
| 2026-10-05 14:31 | executor (obserwacja przy 1.1) | Napis „N pojazdów w ruchu” liczy `progress`, nie GPS — może mylić przy 1.1 | pytanie: czy licznik ma pokazywać tylko pojazdy z prawdziwym GPS? |
| 2026-10-05 14:46 | executor | Kopia usuniętych kont O3/typo — dograć do R2 po logowaniu Cloudflare | po liście / R2 |
| 2026-10-05 14:49 | executor | TEST DB bez `insurance_policies.approval_status` (0125) — nałożyć 0125+ na TEST przed pełną bramą 0182 | brama TEST |
| 2026-10-05 15:22 | executor | 8.3: godziny w tabeli tylko gdy jest okno planu/awizacji — wiele wierszy ma samą datę; czy uzupełniać domyślną godziną? | 8.3 |
| 2026-10-05 15:22 | executor | 8.9: brak rozwijanego „Jak to działa” przy filtrach harmonogramu (są title/aria częściowo) | 8.9 |
| 2026-10-05 15:25 | executor | 10a.1: „KSH Śrem” w miejscu załadunku — czy to „Śrem z nadawcy” do usunięcia, czy adres OK? | 10a.1 |
| 2026-10-05 15:25 | executor | 10a.1: „Wymiary L×W×H” ładunku vs „wymiary zestawu” — czy zostawić wymiary ładunku? | 10a.1 |
| 2026-10-05 15:50 | executor | 10c.1: actor w Historii to często „HHL”/„system” zamiast „imię nazwisko // firma” — czy wzbogacić actor z profilu? | 10c.1 |
| 2026-10-05 15:54 | executor | Auth Supabase: upstream timeout przy password/magiclink — zablokowało dokończenie K/R/P/C na prod | K/R/P |
| 2026-10-05 15:57 | executor | P7: pasek najbliższych — Wawel (Polferries), brak Steny obok | P7 |
| 2026-10-05 15:57 | executor | P10: zegar `gg:mm` nadal w pasku | P10 |
| 2026-10-05 15:57 | executor | K.1: KSH ma pełną szufladę zamiast bocznego menu tylko „Edytuj” | K.1 |

| 2026-10-05 16:10 | executor | **ZAMKNIĘTE na prod (PR #111):** P8 język, P10 zegar, K.1–K.2 menu KSH | — |
| 2026-10-05 16:18 | executor | **P6 + 10g.3 ZAMKNIĘTE** (faktura testowa; 0184 chat notify). Lista kontrolna zamknięta poza pozycjami do decyzji. | — |

| 2026-10-05 16:22 | właściciel | Decyzje A–F (10a.1, 10c.1, 8.3, 8.9, licznik GPS, raport R2) — wykonywane | A–F |
| 2026-10-05 16:40 | executor | **A–F ZAMKNIĘTE** (A–E fix+prod+zrzuty; F = `R2_KOPIA_KONT_O3_BRAKI.md`) | — |

## D-1 — wyjaśnienie 2026-10-05 ~16:45

„D-1” na liście czekających w raporcie zeszyt = **pomyłka nazwy**: cennik **D-1 jest ZREALIZOWANY w I-30** (SYMBOL w bazie TEST+PROD). To, co nadal czeka u właściciela przy stawkach/produkcji, to **R-1** (import prawdziwego harmonogramu + akceptacja czyszczenia), nie osobna decyzja cennika D-1.
