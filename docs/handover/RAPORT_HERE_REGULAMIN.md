# RAPORT: HERE Routing API v8, regulamin i plan podstawowy (Base Plan) a ETA w Watch Tower

Data sprawdzenia: 28.09.2026 (czas PL). Źródła: wyłącznie oficjalne strony HERE (here.com, legal.here.com, docs.here.com, brand.here.com), pobrane dziś. Cytaty są w oryginale (EN), a pod każdym jest omówienie po polsku.
Kontekst: backend Watch Tower co ≤15 min wysyła zapytanie `transportMode=truck` (z punktami `via`) z bieżącą pozycją GPS ciężarówki (transport ponadgabarytowy PL→SE, z promem), zapisuje tylko ETA, bez geometrii. Budżet: ≤25 000 zapytań/mies.

---

## WNIOSEK (TL;DR)

**NIE: nasze użycie nie jest dozwolone w Base Plan.**

Powód: HERE wprost wyłącza z Base Plan (i z Limited Plan) przypadek użycia „Asset Management”. Definiuje go jako m.in. *śledzenie* (tracking) **oraz** *liczenie tras* (route calculations) dla „Asset”. „Asset” to wprost m.in. *pojazd, środek transportu lub ładunek* („a piece of cargo, a means of transportation, a vehicle”) zarządzany przy użyciu usług HERE. Cykliczne liczenie ETA z pozycji GPS jadącej ciężarówki to podręcznikowy przykład tej definicji. Wystarczy nawet sam punkt (ii) „provision of route calculations” w relacji do pojazdu, bo definicja mówi „any one or all of the following”.
Zgodnie z regulaminem do tego zastosowania potrzebny jest plan Enterprise, plan „asset-based” albo indywidualna umowa („please contact us”). Bez kontaktu z HERE nie da się tego obejść.

Poboczne ustalenia:
- Zapis samego ETA jest co do zasady dozwolony, ale **najwyżej 30 dni** (poza celami audytu/compliance) i z zastrzeżeniem nagłówków cache HTTP. Szczegóły w pkt (b).
- Atrybucja: „© 20XX HERE” oraz noty dostawców danych (Supplier Terms) w warunkach dla użytkowników końcowych. Szczegóły w pkt (c).
- Koszt: Routing Truck to 5 000 darmowych transakcji/mies., potem €2,33 / 1 000 (USD $2,92). „1 Transaction is counted for every Request.” Przy 25 000/mies. wychodzi ok. **€46,60/mies.** (20 000 płatnych). Te liczby nie zmieniają jednak odpowiedzi „NIE” w sprawie licencji.

---

## (a) Czy Base Plan/darmowy plan wyklucza śledzenie pojazdów, asset tracking, telematykę, fleet management, GPS w czasie rzeczywistym?

**TAK, wyklucza.**

### Źródło 1: HERE Base Plan usage restrictions
URL: https://www.here.com/get-started/pricing/base-plan-restrictions

> "The below usage restrictions apply to HERE Base Plan customers."
>
> "# Excluded use cases
> The following use cases are excluded from the Base Plan. If you are interested in these use cases please contact us."
>
> "“Asset Management,” meaning, in relation to an Asset, the provision of any one or all of the following (i) locating, tracking and/or displaying on a map; (ii) provision of route calculations; and (iii) deriving of analytics; and (iv) alerts that inform drivers of potential hazards on the road such as incoming pedestrians, vehicle braking, dynamic hazards or potholes "Safety Enhancement Alerts"."
>
> "“Usage Based Insurance (UBI)/Telematics,” meaning, in relation to an Asset, the analysis of post trip driving information which excludes, in particular but not limited to, real-time tracking and providing real-time alerts or feedback loop to the Asset."
>
> "“Optimization,” meaning Asset Management and, in relation to one or more Assets, utilizing software or application(s) to calculate the order of destinations and or routes."
>
> "“Asset” means, individually, a person (including the user of your application), an animal, a device, a piece of cargo, a means of transportation, a vehicle or any other object actively managed using HERE’s service."
>
> "Notwithstanding the aforementioned, HERE Tour Planning may be used for the Optimization use case part of Base Plan."

### Źródło 2: RPS limits and excluded use cases (te same wyłączenia dla Limited i Base)
URL: https://www.here.com/get-started/pricing/rps-limits-excluded-use-cases

> "The following use cases are excluded from the Limited and Base Plans. If you are interested in these use cases please contact us."

Dalej jest identyczna definicja „Asset Management” / „UBI/Telematics” / „Optimization” / „Asset”. Ta sama treść wyłączeń jest też na https://www.here.com/get-started/pricing/limited-plan-restrictions („excluded from the Limited Plan”).

