# WATCH TOWER (TOWER) — Badanie konkurencji: control tower / shipment visibility

**Data badania:** 2026-09-23 (CEST)  
**Zakres:** platformy RTTV / control tower istotne dla korytarza projektowego KSH Śrem (PL) → Gdańsk Polferries → Nynäshamn → E4 → Stegra Boden (SE)  
**Strony projektu:** HHL (forwarder), KSH (klient), SCX (carrier), Stegra (site, read-only)  
**Charakter ładunków:** oversize / stal; zezwolenia PL+SE; zależność od promu; MVP 12–15 użytkowników; management by exception; Excel-as-plan  
**Metoda:** źródła pierwotne (strony produktowe, press, API docs, notatki Gartner cytowane przez vendorów). Brak publicznych cenników → pricing pominięty lub oznaczony [UNVERIFIED]. Nie wymyślamy % accuracy bez cytatu.

---

## Executive summary

1. Rynek RTTV 2025–2026 jest zdominowany przez enterprise platforms (project44, Shippeo, FourKites, Transporeon Visibility) budowane pod **skalę sieci** (setki tysięcy carrierów, miliony shipmentów), nie pod **jedną korytarzową operację multi-party** z 12–15 userami.
2. W Gartner Magic Quadrant for Real-Time Transportation Visibility Platforms (24 Feb 2025) **project44** i **Shippeo** są Leaders (wg własnych press release’ów). **FourKites** oficjalnie **wycofał się** z tej ewaluacji (24 Feb 2025), pozycjonując się jako Intelligent Control Tower + Digital Workforce.
3. Żaden z dużych RTTV **nie pokrywa dobrze** stacku Watch Tower: zezwolenia oversize PL/SE, statusy promu Polferries jako krytyczny gate, role-split pricing, Excel-as-plan, wąski multi-party governance (HHL/KSH/SCX/Stegra).
4. **Shippeo** i **Transporeon** są najbliższe EU road + multimodal; Shippeo deklaruje silne RoRo/FVL (w tym RoRo fleet connectivity). **project44** deklaruje RoRo wśród trybów. To nadal nie = permit + ferry booking orchestration.
5. **Everstream** to risk intelligence / digital twin sieci, nie operacyjny track-and-trace; wartościowy jako warstwa „outside-in” (pogoda, disruption), nie jako system dnia-do-dnia dla 15 osób.
6. Peers o realnym fitcie do luk Watch Tower (nie klasyczni RTTV): **FRAI** (heavy haulage routes + permits), **Eureka MoveIT** (ferry bookings + real-time sailing events), **Tive** (sensor/condition share), **Descartes** (multimodal milestone aggregation dla forwarderów).
7. Lekcja do skopiowania: **exception-first UX**, shared shipment object, API/webhook-first, consent multi-party, data-quality SLA mindset — bez kopiowania enterprise network onboarding.
8. Dyferencjacja MVP: **single-corridor control object** (plan Excel → legs → permits → ferry slot → exceptions → dokumenty) z RBAC per party; nie „world’s largest carrier network”.
9. NIE budować: AI agent orchestration, yard twins, sub-tier supplier mapping, global carbon analytics — overkill vs 12–15 users.
10. Integracje MVP: ręczny/CSV + webhooks; opcjonalnie później MacroPoint/telematics lub sensor (Tive) — nie pełny p44/Shippeo rip-and-replace.

---

## 1. project44

### 1.1 Positioning
project44 pozycjonuje się jako **Decision Intelligence Platform** dla supply chain: visibility multimodal + AI agents (Autopilot, Mo, Disruption Navigator), nie tylko mapa trackingu. (Źródło: project44.com, press Autopilot 11 May 2026; Mo 23 Jul 2026.)

### 1.2 Core capabilities (relewantne dla Watch Tower)
- **Visibility:** road FTL/LTL, ocean, air, rail, barge, parcel, last mile, facilities/ports/terminals; deklarowane **Roll-On/Roll-Off** (non-containerized, np. heavy machinery).  
- **ETA:** AI-powered predictive ETAs door-to-door.  
- **Exceptions / disruption:** AI Disruption Navigator łączy eventy zewnętrzne (np. strajk portu, pogoda) z shipmentami.  
- **Multi-party:** shared visibility (reguły udostępniania shipmentów partnerom/klientom).  
- **Documents:** AI Document Parsing (BoL, invoices, packing lists → webhook).  
- **API:** API-first; developer portal z endpointami v4 (event history, position history, route, tracking/history); webhooks.

