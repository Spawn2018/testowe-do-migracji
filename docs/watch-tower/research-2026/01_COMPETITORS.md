# 01 — Competitors & reference products (Sept 2026)

**Method:** primary vendor pages + press + independent roundups.  
**Rule:** marketing claims marked **[MKT]**; verified product surfaces marked **[PUB]**; pricing almost always **[OPAQUE]**.

Corridor context for comparison: multi-party (HHL/KSH/SCX/Stegra), abnormal loads, one daily ferry, SE road ~900 km, document/permit heavy, BAF contract logic — **not** global LTL/OTR network scale.

---

## Scorecard (fit for Stegra Boden corridor)

| Vendor | Exception UX | Map+queue | Doc vault | Pricing/BAF | Workflow auto | ETA ML | Fit WT |
|---|---|---|---|---|---|---|---|
| project44 | Strong | Strong | Doc extract **[MKT]** | No BAF engine | AI agents 2026 **[MKT]** | Predictive ETA **[MKT]** | Pattern only |
| FourKites | Strong + Digital Workers | Strong | Polly vault **[PUB]** | No SEFS-like | Loft agents **[MKT]** | Twin ETA **[MKT]** | Doc+HITL patterns |
| Shippeo | Strong EU road | Strong | Standard | Opaque | AI agents **[MKT]** | Predictive + Guarantee **[MKT]** | Closest EU visibility ref |
| Transporeon Visibility | Medium | Medium+yard | eCMR/docs | Freight procurement | Real-time workflow | Self-learning ETA **[MKT]** | Yard/slot patterns |
| Everstream | Risk-first | Risk map | N/A primary | N/A | Alerting | Disruption predict **[MKT]** | M10 risk inspiration |
| Descartes MacroPoint | Alerts | Tracking | POD chase agents **[MKT]** | N/A | AI agents 202x | Predictive ETA | Carrier-network pattern |
| Manhattan Active | Control tower workspace | Maps+KPI | Via TMS | TMS rating | Agents + FourKites | Dynamic ETA via FK | Enterprise TMS ref |
| Trimble Freight Visibility | Alerts+geofence | Multimodal | Consent/network | N/A | Automated alerts | Traffic/weather ETA **[MKT]** | Telematics adjacency |
| Webfleet Visibility | Fleet ops | Map | Limited | N/A | Jobs/messages | Traffic ETA | **API source** more than CT |
| fireTMS / interLAN / FrameLogic | Ops TMS | GPS integ. | CMR/invoice | PLN freight | Partial | Limited | Carrier-side reality PL |

---

## 1. project44

**URLs**
- Visibility: https://www.project44.com/platform/visibility/
- Exception collaboration: https://www.project44.com/blog/in-platform-collaboration-the-key-to-efficient-exception-management/
- AI agents press (decision44): https://www.project44.com/press-releases/project44-launches-ai-agent-portfolio-at-decision44-built-on-a-decade-of-context-skills-and-orchestration/

**Exception-first UX [PUB/MKT]**  
Exceptions Engine: define → detect → surface in Movement → Task Management assign/resolve. Blog cites **[MKT]** “~40% faster identification” / “~20% faster resolve” — **do not reuse in WT materials**.

**Map+queue**  
Multimodal tracking UI + API-first embed in TMS/ERP. AI Disruption Navigator links weather/port events to shipments **[MKT]**.

**Document vault**  
Claims automated extraction from BOL/invoice/packing list → webhook **[MKT]**. Not a permit PERIOD/TRIP model.

**Pricing/BAF**  
Not a freight-rate / fuel-surcharge contract engine. **[OPAQUE]** enterprise license.

**Workflow**  
2026: Exception / Disruption / Network Operations Agents + Autopilot with configurable triggers **[MKT]** — still requires shipper config & carrier network quality.

**ETA ML**  
“Predictive ETAs across every leg” grounded in “largest logistics data graph” **[MKT]** — no public model card or published CI metrics for road PL–SE.

**Public vs fluff**  
Public: product categories, API-first positioning, agent portfolio naming. Fluff: accuracy %, network size as proxy for corridor quality, autonomous resolution without HITL evidence for abnormal loads.

**WT takeaway:** copy **queue + task + severity**; ignore network-scale claims.

