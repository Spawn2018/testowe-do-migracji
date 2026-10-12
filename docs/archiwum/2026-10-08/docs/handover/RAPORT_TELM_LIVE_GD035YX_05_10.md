# Raport — TELM-EMTRACK-WEB LIVE (GD035YX) 05.10

Czas: **2026-10-05 ~13:12–13:25** Europe/Warsaw  
Polecenie: włączenie + test na żywo (pkt 0–6).

## Link dla właściciela (pkt 6)

- **Szczegóły transportu:** https://tower.log-mar.pl/#/transport/SG-03  
  (kod `SG-03` · zlecenie `15062/2026/OSL/GDA/P` · naczepa **GD035YX**)
- **Mapa:** https://tower.log-mar.pl/#/mapa (po otwarciu SG-03 szuflada + znacznik)

## 0. Blokada SMS/e-mail — potwierdzona PRZED flagą

| Test na sucho | Wynik |
|---|---|
| `pilot_redirect_dry_run` | **ok: true** |
| SMS na fikcyjny KSH `+48111222333` | zapisany jako **`+48695637907`** (właściciel) |
| E-mail na `ksh-fake@example.com` | recipient → **`sebastian@log-mar.pl`** |
| Oba wpisy | oznaczone EXPIRED / BLOCKED_R2 („pilot dry-run — nie wysyłać”) |

Migracja **0176**: tabela `pilot_notify_redirect` (load `963e19dd-…`), `sms_enqueue` + trigger e-mail + `sms_pull` dla numeru właściciela. Do odwołania właściciela.

## 1. Alarmy bez dopasowania

- Naczepa bez awizacji → `telematics_orphan_positions` (zapis), **zero** alarmów „brak dopasowania”.
- Dopasowana naczepa → `process_position` jak dotąd.

## 2. Flaga

`TELM_EMTRACK_WEB=**true**` (H1/H3/H6 nadal **false**). Edge `emtrack-web` wdrożony (naprawa WS Deno + filtr statusów).

## 3. Faza z pozycji

| Pole | Wartość |
|---|---|
| Pozycja | **62.558149, 17.651803** (Szwecja), **78 km/h**, źródło `EMTRACK_WEB` |
| Czas pozycji | **2026-10-05 13:21:02** Europe/Warsaw |
| Historia | `GEOFENCE_EXIT` LOADING (synthetic) + `STATUS_AUTO` „faza ustalona z pozycji naczepy przy podłączeniu” |
| Status | **`IN_TRANSIT_SE`** (po uzupełnieniu `carrier_order_no` z eventu SCX — wcześniej blokada numeru przewoźnika) |
| `actual_load_at` | 2026-10-05 13:21:02 WAW |
| ETA dostawy | **2026-10-06 07:03** Europe/Warsaw (liczone, nie „–” / pre_load) |
| Metoda ETA | ETA v2 (OSM) + odcinek SE; HERE Routing SE nie wołane (H1 wyłączone) |

## 4. Test na żywo — skrót

| Punkt | Wynik |
|---|---|
| Match GD035YX → SG-03 | **tak** (1 matched, 1 written) |
| Źródło | `EMTRACK_WEB` |
| Link warstwa 3 | w awizacji `telematics_vehicle_id=https://emtrack.eu/app/` — to URL aplikacji, nie osobny share-link; pozycja = warstwa 2 (web) |
| Porównanie z emtrack app | v6.32.0; 1 naczepa; odczyt zgodny (lat/lon/speed z currentSnapshot) |
| SMS-KSH-1H | jeszcze nie (ETA ≫ 60 min); gdy padnie — tylko numer właściciela (redirect) |
| Geofence unload → UNLOADED | czeka na dojazd (AT_SITE → MILESTONE_UNLOADED / reguły); data realizacji + NBP + paliwo przy UNLOADED |
| Mapa + ślad | pozycja w `positions`; UI: link powyżej |
| Przerwy / relogin | pierwszy LIVE: SELECT_PROTOCOL→LOGIN→GET→LOGOUT; wcześniejszy błąd „Invalid protocol value” naprawiony (Deno WS) |

## 5. Monitoring 72 h

- Cron `tower-emtrack-web` co **2 min** (0174).
- Próbka 3×/dzień vs emtrack.eu/app — w kolejnych raportach (po rozładunku, +24 h, +72 h).
- Problem logowania/formatu → `SOURCE_DOWN:EMTRACK_WEB` + e-mail admin (istniejący mechanizm).

## H-10 (steering)

Kod **nie** wydłuża ETA przez wiatr (tylko ostrzeżenie porywów ≥15 m/s / D-84 w `route-hazards`). **Brak propozycji wydłużania** — zostaje wyłączone rozszerzenie ETA; ostrzeżenie może działać.

## Dowody

- Migracja **0176** (prod)
- Edge `emtrack-web` (deploy po fix WS + filtrze)
- PR / commit w repo (ten przebieg)
- Domeny: `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` → **200**