### 1.3 Co robi dobrze — lekcje dla Watch Tower
- Jeden **shipment object** z related shipments / stops / route segments (model multimodal).  
- Share link / controlled sharing jako wzorzec multi-party.  
- Document parsing → structured data (przydatne przy permit PDFs / BoL, ale w MVP wystarczy upload + status).  
- Exception + external context (nie tylko GPS).

### 1.4 Luki wobec use case Watch Tower
- Enterprise scale (vendor claim: 1.5B shipments/yr, 1000+ brands, 282k preferred carriers — press Feb 2025); koszt/onboarding nieadekwatny do MVP 12–15 users.  
- Brak natywnego workflow **zezwoleń oversize PL+SE** i powiązania permit↔leg.  
- RoRo jako mode ≠ booking/status **konkretnego promu Polferries** Gdańsk–Nynäshamn jako gate.  
- Brak role-split pricing / Excel-as-plan jako source of truth.  
- Site read-only (Stegra) da się zamodelować sharingiem, ale cały stack jest overbuilt.

### 1.5 Pricing / Gartner / market claims
- **Gartner:** Leader w 2025 MQ for RTTVP; vendor claim: highest/furthest na Ability to Execute i Completeness of Vision (3. rok z rzędu); #1 we wszystkich 5 use cases Critical Capabilities. Cytacja Gartner w press: *Carly West, Oscar Sanchez Duran, Nathan Lease, 24 February 2025*. ([press 26–27 Feb 2025](https://www.project44.com/press-releases/project44-named-a-leader-in-the-2025-gartner-magic-quadrant-for-real-time-transportation-visibility-platforms-for-fifth-consecutive-year/))  
- Autopilot claimy ROI (np. 4% freight spend, 70% less manual coordination) — **vendor self-reported**, traktować jako marketing, nie niezależny benchmark.  
- **Pricing:** brak publicznego cennika → [UNVERIFIED / OMIT].

### 1.6 Public API / integration surface
- Developer portal: https://developers.project44.com/  
- Przykład guide (Ocean tracking): https://developers.project44.com/guides/shippers/visibility/ocean/tracking-updates  
- Endpointy (przykłady): `GET /api/v4/shipments/{id}/eventhistory`, `.../positionhistory`, `.../tracking`, `.../tracking/history`; webhooks dla full tracking history.

### 1.7 Sources
- https://www.project44.com/platform/visibility/ (fetched 2026-09-23)  
- https://www.project44.com/ (Decision Intelligence; Mo press 2026-07-23)  
- https://www.project44.com/press-releases/project44-launches-autopilot-... (2026-05-11)  
- https://www.project44.com/press-releases/project44-named-a-leader-in-the-2025-gartner-... (2025-02-27)  
- https://developers.project44.com/guides/shippers/visibility/ocean/tracking-updates  

---

## 2. Shippeo

### 2.1 Positioning
Shippeo to europejski lider RTTV: **trusted multimodal visibility + AI orchestration**, z naciskiem na jakość danych i **kontraktowe SLA** (tracking compliance, ETA accuracy, carrier onboarding). HQ Paris; silna baza EU shipperów.

### 2.2 Core capabilities
- Multimodal: road, ocean, rail, air; Network Control Center / Integration Hub (TMS, ERP, telematics).  
- Predictive ETAs, exception alerts, branded portals, communication.  
- **Shippeo AI** (launch 6 Nov 2025): Sidekick + Workspace + Agent Library.  
- **eCMR** (Nov 2025).  
- **FVL / RoRo:** enhanced RoRo visibility; vendor claim „connection with over 95% of the global RoRo fleet”; Vehicle Damage Report.  
- Vendor network claims (press Nov 2025): 228k+ carriers; 1,100 TMS/telematics/ELD; 100M shipments/yr; 150+ countries.

### 2.3 Co robi dobrze — lekcje
- **SLA na jakość danych** jako produkt (nie tylko marketing) — dla Watch Tower: jasne reguły „co jest źródłem prawdy” per leg (GPS vs ferry status vs manual).  
- Exception → action (nie tylko red dot).  
- EU-first carrier adoption model (Visibility Engineers) — analog: lekki onboarding SCX, nie 228k network.  
- RoRo/FVL świadomość — bliżej ferry corridor niż typowy US LTL stack.

