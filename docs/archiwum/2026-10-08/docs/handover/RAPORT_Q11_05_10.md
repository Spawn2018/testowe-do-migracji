# Q-11a / Q-11b — raport 05.10 (aktualizacja ~16:45)

## Q-11a — pięć rozmiarów — **DONE**
Brama wizualna i makieta pokrywają: **390, 768, 1280, 1440, 1920** (`tests/__screenshots__`, `G4_WZORZEC.md`, RESP-14).  
Dowód: PR **#91** (`d641810`), `RAPORT_Q11_05_10.md` (wcześniejszy wpis) + wzorzec wizualny.

## Q-11b — push Android / iOS — **DONE** (wybór A)
Web Push VAPID (0 zł): `push_subscriptions`, Preferencje, SW `push`/`notificationclick`, Edge `web-push-send` + `web-push-vapid-public`, DIGEST, iOS hint „Dodaj do ekranu głównego”.  
Dowód: PR **#94** (`bb1af8a`), migracja **0179**, `PROPOZYCJA_Q11B_PUSH.md`.
