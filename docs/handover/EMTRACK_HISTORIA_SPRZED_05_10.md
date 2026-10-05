# Emtrack — historia trasy sprzed podłączenia (05.10.2026)

**Pytanie właściciela:** czy przy podłączeniu transportu w trasie da się odczytać historię naczepy sprzed pierwszego fixu w Tower (SG-03: przed 13:25)?

## Wynik: NIE (protokół WEB, stan na 05.10)

Źródło: `docs/handover/RAPORT_TELM_EMTRACK_WEB_05_10.md` + kod `supabase/functions/_shared/telematics/emtrackWeb.ts`.

Dozwolone ramki (tylko odczyt): `SELECT_PROTOCOL` → `LOGIN` → `GET_TRACKING_OBJECTS` → opcjonalnie `SUBSCRIBE` → `LOGOUT`.

- Lista obiektów zwraca **`currentSnapshot`** (bieżąca pozycja), nie pełną trasę historyczną.
- Próba `GET_TRACKING_OBJECTS_SNAPSHOTS` → **ERROR_403**.
- Nie wynaleziono / nie użyto innej komendy historii — zgodnie z zasadą „nie wymyślaj API”.

## Skutek dla H-4
Przy mid-trip attach: **założenie ostrożne** (`0186_h4_ostrozne_niepewnosc.sql`) zamiast „świeży kierowca”. Gdy pojawi się oficjalne API z historią — dopiero wtedy budować import last_rest / driven_today.
