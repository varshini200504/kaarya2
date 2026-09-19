# Support SOP: Payment and Order Issues (Prototype)

## Standard steps for every request
1. Identify the order and confirm it belongs to the customer making the request.
2. Check payment status (captured or not) and order status (failed, pending, refunded).
3. Check customer verification and the fraud flag.
4. Choose one recommendation: refund, escalate or deny.
5. Write a short reasoning that cites the evidence and the policy that applies.
6. Remember the final decision belongs to the policy engine. Support automation only proposes.

## Failed payment and order procedures
- Payment captured and order failed: recommend a refund of the full order amount.
- Payment not captured: no charge was made, so no refund is due. Recommend deny with a clear explanation. A human agent confirms before the customer is told.
- Payment captured and order still pending: recommend escalate. Do not refund an order that may still complete.
- Customer says they were charged twice but the order record shows one payment: the evidence is incomplete. Recommend escalate with reduced confidence.
- Issues that are not failed-order problems (product quality, delivery disputes, chargebacks, legal or regulator threats): outside this procedure. Recommend escalate.

## Talking to the customer
- Acknowledge the problem and state the next step in plain language.
- For an approved refund, give the 3-5 business day timeline.
- When a request goes to review, say that a support specialist will look at it. Never promise a refund before it is approved.
- Never share internal risk signals, such as a fraud flag, with the customer.

## Resolution notes
- Record what was done and why in one line, for example: refund of the order amount issued because payment was captured and the order failed.
- Every recommendation, policy decision and action is written to the audit log.
