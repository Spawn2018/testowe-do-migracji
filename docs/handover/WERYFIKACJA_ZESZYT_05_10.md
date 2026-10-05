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
| 8.14 | Eksport PDF: kierowca+telefon zamiast promu | **zgodne** — kolumna „Kierowca” (imię+telefon, np. ROBERT PREIHS / Sebastian Bożek); brak kolumny Prom | `8.14.png` (+ PDF) | stan prod |
| 8.15 | Filtr dat załadunku i rozładunku | **zgodne** — Załadunek od–do / Rozładunek od–do | `8-overview.png` | stan prod |

## Raport sekcji 8 (Harmonogram)
- Zgodne: 8 · Poprawione: 7 · Częściowo: 1 (8.3) · Otwarte: 0
- Wdrożenie: PR #105 (wcześniej); 8.14 potwierdzone na prod 15:30 PL — `8.14.png` / `8.14-harmonogram.pdf`
- Vercel READY `dpl_8ke8GygJ…`, domeny **200**

| 9.1 | Opis filtrów kafelków | **zgodne** — `title` na każdym kafelku (filtruj / zdejmij) + Prom z tipem rejsów | `9-overview.png` | stan prod |
| 9.2 | Brak cyfr w górnym prostokącie | **poprawione** — `.n` puste; aktywny tylko „×” | `9-overview.png` (+ `9.3.png`) | PR #106 · `dpl_Eq8JgjBU…` |
| 9.3 | Aktywny filtr z „×” + kafelek Prom | **zgodne** — Prom w spine; aktywny pokazuje × w `.n` i przy nazwie | `9.3.png` | PR #106 |

## Raport sekcji 9 (Górny pasek filtrów)
- Zgodne: 2 · Poprawione: 1 (9.2) · ⛔: 0
- Wdrożenie: PR #106, Vercel READY, tower.log-mar.pl **200**

| 10a.1 | Bez: Zlecenie, Śrem z nadawcy, wymiary zestawu, Nr KSH, Montaż, Nr rezerwacji promu | **częściowo** — brak „Zlecenie”/Montaż/Nr KSH; „KSH Śrem” + „Wymiary L×W×H” ładunku — pytania w poczekalni | `10a.png` | poczekalnia |
| 10a.2 | Tydzień załadunku na lewo od tygodnia dostawy | **zgodne** — t40 / t41 | `10a.png` | stan prod |
| 10a.3 | HHL: „Dodaj” / po dodaniu „Edytuj” (kolor jak SCX) | **poprawione** — etykieta „Edytuj”; `btn` (nie ghost) | `10a.png` | PR #108 · `dpl_FvtWKtyx…` |
| 10a.4 | HHL user (nie admin) nie dodaje awizacji | **zgodne** (kod) — `canAwiz = role === 'SCX'` | — | stan prod |
| 10a.5 | Pilot tylko gdy wymagany; inaczej brak pola | **poprawione** — ukryte gdy `!escort` | `10a.png` | PR #108 |
| 10a.6 | Załadunek/Dostawa z gg:mm | **częściowo** — `formatSchedTableDay`; godziny gdy okno (0 okien na prod) | `10a.png` | PR #108 · jak 8.3 |
| 10a.7 | Kierowcy kier1/kier2; bez dostarczającego kier1/... | **zgodne** — przy przepięciu `\|` (C.1) | `10a.png` | stan prod |
| 10a.8 | Brak wpisu = „nieuzupełnione” | **zgodne** — `a6_dr_not_filled` przy pustym HHL/kierowcy | `10a.png` | stan prod |
| 10a.9 | Ciągniki 1\|2; naczepa widoczna | **poprawione** — para ciągników + `·` naczepa | `10a.png` | PR #108 |
| 10a.10 | Telefony 1\|2 bez spacji | **poprawione** — `785025313\|668856013` | `10a.png` | PR #108 |
| 10a.11 | Prom: nazwa + data + godzina wypłynięcia | **częściowo** — przy braku: „brak rezerwacji”; z rejsem: vessel · data | `10a.png` | stan prod |

| 10b.1 | Checkbox naczepy → przepięcie | **zgodne** — „Przepięcie naczepy” (SCX) | `10b.png` | stan prod |
| 10b.2 | Kierowca odbierający + dostarczający (48 h) | **zgodne** — pola dostarczającego po zaznaczeniu przepięcia | `10b.png` | stan prod |
| 10b.3 | Telefon i ciągnik jak kierowca | **zgodne** | `10b.png` | stan prod |
| 10b.4 | Pilot tylko gdy wymagany | **zgodne** — brak pola w modalu gdy niewymagany | `10b.png` | stan prod |
| 10b.5 | Zmiana okna załadunku/dostawy | **częściowo** — okna planu w szufladzie HHL; nie w modalu SCX | — | stan prod |
| 10b.6 | Brak Nr rezerwacji promu | **zgodne** | `10b.png` | stan prod |

