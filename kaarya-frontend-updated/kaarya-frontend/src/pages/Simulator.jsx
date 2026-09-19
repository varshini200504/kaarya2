import { useEffect, useRef, useState } from 'react';
import { Send, RotateCcw, User } from 'lucide-react';
import PipelineTrack from '../components/PipelineTrack';
import DecisionPanel from '../components/DecisionPanel';
import StatusBadge from '../components/StatusBadge';
import { SCENARIOS } from '../lib/scenarios';
import { classifyOutcome } from '../lib/decision';
import { sendChat, approveApproval, escalateApproval } from '../api/client';
import { clockTime } from '../lib/format';

const ESCALATION_NOTE = 'Needs manual fraud review before refund.';

export default function Simulator({ refresh, notify }) {
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [draft, setDraft] = useState(SCENARIOS[0].message);
  const [messages, setMessages] = useState([]);
  const [result, setResult] = useState(null);
  const [reveal, setReveal] = useState(0);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolution, setResolution] = useState(null);
  const [verified, setVerified] = useState(null);

  const timers = useRef([]);
  const scrollRef = useRef(null);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const schedule = (fn, ms) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function pickScenario(next) {
    setScenario(next);
    setDraft(next.message);
    resetRun();
    setMessages([]);
  }

  function resetRun() {
    clearTimers();
    setResult(null);
    setReveal(0);
    setResolution(null);
    setVerified(null);
    setRunning(false);
    setBusy(false);
  }

  async function run(text, forScenario) {
    const target = forScenario || scenario;
    if (!text.trim() || running) return;

    clearTimers();
    setResult(null);
    setReveal(0);
    setResolution(null);
    setVerified(null);
    setRunning(true);
    setMessages((prev) => [
      ...prev,
      { from: 'customer', text: text.trim(), at: new Date().toISOString() },
    ]);
    setDraft('');

    try {
      const data = await sendChat({
        customerId: target.customerId,
        orderId: target.orderId,
        message: text.trim(),
      });

      setResult(data);
      schedule(() => setReveal(1), 300);
      schedule(() => setReveal(2), 950);
      schedule(() => setReveal(3), 1650);

      // Hold a beat before the verdict — it's the moment judges should watch.
      const pause = data.decision === 'AUTO_APPROVE' ? 2350 : 3000;
      schedule(() => {
        setReveal(4);
        setRunning(false);
        if (data.customerReply) {
          setMessages((prev) => [
            ...prev,
            {
              from: 'kaarya',
              text: data.customerReply,
              at: new Date().toISOString(),
            },
          ]);
        }
        refresh();
      }, pause);
    } catch (err) {
      setRunning(false);
      setDraft(text);
      notify(err.message, 'error');
    }
  }

  async function handleApprove() {
    if (!result || !result.approvalId) return;
    setBusy(true);
    try {
      await approveApproval(result.approvalId, 'agent-priya');
      setResolution('approved');
      setMessages((prev) => [
        ...prev,
        {
          from: 'kaarya',
          text: `Your refund has been approved and is on its way back to your original payment method.`,
          at: new Date().toISOString(),
        },
      ]);
      notify('Refund approved', 'success');
      refresh();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleEscalate() {
    if (!result || !result.approvalId) return;
    setBusy(true);
    try {
      await escalateApproval(result.approvalId, ESCALATION_NOTE);
      setResolution('escalated');
      setMessages((prev) => [
        ...prev,
        {
          from: 'kaarya',
          text: `This one needs a closer look. Our risk team is reviewing it and will be in touch.`,
          at: new Date().toISOString(),
        },
      ]);
      notify('Escalated for manual review', 'info');
      refresh();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const outcome = result ? classifyOutcome(result.policyResult) : null;
  const progress = Math.min(reveal, 3);

  return (
    <div className="space-y-4">
      <section className="card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PipelineTrack
            progress={progress}
            running={running}
            outcome={reveal >= 4 ? outcome : null}
            resolution={resolution}
            verified={verified}
          />
          <p className="text-xs text-ink-500">
            The model proposes. The policy engine decides.
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT — conversation */}
        <section className="card flex h-[calc(100vh-15rem)] min-h-[460px] flex-col">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Customer Simulator</h3>
              <StatusBadge tone="blue">Demo</StatusBadge>
            </div>
            <button
              onClick={() => {
                resetRun();
                setMessages([]);
                setDraft(scenario.message);
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </header>

          <div className="flex items-center gap-3 border-b border-line bg-canvas px-4 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink-500 ring-1 ring-line">
              <User size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {scenario.customerName}
              </p>
              <p className="truncate text-xs capitalize text-ink-500">
                {scenario.tier} customer · {scenario.customerId}
              </p>
            </div>
            <span className="rounded border border-line-strong bg-white px-2 py-0.5 font-mono text-xs text-ink-700">
              {scenario.orderId}
            </span>
          </div>

          <div
            ref={scrollRef}
            className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 ? (
              <p className="pt-6 text-center text-sm text-ink-500">
                Pick a scenario below, or type a message as the customer.
              </p>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.from === 'customer' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[85%] animate-rise rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                    m.from === 'customer'
                      ? 'rounded-tl-sm border border-line bg-white'
                      : 'rounded-tr-sm bg-brand-600 text-white'
                  }`}
                >
                  <p>{m.text}</p>
                  <p
                    className={`mt-1 font-mono text-[10px] ${
                      m.from === 'customer' ? 'text-ink-300' : 'text-brand-100'
                    }`}
                  >
                    {m.from === 'customer' ? scenario.customerName : 'Kaarya'} ·{' '}
                    {clockTime(m.at)}
                  </p>
                </div>
              </div>
            ))}
            {running ? (
              <div className="flex justify-end">
                <div className="rounded-lg rounded-tr-sm border border-line bg-canvas px-3 py-2 text-[13px] text-ink-500">
                  Kaarya is analyzing…
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-line px-4 py-3">
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') run(draft);
                }}
                placeholder="Type a customer message…"
                className="min-w-0 flex-1 rounded-md border border-line-strong px-3 py-2 text-sm
                           placeholder:text-ink-300 focus:border-brand-500"
              />
              <button
                onClick={() => run(draft)}
                disabled={running || !draft.trim()}
                className="btn-primary shrink-0"
              >
                <Send size={14} />
                Send to Kaarya
              </button>
            </div>

            <div className="mt-3">
              <p className="label mb-1.5">Demo scenarios</p>
              <div className="grid grid-cols-3 gap-2">
                {SCENARIOS.map((s) => {
                  const active = s.key === scenario.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => {
                        pickScenario(s);
                        setTimeout(() => run(s.message, s), 0);
                      }}
                      disabled={running}
                      className={`rounded-md border px-2.5 py-2 text-left transition-colors disabled:opacity-50
                        ${
                          active
                            ? 'border-brand-200 bg-brand-50'
                            : 'border-line hover:border-line-strong hover:bg-canvas'
                        }`}
                    >
                      <span className="block text-[13px] font-medium">
                        {s.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-ink-500">
                        {s.blurb}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT — live decision */}
        <section className="card flex h-[calc(100vh-15rem)] min-h-[460px] flex-col">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold">Live decision</h3>
            <span className="font-mono text-xs text-ink-500">
              {result ? result.ticketId : '—'}
            </span>
          </header>
          <DecisionPanel
            result={result}
            reveal={reveal}
            running={running}
            resolution={resolution}
            busy={busy}
            onApprove={handleApprove}
            onEscalate={handleEscalate}
            onVerifyStatus={setVerified}
          />
        </section>
      </div>
    </div>
  );
}
