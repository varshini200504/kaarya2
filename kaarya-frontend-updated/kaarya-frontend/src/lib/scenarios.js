/**
 * The three demo scenarios. Order/customer IDs mirror the backend's seeded
 * store exactly (src/store.js) — the outcome is decided by the backend policy
 * engine, never by this file.
 */

export const SCENARIOS = [
  {
    key: 'A',
    label: 'A — Auto refund',
    blurb: '₹350 · clears every policy check',
    orderId: 'ORD-1042',
    customerId: 'CUST-8821',
    customerName: 'Rahul S.',
    tier: 'standard',
    amount: 350,
    message: 'I was charged but my order was cancelled.',
    tone: 'emerald',
  },
  {
    key: 'B',
    label: 'B — Human approval',
    blurb: '₹2,500 · over the auto-refund limit',
    orderId: 'ORD-1099',
    customerId: 'CUST-9042',
    customerName: 'Ananya M.',
    tier: 'gold',
    amount: 2500,
    message: 'Money debited, order failed, please refund.',
    tone: 'amber',
  },
  {
    key: 'C',
    label: 'C — Fraud escalation',
    blurb: '₹700 · unverified account, fraud signal',
    orderId: 'ORD-1150',
    customerId: 'CUST-1187',
    customerName: 'Vikram T.',
    tier: 'standard',
    amount: 700,
    message: 'My payment was taken but order failed.',
    tone: 'red',
  },
];

export const getScenario = (key) =>
  SCENARIOS.find((s) => s.key === key) || SCENARIOS[0];