### 2.4 Luki wobec Watch Tower
- Platforma pod enterprise multi-lane; MVP single corridor nie wykorzysta network effect.  
- Brak dowodu na **permit management** (PL/SE abnormal loads) ani Excel-as-plan.  
- RoRo fleet connectivity ≠ integracja **Polferries booking/check-in/missed sailing** jako pierwszy klasa wyjątków.  
- Multi-party: tak (portale), ale nie role-split commercial model HHL/KSH/SCX.  
- Pricing: brak publicznego cennika → [OMIT].

### 2.5 Pricing / Gartner / market
- **Gartner:** Leader w 2025 MQ RTTV — second consecutive year (Shippeo blog 1 Jun 2025; cytacja Gartner 24 Feb 2025).  
- Claim „only provider with triple contractual SLA” — **vendor claim** (Shippeo), nie niezależny audit.  
- Pricing: [OMIT].

### 2.6 Public API / integration
- Developer catalog (login/contract gated): https://developers.shippeo.com/catalog/all  
- Publiczne OpenAPI samples w community mirrors (np. event-subscriptions) — pełna docs za kontem.  
- Typowy surface (z publicznych opisów API directories): transport orders, positions, ETA/status, Events-out webhooks (`status.changed`, `eta.updated`, `milestone.reached`) — szczegóły schemy: weryfikować w portalu klienta.

### 2.7 Sources
- https://www.shippeo.com/platform-overview  
- https://www.shippeo.com/platform/shippeo-ai  
- https://www.shippeo.com/resources/explore/press-releases/shippeo-launches-shippeo-ai-... (2025-11-06)  
- https://www.shippeo.com/resources/explore/blog-newsletter/shippeo-named-a-leader-in-the-2025-gartner-... (2025-06-01)  
- https://developers.shippeo.com/catalog/all  

---

## 3. FourKites

### 3.1 Positioning
FourKites odchodzi od „dashboard RTTV” na rzecz **Intelligent Control Tower™**: Network Graph + Digital Twins (Shipment/Order/Inventory/Facility) + Loft agents (Digital Workforce) + FourSight AI. Hasło: see → reason → act → learn.

### 3.2 Core capabilities
- Shipment Twin: multimodal data model, ML ETAs, automated exception detection, bidirectional sync TMS/ERP/WMS (API, webhooks, EDI).  
- Agents (Tracy, Cassie, Alan, Sam…): exception resolution, customer notify, appointment reschedule, document processing.  
- Dynamic Yard APIs (gate, trailer, move requests).  
- Vendor claims na stronie platformy (fetched 2026-09-23): m.in. 3.2M daily tracked events, 1,600+ brands, 116.2M loads (liczby marketingowe — nie niezależnie zweryfikowane).

### 3.3 Co robi dobrze — lekcje
- **Impact tracing** (shipment late → które POs / site) — dla Stegra: „czy ten oversize blokuje slot rozładunku”.  
- Management by exception z audytowalnym decision trail.  
- Jeden Shipment Twin jako SoT — wzorzec danych MVP.

### 3.4 Luki wobec Watch Tower
- Autonomiczne AI agents / yard twins = overkill i ryzyko overengineeringu.  
- NA-heavy heritage; EU ferry+permit corridor nie jest core story.  
- Brak permit/oversize/Excel-plan.  
- Wycofanie z Gartner RTTVP MQ (Feb 2025) = świadoma zmiana kategorii, nie „porażka”, ale utrudnia porównanie 1:1 z p44/Shippeo.

### 3.5 Pricing / Gartner / market
- **24 Feb 2025:** FourKites **withdraws** from Gartner RTTVP Magic Quadrant evaluation (oficjalny press). Nie cytować FourKites jako 2025 MQ Leader na podstawie secondary summaries.  
- Pricing: [OMIT].

### 3.6 Public API / integration
- Developer portal: https://developer.fourkites.com/ (sign-in)  
- Carrier Dispatcher Updates (public KB): `https://tracking-api.fourkites.com/api/v1/tracking/dispatcher_updates` (preferowane co ~15 min)  
- Dynamic Yard Postman: https://documenter.getpostman.com/view/19175603/UVXkmZyw  
- KB TMS locations / tracking assignment: fourkites.my.site.com publicKB

