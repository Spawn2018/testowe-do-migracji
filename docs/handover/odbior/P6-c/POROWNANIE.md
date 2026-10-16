# wyglad/P6-c — panel transportu › Status według E17 (15.10.2026, 20:45)

Podstawa: E17 „Po zmianie” (`raport/img/e17-after`, lewa kolumna i telefon); E25 (oś statusów z P4-b); dopisek `D-20261015-2045-01`.

| Element E17 | Było (P4-b) | Jest |
|---|---|---|
| Znacznik przy statusie | RĘCZNIE / AUTO (IMPORT ukryty) | **IMPORT** / RĘCZNIE / **GPS** / **AIS** (z `payload`: źródło — całe słowa, strefa, pozycja; pozycja promu → AIS); bez źródła „AUTO” |
| Plan | — | „plan zał. 30.09 · w terminie” przy Załadunku, „plan 07.10 · w terminie” / „+1 dzień” przy „Na placu”; przy nieosiągniętym — sam plan |
| Kamienie milowe | — | pod statusem: wjazd / postój / wyjazd ze strefy, z godziną (inny dzień — z datą), najwyżej 3; bez stref z ustalenia fazy i bez zdarzenia, które samo ustawiło status z automatu |
| Znaczniki przy bieżącym | — | te same co w nagłówku (np. „+1h35”) |
| Rozliczenie po dostawie | stały opis | „Czeka na CMR z podpisem odbiorcy · zadanie u SCX” / „CMR … wgrany · można zmienić status” („można zmienić” tylko z przyciskiem „Zmień status”); „Brakuje obu faktur: SCX → HHL · HHL → KSH”; KSH / SCX: brak albo „Faktura dołączona: …” tylko swojej |
| Demo | oś z danych startowych | oś z tych samych zdarzeń co Historia (przykłady P6-b: „Gotowy” ręcznie, „Droga PL” i „Droga SE” z GPS, strefy) — produkcja bez zmian |
| Panel zakładki | — | `tabIndex=0` na panelu (przewijany obszar dostępny z klawiatury — axe `scrollable-region-focusable`) |
| Stopka | kto zmienia | + „GPS = lokalizator (emtrack, link RIO) · AIS = prom · ręcznie = osoba.” |

Sprawdzone (podgląd demo; SG-01, SG-03, SG-15, SG-30; HHL, KSH, SCX; 1440, 390, 360 px; jasny i ciemny):
- przewijanie w poziomie 0; tekst < 12 px na telefonie 0;
- axe WCAG 2 A/AA w panelu: 0 (gałąź złożona na PR #225 — zakładki `role=tab`, kontrast paska „Śledzenie trwa”).

Zrzuty: `status-SG-01-1440-hhl.webp`, `status-SG-01-1440-ksh.webp`, `status-SG-01-390-scx.webp`.
