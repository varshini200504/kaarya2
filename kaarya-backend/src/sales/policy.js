/**
 * "Decide → Gate" step for the sell flow.
 *
 * Same contract as engine/policy.js on the support side: plain, deterministic,
 * auditable code. No model call happens here. The LLM (if one is wired in
 * later to write nicer copy) can never widen what this file allows.
 *
 * Two separate jobs:
 *   1. qualify()        — is this a real opportunity worth acting on?
 *   2. gateAction()     — is Kaarya allowed to perform this action alone?
 */

const { PLANS, planForVolume, nextPlanAbove } = require('./plans');

const MIN_GMV_GROWTH_PCT = 25; // % over the growth window
const MIN_UTILIZATION_PCT = 85; // % of current plan's GMV limit
const MIN_SALES_CONFIDENCE = 0.8;
const OFFER_COOLDOWN_DAYS = 60; // after a declined offer
const SUPPORTED_CATEGORIES = ['retail', 'services', 'd2c', 'travel'];

/**
 * Actions Kaarya may take on its own, and the ones that always stop at a
 * human. Pricing, discounts and closing are never autonomous — the moment a
 * merchant is interested, a rep takes over. This is the sell-side equivalent
 * of the refund limit.
 */
const AUTONOMOUS_ACTIONS = ['DRAFT_OFFER', 'SEND_OFFER', 'ANSWER_PLAN_QUESTION'];
const HUMAN_ONLY_ACTIONS = [
  'NEGOTIATE_PRICE',
  'APPLY_DISCOUNT',
  'CLOSE_DEAL',
  'WARM_LEAD_HANDOFF',
];

/** Utilisation of the merchant's current plan, as a whole percentage. */
function utilizationPct(merchant) {
  const plan = PLANS[merchant.plan];
  if (!plan || !plan.monthlyGmvLimit) return 0;
  return Math.round((merchant.monthlyGmv / plan.monthlyGmvLimit) * 100);
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

/**
 * Confidence is computed from the signals, not asserted.
 *   base                              0.44
 *   growth trend        up to        +0.25
 *   plan utilisation    up to        +0.20
 *   category fit                     +0.08
 *   timing (cooldown clear)          +0.05
 */
function scoreConfidence({ growthPct, utilization, categoryFit, timingClear }) {
  const growth = (Math.min(growthPct, 60) / 60) * 0.25;
  const usage = clamp01((utilization - 70) / 30) * 0.2;
  const fit = categoryFit ? 0.08 : 0;
  const timing = timingClear ? 0.05 : 0;
  const raw = 0.44 + growth + usage + fit + timing;
  return Math.round(clamp01(raw) * 100) / 100;
}

/**
 * Qualify the opportunity. Returns the same { decision, checks, limits }
 * shape the refund policy returns, so the audit trail stays uniform.
 */
function qualify(merchant) {
  const currentPlan = PLANS[merchant.plan];
  const utilization = utilizationPct(merchant);
  const growthPct = merchant.gmvGrowthPct || 0;
  const categoryFit = SUPPORTED_CATEGORIES.includes(merchant.category);
  const declined = merchant.lastOfferOutcome === 'declined';
  const timingClear = !declined || merchant.lastOfferDaysAgo >= OFFER_COOLDOWN_DAYS;

  // Project next month's volume off the observed trend, then pick the
  // cheapest plan that still fits it.
  const projectedGmv = Math.round(merchant.monthlyGmv * (1 + growthPct / 100));
  let recommended = planForVolume(projectedGmv);
  if (recommended.rank <= currentPlan.rank) {
    recommended = nextPlanAbove(merchant.plan) || recommended;
  }

  const confidence = scoreConfidence({
    growthPct,
    utilization,
    categoryFit,
    timingClear,
  });

  const checks = [];

  checks.push({
    name: 'Growth trend above threshold',
    pass: growthPct >= MIN_GMV_GROWTH_PCT,
    detail: `+${growthPct}% in ${merchant.growthWindowDays} days vs ${MIN_GMV_GROWTH_PCT}% required`,
  });

  checks.push({
    name: 'Repeatedly approaching plan limit',
    pass: utilization >= MIN_UTILIZATION_PCT,
    detail: `${utilization}% of ${currentPlan.name} limit · ${merchant.limitBreaches} breach(es) in ${merchant.limitBreachWindowMonths} months`,
  });

  checks.push({
    name: 'Merchant category supported',
    pass: categoryFit,
    detail: categoryFit
      ? `${merchant.category} is a supported category`
      : `${merchant.category} is not in the supported list`,
  });

  checks.push({
    name: 'Offer cooldown respected',
    pass: timingClear,
    detail: declined
      ? `Previous offer declined ${merchant.lastOfferDaysAgo} days ago vs ${OFFER_COOLDOWN_DAYS}-day cooldown`
      : 'No declined offer on file',
  });

  checks.push({
    name: 'A higher plan exists',
    pass: !!recommended && recommended.rank > currentPlan.rank,
    detail: recommended
      ? `${currentPlan.name} → ${recommended.name}`
      : 'Merchant is already on the top plan',
  });

  checks.push({
    name: 'Confidence threshold',
    pass: confidence >= MIN_SALES_CONFIDENCE,
    detail: `${Math.round(confidence * 100)}% vs ${Math.round(MIN_SALES_CONFIDENCE * 100)}% required`,
  });

  const allPass = checks.every((c) => c.pass);

  const uplift =
    recommended && recommended.pricePerMonth && currentPlan.pricePerMonth
      ? (recommended.pricePerMonth - currentPlan.pricePerMonth) * 12
      : null;

  return {
    decision: allPass ? 'PURSUE_OPPORTUNITY' : 'MONITOR_ONLY',
    qualified: allPass,
    confidence,
    currentPlan,
    recommendedPlan: recommended,
    utilization,
    projectedGmv,
    estimatedAnnualUplift: uplift,
    checks,
    limits: {
      MIN_GMV_GROWTH_PCT,
      MIN_UTILIZATION_PCT,
      MIN_SALES_CONFIDENCE,
      OFFER_COOLDOWN_DAYS,
    },
  };
}

/**
 * The execution gate. Given a proposed action, say whether Kaarya may run it
 * alone. Anything touching price or commitment is human-only, always.
 */
function gateAction({ action, qualification }) {
  if (HUMAN_ONLY_ACTIONS.includes(action)) {
    return {
      allowed: false,
      mode: 'HUMAN_REQUIRED',
      reason:
        'Pricing, discounting and closing are reserved for a sales representative.',
    };
  }

  if (!AUTONOMOUS_ACTIONS.includes(action)) {
    return {
      allowed: false,
      mode: 'BLOCKED',
      reason: `Unknown sales action: ${action}`,
    };
  }

  if (!qualification.qualified) {
    return {
      allowed: false,
      mode: 'BLOCKED',
      reason: 'Opportunity did not pass qualification — no outreach permitted.',
    };
  }

  return { allowed: true, mode: 'AUTONOMOUS', reason: 'Within sales policy.' };
}

module.exports = {
  qualify,
  gateAction,
  utilizationPct,
  AUTONOMOUS_ACTIONS,
  HUMAN_ONLY_ACTIONS,
  MIN_GMV_GROWTH_PCT,
  MIN_UTILIZATION_PCT,
  MIN_SALES_CONFIDENCE,
  OFFER_COOLDOWN_DAYS,
};
