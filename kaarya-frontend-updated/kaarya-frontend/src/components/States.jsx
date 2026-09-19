import { Loader2 } from 'lucide-react';

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon ? (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-canvas text-ink-300">
          <Icon size={18} />
        </div>
      ) : null}
      <p className="text-sm font-medium text-ink-900">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-ink-500">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-500">
      <Loader2 size={15} className="animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      <p className="mt-1 text-sm text-ink-500">
        Start the backend with <code className="font-mono">npm start</code> in
        kaarya-backend, then try again.
      </p>
      {onRetry ? (
        <button onClick={onRetry} className="btn-secondary mt-4">
          Try again
        </button>
      ) : null}
    </div>
  );
}
