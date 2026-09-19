const express = require('express');
const { tickets, logEvent } = require('../store');

const router = express.Router();

/**
 * Mock ticketing-system close call.
 * Marks a ticket resolved with a plain-language explanation attached,
 * which is what the "Verify outcome" step in the pitch refers to.
 */
router.post('/ticket/close', (req, res) => {
  const { ticketId, resolutionSummary } = req.body;
  const ticket = tickets[ticketId];

  if (!ticket) {
    return res.status(404).json({ ok: false, error: `Ticket ${ticketId} not found` });
  }

  ticket.status = 'closed';
  ticket.resolutionSummary = resolutionSummary;
  ticket.closedAt = new Date().toISOString();

  logEvent({ type: 'TICKET_CLOSED', ticketId, resolutionSummary });

  res.json({ ok: true, ticketId, status: 'closed' });
});

module.exports = router;
