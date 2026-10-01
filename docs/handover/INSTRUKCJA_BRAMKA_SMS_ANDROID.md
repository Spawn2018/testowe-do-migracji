# Watch Tower — bramka SMS (Android)

Aplikacja na telefon z Androidem i kartą SIM. Pobiera kolejkę `sms_outbox`
(`sms_pull`), wysyła SMS, raportuje (`sms_report`) i bije (`sms_heartbeat`).

**Sekrety (token urządzenia, URL, klucz anon, numer SIM, klucz podpisu APK)
nigdy nie trafiają do repozytorium ani logów.**

## Gotowy plik (01.10.2026 · v1.0.3)

| Pole | Wartość |
|---|---|
| Plik | `D:\Watch Tower\dane\apk\WatchTowerSMS.apk` |
| Wersja | **1.0.3** (`versionCode` 4) |
| SHA-256 | `64eca1b17e8a0c179d17cda99041860f9c189636a0271bfed622afa24eef8c05` |
| Podpis | v2; klucz w `D:\Watch Tower\dane\apk-klucz\` (poza repo) |

**1.0.3 (Realme 8 / Android 13):** `onDestroy` nie kasuje „włączona”; KeepAlive co 12 min;
BOOT + QUICKBOOT + MY_PACKAGE_REPLACED; dialog baterii + instrukcja Realme (autostart,
nigdy nieusypiane, kłódka).  
**1.0.2:** `goAsync` + `FLAG_MUTABLE` (raport SENT/DELIVERED).  
**1.0.1:** sentIntent + deliveryIntent; odstęp ≥ 3 s; retry; watchdog 10 min.

Przed instalacją: `node scripts/sms-apk-smoke.mjs` → **PASS**.

## Realme 8 (realme UI 4.0) — obowiązkowe

1. **Bateria** → Optymalizacja baterii → Watch Tower SMS → **Nie optymalizuj**.
2. **Aplikacje** → **Autostart** → Watch Tower SMS → **WŁĄCZ**.
3. **Bateria** → Aplikacje nigdy nieusypiane / Zużycie baterii → **Zezwalaj w tle**.
4. Ostatnie aplikacje → Watch Tower SMS → **kłódka**.
5. Powiadomienie „Bramka SMS aktywna” musi być widoczne (nie wyłączać kanału).

W aplikacji: przyciski „Wyłącz oszczędzanie baterii” oraz „Autostart Realme…”.

## Przeniesienie na telefon

1. **kabel USB:** skopiuj `D:\Watch Tower\dane\apk\WatchTowerSMS.apk` do Pobrane.
2. **Dysk Google:** wgraj ten sam plik → Pobierz na telefonie.

## Instalacja

1. Otwórz `WatchTowerSMS.apk` → zezwól na instalację z tego źródła.
2. Zaktualizuj do **1.0.3**.
3. Uprawnienia: SMS + powiadomienia.
4. Zapisz URL / anon / token / numer SIM → **Uruchom bramkę**.
5. Zaakceptuj dialog baterii + ustawienia Realme (powyżej).
6. Potwierdź stałe powiadomienie „Bramka SMS aktywna”.

## Po instalacji (kolejność właściciela)

1. **2 h** z wyłączonym ekranem — bez ręcznego włączania; w Opcjach „ostatni kontakt”
   nie może przekroczyć ~15 min (strażnik serwera).
2. `node scripts/sms-burst-test.mjs` → **10/10 DELIVERED**.
3. Dopiero potem wyzwalacze stref.

## Ponowna budowa

```bat
cd android\sms-gateway
gradlew.bat assembleRelease
copy app\build\outputs\apk\release\app-release.apk "D:\Watch Tower\dane\apk\WatchTowerSMS.apk"
node ..\..\scripts\sms-apk-smoke.mjs
```

GitHub Actions — **nie używamy**.

## Bezpieczeństwo

- Token: SHA-256 w bazie; jawny tylko przy wydaniu i w telefonie.
- Limit 150 SMS/dobę, 20 wywołań/min — baza.
- `.jks` / `keystore.properties` tylko w `D:\Watch Tower\dane\apk-klucz\`.
