import { useState } from 'react';
import {
  ScrollText,
  Sparkles,
  IndianRupee,
  CheckCircle2,
  UserCheck,
  AlertTriangle,
  NotebookPen,
  Download,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, Loading, ErrorState } from '../components/States';
import { clockTime, dayLabel } from '../lib/format';
import { describeEvent } from '../lib/decision';

const ICONS = {
  DECISION_EVALUATED: Sparkles,
  REFUND_ISSUED: IndianRupee,
  TICKET_CLOSED: CheckCircle2,
  ESCALATED_TO_HUMAN: UserCheck,
  HUMAN_APPROVED: UserCheck,
  ESCALATED: AlertTriangle,
  CRM_UPDATED: NotebookPen,
};

const RING = {
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  red: 'bg-red-50 text-red-600 ring-red-100',
  blue: 'bg-sky-50 text-sky-600 ring-sky-100',
};

const FILTERS = [
  { key: 'all', label: 'All events' },
  { key: 'decisions', label: 'Decisions', types: ['DECISION_EVALUATED'] },
  {
    key: 'money',
    label: 'Money moved',
    types: ['REFUND_ISSUED', 'HUMAN_APPROVED'],
  },
  { key: 'risk', label: 'Risk', types: ['ESCALATED', 'ESCALATED_TO_HUMAN'] },
];

export default function Audit({ audit, loading, error, refresh }) {
  const [filter, setFilter] = useState('all');

  if (loading && !audit) return <Loading label="Loading audit trail" />;
  if (error && !audit) return <ErrorState message={error} onRetry={refresh} />;

  const active = FILTERS.find((f) => f.key === filter);
  const events = (audit || [])
    .slice()
    .reverse()
    .filter((e) => !active.types || active.types.includes(e.type));

  function exportJson() {
    const blob = new Blob([JSON.stringify(audit || [], null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kaarya-audit.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Audit log</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Every AI decision and operational action is recorded.
          </p>
        </div>
        <button
          onClick={exportJson}
          disabled={!audit || audit.length === 0}
          className="btn-secondary"
        >
          <Download size={14} />
          Export JSON
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md border px-2.5 py-1 text-[13px] transition-colors ${
              filter === f.key
                ? 'border-brand-200 bg-brand-50 font-medium text-brand-700'
                : 'border-line bg-white text-ink-700 hover:bg-canvas'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="card">
        {events.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No events recorded"
            body="Every decision, refund and escalation the backend performs will be listed here."
          />
        ) : (
          <ol className="divide-y divide-line">
            {events.map((e, i) => {
              const d = describeEvent(e);
              const Icon = ICONS[e.type] || ScrollText;
              return (
                <li key={e.timestamp + i} className="flex gap-3.5 px-4 py-3.5">
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ${
                      RING[d.tone] || RING.blue
                    }`}
                  >
                    <Icon size={13} strokeWidth={2.4} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold">{d.title}</p>
                      <StatusBadge tone="neutral">
                        {(e.type || '').replace(/_/g, ' ')}
                      </StatusBadge>
                      {d.subject ? (
                        <span className="font-mono text-xs text-ink-500">
                          {d.subject}
                        </span>
                      ) : null}
                    </div>
                    {d.lines.filter(Boolean).map((line, j) => (
                      <p key={j} className="mt-0.5 text-[13px] text-ink-700">
                        {line}
                      </p>
                    ))}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xs text-ink-700">
                      {clockTime(e.timestamp)}
                    </p>
                    <p className="font-mono text-[11px] text-ink-300">
                      {dayLabel(e.timestamp)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
