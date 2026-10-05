# Q-11b — push — **WYBÓR A** (05.10 ~13:42)

## Decyzja właściciela
**A:** Web Push VAPID (0 zł). Krytyczne od razu; jeden skrót niekrytycznych dziennie; włącz/wyłącz Preferencje; DEC-4 + L-13; iPhone: instrukcja „Dodaj do ekranu głównego”.

## Realizacja
- `push_subscriptions` + `user_preferences.web_push_enabled`
- SW `push` / `notificationclick`
- Kolejka `notifications.channel=WEB_PUSH` (PENDING krytyczne, DIGEST niekrytyczne)
- Edge `web-push-send` + publiczny VAPID w `web-push-vapid-public`
