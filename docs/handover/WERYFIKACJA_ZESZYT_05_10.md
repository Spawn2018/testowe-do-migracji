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

## Konta (pkt 5 polecenia 05.10) — wykonane 14:46 PL
| Akcja | Przed | Po |
|-------|-------|-----|
| 3× `sebastian+tower-o3-*` | active=false, 0 FK | **usunięte** z `app_users` + `auth.users`; wpis `audit_log` USER_DELETED_OWNER_05_10 |
| `s.hotowczyc@scandimavian.com.pl` | literówka, active=false | **usunięte** (poprawne `@scandinavian.com.pl` już było); audit USER_TYPO_REMOVED |
| marek@hyzyk.pl, p.duks@…, s.hotowczyc@scandinavian… | active=false | **bez zmian** (wyłączone do R-2); bez zaproszeń |
Kopia JSON: lokalnie poza repo (`agent-data/.../konta-backup/`). **R2:** wrangler wylogowany — dograć gdy właściciel zaloguje Cloudflare (poczekalnia).

| 3.1 | zezwolenie per firma obok polisy, auto wg wymiarów | **⛔** — czeka na wymiary D-83 | — | — |
| 3.2 | Ubezpieczenie automatycznie podpina się do każdej trasy | **poprawione** — `load_insurance_cover`: APPROVED polisa SCX → 94/94; notka w szufladzie Dokumenty | `3.2.png` (+ overview) | PR (ten) · migracja **0182** |

## Raport sekcji 3 (Dokumenty)
- Zgodne: 0 · Poprawione: 1 (3.2) · ⛔: 1 (3.1 D-83)
- Wdrożenie: PR #99/#100/#101, migracje **0182–0183**, Vercel READY; domeny **200**
- Polisa startowa SCX `OCP-SCX-2026-WT` (APPROVED) → kompletność **94/94**; notka w szufladzie Dokumenty

| 4.1 | Finanse HHL — bez „pilotaż”; paliwo OK | **zgodne** — przychód HHL bez słowa „pilotaż”; linia paliwowa widoczna | `4.1.png` (+ `4-overview.png`) | stan prod |
| 4.2 | Faktury — załączniki CMR (nie POD) | **zgodne** — „Załączniki CMR”; upload wymusza CMR | `4.2.png` | stan prod |

## Raport sekcji 4 (Finanse)
- Zgodne: 2 · Poprawione: 0 · ⛔: 0 · Wdrożenie: nie wymagane

| 5.1 | Przycisk „Nowa automatyzacja” + utworzenie reguły | **zgodne** — przycisk otwiera kreator (Nazwa / Zdarzenie / Zapisz / Anuluj) | `5.1.png` (+ `5.1-kreator.png`) | stan prod |

## Raport sekcji 5 (Automatyzacje)
- Zgodne: 1 · Poprawione: 0 · ⛔: 0 · Wdrożenie: nie wymagane

| 6.1 | „Jak działa” przy Powiadomieniach i decyzjach | **zgodne** — `b6_howto_notif` + macierz widoczności | `6.1.png` | stan prod |
| 6.2 | Odbiorcy SMS i strefy — opis | **zgodne** — howto + listy stref / SMS | `6.2.png` | stan prod |
| 6.3 | Progi i terminy — opis mechanizmu | **zgodne** — howto + progi (fala, wiatr, opóźnienie, awizacja) | `6.3.png` | stan prod |
| 6.4 | Stan systemu jak pulpit | **zgodne** — bramka SMS, Resend, DeepL, kopia zapasowa | `6.4.png` | stan prod |
| 6.5 | Dziennik logowań pokazuje wpisy | **zgodne** — wpisy z datą, IP, UA | `6.5.png` | stan prod |
| 6.6 | Historia zmian — nie ma „200” obok przycisku | **poprawione** — usunięta notka z liczbą; limit pobrania zostaje | `6.6.png` | PR #103 · `dpl_2ZH73rHhUHBwQcwqeukpMfqmRdjN` |
| 6.7 | Cennik — tabela nie przesunięta w prawo | **zgodne** — tabela w `.rate-table-wrap`, offset ~13 px (padding) | `6.7.png` | stan prod |
| 6.8 | SEFS/BAF — średnie PL/SE z poprzedniego tygodnia same | **zgodne** — tydzień 28.09–04.10: SEK 7 / PLN 6 odczytów → średnie + mnożnik; `data-sefs-week=ok` | `6.8.png` | stan prod |
| 6.9 | Wymóg zezwoleń — nie przesunięty w prawo | **zgodne** — body left ≈ panel | `6.9.png` | stan prod |

