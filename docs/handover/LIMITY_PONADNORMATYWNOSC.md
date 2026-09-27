# Limity wymiarów i mas — kiedy transport jest ponadnormatywny (PL, SE)

**Status: DO POTWIERDZENIA Z PRZEWOŹNIKIEM** (D-15, PLAN §4). Zebrano 28.09.2026 z aktów w wersji dostępnej tego dnia.
Dokument nie jest opinią prawną. Przewoźnik potwierdza limity dla swojego zestawu i trasy (drogi o nacisku 8/10/11,5 t,
klasy bärighet BK1–BK4, obiekty inżynierskie) oraz zezwolenia na każdy transport.

## Polska

| Parametr | Limit ogólny | Podstawa |
|---|---|---|
| Szerokość | 2,55 m (nadwozie chłodnicze 2,60 m) | Rozporządzenie Ministra Infrastruktury z 31.12.2002 r. w sprawie warunków technicznych pojazdów… (t.j. Dz.U. 2024 poz. 502), **§ 2 ust. 2** |
| Wysokość | 4,00 m | tamże, **§ 2 ust. 4** |
| Długość — pojazd członowy (ciągnik + naczepa) | 16,50 m | tamże, **§ 2 ust. 1 pkt 4** |
| Długość — zespół pojazd silnikowy + przyczepa | 18,75 m | tamże, **§ 2 ust. 1 pkt 5** |
| Długość — pojedynczy pojazd samochodowy / przyczepa | 12,00 m | tamże, **§ 2 ust. 1 pkt 1 i 3** |
| Masa całkowita zespołu (co najmniej 5 osi, ciągnik = pojazd samochodowy) | 40 t; intermodalny zestaw 5–6 osi z kontenerem/nadwoziem wymiennym do 45′: 42 t (ciągnik 2-osiowy + naczepa 3-osiowa) albo 44 t (ciągnik 3-osiowy + naczepa 2–3-osiowa) | tamże, **§ 3 ust. 1 pkt 2** lit. a–d (brzmienie sprawdzone 28.09 w t.j. Dz.U. 2024 poz. 502) |
| Masa całkowita — zestaw członowy 4-osiowy | 36 t (38 t przy rozstawie osi naczepy > 1,8 m, koła bliźniacze i zawieszenie pneumatyczne na osi napędowej) | tamże, **§ 3 ust. 1 pkt 6** |
| Nacisk osi | nienapędowa 10 t, napędowa 11,5 t | tamże, **§ 5 ust. 1 pkt 1 i 5**; na drogach o obniżonej nośności mniej (ustawa o drogach publicznych, **art. 41**) — do sprawdzenia trasy |
| Wystawanie ładunku | ładunek nie może wystawać z boku poza obrys pojazdu; z tyłu do 2,0 m od tylnej krawędzi (warunki oznakowania) | ustawa z 20.06.1997 r. Prawo o ruchu drogowym (PoRD), **art. 61 ust. 4–5** |

**Kiedy potrzebne zezwolenie.** Przekroczenie którejkolwiek wartości powyżej = pojazd nienormatywny: przejazd tylko na
zezwolenie **kategorii I–VII** (PoRD **art. 64 ust. 1** i **art. 64a–64d**, wydaje starosta, marszałek, GDDKiA —
kategoria VII dla pojazdu, który przekracza limity z kategorii VI albo jedzie trasą wskazaną). Kategoria VII wymaga
uzgodnienia trasy przez zarządców dróg — to wpływa na czas przygotowania transportu. Ładunek musi być niepodzielny
(PoRD **art. 2 pkt 35a**). Zgłoszenie przewozu do SENT/KPD — patrz D-17 (II-6).

## Szwecja

| Parametr | Limit ogólny | Podstawa |
|---|---|---|
| Szerokość (z ładunkiem) | 2,60 m; ładunek nie może wystawać z boku więcej niż 20 cm | Trafikförordning (1998:1276), **4 kap. 15 §** |
| Długość pojazdu lub zespołu | 24,0 m; do 25,25 m przy warunkach z § 17 (m.in. pojazd silnikowy ≤ 12 m, naczepa ≤ 12 m od sworznia, szerokość ≤ 2,55/2,60 m) | tamże, **4 kap. 17 §** |
| Wysokość | brak ogólnego limitu w przepisach; ograniczenia wynikają z oznakowania (wiadukty, tunele) i z trasy | tamże, 4 kap. (brak przepisu o wysokości); **do potwierdzenia trasy Nynäshamn → Boden** |
| Naciski osi | BK1: oś nienapędowa 10 t, napędowa 11,5 t; BK4 — te same naciski | tamże, **4 kap. 12 §** (tabela BK1–BK4) |
| Masa całkowita | BK1 do 64 t, BK4 do 74 t — zależnie od rozstawu osi (tabele) | tamże, **4 kap. 12–13 §§** i **bilagor 1–3**; Trafikverket: klasy bärighet |

**Kiedy potrzebna dyspensa.** Przekroczenie = transport tylko na **dispens** (Trafikförordning **13 kap. 3 §**; wydaje
Trafikverket, na drogach gminnych — gmina). Transportstyrelsen może też dopuścić ładunek niepodzielny szerszy niż 2,60 m
na zasadach ogólnych (**4 kap. 15 § akapit drugi**, przepisy TSFS). Wymagania eskorty zależą od szerokości i długości —
do potwierdzenia z przewoźnikiem.

## Co to znaczy dla TOWER

- Dziś aplikacja **nie liczy** ponadnormatywności automatycznie. Rozbieżność zezwolenia z dokumentami zapisuje się ręcznie
  zdarzeniem PERMIT_MISMATCH. Propozycja na później (SCOPE 3.8): po potwierdzeniu limitów oznaczać transporty ponad limit
  jako wymagające zezwolenia PL i dyspensy SE przed statusem READY.
- Po potwierdzeniu przez przewoźnika: wpis D-15 w PLAN §4 → ROZSTRZYGNIĘTE.

## Źródła (dostęp 28.09.2026)

- Dz.U. 2024 poz. 502 (t.j.) — ISAP / OpenLEX: https://sip.lex.pl/akty-prawne/dzu-dziennik-ustaw/warunki-techniczne-pojazdow-oraz-zakres-ich-niezbednego-17009712/dz-2
- Prawo o ruchu drogowym (t.j. Dz.U. 2024 poz. 1251 z późn. zm.) — art. 61, 64, 64a–64d.
- Trafikförordning (1998:1276): https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/trafikforordning-19981276_sfs-1998-1276/
- Trafikverket, bärighetsklasser: https://bransch.trafikverket.se/for-dig-i-branschen/vag/bk--barighetsklasser-pa-vagar-och-broar/
- Transportstyrelsen, bruttoviktstabeller: https://www.transportstyrelsen.se/sv/vagtrafik/Yrkestrafik/Gods-och-buss/Matt-och-vikt/viktbestammelser/Bruttoviktstabeller/
