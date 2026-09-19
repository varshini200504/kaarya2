# Kaarya Backend — Hackathon Skeleton

The full pipeline works end-to-end right now with mock data:

```
Customer message
      ↓
Understand context   (src/engine/context.js)
      ↓
Retrieve knowledge    (src/rag/retriever.js) — informational context only
      ↓
LLM decision          (src/engine/llm.js)   — proposes only, no authority
      ↓
Policy engine          (src/engine/policy.js) — deterministic, decides
      ↓
 ┌───────────────┐
 │               │
AUTO           HUMAN
 │               │
 ↓               ↓
Mock APIs      Approvals queue
 │               │
 ↓               ↓
Ticket closed   Approve/Escalate
```

## Run it

```bash
npm install
npm start          # http://localhost:4000
```

By default there's no `ANTHROPIC_API_KEY`, so the LLM step uses a
**deterministic mock reasoner** (`decideMock` in `src/engine/llm.js`).
This is intentional — it means your demo never breaks because of API
latency or downtime on stage. To use the real Claude API instead:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

If the live call fails for any reason, it automatically falls back to
the mock reasoner, so it's safe to leave the key set during the demo.

## Seeded demo data

| Order      | Customer            | Amount | Verified | Fraud | Expected outcome |
|------------|----------------------|--------|----------|-------|-------------------|
| ORD-1042   | CUST-8821 (Rahul S.) | ₹350   | yes      | no    | **AUTO_APPROVE**  |
| ORD-1099   | CUST-9042 (Ananya M.)| ₹2500  | yes      | no    | **HUMAN_APPROVAL** (over limit) |
| ORD-1150   | CUST-1187 (Vikram T.)| ₹700   | no       | yes   | **HUMAN_APPROVAL** (unverified + fraud flag) |

Policy thresholds live in `src/engine/policy.js`:
- `AUTO_REFUND_LIMIT = 500` (INR)
- `MIN_AUTO_CONFIDENCE = 0.85`

## Endpoints

### Core pipeline
```
POST /chat
  body: { orderId, customerId?, message }
  → runs context → decide → policy → auto-resolve or escalate
```

### Mock action APIs (independently callable/testable)
```
POST /refund        { orderId, amount, reason }
POST /crm/update     { customerId, note }
POST /ticket/close   { ticketId, resolutionSummary }
```

### Approvals queue (powers the agent dashboard)
```
GET  /approvals
POST /approvals/:id/approve   { agentId }
POST /approvals/:id/escalate  { note }
```

### Misc
```
GET /health
GET /tickets/:id
GET /audit        — full event log (every action, timestamped)
GET /metrics      — rollup: autoResolved, escalatedToHuman, totalRefundedInr
```

## Demo script (curl)

```bash
# Scenario A — auto-approve (small amount, verified, clean)
curl -X POST localhost:4000/chat -H "Content-Type: application/json" \
  -d '{"orderId":"ORD-1042","message":"I was charged but my order was cancelled."}'

# Scenario B — human approval (amount over limit)
curl -X POST localhost:4000/chat -H "Content-Type: application/json" \
  -d '{"orderId":"ORD-1099","message":"Money debited, order failed, please refund."}'

# Scenario C — human approval (unverified + fraud flag)
curl -X POST localhost:4000/chat -H "Content-Type: application/json" \
  -d '{"orderId":"ORD-1150","message":"My payment was taken but order failed."}'

# See it sitting in the queue
curl localhost:4000/approvals

# Agent approves it
curl -X POST localhost:4000/approvals/<id>/approve -H "Content-Type: application/json" -d '{"agentId":"agent-priya"}'

# Check live metrics
curl localhost:4000/metrics
```

## Next steps (frontend)

Build two screens against this API:
1. **Customer Simulator** — a chat box that POSTs to `/chat` and renders `customerReply`
2. **Agent Dashboard** — polls `GET /approvals`, renders each pending item as a
   suggestion card (`proposal`, `policyResult.checks`, Approve/Edit/Escalate
   buttons wired to the approval endpoints)

Each response from `/chat` already contains everything a suggestion card
needs (`proposal`, `policyResult.checks` with pass/fail + detail strings) —
render those checks directly, don't reconstruct them client-side.

## Extending for the sales flow

Reuse `context.js` → `llm.js` → `policy.js` unchanged. Just:
- add merchant/GMV mock data to `store.js`
- add a `decideSalesSignal()` variant in `llm.js` (different prompt, same shape)
- add sales-specific rules to `policy.js` (or a second policy file) — e.g.
  auto-send an offer under some confidence/fit threshold, otherwise queue
  for a rep to review
- point a new `/signal` route at the same pipeline shape as `/chat`

This is what backs the "same brain, different job" claim in the deck —
keep the pipeline shape identical so it's visibly true, not just asserted.

---

## Sell flow (sales)

Added alongside the support flow; the refund pipeline is untouched.

