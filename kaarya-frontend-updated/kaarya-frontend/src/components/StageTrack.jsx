import { Check, ChevronRight, Loader2 } from 'lucide-react';

export const SHELL = {
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  active: 'border-brand-200 bg-brand-50 text-brand-700',
  wait: 'border-amber-200 bg-amber-50 text-amber-800',
  risk: 'border-red-200 bg-red-50 text-red-700',
  blocked: 'border-red-200 bg-white text-red-600',
  idle: 'border-line bg-white text-ink-300',
};

export function Node({ step }) {
  const Icon = step.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5
                  text-[11px] font-semibold uppercase tracking-wider ${SHELL[step.state]}`}
    >
      {step.state === 'done' ? (
        <Check size={12} strokeWidth={3} />
      ) : step.state === 'active' ? (
        <Loader2 size={12} className="animate-spin" />
      ) : Icon ? (
        <Icon size={12} strokeWidth={2.5} />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full border border-current" />
      )}
      {step.label}
    </span>
  );
}

/** Renders a chevron-separated row of pipeline stages. */
export default function StageTrack({ steps }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {steps.map((step, i) => (
        <div key={step.label + i} className="flex items-center gap-1.5">
          <Node step={step} />
          {i < steps.length - 1 ? (
            <ChevronRight size={14} className="text-ink-300" />
          ) : null}
        </div>
      ))}
    </div>
  );
}