### Źródło 3: oficjalne ogłoszenie zmiany warunków (od 7.04.2023)
URL: https://www.here.com/developer/blog/march-2023-platform-release-notes

> "From April 7, 2023, we will exclude the following use cases from the from the HERE Base Plan (transaction based) and HERE Limited Plan:
> - Asset Management
> - Optimization
> - UBI/Telematics"
>
> "Customers using Monthly Active User or Asset based plans are not impacted."

### Źródło 4: HERE Platform Terms (wersja obowiązująca, effective 18.09.2023), ograniczenia „w pojeździe”
URL: https://legal.here.com/en-gb/terms/here-platform

> "5.1 Subscription Plans — You will have access to the Base Plan upon acceptance of these Terms. [...] You must comply with any additional terms applicable to the selected Subscription Plans as described in Subscription Plan and related Documentation."
>
> "3.1 These Terms include and consist of the following additional documents, which are incorporated by reference and include any future updates to these documents: [...] b) Additional terms applicable to the Subscription Plans and pricing that you have selected;"

Ten zapis wprowadza do umowy ograniczenia z powyższych stron cennikowych.

> "6.3 Except as otherwise permitted in your Subscription Plan or separate agreement with HERE, you may not:
> a) Integrate HERE Materials into a ground, aerial, manned, or unmanned vehicle system or any component thereof, including vehicle positioning sensors (for example, GPS, triangulation, odometer, compass, gyroscope, or accelerometer), navigation terminals or black boxes, and windshield or display screens installed in the vehicle. [...]"

Omówienie: nasz model to backend odpytujący API na podstawie pozycji z telematyki, bez integracji HERE w urządzeniu w pojeździe. Nie jest to więc wprost „integracja w systemie pojazdu”. Pkt 6.3 a) to jednak drugie ograniczenie w tym obszarze. Rozstrzygające pozostaje wyłączenie „Asset Management” z Base Plan.

### Omówienie (a)
- **Śledzenie pojazdów / asset tracking / GPS w czasie rzeczywistym**: wykluczone jako „Asset Management” (i) „locating, tracking”.
- **Liczenie tras/ETA dla pojazdu**: wykluczone jako „Asset Management” (ii) „provision of route calculations”. Słowa „any one or all” oznaczają, że wystarczy jeden element.
- **Telematyka**: wykluczona jako „UBI/Telematics” (analiza po przejeździe) wraz z Asset Management.
- **Fleet management**: HERE nie używa w regulaminie terminu „fleet management”. Zakres pokrywają definicje Asset Management i Optimization („order of destinations and or routes”).
- **Tour Planning** to jedyny wyjątek i dotyczy tylko „Optimization”, nie liczenia ETA przez Routing API.
- Po stronie HERE nie ma obecnie planu „Freemium” (dawny 250k/mies.). Oficjalne strony opisują Base Plan i wygaszany Limited Plan, a oba mają to wyłączenie.

---

## (b) Przechowywanie / cache’owanie wyników: czy zapis samego ETA jest dozwolony i jak długo?

### Źródło: HERE Platform Terms (effective 18.09.2023)
URL: https://legal.here.com/en-gb/terms/here-platform

Sekcja 6.4:
> "6.4 You may not: [...]
> j) Cache or store outside of the Platform any Results that include anything from the use of HERE Content or Location Services for more than 30 days, except HERE Positioning services which cannot be cached or stored outside the Platform for more than 24 hours, unless Results are used solely for your internal testing, evaluation, or record retention for audit and legal compliance purposes;"
>
> "c) Modify HERE Content and/or Results;"
>
> "h) Provide Results and/or HERE Content to another person or entity;"
>
> "l) Create any Results that contain unenhanced or unmodified HERE Content or scaling one Request to serve multiple End Users;"
>
> "m) Use incorrect attribution of any information derived from the Platform;"
>
> "f) Use HERE Materials in connection with a machine learning or artificial intelligence (“AI”) system, including but not limited to, [...] predictive analytics, [...] and data extrapolation;"

Exhibit 2, HERE Location Services Terms:
> "1.3 In addition to the caching restrictions in the Platform Terms, you may not use HERE Materials in a manner that pre-fetches, caches, or stores data or Results, except as explicitly allowed by the caching headers (HTTP/1.1 standard) returned by HERE Location Services."

Definicje (sekcja 21):
> "21.16 Request means each API call made to the respective HERE Services to request Results as initiated by an End User using an Application, excluding internal server requests in response to each API call."
>
> "21.17 Result means each unique delivery of information delivered to an Application by the HERE Services in response to a Request [...]"

