# wyglad/P6-d — E37 „Komunikaty zdaniami” (15.10.2026, 21:05)

| Sytuacja | Było | Jest (E37) |
|---|---|---|
| Link do zamkniętej sprawy | „Brak dostępu” | „Ta sprawa jest już zamknięta (wygasła 06.10).” + „Otwórz transport” (gdy wykonawca poda dane, K1) |
| Sprawa innej firmy | „Tę decyzję rozstrzyga inna firma.” | „Tę sprawę prowadzi SCX. Możesz ją tylko podejrzeć.” |
| Koniec sesji | „… zaloguj się ponownie linkiem z e-maila” | „… Zaloguj się e-mailem i hasłem.” |
| Błąd e-maila | „Wysyłka e-maili nie jest jeszcze skonfigurowana (SMTP Resend — krok właściciela).” | „Nie udało się wysłać e-maila. Spróbuj za kilka minut.” |
| Zaproszenie bez e-maila | „Zaproszenie zapisane, ale e-mail nie wyszedł: {błąd}” | „Zaproszenie zapisane, ale e-mail nie wyszedł. Spróbuj za kilka minut.” |

Testy: `tests/access-note.test.ts` (4), `tests/session-year.test.ts` przepisany (E37). Bez zapytań i zapisów.
