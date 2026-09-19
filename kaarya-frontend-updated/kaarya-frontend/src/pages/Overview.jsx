import {
  CheckCircle2,
  UserCheck,
  ShieldAlert,
  IndianRupee,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { MetricCard, DecisionDistribution } from '../components/Metrics';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, Loading, ErrorState } from '../components/States';
import { inr, clockTime, greeting } from '../lib/format';
import { deriveCounts } from '../lib/decision';

const ACTIVITY_TYPES = {
  REFUND_ISSUED: {
    label: 'Auto-resolved',
    tone: 'emerald',
    title: (e) => `Refund ${inr(e.amount)}`,
  },
  HUMAN_APPROVED: {
    label: 'Human approved',
    tone: 'amber',
    title: (e) => `Refund ${inr(e.amount)}`,
  },
  ESCALATED: {
    label: 'Escalated',
    tone: 'red',
    title: () => 'Refund blocked',
  },
};

function buildActivity(events, approvals) {
  const approvalById = {};
  (approvals || []).forEach((a) => {
    approvalById[a.id] = a;
  });

  return (events || [])
    .filter((e) => ACTIVITY_TYPES[e.type])
    .slice()
    .reverse()
    .slice(0, 8)
    .map((e, i) => {
      const meta = ACTIVITY_TYPES[e.type];
      const linked = e.approvalId ? approvalById[e.approvalId] : null;
      const orderId =
        e.orderId ||
        (linked && linked.context && linked.context.order
          ? linked.context.order.id
          : '—');
      return {
        key: e.timestamp + '-' + e.type + '-' + i,
        time: clockTime(e.timestamp),
        orderId,
        title: meta.title(e),
        label: meta.label,
        tone: meta.tone,
        note:
          e.type === 'REFUND_ISSUED' && e.mode && e.mode !== 'auto'
            ? `Mode: ${e.mode}`
            : e.type === 'ESCALATED'
              ? e.note
              : null,
      };
    });
}

export default function Overview({
  metrics,
  audit,
  approvals,
  loading,
  error,
  refresh,
  onNavigate,
}) {
  if (loading && !metrics) return <Loading label="Loading operations data" />;
  if (error && !metrics) return <ErrorState message={error} onRetry={refresh} />;

  const counts = deriveCounts(audit, metrics);
  const activity = buildActivity(audit, approvals);
  const pending = (approvals || []).filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {greeting()}, Priya
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Here's what Kaarya handled today.
          </p>
        </div>
        {pending > 0 ? (
          <button
            onClick={() => onNavigate('approvals')}
            className="btn-secondary"
          >
            {pending} waiting on you
            <ArrowRight size={14} />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Auto-resolved"
          value={counts.autoResolved}
          hint="Cleared every policy check"
          tone="emerald"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Human approvals"
          value={counts.humanApproved}
          hint={pending ? `${pending} still pending` : 'Signed off by an agent'}
          tone="amber"
          icon={UserCheck}
        />
        <MetricCard
          label="Escalated"
          value={counts.escalated}
          hint="Sent to risk review"
          tone="red"
          icon={ShieldAlert}
        />
        <MetricCard
          label="Total refunded"
          value={inr(counts.refundedTotal)}
          hint="Across auto and approved refunds"
          tone="brand"
          icon={IndianRupee}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold">Recent activity</h3>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View audit log
            </button>
          </header>

          {activity.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Nothing handled yet"
              body="Run a scenario in the Customer Simulator and it will appear here."
              action={
                <button
                  onClick={() => onNavigate('simulator')}
                  className="btn-primary"
                >
                  Open simulator
                </button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {activity.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center gap-4 px-4 py-2.5 text-sm"
                >
                  <span className="w-11 shrink-0 font-mono text-xs text-ink-500">
                    {row.time}
                  </span>
                  <span className="w-24 shrink-0 font-mono text-xs text-ink-700">
                    {row.orderId}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{row.title}</span>
                    {row.note ? (
                      <span className="block truncate text-xs text-ink-500">
                        {row.note}
                      </span>
                    ) : null}
                  </span>
                  <StatusBadge tone={row.tone}>{row.label}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <h3 className="text-sm font-semibold">Decision distribution</h3>
          <p className="mb-4 mt-0.5 text-xs text-ink-500">
            How the policy engine routed each case.
          </p>
          <DecisionDistribution
            rows={[
              { label: 'Auto-executed', value: counts.autoResolved, tone: 'emerald' },
              { label: 'Human approval', value: counts.humanApproved, tone: 'amber' },
              { label: 'Escalated', value: counts.escalated, tone: 'red' },
            ]}
          />
          <div className="mt-5 border-t border-line pt-4">
            <p className="label">Policy thresholds</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Auto-refund limit</dt>
                <dd className="font-mono text-ink-900">₹500</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Minimum confidence</dt>
                <dd className="font-mono text-ink-900">85%</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
