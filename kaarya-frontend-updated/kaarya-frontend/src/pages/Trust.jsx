import {
  ShieldCheck,
  Eye,
  UserCheck,
  Bot,
  ArrowDown,
  Check,
  Sparkles,
  GitBranch,
  Target,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { Loading, ErrorState } from '../components/States';

const STAGES = [
  {
    n: 1,
    key: 'shadowing',
    name: 'Shadowing',
    icon: Eye,
    body: 'Kaarya drafts every action. A human reviews and executes all of them.',
    detail: 'Nothing runs without a person in the loop.',
  },
  {
    n: 2,
    key: 'supervised',
    name: 'Supervised',
    icon: UserCheck,
    body: 'Low-risk, high-confidence actions execute on their own. Everything above the policy limits goes to a human.',
    detail: 'This is the level running in today\u2019s demo.',
  },
  {
    n: 3,
    key: 'autonomous',
    name: 'Autonomous',
    icon: Bot,
    body: 'Task types with a proven track record run independently.',
    detail: 'Continuous audit sampling stays on, permanently.',
  },
];

const CURRENT = 'supervised';

const LOOP = [
  'AI decision',
  'Human review',
  'Agent edit or approval',
  'Outcome',
  'Feedback signal',
  'Policy + evaluation',
  'Better future decisions',
];

const EARNS = [
  'Accurate decisions',
  'Policy compliance',
  'Successful outcomes',
  'Low human override rates',
  'Consistent performance',
];

function pctOf(part, whole, fallback) {
  if (!whole) return fallback;
  return Math.round((part / whole) * 100) + '%';
}

export default function Trust({ audit, loading, error, refresh }) {
  if (loading && !audit) return <Loading label="Loading trust data" />;
  if (error && !audit) return <ErrorState message={error} onRetry={refresh} />;

  const events = audit || [];
  const count = (type) => events.filter((e) => e.type === type).length;

  const autoRefunds = count('REFUND_ISSUED');
  const humanApproved = count('HUMAN_APPROVED');
  const routedToHuman = count('ESCALATED_TO_HUMAN');
  const escalated = count('ESCALATED');
  const ticketsClosed = count('TICKET_CLOSED');

  const executed = autoRefunds + humanApproved;
  const closed = ticketsClosed + humanApproved;

  const metrics = [
    {
      label: 'Decision accuracy',
      value: '94%',
      note: 'Needs labelled ground truth',
      source: 'demo',
      icon: Target,
    },
    {
      label: 'Policy compliance',
      value: executed ? '100%' : '—',
      note: executed
        ? `${executed} executed action(s), each carrying an authorising decision`
        : 'No actions executed yet',
      source: 'audit',
      icon: ShieldCheck,
    },
    {
      label: 'Human override rate',
      value: pctOf(escalated, routedToHuman, '—'),
      note: routedToHuman
        ? `${escalated} escalated of ${routedToHuman} routed to a human`
        : 'Nothing routed to a human yet',
      source: 'audit',
      icon: GitBranch,
    },
    {
      label: 'Verified outcomes',
      value: pctOf(closed, executed, '—'),
      note: executed
        ? `${closed} of ${executed} executed action(s) closed on the ticket`
        : 'No outcomes to verify yet',
      source: 'audit',
      icon: Check,
    },
  ];

  const signals = [
    {
      label: 'Agent corrections this week',
      value: '12',
      source: 'demo',
      note: 'Edits and overrides feed the evaluation set',
    },
    {
      label: 'Policy threshold adjustments',
      value: '3',
      source: 'demo',
      note: 'Limits tightened or relaxed from observed outcomes',
    },
    {
      label: 'Verified outcomes',
      value: pctOf(closed, executed, '—'),
      source: 'audit',
      note: 'Confirmed against the ticket after the action ran',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Trust & learning</h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Kaarya earns autonomy through accuracy, policy compliance, and human
          feedback.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Trust ladder */}
        <section className="card p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Trust ladder</h3>
            <div className="flex items-center gap-2">
              <span className="label">Current level</span>
              <StatusBadge tone="amber">Supervised</StatusBadge>
            </div>
          </div>

          <ol className="space-y-0">
            {STAGES.map((stage, i) => {
              const Icon = stage.icon;
              const isCurrent = stage.key === CURRENT;
              const passed = i === 0;
              return (
                <li key={stage.key}>
                  <div
                    className={`rounded-lg border p-3.5 ${
                      isCurrent
                        ? 'border-brand-200 bg-brand-50 ring-1 ring-brand-100'
                        : 'border-line bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold ${
                          isCurrent
                            ? 'bg-brand-600 text-white'
                            : passed
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              : 'bg-canvas text-ink-300 ring-1 ring-line'
                        }`}
                      >
                        {stage.n}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Icon
                            size={14}
                            className={isCurrent ? 'text-brand-600' : 'text-ink-500'}
                          />
                          <p
                            className={`text-sm font-semibold ${
                              isCurrent ? 'text-brand-700' : 'text-ink-900'
                            }`}
                          >
                            {stage.name}
                          </p>
                          {isCurrent ? (
                            <StatusBadge tone="blue">You are here</StatusBadge>
                          ) : passed ? (
                            <StatusBadge tone="emerald">Cleared</StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral">Locked</StatusBadge>
                          )}
                        </div>
                        <p className="mt-1 text-[13px] leading-snug text-ink-700">
                          {stage.body}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-500">
                          {stage.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                  {i < STAGES.length - 1 ? (
                    <div className="flex justify-center py-1.5">
                      <ArrowDown size={14} className="text-ink-300" />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        {/* Trust score */}
        <section className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="label">Kaarya trust score</p>
              <StatusBadge tone="neutral">Demo</StatusBadge>
            </div>
            <p className="mt-2 text-[40px] font-semibold leading-none tracking-tight tabular-nums">
              87
              <span className="text-lg font-medium text-ink-300"> / 100</span>
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: '87%' }}
              />
            </div>
            <p className="mt-2.5 text-xs text-ink-500">
              Demo trust score — the backend does not compute one yet. In
              production this is a rolling score per task type, not per model.
            </p>
          </div>

          <div className="card p-4">
            <p className="label">Autonomy is scoped</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-700">
              Refunds under ₹500 with verified customers run unattended. Every
              other action still stops at the policy gate — a high score on one
              task type does not unlock another.
            </p>
          </div>
        </section>
      </div>

      {/* Trust metrics */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">Performance signals</h3>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="label">{m.label}</p>
                  <Icon size={15} className="text-ink-300" />
                </div>
                <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
                  {m.value}
                </p>
                <p className="mt-1.5 text-xs leading-snug text-ink-500">{m.note}</p>
                <div className="mt-2.5">
                  <StatusBadge tone={m.source === 'audit' ? 'emerald' : 'neutral'}>
                    {m.source === 'audit' ? 'From audit log' : 'Demo value'}
                  </StatusBadge>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Learning loop */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles size={13} className="text-sky-600" />
            <h3 className="text-sm font-semibold">Continuous learning</h3>
          </div>
          <p className="mb-4 text-xs text-ink-500">
            Agent edits and confirmed outcomes feed back into evaluation, policy
            thresholds, and memory.
          </p>

          <ol className="space-y-1.5">
            {LOOP.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-white font-mono text-[11px] text-ink-500">
                  {i + 1}
                </span>
                <span
                  className={`flex-1 rounded-md border px-3 py-1.5 text-[13px] ${
                    i === LOOP.length - 1
                      ? 'border-emerald-200 bg-emerald-50 font-medium text-emerald-800'
                      : 'border-line bg-white'
                  }`}
                >
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4">
          {signals.map((s) => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="label">{s.label}</p>
                <StatusBadge tone={s.source === 'audit' ? 'emerald' : 'neutral'}>
                  {s.source === 'audit' ? 'From audit log' : 'Demo signal'}
                </StatusBadge>
              </div>
              <p className="mt-2 text-2xl font-semibold leading-none tabular-nums">
                {s.value}
              </p>
              <p className="mt-1.5 text-xs text-ink-500">{s.note}</p>
            </div>
          ))}
        </section>
      </div>

      {/* Why this matters */}
      <section className="card p-5">
        <h3 className="text-sm font-semibold">Why Kaarya earns autonomy</h3>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-700">
          Kaarya does not become autonomous because a model is confident. It earns
          autonomy by repeatedly demonstrating:
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {EARNS.map((item) => (
            <li
              key={item}
              className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]"
            >
              <Check size={12} strokeWidth={3} className="text-emerald-600" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-3.5 text-sm font-medium">
          Autonomy is earned per action type — not granted all at once.
        </p>
      </section>
    </div>
  );
}