### Omówienie (b)
- ETA (czas przyjazdu/przejazdu z odpowiedzi Routing API) to „Result”. Regulamin nie robi wyjątku dla „samego ETA” ani dla danych bez geometrii. Ograniczenie dotyczy „any Results that include anything from the use of [...] Location Services”.
- **Maksymalny okres: 30 dni** przechowywania poza platformą HERE. Wyjątki: wewnętrzne testy/ewaluacja albo „record retention for audit and legal compliance purposes”. Czy historyczne ETA w dzienniku transportu mieszczą się w „audit/legal compliance”, zależy od interpretacji. Regulamin tego nie precyzuje, więc przy archiwizacji ETA ponad 30 dni potrzebna jest opinia prawna albo potwierdzenie od HERE.
- Dodatkowo (Exhibit 2, 1.3) cache/zapis ma być zgodny z nagłówkami cache HTTP zwracanymi przez API. Nie sprawdziłem faktycznych nagłówków Routing v8, bo wymaga to klucza API (zakaz rejestracji w tym zadaniu). **NIEZWERYFIKOWANE.** Ta klauzula może skrócić dopuszczalny okres poniżej 30 dni.
- Ryzyka interpretacyjne, na które trzeba uważać:
  - 6.4 l) „scaling one Request to serve multiple End Users”: pokazywanie jednego zapisanego ETA wielu użytkownikom (dyspozytor, klient, odbiorca) można czytać jako „skalowanie jednego Requestu”.
  - 6.4 h) „Provide Results [...] to another person or entity”: udostępnianie ETA stronom trzecim (np. klientowi przez link/e-mail) wymaga ostrożności.
  - 6.4 c) zakaz modyfikacji Results: korekta ETA np. o czas promu/postoju może być uznana za modyfikację. Regulamin nie mówi tego wprost. **NIEJASNE.**
  - 6.4 f) zakaz użycia z ML/„predictive analytics”: nie wolno karmić modeli predykcyjnych wynikami HERE.

---

## (c) Wymogi atrybucji (treść, miejsce)

### Źródło 1: HERE Platform Terms, sekcja 13.1
URL: https://legal.here.com/en-gb/terms/here-platform

> "13.1 You may not remove or obfuscate any HERE Marks or copyright notices affixed to or included in HERE Materials or Results. You will ensure that all HERE Marks and copyright notices are present in the HERE Materials and Result in accordance with HERE brand guidance (https://brandlive.here.com/). You must indicate that HERE is the owner of HERE Marks."

oraz 6.4 a) (łączenie danych HERE z innymi danymi):
> "[...] provided that, in both cases (i) and (ii), that the origin of the HERE Content and non-HERE content can be distinguished and correct attribution can be provided."

### Źródło 2: HERE Brand Hub, Copyright (brandlive.here.com przekierowuje na brand.here.com)
URL: https://brand.here.com/legal/copyright/

> "Any material (e.g. the Map canvas, Web pages, Presentations, Marketing Material, Advertising, etc.) owned by HERE and used by external parties should have the following copyright notice:
> © 20XX HERE
> Change the XX to correspond to the year when the material was published for the first time."
>
> "For material in page format, the copyright notice should be placed at the left or right bottom corner of every page of the material."
>
> "In tablet and desktop sized products showing the map canvas, the HERE copyright should be displayed on the map. In mobile handsets, including watches and embedded in-car systems, the HERE copyright may alternatively be displayed in the ‘About HERE’ section in the Settings. In applications supporting all display sizes, the HERE copyright should be displayed on the map and in the ‘About HERE’ section in the Settings."
>
> "When Partner & HERE copyright notices are required, display them on separate lines with HERE following the Partner copyright notice, as follows:
> © 20XX Partner
> © 20XX HERE"

### Źródło 3: HERE Supplier Terms / General content supplier terms and notices (effective 10.03.2026)
URL: https://legal.here.com/terms/general-content-supplier-terms-and-notices

> "If your products and/or services use certain content that is made accessible through the HERE products and/or services, you shall provide End-Users of your products and/or services with notice, in a reasonably conspicuous manner (e.g., by inserting a reference in the End-User Terms), of the terms under Section 1 below and source attributions under Section 2 below, where applicable."

Przykładowe noty dla naszej trasy (sekcja 2.1, Europe Territory):
> Poland: "© EuroGeographics" (+ noty m.in. dla City of Wroclaw, CSIOZ)
> Sweden: "Based upon electronic data from National Land Survey Sweden and upon information retrieved from Trafiklab.se" (+ noty Göteborg itd.)

