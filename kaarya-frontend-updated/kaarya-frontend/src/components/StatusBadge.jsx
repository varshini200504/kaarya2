const TONES = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  blue: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-canvas text-ink-500 border-line-strong',
};

export default function StatusBadge({ tone = 'neutral', children, icon: Icon }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5
                  text-[11px] font-semibold uppercase tracking-wider ${TONES[tone] || TONES.neutral}`}
    >
      {Icon ? <Icon size={12} strokeWidth={2.5} /> : null}
      {children}
    </span>
  );
}

export function outcomeBadge(outcome) {
  if (outcome === 'AUTO') return { tone: 'emerald', text: 'Auto-resolved' };
  if (outcome === 'HUMAN') return { tone: 'amber', text: 'Human approval' };
  if (outcome === 'BLOCKED') return { tone: 'red', text: 'Escalated' };
  return { tone: 'neutral', text: 'Pending' };
}