## Raport sekcji 6 (Opcje)
- Zgodne: 8 · Poprawione: 1 (6.6) · ⛔: 0
- Wdrożenie: PR #103, `git archive` → Vercel READY `dpl_2ZH73rHh…`, tower.log-mar.pl **200**, watch-tower-makieta.vercel.app **200**

| 7.1 | Mapa stały rozmiar, cała widoczna | **zgodne** — `data-b7=fixed-map`, h≈685, fullyInView | `7.1.png` | stan prod |
| 7.2 | Checkboxy zawsze widoczne; telefon nie nachodzi | **zgodne** — na 390px `.maplayers` position:static nad mapą | `7.2.png` | stan prod |
| 7.3 | Filtry mapy — nowe (brak GPS, ryzyko) + opis | **zgodne** — „Bez GPS” / „Ryzyko” + `title` ze znaczeniem | `7.3.png` | stan prod |

## Raport sekcji 7 (Mapa)
- Zgodne: 3 · Poprawione: 0 · ⛔: 0 · Wdrożenie: nie wymagane

| 8.1 | Brak kolumny „Zlecenie KSH” | **poprawione** — usunięte `ord_ksh` | `8.1.png` | PR #105 · `dpl_8ke8GygJ…` |
| 8.2 | Kolumny HHL-KSH i HHL-SCAN | **poprawione** — etykiety „Nr zlecenia HHL-KSH/SCAN” | `8.1.png` | PR #105 |
| 8.3 | Godziny przy datach załadunku/dostawy | **częściowo** — rok zawsze; godzina gdy jest okno planu/awizacji (wiele wierszy bez okna → tylko data) | `8-overview.png` | PR #105 · pytanie poczekalnia |
| 8.4 | Mechanizm „Zmień ciągnik” | **zgodne** — przycisk w komórce Nr rej. | `8-overview.png` | stan prod |
| 8.5 | Linie pionowe w tabeli | **poprawione** — `border-right` na th/td | `8-overview.png` | PR #105 |
| 8.6 | Zwężanie kolumn chowa tekst | **zgodne** — resize min 0, `cell-clip` / fixed layout | `8-overview.png` | stan prod |
| 8.7 | Brak transportów STANDARD | **zgodne** — w tabeli brak TYP STANDARD (import B-8-IMP) | `8-overview.png` | stan prod |
| 8.8 | ETA delay ≥24h → dni+godz+min | **poprawione** — np. `+1d 18h 00m` | `8-overview.png` | PR #105 |
| 8.9 | Statusy/filtry + nowe (daty, bez kierowcy/ciągnika) | **zgodne** — filtry dat + Bez kierowcy/ciągnika; brak osobnego howto (title częściowy) | `8-overview.png` | stan prod · howto → poczekalnia |
| 8.10 | Polisa w dokumentach podpięta | **zgodne** — kolumna Dok. pokazuje m.in. Z/C; auto OCP z 3.2 | `8-overview.png` | stan prod (§3.2) |
| 8.11 | Daty z rokiem | **poprawione** — `formatSchedTableDay` zawsze `dd.MM.yyyy` | `8-overview.png` | PR #105 |
| 8.12 | Kierowca: pusty „–”; dwóch z separatorem | **poprawione** — puste „–”; para przez `formatTowerPair` | `8-overview.png` | PR #105 |
| 8.13 | Telefon dwóch „tel1|tel2” | **poprawione** — para telefonów (przy przepięciu „|”) | `8-overview.png` | PR #105 |
| 8.14 | Eksport PDF: kierowca+telefon zamiast promu | *(do domknięcia przy weryfikacji PDF)* | — | — |
| 8.15 | Filtr dat załadunku i rozładunku | **zgodne** — Załadunek od–do / Rozładunek od–do | `8-overview.png` | stan prod |

## Raport sekcji 8 (Harmonogram)
- Zgodne: 7 · Poprawione: 7 · Częściowo: 1 (8.3) · Otwarte: 1 (8.14)
- Wdrożenie: PR #105, Vercel READY `dpl_8ke8GygJ…`, domeny **200**

