const { customers, orders } = require('../store');

/**
 * "Understand Context" step.
 * Given a chat message referencing an order, pull together everything
 * a human agent would otherwise have to go dig up manually:
 * order status, payment status, customer verification, fraud flag, history.
 *
 * In a real system this hits the PG logs API, CRM, and ticket history.
 * Here it's a lookup against the mock store — swap this function's guts
 * for real API calls later without touching anything downstream.
 */
function buildContext({ orderId, customerId }) {
  const order = orders[orderId];
  if (!order) {
    return { found: false, reason: `No order found with id ${orderId}` };
  }

  const custId = customerId || order.customerId;
  const customer = customers[custId];

  return {
    found: true,
    order,
    customer,
    evidence: [
      order.paymentStatus === 'captured'
        ? 'Payment successful (captured at gateway)'
        : 'Payment not captured',
      order.status === 'failed'
        ? 'Order marked failed post-payment'
        : `Order status: ${order.status}`,
      customer?.verified
        ? 'Customer identity verified'
        : 'Customer NOT verified',
      customer?.fraudFlag
        ? 'Fraud signal present on account'
        : 'No fraud signal on account',
      `${customer?.pastTickets ?? 0} past ticket(s) on file`,
    ],
  };
}

module.exports = { buildContext };
