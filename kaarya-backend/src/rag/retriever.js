/**
 * "Retrieve knowledge" step (RAG).
 *
 * This module has ONE job: given a customer message + assembled context,
 * return the company knowledge chunks most relevant to it, so the reasoning
 * model can ground its recommendation in them.
 *
 * It has no authority. It doesn't call a model, doesn't decide anything and
 * doesn't execute anything. Output is plain text for the prompt.
 *
 * Why local BM25 instead of embeddings: the knowledge base is a handful of
 * short documents. A keyword ranker is instant, needs no API call and no
 * extra dependency, and works offline — so this step can never be the thing
 * that breaks the demo. (It is lexical retrieval, not semantic/vector search.)
 *
 * Contract: retrieveRelevantKnowledge() NEVER throws. On any failure
 * (missing files, bad JSON, unexpected input) it logs and returns [], and the
 * pipeline carries on exactly as it did before RAG existed.
 */

const fs = require('fs');
const path = require('path');
const { AUTO_REFUND_LIMIT } = require('../engine/policy');

const DEFAULT_KNOWLEDGE_DIR = path.join(__dirname, '..', '..', 'knowledge');
const TOP_K = 5; // max chunks returned
const MAX_CHUNKS_PER_SOURCE = 2; // keep results spread across documents
const BM25_K1 = 1.5;
const BM25_B = 0.75;

const STOPWORDS = new Set(
  ('a an and are as at be but by for from has have i if in into is it its me my of on or our so ' +
    'that the their them then there these they this to was we were what when which with you your ' +
    'am been do does did not no than too very can will would should could may might must please')
    .split(' ')
);

// Collapse the different words people use for the same idea onto one term,
// on both the document side and the query side. Order matters (first match wins).
const CANONICAL = [
  [/^unverif/, 'unverif'], // kept distinct from "verified" so a clean case doesn't match a risky query
  [/^verif|^kyc/, 'verif'],
  [/^refund|^reimburs/, 'refund'],
  [/^fraud|^scam|^suspicio|^hack|^stol|^unauthori/, 'fraud'],
  [/^escalat/, 'escalat'],
  [/^approv/, 'approv'],
  [/^fail|^cancel|^declin/, 'fail'],
  [/^captur|^debit|^charg|^deduct/, 'captur'],
];

let index = null; // { chunks, avgLen, df } — built once, lazily

// ---------------------------------------------------------------- text utils

function normalizeToken(raw) {
  for (const [re, canon] of CANONICAL) {
    if (re.test(raw)) return canon;
  }
  let t = raw;
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (t.length - suffix.length >= 4 && t.endsWith(suffix)) {
      t = t.slice(0, -suffix.length);
      break;
    }
  }
  return t;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .map(normalizeToken);
}

function termFreq(tokens) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

// ------------------------------------------------------------------- loading

function knowledgeDir() {
  return process.env.KAARYA_KNOWLEDGE_DIR || DEFAULT_KNOWLEDGE_DIR;
}

