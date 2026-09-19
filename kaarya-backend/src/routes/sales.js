const express = require('express');
const sales = require('../sales/service');

const router = express.Router();

function fail(res, err) {
  const status = err && err.status ? err.status : 500;
  if (status === 500) console.error('Sales route error:', err);
  res.status(status).json({
    ok: false,
    error: err && err.message ? err.message : 'Sales request failed',
  });
}

/** Merchants available to the sell flow. */
router.get('/sales/merchants', (req, res) => {
  res.json({ ok: true, merchants: sales.listMerchants() });
});

/** Raw signals plus the derived qualification, without mutating anything. */
router.get('/sales/merchants/:id', (req, res) => {
  try {
    res.json({ ok: true, ...sales.getMerchantContext(req.params.id) });
  } catch (err) {
    fail(res, err);
  }
});

/** The sell pipeline. See src/sales/service.js for the shapes. */
router.post('/sales/simulate', (req, res) => {
  try {
    const { merchantId, message, action } = req.body || {};
    if (typeof merchantId !== 'string' || !merchantId.trim()) {
      return res.status(400).json({ ok: false, error: 'merchantId is required' });
    }
    if (message !== undefined && typeof message !== 'string') {
      return res.status(400).json({ ok: false, error: 'message must be a string' });
    }
    if (action !== undefined && typeof action !== 'string') {
      return res.status(400).json({ ok: false, error: 'action must be a string' });
    }
    res.json(sales.simulate({ merchantId, message, action }));
  } catch (err) {
    fail(res, err);
  }
});

router.get('/sales/opportunities', (req, res) => {
  res.json({ ok: true, opportunities: sales.listOpportunities() });
});

/** Rep takes the warm lead. Only legal once the merchant has confirmed interest. */
router.post('/sales/opportunities/:id/handoff', (req, res) => {
  try {
    const { repId, repName } = req.body || {};
    res.json(
      sales.handoff({ opportunityId: req.params.id, repId, repName })
    );
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