### 3.7 Sources
- https://www.fourkites.ai/platform  
- https://www.fourkites.ai/platform/digital-twins/shipment-twin  
- https://www.fourkites.ai/press/fourkites-withdraws-from-gartner-rttvp-magic-quadrant (2025-02-24)  
- https://www.businesswire.com/news/home/20250115083404/en/FourKites-Introduces-Intelligent-Control-Tower-... (2025-01-15)  
- https://developer.fourkites.com/  

---

## 4. Transporeon (Visibility / Visibility Hub) — Trimble company

### 4.1 Positioning
Transporeon Visibility (dawniej/obok Trimble Visibility → migracja do Transporeon Visibility) to **AI-enabled real-time tracking** wbudowany w europejską sieć TMS/execution (shipper–carrier marketplace). Visibility Hub zasila ETA, alerts, consent/performance carrierów.

### 4.2 Core capabilities
- Road + ocean + air tracking; predictive ETAs; real-time alerts.  
- Carrier consent & Visibility Control Center (subcarriers).  
- Vendor claim: ~158k carriers w sieci; ~95% telematics market covered (strona discover Visibility Hub — traktować jako vendor claim).  
- Sep 2025: update ocean demurrage/detention + air tracking; Transport Planner / modular TMS direction.  
- Open Visibility Data / Open Visibility API — udostępnianie ETA/location zewnętrznym platformom/TMS.  
- Integracje z Trimble TOPS (road/ocean/air milestones, embedded UI).

### 4.3 Co robi dobrze — lekcje
- **Consent model** (kto widzi GPS) — krytyczne przy HHL/SCX/KSH.  
- Open Visibility API = wzorzec „jedno źródło pozycji → wielu konsumentów”.  
- Silne zakorzenienie w EU carrier workflows (bliżej SCX niż US-only tools).  
- Fact sheet claims (Reduce check calls up to 80% itd.) — **vendor marketing**, nie niezależny ROI.

### 4.4 Luki wobec Watch Tower
- Visibility Hub ≠ project control tower dla jednego korytarza oversize.  
- Brak natywnych **permit workflows** PL/SE.  
- Ferry jako ocean/RoRo milestone możliwy, ale **Polferries-specific booking lifecycle** nie jest produktem Visibility Hub (to raczej TMS ferry modules / manual).  
- Pricing rozproszony w szerszej platformie Transporeon — [OMIT].  
- Excel-as-plan / role pricing: poza scope.

### 4.5 Pricing / Gartner / market
- Network size 158k carriers / 1,400+ shippers — vendor site.  
- Fact sheet % (check calls, CO2…) — [VENDOR CLAIM, nie niezależne].  
- Pricing: [OMIT].

### 4.6 Public API / integration
- Open Visibility Data: https://www.transporeon.com/en_US/platform/transport-execution-visibility-hub/integrations/open-visibility-data  
- Open Visibility API guide (PDF): https://www.transporeon.com/website/pdf/open-visibility-data/open-visibility-api-guide-v3.pdf  
- Developer KB (Visibility APIs): Atlassian Transporeon ADPD space (API for Visibility; Receive/Send Visibility Data)  
- Historycznie endpoint Open Visibility: `GET https://api.sixfold.com/v1/open-visibility/shipments` (Sixfold = legacy Visibility brand; potwierdzać w aktualnym onboarding).  
- Push status: `POST https://api.transporeon.com/rtv/v1/transports/status` (wg docs KB / guide).

### 4.7 Sources
- https://www.transporeon.com/discover-transporeon-visibility-hub  
- https://www.transporeon.com/en/platform/transport-execution-visibility-hub/visibility/carrier  
- https://www.transporeon.com/en/company/press/transporeon-launches-new-transport-planning-capabilities (2025-09-25)  
- https://www.transporeon.com/en_US/platform/transport-execution-visibility-hub/integrations/open-visibility-data  
- https://intercom.help/transportoperations/en/articles/11829551-transport-tracking-via-visibility-hub  

---

## 5. Everstream Analytics

### 5.1 Positioning
Everstream to **supply chain risk intelligence** (nie klasyczny RTTV): digital twin sieci (suppliers, lanes, shipments, materials) + 24/7 monitoring z human validation. Gartner: cytowany w kontekście Supplier Risk Management Solutions (MQ / Critical Capabilities, 22 Apr 2025 — wg everstream.ai).

