import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  TrendingUp,
  Flame,
  Sparkles,
  Send,
  UserRoundCheck,
  RotateCcw,
  MessageSquareText,
  ClipboardList,
  ShieldCheck,
  CheckCircle2,
  Ban,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import StageTrack from '../components/StageTrack';
import StatusBadge from '../components/StatusBadge';
import PolicyChecks from '../components/PolicyChecks';
import { EmptyState, Loading, ErrorState } from '../components/States';
import { inr, lakhs, pct, clockTime } from '../lib/format';
import { describeEvent } from '../lib/decision';
import {
  getSalesMerchants,
  getSalesMerchant,
  simulateSales,
  getSalesOpportunities,
  handoffOpportunity,
  getAudit,
} from '../api/client';

/**
 * The sell loop, driven entirely by the backend:
 *   Understand -> Decide -> Gate -> Act -> Collaborate
 *
 * This screen never decides who qualifies or what Kaarya may do on its own —
 * it only renders qualification, policyResult, policyGate, decision, action,
 * stage and autonomousSellingStopped exactly as the backend returns them.
 */

const STAGE_ORDER = ['OPPORTUNITY', 'ENGAGED', 'INTERESTED', 'WARM_LEAD', 'HANDED_OFF'];
const STAGE_LABELS = {
  OPPORTUNITY: 'Opportunity',
  ENGAGED: 'Engaged',
  INTERESTED: 'Interested',
  WARM_LEAD: 'Warm lead',
  HANDED_OFF: 'Handed off',
};

const QUICK_REPLIES = [
  'What does the pricing look like?',
  'This sounds great, sign me up',
  'not interested',
];

