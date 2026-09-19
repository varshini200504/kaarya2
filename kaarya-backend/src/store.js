/**
 * In-memory "database" for the hackathon demo.
 * No real DB — just objects that reset when the server restarts.
 * Seeded with realistic-looking data so the demo doesn't look like a toy.
 */

const customers = {
  'CUST-8821': {
    id: 'CUST-8821',
    name: 'Rahul S.',
    verified: true,
    tier: 'standard',
    fraudFlag: false,
    pastTickets: 2,
  },
  'CUST-9042': {
    id: 'CUST-9042',
    name: 'Ananya M.',
    verified: true,
    tier: 'gold',
    fraudFlag: false,
    pastTickets: 0,
  },
  'CUST-1187': {
    id: 'CUST-1187',
    name: 'Vikram T.',
    verified: false,
    tier: 'standard',
    fraudFlag: true,
    pastTickets: 5,
  },
};

const orders = {
  'ORD-1042': {
    id: 'ORD-1042',
    customerId: 'CUST-8821',
    amount: 350,
    currency: 'INR',
    status: 'failed', // payment captured, order failed
    paymentStatus: 'captured',
    gateway: 'PG-RAZORPAY',
    createdAt: '2026-09-17T10:12:00Z',
  },
  'ORD-1099': {
    id: 'ORD-1099',
    customerId: 'CUST-9042',
    amount: 2500,
    currency: 'INR',
    status: 'failed',
    paymentStatus: 'captured',
    gateway: 'PG-RAZORPAY',
    createdAt: '2026-09-18T09:00:00Z',
  },
  'ORD-1150': {
    id: 'ORD-1150',
    customerId: 'CUST-1187',
    amount: 700,
    currency: 'INR',
    status: 'failed',
    paymentStatus: 'captured',
    gateway: 'PG-PAYU',
    createdAt: '2026-09-18T11:30:00Z',
  },
};

// Tickets keyed by id. Created as chat messages come in.
const tickets = {};

// Approval queue: actions the policy engine routed to a human.
const approvals = {};

// Simple event log for the metrics/audit trail on the dashboard.
const auditLog = [];

/**
 * Merchants for the sell flow. Raw signals only — no conclusions baked in.
 * The sales policy engine derives utilisation, the recommended plan and
 * confidence from these numbers at request time.
 */
const merchants = {
  'MER-2048': {
    id: 'MER-2048',
    name: 'Acme Retail',
    contact: 'Priya Nair',
    category: 'retail',
    plan: 'growth',
    monthlyGmv: 1420000,
    gmvGrowthPct: 42,
    growthWindowDays: 30,
    limitBreaches: 3,
    limitBreachWindowMonths: 3,
    lastOfferOutcome: 'declined',
    lastOfferDaysAgo: 92,
    customerSince: '2024-03-11',
  },
  // Deliberately does NOT qualify — proves the policy derives rather than
  // returns a canned answer.
  'MER-3310': {
    id: 'MER-3310',
    name: 'Bluebird Cafe',
    contact: 'Arjun Rao',
    category: 'services',
    plan: 'starter',
    monthlyGmv: 96000,
    gmvGrowthPct: 6,
    growthWindowDays: 30,
    limitBreaches: 0,
    limitBreachWindowMonths: 3,
    lastOfferOutcome: 'none',
    lastOfferDaysAgo: null,
    customerSince: '2025-01-22',
  },
};

// Sales opportunities keyed by id, e.g. OPP-MER-2048.
// Lifecycle: OPPORTUNITY → ENGAGED → INTERESTED → WARM_LEAD → HANDED_OFF
// (or MONITORING / DECLINED)
const salesOpportunities = {};

function logEvent(event) {
  auditLog.push({ ...event, timestamp: new Date().toISOString() });
}

module.exports = {
  customers,
  orders,
  tickets,
  approvals,
  auditLog,
  merchants,
  salesOpportunities,
  logEvent,
};
