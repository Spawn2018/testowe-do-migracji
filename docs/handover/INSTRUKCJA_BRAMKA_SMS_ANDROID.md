# Watch Tower — bramka SMS (Android)

Aplikacja na telefon z Androidem i kartą SIM. Pobiera kolejkę `sms_outbox`
(`sms_pull`), wysyła SMS, raportuje (`sms_report`) i bije (`sms_heartbeat`).

**Sekrety (token urządzenia, URL, klucz anon, numer SIM) nigdy nie trafiają
do repozytorium ani logów.** Wpisuje je właściciel w ustawieniach aplikacji
albo jednorazowo z panelu Opcje → „Odbiorcy SMS i strefy” / Bramka SMS.

## Budowa APK

Na tym komputerze wykonawcy **nie ma JDK/Android SDK** — APK buduje:

1. **Android Studio** (zalecane dla właściciela): otwórz folder
   `android/sms-gateway` → Build → Build Bundle(s) / APK(s) → Build APK(s).
   Plik: `app/build/outputs/apk/release/app-release-unsigned.apk`
   (albo podpisany debug: `app/build/outputs/apk/debug/app-debug.apk`).
2. **GitHub Actions** (workflow `.github/workflows/sms-gateway-apk.yml`) —
   po pushu na `main` artefakt `sms-gateway-debug.apk` do pobrania.

Do testów wystarczy **debug APK** (instalacja z pliku).

## Instalacja na telefonie (krok po kroku)

1. Skopiuj APK na telefon (USB, Drive, e-mail do siebie).
2. Otwórz plik → pozwól na **instalację z nieznanego źródła** dla tej aplikacji
   (Pliki / Chrome / Drive — włącz przełącznik).
3. Zainstaluj **Watch Tower SMS**.
4. Uruchom aplikację. Przy pierwszym starcie zaakceptuj **uprawnienie SMS**
   (i powiadomienia na Android 13+).
5. Wpisz:
   - **URL projektu Supabase** (produkcja),
   - **klucz anon** (publiczny z panelu Supabase → Settings → API),
   - **token parowania** — w aplikacji web: Opcje → Odbiorcy SMS i strefy →
     Bramka SMS → „Wydaj urządzenie” (token pokazuje się **raz**; skopiuj
     od razu na telefon),
   - **numer SIM bramki** w formacie E.164 (np. `+4670…`) — numer karty
     w tym telefonie.
6. **Zapisz ustawienia**.
7. **Wyłącz oszczędzanie baterii** (przycisk w aplikacji) — wybierz „Bez ograniczeń”
   / „Nie optymalizuj” dla Watch Tower SMS.
8. **Uruchom bramkę** — w pasku powiadomień pojawi się „Bramka SMS aktywna”.
9. Autostart: aplikacja startuje po restarcie telefonu, jeśli była włączona.
   Na niektórych markach (Xiaomi/Samsung) dodatkowo: Ustawienia → Aplikacje →
   Watch Tower SMS → Autostart / uruchamianie w tle → **włącz**.

## Po sparowaniu (kolejność właściciela)

1. W Opcjach dodaj numer właściciela jako **numer testowy**.
2. Wyślij **SMS testowy** wyłącznie na ten numer — potwierdź doręczenie.
3. Dopiero potem włącz wyzwalacze stref (DECYZJE §5) i wpisz odbiorców 2+2.
4. W **Stanie systemu** sprawdź „ostatni kontakt” bramki; cisza > 15 min
   → ryzyko + e-mail (cron w bazie).

## Bezpieczeństwo

- Token urządzenia: SHA-256 w bazie; jawny tylko przy wydaniu i w telefonie.
- Aplikacja nie loguje tokenu.
- Limit 150 SMS/dobę i 20 wywołań/min — po stronie bazy.
