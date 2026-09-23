# Klasyfikacja zezwoleń wg cennika SCX (STE GRA)

Źródła wymiarów: `SCX_CENNIK.xlsx` kolumny **Dł./Szer./Wys. Transportowa Max** + **Waga transportu Max** (to są wymiary **ZESTAWU**, nie samego elementu).
Źródła prawa: `PERMITS_PL_SE.md`.
Ceny: wyłącznie **Cena bazowa EURO**.

Założenia:
1. Zestaw = typowy ciągnik + naczepa (limit długości normatywnej PL = **16,50 m**).
2. Naciski osi nie są w Excelu — przy „normatywnym” zawsze dopisek: o ile naciski OK.
3. Korytarz PL Śrem → Gdańsk zwykle korzysta z dróg krajowych / S — wymiarowo kat. II często **praktycznie** realizuje się jako III/IV (ten sam zestaw nadal się mieści).
4. Warianty konwoju kratownic (1/2/3 auta) **nie zmieniają** wymiarów zestawu — ta sama klasyfikacja zezwoleń; różnią się tylko ceną bazową.

### 1. Słupy skrajne
- Element: `17,6 x 3,0 x 1,0` · na auto: **2** szt. · transportów w scenariuszu: **10** · waga el.: 11 t
- **Zestaw max:** 18.0 × 3.0 × 2.5 m · **22.0 t**
- **Cena bazowa:** 7640€
- **PL:** II
  - Uzasadnienie: mieści się w II (W≤3,2; L≤23 zespół; H≤4,3); masa/naciski ≤ dopuszczalne założone
  - Pilot: nie wymagany (progi: L>23 / W>3,2 / H>4,5 / masa>60)
  - Korytarz: Kat. II wystarcza na drogi publiczne. Jeśli trasa idzie drogami krajowymi w reżimie GDDKiA jak typowy korytarz do portu — praktycznie często bierze się III (krajowe) lub IV; parametrów wymiarowych II nie przekraczacie.
- **SE:** TSFS 2023:36 (szeroka odelbar last) — bez indywidualnej dispensy
  - Dispens: nie, o ile spełnione warunki TSFS (oznakowanie, varningsbil itd.) i brak przekroczenia masy/długości

### 2. Kratownice
- Element: `19,9 x 3,5 x 0,7` · na auto: **3** szt. · transportów w scenariuszu: **34** · waga el.: 7.1 t
- **Zestaw max:** 20.0 × 3.6 × 2.5 m · **22.0 t**
- **Cena bazowa:** 9950€ / 10860€ / 11315€ (warianty konwoju)
- **PL:** IV (tylko odcinki A/S dwujezdniowe) / V na pozostałych
  - Uzasadnienie: W=3.6 m: IV dopuszcza do 4,0 m wyłącznie na drodze dwujezdniowej klasy A i S; na jednojezdniowej limit IV to 3,4 m → poza A/S potrzeba kat. V
  - Pilot: 1 pojazd pilotujący (W=3,6 >3,2; próg 2 pilotów to W>3,60 — przy dokładnie 3,60 m zostaje 1, o ile inne progi nie przekroczone)
  - Korytarz: Przy W>3,4 m: na A/S dwujezdniowej możliwa IV; każdy odcinek jednojezdniowy / poza A·S z W>3,4 → V na wyznaczonej trasie.
- **SE:** DISPENS (väghållare)
  - Dispens: tak — W>3,50 m

### 2. Kratownice
- Element: `19,9 x 3,5 x 0,7` · na auto: **4** szt. · transportów w scenariuszu: **25** · waga el.: 7.1 t
- **Zestaw max:** 20.0 × 3.6 × 2.9 m · **29.0 t**
- **Cena bazowa:** 11380€ / 12290€ / 12745€ (warianty konwoju)
- **PL:** IV (tylko odcinki A/S dwujezdniowe) / V na pozostałych
  - Uzasadnienie: W=3.6 m: IV dopuszcza do 4,0 m wyłącznie na drodze dwujezdniowej klasy A i S; na jednojezdniowej limit IV to 3,4 m → poza A/S potrzeba kat. V
  - Pilot: 1 pojazd pilotujący (W=3,6 >3,2; próg 2 pilotów to W>3,60 — przy dokładnie 3,60 m zostaje 1, o ile inne progi nie przekroczone)
  - Korytarz: Przy W>3,4 m: na A/S dwujezdniowej możliwa IV; każdy odcinek jednojezdniowy / poza A·S z W>3,4 → V na wyznaczonej trasie.
