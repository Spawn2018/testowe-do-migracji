# Propozycja Q-11b — powiadomienia na telefon (PWA)

Data: 2026-10-05. Bez budowy do wyboru litery.

## Jak działa
Web Push z aplikacji otwartej z przeglądarki (PWA), bez sklepu.
Android: zawsze (Chrome/Edge). iPhone: tylko po „Dodaj do ekranu głównego”, iOS 16.4+.
Koszt docelowy: 0 zł (Web Push / VAPID; bez FCM płatnego planu).

## Zdarzenia (DEC-4 + L-13)
- Krytyczne: natychmiast na telefon (jak e-mail krytyczny — jedno zdarzenie).
- Niekrytyczne: w skrócie dziennym albo wyłączone z push (zależnie od wariantu).
- Widoczność firm jak DEC-4 (macierz admina).

## Warianty
| | Opis |
|---|---|
| **A** | Tylko krytyczne natychmiast + skrót niekrytycznych 1×/dzień. Włącz/wyłącz w Preferencjach. |
| **B** | Krytyczne + wybrane grupy z macierzy DEC-4 (użytkownik wybiera grupy). Bez skrótu push. |
| **C** | Odłożyć push; zostaje in-app + e-mail + SMS. |

**Rekomendacja: A** — najmniej hałasu (L-13), zero kosztów, działa na Android i iOS PWA.