### 5.2 Core capabilities
- Network Mapping (digital twin).  
- Reveal: global monitoring & alerting (AI + human validation; claim 1000–1500 potential disruptions/day filtered).  
- Explore / Discover: supplier & sub-tier risk.  
- Insights-to-Action: integracje z planning/procurement/logistics (SAP, Oracle itd. — vendor).  
- Collaboration: action plans, scenario planning, supplier feedback.  
- In-house meteorology team.

### 5.3 Co robi dobrze — lekcje
- **Context engine** = mniej alert fatigue — MVP Watch Tower powinien filtrować wyjątki do „tylko to, co blokuje korytarz”.  
- Outside-in risk (pogoda SE E4, port Gdańsk, strajki) jako warstwa opcjonalna, nie core.  
- Playbooks / action plans przy disruption.

### 5.4 Luki wobec Watch Tower
- Nie zastępuje track-and-trace ani ferry/permit ops.  
- Enterprise SCRM — nie pasuje do 12–15 user single-project.  
- Sub-tier BOM mapping niepotrzebne dla stali KSH→Stegra (jedna lane).  
- API: „robust APIs” deklarowane; **brak publicznego OpenAPI portalu** znalezionego 2026-09-23 (docs gated).

### 5.5 Pricing / Gartner / market
- Gartner SRM MQ / Critical Capabilities 22 Apr 2025 — cytowane na everstream.ai (nie RTTVP).  
- Statystyki typu „$184B average annual losses…” na stronie Reveal — **nie używać jako faktu rynkowego bez pierwotnego źródła Everstream**; oznacz [VENDOR / UNVERIFIED context].  
- Pricing: [OMIT].

### 5.6 Public API / integration
- Brak otwartego developer portalu potwierdzonego publicznie (2026-09-23).  
- Vendor: API-centric / integrations with ERP & planning; webhooks/SFTP w materiałach partnerskich — szczegóły tylko po kontrakcie.

### 5.7 Sources
- https://www.everstream.ai/  
- https://www.everstream.ai/platform/network-mapping/  
- https://www.everstream.ai/platform/global-monitoring/  
- https://www.everstream.ai/articles/supply-chain-control-tower-basics/  
- https://www.everstream.ai/spend-matters-everstream-analytics-supply-chain-risk-management-solution/  

---

## 6. Peers (evidence-based) — istotne dla EU multimodal / oversize / ferry

### 6.1 Descartes (Multimodal Shipment Tracking / MacroPoint)

**Positioning:** Descartes agreguje milestone’y air/ocean/road dla forwarderów/brokerów; MacroPoint = carrier-based real-time location (silny w road visibility).  

**Relewantne capabilities:** consolidated carrier updates, exception on missed ETA, shipment portal, customs status hooks; MacroPoint carrier API (location, stop events, tracking number assignment).  

**Lekcje:** milestone aggregation „one dashboard zamiast 70 carrier sites”; proste customer-facing URL.  

**Luki:** nie jest project oversize control tower; brak permit PL/SE; ferry execution limited vs dedicated ferry TMS.  

**API:** MacroPoint carrier docs https://carrierdocs.macropoint.com/ — endpoints m.in. `/api/1.0/tms/data/location`, `/api/1.0/tms/data/stopevent`.  

**Sources:** https://www.descartes.com/solutions/broker-and-forwarder-enterprise-systems/multimodal-shipment-tracking ; https://carrierdocs.macropoint.com/

### 6.2 Tive

**Positioning:** visibility na poziomie **ładunku/sensora** (location + temperature/shock/light/humidity), z collaborator sharing.  

**Relewantne capabilities:** devices/trackers, alert presets, shipment templates, collaborators (w tym external), REST API v3 + webhooks.  

**Lekcje:** shock/light alerts przydatne przy oversize steel; granular share do Stegra bez pełnego TMS access.  

**Luki:** nie zarządza permitami, ferry bookingiem ani Excel planem; to warstwa IoT, nie control tower.  

**API:** https://developers.tive.com/docs/rest-api-overview — base `https://api.tive.com/public/v3/{endpoint}`  

**Sources:** Tive developer docs; https://www.tive.com/blog/multimodal-shipment-visibility

### 6.3 FRAI (Heavy Haulage Routing & Permit Automation)

**Positioning:** **nie RTTV**, ale najbliższy peer do luki Watch Tower: abnormal load routes + permits + assets na jednym live reference; współpracuje z systemami typu ESDAL (UK) — nie rip-and-replace.  

**Relewantne capabilities:** route↔permit↔trailer build↔schedule; live permit status by authority; compliance checks (permit valid, escort, insurance).  

