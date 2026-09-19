/**
 * Intent detection for merchant replies.
 *
 * Deliberately deterministic: keyword and phrase matching, no model call.
 * The point of the demo is that a buying signal flips a real state machine,
 * and that behaviour must be reproducible on stage.
 *
 * Order matters — a decline is checked before interest so that
 * "not interested" never reads as "interested".
 */

const DECLINE_PATTERNS = [
  'not interested',
  'no thanks',
  'no thank you',
  'not right now',
  'maybe later',
  'too expensive',
  'stop contacting',
  'unsubscribe',
];

const INTEREST_PATTERNS = [
  "i'm interested",
  'im interested',
  'i am interested',
  'interested',
  'tell me more',
  'sounds good',
  'sounds great',
  "let's do it",
  'lets do it',
  'sign me up',
  'how do i upgrade',
  'how to upgrade',
  "i'd like to upgrade",
  'id like to upgrade',
  'i want to upgrade',
  'go ahead',
  'yes please',
];

const PRICING_PATTERNS = [
  'price',
  'pricing',
  'cost',
  'costs',
  'how much',
  'charges',
  'fees',
  'rate',
  'billing',
];

const FEATURE_PATTERNS = [
  'feature',
  'features',
  'what do i get',
  'what does it include',
  'includes',
  'benefit',
  'benefits',
  'limit',
  'limits',
  'support',
  'analytics',
];

const UPGRADE_PATTERNS = [
  'upgrade process',
  'migrate',
  'migration',
  'switch',
  'downtime',
  'how long',
  'when does it start',
];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function matched(text, patterns) {
  return patterns.filter((p) => text.includes(p));
}

/**
 * Returns { intent, topics, matchedOn, positiveSignal }.
 * intent: DECLINE | INTEREST | QUESTION | UNCLEAR
 */
function classify(message) {
  const text = normalize(message);

  if (!text) {
    return { intent: 'UNCLEAR', topics: [], matchedOn: [], positiveSignal: false };
  }

  const declineHits = matched(text, DECLINE_PATTERNS);
  if (declineHits.length) {
    return {
      intent: 'DECLINE',
      topics: [],
      matchedOn: declineHits,
      positiveSignal: false,
    };
  }

  const interestHits = matched(text, INTEREST_PATTERNS);
  if (interestHits.length) {
    return {
      intent: 'INTEREST',
      topics: [],
      matchedOn: interestHits,
      positiveSignal: true,
    };
  }

  const topics = [];
  if (matched(text, PRICING_PATTERNS).length) topics.push('pricing');
  if (matched(text, FEATURE_PATTERNS).length) topics.push('features');
  if (matched(text, UPGRADE_PATTERNS).length) topics.push('upgrade');

  if (topics.length) {
    return {
      intent: 'QUESTION',
      topics,
      matchedOn: topics,
      positiveSignal: false,
    };
  }

  return { intent: 'UNCLEAR', topics: [], matchedOn: [], positiveSignal: false };
}

module.exports = { classify, normalize };
