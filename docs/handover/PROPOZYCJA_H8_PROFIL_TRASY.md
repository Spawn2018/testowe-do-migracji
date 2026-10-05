# Propozycja H-8 — profil trasy (Map Attributes niedostępne)

Data: **2026-10-05**

## Wymaganie
Nachylenia, miejsca niebezpieczne (wypadki), nawierzchnia (dojazd Boden) w podglądzie transportu.

## Blokada techniczna
HERE **Map Attributes** nie jest w planie Base (od 03.2025) — tę samą usługę usunęliśmy z H-3.

## Opcje (bez budowy do wyboru właściciela)
| Opcja | Opis | Koszt HERE |
|---|---|---|
| **A** Routing v8 `return=elevation` + notices | Profil wysokości + naruszenia z trasy truck | pula tras |
| **B** OSM / open data | Nachylenia z DEM, nawierzchnia z OSM; wypadki osobno (np. STRADA/SE) | 0 USD |
| **C** Odłożyć | Czeka na Attributes w planie / inny produkt HERE | — |

Rekomendacja: **A** po D-83 (wymiary) i w ramach puli tras; do tego czasu panel „Profil trasy” może pokazywać „niedostępne — czeka na wybór H-8”.
