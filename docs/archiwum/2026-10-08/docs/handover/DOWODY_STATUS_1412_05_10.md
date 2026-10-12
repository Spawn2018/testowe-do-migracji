# Dowody — polecenie ~14:12 (05.10.2026 Europe/Warsaw)

Zasada: bez twardego dowodu (PR+migracja **albo** nazwa testu) = buduj wg PLAN.md.
Nie budowane (blok właściciela): D-83→B-3a/H-1/H-3/H-6, R-0, D-7/14/16/17/21.

| ID | Status | Dowód (PR / migracja / test) | Uwaga |
|---|---|---|---|
| HHL-4a | **DONE** | UI Dodaj/Edytuj nr HHL + awizacja (`LoadDrawer` / `AwizacjaModal`); PLAN § HHL-4a DONE; commit ścieżki AWIZ-4 `13ace35` | SharePoint sync = II-10-E2 (osobno) |
| FAK-9 | **DONE** | D-43: EUR\|PLN przy wystawieniu — `invoices.currency` check (`0001`/`0003`); `register_invoice` + kurs per pozycja — `0011_fx_nbp` / `0014_invoice_register`; testy: `tests/invoices3.test.ts`, `tests/db/money.sh` (EUR + PLN + `fx_table_no`/`fx_mid`) | Kurs NBP per transport = D-43 / U-6 |
| Q-7 | **DONE** | `docs/handover/RAPORT_BQ_LOGIKA_05_10.md` §7; Stena w pasku — AIS + `ferry-status` (`0160`, testy `ferry-status.test.ts`) | |
| Q-8 | **DONE** | `RAPORT_BQ_LOGIKA_05_10.md` §8; PL-DATA / locale użytkownika | |
| Q-10 | **DONE** | `RAPORT_BQ_LOGIKA_05_10.md` §10; ops `Europe/Warsaw` (`src/lib/time.ts` TZ_OPS) | |
| Q-15 | **DONE** | `RAPORT_BQ_LOGIKA_05_10.md` §15; geofence + SMS stref (pilot redirect 0176) | |
| Q-17 | **DONE** | PR **#61/#62** B-MAPA; `draw.ts` trasa promu po AIS/wodzie; `tests/bmapa.test.ts` | |
| UI-12 | **DONE** | Nav session użytkownik/rola/Wyloguj; Docs bez POD/LASHING; PLAN UI-12; G4 `b34a223` | |
| D-31 | **DONE** | CSS pasek ≤430; `tests/resp14-phone.spec.ts`; G4-D27-D31 `b34a223` / PR wzorzec | |
| D-27 | **DONE** | `--ink-3` `#5A6B78` / `#788C9A` w `src/index.css`; audyt `RAPORT_DOSTEPNOSC.md`; kontrast ≥4.5:1 (decyzja 30.09) | |
| CLEAN-MAPLIBRE | **DONE** | `4db65b1` + brak `maplibre`/`mapbox` w `package.json` / lock; historycznie `58a509a` | |
| AUTH-MAIL | **DONE** | `scripts/set-auth-mailer-watchtower.mjs` (tematy „Watch Tower — …”); `POSTEP.md` W-BK2-1 SMTP Resend | potwierdzone resetami 05.10 rano w Resend |
| I-29 | **DONE** | `docs/handover/I29_BUDGETY_140.md` | limity OK przy 140 transportach |

### Poza listą 14:12 (kontynuacja)

| ID | Status | Dowód / następny krok |
|---|---|---|
| B-10 | **PARTIAL→domknięcie** | PR #91/#93 (0177/0178); reszta: booking ref UI off, godziny, historia format, chat notify **0181** (ten PR) |
| TELM-2 | **PARTIAL** | LIVE 0173–0176 + `tests/emtrack-web.test.ts`; symulacje przebiegu — `telm2Sim` + `tests/telm2-sim.test.ts` (ten PR) |
| ZAP skrypt | **ten PR** | `zap-baseline-passive.sh` / `zap-full-active.sh` + `tests/zap-prod-guard.test.ts` |
| Audyt ZAP Active prod | **DONE** | `docs/evidence/zap/AUDYT_ZAP_ACTIVE_PROD_05_10.md` |