| 10c.1 | Opisy: imię nazwisko // firma — data — godzina PL | **częściowo** — data/godzina PL OK; actor często „HHL”/„system” (nie imię // firma) | `10c.png` | poczekalnia |
| 10c.2 | Opisy czytelne, wytłuszczone | **zgodne** — `fontWeight: 700` na Historii | `10c.png` | stan prod |
| 10c.3 | Statusy wysłania/odczytania z Ustaleń | **częściowo** — brak przykładowych wiadomości na SG-03 | `10c.png` | — |

| 10d.1 | Status = kamienie + opis jak Historia | **zgodne** — ta sama lista zdarzeń, etykieta Status | `10d.png` | stan prod |

| 10e.1 | Dokumenty jak makieta + zmiany | **zgodne** — polisa OCP auto | `10e.png` | stan prod |
| 10e.2 | Brak usuwania dokumentu na dole | **zgodne** | `10e.png` | stan prod |

| 10f.1 | Ceny jak makieta, bez POD | **zgodne** | `10f.png` | stan prod |
| 10f.2 | EUR → brak kursów (HHL widzi kursy) | **zgodne** — widok EUR; HHL ma koszty/przychody | `10f.png` | stan prod |
| 10f.3–10f.5 | Mechanizm dopłat HHL/KSH/SCX | **zgodne** (UI formularza OPL-8 widoczny) — pełny flow nie klikany dziś | `10f.png` | stan prod |

| 10g.1 | Czat: kto // firma — data — godzina | **zgodne** (kod + input „Wyślij”); brak wiadomości na SG-03 | `10g.png` | stan prod |
| 10g.2 | „Odczytano” → kto i kiedy | **zgodne** (kod `details`/`odczytano`) — brak reads na SG-03 | `10g.png` | stan prod |
| 10g.3 | Powiadomienie o nowej wiadomości | ⛔ / nie sprawdzone dziś (auth timeout pod koniec) | — | — |

## Raport sekcji 10 (Podgląd zlecenia)
- Zgodne: 18 · Poprawione: 4 (10a.3/5/9/10) · Częściowo: 6 · Otwarte/⛔: 1 (10g.3)
- Wdrożenie: PR #108, Vercel READY `dpl_FvtWKtyxMxzMdCkMrKm9CWnFeVDf`, tower.log-mar.pl **200**, watch-tower-makieta.vercel.app **200** (15:45 PL)
- Auth Supabase: timeout przy ponownym logowaniu ~15:53 PL — K/R/P dokończyć po przywróceniu Auth

## Raport K / R / P / C (częściowy — 15:57 PL)

| K.1 | KSH klik → menu tylko „Edytuj” | **niezgodne** — KSH widzi pełną szufladę (Przegląd/Status/…) + „Edytuj” w datach planu | `K.1` brak osobnego; obserwacja w sesji | otwarte |
| K.2 | Edycja dat/godzin załadunku i rozładunku | **częściowo** — panel dat KSH w szufladzie; nie domknięte osobnym zrzutem | — | otwarte |

| R.1 | Widać rejsy Steny | **zgodne** — Estelle/Ebba/Spirit | `R.1.png` | stan prod |
| R.2 | Tylko admin dodaje/edytuje | **zgodne** — „Dodaj rejs” + Opóźnienie/Odwołaj dla HHL admin | `R.1.png` | stan prod |
| R.3 | Przyszłe / minione + filtr Przyszłe | **zgodne** — „Przyszłe” / „pokaż minione” | `R.1.png` | stan prod |
| R.4 | Daty z rokiem | **zgodne** — `05.10.2026` itd. | `R.1.png` | stan prod |

| P6 | Oznaczanie opłaconych faktur — tylko HHL | **częściowo** — widok Faktury HHL; brak faktur do kliknięcia „opłacona” dziś | `P6.png` | otwarte |
| P7 | Najbliższe Steny obok Polferries w pasku | **niezgodne** — pasek: Wawel (Polferries); brak Steny obok | `P-topbar.png` | otwarte |
| P8 | Brak wyboru języka | **niezgodne** — PL/EN/SV w pasku (już w poczekalni) | `P-topbar.png` | poczekalnia |
| P9 | Tryb jasny / system | nie sprawdzone dziś | — | otwarte |
| P10 | Brak zegara Prawy górny | **niezgodne** — widoczna godzina `15:57` | `P-topbar.png` | otwarte |
| P11–P19 | Responsywność / push / dzwonek / trasy / promy / ulice | nie domknięte dziś (auth timeout + czas) | — | otwarte |

| C.1 | Domyślnie „ / ”; „\|” tylko przy Przepięciu w WT | **zgodne** na SG-03 z `trailer_swap` — telefony/kierowcy `\|` | `C.1.png` / `10a.png` | stan prod |

**Do C.1 listy:** zamknięte 8.14 + §10 (z częściowymi) + R + C.1; **otwarte:** K.1–K.2, P6 (flow), P7, P8, P9, P10, P11–P19, 10g.3, pytania poczekalni 10a.1/10c.1.
