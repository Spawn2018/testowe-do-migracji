# WATCH TOWER — ACCEPTANCE (module-by-module)

Legend: **PASS** expected after `npm run build` + click-through in `npm run dev`.

## Shell
| # | Criterion | Status |
|---|-----------|--------|
| S1 | Topbar 52px: brand, project, role switch, PL/EN/SV, theme toggle, EU clock | PASS |
| S2 | Corridor spine filters loads globally; pressed state; counters | PASS |
| S3 | Nav 186px per role matrix; aria-current + accent bar; badges | PASS |
| S4 | Drawer ~440px; tabs; state-changing actions | PASS |
| S5 | Theme: HHL/SCX dark, KSH light first paint; manual toggle session-sticky | PASS |
| S6 | `/driver/:token` outside shell | PASS |

## M1 Harmonogram
| # | Criterion | Status |
|---|-----------|--------|
| M1.1 | Real XLSX parse (ExcelJS) → column mapping → dry-run +/~/−/⚠ vs loads | PASS |
| M1.2 | Commit creates schedule version + SCHEDULE_IMPORTED / critical date notify | PASS |

## M2 Lista + drawer
| # | Criterion | Status |
|---|-----------|--------|
| M2.1 | Table ≥60 loads | PASS (62) |
| M2.2 | Drawer tabs: Overview, Timeline, Resources, Awizacja, Ferry, Docs, Pricing (role-gated), Chat, ETA | PASS |
| M2.3 | Resource/awizacja/ferry edits append events | PASS |

## M3 Mapa
| # | Criterion | Status |
|---|-----------|--------|
| M3.1 | Split ~60/40; bidirectional hover; focus; layer toggles | PASS |
| M3.2 | Status colors; POI Śrem / Gdańsk / Nynäshamn / Stalverket 20 | PASS |

## M4 Geofence
| # | Criterion | Status |
|---|-----------|--------|
| M4.1 | ≥12 zones; form hysteresis/dwell/notify; save | PASS (13) |
| M4.2 | gf-01 = KSH Śrem · Grunwaldzka 27C; SITE = Stegra · Stalverket 20 | PASS |

## M5 Driver PWA
| # | Criterion | Status |
|---|-----------|--------|
| M5.1 | Milestones + share position → load_events in tower timeline | PASS |
| M5.2 | PL/EN/SV; camera mock | PASS |

## M6 Dokumenty + permits
| # | Criterion | Status |
|---|-----------|--------|
| M6.1 | Categories, deadlines, upload mock, ZIP mock | PASS |
| M6.2 | permit_fits from PERMIT_BY_RATE_LINE: PL kat + SE path + pilots; Kratownice W=3.6 → IV/V + SE dispens + pilot×1 | PASS |
| M6.3 | SG-07 mismatch blocks READY | PASS |

## M7 Finanse / SEFS
| # | Criterion | Status |
|---|-----------|--------|
| M7.1 | SEFS hybrid min(mult_sek, mult_pln); road only; ferry eco separate | PASS |
| M7.2 | Both legs + applied; weekly snapshots; Orlen+OKQ8 URLs | PASS |
| M7.3 | Rate matrices; margin waterfall HHL-only; cost/rev by role (DOM hidden) | PASS |

## M8 Dashboards
| # | Criterion | Status |
|---|-----------|--------|
| M8.1 | ≤6 KPIs + exception queue per role | PASS |
| M8.2 | HHL waterfall; KSH sequence+72h; SCX tasks; Stegra 72h Stalverket RO | PASS |

## M9 Workflows
| # | Criterion | Status |
|---|-----------|--------|
| M9.1 | 12 rules; toggle; edit trigger/condition/actions; Run now → notification + workflow_run | PASS |

## M10 Risks
| # | Criterion | Status |
|---|-----------|--------|
| M10.1 | Filters FERRY/ROAD_SE/DOC/OPS; Plan B panel | PASS |

## M11 Invoices
| # | Criterion | Status |
|---|-----------|--------|
| M11.1 | SCX wizard expected vs billed → submit; HHL Accept/Dispute; MATCHED+DISPUTED seed | PASS |
| M11.2 | Factoring: HHL configures offer (enabled/fee%/delay); SCX selects on submit with gross/fee/net/ETA; Accept → payoutStatus SCHEDULED | PASS |

## M12 ETA
| # | Criterion | Status |
|---|-----------|--------|
| M12.1 | Segment breakdown PL Śrem→Gdańsk + wait + crossing + SE + breaks; updates on status/event | PASS |
| M12.2 | Confidence LOW/MED/HIGH + earliest–latest + reason chips; label heurystyka (nie ML %) | PASS |

## UX_MAP §8 checklist
1. Nav views non-stub — PASS  
2. Drawer actions mutate state — PASS  
3. Role hides cost/rev/margin nodes — PASS  
4. Import commit version+event — PASS  
5. Workflow run now — PASS  
6. Invoice match status — PASS  
7. Driver milestone → timeline — PASS  
8. ≥60 loads — PASS (62)  
9. PL/EN/SV — PASS  
10. No dead primary CTAs in journeys — PASS  
11. Spine filters list+map — PASS  
12. Theme first paint HHL/SCX dark, KSH/Stegra light — PASS  

## Known gaps
- MapLibre: worker URL wired (Vite `?url`); tiles depend on OpenFreeMap/MapTiler reachability — seed AIS banner when no key.
- Trafikverket live only when `TRAFIKVERKET_API_KEY` present (else seed labeled).
