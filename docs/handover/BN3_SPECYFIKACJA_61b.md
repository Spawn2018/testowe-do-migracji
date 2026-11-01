# BN3 — decyzja 61b: podejrzenie odwołania (doprecyzowanie 01.11.2026)

Źródło: F7 #696 r2 (koordynator). Obowiązuje zamiast wcześniejszego okna ETA+6 h z r1.

## Podnoszenie alarmu (FERRY MEDIUM, bez zmiany statusu)

Tylko gdy `actual_departure_at == null` **i** `actual_arrival_at == null`. ATD = prom wypłynął → to nie jest odwołanie.

1. **Gałąź ETA:** od ETA+45 min do ETA+**90** min.
2. **Gałąź zniknięcia (samodzielna):** od planowego odejścia +45 min do ETA+90 min; pełna odpowiedź Portnet; ATD null; AIS świeży w porcie wyjścia, SOG ≤ próg.
3. Stała 90 min w kodzie (`CANCEL_SUSPECT_WINDOW_AFTER_ETA_MIN`) — krótsza niż najkrótszy nawrót na Zatoce Fińskiej.

## Gaszenie

Raz podniesione nie gaśnie po wyjściu z okna. Zamyka się tylko gdy:

- pojawi się ATD lub ATA (także z UMG / AIS),
- świeży AIS pokaże statek **poza** portem wyjścia (w ruchu lub w porcie docelowym),
- HHL ręcznie potwierdzi lub zamknie.

`resolveStaleRisks`: dedup rejsów poza oknem idzie do `keep`, dopóki nie zajdzie warunek wyżej. `closeStaleFiToEeWithoutAta` nie zamyka rejsu z otwartym podejrzeniem.

## AIS / SOURCE_DOWN

- Nieświeża pozycja, `features: []`, brak fix → keep (nie gaszenie).
- Zła struktura (`{}`, brak tablicy `features`) → keep + `SOURCE_DOWN:DIGITRAFFIC_AIS`.
- `SOURCE_DOWN` zamykane tylko po przebiegu z realnym, poprawnym odczytem AIS.
