import { useState } from 'react';
import {
  Inbox,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import PolicyChecks from '../components/PolicyChecks';
import { EmptyState, Loading, ErrorState } from '../components/States';
import { inr, pct, clockTime } from '../lib/format';
import { classifyOutcome } from '../lib/decision';
import { approveApproval, escalateApproval } from '../api/client';

const ESCALATION_NOTE = 'Needs manual fraud review before refund.';

const STATUS = {
  pending: { tone: 'amber', text: 'Pending' },
  approved: { tone: 'emerald', text: 'Approved' },
  escalated: { tone: 'red', text: 'Escalated' },
};

function primaryReason(approval) {
  const failedCheck = (approval.policyResult.checks || []).find((c) => !c.pass);
  return failedCheck ? failedCheck.name : 'Policy review required';
}

export default function Approvals({ approvals, loading, error, refresh, notify }) {
  const [busyId, setBusyId] = useState(null);
  const [openId, setOpenId] = useState(null);

  async function act(approval, kind) {
    setBusyId(approval.id);
    try {
      if (kind === 'approve') {
        await approveApproval(approval.id, 'agent-priya');
        notify('Refund approved', 'success');
      } else {
        await escalateApproval(approval.id, ESCALATION_NOTE);
        notify('Escalated for manual review', 'info');
      }
      await refresh();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !approvals) return <Loading label="Loading approval queue" />;
  if (error && !approvals) return <ErrorState message={error} onRetry={refresh} />;

  const list = approvals || [];
  const pending = list.filter((a) => a.status === 'pending');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Approval queue</h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Actions requiring human judgment. {pending.length} pending of{' '}
          {list.length} total.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Inbox}
            title="Queue is clear"
            body="Anything the policy engine can't auto-execute lands here. Run scenario B or C to populate it."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const status = STATUS[a.status] || STATUS.pending;
            const risky = classifyOutcome(a.policyResult) === 'BLOCKED';
            const open = openId === a.id;
            const locked = a.status !== 'pending';
            const busy = busyId === a.id;

            return (
              <article key={a.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5">
                  <div className="min-w-[10rem]">
                    <p className="label">Ticket</p>
                    <p className="font-mono text-[13px]">{a.ticketId}</p>
                  </div>
                  <div className="min-w-[8rem]">
                    <p className="label">Customer</p>
                    <p className="text-[13px]">
                      {a.context.customer ? a.context.customer.name : 'Unknown'}
                      {a.context.customer && !a.context.customer.verified ? (
                        <span className="ml-1.5 text-xs text-red-600">
                          unverified
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div>
                    <p className="label">Action</p>
                    <p className="text-[13px] capitalize">{a.proposal.action}</p>
                  </div>
                  <div>
                    <p className="label">Amount</p>
                    <p className="text-[13px] font-semibold tabular-nums">
                      {inr(a.proposal.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="label">Confidence</p>
                    <p
                      className={`text-[13px] font-medium tabular-nums ${
                        a.proposal.confidence < 0.85 ? 'text-red-600' : ''
                      }`}
                    >
                      {pct(a.proposal.confidence)}
                    </p>
                  </div>
                  <div className="min-w-[12rem] flex-1">
                    <p className="label">Reason</p>
                    <p className="truncate text-[13px] text-ink-700">
                      {primaryReason(a)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
                  </div>

                  <div className="flex w-full items-center gap-2 border-t border-line pt-3 md:w-auto md:border-0 md:pt-0">
                    {!locked && !risky ? (
                      <button
                        onClick={() => act(a, 'approve')}
                        disabled={busy}
                        className="btn-success"
                      >
                        {busy ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : null}
                        Approve
                      </button>
                    ) : null}
                    {!locked ? (
                      <button
                        onClick={() => act(a, 'escalate')}
                        disabled={busy}
                        className="btn-danger"
                      >
                        Escalate
                      </button>
                    ) : (
                      <p
                        className={`flex items-center gap-1.5 text-[13px] font-medium ${
                          a.status === 'approved'
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {a.status === 'approved' ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <AlertTriangle size={14} />
                        )}
                        {a.status === 'approved'
                          ? 'Refund approved'
                          : 'Escalated for manual review'}
                      </p>
                    )}
                    <button
                      onClick={() => setOpenId(open ? null : a.id)}
                      className="rounded p-1.5 text-ink-500 hover:bg-canvas"
                      aria-label={open ? 'Hide policy detail' : 'Show policy detail'}
                    >
                      {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {risky && !locked ? (
                  <p className="flex items-center gap-2 border-t border-red-200 bg-red-50 px-4 py-2 text-[13px] text-red-800">
                    <AlertTriangle size={14} />
                    Fraud signal on this account — approval is disabled. Escalate to
                    risk review.
                  </p>
                ) : null}

                {open ? (
                  <div className="grid gap-4 border-t border-line bg-canvas px-4 py-4 md:grid-cols-2">
                    <div>
                      <p className="label mb-2">Policy evaluation</p>
                      <PolicyChecks checks={a.policyResult.checks} compact />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="label mb-1.5">AI reasoning</p>
                        <p className="rounded-md border border-sky-200 bg-sky-50/70 px-3 py-2 text-[13px] leading-relaxed">
                          {a.proposal.reasoning}
                        </p>
                      </div>
                      <div>
                        <p className="label mb-1.5">Evidence</p>
                        <ul className="space-y-1 text-[13px] text-ink-700">
                          {(a.context.evidence || []).map((line, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-ink-300">·</span>
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="font-mono text-[11px] text-ink-500">
                        Raised {clockTime(a.createdAt)} · approval {a.id}
                      </p>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