**Lekcje (krytyczne):** model danych „permit jako first-class object powiązany z movement”; status pending/approved widoczny na shipment; unikać e-mail chase.  

**Luki:** UK/ESDAL-centric story na stronie; **nie potwierdzono** natywnego PL/SE permit connector (2026-09-23) — wzorzec produktowy tak, gotowy connector PL/SE = [UNVERIFIED]. Brak ferry Polferries.  

**API:** brak publicznego API docs na frai.global (fetched) — [gated / OMIT].  

**Sources:** https://www.frai.global/solutions/heavy-haulage-route-permit-automation

### 6.4 Eureka MoveIT (Ferry & Shipping Modules)

**Positioning:** irlandzki TMS z **dwukierunkową integracją ferry** (book/amend/cancel + live sailing events + invoice reconciliation + customs).  

**Relewantne capabilities:** integracje Irish Ferries, Stena, P&O, Seatruck, Eurotunnel, CLdN, DFDS; eventy: check-in, customs, departure, arrival, disembarkation, missed sailings → notifications.  

**Lekcje:** ferry leg jako operacyjny obiekt z eventami (nie tylko AIS); missed sailing = first-class exception.  

**Luki:** lista linii na stronie **nie zawiera Polferries** (2026-09-23); UK/IE-centric; pełny TMS, nie lekki multi-party tower; API publiczne nie znalezione.  

**Sources:** https://www.eureka.ie/tms-add-ons/ferry-shipping-modules/  

**Uwaga:** Motus Freight **nie** włączono — to LSP na Turvo, nie platforma visibility do porównania produktowego.

---

## Comparison matrix

| Kryterium (Watch Tower) | project44 | Shippeo | FourKites | Transporeon Visibility | Everstream | Descartes | Tive | FRAI | Eureka MoveIT |
|---|---|---|---|---|---|---|---|---|---|
| Real-time road visibility | ●●● | ●●● | ●●● | ●●● | ○ | ●● | ●● (device) | ○ | ● (TMS) |
| Multimodal / sea leg | ●●● (RoRo listed) | ●●● (RoRo/FVL) | ●●● | ●●● | ○ risk | ●● | ●● | ○ | ●●● ferry ops |
| Predictive ETA | ●●● | ●●● (+SLA claim) | ●●● | ●●● | ○ | ●● | ● | ○ | ● sailing events |
| Exception mgmt | ●●● | ●●● | ●●● agents | ●● | ●● risk playbooks | ●● | ● alerts | ● permit | ● missed sailing |
| Multi-party share / RBAC | ●●● | ●●● | ●● | ●● consent | ●● | ● portal | ●●● collaborators | ● | ● |
| Documents | ●● AI parse | ●● eCMR | ●● Sam agent | ● | ○ | ● | ○ | ● permits | ●● customs/ferry docs |
| Public API | ●●● | ●● (gated) | ●● (gated+) | ●● Open Vis | ○ gated | ●● MacroPoint | ●●● | ○ | ○ |
| Oversize permits PL/SE | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ●● pattern (ESDAL) | ○ |
| Ferry booking lifecycle | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ●●● (not Polferries) |
| Excel-as-plan / role pricing | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Fit MVP 12–15 users / 1 corridor | ○ overkill | ○ overkill | ○ overkill | ○ unless już w sieci | ○ | △ optional feed | △ sensor add-on | △ learn pattern | △ learn pattern |
| Gartner RTTVP 2025 | Leader (vendor) | Leader (vendor) | Withdrew | n/a tu | SRM not RTTVP | n/a | n/a | n/a | n/a |

Legenda: ●●● silne / ●● częściowe / ● słabe / ○ brak lub nie core / △ użyteczne jako wzorzec lub add-on.

---

## Implications for Watch Tower MVP

### Co skopiować (concrete)
1. **Shipment / Movement jako SoT** z legs (PL road → ferry → SE road → site) — wzorzec p44 route segments / FourKites Shipment Twin, uproszczony.  
2. **Management by exception:** kolejka wyjątków (permit pending, ferry missed, ETA slip, doc missing) — nie full map for everyone.  
3. **Multi-party sharing + consent:** HHL full, KSH commercial+ETA, SCX execution, Stegra read-only site ETA — jak share rules / collaborators.  
4. **Webhook/API-first** nawet jeśli UI później: event `exception.opened`, `leg.status_changed`, `permit.status_changed`.  
5. **Ferry leg first-class** (event model jak Eureka): booked / check-in / departed / arrived / missed — ręcznie lub CSV na start.  
6. **Permit first-class** (wzorzec FRAI): authority, status, validity vs route, escort flag — PL+SE, bez obietnicy auto-ESDAL.  
7. **Data quality rules** (Shippeo mindset): każde leg ma declared source (manual / GPS / ferry ops / sensor).

