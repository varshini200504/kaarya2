import { Ticket, CheckCircle2, UserCheck, IndianRupee } from 'lucide-react';
import { MetricCard, DecisionDistribution } from '../components/Metrics';
import { Loading, ErrorState } from '../components/States';
import { inr } from '../lib/format';
import { deriveCounts } from '../lib/decision';

export default function MetricsPage({ metrics, audit, loading, error, refresh }) {
  if (loading && !metrics) return <Loading label="Loading metrics" />;
  if (error && !metrics) return <ErrorState message={error} onRetry={refresh} />;

  const counts = deriveCounts(audit, metrics);
  const handled = counts.autoResolved + counts.humanApproved + counts.escalated;
  const autoShare = handled
    ? Math.round((counts.autoResolved / handled) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Operations metrics</h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Live rollup from the backend audit trail — every number ties back to a
          logged action.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Tickets touched"
          value={metrics ? metrics.totalTicketsTouched : 0}
          hint="Cases that entered the pipeline"
          tone="brand"
          icon={Ticket}
        />
        <MetricCard
          label="Auto resolved"
          value={counts.autoResolved}
          hint="No human involved"
          tone="emerald"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Routed to human"
          value={metrics ? metrics.escalatedToHuman : 0}
          hint="Held by the policy gate"
          tone="amber"
          icon={UserCheck}
        />
        <MetricCard
          label="Total refunded"
          value={inr(counts.refundedTotal)}
          hint="Auto plus agent-approved"
          tone="brand"
          icon={IndianRupee}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold">Where cases ended up</h3>
          <p className="mb-4 mt-0.5 text-xs text-ink-500">
            Outcomes after the policy gate.
          </p>
          <DecisionDistribution
            rows={[
              {
                label: 'Auto-executed',
                value: counts.autoResolved,
                tone: 'emerald',
              },
              {
                label: 'Approved by agent',
                value: counts.humanApproved,
                tone: 'amber',
              },
              { label: 'Escalated to risk', value: counts.escalated, tone: 'red' },
            ]}
          />
        </section>

        <section className="card flex flex-col justify-center p-5">
          <p className="label">Handled without a human</p>
          <p className="mt-2 text-[40px] font-semibold leading-none tracking-tight tabular-nums">
            {autoShare}%
          </p>
          <p className="mt-2 text-sm text-ink-500">
            {counts.autoResolved} of {handled || 0} resolved cases closed
            automatically inside policy limits.
          </p>
        </section>
      </div>
    </div>
  );
}
