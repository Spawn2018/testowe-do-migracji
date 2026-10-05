# WIP — BAF i ceny (polecenie 05.10 ~21:48 + uzup. ~21:51 + SG-03/TELM ~22:31) — **ZAMKNIĘTE 05.10 ~23:08**

Czas Europe/Warsaw.

| Element | Stan |
|---|---|
| PR **#129** (`fix/baf-ceny-05-10`, ostatni commit `6e0d584`) | **scalony** → `main` `47594e1` |
| Brama lokalna | pełna, zielona na `6e0d584` (baf **36/36**, dec-auto 64/64, h4 19/19, i2 535/535 …; session/l13 = KNOWN-DEBT, niesprawdzane). Uwaga: przebieg `/tmp/gate_baf6.log` był fałszywie czerwony — równolegle działała stara brama z przerwanego wątku (skasowała szablon `tower_boot`); powtórka `/tmp/gate_baf7.log` zielona |
| Migracja **0187** | **na PROD** (dry-run → apply → verify): tydz. 40 = **1,14**, tydz. 41 = **1,13**, published_on 0 pustych, 86/94 wycenione |
| Migracja **0188** `0188_telm_faza_bez_zaladunku.sql` | **na PROD**: `telm_infer_phase_from_position` nie ustawia `actual_load_at`; faza w `telm_attach_phase` („faza z pozycji przy podłączeniu”); korekta `telm_fix_attach_actual_load()` |
| Audyt ścieżki TELM (PROD) | tylko **SG-03** 15062/2026/OSL/GDA/P: `actual_load_at` 05.10 13:21 → pusty; data paliwa 01.10 → tydz. 40 → **1,14 OSTATECZNY**; koszt 6 900 + 966 = **7 866,00**, przychód **8 259,30** EUR |
| Edge `fuel-prices` | wdrożona v4 (GoEasy Diesel firmowa + published_on), bez tokenu → 403 |
| Vercel | `dpl_ijSQmsw6W16cDt9LBRVn2sHxn7HT` READY z `main` `47594e1`; tower.log-mar.pl 200, watch-tower-makieta.vercel.app 200 |
| Raport 94 | `RAPORT_BAF_CENY_94_05_10.md` z PROD po 0187+0188; sekcja „Transporty bez ceny: 8/94” |

## 8 bez ceny
KR-08 … KR-15 (bez nr zlecenia): `NO_CONVOY` — brak daty załadunku w pliku KSH → nie da się ustalić liczby aut w konwoju (stawka KR 1/2/3 auta). Wycena wstrzymana, nie zero; odblokuje się po wpisaniu daty (trigger przelicza).
