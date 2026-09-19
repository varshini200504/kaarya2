/**
 * The sell loop, mirroring the support pipeline in routes/chat.js:
 *
 *   1. Understand context   (merchant signals from the store)
 *   2. Decide               (sales/policy.js qualify — deterministic)
 *   3. Gate                 (sales/policy.js gateAction — sole authority)
 *   4. Act                  (draft/send offer, answer questions)
 *   5. Collaborate          (stop selling on interest, hand a rep the brief)
 *
 * Kept free of Express so it can be unit-tested and reused. The route is a
 * thin wrapper around simulate() and handoff().
 */

const { merchants, salesOpportunities, logEvent } = require('../store');
const { qualify, gateAction } = require('./policy');
const { classify } = require('./intent');

const STAGES = [
  'OPPORTUNITY',
  'ENGAGED',
  'INTERESTED',
  'WARM_LEAD',
  'HANDED_OFF',
];

class SalesError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function inr(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

function lakhs(n) {
  return '₹' + (Number(n || 0) / 100000).toFixed(1) + 'L';
}

/* ------------------------------------------------------------------ */
/* Copy generation — templated from real plan data, never free-floating */
/* ------------------------------------------------------------------ */

function buildOffer(merchant, q) {
  return [
    `Hi ${merchant.name},`,
    '',
    `You've been growing quickly — volume is up ${merchant.gmvGrowthPct}% over the last ${merchant.growthWindowDays} days, and you're now running at ${q.utilization}% of your ${q.currentPlan.name} plan limit.`,
    '',
    `Based on that trajectory, the ${q.recommendedPlan.name} plan would give you room to keep growing without interrupting settlements.`,
    '',
    'Would you like me to walk you through the upgrade?',
    '',
    '— Kaarya',
  ].join('\n');
}

function answerQuestion(topics, q) {
  const plan = q.recommendedPlan;
  const parts = [];

  if (topics.includes('pricing')) {
    const delta = plan.pricePerMonth - q.currentPlan.pricePerMonth;
    parts.push(
      `${plan.name} is ${inr(plan.pricePerMonth)} per month, ${inr(delta)} more than your current ${q.currentPlan.name} plan. Billing switches over at your next cycle with no proration surprises.`
    );
  }

  if (topics.includes('features')) {
    parts.push(`${plan.name} includes ${plan.features.join(', ').toLowerCase()}.`);
  }

  if (topics.includes('upgrade')) {
    parts.push(
      'The upgrade takes effect immediately, there is no downtime, and your existing integration keys keep working.'
    );
  }

  if (!parts.length) {
    parts.push(
      `Happy to help — I can cover ${plan.name} pricing, the features it adds, or how the upgrade itself works.`
    );
  }

  return parts.join(' ');
}

function summarise(conversation) {
  const topics = new Set();
  conversation.forEach((m) => {
    (m.topics || []).forEach((t) => topics.add(t));
  });

  if (!topics.size) {
    return 'Upgrade offer sent; no questions raised before the merchant responded.';
  }

  const labels = {
    pricing: 'pricing',
    features: 'additional plan features',
    upgrade: 'the upgrade process',
  };
  const asked = [...topics].map((t) => labels[t] || t);
  return `Merchant asked about ${asked.join(' and ')}.`;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

function getMerchant(merchantId) {
  const merchant = merchants[merchantId];
  if (!merchant) {
    throw new SalesError(`Merchant ${merchantId} not found`, 404);
  }
  return merchant;
}

function ensureOpportunity(merchant, q) {
  const id = `OPP-${merchant.id}`;
  if (salesOpportunities[id]) return salesOpportunities[id];

  const opportunity = {
    id,
    merchantId: merchant.id,
    stage: q.qualified ? 'OPPORTUNITY' : 'MONITORING',
    qualified: q.qualified,
    createdAt: new Date().toISOString(),
    conversation: [],
    offerSentAt: null,
    salesBrief: null,
    handedOffTo: null,
    handedOffAt: null,
  };
  salesOpportunities[id] = opportunity;

  logEvent({
    type: q.qualified
      ? 'SALES_OPPORTUNITY_DETECTED'
      : 'SALES_OPPORTUNITY_MONITORED',
    opportunityId: id,
    merchantId: merchant.id,
    merchantName: merchant.name,
    currentPlan: q.currentPlan.name,
    recommendedPlan: q.recommendedPlan ? q.recommendedPlan.name : null,
    confidence: q.confidence,
    policyDecision: q.decision,
  });

  return opportunity;
}

function advance(opportunity, stage) {
  const from = STAGES.indexOf(opportunity.stage);
  const to = STAGES.indexOf(stage);
  // Never walk the state machine backwards.
  if (to > from) opportunity.stage = stage;
  return opportunity.stage;
}

function buildBrief(merchant, q, opportunity, signal) {
  return {
    customer: merchant.name,
    merchantId: merchant.id,
    contact: merchant.contact,
    currentPlan: q.currentPlan.name,
    recommendedPlan: q.recommendedPlan.name,
    whyNow: `GMV increased ${merchant.gmvGrowthPct}% in ${merchant.growthWindowDays} days and the merchant is at ${q.utilization}% of the ${q.currentPlan.name} plan limit.`,
    customerSignal: signal,
    conversationSummary: summarise(opportunity.conversation),
    confidence: Math.round(q.confidence * 100),
    estimatedAnnualUplift: q.estimatedAnnualUplift,
    monthlyGmv: merchant.monthlyGmv,
    qualificationChecks: q.checks,
    conversation: opportunity.conversation,
  };
}

/* ------------------------------------------------------------------ */
/* Public surface                                                      */
/* ------------------------------------------------------------------ */

/**
 * One entry point for the whole flow.
 *   { merchantId }                    → detect + qualify, return draft offer
 *   { merchantId, action:'send_offer'}→ send it (policy-gated)
 *   { merchantId, message }           → classify reply and respond
 */
function simulate({ merchantId, message, action }) {
  const merchant = getMerchant(merchantId);
  const q = qualify(merchant);
  const opportunity = ensureOpportunity(merchant, q);

  const base = {
    ok: true,
    opportunityId: opportunity.id,
    merchant: {
      id: merchant.id,
      name: merchant.name,
      contact: merchant.contact,
      category: merchant.category,
      monthlyGmv: merchant.monthlyGmv,
      monthlyGmvDisplay: lakhs(merchant.monthlyGmv),
      gmvGrowthPct: merchant.gmvGrowthPct,
      growthWindowDays: merchant.growthWindowDays,
      lastOfferOutcome: merchant.lastOfferOutcome,
      lastOfferDaysAgo: merchant.lastOfferDaysAgo,
    },
    currentPlan: q.currentPlan.name,
    recommendedPlan: q.recommendedPlan ? q.recommendedPlan.name : null,
    opportunity: q.recommendedPlan
      ? `Upgrade ${q.currentPlan.name} → ${q.recommendedPlan.name}`
      : null,
    qualified: q.qualified,
    confidence: Math.round(q.confidence * 100),
    utilization: q.utilization,
    projectedGmv: q.projectedGmv,
    estimatedAnnualUplift: q.estimatedAnnualUplift,
    reason: `GMV increased ${merchant.gmvGrowthPct}% in ${merchant.growthWindowDays} days and the merchant is repeatedly approaching plan limits.`,
    policyResult: {
      decision: q.decision,
      checks: q.checks,
      limits: q.limits,
    },
    stage: opportunity.stage,
    conversation: opportunity.conversation,
    salesBrief: opportunity.salesBrief,
  };

  // Not qualified → policy forbids any outreach at all.
  if (!q.qualified) {
    return {
      ...base,
      action: 'MONITOR_ONLY',
      autonomousSellingStopped: false,
      message:
        'Signals do not meet the qualification bar. Kaarya will keep monitoring and will not contact this merchant.',
    };
  }

  /* --- explicit action: send the offer --- */
  if (action === 'send_offer') {
    const gate = gateAction({ action: 'SEND_OFFER', qualification: q });
    if (!gate.allowed) {
      throw new SalesError(gate.reason, 403);
    }

    const offer = buildOffer(merchant, q);
    opportunity.conversation.push({
      from: 'kaarya',
      text: offer,
      at: new Date().toISOString(),
    });
    opportunity.offerSentAt = new Date().toISOString();
    advance(opportunity, 'ENGAGED');

    logEvent({
      type: 'SALES_OFFER_SENT',
      opportunityId: opportunity.id,
      merchantId: merchant.id,
      recommendedPlan: q.recommendedPlan.name,
      mode: gate.mode,
    });

    return {
      ...base,
      stage: opportunity.stage,
      action: 'OFFER_SENT',
      offer,
      policyGate: gate,
      autonomousSellingStopped: false,
      conversation: opportunity.conversation,
    };
  }

  /* --- merchant reply --- */
  if (message) {
    const intent = classify(message);

    opportunity.conversation.push({
      from: 'merchant',
      text: message,
      at: new Date().toISOString(),
      intent: intent.intent,
      topics: intent.topics,
    });

    logEvent({
      type: 'SALES_CONVERSATION_UPDATED',
      opportunityId: opportunity.id,
      merchantId: merchant.id,
      intent: intent.intent,
      topics: intent.topics,
    });

    if (intent.intent === 'DECLINE') {
      opportunity.stage = 'DECLINED';
      const reply =
        'Understood — I will leave it there. I will check back if your volumes change significantly.';
      opportunity.conversation.push({
        from: 'kaarya',
        text: reply,
        at: new Date().toISOString(),
      });

      logEvent({
        type: 'SALES_OFFER_DECLINED',
        opportunityId: opportunity.id,
        merchantId: merchant.id,
      });

      return {
        ...base,
        stage: opportunity.stage,
        action: 'CLOSE_CONVERSATION',
        intent: intent.intent,
        reply,
        autonomousSellingStopped: true,
        conversation: opportunity.conversation,
      };
    }

    if (intent.intent === 'INTEREST') {
      // The policy gate — not the classifier — is what stops the machine here.
      const gate = gateAction({
        action: 'WARM_LEAD_HANDOFF',
        qualification: q,
      });

      advance(opportunity, 'INTERESTED');
      logEvent({
        type: 'SALES_INTEREST_DETECTED',
        opportunityId: opportunity.id,
        merchantId: merchant.id,
        signal: message,
        matchedOn: intent.matchedOn,
      });

      const reply =
        `The ${q.recommendedPlan.name} plan gives you ${q.recommendedPlan.features.join(', ').toLowerCase()}. ` +
        'I have prepared the details for a sales specialist who will take it from here.';
      opportunity.conversation.push({
        from: 'kaarya',
        text: reply,
        at: new Date().toISOString(),
      });

      opportunity.salesBrief = buildBrief(merchant, q, opportunity, message);
      advance(opportunity, 'WARM_LEAD');

      logEvent({
        type: 'WARM_LEAD_CREATED',
        opportunityId: opportunity.id,
        merchantId: merchant.id,
        merchantName: merchant.name,
        recommendedPlan: q.recommendedPlan.name,
        confidence: Math.round(q.confidence * 100),
        estimatedAnnualUplift: q.estimatedAnnualUplift,
      });

      return {
        ...base,
        stage: opportunity.stage,
        action: 'WARM_LEAD_HANDOFF',
        intent: intent.intent,
        customerSignal: message,
        reply,
        policyGate: gate, // allowed:false, mode HUMAN_REQUIRED
        autonomousSellingStopped: true,
        salesBrief: opportunity.salesBrief,
        conversation: opportunity.conversation,
      };
    }

    if (intent.intent === 'QUESTION') {
      const gate = gateAction({
        action: 'ANSWER_PLAN_QUESTION',
        qualification: q,
      });
      if (!gate.allowed) throw new SalesError(gate.reason, 403);

      const reply = answerQuestion(intent.topics, q);
      opportunity.conversation.push({
        from: 'kaarya',
        text: reply,
        at: new Date().toISOString(),
      });
      advance(opportunity, 'ENGAGED');

      return {
        ...base,
        stage: opportunity.stage,
        action: 'CONTINUE_CONVERSATION',
        intent: intent.intent,
        topics: intent.topics,
        reply,
        policyGate: gate,
        autonomousSellingStopped: false,
        conversation: opportunity.conversation,
      };
    }

    const reply =
      'Happy to help — I can cover pricing, the features the upgrade adds, or how the switch works. Which would be most useful?';
    opportunity.conversation.push({
      from: 'kaarya',
      text: reply,
      at: new Date().toISOString(),
    });

    return {
      ...base,
      stage: opportunity.stage,
      action: 'CONTINUE_CONVERSATION',
      intent: intent.intent,
      reply,
      autonomousSellingStopped: false,
      conversation: opportunity.conversation,
    };
  }

  /* --- no message, no action: signal + qualification + draft --- */
  const gate = gateAction({ action: 'DRAFT_OFFER', qualification: q });
  const draftOffer = gate.allowed ? buildOffer(merchant, q) : null;

  return {
    ...base,
    action: 'DRAFT_OFFER',
    draftOffer,
    policyGate: gate,
    autonomousSellingStopped: false,
  };
}

/** Rep picks the lead up. Only legal from WARM_LEAD. */
function handoff({ opportunityId, repId, repName }) {
  const opportunity = salesOpportunities[opportunityId];
  if (!opportunity) {
    throw new SalesError(`Opportunity ${opportunityId} not found`, 404);
  }
  if (opportunity.stage === 'HANDED_OFF') {
    throw new SalesError('Lead has already been handed off', 400);
  }
  if (opportunity.stage !== 'WARM_LEAD') {
    throw new SalesError(
      `Cannot hand off from stage ${opportunity.stage} — the merchant has not confirmed interest`,
      400
    );
  }

  opportunity.stage = 'HANDED_OFF';
  opportunity.handedOffTo = repId || 'rep-demo';
  opportunity.handedOffAt = new Date().toISOString();
  opportunity.handedOffToName = repName || null;

  logEvent({
    type: 'SALES_HANDOFF_COMPLETED',
    opportunityId: opportunity.id,
    merchantId: opportunity.merchantId,
    repId: opportunity.handedOffTo,
    recommendedPlan: opportunity.salesBrief
      ? opportunity.salesBrief.recommendedPlan
      : null,
  });

  return { ok: true, opportunity };
}

function listOpportunities() {
  return Object.values(salesOpportunities).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

function getMerchantContext(merchantId) {
  const merchant = getMerchant(merchantId);
  const q = qualify(merchant);
  return { merchant, qualification: q };
}

function listMerchants() {
  return Object.values(merchants);
}

module.exports = {
  simulate,
  handoff,
  listOpportunities,
  listMerchants,
  getMerchantContext,
  SalesError,
  STAGES,
};
