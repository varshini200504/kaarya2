import { Check, X } from 'lucide-react';

export default function PolicyChecks({ checks = [], compact = false }) {
  if (!checks.length) {
    return <p className="text-sm text-ink-500">No checks recorded.</p>;
  }

  return (
    <ul className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {checks.map((check, i) => (
        <li
          key={check.name + i}
          className={`flex items-start gap-2.5 rounded-md border px-2.5 py-2 ${
            check.pass
              ? 'border-line bg-white'
              : 'border-red-200 bg-red-50/60'
          }`}
        >
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
              check.pass
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {check.pass ? (
              <Check size={10} strokeWidth={3.5} />
            ) : (
              <X size={10} strokeWidth={3.5} />
            )}
          </span>
          <div className="min-w-0">
            <p
              className={`text-[13px] font-medium leading-tight ${
                check.pass ? 'text-ink-900' : 'text-red-800'
              }`}
            >
              {check.name}
            </p>
            {check.detail ? (
              <p
                className={`mt-0.5 font-mono text-[11px] leading-tight ${
                  check.pass ? 'text-ink-500' : 'text-red-600'
                }`}
              >
                {check.detail}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
