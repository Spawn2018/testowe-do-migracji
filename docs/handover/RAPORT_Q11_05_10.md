# Q-11a / Q-11b — raport 05.10

## Q-11a — pięć rozmiarów
Brama wizualna i makieta pokrywają: **390, 768, 1280, 1440, 1920** (`tests/__screenshots__`, `G4_WZORZEC.md`).  
Smoke CSS: `@media` w `auth.css` i layoutach Nav/Map.  
**Status:** uznane za spełnione wzorcem wizualnym (bez nowego UI).

## Q-11b — push Android / iOS
W aplikacji: powiadomienia **in-app** + e-mail (Resend) + SMS bramka.  
**Brak** Web Push / FCM / APNs w repo (0 `serviceWorker` push, 0 FCM).  
**Status:** wymaga osobnej decyzji (PWA push vs natywna powłoka) — **nie zbudowane**; nie blokuje pilotażu in-app.