### Źródło 4: warunki dla użytkowników końcowych (Platform Terms 6.2)
> "If any personal data of End Users is delivered to HERE by the End User or through the End User’s use of your Application, or if End Users are directly connected to the HERE Services, you shall make the End User Terms and the HERE Privacy Policy available to End Users [...]"

### Omówienie (c)
- Treść: „© 20XX HERE”, gdzie XX to rok. Tam, gdzie wyświetlamy ETA, należy wskazać HERE jako źródło.
- Miejsce: wytyczne mówią o mapie („on the map”), stronach („bottom corner of every page”) i sekcji „About HERE” w ustawieniach. **Nie znalazłem** osobnej, oficjalnej reguły dla wyniku bez mapy (sam tekst/liczba ETA). Najbezpieczniej umieścić „© 20XX HERE” przy wyświetlanym ETA lub w stopce widoku oraz w sekcji „O aplikacji / Źródła danych”.
- W warunkach dla naszych użytkowników (regulamin Watch Tower) trzeba dodać odnośnik do HERE Supplier Terms (noty dostawców danych).

---

## Koszt i sposób liczenia transakcji Routing v8

### Źródło: oficjalny cennik Base Plan
URL: https://www.here.com/get-started/pricing

Tabela cennika to widget JS. Dane pobrałem z oficjalnego źródła, z którego ten widget korzysta: `https://pricing-calculator.here.com/api/contentfulData?widget=Pricing%20Widget`, stan na 28.09.2026.

Produkt „HERE Routing”, pozycja **„Routing Truck”**:

| Transakcje miesięcznie | Cena za 1 000 (EUR) | Cena za 1 000 (USD) |
|---|---|---|
| 0 – 5 000 | Free | Free |
| 5 001 – 200 000 | €2,33 | $2,92 |
| 200 001 – 1 000 000 | €1,87 | $2,33 |
| 1 000 001+ | Contact us | Contact us |

Dosłownie z noty cennika: **"1 Transaction is counted for every Request."**

Dla porównania, „Routing Car, Bicycle, Pedestrian” ma 0–30 000 za darmo, potem €0,70 / $0,88 za 1 000, z zastrzeżeniem:
> "Routing Car is without time-aware information. You must specify either `departureTime=any` or `traffic[mode]=disabled` in your API request to use this mode. Otherwise, usage will be billed as ‘Time-Aware Routing’."

„Time aware routing” ma te same stawki co Truck (5 000 za darmo, €2,33 / $2,92).

### Toll costs (opłaty drogowe) jako dodatkowa transakcja
URL: https://docs.here.com/routing/docs/routing-v8-tolls-for-route
> "Requesting toll cost information for routes counts as an additional transaction."

„Toll Costs” w cenniku: 0–2 500 za darmo, potem €4,66 / $5,83 za 1 000.

### Omówienie (koszty)
- **Jedno zapytanie = 1 transakcja** („1 Transaction is counted for every Request”).
- **Truck nie mnoży transakcji**, ale ma inną, droższą pozycję cennika niż car: 5 000 zamiast 30 000 za darmo i €2,33 zamiast €0,70.
- **Punkty pośrednie (`via`)**: nie znalazłem w oficjalnych dokumentach zapisu, że `via` zwiększają liczbę transakcji. Jedyna oficjalna reguła to „1 Transaction [...] for every Request”, więc z tekstu wynika 1 zapytanie z dowolną liczbą `via` = 1 transakcja. Brak jednak wyraźnego potwierdzenia dla `via`. Mnożenie transakcji (S×D) dotyczy tylko Matrix Routing, nie `/routes`.
- **Dodatki zwiększają liczbę transakcji**: `return=tolls` doliczy transakcję „Toll Costs”. Nie dodawać tolls, jeśli niepotrzebne.
- **NIEJASNE**: czy truck z ruchem drogowym (domyślnie time-aware) liczy się tylko jako „Routing Truck”, czy także jako „Time-Aware Routing”. Nie znalazłem też potwierdzenia, czy limit 5 000 za darmo jest wspólny dla pozycji Truck/Time-aware, czy osobny dla każdej. Widget pokazuje „0 to 5,000 Free” przy każdej pozycji osobno, bez wyjaśnienia.
- **Szacunek przy 25 000 zapytań truck/mies.** (bez tolls, zakładając 1 pozycję cennika): (25 000 − 5 000) × €2,33/1 000 = **€46,60/mies.** (≈ $58,40), netto bez VAT (Platform Terms 9.3: „exclusive of applicable taxes”).
- Pojemność: 1 pojazd w trasie non-stop przy odświeżaniu co 15 min to 96 zapytań/dobę, czyli ≈2 880/mies. Darmowe 5 000 wystarcza więc na ≈1,7 „pojazdo-miesiąca”, a 25 000 na ≈8,7.
- Limity techniczne: RPS są opublikowane tylko dla Limited Plan „who do not provide payment information” (Routing Truck: 10 RPS, do tego 1 000 zapytań dziennie). Źródło: https://www.here.com/get-started/pricing/rps-limits-excluded-use-cases. Dla Base Plan HERE odsyła do cennika (https://docs.here.com/policies/docs/limits-and-quotas) i ostrzega o 429/503 przy nagłych skokach ruchu: „HERE services may return HTTP 429/503 status codes for a short period of time (usually up to 10 minutes) and throttle requests [...] even if the user's quotas were not reached.” **Nie znalazłem** osobnego limitu RPS dla Base Plan.

