# Audyt skutków ZAP Active Scan na PROD — 05.10.2026

## Okno czasowe (Europe/Warsaw)

| | |
|---|---|
| Start ZAP | **13:58:10** (log `/tmp/zap-start.log`, Java prefs) |
| Active scanning | od ~13:58:10 (log: „Active scanning”) |
| Raport HTML | **13:58:55** (`Generated on Mon, 5 Oct 2026 13:58:55`) |
| Okno audytu DB (padded) | **13:56:00 – 14:02:00** Europe/Warsaw |
| Okno ścisłe Active | **13:58:10 – 13:58:55** Europe/Warsaw (= 11:58:10–11:58:55 UTC) |
| Cel | `https://tower.log-mar.pl` |
| Metoda | `zap.sh -quickurl` — **spider + Active Scan** (niezgodne z poleceniem „tylko pasywny”) |

## Wynik skrót

| Obszar | Skutek ZAP Active? | Szczegóły |
|---|---|---|
| Nowe/zmienione wiersze (90 tabel `public`) | **NIE** (śmieci ZAP = 0) | Aktywność w oknie = migracja 0180 + cron TELM/AIS/TV — nie payloady skanu |
| E-mail (Resend) | **NIE** | Brak wysyłek w oknie 13:56–14:02; ostatnie RISK_SEVERITY ~12:10 PL |
| SMS | **NIE** | 0 nowych `notifications` SMS w oknie; `EXTERNAL_MESSAGING=false` |
| Push | **NIE** | 0 powiadomień PUSH; job `web-push-send` w cronie `sent`-compatible, bez ZAP |
| Logowania / sesje Auth | **NIE** | `auth.users` created/updated 0; sessions/refresh/identities 0; audit Auth 0 |
| Blokady kont (`banned_until`) | **BRAK** | 0 banów — **nic do zdjęcia** |
| Resety haseł | **NIE** | Brak w oknie (resety rano ~09:23 PL — przed skanem) |
| Storage uploads | **NIE** | 0 obiektów w oknie |
| Limity Resend / HERE / DeepL | **bez skoku ze skanu** | patrz tabela limitów |

**Śmieci ZAP do akceptacji kasowania: lista pusta.** Nic nie kasowano.

---

## Tabele `public` z aktywnością w oknie 13:56–14:02 (klasyfikacja)

| Tabela | Utworzone / zmiana | Klasyfikacja | Uwagi |
|---|---|---|---|
| `app_parameters` | 3 (CSP_REPORT_ONLY_UNTIL, DOC_RETENTION_*) | **LEGIT — migracja 0180** | ~13:59:50 PL; decyzja właściciela ~13:53 |
| `audit_log` | 3 × ROW_INSERT app_parameters | **LEGIT — 0180** | source=system |
| `corridor_conditions` | 2 | **LEGIT — cron road-se / Trafikverket** | SE_E4, SE_E22 |
| `integration_runs` | 19 | **LEGIT — cron** | ferry-ais*, emtrack-web, doc-retention, send-notifications, road-se, web-push… |
| `positions` | 3 | **LEGIT — TELM emtrack-web LIVE** | naczepa GD035YX / SG-03 |
| `vessel_positions` | 3 | **LEGIT — AIS/Stena** | |
| pozostałe ~84 tabele | 0 w oknie | — | w tym loads, load_messages, decisions, notifications, documents |

W oknie **ścisłym** Active (13:58:10–13:58:55): wyłącznie joby `ferry-ais-listen` + `emtrack-web` (TELM) — nie ZAP.

---

## Auth / konta

| Check | Wynik |
|---|---|
| `auth.users` banned_until | **[] puste** |
| Nowe konta / identity / session w oknie | **0** |
| Blokady do zdjęcia po ZAP | **brak** |

### LISTA do akceptacji (NIE kasowano / NIE ruszano) — konta `app_users.active=false` *sprzed* skanu

Te wpisy **nie pochodzą ze skanu ZAP** (brak `updated_at` w oknie). Auto-aktywacja **wstrzymana** — decyzja właściciela:

| e-mail | rola | note |
|---|---|---|
| sebastian+tower-o3-hhl@log-mar.pl | HHL_OPS | test O3a |
| sebastian+tower-o3-ksh@log-mar.pl | CLIENT_USER | test O3a |
| sebastian+tower-o3-scx@log-mar.pl | CARRIER_DISPATCH | test O3a |
| marek@hyzyk.pl | HHL_ADMIN | dezaktywowany wcześniej |
| p.duks@scandinavian.com.pl | CARRIER_DISPATCH | |
| s.hotowczyc@scandinavian.com.pl | CARRIER_DISPATCH | |
| s.hotowczyc@scandimavian.com.pl | CARRIER_DISPATCH | literówka domeny? |

---

## Powiadomienia / Resend / limity

| Źródło | Stan |
|---|---|
| `notifications` w oknie ZAP | **0** |
| Resend list-emails w oknie 13:56–14:02 | **0** (ostatnie RISK_SEVERITY ~12:10 PL) |
| Resend usage (po skanie) | daily **24/100**, monthly **453/3000** |
| HERE `here_usage` (miesiąc od 01.10) | tiles 2953 / routing 4 — **$0.00** (w puli); brak przyrostu powiązanego ze skanem (H1 false) |
| DeepL `deepl_usage` | 3002 / 1_000_000 znaków |
| `usage_history` (05.10 07:00 PL) | Edge 0.49%, DB 9.45%, Storage ~0% — pomiar poranny, nie skan |

Flagi bez zmian po skanie: `TELM_EMTRACK_WEB=true`, `H1/H3/H6=false`, `EXTERNAL_MESSAGING=false`.

---

## Śmieci — lista do akceptacji

| ID | Opis | Akcja |
|---|---|---|
| — | **Brak wierszy uznanych za śmieci ZAP** | nic nie kasować |

(HTTP noise Active Scan na statycznych assetach Vercel nie zostawia wierszy w DB aplikacji.)

---

## Naprawa skryptów (ten PR)

| Skrypt | Rola |
|---|---|
| `scripts/zap-baseline-passive.sh` | daemon + spider + **tylko** passive → HTML; **bez** ascan |
| `scripts/zap-full-active.sh` | Active **tylko** po guardzie anti-prod |
| `scripts/zap/prodGuard.mjs` | `tower.log-mar.pl` + `watch-tower-makieta.vercel.app` = ODMOWA |
| `tests/zap-prod-guard.test.ts` | test: prod odrzuca Active |

**Nie używać** `zap.sh -quickurl` na prod.

