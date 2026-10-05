# Raport przed budową — TELM-EMTRACK-WEB

Data: **2026-10-05 ~12:44–12:50** · Europe/Warsaw  
Polecenie: `POLECENIA_KOORDYNATORA.md` (~12:44).  
Sekrety: `EMTRACK_LOGIN` / `EMTRACK_PASSWORD` — **nie** w tym pliku, logach ani kodzie.

---

## 0) Cel
Warstwa zapasowa telematyki (D-36): gdy brak oficjalnego API emtrack → odczyt pozycji **naczepy** przez ten sam protokół co web `emtrack.eu/app` (tylko odczyt).

---

## 1) Publiczny klient (bez logowania)

| Fakt | Wartość |
|---|---|
| URL | `https://emtrack.eu/app/` |
| `meta name="version"` | **6.32.0** |
| Stack | AngularJS (`ng-app="mtrack"`) |
| Bundle | `js/mtrack.dee440a27f3631c1d7d4.js` + `EnvConfiguration.js` |
| WS (HTTPS) | `wss://emtrack.eu:443/ws/` (`wsSecureHost/Port/Path`) |
| Sesja HTTP | nagłówek `X-Mtrack-SessionId`; cookie `mtrackSessionId_app-1` |
| REST | `https://emtrack.eu/webclient-rest/` (m.in. reset hasła) |
| reCAPTCHA | Enterprise key w `EnvConfiguration` — **tylko** ścieżka resetu hasła (`user/passwordreset`), nie login WS |

### Komunikaty WebSocket (JSON `{id,type,data}`)

1. **SELECT_PROTOCOL** → `data: { version: "MTRACK_WWW", compression: null }`  
   Odpowiedź: `SELECT_PROTOCOL_RESPONSE` `{ protocol: "accepted" }` (albo redirect).
2. **LOGIN** → `data: { auth, username, password, lang }`  
   - Enum `AuthenticationType`: `DIRECT=0`, `INTERNAL=1`, `TOKEN=2`, `DRIVER_PIN=3`  
   - W ramce `auth` = **nazwa** enum (`AuthenticationType[n]`), np. `"INTERNAL"`.  
   - Dla konta właściciela UI wysyła **`auth: "INTERNAL"`** (zweryfikowane przechwytem WS).  
   - `auth: "DIRECT"` → `ERROR_400` (serwer próbuje `parseInt` loginu).  
   Odpowiedź: `LOGIN_RESPONSE` z `success`, `sessionId`, `user`, `permissions`, …
3. **GET_TRACKING_OBJECTS** → `data: { trackingObjectIds: [] }` (= wszystkie)  
   Odpowiedź: `{ trackingObjects: [ … ] }`
4. **SUBSCRIBE** / **UNSUBSCRIBE** → `data: { channel }`  
   Kanały: `TRACKING_OBJECTS`, `TRACKING_OBJECT_HEARTBEAT`, `TRACKING_OBJECT_PARAMETERS_SNAPSHOT`, …
5. **LOGOUT**, **KEEPALIVE**

Serializacja: `JSON.stringify` po WebSocket (klient `ReconnectingWebSocket`).

### Model obiektu (lista + pozycja)

Z `ProtocolDTO.trackingObject` + żywej odpowiedzi:

| Pole | Znaczenie |
|---|---|
| `trackingObjectId` | id wewnętrzne |
| `name` | nazwa wyświetlana |
| `textId` | **rejestracja** (np. `GD035YX`) |
| `type` | string enum, m.in. **`TRAILER`**, `TRUCK`, … |
| `producer` / `model` / `vin` | opcjonalne |
| `currentSnapshot.ts` | czas próbki (ms) |
| `currentSnapshot.d.C.v` | `{ lat, lng }` |
| `currentSnapshot.d.S.v` | prędkość |
| `currentSnapshot.d.I.v` | stacyjka / ignition |
| `currentSnapshot.d` | parametry skrócone (`C`,`S`,`I`,`M`,…); wartości `{ ts, v }` |

Parametry (publiczny enum): `C=coordinates`, `S=speed`, `I=ignition`, `M=mileage`, `TRAILER_ID=203`, …

---

## 2) Jednorazowy odczyt (READ-ONLY) — porównanie z UI

Źródła w tej samej chwili (~12:48 PL):