---

## Pozostałe dokumenty

- **Acceptable Use Policy** (effective 18.01.2022): https://legal.here.com/en-gb/terms/acceptable-use-policy. Nie ma w niej zapisu o trackingu pojazdów. Istotne zapisy:
  > "4) permits or seeks to permit the unauthorized use, disclosure or access of/to any HERE Materials, including but not limited to (except as expressly permitted by applicable law or contract): data mining, copying, storing, [...] monitoring, [...] combining, creating derivative works [...]"
  > "5) violates/circumvents contractual usage restrictions or any monitoring, reporting or authentication mechanisms;"
  >
  > "7) [...] a) for high-risk systems, devices or products in a manner where HERE Materials or any information derived therefrom would be critical to health or security of people or property;"

  Omówienie: użycie wbrew wyłączeniu z Base Plan byłoby też obejściem „contractual usage restrictions” w rozumieniu AUP.
- **„Service Terms”**: link https://legal.here.com/en-gb/terms/serviceterms prowadzi dziś do *HERE End User Terms* (effective 04.05.2021). Dotyczą użytkownika końcowego, a nie dewelopera, i nie zawierają zapisów o cache ani o asset tracking.
- **Product-specific terms dla Routing**: nie znalazłem osobnego dokumentu prawnego tylko dla Routing API. Zapisy produktowe są w Platform Terms, Exhibit 2 „HERE Location Services Terms” (zacytowany wyżej, pkt 1.3), w notach cennika i w dokumentacji (np. tolls = dodatkowa transakcja).
- **Retencja rekordów**: Platform Terms 10: „You will keep information that is sufficient to demonstrate the scope of your use [...] for three (3) years.”

---

## Uzasadnienie wniosku: NIE

1. Watch Tower liczy trasę/ETA dla konkretnej ciężarówki (vehicle = „Asset”) na podstawie jej bieżącej pozycji GPS (tracking), cyklicznie, w trakcie jazdy.
2. Oficjalna strona ograniczeń Base Plan wyłącza „Asset Management”: „(i) locating, tracking [...]; (ii) provision of route calculations [...]”, a wystarczy „any one”.
3. Platform Terms 3.1 b) i 5.1 wprowadzają te ograniczenia planu do umowy. HERE ogłosiło to wyłączenie oficjalnie od 7.04.2023. Plany „Monthly Active User or Asset based” nie mają tego ograniczenia.
4. To, że zapisujemy tylko ETA bez geometrii, nie zmienia kwalifikacji. Wyłączenie dotyczy przypadku użycia, a nie formy zapisu.

**Co dalej (bez zgadywania o cenach Enterprise):** wg HERE jedyna droga to „please contact us”, czyli oferta planu Enterprise / asset-based (np. per pojazd). Do rozmowy z HERE warto przygotować: liczbę pojazdów, częstotliwość (≤15 min), region (PL, DE/DK lub prom, SE), brak geometrii, retencję ETA oraz pytania o `via`, time-aware + truck, tolls i retencję >30 dni do celów audytu.

---

## Czego nie udało się ustalić (wprost)
- Faktycznych nagłówków cache (`Cache-Control`) odpowiedzi Routing v8. Wymaga klucza API, a rejestracja była poza zakresem zadania.
- Oficjalnego zapisu wprost o tym, czy `via` wpływają na liczbę transakcji. Jest tylko ogólne „1 Transaction per Request”.
- Czy Truck + ruch drogowy liczy się podwójnie (Truck + Time-Aware) i czy darmowe 5 000 jest wspólne dla tych pozycji.
- Oficjalnej reguły atrybucji dla wyniku bez mapy (sam tekst ETA).
- Czy archiwizacja ETA > 30 dni w historii transportu mieści się w wyjątku „record retention for audit and legal compliance purposes”.
- Osobnego limitu RPS dla Base Plan.
