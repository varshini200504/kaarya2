import {
  Sparkles,
  ShieldCheck,
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Loader2,
  UserCheck,
} from 'lucide-react';
import PolicyChecks from './PolicyChecks';
import OutcomeVerification, {
  OutcomePending,
  OutcomeBlocked,
} from './Verification';
import { inr, pct } from '../lib/format';
import { classifyOutcome, findCheck, OUTCOME } from '../lib/decision';

function Section({ icon: Icon, title, children, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-ink-500',
    blue: 'text-sky-600',
    emerald: 'text-emerald-600',
  };
  return (
    <section className="animate-rise border-t border-line px-4 py-3.5 first:border-t-0">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Icon size={13} className={tones[tone]} />
        <h4 className="label">{title}</h4>
      </div>
      {children}
    </section>
  );
}

export default function DecisionPanel({
  result,
  reveal,
  running,
  resolution,
  busy,
  onApprove,
  onEscalate,
  onVerifyStatus,
}) {
  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        {running ? (
          <>
            <Loader2 size={18} className="animate-spin text-brand-600" />
            <p className="text-sm font-medium">Kaarya is analyzing…</p>
            <p className="text-sm text-ink-500">
              Pulling order, payment and customer history.
            </p>
          </>
        ) : (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-canvas text-ink-300">
              <FileSearch size={18} />
            </div>
            <p className="text-sm font-medium">Waiting for customer request</p>
            <p className="max-w-xs text-sm text-ink-500">
              Send a message, or run scenario A, B or C to watch the policy engine
              decide.
            </p>
          </>
        )}
      </div>
    );
  }

  const { proposal, policyResult } = result;
  const outcome = classifyOutcome(policyResult);
  const meta = OUTCOME[outcome];

  const contextLines = [
    findCheck(policyResult, 'Amount does not exceed order value'),
    findCheck(policyResult, 'Customer verified'),
    findCheck(policyResult, 'No fraud flag'),
  ].filter(Boolean);

  return (
    <div className="flex h-full flex-col overflow-y-auto scroll-thin">
      {reveal >= 1 ? (
        <Section icon={FileSearch} title="Context assembled">
          <ul className="space-y-1 text-[13px] text-ink-700">
            <li className="font-mono text-xs text-ink-500">{result.ticketId}</li>
            {contextLines.map((c) => (
              <li key={c.name} className="flex justify-between gap-3">
                <span className="text-ink-500">{c.name}</span>
                <span className="font-mono text-xs">{c.detail}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {reveal >= 2 ? (
        <Section icon={Sparkles} title="AI recommendation" tone="blue">
          <div className="rounded-md border border-sky-200 bg-sky-50/70 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-lg font-semibold tracking-tight">
                Refund {inr(proposal.amount)}
              </p>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                  Confidence
                </p>
                <p className="font-mono text-sm font-semibold text-sky-900">
                  {pct(proposal.confidence)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-700">
              {proposal.reasoning}
            </p>
            <p className="mt-2 text-[11px] text-sky-700">
              Proposal only — the policy engine decides what actually runs.
            </p>
          </div>
        </Section>
      ) : null}

      {reveal >= 3 ? (
        <Section icon={ShieldCheck} title="Policy evaluation">
          <PolicyChecks checks={policyResult.checks} compact />
        </Section>
      ) : null}

      {reveal >= 4 ? (
        <>
          <Outcome
            outcome={outcome}
            meta={meta}
            result={result}
            resolution={resolution}
            busy={busy}
            onApprove={onApprove}
            onEscalate={onEscalate}
          />
          <VerificationStage
            outcome={outcome}
            result={result}
            resolution={resolution}
            onStatus={onVerifyStatus}
          />
        </>
      ) : reveal >= 3 ? (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-ink-500">
          <Loader2 size={14} className="animate-spin" />
          Applying policy decision…
        </div>
      ) : null}
    </div>
  );
}

const BANNER = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  red: 'border-red-200 bg-red-50 text-red-800',
};

function Outcome({ outcome, meta, result, resolution, busy, onApprove, onEscalate }) {
  const Icon =
    outcome === 'AUTO' ? CheckCircle2 : outcome === 'HUMAN' ? UserCheck : Ban;

  return (
    <section className="mt-auto animate-rise border-t border-line bg-white px-4 py-4">
      <div className={`rounded-md border px-3.5 py-3 ${BANNER[meta.tone]}`}>
        <div className="flex items-center gap-2">
          <Icon size={16} strokeWidth={2.5} />
          <p className="text-sm font-semibold uppercase tracking-wide">
            {meta.title}
          </p>
        </div>
        <p className="mt-1 text-[13px] leading-snug">{meta.caption}</p>
      </div>

      {outcome === 'AUTO' && result.action ? (
        <ul className="mt-3 space-y-1.5 text-[13px] text-ink-700">
          <li className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Refund initiated
            <span className="font-mono text-xs text-ink-500">
              {result.action.refundId}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Ticket closed
            <span className="font-mono text-xs text-ink-500">{result.ticketId}</span>
          </li>
        </ul>
      ) : null}

      {outcome === 'BLOCKED' ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-white px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-600" />
          <div>
            <p className="text-[13px] font-medium text-red-800">
              Fraud signal detected — refund execution blocked
            </p>
            <p className="mt-0.5 text-[13px] text-ink-500">
              No money moves until the risk team clears this account.
            </p>
          </div>
        </div>
      ) : null}

      {outcome !== 'AUTO' && !resolution ? (
        <div className="mt-3 flex gap-2">
          {outcome === 'HUMAN' ? (
            <button
              onClick={onApprove}
              disabled={busy}
              className="btn-success flex-1"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              Approve refund
            </button>
          ) : null}
          <button
            onClick={onEscalate}
            disabled={busy}
            className={outcome === 'HUMAN' ? 'btn-secondary' : 'btn-danger flex-1'}
          >
            Escalate to risk review
          </button>
        </div>
      ) : null}

      {resolution === 'approved' ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-emerald-700">
          <CheckCircle2 size={14} /> Refund approved and processed by Priya
        </p>
      ) : null}
      {resolution === 'escalated' ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-red-700">
          <AlertTriangle size={14} /> Escalated for manual review — no refund issued
        </p>
      ) : null}
    </section>
  );
}

/**
 * Decision → Action → Verification → Outcome.
 * Verification is only attempted where an action actually executed.
 */
function VerificationStage({ outcome, result, resolution, onStatus }) {
  if (outcome === 'AUTO') {
    return (
      <OutcomeVerification
        ticketId={result.ticketId}
        mode="auto"
        amount={result.proposal.amount}
        refundId={result.action ? result.action.refundId : null}
        onStatus={onStatus}
      />
    );
  }

  if (outcome === 'BLOCKED') {
    return <OutcomeBlocked escalated={resolution === 'escalated'} />;
  }

  if (resolution === 'approved') {
    return (
      <OutcomeVerification
        ticketId={result.ticketId}
        mode="approved"
        amount={result.proposal.amount}
        refundId={null}
        onStatus={onStatus}
      />
    );
  }

  if (resolution === 'escalated') {
    return <OutcomeBlocked escalated />;
  }

  return <OutcomePending />;
}
