# STATUSY TRANSPORTU — jedyne źródło prawdy

> Automatyczna zmiana statusów na podstawie pozycji GPS i rozkładu rejsów.
> Implementacja: `supabase/migrations/0004_statusy_automatyczne.sql`.
> Silnik stref: `0002_geofence_engine.sql` (poprawiony 24.09.2026).
> Test: `tests/db/status.sh` — **44/44** na Postgres 16 + PostGIS.

---

# 1. DECYZJE WŁAŚCICIELA (24.09.2026)

| # | Decyzja |
|---|---|
| S1 | **Statusy zmieniają się na podstawie pozycji** |
| S2 | **Port PL (Gdańsk) i port SE (Nynäshamn) mają swoje strefy.** Wjazd auta w strefę = automatyczna aktualizacja statusu |
| S3 | **PROM:** auto wjeżdża w strefę portu Gdańsk; gdy nadchodzi **czas wypłynięcia wg rozkładu armatora** dla **rejsu przypisanego do auta** — system **sam przełącza status na PROM** |

---

# 2. CZTERY ZASADY AUTOMATU

1. **Pozycja mówi, gdzie jest auto.** Brak potwierdzeń (załadunek, dokumenty,
   numery zleceń) to osobne ryzyka, nie blokada ruchu — z jednym wyjątkiem:
   wyjazd ze strefy załadunku bez potwierdzenia załadunku **nie** daje
   „w drodze", bo auto mogło odjechać puste
2. **Status tylko do przodu.** Nigdy wstecz, nigdy z CANCELLED, UNLOADED,
   DELIVERED
3. **Rozładunek nigdy automatycznie.** To data realizacji usługi — od niej
   zależą opłata paliwowa, kurs NBP i tydzień faktury. Obecność na placu
   budowy to AT_SITE, nie UNLOADED
4. **Nieudana zmiana statusu nigdy nie przerywa zapisu pozycji.** Blokada
   (np. brak numeru zlecenia) zamienia się w ryzyko z przyczyną

---

# 3. PRZEJŚCIA

## 3.1 Ze strefy

| Zdarzenie | Strefa | Ze statusu | Na status | Warunek / skutek uboczny |
|---|---|---|---|---|
| wjazd | załadunek | READY | **AT_LOADING** | |
| wjazd | załadunek | PLANNED, RESOURCES_PENDING, DOCS_PENDING | *bez zmian* | **ryzyko wysokie:** pojazd na załadunku, transport niegotowy |
| wyjazd | załadunek | AT_LOADING | **IN_TRANSIT_PL** | tylko gdy jest `MILESTONE_LOADED`; inaczej **ryzyko wysokie**, status bez zmian |
| wjazd | port Gdańsk | READY, AT_LOADING, IN_TRANSIT_PL | **AT_PORT_GDANSK** | bez potwierdzenia załadunku — **ryzyko średnie**, status się zmienia |
| wjazd | port Nynäshamn | FERRY | **AT_PORT_NYNASHAMN** | |
| wyjazd | port Nynäshamn | AT_PORT_NYNASHAMN | **IN_TRANSIT_SE** | |
| wjazd | punkt kontrolny SE, bufor przed Boden | FERRY, AT_PORT_NYNASHAMN | **IN_TRANSIT_SE** | awaryjnie: GPS zgubił port SE — auto na drogach SE nie może być na promie |
| wjazd | plac budowy | FERRY, AT_PORT_NYNASHAMN, IN_TRANSIT_SE | **AT_SITE** | |
| wyjazd | port Gdańsk | FERRY | *bez zmian* | statek odpływa — to nie jest zdarzenie |
| wjazd | bufor przed Gdańskiem, bufor przed Boden (poza awarią), postój | dowolny | *bez zmian* | tylko powiadomienie |

## 3.2 PROM — zadanie systemowe co minutę

```
dla każdego transportu z przypisanym rejsem Gdańsk → Nynäshamn,
którego czas odejścia już nadszedł:
  czas odejścia = opóźniony, jeśli odnotowano; inaczej rozkładowy

  rejs ODWOŁANY                         → status bez zmian, ryzyko wysokie
  AT_PORT_GDANSK i auto BYŁO w strefie
    portu w chwili odejścia             → FERRY
  w każdym innym przypadku              → status bez zmian, ryzyko wysokie:
                                          brak potwierdzenia pozycją, że auto
                                          było w porcie w chwili odejścia
```

**„Było w strefie w chwili odejścia", nie „jest teraz".** Zadanie
uruchomione z opóźnieniem, gdy statek już płynie, a auto z nim — poza
strefą — nadal przełącza poprawnie. Sprawdzone testem.

**Opóźnienie rejsu:** automat używa czasu opóźnionego, jeżeli został
odnotowany. Mija godzina rozkładowa, rejs opóźniony — auto czeka w porcie,
bez fałszywego ryzyka przegapionego rejsu.

**Przeterminowany PROM** — zadanie co 10 minut: transport nadal w statusie
PROM dwie godziny po planowanym (lub opóźnionym) przypłynięciu → ryzyko
średnie. Auto zostało w porcie albo GPS milczy po zejściu na ląd.

## 3.3 Nigdy automatycznie