---

## 2. FourKites

**URLs**
- Platform: https://www.fourkites.ai/platform (also fourkites.com/platform)
- Control Tower launch: https://www.businesswire.com/news/home/20250115083404/en/FourKites-Introduces-Intelligent-Control-Tower-with-Real-Time-Data-Digital-Twins-and-AI-Powered-Digital-Workforce
- Document management: https://www.fourkites.ai/outcomes/centralized-shipping-document-management
- Polly: https://www.fourkites.ai/digital-workforce/polly

**Exception-first**  
Narrative: alert-only = dashboard; CT = impact trace across order/facility + agent + decision trace **[MKT]**.

**Map+queue**  
Shipment Twin + Facility Twin; ETA-driven appointment automation (Alan) **[MKT]**.

**Document vault [PUB pattern]**  
Polly: collect POD/customs from email/portal/API/EDI → classify → link to shipment → route to AP/compliance. Strongest **vault lifecycle** reference for M6/M11 unblock.

**Pricing/BAF**  
Not SEFS. Listings occasionally show AWS Marketplace ballpark **[OPAQUE/unverified for WT]**.

**Workflow**  
Loft: plain-language SOPs → monitored agents with decision traces **[MKT]**. Useful metaphor for Inngest playbooks + audit.

**ETA**  
Live ETAs feeding twins; Dynamic ETA often via network **[MKT]**.

**WT takeaway:** document event → payment/customs unlock; decision-trace on automation; do **not** promise Digital Workers.

---

## 3. Shippeo

**URLs**
- Home: https://www.shippeo.com/
- Visibility: https://www.shippeo.com/visibility/real-time-visibility
- Ocean exception blog: https://www.shippeo.com/resources/explore/blog-newsletter/mastering-ocean-visibility-proactive-exception-management-for-a-smoother-supply-chain
- EU ETA roundup: https://trucksonthemap.com/best-predictive-eta-software/

**Exception-first**  
Predictive ETAs + alerts + prioritize delays/missed milestones/dwell **[PUB messaging]**. “Shippeo Guarantee” on tracking completeness / delay prediction / onboarding **[MKT — contractual marketing]**.

**Map+queue**  
Multimodal EU-strong road visibility; neutral carrier onboarding emphasis.

**Docs / BAF / pricing**  
Docs not a differentiator in public materials. **[OPAQUE]** pricing.

**API**  
Enterprise OAuth2 APIs exist in partner catalogs (transport-orders, ETA, webhooks) — schemas portal-gated; not free.

**WT takeaway:** best **European road visibility** UX reference; Guarantee language is competitor marketing, not a feature to copy.

---

## 4. Transporeon Visibility (ex-Sixfold; Trimble-owned)

**URLs**
- Shipper visibility: https://www.transporeon.com/en_US/platform/transport-execution-visibility-hub/visibility/shipper
- Roundup context: https://trucksonthemap.com/best-predictive-eta-software/

**Exception / workflow**  
Real-Time Workflow: electronic docs, driver in workflow, status stages, photo damage **[PUB]**. Dock & Yard: time-slot management, claims up to 40% wait reduction **[MKT]**.

**Map+queue**  
Visibility Hub inside broader procurement/execution suite — value tied to ecosystem adoption.

**Docs**  
Digital transport documents / eCMR on platform **[PUB]**.

**ETA**  
Continuous recalc with traffic/weather/driver breaks / self-learning **[MKT]**.

**WT takeaway:** **awizacja as time window** + yard call-off patterns; avoid full Transporeon lock-in narrative.

---

## 5. Everstream Analytics

**URLs**
- Positioning via industry compares: https://procurementaiagents.com/compare/interos-vs-resilinc-vs-everstream-risk
- Feature summaries: https://logistics.toolsinfo.com/tool/everstream-analytics

**Focus:** predictive **risk** (weather, labor, port, geo) + multi-tier network — not day-to-day abnormal-load ops.

**WT takeaway:** inspire M10 risk layers (ferry wave, E4 situation) — **not** supplier n-tier graph.

---

## 6. Descartes MacroPoint

**URLs**
- Visibility: https://macropoint.com/features/real-time-visibility/
- AI agents news: https://www.descartes.com/resources/news/descartes-expands-ai-innovation-global-logistics-network-ai-agents-freight-visibility

