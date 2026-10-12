# B-Q — odpowiedzi na pytania logiki 1–19 (zbiorczy dowód)

Data: **2026-10-05**. Źródła: `LOGIKA_SYSTEMU.md`, `PLAN.md` (L-*), wdrożenia Q-17–19 / B-MAPA.

| # | Pytanie | Odpowiedź / dowód |
|---|---|---|
| 1 | Powiadomienia pasek/baner | Kolejka `notifications` + preferencje użytkownika; baner systemowy osobno (`SystemBroadcastBanner`) |
| 2 | Dzwonek | Te same powiadomienia nieprzeczytane; filtr ról |
| 3 | Wymaga decyzji / Centrum | Decyzje z `decision_*` / ryzyka wymagające akcji HHL |
| 4 | Statusy | Automat z GPS/stref (`STATUSY_AUTOMATYCZNE`, `auto_set_status`); TELM faza z pozycji |
| 5 | Alternatywy rejsu / drogi | Plan B / HERE alternatives (H-1/H-3 wył. do D-83) |
| 6 | Faktury opłacone | Tylko HHL oznacza opłacenie (LOGIKA) |
| 7 | Stena w pasku | AIS + ferry-status (AIS-SRC) |
| 8 | Bez EN/SV w treści biznesowej | PL-DATA; UI ma locale użytkownika |
| 9 | Tryb jasny | Q-9 B — motyw z systemu (wdrożone) |
| 10 | Zegar | Europe/Warsaw ops; SE lokalne w dostawie |
| 11 | Responsywność | Q-11a — brama wizualna 390/768/1280/1440/1920 |
| 12 | Kokpit | Etapy korytarza + KPI |
| 13 | Workflow 3 kont | Silnik 0094; widoczność HHL_ADMIN |
| 14 | Logowanie | AuthGate Supabase; MFA flaga |
| 15 | Strefy | Geofence engine + SMS stref (blokada pilot dla GD035YX) |
| 16 | Trasy OSM | Korytarz 0122; HERE opcjonalnie |
| 17 | Statki | Q-17/Q-18 AIS |
| 18 | Ulice / podkład | B-MAPA HERE raster + zapas |
| 19 | (pozostałe Q) | Q-19 w B-MAPA |

Szczegóły UI/reguł: `LOGIKA_SYSTEMU.md`, `docs/handover/wzorzec/`.
