# Propozycja H-8 — profil trasy (Map Attributes niedostępne)

Data: **2026-10-05** (uzupełnione ~13:37)

## Wymaganie
Nachylenia, miejsca niebezpieczne, nawierzchnia (dojazd Boden) w podglądzie transportu.

## Blokada
HERE Map Attributes nie w planie Base (od 03.2025) — usunięte też z H-3.

## Warianty (bez budowy)
| | Co widać | Gdzie / kto | Źródło i koszt | D-83 |
|---|---|---|---|---|
| **A** | Profil wysokości (`return=elevation`) + naruszenia/notices z trasy truck (jak H-1/H-3) | Panel „Profil trasy” w szczegółach transportu; HHL + SCX (KSH odczyt jeśli macierz) | Routing v8 — **pula tras** D-78 (5000/mies.). Szacunek: ~1–2 TX / transport / 30 dni przy odświeżeniu ≈ **100–200**/mies. przy 94 (w puli → 0 USD ponad) | **Tak** — truck+wymiary jak H-1 |
| **B** | Nachylenia z DEM/OSM, nawierzchnia OSM; wypadki osobno (np. źródła SE) | Ten sam panel | **0 USD** HERE | Nie |
| **C** | Odłożyć do Attributes / innego produktu HERE | Panel „niedostępne” | — | — |

**Rekomendacja: A** po D-83 (spójne z H-1/H-3, jedna pula tras). Do D-83: panel może pokazywać „czeka na wymiary / wybór H-8”. Jeśli chcesz coś wcześniej bez wymiarów → **B**.