/** Split a markdown file into one chunk per "## " section (title kept as context). */
function chunkMarkdown(file, text) {
  const lines = text.split(/\r?\n/);
  const title = (lines.find((l) => l.startsWith('# ')) || '').replace(/^#\s+/, '').trim();
  const chunks = [];
  let section = null;
  let buf = [];

  const flush = () => {
    const body = buf.join('\n').trim();
    if (section && body) chunks.push({ source: file, section, content: `${title} — ${section}\n${body}` });
    buf = [];
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      section = line.replace(/^##\s+/, '').trim();
    } else if (section && !line.startsWith('# ')) {
      buf.push(line);
    }
  }
  flush();
  return chunks;
}

/**
 * Describe a case's facts in words rather than JSON. Raw keys like
 * "fraudFlag": false would match a "fraud" query whether or not the flag was
 * set, so we write "clean account" / "fraud flag on account" instead.
 */
function describeFacts(f = {}) {
  const parts = [];
  if (f.orderAmount != null) {
    parts.push(
      `order amount ₹${f.orderAmount} (${f.orderAmount > AUTO_REFUND_LIMIT ? 'above' : 'within'} the auto-refund limit)`
    );
  }
  parts.push(f.paymentStatus === 'captured' ? 'payment captured' : 'payment not captured');
  if (f.orderStatus) parts.push(`order ${f.orderStatus}`);
  parts.push(f.verified ? 'verified customer' : 'unverified customer');
  parts.push(f.fraudFlag ? 'fraud flag on account' : 'clean account');
  if ((f.pastTickets ?? 0) >= 3) parts.push(`${f.pastTickets} past tickets (repeated contact)`);
  return parts.join(', ');
}

/** One chunk per past case. */
function chunkResolutions(file, text) {
  const data = JSON.parse(text);
  return (data.cases || []).map((c) => ({
    source: file,
    section: `${c.id}: ${c.title}`,
    content: [
      `Past case ${c.id}: ${c.title}`,
      `Scenario: ${c.scenario}`,
      `Facts: ${describeFacts(c.facts)}`,
      `AI recommendation: ${c.aiRecommendation?.action} ₹${c.aiRecommendation?.amount} at confidence ${c.aiRecommendation?.confidence}`,
      `Policy decision: ${c.policyDecision}`,
      `Outcome: ${c.outcome}`,
      `Lesson: ${c.lesson}`,
    ].join('\n'),
  }));
}

function buildIndex() {
  const dir = knowledgeDir();
  const files = fs.readdirSync(dir).sort();
  const chunks = [];
  const skipped = [];

  for (const file of files) {
    try {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      if (file.endsWith('.md')) chunks.push(...chunkMarkdown(file, text));
      else if (file.endsWith('.json')) chunks.push(...chunkResolutions(file, text));
    } catch (err) {
      skipped.push(file); // one bad file shouldn't take down the rest
      console.error(`[RAG] Skipped ${file}: ${err.message}`);
    }
  }
  if (chunks.length === 0) throw new Error(`no knowledge chunks loaded from ${dir}`);

  // Heading text counts twice so section titles weigh in on relevance.
  const df = new Map();
  let totalLen = 0;
  for (const c of chunks) {
    const tokens = tokenize(`${c.section} ${c.section} ${c.content}`);
    c.tf = termFreq(tokens);
    c.len = tokens.length;
    totalLen += tokens.length;
    for (const term of c.tf.keys()) df.set(term, (df.get(term) || 0) + 1);
  }
  return {
    chunks,
    df,
    avgLen: totalLen / chunks.length,
    files: new Set(chunks.map((c) => c.source)).size,
    skipped,
  };
}

function getIndex() {
  if (!index) index = buildIndex();
  return index;
}

/** Preload at server start so the first request isn't slower. Never throws. */
function initKnowledge() {
  try {
    const idx = getIndex();
    console.log(`[RAG] Knowledge base ready: ${idx.files} files, ${idx.chunks.length} chunks`);
    return true;
  } catch (err) {
    console.error(`[RAG] Knowledge base unavailable (${err.message}). Continuing without retrieval.`);
    return false;
  }
}

/** Test helper: drop the cached index so a different KAARYA_KNOWLEDGE_DIR takes effect. */
function resetIndex() {
  index = null;
}

// ------------------------------------------------------------------ querying

/**
 * Turn the assembled context into extra query text. This is retrieval
 * guidance only ("what is worth reading for this case?") — it never encodes
 * a decision. The limit comes from policy.js so it can't drift.
 */
function contextHints(context) {
  const hints = ['failed order procedure steps'];
  const order = context?.order;
  const customer = context?.customer;

  if (order) {
    if (order.paymentStatus === 'captured' && order.status === 'failed') {
      hints.push('refund eligibility failed order payment captured');
    } else if (order.paymentStatus !== 'captured') {
      hints.push('payment not captured no refund due');
    }
    if (order.status === 'refunded') hints.push('already refunded duplicate second refund');
    if (order.status === 'pending' || order.status === 'processing') hints.push('order pending processing');
    if (order.amount > AUTO_REFUND_LIMIT) hints.push('high value transaction above limit human approval escalation');
    else hints.push('automatic refund limit auto approval');
  }
  if (customer) {
    if (!customer.verified) hints.push('unverified identity verification requirements human review');
    if (customer.fraudFlag) hints.push('fraud signals fraud flag risk escalation');
    if ((customer.pastTickets ?? 0) >= 3) hints.push('repeated tickets past resolved cases');
  }
  return hints.join(' ');
}

function bm25(idx, queryWeights, chunk) {
  const N = idx.chunks.length;
  let score = 0;
  for (const [term, weight] of queryWeights) {
    const tf = chunk.tf.get(term);
    if (!tf) continue;
    const n = idx.df.get(term) || 0;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
    const norm = tf + BM25_K1 * (1 - BM25_B + (BM25_B * chunk.len) / idx.avgLen);
    score += weight * idf * ((tf * (BM25_K1 + 1)) / norm);
  }
  return score;
}

/**
 * @param {{ message: string, context: object, topK?: number }} args
 * @returns {{ source: string, section: string, content: string, score: number }[]}
 */
function retrieveRelevantKnowledge({ message, context, topK = TOP_K } = {}) {
  try {
    const idx = getIndex();

    // Customer message counts once; context hints count twice so the case
    // facts steer retrieval even when the message is short or vague.
    const weights = new Map();
    for (const t of tokenize(message)) weights.set(t, Math.min(3, (weights.get(t) || 0) + 1));
    for (const t of tokenize(contextHints(context))) weights.set(t, Math.min(3, (weights.get(t) || 0) + 2));

    const ranked = idx.chunks
      .map((c) => ({ chunk: c, score: bm25(idx, weights, c) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    const perSource = {};
    const picked = [];
    for (const { chunk, score } of ranked) {
      if ((perSource[chunk.source] || 0) >= MAX_CHUNKS_PER_SOURCE) continue;
      perSource[chunk.source] = (perSource[chunk.source] || 0) + 1;
      picked.push({
        source: chunk.source,
        section: chunk.section,
        content: chunk.content,
        score: Math.round(score * 100) / 100,
      });
      if (picked.length >= topK) break;
    }

    const names = [...new Set(picked.map((p) => p.source))];
    console.log(`[RAG] Retrieved:\n${names.map((n) => `- ${n}`).join('\n') || '- (nothing relevant)'}`);
    return picked;
  } catch (err) {
    console.error(`[RAG] Retrieval unavailable (${err.message}). Continuing without knowledge.`);
    return [];
  }
}

module.exports = { retrieveRelevantKnowledge, initKnowledge, resetIndex };
