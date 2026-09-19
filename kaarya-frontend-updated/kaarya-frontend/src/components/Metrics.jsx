export function MetricCard({ label, value, hint, tone = 'neutral', icon: Icon }) {
  const accents = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    brand: 'text-brand-600',
    neutral: 'text-ink-500',
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="label">{label}</p>
        {Icon ? <Icon size={15} className={accents[tone]} /> : null}
      </div>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

const BAR_TONES = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

export function DecisionDistribution({ rows }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const share = total ? Math.round((row.value / total) * 100) : 0;
        return (
          <div key={row.label}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="text-ink-700">{row.label}</span>
              <span className="tabular-nums text-ink-500">
                <span className="font-semibold text-ink-900">{row.value}</span>
                {total ? <span className="ml-1.5 text-xs">{share}%</span> : null}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas">
              <div
                className={`h-full rounded-full transition-all duration-500 ${BAR_TONES[row.tone]}`}
                style={{ width: (total ? share : 0) + '%' }}
              />
            </div>
          </div>
        );
      })}
      {!total ? (
        <p className="pt-1 text-xs text-ink-500">
          Run a scenario in the simulator to populate this.
        </p>
      ) : null}
    </div>
  );
}
