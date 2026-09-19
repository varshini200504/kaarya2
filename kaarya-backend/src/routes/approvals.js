const express = require('express');
const { approvals, tickets, orders, logEvent } = require('../store');

const router = express.Router();

/**
 * List all pending (and recently resolved) approvals — this is what
 * the agent dashboard polls to render the suggestion cards.
 */
router.get('/approvals', (req, res) => {
  const list = Object.values(approvals).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json({ ok: true, approvals: list });
});

/**
 * Agent clicks "Approve" on a suggestion card.
 * This actually triggers the mock refund + closes the ticket —
 * mirroring exactly what AUTO_APPROVE would have done, except a human
 * signed off first.
 */
router.post('/approvals/:id/approve', async (req, res) => {
  const approval = approvals[req.params.id];
  if (!approval) {
    return res.status(404).json({ ok: false, error: 'Approval not found' });
  }
  if (approval.status !== 'pending') {
    return res.status(400).json({ ok: false, error: `Already ${approval.status}` });
  }

  approval.status = 'approved';
  approval.resolvedAt = new Date().toISOString();
  approval.resolvedBy = req.body.agentId || 'agent-demo';

  const order = orders[approval.context.order.id];
  if (order) {
    order.status = 'refunded';
    order.refundedAmount = approval.proposal.amount;
  }
  const ticket = tickets[approval.ticketId];
  if (ticket) {
    ticket.status = 'closed';
    ticket.resolutionSummary = `Refund of ₹${approval.proposal.amount} approved by human agent.`;
  }

  // Log as REFUND_ISSUED too (mode: 'human_approved') so this refund is
  // counted in /metrics totalRefundedInr and totalTicketsTouched, the same
  // way an AUTO_APPROVE refund is. Without this, money refunded via human
  // approval was invisible in the metrics rollup even though it happened.
  logEvent({
    type: 'REFUND_ISSUED',
    orderId: approval.context.order.id,
    amount: approval.proposal.amount,
    mode: 'human_approved',
  });

  logEvent({
    type: 'HUMAN_APPROVED',
    approvalId: approval.id,
    orderId: approval.context.order.id,
    amount: approval.proposal.amount,
  });

  res.json({ ok: true, approval });
});

/**
 * Agent clicks "Escalate" — routes it further up (e.g. to a risk team).
 * Here we just mark it and log it; wire to a real escalation channel later.
 */
router.post('/approvals/:id/escalate', (req, res) => {
  const approval = approvals[req.params.id];
  if (!approval) {
    return res.status(404).json({ ok: false, error: 'Approval not found' });
  }

  approval.status = 'escalated';
  approval.resolvedAt = new Date().toISOString();
  approval.escalationNote = req.body.note || '';

  logEvent({
    type: 'ESCALATED',
    approvalId: approval.id,
    note: approval.escalationNote,
  });

  res.json({ ok: true, approval });
});

module.exports = router;