**Patterns:** carrier-network ELD/telematics ping, predictive ETA, alerts, customer portals, agents for restore tracking / POD chase **[MKT]**.

**WT takeaway:** “restore tracking” = our PWA fallback when OEM API silent.

---

## 7. Manhattan Active Transportation / Unified Logistics Control

**URLs**
- Unified Logistics Control: https://www.manh.com/en-gb/our-solutions/supply-chain-management-software/transportation-management-system/unified-logistics-control
- FourKites ocean/rail extension context: https://itsupplychain.com/manhattan-associates-extends-tms-visibility-with-fourkites-to-cover-ocean-rail-tracking/

**Patterns:** control-tower workspace combining visibility, map, KPI filters, exception alerts, execution in same app; Dynamic ETA often via partner **[PUB/MKT]**.

**WT takeaway:** **single workspace** (map+queue+drawer) already in UX_MAP — keep; don’t expand to WMS/labor.

---

## 8. Trimble Freight Visibility

**URL (brochure):** https://transportation.trimble.com/_default_upload_bucket/brochure/Brochure%20Overview/pdfs/Freight-Visibility_2026_solution-overview.pdf

**Patterns:** multimodal tracking, traffic/weather ETA, geofences, automated alerts, carrier identity/consent, subcarrier onboarding **[MKT brochure]**.

**Adjacency:** Trimble owns Transporeon — visibility+TMS consolidation trend.

---

## 9. Webfleet (TomTom) Visibility / Connect

**URLs**
- Developer resources: https://www.webfleet.com/en_us/webfleet/partners/integration/developer-resources/
- Connect docs PDF referenced from that page (versioned, e.g. 1.74.0)

**Role for WT:** less “control tower competitor”, more **telematics provider** SCX may already run. Connect API = positions, jobs, message queues (see `03_APIS_VERIFIED.md`).

---

## 10. Polish / Nordic TMS (relevant)

### fireTMS
- https://firetms.com/ · features https://firetms.com/functions  
- Carrier/client portals, GPS integrations, invoicing, Swagger API (`app.firetms.com/api/swagger-ui.html` per vendor blogs).  
- **Fit:** what SCX dispatchers live in daily — WT is **overlay**, not replacement.

### interLAN SPEED / iSPEED
- https://www.interlan.pl/produkty/ispeed/  
- Cloud TMS, AI doc/email processing **[MKT]**, Trans.eu integration, extranet.

### FrameLogic (AddSecure)
- https://www.addsecure.pl/zarzadzanie-flota/framelogic/  
- FMS+TMS; Linkway integrator for visibility platforms.

**Nordic:** no strong open “Torvald” hit in this research pass — treat as **[UNVERIFIED]**. For SE corridor, Trafikverket + ferry + AIS matter more than a Nordic TMS brand.

---

## Cross-cutting UX patterns to steal (concrete)

1. **Login → exception queue sorted by severity × time-to-impact** (p44 Tasks summary).  
2. **Shipment twin fields:** next action, owner, missing doc, ETA confidence band.  
3. **Document-available event** unblocks invoice (Polly → M11).  
4. **Time-slot / window** not point ETA for loading & site.  
5. **Decision trace** on every automation (FourKites Loft / Inngest run log).  
6. **Map never alone** — always list/queue 40% (WT already).  
7. **Carrier data quality %** (completeness of positions/milestones) before blaming ETA model.

## Explicit non-goals (competitor traps)

- Buying into global carrier network for 15 trucks.  
- Autonomous carrier calls without HITL for abnormal/permit loads.  
- Claiming ETA accuracy % without holdout on **this** corridor.  
- Replacing SCX TMS — integrate via API/PWA instead.

---

## Uncertainty log

| Item | Status |
|---|---|
| Exact 2026 UI screenshots of p44/FourKites/Shippeo | Not captured (login walls); rely on public pages + case blogs |
| AWS $250k FourKites figure | Third-party listing — treat **[UNVERIFIED]** |
| Shippeo Guarantee legal terms | Marketing page only |
| fireTMS API surface completeness | Swagger exists per blogs; not re-fetched schema-by-schema here |
