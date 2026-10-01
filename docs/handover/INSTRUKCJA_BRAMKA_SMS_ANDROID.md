# Watch Tower — bramka SMS (Android)

Aplikacja na telefon z Androidem i kartą SIM. Pobiera kolejkę `sms_outbox`
(`sms_pull`), wysyła SMS, raportuje (`sms_report`) i bije (`sms_heartbeat`).

**Sekrety (token urządzenia, URL, klucz anon, numer SIM, klucz podpisu APK)
nigdy nie trafiają do repozytorium ani logów.**

## Gotowy plik (01.10.2026 · v1.0.1)

| Pole | Wartość |
|---|---|
| Plik | `D:\Watch Tower\dane\apk\WatchTowerSMS.apk` |
| Wersja | **1.0.1** (`versionCode` 2) |
| SHA-256 | `025e1942c2d5a227d7a496634783e636bb9e3269240eb32d1fdd8ea64137afdd` |
| Podpis | v2; klucz w `D:\Watch Tower\dane\apk-klucz\` (poza repo) |

**1.0.1:** `sentIntent` + `deliveryIntent` (SENT ≠ DELIVERED); odstęp ≥ 3 s;
błąd wysyłki → do 3 prób; brak DELIVERED > 10 min → ryzyko + e-mail HHL.

## Przeniesienie na telefon

1. **kabel USB:** podłącz telefon → w Eksploratorze Windows skopiuj
   `D:\Watch Tower\dane\apk\WatchTowerSMS.apk` do folderu Pobrane / Download.
2. **Dysk Google:** wgraj ten sam plik na Drive właściciela → otwórz na
   telefonie w aplikacji Dysk → Pobierz.

## Instalacja (krok po kroku)

1. Na telefonie otwórz plik `WatchTowerSMS.apk` (Pliki / Dysk / Downloads).
2. Jeśli Android zapyta — włącz **instalację z nieznanego źródła**
   (dla Plików / Dysku / przeglądarki — przełącznik „Zezwalaj z tego źródła”).
3. Zainstaluj / zaktualizuj **Watch Tower SMS** do **1.0.1**.
4. Uruchom aplikację. Przy pierwszym starcie zaakceptuj:
   - **SMS** (wysyłanie),
   - **powiadomienia** (Android 13+).
5. W ustawieniach aplikacji wpisz (lub zostaw po aktualizacji):
   - **URL projektu Supabase** (produkcja),
   - **klucz anon** (publiczny: Supabase → Settings → API),
   - **token parowania** — w aplikacji web: Opcje → Odbiorcy SMS i strefy →
     Bramka SMS → „Wydaj urządzenie” (token widać **raz**; skopiuj od razu),
   - **numer SIM bramki** w E.164 (np. `+48…` / `+46…`) — numer karty
     w **tym** telefonie (nie w repozytorium).
6. **Zapisz ustawienia**.
7. **Wyłącz oszczędzanie baterii** (przycisk w aplikacji) → „Bez ograniczeń”
   / „Nie optymalizuj” dla Watch Tower SMS.
8. **Uruchom bramkę** — w pasku powiadomień: „Bramka SMS aktywna”.
9. **Autostart** po restarcie: jeśli była włączona, startuje sama.
   Xiaomi/Samsung: Ustawienia → Aplikacje → Watch Tower SMS →
   Autostart / uruchamianie w tle → **włącz**.

## Po sparowaniu (kolejność właściciela)

1. W Opcjach dodaj **numer właściciela** jako numer testowy.
2. Wyślij **SMS testowy** — w kolejce ma być **SENT**, potem **DELIVERED**
   (Opcje → Bramka SMS → Ostatnie SMS).
3. Seria akceptacyjna: `node scripts/sms-burst-test.mjs` → **10/10 DELIVERED**.
4. Dopiero potem włącz wyzwalacze stref (DECYZJE §5) i wpisz odbiorców 2+2.
5. W **Stanie systemu** sprawdź „ostatni kontakt”; cisza > 15 min
   → ryzyko + e-mail (cron w bazie).

## Ponowna budowa (wykonawca)

Wymaga JDK 17, Android SDK (`platforms;android-35`, `build-tools;35.0.0`),
Gradle wrapper w `android/sms-gateway/`. Klucz: `D:\Watch Tower\dane\apk-klucz\`.

```bat
cd android\sms-gateway
gradlew.bat assembleRelease
copy app\build\outputs\apk\release\app-release.apk "D:\Watch Tower\dane\apk\WatchTowerSMS.apk"
```

GitHub Actions — **nie używamy** na razie.

## Bezpieczeństwo

- Token urządzenia: SHA-256 w bazie; jawny tylko przy wydaniu i w telefonie.
- Aplikacja nie loguje tokenu.
- Limit 150 SMS/dobę i 20 wywołań/min — po stronie bazy.
- Plik `.jks` i `keystore.properties` wyłącznie w `D:\Watch Tower\dane\apk-klucz\`.
