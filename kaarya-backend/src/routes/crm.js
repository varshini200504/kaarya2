const express = require('express');
const { customers, logEvent } = require('../store');

const router = express.Router();

/**
 * Mock CRM update. In production this writes to Salesforce/internal CRM.
 * Here it just appends a note to the mock customer record.
 */
router.post('/crm/update', (req, res) => {
  const { customerId, note } = req.body;
  const customer = customers[customerId];

  if (!customer) {
    return res.status(404).json({ ok: false, error: `Customer ${customerId} not found` });
  }

  customer.notes = customer.notes || [];
  customer.notes.push({ note, addedAt: new Date().toISOString() });

  logEvent({ type: 'CRM_UPDATED', customerId, note });

  res.json({ ok: true, customerId, notesCount: customer.notes.length });
});

module.exports = router;