```
Signal → Qualify (policy) → Act (offer) → Converse → Interest → Warm lead → Handoff
```

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/sales/merchants` | Seeded merchants |
| GET | `/sales/merchants/:id` | Raw signals + derived qualification (read-only) |
| POST | `/sales/simulate` | The pipeline. Body: `{ merchantId, message?, action? }` |
| GET | `/sales/opportunities` | Opportunity state |
| POST | `/sales/opportunities/:id/handoff` | Rep takes the warm lead |

`POST /sales/simulate`:
- `{ merchantId }` → detect + qualify, returns `draftOffer`
- `{ merchantId, action: "send_offer" }` → stage `ENGAGED`
- `{ merchantId, message }` → intent-classified reply; a buying signal returns
  `action: "WARM_LEAD_HANDOFF"` with a full `salesBrief`

### Files

```
src/sales/plans.js     plan catalogue (limits, prices, features)
src/sales/policy.js    deterministic qualification + action gate
src/sales/intent.js    keyword intent classifier
src/sales/service.js   state machine, offer copy, warm-lead brief
src/routes/sales.js    thin Express wrapper
```

Nothing is hardcoded to "Scale / 92%": utilisation, recommended plan, confidence
and annual uplift are all computed from the merchant's raw signals. `MER-3310`
is seeded to fail qualification and returns `MONITOR_ONLY` with no offer.

Sales events go into the existing `auditLog` via `logEvent`, and `/metrics`
gains an additive `metrics.sales` block — existing metric keys are unchanged.

---

## Knowledge retrieval (RAG)

A lightweight retrieval step gives the reasoner relevant company knowledge
before it proposes an action. **Responsibilities stay separate:**

| Layer | Job | Authority |
| --- | --- | --- |
| RAG (`src/rag/retriever.js`) | Retrieve relevant company knowledge | none |
| Reasoner (`src/engine/llm.js`) | Propose an action, explain it, cite sources | none — proposes only |
| Policy engine (`src/engine/policy.js`) | Decide AUTO_APPROVE / HUMAN_APPROVAL | **final** |
| Routes (`chat.js`, `approvals.js`) | Execute | only after the policy engine / a human says so |

```
knowledge/*.md, past_resolutions.json
        ↓ (chunked + BM25-indexed once, in memory)
retrieveRelevantKnowledge({ message, context }) → top chunks
        ↓
prompt = customer message + context + retrieved knowledge
        ↓
reasoner → { action, amount, confidence, reasoning, sources }
        ↓
policy engine → final decision
```

**How retrieval works:** local BM25 keyword ranking over `##`-sections of the
markdown docs and one chunk per past case. The query is the customer message
plus a few terms derived from the case (unverified customer, fraud flag, amount
over the limit, ...) so a short message like "refund please" still finds the
right documents. No embeddings, no vector DB, no network call, no extra
dependency: it is lexical (keyword) retrieval, and takes about a millisecond.

**Knowledge base** (`knowledge/`): `refund_policy.md`, `fraud_policy.md`,
`support_sop.md`, `escalation_policy.md`, `past_resolutions.json`. The past
cases are synthetic examples written for the demo. The thresholds in the docs
(₹500, 85%) mirror `policy.js`; a test fails if they drift apart. `policy.js`
is always the source of truth.

### Reasoner selection

Checked on every request:

1. `GEMINI_API_KEY` set → Gemini
2. else `ANTHROPIC_API_KEY` set → Claude (the original provider, unchanged)
3. else → deterministic mock

Any failure (no key, network error, timeout, HTTP error, malformed or invalid
model output, retrieval error, missing knowledge files) falls back to the mock
reasoner, so the demo never depends on an external API.

| Env var | Purpose | Default |
| --- | --- | --- |
| `GEMINI_API_KEY` | Use Gemini as the reasoner | unset |
| `GEMINI_MODEL` | Gemini model name | `gemini-3.5-flash` |
| `ANTHROPIC_API_KEY` | Use Claude as the reasoner | unset |
| `LLM_TIMEOUT_MS` | Timeout for a model call before falling back | `10000` |
| `KAARYA_KNOWLEDGE_DIR` | Alternate knowledge folder | `./knowledge` |

API keys are only sent in request headers and are never logged.

### Response shape (additive)

`POST /chat` responses keep every existing field. `proposal` gains two:

```json
"proposal": {
  "action": "refund",          // now refund | escalate | deny
  "amount": 350,
  "confidence": 0.94,
  "reasoning": "...",
  "sources": ["refund_policy.md", "support_sop.md"],
  "reasoner": "gemini"         // gemini | claude | mock
}
```

`sources` are the knowledge files the model cited (validated against what was
actually retrieved). When `reasoner` is `mock`, `sources` lists what was
retrieved, but the mock does not read it. Sources also appear in `/audit` and
in each `/approvals` card.

**`escalate` / `deny` can never auto-approve.** The policy engine adds a failing
check, "Recommendation is a refund", so those go to a human. Kaarya does not
decline customers automatically.

### See it working

```bash
npm start   # with or without an API key
curl -X POST localhost:4000/chat -H "Content-Type: application/json" \
  -d '{"orderId":"ORD-1042","message":"I was charged but my order was cancelled."}'
```

Server log:

```
[RAG] Retrieved:
- refund_policy.md
- past_resolutions.json
- support_sop.md
[Gemini] Reasoning using retrieved knowledge...
[Policy] Final decision: AUTO_APPROVE
```

(With no key, the middle line reads `[Mock] Deterministic fallback reasoner in use...`.)

### Tests

```bash
npm test   # retrieval, reasoning + fallbacks, policy authority, end-to-end
```

The model API is stubbed in the tests, so they run offline with no keys.
