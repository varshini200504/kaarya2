/**
 * Plan catalogue for the sell flow.
 *
 * The recommended plan is *derived* from these limits against the merchant's
 * projected volume — nothing hands back a pre-baked "Scale".
 */

const PLANS = {
  starter: {
    key: 'starter',
    name: 'Starter',
    rank: 1,
    monthlyGmvLimit: 300000,
    pricePerMonth: 2500,
    features: [
      'Standard transaction limits',
      'Email support',
      'Basic settlement reports',
    ],
  },
  growth: {
    key: 'growth',
    name: 'Growth',
    rank: 2,
    monthlyGmvLimit: 1480000,
    pricePerMonth: 12000,
    features: [
      'Higher transaction limits',
      'Business-hours support',
      'Standard analytics',
    ],
  },
  scale: {
    key: 'scale',
    name: 'Scale',
    rank: 3,
    monthlyGmvLimit: 5000000,
    pricePerMonth: 43500,
    features: [
      'Higher transaction limits',
      'Priority support',
      'Advanced analytics and cohort reporting',
      'Multi-user roles and permissions',
    ],
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    rank: 4,
    monthlyGmvLimit: null, // negotiated
    pricePerMonth: null,
    features: [
      'Custom transaction limits',
      'Dedicated account manager',
      'Custom SLAs',
    ],
  },
};

const ORDERED = Object.values(PLANS).sort((a, b) => a.rank - b.rank);

/** Cheapest plan that still fits the projected monthly volume. */
function planForVolume(projectedGmv) {
  const fit = ORDERED.find(
    (p) => p.monthlyGmvLimit !== null && p.monthlyGmvLimit >= projectedGmv
  );
  return fit || PLANS.enterprise;
}

function nextPlanAbove(planKey) {
  const current = PLANS[planKey];
  if (!current) return null;
  return ORDERED.find((p) => p.rank === current.rank + 1) || null;
}

module.exports = { PLANS, ORDERED, planForVolume, nextPlanAbove };
