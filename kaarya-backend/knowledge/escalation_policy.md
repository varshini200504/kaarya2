# Escalation Policy (Prototype)

## When a human agent must review
The policy engine routes a request to the human approval queue whenever any of these hold:
- Refund amount is above the ₹500 auto-refund limit.
- Customer identity is not verified.
- A fraud flag is present on the account.
- AI confidence is below 85%.
- The proposed amount is greater than the order amount.
- The AI recommends anything other than a refund (escalate or deny). Kaarya never declines a customer automatically.

## When the AI should recommend escalate
- Fraud flag, unverified identity, or several risk signals together.
- Evidence is incomplete or contradictory, or the order is in an unclear state.
- The customer disputes an earlier refund or reports a problem that is not a failed order.
- The customer mentions legal action, a regulator, a consumer court or a chargeback.
- Repeated contact about the same order.

## High-value transactions
- Any refund above ₹500 needs human approval, even when every other check is clean. The AI still recommends the exact order amount so the agent has a clear proposal to approve or reject.
- Higher amounts deserve a closer look at the evidence before an agent approves.

## What the human agent can do
- Approve: issues the refund, closes the ticket and records who approved it.
- Escalate: routes the case further, for example to the risk team, with a note. Use this when the agent also sees fraud or identity concerns.

## Boundaries
- Retrieved knowledge and AI recommendations are advisory. Only the policy engine and human agents can authorise an action.
