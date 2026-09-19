const express = require('express');
const { nanoid } = require('nanoid');
const { tickets, approvals, logEvent } = require('../store');
const { buildContext } = require('../engine/context');
const { retrieveRelevantKnowledge } = require('../rag/retriever');
const { decide } = require('../engine/llm');
const { evaluate } = require('../engine/policy');

const router = express.Router();

/**
 * The whole pipeline lives here, in order:
 *   1. Understand Context   (context.js)
 *   2. Retrieve knowledge   (rag/retriever.js) -> relevant company knowledge, no authority
 *   3. Decide               (llm.js)      -> proposes an action only, using that knowledge
 *   4. Policy gate          (policy.js)   -> the only thing with authority
 *   5a. AUTO_APPROVE  -> call mock refund/CRM/ticket APIs directly
 *   5b. HUMAN_APPROVAL -> push a suggestion card onto the approvals queue
 *
 * POST /chat  { customerId, orderId, message }
 */
router.post('/chat', async (req, res) => {
  const { customerId, orderId, message } = req.body || {};

  if (typeof orderId !== 'string' || !orderId.trim()) {
    return res.status(400).json({ ok: false, error: 'orderId is required' });
  }
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ ok: false, error: 'message is required' });
  }

  // --- 1. Understand Context ---
  const context = buildContext({ orderId, customerId });
  if (!context.found) {
    return res.status(404).json({ ok: false, error: context.reason });
  }

  // Create (or reuse) a ticket for this conversation
  const ticketId = `TICKET-${orderId}`;
  tickets[ticketId] = tickets[ticketId] || {
    id: ticketId,
    orderId,
    customerId: context.customer?.id,
    messages: [],
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  tickets[ticketId].messages.push({ from: 'customer', text: message, at: new Date().toISOString() });

  // --- 2. Retrieve knowledge (RAG: informational context only; never throws) ---
  const knowledge = retrieveRelevantKnowledge({ message, context });

  // --- 3. Decide (LLM proposes using that knowledge, does NOT execute) ---
  const proposal = await decide({ message, context, knowledge });

  // --- 4. Policy gate (deterministic, has sole execution authority) ---
  const policyResult = evaluate({ proposal, context });
  console.log(`[Policy] Final decision: ${policyResult.decision}`);

  logEvent({
    type: 'DECISION_EVALUATED',
    ticketId,
    orderId,
    proposal,
    policyDecision: policyResult.decision,
  });

  // --- 5a. AUTO_APPROVE path ---
  if (policyResult.decision === 'AUTO_APPROVE') {
    // Call our own mock action endpoints internally (kept as separate
    // routes so they're independently testable/demoable via curl/Postman).
    const refundResult = {
      ok: true,
      orderId,
      amount: proposal.amount,
      refundId: `RFND-${Date.now()}`,
    };

    tickets[ticketId].status = 'closed';
    tickets[ticketId].resolutionSummary = `Auto-refunded ₹${proposal.amount}. ${proposal.reasoning}`;
    tickets[ticketId].messages.push({
      from: 'kaarya',
      text: `Refund of ₹${proposal.amount} has been initiated for order ${orderId}. You should see it in 3-5 business days.`,
      at: new Date().toISOString(),
    });

    logEvent({ type: 'REFUND_ISSUED', orderId, amount: proposal.amount, mode: 'auto' });
    logEvent({ type: 'TICKET_CLOSED', ticketId, mode: 'auto' });

    return res.json({
      ok: true,
      decision: 'AUTO_APPROVE',
      ticketId,
      proposal,
      policyResult,
      action: refundResult,
      customerReply: tickets[ticketId].messages.at(-1).text,
    });
  }

  // --- 5b. HUMAN_APPROVAL path ---
  const approvalId = nanoid(8);
  approvals[approvalId] = {
    id: approvalId,
    ticketId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    context,
    proposal,
    policyResult,
  };

  tickets[ticketId].status = 'pending_review';
  tickets[ticketId].messages.push({
    from: 'kaarya',
    text: `Thanks for flagging this — I've pulled your order details and a support specialist will review it shortly.`,
    at: new Date().toISOString(),
  });

  logEvent({ type: 'ESCALATED_TO_HUMAN', ticketId, approvalId });

  res.json({
    ok: true,
    decision: 'HUMAN_APPROVAL',
    ticketId,
    approvalId,
    proposal,
    policyResult,
    customerReply: tickets[ticketId].messages.at(-1).text,
  });
});

router.get('/tickets/:id', (req, res) => {
  const ticket = tickets[req.params.id];
  if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket not found' });
  res.json({ ok: true, ticket });
});

module.exports = router;
