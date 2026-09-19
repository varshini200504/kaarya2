/**
 * "Decide → Gate" step.
 *
 * This is the most important file in the whole project.
 * The LLM can PROPOSE anything. This function is the only thing that
 * decides whether an action is allowed to run automatically, or must
 * go to a human first. It is plain, deterministic, auditable code —
 * on purpose. No model call here.
 *
 * Keep these thresholds easy to point at during the demo.
 */

const AUTO_REFUND_LIMIT = 500; // INR
const MIN_AUTO_CONFIDENCE = 0.85;

function evaluate({ proposal, context }) {
  const { order, customer } = context;
  const checks = [];

  const withinLimit = proposal.amount <= AUTO_REFUND_LIMIT;
  checks.push({
    name: 'Within auto-refund limit',
    pass: withinLimit,
    detail: `₹${proposal.amount} vs ₹${AUTO_REFUND_LIMIT} limit`,
  });

  const isVerified = !!customer?.verified;
  checks.push({
    name: 'Customer verified',
    pass: isVerified,
    detail: isVerified ? 'Identity verified' : 'Not verified',
  });

  const noFraud = !customer?.fraudFlag;
  checks.push({
    name: 'No fraud flag',
    pass: noFraud,
    detail: noFraud ? 'Clean' : 'Fraud signal present',
  });

  const confident = proposal.confidence >= MIN_AUTO_CONFIDENCE;
  checks.push({
    name: 'Confidence threshold',
    pass: confident,
    detail: `${Math.round(proposal.confidence * 100)}% vs ${Math.round(MIN_AUTO_CONFIDENCE * 100)}% required`,
  });

  const amountMatchesOrder = proposal.amount <= order.amount;
  checks.push({
    name: 'Amount does not exceed order value',
    pass: amountMatchesOrder,
    detail: `₹${proposal.amount} vs order ₹${order.amount}`,
  });

  // Fail closed on anything that isn't a refund recommendation. The checks
  // above only look at amount/confidence, so without this an "escalate" or
  // "deny" recommendation from the reasoner would slip through and auto-refund.
  // Added only when action is present and not "refund", so the check list for
  // ordinary refund proposals is unchanged. Kaarya never declines a customer
  // automatically: a non-refund recommendation always goes to a human.
  if (proposal.action && proposal.action !== 'refund') {
    checks.push({
      name: 'Recommendation is a refund',
      pass: false,
      detail: `AI recommended "${proposal.action}" — a human agent must decide`,
    });
  }

  const allPass = checks.every((c) => c.pass);

  return {
    decision: allPass ? 'AUTO_APPROVE' : 'HUMAN_APPROVAL',
    checks,
    limits: { AUTO_REFUND_LIMIT, MIN_AUTO_CONFIDENCE },
  };
}

module.exports = { evaluate, AUTO_REFUND_LIMIT, MIN_AUTO_CONFIDENCE };