function capitalize(s) {
  const str = String(s || '');
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Presentational only — labels the backend's own stage machine, decides nothing. */
function stageSteps(stage) {
  if (!stage || stage === 'MONITORING') {
    return [{ label: 'Monitoring', state: 'wait' }];
  }
  if (stage === 'DECLINED') {
    return [
      { label: 'Opportunity', state: 'done' },
      { label: 'Engaged', state: 'done' },
      { label: 'Declined', state: 'blocked', icon: Ban },
    ];
  }
  const current = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER.map((s, i) => ({
    label: STAGE_LABELS[s],
    state: i < current ? 'done' : i === current ? 'active' : 'idle',
  }));
}

/** Presentational only — reflects loading/response shape, never a policy decision. */
function macroSteps(s) {
  const steps = [];
  steps.push({
    label: 'Understand',
    state: s.contextLoading ? 'active' : s.context ? 'done' : 'idle',
  });
  steps.push({
    label: 'Decide',
    state: s.analyzing ? 'active' : s.latest ? 'done' : 'idle',
  });

  let gateState = 'idle';
  if (s.latest) {
    if (!s.latest.qualified) gateState = 'blocked';
    else if (s.latest.policyGate) {
      gateState = s.latest.policyGate.allowed
        ? 'done'
        : s.latest.policyGate.mode === 'HUMAN_REQUIRED'
          ? 'wait'
          : 'blocked';
    } else {
      gateState = 'done';
    }
  }
  steps.push({ label: 'Gate', state: gateState });

  steps.push({
    label: 'Act',
    state: s.sendingOffer || s.chatLoading ? 'active' : s.latest ? 'done' : 'idle',
  });

  let collabState = 'idle';
  if (s.handoffDone) collabState = 'done';
  else if (s.latest && s.latest.action === 'WARM_LEAD_HANDOFF') collabState = 'wait';
  steps.push({ label: 'Collaborate', state: s.handoffLoading ? 'active' : collabState });

  return steps;
}

export default function Sales({ notify }) {
  const [merchants, setMerchants] = useState(null);
  const [merchantsLoading, setMerchantsLoading] = useState(true);
  const [merchantsError, setMerchantsError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [context, setContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState(null);

  const [latest, setLatest] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const [repId, setRepId] = useState('rep-1');
  const [repName, setRepName] = useState('Vikram');
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffDone, setHandoffDone] = useState(false);

  const [opportunities, setOpportunities] = useState(null);
  const [oppsLoading, setOppsLoading] = useState(true);
  const [oppsError, setOppsError] = useState(null);

  const [audit, setAudit] = useState(null);

  async function loadMerchants() {
    setMerchantsLoading(true);
    setMerchantsError(null);
    try {
      const list = await getSalesMerchants();
      setMerchants(list);
    } catch (err) {
      setMerchantsError(err.message);
    } finally {
      setMerchantsLoading(false);
    }
  }

  async function loadOpportunities() {
    setOppsLoading(true);
    setOppsError(null);
    try {
      const list = await getSalesOpportunities();
      setOpportunities(list);
    } catch (err) {
      setOppsError(err.message);
    } finally {
      setOppsLoading(false);
    }
  }

  async function loadAudit() {
    try {
      const events = await getAudit();
      setAudit(events);
    } catch (err) {
      // Non-critical for this panel — the toast from other calls is enough.
    }
  }

  useEffect(() => {
    loadMerchants();
    loadOpportunities();
    loadAudit();
  }, []);

  async function selectMerchant(id) {
    if (id === selectedId) return;
    setSelectedId(id);
    setContext(null);
    setContextError(null);
    setLatest(null);
    setChatInput('');
    setHandoffDone(false);
    setContextLoading(true);
    try {
      const data = await getSalesMerchant(id);
      setContext(data);
    } catch (err) {
      setContextError(err.message);
      notify(err.message, 'error');
    } finally {
      setContextLoading(false);
    }
  }

  async function analyze() {
    if (!selectedId || analyzing) return;
    setAnalyzing(true);
    try {
      const data = await simulateSales({ merchantId: selectedId });
      setLatest(data);
      loadOpportunities();
      loadAudit();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setAnalyzing(false);
    }
  }

  async function sendOffer() {
    if (!selectedId || sendingOffer) return;
    setSendingOffer(true);
    try {
      const data = await simulateSales({ merchantId: selectedId, action: 'send_offer' });
      setLatest((prev) => ({ ...prev, ...data }));
      notify('Offer sent to merchant.', 'success');
      loadOpportunities();
      loadAudit();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSendingOffer(false);
    }
  }

  async function sendMessage(text) {
    const message = (text || '').trim();
    if (!selectedId || !message || chatLoading) return;
    setChatLoading(true);
    setChatInput('');
    try {
      const data = await simulateSales({ merchantId: selectedId, message });
      setLatest((prev) => ({ ...prev, ...data }));
      loadOpportunities();
      loadAudit();
    } catch (err) {
      setChatInput(message);
      notify(err.message, 'error');
    } finally {
      setChatLoading(false);
    }
  }

  async function handoff() {
    if (!latest || !latest.opportunityId || handoffLoading) return;
    setHandoffLoading(true);
    try {
      await handoffOpportunity(latest.opportunityId, { repId, repName });
      setHandoffDone(true);
      notify(`Lead handed off to ${repName || repId}.`, 'success');
      loadOpportunities();
      loadAudit();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setHandoffLoading(false);
    }
  }

  const selectedMerchant = useMemo(
    () => (merchants || []).find((m) => m.id === selectedId) || context?.merchant || null,
    [merchants, selectedId, context]
  );

  const merchantNames = useMemo(() => {
    const map = {};
    (merchants || []).forEach((m) => {
      map[m.id] = m.name;
    });
    return map;
  }, [merchants]);

  const isDeclined = latest?.action === 'CLOSE_CONVERSATION';
  const isWarmLead = latest?.action === 'WARM_LEAD_HANDOFF' && latest?.autonomousSellingStopped;
  const offerAlreadySent = !!latest?.offer || latest?.action === 'OFFER_SENT' || !!latest?.stage && STAGE_ORDER.indexOf(latest.stage) > 0;

  const activity = (audit || [])
    .filter((e) => (e.type || '').startsWith('SALES_') || e.type === 'WARM_LEAD_CREATED')
    .filter((e) => !selectedId || !e.merchantId || e.merchantId === selectedId)
    .slice()
    .reverse()
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <section className="card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StageTrack
            steps={macroSteps({
              contextLoading,
              context,
              analyzing,
              latest,
              sendingOffer,
              chatLoading,
              handoffLoading,
              handoffDone,
            })}
          />
          <button
            onClick={() => {
              loadMerchants();
              loadOpportunities();
              loadAudit();
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </section>

      <div>
        <h2 className="text-xl font-semibold tracking-tight">AI sales teammate</h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Kaarya detects buying signals, qualifies opportunities against{' '}
          <code className="font-mono text-[12px]">sales/policy.js</code>, and moves warm
          leads to a human rep. The backend decides — this screen only shows its work.
        </p>
      </div>

      {/* Merchant picker */}
      <section className="card">
        <header className="flex items-center gap-1.5 border-b border-line px-4 py-3">
          <Building2 size={13} className="text-ink-500" />
          <h3 className="text-sm font-semibold">Merchants</h3>
        </header>

        {merchantsLoading ? (
          <Loading label="Loading merchants" />
        ) : merchantsError ? (
          <ErrorState message={merchantsError} onRetry={loadMerchants} />
        ) : !merchants || merchants.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No merchants found"
            body="The backend has no seeded merchants to simulate."
          />
        ) : (
          <div className="grid gap-3 px-4 py-3.5 sm:grid-cols-2">
            {merchants.map((m) => {
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  onClick={() => selectMerchant(m.id)}
                  className={`rounded-lg border px-3.5 py-3 text-left transition-colors ${
                    active
                      ? 'border-brand-300 bg-brand-50/60 ring-1 ring-brand-200'
                      : 'border-line bg-white hover:bg-canvas'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{m.name}</p>
                    <StatusBadge tone="blue">{capitalize(m.plan)} plan</StatusBadge>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-ink-500">{m.id}</p>
                  <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                    <div>
                      <dt className="text-ink-500">Category</dt>
                      <dd className="font-medium">{capitalize(m.category)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Monthly GMV</dt>
                      <dd className="font-medium tabular-nums">{lakhs(m.monthlyGmv)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Growth</dt>
                      <dd className="font-medium text-emerald-700">
                        +{m.gmvGrowthPct}% / {m.growthWindowDays}d
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Last offer</dt>
                      <dd className="font-medium">
                        {m.lastOfferOutcome === 'none' ? 'None yet' : capitalize(m.lastOfferOutcome)}
                      </dd>
                    </div>
                  </dl>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {!selectedId ? (
        <section className="card">
          <EmptyState
            icon={Sparkles}
            title="Select a merchant to begin"
            body="Kaarya will pull the merchant's live signals and run them through the sales policy engine."
          />
        </section>
      ) : (
        <div className="space-y-4">
          {selectedMerchant ? (
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <span>Now analyzing</span>
              <span className="font-semibold text-ink-900">{selectedMerchant.name}</span>
              <span className="font-mono text-xs">{selectedId}</span>
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* LEFT — signals, qualification, conversation */}
          <div className="space-y-4">
            <section className="card">
              <header className="flex items-center gap-1.5 border-b border-line px-4 py-3">
                <TrendingUp size={13} className="text-ink-500" />
                <h3 className="text-sm font-semibold">Merchant signals</h3>
              </header>

              {contextLoading ? (
                <Loading label="Pulling merchant signals" />
              ) : contextError ? (
                <ErrorState message={contextError} onRetry={() => selectMerchant(selectedId)} />
              ) : context ? (
                <>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3.5 text-[13px]">
                    <Row label="Merchant" value={`${context.merchant.name} (${context.merchant.contact})`} />
                    <Row label="Category" value={capitalize(context.merchant.category)} />
                    <Row label="Current plan" value={context.qualification.currentPlan.name} />
                    <Row
                      label="Recommended plan"
                      value={context.qualification.recommendedPlan?.name || '—'}
                      tone="emerald"
                    />
                    <Row label="Monthly GMV" value={lakhs(context.merchant.monthlyGmv)} />
                    <Row
                      label="GMV growth"
                      value={`+${context.merchant.gmvGrowthPct}% / ${context.merchant.growthWindowDays}d`}
                      tone="emerald"
                    />
                    <Row label="Plan utilisation" value={context.qualification.utilization + '%'} tone="amber" />
                    <Row label="Confidence" value={pct(context.qualification.confidence)} />
                    <Row label="Projected GMV" value={lakhs(context.qualification.projectedGmv)} />
                    <Row
                      label="Est. annual uplift"
                      value={
                        context.qualification.estimatedAnnualUplift != null
                          ? inr(context.qualification.estimatedAnnualUplift)
                          : '—'
                      }
                    />
                  </dl>

                  <div className="flex items-center gap-2 border-t border-line px-4 py-3">
                    <StatusBadge tone={context.qualification.qualified ? 'emerald' : 'amber'}>
                      {context.qualification.qualified ? 'Qualified' : 'Not qualified'}
                    </StatusBadge>
                    <span className="font-mono text-[11px] text-ink-500">
                      {context.qualification.decision}
                    </span>
                  </div>

                  <div className="border-t border-line px-4 py-3.5">
                    <p className="label mb-2">Qualification checks</p>
                    <PolicyChecks checks={context.qualification.checks} compact />
                  </div>

                  <div className="border-t border-line px-4 py-3">
                    <button onClick={analyze} disabled={analyzing} className="btn-primary w-full">
                      {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      Analyze &amp; Draft Offer
                    </button>
                  </div>
                </>
              ) : null}
            </section>

            {latest && latest.conversation && latest.conversation.length > 0 ? (
              <section className="card">
                <header className="flex items-center gap-1.5 border-b border-line px-4 py-3">
                  <MessageSquareText size={13} className="text-ink-500" />
                  <h3 className="text-sm font-semibold">Conversation</h3>
                </header>
                <div className="space-y-3 px-4 py-4">
                  {latest.conversation.map((m, i) => (
                    <div key={i} className={`flex ${m.from === 'merchant' ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[85%] animate-rise whitespace-pre-line rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                          m.from === 'merchant'
                            ? 'rounded-tl-sm border border-line bg-white'
                            : 'rounded-tr-sm bg-brand-600 text-white'
                        }`}
                      >
                        {m.text}
                        {m.intent ? (
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-400">
                            {m.intent}
                            {m.topics && m.topics.length ? ` · ${m.topics.join(', ')}` : ''}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {latest.qualified && !isDeclined ? (
                  <div className="flex items-center gap-2 border-t border-line px-4 py-3">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendMessage(chatInput);
                      }}
                      placeholder="Type the merchant's reply…"
                      disabled={chatLoading}
                      className="flex-1 rounded-md border border-line-strong px-3 py-2 text-[13px] focus:border-brand-500"
                    />
                    <button
                      onClick={() => sendMessage(chatInput)}
                      disabled={chatLoading || !chatInput.trim()}
                      className="btn-primary"
                    >
                      {chatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                ) : isDeclined ? (
                  <p className="border-t border-line bg-canvas px-4 py-3 text-[13px] text-ink-500">
                    Conversation closed — the merchant declined and autonomous selling has stopped.
                  </p>
                ) : null}

                {latest.qualified && !isDeclined ? (
                  <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-2.5">
                    {QUICK_REPLIES.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        disabled={chatLoading}
                        className="rounded border border-line px-2 py-1 text-[11px] text-ink-600 hover:bg-canvas disabled:opacity-40"
                      >
                        “{q}”
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>

          {/* RIGHT — decision, gate, offer, handoff */}
          <div className="space-y-4">
            {!latest ? (
              <section className="card">
                <EmptyState
                  icon={ClipboardList}
                  title="No simulation run yet"
                  body='Click "Analyze & Draft Offer" to run the merchant through the sales policy engine.'
                />
              </section>
            ) : !latest.qualified ? (
              <section className="card animate-rise border-amber-200">
                <div className="flex items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-4 py-3">
                  <Ban size={15} className="mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-amber-900">
                      Not qualified
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-amber-900">{latest.message}</p>
                  </div>
                </div>
                <div className="px-4 py-3.5 text-[13px] text-ink-500">
                  Signals do not meet the qualification bar. Kaarya will keep monitoring and will not
                  contact this merchant — no offer, no outreach.
                </div>
              </section>
            ) : (
              <>
                <section className="card animate-rise">
                  <header className="flex items-center gap-1.5 border-b border-line px-4 py-3">
                    <Sparkles size={13} className="text-sky-600" />
                    <h3 className="text-sm font-semibold">Opportunity</h3>
                  </header>

                  <div className="grid grid-cols-3 gap-4 px-4 py-3.5">
                    <div>
                      <p className="label">Upgrade</p>
                      <p className="mt-1 text-[13px] font-semibold">
                        {latest.currentPlan} → {latest.recommendedPlan}
                      </p>
                    </div>
                    <div>
                      <p className="label">Confidence</p>
                      <p className="mt-1 font-mono text-[13px] font-semibold">{latest.confidence}%</p>
                    </div>
                    <div>
                      <p className="label">Est. annual uplift</p>
                      <p className="mt-1 text-[13px] font-semibold tabular-nums">
                        {latest.estimatedAnnualUplift != null ? inr(latest.estimatedAnnualUplift) : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-line px-4 py-3">
                    <StageTrack steps={stageSteps(latest.stage)} />
                  </div>

                  {latest.policyGate ? (
                    <div className="flex items-start gap-2.5 border-t border-line px-4 py-3">
                      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-ink-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusBadge tone={latest.policyGate.allowed ? 'emerald' : 'amber'}>
                            {latest.policyGate.mode}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-[13px] text-ink-700">{latest.policyGate.reason}</p>
                      </div>
                    </div>
                  ) : null}
                </section>

                {latest.action === 'DRAFT_OFFER' && latest.draftOffer && !offerAlreadySent ? (
                  <section className="card animate-rise">
                    <header className="flex items-center justify-between border-b border-line px-4 py-3">
                      <h3 className="text-sm font-semibold">Draft offer</h3>
                      <StatusBadge tone="neutral">Draft</StatusBadge>
                    </header>
                    <div className="px-4 py-3.5">
                      <p className="whitespace-pre-line rounded-md border border-line bg-canvas px-3 py-3 text-[13px] leading-relaxed">
                        {latest.draftOffer}
                      </p>
                    </div>
                    <div className="border-t border-line px-4 py-3">
                      <button onClick={sendOffer} disabled={sendingOffer} className="btn-primary w-full">
                        {sendingOffer ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Send offer
                      </button>
                    </div>
                  </section>
                ) : null}

                {latest.offer ? (
                  <section className="card animate-rise">
                    <header className="flex items-center justify-between border-b border-line px-4 py-3">
                      <h3 className="text-sm font-semibold">Offer sent</h3>
                      <StatusBadge tone="emerald" icon={CheckCircle2}>
                        Sent
                      </StatusBadge>
                    </header>
                    <div className="px-4 py-3.5">
                      <p className="whitespace-pre-line rounded-md border border-line bg-canvas px-3 py-3 text-[13px] leading-relaxed">
                        {latest.offer}
                      </p>
                    </div>
                  </section>
                ) : null}

                {isWarmLead && latest.salesBrief ? (
                  <section className="card animate-rise border-emerald-200">
                    <div className="flex items-start gap-2.5 border-b border-emerald-200 bg-emerald-50 px-4 py-3">
                      <Flame size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-900">
                          Warm lead — human handoff required
                        </p>
                        <p className="mt-1 text-[13px] text-emerald-900">
                          Autonomous selling has stopped. A rep needs to take it from here.
                        </p>
                      </div>
                    </div>

                    <div className="px-4 py-3.5">
                      <p className="label mb-2">Sales rep brief</p>
                      <dl className="space-y-2.5 text-[13px]">
                        <Brief label="Customer" value={`${latest.salesBrief.customer} · ${latest.salesBrief.merchantId}`} />
                        <Brief label="Contact" value={latest.salesBrief.contact} />
                        <Brief label="Current plan" value={latest.salesBrief.currentPlan} />
                        <Brief label="Recommended plan" value={latest.salesBrief.recommendedPlan} />
                        <Brief label="Why now" value={latest.salesBrief.whyNow} />
                        <Brief label="Customer signal" value={`"${latest.salesBrief.customerSignal}"`} />
                        <Brief label="Conversation summary" value={latest.salesBrief.conversationSummary} />
                        <Brief label="Confidence" value={latest.salesBrief.confidence + '%'} />
                        <Brief
                          label="Est. annual uplift"
                          value={
                            latest.salesBrief.estimatedAnnualUplift != null
                              ? inr(latest.salesBrief.estimatedAnnualUplift)
                              : '—'
                          }
                        />
                      </dl>
                    </div>

                    {!handoffDone ? (
                      <div className="space-y-2 border-t border-line px-4 py-3">
                        <div className="flex gap-2">
                          <input
                            value={repId}
                            onChange={(e) => setRepId(e.target.value)}
                            placeholder="Rep ID"
                            className="w-28 rounded-md border border-line-strong px-2.5 py-1.5 text-[13px] focus:border-brand-500"
                          />
                          <input
                            value={repName}
                            onChange={(e) => setRepName(e.target.value)}
                            placeholder="Rep name"
                            className="flex-1 rounded-md border border-line-strong px-2.5 py-1.5 text-[13px] focus:border-brand-500"
                          />
                        </div>
                        <button onClick={handoff} disabled={handoffLoading} className="btn-success w-full">
                          {handoffLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <UserRoundCheck size={14} />
                          )}
                          Hand off to sales
                        </button>
                      </div>
                    ) : (
                      <div className="border-t border-emerald-200 bg-emerald-50 px-4 py-3">
                        <p className="flex items-center gap-2 text-[13px] font-medium text-emerald-800">
                          <CheckCircle2 size={14} strokeWidth={3} />
                          Handed off to {repName || repId}
                        </p>
                        <p className="mt-0.5 text-[13px] text-emerald-900">
                          The rep received the complete context — no re-qualification needed.
                        </p>
                      </div>
                    )}
                  </section>
                ) : null}

                {isDeclined ? (
                  <section className="card animate-rise border-line">
                    <div className="flex items-start gap-2.5 border-b border-line bg-canvas px-4 py-3">
                      <Ban size={15} className="mt-0.5 shrink-0 text-ink-500" />
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-ink-700">
                          Conversation closed
                        </p>
                        <p className="mt-1 text-[13px] text-ink-600">{latest.reply}</p>
                      </div>
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Opportunities */}
      <section className="card">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-1.5">
            <ClipboardList size={13} className="text-ink-500" />
            <h3 className="text-sm font-semibold">Opportunities</h3>
          </div>
          <button
            onClick={loadOpportunities}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
          >
            <RotateCcw size={12} />
            Refresh
          </button>
        </header>

        {oppsLoading && !opportunities ? (
          <Loading label="Loading opportunities" />
        ) : oppsError && !opportunities ? (
          <ErrorState message={oppsError} onRetry={loadOpportunities} />
        ) : !opportunities || opportunities.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No opportunities yet"
            body="Run a simulation for a merchant to create one."
          />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-2 font-semibold">Merchant</th>
                  <th className="px-4 py-2 font-semibold">Opportunity</th>
                  <th className="px-4 py-2 font-semibold">Stage</th>
                  <th className="px-4 py-2 font-semibold">Qualified</th>
                  <th className="px-4 py-2 font-semibold">Recommended plan</th>
                  <th className="px-4 py-2 font-semibold">Handoff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {opportunities.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{merchantNames[o.merchantId] || o.merchantId}</p>
                      <p className="font-mono text-[11px] text-ink-500">{o.merchantId}</p>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-ink-500">{o.id}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tone={o.stage === 'HANDED_OFF' ? 'emerald' : o.stage === 'DECLINED' ? 'red' : 'blue'}>
                        {o.stage}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tone={o.qualified ? 'emerald' : 'amber'}>
                        {o.qualified ? 'Qualified' : 'Not qualified'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-2.5">
                      {o.salesBrief ? o.salesBrief.recommendedPlan : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {o.handedOffTo ? (
                        <span className="text-ink-700">
                          {o.handedOffToName || o.handedOffTo}
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Activity */}
      <section className="card">
        <header className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold">Recent sales activity</h3>
        </header>
        {activity.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title="No sales events yet"
            body="Every qualification, offer and handoff the backend performs will appear here."
          />
        ) : (
          <ol className="divide-y divide-line">
            {activity.map((e, i) => {
              const d = describeEvent(e);
              return (
                <li key={e.timestamp + i} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{d.title}</p>
                    {d.lines.filter(Boolean).map((line, j) => (
                      <p key={j} className="mt-0.5 text-[12px] text-ink-500">
                        {line}
                      </p>
                    ))}
                  </div>
                  <p className="shrink-0 font-mono text-[11px] text-ink-400">{clockTime(e.timestamp)}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function Row({ label, value, tone }) {
  const tones = {
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
  };
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className={`mt-0.5 font-medium ${tones[tone] || ''}`}>{value}</dd>
    </div>
  );
}

function Brief({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-ink-500">{label}</dt>
      <dd className="flex-1">{value}</dd>
    </div>
  );
}
