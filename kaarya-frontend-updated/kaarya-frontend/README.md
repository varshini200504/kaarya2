# Kaarya — frontend

Operations console for the Kaarya support agent. React + Vite + Tailwind + lucide-react.
It talks to the existing Express backend at `http://localhost:4000`. Nothing is mocked —
every number and decision on screen comes from a real API call.

## Run it

```bash
# terminal 1 — backend
cd kaarya-backend
npm install
npm start          # http://localhost:4000

# terminal 2 — frontend
cd kaarya-frontend
npm install
npm run dev        # http://localhost:5173
```

To point at a different host, copy `.env.example` to `.env` and set `VITE_API_BASE_URL`.

## Screens

| Screen | Endpoints |
| --- | --- |
| Overview | `GET /metrics`, `GET /audit`, `GET /approvals` |
| Customer Simulator | `POST /chat`, `POST /approvals/:id/approve`, `POST /approvals/:id/escalate`, `GET /tickets/:id` |
| Sales Simulator | none — local demo state, labelled `DEMO SALES FLOW` |
| Approvals | `GET /approvals`, `POST /approvals/:id/approve`, `POST /approvals/:id/escalate` |
| Audit Log | `GET /audit` |
| Metrics | `GET /metrics`, `GET /audit` |
| Trust & Learning | `GET /audit` (three of four signals derived; the rest marked demo) |

Connection state comes from `GET /health`, polled every 10s. `POST /refund`,
`POST /crm/update` and `POST /ticket/close` are wired in `src/api/client.js` but are not
called from the UI — the backend already performs those actions internally on the
auto-approve path, and calling them from the browser would double-log the audit trail.

## Demo script

Open **Customer Simulator** and press the scenario buttons left to right. Each one
issues a real `POST /chat`; the pipeline strip at the top (Understand → Decide → Policy → Act)
fills in as the response is revealed stage by stage.

- **A · ORD-1042 · ₹350 (Rahul S.)** — all five policy checks pass → `AUTO_APPROVE`.
  Backend refunds and closes the ticket in one request. Strip ends green on *Act*.
- **B · ORD-1099 · ₹2,500 (Ananya M., gold)** — over the ₹500 auto-refund limit →
  `HUMAN_APPROVAL`. Approve or Escalate appear. Approving calls
  `POST /approvals/:id/approve` with `{"agentId": "agent-priya"}`.
- **C · ORD-1150 · ₹700 (Vikram T.)** — unverified, fraud flag, 0.40 confidence.
  The UI marks it as blocked and hides the Approve button; only
  `POST /approvals/:id/escalate` is offered. `/refund` is never called.

Each resolved case then runs **outcome verification**: the UI re-reads the ticket with
`GET /tickets/:id` and confirms refund recorded, customer notified and ticket closed.
Scenario C shows `OUTCOME BLOCKED` instead — it never claims a refund happened.

**Part 2 — sell.** Open **Sales Simulator**: GMV signal → qualify → draft offer → send →
merchant replies "interested" → warm-lead brief → hand off. This flow is local state only.

**Part 3 — trust.** Open **Trust & Learning**: the trust ladder (currently Supervised),
performance signals, and the learning loop.

Then show **Approvals** (same actions from the queue, buttons lock once resolved),
**Audit Log** (every event, filterable and exportable), and **Metrics**.

Backend state is in-memory, so restarting `kaarya-backend` resets the demo.

## Notes on the backend contract

- The policy engine returns only `AUTO_APPROVE` or `HUMAN_APPROVAL`. There is no
  `ESCALATE` decision. Scenario C arrives as `HUMAN_APPROVAL`; the frontend inspects
  the failed checks (fraud flag / unverified / low confidence) and presents it as a
  blocked risk case. Escalation becomes real when the agent hits the escalate endpoint.
- `GET /metrics` doesn't break out agent-approved vs fraud-escalated counts, so those
  two cards are derived from `GET /audit` (`HUMAN_APPROVED` and `ESCALATED` events) —
  the same log the backend rolls up from.
- `POST /approvals/:id/approve` marks the order refunded but logs `HUMAN_APPROVED`
  rather than `REFUND_ISSUED`, so "Total refunded" adds those amounts to
  `metrics.totalRefundedInr`.

## What is real and what is demo

Every badge on screen says which is which.

- **Real** — everything on Overview, Customer Simulator, Approvals, Audit Log, Metrics,
  plus outcome verification (a genuine re-read of the ticket) and three of the four Trust
  performance signals (policy compliance, human override rate, verified outcomes).
- **Demo** — the whole Sales Simulator (the backend has no sales endpoints), the trust
  score, decision accuracy, agent corrections and policy adjustments. These are marked
  `Demo value` / `Demo signal` / `DEMO SALES FLOW` in the UI. No fake API call is made
  for any of them.

## Structure

```
src/
  api/client.js          all HTTP calls, one place
  lib/scenarios.js       the three demo cases (mirrors backend seed data)
  lib/decision.js        outcome classification + audit event mapping
  components/            Sidebar, TopBar, StageTrack, PipelineTrack, DecisionPanel,
                         Verification, PolicyChecks…
  pages/                 Overview, Simulator, Sales, Approvals, Audit, Metrics, Trust
```
