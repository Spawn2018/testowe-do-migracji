# 05 — Workflow / automation patterns (enterprise control towers)

**Stack constraint:** Inngest + json-rules-engine (CURSOR_PROMPT) — no React Flow builder in MVP.  
**Product rule:** management by exception; every automation leaves an audit trail.

---

## 1. Competitor pattern → WT translation

| Competitor pattern | Source flavour | WT implementation |
|---|---|---|
| Exceptions Engine + Tasks | project44 | M9 rules → create `tasks` / exceptions; SCX task nav |
| Digital Worker + decision trace | FourKites Loft | Inngest run log + `load_events` append |
| Document event → AP unblock | Polly | `DOC_ATTACHED` → invoice line eligible |
| Autopilot with escalation | p44 Autopilot **[MKT]** | HITL `waitForEvent` then escalate |
| Disruption navigator | p44 / Everstream | M10 risk objects + notify, no auto-cancel ferry |
| Real-time workflow / eDocs | Transporeon | Driver PWA milestones + doc deadlines |

---

## 2. Inngest building blocks (primary docs)

| Pattern | Doc | Use in WT |
|---|---|---|
| Durable `step.run` | https://www.inngest.com/docs/learn/how-functions-are-executed | Side effects: email, snapshot BAF, create task — idempotent |
| HITL `waitForEvent` | https://www.inngest.com/docs/ai-patterns/human-in-the-loop | HHL Accept invoice; SCX confirm Plan B ferry |
| Retries / `NonRetriableError` | https://www.inngest.com/docs/guides/error-handling | 4xx config errors vs transient telematics |
| Failure handlers | https://www.inngest.com/docs/features/inngest-functions/error-retries/failure-handlers | Alert coordinator; compensate |
| Cron | Inngest cron / Vercel | Telematics poll 5–10 min (needs Vercel Pro) |

**Memoization:** wrap each external call in `step.run` so retries don’t double-email.

---

## 3. Playbook anatomy (M9 form already: trigger → condition → actions)

```
trigger:   event | cron | geofence | schedule_import
condition: json-rules-engine facts (severity, hours_to_ferry, docs_missing, …)
actions:   [notify, create_task, set_risk, freeze_ready, propose_eta, …]
policy:    auto | propose_HITL | escalate_after_T
audit:     workflow_runs(id, rule_id, load_id, payload, steps[], outcome)
```

### Seeded rule families (extend the 7 seeds)

| ID | Trigger | Condition (sketch) | Action | Mode |
|---|---|---|---|---|
| W1 | cron T-48h | missing driver/truck/permit cover | task SCX + notify | auto |
| W2 | cron T-24h | same | escalate HHL + banner | auto |
| W3 | position | PRE_PORT & ETA>boarding_close | risk FERRY HIGH + Plan B toast | propose |
| W4 | MET wave | wave_h > threshold_config | risk FERRY MED/HIGH | auto risk only |
| W5 | Trafikverket Situation | severity on SE corridor & load in S4 | risk ROAD_SE + map pin | auto |
| W6 | doc deadline | POD missing >24h after UNLOADED | task SCX | auto |
| W7 | invoice submit | 3-way mismatch | DISPUTED line + HHL task | auto |
| W8 | factoring | SCX Accept offer | payoutStatus SCHEDULED | auto + audit |
| W9 | PERIOD expiry ≤14d | active loads need cover | alert SCX/HHL | auto |
| W10 | criticalDateChange | schedule import | notify SCX with diff | auto |
| W11 | geofence SITE | enter | PRE_ARRIVAL mail KSH ~40 min policy | auto |
| W12 | margin < threshold | pricing snapshot | flag HHL only | auto |

---

## 4. Escalation ladder (HITL)

```
L0 System detect → write exception (severity)
L1 Owner role (usually SCX Dispatch) — task SLA e.g. 2h
L2 Timeout → notify HHL Ops; waitForEvent(ack)
L3 Timeout → banner CRITICAL + optional SMS/email Sebastian
L4 Manual resolve → append load_event RESOLUTION
```

Mirrors Inngest HITL timeout → reassign pattern.

**Never** auto-change ferry booking or permit state without human at L2+.

---

## 5. Event taxonomy (align with `load_events`)

Prefer **append-only domain events** as triggers, not UI clicks:

- `SCHEDULE_IMPORTED`, `RESOURCES_SET`, `PERMIT_LINKED`, `GEOFENCE_*`, `MILESTONE_*`, `DOC_*`, `FERRY_*`, `RISK_OPENED/CLOSED`, `INVOICE_*`, `FACTORING_*`

Workflows subscribe to these; UI only emits intent events (`USER_ACK`, `USER_APPROVE_PLAN_B`).

---

## 6. Idempotency & safety

1. Natural keys: `rule_id + load_id + window_bucket` for cron.  
2. Emails: Resend idempotency key.  
3. Money: factoring Accept once; subsequent = no-op.  
4. RLS: workflows run as service role but **write only allowed tables**; never leak margin to SCX notify payloads.  
5. Personal data: notifications omit driver phone unless recipient org = SCX/HHL Ops.

---

## 7. Observability UX

M9 screen already: toggle + run log. Elite additions:

- Filter runs by rule / load / failed.  
- “Replay” = re-enqueue with same payload (admin).  
- Diff view: facts evaluated true/false (json-rules trace).  
- Link run → drawer transport.

---

## 8. What not to build (yet)

- Visual node graph (React Flow) — weeks; form is enough.  
- Fully autonomous carrier calling agent.  
- Cross-tenant learning from other shippers’ data.  
- Replacing fireTMS/interLAN workflows inside carrier HQ.

---

## 9. Uncertainty

- Exact Inngest plan limits on Vercel Pro: confirm at GO.  
- SMS provider not in stack — email/Resend first; SMS = P2.  
- json-rules-engine fact schema must be versioned or old runs become opaque.
