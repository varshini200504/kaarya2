# Refund Policy (Prototype)

## Eligibility: failed order after successful payment
- A refund is appropriate when the payment was captured at the gateway AND the order is marked failed.
- The refund goes back to the original payment method. Customers are told to expect it in 3-5 business days.
- For a failed order, recommend the exact order amount. The refund amount must never exceed the order amount.

## No refund due
- Payment not captured: no money was taken, so there is nothing to refund. If the customer sees a temporary bank hold, it is released by the bank on its own timeline. Recommend deny and explain.
- Order still pending or processing: it may still complete. Do not recommend a refund yet; recommend escalate so an agent can check the order.
- Order already refunded: never recommend a second refund for the same order. Recommend deny (duplicate request) or escalate if the customer disputes the earlier refund.

## Automatic refund limits
- Auto-refund limit: ₹500 per order. Refunds above ₹500 always need a human agent's approval.
- Automatic approval additionally requires: customer identity verified, no fraud flag on the account, AI confidence of at least 85%, and a refund amount no greater than the order amount.
- These limits are enforced by the policy engine, not by the AI. The AI only recommends; it cannot approve or execute a refund.

## Confidence guidance for the AI
- Use high confidence (0.9 or above) only when payment captured, order failed, customer verified and no fraud signal all agree.
- Use low confidence (below 0.5) when verification or fraud status is unresolved, or when the evidence is incomplete or contradictory.
