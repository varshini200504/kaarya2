const express = require('express');
const { auditLog, orders } = require('../store');

const router = express.Router();

// Raw event log - "every number ties back to a logged, explainable action"
router.get('/audit', (req, res) => {
  res.json({ ok: true, events: auditLog });
});

// Small rollup for the live metrics counter on the dashboard
router.get('/metrics', (req, res) => {
  const refundEvents = auditLog.filter((e) => e.type === 'REFUND_ISSUED');
  // First-touch escalation: ticket routed from the pipeline to a human.
  const escalations = auditLog.filter((e) => e.type === 'ESCALATED_TO_HUMAN');
  // Second-touch escalation: an agent, reviewing a queued item, escalates it
  // further (e.g. to a risk team). Distinct from the first-touch event above,
  // now surfaced separately so it isn't silently dropped from /metrics.
  const agentEscalations = auditLog.filter((e) => e.type === 'ESCALATED');
  const autoResolved = auditLog.filter(
    (e) => e.type === 'REFUND_ISSUED' && e.mode === 'auto'
  );
  const humanApprovedResolved = auditLog.filter(
    (e) => e.type === 'REFUND_ISSUED' && e.mode === 'human_approved'
  );
  const totalRefunded = refundEvents.reduce((sum, e) => sum + (e.amount || 0), 0);

  res.json({
    ok: true,
    metrics: {
      totalTicketsTouched: refundEvents.length + escalations.length,
      autoResolved: autoResolved.length,
      humanApprovedResolved: humanApprovedResolved.length,
      escalatedToHuman: escalations.length,
      agentEscalatedFurther: agentEscalations.length,
      totalRefundedInr: totalRefunded,
      // Additive sell-flow rollup. Existing keys above are unchanged.
      sales: {
        opportunitiesDetected: auditLog.filter(
          (e) => e.type === 'SALES_OPPORTUNITY_DETECTED'
        ).length,
        offersSent: auditLog.filter((e) => e.type === 'SALES_OFFER_SENT').length,
        warmLeads: auditLog.filter((e) => e.type === 'WARM_LEAD_CREATED').length,
        handoffsCompleted: auditLog.filter(
          (e) => e.type === 'SALES_HANDOFF_COMPLETED'
        ).length,
        pipelineValueInr: auditLog
          .filter((e) => e.type === 'WARM_LEAD_CREATED')
          .reduce((sum, e) => sum + (e.estimatedAnnualUplift || 0), 0),
      },
    },
  });
});

module.exports = router;