### Co pominąć w MVP
1. Global carrier network onboarding (p44/Shippeo/Transporeon scale).  
2. Autonomous AI agents / Digital Workforce (FourKites Loft).  
3. Yard twin, inventory twin, sub-tier supplier mapping (Everstream Discover).  
4. Pełny eCMR / carbon / demurrage suites.  
5. Budowa własnego „world’s largest data graph”.  
6. Zastępowanie TMS SCX — Tower orkiestruje wyjątki i wspólny obraz, nie dispatch.

### Dyferencjacja (1 zdanie pitch)
> Watch Tower to **project-scoped, multi-party exception control** dla korytarza oversize PL–ferry–SE z permitami i Excel-planem — nie enterprise RTTV network.

### Opcjonalne add-ony później (nie core)
- Tive (shock) na krytyczne ładunki.  
- MacroPoint / Transporeon Open Visibility jako feed pozycji, jeśli SCX już w sieci.  
- Everstream-style weather alert tylko jeśli E4/port disruptions realnie bolą.

---

## Brief dla koordynatora

- **Nie kupujcie enterprise RTTV** (project44 / Shippeo / FourKites / pełny Transporeon) pod MVP 12–15 userów — overkill kosztowy i procesowy; brak fit na permit + Polferries + Excel-plan.  
- **Gartner 2025 RTTVP:** Leaders wg vendor press = project44 + Shippeo; FourKites **wyszedł** z MQ (2025-02-24) — nie mylić w deckach.  
- **Najbliższe lekcje produktowe:** exception-first + shared shipment object + consent RBAC + webhook events.  
- **Największa luka rynku vs nasz corridor:** abnormal-load **permits PL/SE** + **ferry booking lifecycle** jako obiekty control tower — tu FRAI (pattern) i Eureka (ferry events) są bardziej pouczające niż RTTV leaders.  
- **Shippeo/p44 RoRo** = visibility floty, nie = integracja Polferries; na start: ręczne/CSV statusy promu jako gate wyjątków.  
- **Everstream** trzymać jako opcjonalną warstwę risk/weather — nie jako system operacyjny korytarza.  
- **Tive** rozważyć tylko jeśli Stegra/KSH wymaga dowodu shock/condition; inaczej zbędne w MVP.  
- **API strategy:** projektować event model jak Open Visibility / p44 webhooks; nie uzależniać MVP od żadnego vendor network.  
- **Pricing vendorów:** brak wiarygodnych publicznych cenników → w RFP pytać TCO vs 15 seats / 1 corridor / 12 mies.; nie cytować invented ARR.  
- **Pitch dyferencjacji:** single-project multi-party oversize corridor control (HHL–KSH–SCX–Stegra), management by exception, Excel-as-plan in / exceptions out.  
- **Następny krok badawczy (poza tym plikiem):** deep-dive Polferries API/EDI availability + SE/PL permit portals (Trafikverket / GDDKiA abnormal loads) — to jest nasz real moat vs RTTV.

---

## Appendix — metryki vendor claims (nie traktować jako niezależne fakty)

| Claim | Vendor | Data źródła | Status |
|---|---|---|---|
| 1.5B shipments/yr, 1000+ brands, 282k carriers | project44 | Press 2025-02-27 | Vendor claim |
| 228k carriers, 1100 TMS/telematics, 100M shipments/yr | Shippeo | Press 2025-11-06 | Vendor claim |
| 95%+ global RoRo fleet connectivity | Shippeo | Press 2025-11-06 | Vendor claim |
| 158k carriers, 95% telematics coverage | Transporeon | Visibility Hub page | Vendor claim |
| 3.2M daily events, 1600+ brands | FourKites | Platform / BW Jan 2025 | Vendor claim |
| Triple contractual SLA | Shippeo | Blog/product 2025 | Vendor claim (contractual — verify in MSA) |

---

*Plik wygenerowany na potrzeby WATCH TOWER research-2026. Wszystkie daty claimów jak w źródłach; dzień badania: 2026-09-23 CEST.*
