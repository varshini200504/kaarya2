/**
 * End-to-end: boots the real server.js (with NO API keys, so it uses the
 * deterministic mock reasoner) and drives the three README demo scenarios
 * over HTTP. Run with:  npm test   (needs `npm install` first)
 *
 * Proves the RAG layer changed nothing about the decisions, that sources are
 * returned additively, and that the demo survives a missing knowledge base.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/** Start server.js with a clean env; resolves once it prints its banner. */
async function startServer(extraEnv = {}) {
  const port = await freePort();
  const env = { ...process.env, PORT: String(port), ...extraEnv };
  delete env.GEMINI_API_KEY;
  delete env.ANTHROPIC_API_KEY;
  Object.assign(env, extraEnv);

  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start:\n${output}`)), 8000);
    const poll = setInterval(() => {
      if (output.includes('Kaarya backend running')) {
        clearInterval(poll);
        clearTimeout(timer);
        resolve();
      }
    }, 25);
    child.on('exit', (code) => reject(new Error(`server exited early (${code}):\n${output}`)));
  });

  const base = `http://localhost:${port}`;
  return {
    base,
    logs: () => output,
    stop: () => child.kill(),
    chat: async (orderId, message) => {
      const res = await fetch(`${base}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, message }),
      });
      return { status: res.status, body: await res.json() };
    },
    get: async (p) => (await fetch(`${base}${p}`)).json(),
  };
}

const SCENARIOS = [
  { orderId: 'ORD-1042', message: 'I was charged but my order was cancelled.', decision: 'AUTO_APPROVE', mustRetrieve: ['refund_policy.md', 'support_sop.md'] },
  { orderId: 'ORD-1099', message: 'Money debited, order failed, please refund.', decision: 'HUMAN_APPROVAL', mustRetrieve: ['escalation_policy.md'] },
  { orderId: 'ORD-1150', message: 'My payment was taken but order failed.', decision: 'HUMAN_APPROVAL', mustRetrieve: ['fraud_policy.md', 'escalation_policy.md'] },
];

test('demo scenarios: decisions unchanged, sources added, RAG visible in logs', async (t) => {
  const srv = await startServer();
  t.after(() => srv.stop());

  assert.match(srv.logs(), /\[RAG\] Knowledge base ready: 5 files/);
  assert.match(srv.logs(), /Reasoner: mock/);

  for (const s of SCENARIOS) {
    const { status, body } = await srv.chat(s.orderId, s.message);
    assert.equal(status, 200);
    assert.equal(body.decision, s.decision, `${s.orderId} decision`);

    // legacy fields intact for the frontend
    for (const k of ['ok', 'decision', 'ticketId', 'proposal', 'policyResult', 'customerReply']) {
      assert.ok(k in body, `missing legacy field ${k}`);
    }
    for (const k of ['action', 'amount', 'confidence', 'reasoning']) {
      assert.ok(k in body.proposal, `missing legacy proposal field ${k}`);
    }
    assert.equal(body.policyResult.checks.length, 5, 'existing 5 policy checks unchanged');

    // additive fields
    assert.ok(Array.isArray(body.proposal.sources));
    for (const src of s.mustRetrieve) {
      assert.ok(body.proposal.sources.includes(src), `${s.orderId} should retrieve ${src}, got ${body.proposal.sources}`);
    }
    assert.equal(body.proposal.reasoner, 'mock');
  }

  const logs = srv.logs();
  assert.match(logs, /\[RAG\] Retrieved:\n- refund_policy\.md/);
  assert.match(logs, /\[Mock\] Deterministic fallback reasoner/);
  assert.match(logs, /\[Policy\] Final decision: AUTO_APPROVE/);
  assert.match(logs, /\[Policy\] Final decision: HUMAN_APPROVAL/);

  // Metrics and audit behave exactly as before, and the audit trail now carries the sources.
  const { metrics } = await srv.get('/metrics');
  assert.equal(metrics.autoResolved, 1);
  assert.equal(metrics.escalatedToHuman, 2);
  assert.equal(metrics.totalRefundedInr, 350);

  const { events } = await srv.get('/audit');
  const evaluated = events.filter((e) => e.type === 'DECISION_EVALUATED');
  assert.equal(evaluated.length, 3);
  assert.ok(evaluated.every((e) => Array.isArray(e.proposal.sources)));

  const { approvals } = await srv.get('/approvals');
  assert.equal(approvals.length, 2);
  assert.ok(approvals.every((a) => Array.isArray(a.proposal.sources)));
});

test('missing knowledge base: same decisions, no crash, empty sources', async (t) => {
  const srv = await startServer({ KAARYA_KNOWLEDGE_DIR: path.join(__dirname, 'no-such-dir') });
  t.after(() => srv.stop());

  assert.match(srv.logs(), /Knowledge base unavailable/);

  for (const s of SCENARIOS) {
    const { status, body } = await srv.chat(s.orderId, s.message);
    assert.equal(status, 200);
    assert.equal(body.decision, s.decision, `${s.orderId} decision without RAG`);
    assert.deepEqual(body.proposal.sources, []);
  }
});

test('request validation and other endpoints are untouched', async (t) => {
  const srv = await startServer();
  t.after(() => srv.stop());

  assert.deepEqual(await srv.get('/health'), { ok: true, service: 'kaarya-backend' });
  assert.equal((await srv.chat('ORD-0000', 'hi')).status, 404);
  const bad = await fetch(`${srv.base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'no order id' }),
  });
  assert.equal(bad.status, 400);
});
