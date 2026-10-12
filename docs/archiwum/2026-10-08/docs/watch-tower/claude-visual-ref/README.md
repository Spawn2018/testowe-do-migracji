> **NIEAKTUALNE — zastąpione przez claude-v2.0/CLAUDE_V2_SOT.md + README.txt**
>
> Indeks: `docs/handover/09_INDEKS_WIEDZY.md` · Etap C4 · 2026-09-23. Pliku nie usuwać.

# TOWER — paczka projektowa

Control tower dla projektu **KSH / Stegra Boden** — transport konstrukcji
stalowych ponadnormatywnych z Polski do Boden w Szwecji.
Strony: H&H Logistics (spedytor), KSH (klient), Scandinavian Express (przewoźnik).

Stan na 22.09.2026.

---

## Zawartość

```
tower-makieta.html                        ← MAKIETA (jeden plik, samowystarczalny)
PYTANIA_SCANDINAVIAN_EXPRESS.md           ← checklista na spotkanie z przewoźnikiem
CURSOR_PROMPT.md                          ← prompt do Cursora, tryb planowania
supabase/migrations/0001_core.sql         ← schemat bazy + model bezpieczeństwa
supabase/migrations/0002_geofence_engine.sql ← silnik geofencingu w PostGIS
lib/schedule/parse.ts                     ← parser i walidator harmonogramu XLSX
lib/pricing/engine.ts                     ← cennik, BAF, kursy NBP, marża, 3-way match
lib/telematics/adapter.ts                 ← adapter telematyki (rFMS / REST / PWA kierowcy)
```

---

## Makieta

`tower-makieta.html` to **jeden samowystarczalny plik** — cały HTML, CSS,
JavaScript i dane demonstracyjne są w środku. Nie ma kroku budowania,
nie ma zależności, nie ma backendu.

Otwierasz dwuklikiem w dowolnej przeglądarce. Z internetu pobiera wyłącznie
krój Barlow z Google Fonts; bez sieci układ zadziała na czcionce systemowej.

**Co pokazać na spotkaniu, w tej kolejności:**

1. Przełącznik roli w nagłówku — kolumny z pieniędzmi znikają i pojawiają się
2. Pasek korytarza — kliknij „Prom", wszystko filtruje się do transportów na tym rejsie
3. Rola Scandinavian Express → „Moje zadania" — konkretna lista braków z terminami
4. Harmonogram → dowolny wiersz → zakładka „Przebieg"
5. Ryzyka → panel promowy z alternatywami
6. Faktury → tydzień 38 z rozbieżnością 1 840 PLN
7. Przełącznik PL / EN / SV

**Czego makieta nie jest:** wszystkie dane są wygenerowane — 50 elementów,
nazwiska, numery rejestracyjne, kwoty. Pozycje pojazdów są interpolowane
po trasie, nie pochodzą z telematyki. Mapa to schemat korytarza, nie warstwa
kartograficzna. Progi falowania są przykładowe i konfigurowalne — system
nie przewiduje decyzji armatora.

---

## Kod produkcyjny

Pliki poza makietą to początek prawdziwej aplikacji, nie ilustracja.
Są napisane tak, żeby wejść wprost do repo:

**`0001_core.sql`** — rdzeń. Rozdzielenie widoczności cen działa na poziomie
bazy: koszt i przychód w osobnych tabelach, `REVOKE ALL` dla ról API,
widoki z `security_invoker`, `GRANT UPDATE` na wymienione kolumny dla
przewoźnika. Funkcje ról są `SECURITY DEFINER`, więc polityki RLS nie
wpadają w rekurencję. Zawiera też `permit_fits()` — walidator wymiarów
zestawu przeciw zezwoleniu — i `purge_personal_data()` dla retencji RODO.

**`0002_geofence_engine.sql`** — maszyna stanów
OUTSIDE → PENDING_IN → INSIDE → PENDING_OUT z histerezą, dwell time
i debounce. Plus `detect_silent_vehicles()`, `detect_sequence_risk()`
(rozjazd kolejności montażowej) i `kpi_exception_detection_lag()`.

**`lib/schedule/parse.ts`** — parser dopasowany do faktycznej tabeli KSH.
Wyłapuje przesunięte kolumny: wiersz z „55 elementów" przy 20,17 t
zostanie odrzucony z konkretnym komunikatem zamiast wjechać do cennika.

**`lib/pricing/engine.ts`** — funkcje czyste, testowalne, z zapisem snapshotu
wejść. `matchRate()` przy braku dopasowania rzuca wyjątek zamiast wstawić zero.

**`lib/telematics/adapter.ts`** — jeden interfejs, trzy implementacje.
`PROVIDER_TEMPLATES` na dole to puste szablony do wypełnienia po spotkaniu
z przewoźnikiem.

---

## Kolejny krok

Wypełnij odpowiedzi w `PYTANIA_SCANDINAVIAN_EXPRESS.md`, a potem wklej
`CURSOR_PROMPT.md` do Cursora w trybie planowania. Prompt wie o istnieniu
pozostałych plików i każe Cursorowi je najpierw przeczytać i zaudytować,
a nie pisać od nowa.

Dwie rzeczy, które warto wynieść ze spotkania na piśmie: dokumentacja API
telematyki (albo jasne „nie mamy") oraz wzór zezwolenia z polami.
Pierwsze odblokowuje warstwę live, drugie — walidator zezwoleń.
