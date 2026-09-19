import { inr, pct } from './format';

/** Find a named policy check in policyResult.checks. */
export function findCheck(policyResult, name) {
  const checks = (policyResult && policyResult.checks) || [];
  return checks.find((c) => c.name === name) || null;
}

function failed(policyResult, name) {
  const c = findCheck(policyResult, name);
  return !!c && c.pass === false;
}

/**
 * The backend policy engine returns AUTO_APPROVE or HUMAN_APPROVAL only.
 * A human-approval case that also trips fraud / verification / confidence is
 * a risk case: the agent may escalate it, but must not one-click approve it.
 */
export function classifyOutcome(policyResult) {
  if (!policyResult) return 'PENDING';
  if (policyResult.decision === 'AUTO_APPROVE') return 'AUTO';

  const risky =
    failed(policyResult, 'No fraud flag') ||
    failed(policyResult, 'Customer verified') ||
    failed(policyResult, 'Confidence threshold');

  return risky ? 'BLOCKED' : 'HUMAN';
}

export const OUTCOME = {
  AUTO: {
    title: 'Auto-approved',
    caption: 'All policy checks passed. Refund issued and ticket closed.',
    tone: 'emerald',
  },
  HUMAN: {
    title: 'Human approval required',
    caption: 'A policy limit was exceeded. Waiting on an agent decision.',
    tone: 'amber',
  },
  BLOCKED: {
    title: 'Escalated for fraud review',
    caption: 'Refund execution blocked. Manual review required before refund.',
    tone: 'red',
  },
};

/** Turn a raw audit event into something renderable. */
export function describeEvent(e) {
  switch (e.type) {
    case 'DECISION_EVALUATED':
      return {
        title: 'Decision evaluated',
        subject: e.orderId || e.ticketId,
        lines: [
          e.proposal
            ? `${e.proposal.action === 'refund' ? 'Refund proposed' : e.proposal.action} ${inr(e.proposal.amount)} · confidence ${pct(e.proposal.confidence)}`
            : 'Proposal recorded',
          e.policyDecision === 'AUTO_APPROVE'
            ? 'Policy gate: auto-approve'
            : 'Policy gate: route to human',
        ],
        tone: 'blue',
      };
    case 'REFUND_ISSUED':
      return {
        title: 'Refund issued',
        subject: e.orderId,
        lines: [
          `${inr(e.amount)} returned to customer`,
          e.mode ? `Mode: ${e.mode}` : e.reason ? `Reason: ${e.reason}` : null,
        ],
        tone: 'emerald',
      };
    case 'TICKET_CLOSED':
      return {
        title: 'Ticket closed',
        subject: e.ticketId,
        lines: [e.mode ? `Mode: ${e.mode}` : e.resolutionSummary || null],
        tone: 'emerald',
      };
    case 'ESCALATED_TO_HUMAN':
      return {
        title: 'Routed to approval queue',
        subject: e.ticketId,
        lines: [e.approvalId ? `Approval ${e.approvalId}` : null],
        tone: 'amber',
      };
    case 'HUMAN_APPROVED':
      return {
        title: 'Human approved',
        subject: e.orderId,
        lines: [`${inr(e.amount)} approved by agent`, `Approval ${e.approvalId}`],
        tone: 'emerald',
      };
    case 'ESCALATED':
      return {
        title: 'Escalated to risk review',
        subject: e.approvalId,
        lines: [e.note || 'Manual fraud review required'],
        tone: 'red',
      };
    case 'CRM_UPDATED':
      return {
        title: 'CRM updated',
        subject: e.customerId,
        lines: [e.note || null],
        tone: 'blue',
      };
    case 'SALES_OPPORTUNITY_DETECTED':
      return {
        title: 'Sales opportunity detected',
        subject: e.merchantName || e.merchantId,
        lines: [
          e.recommendedPlan
            ? `${e.currentPlan} → ${e.recommendedPlan} · confidence ${e.confidence != null ? Math.round(e.confidence * 100) + '%' : '—'}`
            : null,
        ],
        tone: 'blue',
      };
    case 'SALES_OPPORTUNITY_MONITORED':
      return {
        title: 'Signals below qualification bar',
        subject: e.merchantName || e.merchantId,
        lines: ['Kaarya will keep monitoring — no outreach performed.'],
        tone: 'amber',
      };
    case 'SALES_OFFER_SENT':
      return {
        title: 'Offer sent',
        subject: e.merchantId,
        lines: [e.recommendedPlan ? `Upgrade offer for ${e.recommendedPlan}` : null],
        tone: 'blue',
      };
    case 'SALES_CONVERSATION_UPDATED':
      return {
        title: 'Merchant replied',
        subject: e.merchantId,
        lines: [
          e.intent ? `Intent: ${e.intent}` : null,
          e.topics && e.topics.length ? `Topics: ${e.topics.join(', ')}` : null,
        ],
        tone: 'blue',
      };
    case 'SALES_INTEREST_DETECTED':
      return {
        title: 'Buying signal detected',
        subject: e.merchantId,
        lines: [e.signal ? `"${e.signal}"` : null],
        tone: 'emerald',
      };
    case 'WARM_LEAD_CREATED':
      return {
        title: 'Warm lead created',
        subject: e.merchantName || e.merchantId,
        lines: [
          e.recommendedPlan ? `Recommending ${e.recommendedPlan}` : null,
          e.confidence != null ? `Confidence ${e.confidence}%` : null,
        ],
        tone: 'amber',
      };
    case 'SALES_OFFER_DECLINED':
      return {
        title: 'Merchant declined',
        subject: e.merchantId,
        lines: ['Autonomous selling stopped for this merchant.'],
        tone: 'red',
      };
    case 'SALES_HANDOFF_COMPLETED':
      return {
        title: 'Handed off to sales rep',
        subject: e.merchantId,
        lines: [e.repId ? `Rep: ${e.repId}` : null, e.recommendedPlan || null],
        tone: 'emerald',
      };
    default:
      return {
        title: (e.type || 'Event').replace(/_/g, ' ').toLowerCase(),
        subject: e.orderId || e.ticketId || '',
        lines: [],
        tone: 'blue',
      };
  }
}

/**
 * The /metrics rollup doesn't break out human-approved vs fraud-escalated,
 * so those two counters are derived from the audit log — the same source of
 * truth the backend rolls up from.
 */
export function deriveCounts(events, metrics) {
  const list = events || [];
  const humanApproved = list.filter((e) => e.type === 'HUMAN_APPROVED');
  const escalated = list.filter((e) => e.type === 'ESCALATED');
  const humanApprovedTotal = humanApproved.reduce(
    (sum, e) => sum + (e.amount || 0),
    0
  );

  return {
    autoResolved: metrics ? metrics.autoResolved : 0,
    humanApproved: humanApproved.length,
    escalated: escalated.length,
    pipelineTouched: metrics ? metrics.totalTicketsTouched : 0,
    refundedTotal: (metrics ? metrics.totalRefundedInr : 0) + humanApprovedTotal,
  };
}