- **SE:** DISPENS (väghållare)
  - Dispens: tak — W>3,50 m

### 3. Płatwie (długie)
- Element: `14,7 x 0,2 x 0,6` · na auto: **15** szt. · transportów w scenariuszu: **8** · waga el.: 1.6 t
- **Zestaw max:** 15.0 × 2.5 × 2.9 m · **24.0 t**
- **Cena bazowa:** 6030€
- **PL:** NORMATYWNY (jeśli naciski osi OK)
  - Uzasadnienie: Brak zezwolenia nienormatywnego, o ile naciski osi i masa w limitach zestawu/drogi.
  - Pilot: nie (progi pilotowania nieosiągnięte)
  - Korytarz: Brak zezwolenia nienormatywnego, o ile naciski osi i masa w limitach zestawu/drogi.
- **SE:** W NORMIE SE (jeśli masa ≤ dopuszczalna dla BK drogi i pojazdu)
  - Dispens: nie (wymiary); masa: sprawdź BK trasy — nadwaga zawsze dispens

### 4. Stężenia międzysłupowe (długie)
- Element: `14,6 x 2,8 x 0,4` · na auto: **4** szt. · transportów w scenariuszu: **2** · waga el.: 4.2 t
- **Zestaw max:** 15.0 × 2.8 × 2.5 m · **17.0 t**
- **Cena bazowa:** 5510€
- **PL:** II
  - Uzasadnienie: mieści się w II (W≤3,2; L≤23 zespół; H≤4,3); masa/naciski ≤ dopuszczalne założone
  - Pilot: nie wymagany (progi: L>23 / W>3,2 / H>4,5 / masa>60)
  - Korytarz: Kat. II wystarcza na drogi publiczne. Jeśli trasa idzie drogami krajowymi w reżimie GDDKiA jak typowy korytarz do portu — praktycznie często bierze się III (krajowe) lub IV; parametrów wymiarowych II nie przekraczacie.
- **SE:** TSFS 2023:36 (szeroka odelbar last) — bez indywidualnej dispensy
  - Dispens: nie, o ile spełnione warunki TSFS (oznakowanie, varningsbil itd.) i brak przekroczenia masy/długości

### 5. Stężenia międzysłupowe (krótkie)
- Element: `11,6 x 2,8 x 0,4` · na auto: **5** szt. · transportów w scenariuszu: **3** · waga el.: 3.3 t
- **Zestaw max:** 13.6 × 2.8 × 2.5 m · **17.0 t**
- **Cena bazowa:** 4960€
- **PL:** II
  - Uzasadnienie: mieści się w II (W≤3,2; L≤23 zespół; H≤4,3); masa/naciski ≤ dopuszczalne założone
  - Pilot: nie wymagany (progi: L>23 / W>3,2 / H>4,5 / masa>60)
  - Korytarz: Kat. II wystarcza na drogi publiczne. Jeśli trasa idzie drogami krajowymi w reżimie GDDKiA jak typowy korytarz do portu — praktycznie często bierze się III (krajowe) lub IV; parametrów wymiarowych II nie przekraczacie.
- **SE:** TSFS 2023:36 (szeroka odelbar last) — bez indywidualnej dispensy
  - Dispens: nie, o ile spełnione warunki TSFS (oznakowanie, varningsbil itd.) i brak przekroczenia masy/długości

### 6. Belki podsuwnicowe
- Element: `16,5 x 0.45 x 1,7` · na auto: ** 1-2** szt. · transportów w scenariuszu: **13** · waga el.: 16.55 t
- **Zestaw max:** 16.5 × 2.5 × 2.5 m · **34.0 t**
- **Cena bazowa:** 6280€
- **PL:** NORMATYWNY (jeśli naciski osi OK)
  - Uzasadnienie: Brak zezwolenia nienormatywnego, o ile naciski osi i masa w limitach zestawu/drogi.
  - Pilot: nie (progi pilotowania nieosiągnięte)
  - Korytarz: Brak zezwolenia nienormatywnego, o ile naciski osi i masa w limitach zestawu/drogi.
