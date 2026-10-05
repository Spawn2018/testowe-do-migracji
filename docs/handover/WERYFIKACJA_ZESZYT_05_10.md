# Weryfikacja zeszytu B/C na produkcji — 05.10.2026

Zasada: DONE tylko gdy na **produkcji** wygląda i działa jak **dosłowne** słowa właściciela z `ZLECENIE_POPRAWKI_02_10.md` (część B/C). Dowód = zrzut w `docs/evidence/zeszyt/<numer>.png`. Bez zrzutu = niezrobione.

Źródło listy: `LISTA_KONTROLNA_ZESZYT.md`.

| numer | słowa właściciela (dosłownie / skrót z listy) | wynik | zrzut | PR / migracja |
|-------|-----------------------------------------------|-------|-------|---------------|
| 1.1 | Na mapach jest wiele obiektów — pomimo braku podłączonych pojazdów → nie ma obiektów bez prawdziwych pojazdów (tylko naczepa SG-03 i promy) | **zgodne** — 1 znacznik GPS EMTRACK_WEB (GD035YX / SG-03); 4 promy AIS; 0 demo. Uwaga w poczekalni: napis „N pojazdów w ruchu” liczy progress. | `1.1.png` (+ `1.1-390.png`) | stan prod |
| 2.1 | brak wypłynięć Steny → widać wypłynięcia Steny | **zgodne** — „Prom i Bałtyk” + tabela rejsów Stena Ebba/Spirit/Estelle | `2.1.png` | stan prod |
| 2.2 | brak widoczności warunków drogowych w SE → widać warunki drogowe w Szwecji | **zgodne** — „Warunki drogowe SE · E4 i E22” · Trafikverket live | `2.2.png` | stan prod |
| 2.3 | Centrum decyzji — jak działa i dlaczego nic nie ma? Jaka jest logika? → widać, jak działa (opis logiki) | **poprawione** — lista spraw (44) + rozwijane „Jak to działa” (`b6_howto_centre`) | `2.3.png` | PR #97 · `dpl_EjiSd7PVoGAZC7LqWX7oQHmbzfm1` |

## Raport sekcji 1 (Mapy)
- Zgodne: 1 · Poprawione: 0 · ⛔: 0 · Wdrożenie: nie wymagane

## Raport sekcji 2 (Ryzyka)
- Zgodne: 2 · Poprawione: 1 (2.3) · ⛔: 0
- Wdrożenie: PR #97, `git archive` → Vercel READY, tower.log-mar.pl **200**, watch-tower-makieta.vercel.app **200**
