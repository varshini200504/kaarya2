const express = require('express');
const { orders, logEvent } = require('../store');

const router = express.Router();

/**
 * Mock payment-gateway refund call.
 * In production this hits Razorpay/PayU/etc. Here it just flips
 * order status and logs the action so it shows up in the audit trail.
 */
router.post('/refund', (req, res) => {
  const { orderId, amount, reason } = req.body;
  const order = orders[orderId];

  if (!order) {
    return res.status(404).json({ ok: false, error: `Order ${orderId} not found` });
  }

  order.status = 'refunded';
  order.refundedAmount = amount;

  logEvent({
    type: 'REFUND_ISSUED',
    orderId,
    amount,
    reason: reason || 'unspecified',
  });

  res.json({
    ok: true,
    orderId,
    amount,
    currency: order.currency,
    refundId: `RFND-${Date.now()}`,
    status: 'refund_initiated',
  });
});

module.exports = router;