| Status | Kto ustawia | Warunek |
|---|---|---|
| READY | HHL | numer zlecenia HHL (wymusza baza) |
| **UNLOADED** | kierowca w aplikacji albo HHL | **razem z datą rozładunku** — baza odrzuca UNLOADED bez daty |
| DELIVERED | HHL | kompletność dokumentów |
| CANCELLED | **wyłącznie HHL** | |

---

# 4. REJSY

- **Rozkład armatora** w tabeli `sailings`: statek, trasa, odejście,
  przypłynięcie, odejście i przypłynięcie po opóźnieniu, status
  (zaplanowany / opóźniony / odwołany), źródło (dane startowe / ręcznie /
  Polferries)
- **Przypisanie rejsu do auta:** `loads.sailing_id` + numer rezerwacji.
  Przypisuje HHL albo przewoźnik transportu. **Po wypłynięciu zmienia
  wyłącznie HHL**
- **Jedno źródło prawdy o rejsie.** Pola „statek" i „godzina odejścia"
  jako wolny tekst przy transporcie — usunięte. Dwie kopie danych o rejsie
  to dokładnie usterka D4 (odwrócone statki w `SAIL_ROWS`)
- Rozkład widzą wszystkie trzy strony; zmienia go HHL
- **Źródło statusu promów Polferries — decyzja właściciela otwarta.** Do jej
  podjęcia: dane startowe z ręczną aktualizacją opóźnień i odwołań przez HHL

---

# 5. STREFY

Dane startowe `supabase/seed/stegra.sql`:

| Strefa | Rodzaj | Kraj | Promień |
|---|---|---|---|
| Bufor 20 km przed Gdańskiem | przed portem | PL | 20 km |
| Terminal Polferries Gdańsk | port wyjścia | PL | 800 m |
| Terminal Nynäshamn | port przyjścia | SE | 800 m |
| Bufor 50 km przed Boden | przed przyjazdem | SE | 50 km |
| Plac budowy Stegra Boden | plac | SE | 1 500 m |

**Do uzupełnienia przez wykonawcę:**
- **strefy załadunku** — z adresów w `docs/watch-tower/ADDRESSES.md`,
  bez zgadywania współrzędnych
- **współrzędne terminali** — do weryfikacji z mapą; Research zgłosił je
  jako przybliżone
- punkty kontrolne na E4 — opcjonalnie, z krajem SE (włączają przejście awaryjne)

---

# 6. CO APLIKACJA MUSI WYSYŁAĆ

| Akcja w aplikacji | Zdarzenie w bazie |
|---|---|
| kierowca: „Załadowany" | `MILESTONE_LOADED` w `load_events` |
| kierowca: „Rozładowany" | status UNLOADED **razem z** `actual_delivery_at` w jednej zmianie |
| pozycja GPS — aplikacja kierowcy, telematyka | `process_position()` |

**Zgoda kierowcy na lokalizację** przy pierwszym uruchomieniu, w jego
języku. Bez zgody działają wyłącznie przyciski etapów.

---

# 7. OCHRONA — KTO ZMIENIA CO W TRANSPORCIE

Usterka od migracji 0001: Supabase nadaje rolom prawo zmiany całej tabeli,
więc lista kolumn przewoźnika niczego nie ograniczała — **przewoźnik mógł
zmienić numer zlecenia HHL i KSH we własnym transporcie**. Naprawione
wyzwalaczem w 0004, sprawdzone testem.

| Kto | Może | Nie może |
|---|---|---|
| **HHL** | wszystko | zmienić numeru zlecenia przewoźnika |
| **Przewoźnik** (własne transporty) | dane pojazdu i kierowcy, telematyka, rejs i rezerwacja, własny numer zlecenia, wymiary zestawu, daty faktyczne, status — **tylko do przodu** | numery zleceń HHL i KSH, projekt, klient, **okna planowe załadunku i dostawy** (plan pochodzi z harmonogramu KSH); anulować; cofnąć statusu; zmienić rejsu po wypłynięciu; **zmienić daty rozładunku transportu, który jest na fakturze** |
| **KSH** | nic w transporcie | |

**Data rozładunku** — każda zmiana w dzienniku audytu. Po zafakturowaniu
zmienia ją wyłącznie HHL: od tej daty zależy kurs NBP, opłata paliwowa
i tydzień faktury. Cofnięcie jej o dzień zmieniałoby kurs na korzyść
wystawcy.

---

# 8. USTERKI W SILNIKU STREF — WYKRYTE I NAPRAWIONE 24.09.2026

Silnik stref z migracji 0002 **nigdy nie działał.** Wszystkie trzy usterki
to błędy czasu wykonania — niewidoczne dla parsera SQL.

| # | Usterka | Skutek |
|---|---|---|
| G1 | Nazwy kolumn wyniku funkcji takie same jak kolumn tabel | każde wywołanie ze strefą w zasięgu kończyło się błędem, **pozycja przepadała** |
| G2 | Zapis zdarzenia bez warunku indeksu częściowego | **żaden wjazd ani wyjazd nie mógł zostać zapisany** |
| G3 | Promień strefy liczony w odwzorowaniu Mercatora | strefy **40–60% mniejsze**, błąd rósł na północ: port Gdańsk 463 m zamiast 800, plac Stegra 613 m zamiast 1 500, bufor Boden 20 km zamiast 50 |
