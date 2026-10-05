# H-8 — profil trasy — **WYBÓR A** (05.10 ~13:42)

## Decyzja właściciela
**A** z doprecyzowaniem: elevation Routing v8 dla standardowego truck **teraz, bez D-83**.  
Naruszenia wymiarów (H-1/H-3) → automatycznie po D-83. Pula tras, 0 USD ponad.

## Realizacja
- Edge `route-profile` + panel w podglądzie transportu.
- `return=elevation,polyline,summary`; `transportMode=truck` bez `vehicle[*]` dopóki H1/H3 wyłączone.
- Po włączeniu H1 lub H3 (D-83): te same wywołania dostają wymiary zestawu + `spans=notices,…`.