- **SE:** W NORMIE SE (jeśli masa ≤ dopuszczalna dla BK drogi i pojazdu)
  - Dispens: nie (wymiary); masa: sprawdź BK trasy — nadwaga zawsze dispens

### 8. Belki podsuwnicowe (12m)
- Element: `12,0 x 0,5 x 1,1` · na auto: **2** szt. · transportów w scenariuszu: **35** · waga el.: 10.8 t
- **Zestaw max:** 13.6 × 2.5 × 2.5 m · **22.0 t**
- **Cena bazowa:** 5090€
- **PL:** NORMATYWNY (jeśli naciski osi OK)
  - Uzasadnienie: Brak zezwolenia nienormatywnego, o ile naciski osi i masa w limitach zestawu/drogi.
  - Pilot: nie (progi pilotowania nieosiągnięte)
  - Korytarz: Brak zezwolenia nienormatywnego, o ile naciski osi i masa w limitach zestawu/drogi.
- **SE:** W NORMIE SE (jeśli masa ≤ dopuszczalna dla BK drogi i pojazdu)
  - Dispens: nie (wymiary); masa: sprawdź BK trasy — nadwaga zawsze dispens

### 9. Tężnik (belka)
- Element: `14,2 x 0,4 x 0,4` · na auto: **8** szt. · transportów w scenariuszu: **2** · waga el.: 1.8 t
- **Zestaw max:** 15.0 × 2.5 × 2.5 m · **15.0 t**
- **Cena bazowa:** 5320€
- **PL:** NORMATYWNY (jeśli naciski osi OK)
  - Uzasadnienie: Brak zezwolenia nienormatywnego, o ile naciski osi i masa w limitach zestawu/drogi.
  - Pilot: nie (progi pilotowania nieosiągnięte)
  - Korytarz: Brak zezwolenia nienormatywnego, o ile naciski osi i masa w limitach zestawu/drogi.
- **SE:** W NORMIE SE (jeśli masa ≤ dopuszczalna dla BK drogi i pojazdu)
  - Dispens: nie (wymiary); masa: sprawdź BK trasy — nadwaga zawsze dispens

### 10. Słupy główne
- Element: `17,6 x 2,25 x 1,0` · na auto: **3** szt. · transportów w scenariuszu: **26.67** · waga el.: 7 t
- **Zestaw max:** 18.0 × 2.5 × 3.0 m · **21.0 t**
- **Cena bazowa:** 5600€
- **PL:** II
  - Uzasadnienie: mieści się w II (W≤3,2; L≤23 zespół; H≤4,3); masa/naciski ≤ dopuszczalne założone
  - Pilot: nie wymagany (progi: L>23 / W>3,2 / H>4,5 / masa>60)
  - Korytarz: Kat. II wystarcza na drogi publiczne. Jeśli trasa idzie drogami krajowymi w reżimie GDDKiA jak typowy korytarz do portu — praktycznie często bierze się III (krajowe) lub IV; parametrów wymiarowych II nie przekraczacie.
- **SE:** W NORMIE SE (jeśli masa ≤ dopuszczalna dla BK drogi i pojazdu)
  - Dispens: nie (wymiary); masa: sprawdź BK trasy — nadwaga zawsze dispens

### 11. Element referencyjny
- Element: `18,5x2,5x2,5` · na auto: **1** szt. · transportów w scenariuszu: **60** · waga el.: 22 t
- **Zestaw max:** 18.5 × 2.5 × 2.5 m · **22.0 t**
- **Cena bazowa:** 6900€
- **PL:** II
  - Uzasadnienie: mieści się w II (W≤3,2; L≤23 zespół; H≤4,3); masa/naciski ≤ dopuszczalne założone
  - Pilot: nie wymagany (progi: L>23 / W>3,2 / H>4,5 / masa>60)
  - Korytarz: Kat. II wystarcza na drogi publiczne. Jeśli trasa idzie drogami krajowymi w reżimie GDDKiA jak typowy korytarz do portu — praktycznie często bierze się III (krajowe) lub IV; parametrów wymiarowych II nie przekraczacie.
- **SE:** W NORMIE SE (jeśli masa ≤ dopuszczalna dla BK drogi i pojazdu)
  - Dispens: nie (wymiary); masa: sprawdź BK trasy — nadwaga zawsze dispens
