/**
 * RAG retrieval tests. Pure logic: no server, no network, no API keys.
 * Run with:  npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { retrieveRelevantKnowledge, resetIndex } = require('../src/rag/retriever');
const { buildContext } = require('../src/engine/context');
const { AUTO_REFUND_LIMIT, MIN_AUTO_CONFIDENCE } = require('../src/engine/policy');

/** Run fn with console output captured so test output stays readable. */
function quiet(fn) {
  const logs = [];
  const { log, error } = console;
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));
  try {
    return { result: fn(), logs };
  } finally {
    console.log = log;
    console.error = error;
  }
}

const sourcesOf = (chunks) => [...new Set(chunks.map((c) => c.source))];

test('clean small failed order retrieves refund policy and support SOP', () => {
  const { result } = quiet(() =>
    retrieveRelevantKnowledge({
      message: 'I was charged but my order was cancelled.',
      context: buildContext({ orderId: 'ORD-1042' }),
    })
  );
  const sources = sourcesOf(result);
  assert.ok(sources.includes('refund_policy.md'), `got ${sources}`);
  assert.ok(sources.includes('support_sop.md'), `got ${sources}`);
});

test('high-value order retrieves the escalation policy', () => {
  const { result } = quiet(() =>
    retrieveRelevantKnowledge({
      message: 'Money debited, order failed, please refund.',
      context: buildContext({ orderId: 'ORD-1099' }),
    })
  );
  assert.ok(sourcesOf(result).includes('escalation_policy.md'));
});

test('unverified + fraud-flagged customer retrieves fraud policy and the matching past case', () => {
  const { result } = quiet(() =>
    retrieveRelevantKnowledge({
      message: 'My payment was taken but order failed.',
      context: buildContext({ orderId: 'ORD-1150' }),
    })
  );
  const sources = sourcesOf(result);
  assert.ok(sources.includes('fraud_policy.md'), `got ${sources}`);
  assert.ok(sources.includes('escalation_policy.md'), `got ${sources}`);
  assert.ok(
    result.some((c) => c.source === 'past_resolutions.json' && c.section.startsWith('CASE-0103')),
    'expected the unverified/fraud-flag past case (CASE-0103)'
  );
});

test('a verified clean customer does NOT get the fraud-flag past case ranked first', () => {
  const { result } = quiet(() =>
    retrieveRelevantKnowledge({
      message: 'I was charged but my order was cancelled.',
      context: buildContext({ orderId: 'ORD-1042' }),
    })
  );
  const firstCase = result.find((c) => c.source === 'past_resolutions.json');
  assert.ok(firstCase, 'expected at least one past case');
  assert.ok(!firstCase.section.startsWith('CASE-0103'), `top case was ${firstCase.section}`);
});

test('results have the documented shape and respect the size limits', () => {
  const { result } = quiet(() =>
    retrieveRelevantKnowledge({
      message: 'refund please',
      context: buildContext({ orderId: 'ORD-1042' }),
    })
  );
  assert.ok(result.length > 0 && result.length <= 5);
  for (const c of result) {
    assert.equal(typeof c.source, 'string');
    assert.equal(typeof c.content, 'string');
    assert.ok(c.content.length > 0);
  }
  const perSource = {};
  for (const c of result) perSource[c.source] = (perSource[c.source] || 0) + 1;
  assert.ok(Object.values(perSource).every((n) => n <= 2), 'max 2 chunks per source');
});

test('logs the retrieved sources in the demo format', () => {
  const { logs } = quiet(() =>
    retrieveRelevantKnowledge({
      message: 'I was charged but my order was cancelled.',
      context: buildContext({ orderId: 'ORD-1042' }),
    })
  );
  const joined = logs.join('\n');
  assert.match(joined, /\[RAG\] Retrieved:\n- refund_policy\.md/);
});

test('missing knowledge directory: returns [] and never throws', () => {
  const prev = process.env.KAARYA_KNOWLEDGE_DIR;
  try {
    process.env.KAARYA_KNOWLEDGE_DIR = path.join(__dirname, 'does-not-exist');
    resetIndex();
    const { result, logs } = quiet(() =>
      retrieveRelevantKnowledge({ message: 'refund', context: buildContext({ orderId: 'ORD-1042' }) })
    );
    assert.deepEqual(result, []);
    assert.match(logs.join('\n'), /Retrieval unavailable/);
  } finally {
    if (prev === undefined) delete process.env.KAARYA_KNOWLEDGE_DIR;
    else process.env.KAARYA_KNOWLEDGE_DIR = prev;
    resetIndex();
  }
  // and it recovers once the directory is back
  const { result } = quiet(() =>
    retrieveRelevantKnowledge({ message: 'refund', context: buildContext({ orderId: 'ORD-1042' }) })
  );
  assert.ok(result.length > 0);
});

test('corrupt knowledge file is skipped, the rest still work', () => {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'kaarya-kb-'));
  fs.copyFileSync(path.join(__dirname, '..', 'knowledge', 'refund_policy.md'), path.join(tmp, 'refund_policy.md'));
  fs.writeFileSync(path.join(tmp, 'past_resolutions.json'), '{ this is not json');
  const prev = process.env.KAARYA_KNOWLEDGE_DIR;
  try {
    process.env.KAARYA_KNOWLEDGE_DIR = tmp;
    resetIndex();
    const { result } = quiet(() =>
      retrieveRelevantKnowledge({ message: 'refund', context: buildContext({ orderId: 'ORD-1042' }) })
    );
    assert.deepEqual(sourcesOf(result), ['refund_policy.md']);
  } finally {
    if (prev === undefined) delete process.env.KAARYA_KNOWLEDGE_DIR;
    else process.env.KAARYA_KNOWLEDGE_DIR = prev;
    resetIndex();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('garbage input never throws', () => {
  quiet(() => {
    assert.doesNotThrow(() => retrieveRelevantKnowledge());
    assert.doesNotThrow(() => retrieveRelevantKnowledge({}));
    assert.doesNotThrow(() => retrieveRelevantKnowledge({ message: null, context: null }));
    assert.doesNotThrow(() => retrieveRelevantKnowledge({ message: 12345, context: { order: {} } }));
  });
});

test('knowledge docs agree with the real policy thresholds (drift guard)', () => {
  const dir = path.join(__dirname, '..', 'knowledge');
  const limit = `₹${AUTO_REFUND_LIMIT}`;
  const conf = `${Math.round(MIN_AUTO_CONFIDENCE * 100)}%`;
  for (const file of ['refund_policy.md', 'escalation_policy.md']) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.ok(text.includes(limit), `${file} should mention the ${limit} auto-refund limit from policy.js`);
    assert.ok(text.includes(conf), `${file} should mention the ${conf} confidence threshold from policy.js`);
  }
});

test('retrieval is fast (index is cached)', () => {
  const context = buildContext({ orderId: 'ORD-1099' });
  quiet(() => retrieveRelevantKnowledge({ message: 'warm up', context }));
  const start = process.hrtime.bigint();
  quiet(() => {
    for (let i = 0; i < 100; i++) retrieveRelevantKnowledge({ message: 'order failed refund', context });
  });
  const avgMs = Number(process.hrtime.bigint() - start) / 1e6 / 100;
  assert.ok(avgMs < 20, `average ${avgMs.toFixed(2)}ms per retrieval`);
});