| | Probe WS (skrypt) | UI `emtrack.eu/app` (Chromium) |
|---|---|---|
| Wersja meta | 6.32.0 (oczekiwana) | **6.32.0** |
| Auth | INTERNAL | **INTERNAL** |
| Liczba obiektów | **1** | **1** (lista: `GD035YX - SEXPG12`) |
| Nazwa | `GD035YX - SEXPG12` | to samo |
| Rejestracja (`textId`) | `GD035YX` | to samo |
| Typ | `TRAILER` (naczepa) | to samo |
| Pozycja | ~`62.30, 17.34` (SE) | `62.31279, 17.342307` |
| Prędkość | ruch (61→76 km/h w kolejnych próbkach) | 76 |
| Wiek próbki | ~30 s | ~27 s |
| Producent | MAX TRAILER | (zgodnie z kartą obiektu) |

**Wniosek:** ten sam obiekt naczepy, te same pola; różnice lat/lng/speed wynikają z kolejnych próbek GPS w ruchu (kilkadziesiąt sekund między probe a UI), nie z innego źródła.

Ramki **wysłane** (log typów, bez payloadów wrażliwych):  
`SELECT_PROTOCOL` → `LOGIN` → `GET_TRACKING_OBJECTS` → `SUBSCRIBE`×N → `LOGOUT`.  
UI dodatkowo: `CHAT_SESSION_OPEN` (nieużywane przez nas).

Push: w oknie ~10 s widać `PUBSUB_EVENT` (rzędu kilku–kilkunastu). **Polityka PR5** (2 min w ruchu / 15 min postój) to nasz limit odpytywania, nie częstotliwość emtrack.

---

## 3) Zasady implementacji (z polecenia)

| Zasada | Jak |
|---|---|
| Tylko odczyt | Wyłącznie SELECT_PROTOCOL, LOGIN, GET_TRACKING_OBJECTS, SUBSCRIBE (opcjonalnie), LOGOUT. Zero komend do urządzenia / zapisu ustawień. |
| Jedna sesja | Jeden WS + jeden `sessionId`; bez równoległych loginów. |
| PR5 | Poll / odświeżenie: **2 min** gdy ruch (speed>0 lub ignition), **15 min** w postoju. |
| Backoff | Przy błędzie sieci / 5xx — wykładniczy; nie spamować loginem. |
| UA | Nagłówek przeglądarki (Chrome desktop). |
| Captcha | Tylko reset hasła w REST — jeśli kiedyś wymagana przy loginie → **stop + alarm**, bez omijania. |
| `meta version` | Oczekiwane **6.32.0**; zmiana → ryzyko + e-mail HHL; **stop** gdy format ramek/pól niezgodny. |
| Log | Dziennik **typów** wysłanych ramek (bez username/password/sessionId). |

---

## 4) Warstwy D-36 (kolejność źródeł pozycji)

1. **Oficjalne API emtrack** (TELM-2) — gdy będzie dokumentacja / klucz.  
2. **TELM-EMTRACK-WEB** (ten raport) — zapas web-protokołu.  
3. **Linki podwykonawców** — ostatnia deska.  

Przy każdej pozycji w bazie: pole **źródło** (`EMTRACK_API` | `EMTRACK_WEB` | `SUBCONTRACTOR_LINK` | …).  
Awaria warstwy → automatycznie następna.

---

## 5) Dopasowanie naczepa → transport (jak TELM-2)

Bez zmian reguł biznesowych względem TELM-2:

- awizacja / rejestracja naczepy (`textId` ↔ pojazd w transporcie),  
- strefy (geofence),  
- przepięcie naczepy,  
- prom = AIS (nie GPS naczepy na morzu),  
- próg postoju (ETA / milczenie).

Budowa adaptera **po** akceptacji tego raportu / równolegle wg kolejności polecenia (PRZED dalszym PLAN poza tą pozycją).

---

## 6) Ryzyka / uwagi

- Konto używa `INTERNAL` (nie `DIRECT`) — kod musi wysyłać to, co UI, albo konfigurowalny `EMTRACK_AUTH_TYPE` (domyślnie INTERNAL).  
- `GET_TRACKING_OBJECTS_SNAPSHOTS` zwróciło `ERROR_403` dla id obiektu — do budowy wystarcza `currentSnapshot` z listy (+ SUBSCRIBE).  
- Timestampy emtrack są w ms; wiek próbki liczyć w Europe/Warsaw.  
- Zero zapisu do emtrack w testach; Hobby / bez wydatków SMS.

---

## 7) Pliki pomocnicze (lokalne, poza repo)

Sondy w `/tmp/emtrack-ws/` (nie commitować): `probe2-result.json`, `browser-compare.json`, `after-login.png`.
