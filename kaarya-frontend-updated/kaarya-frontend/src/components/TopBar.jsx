import { Menu, RefreshCw } from 'lucide-react';

export default function TopBar({ title, online, onOpenMobile, onRefresh, refreshing }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:px-6">
      <button
        onClick={onOpenMobile}
        className="-ml-1 rounded p-1.5 text-ink-700 hover:bg-canvas lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>

      <span className="hidden rounded border border-line-strong bg-canvas px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500 sm:inline">
        Demo environment
      </span>

      <span
        className="flex items-center gap-1.5 text-xs font-medium text-ink-500"
        title={online ? 'Backend reachable' : 'Backend unreachable'}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            online ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        />
        {online ? 'API connected' : 'API offline'}
      </span>

      <div className="ml-auto flex items-center gap-3">
        {onRefresh ? (
          <button
            onClick={onRefresh}
            className="rounded p-1.5 text-ink-500 hover:bg-canvas hover:text-ink-700"
            aria-label="Refresh data"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        ) : null}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
            PS
          </div>
          <span className="hidden text-sm text-ink-700 sm:inline">Priya</span>
        </div>
      </div>
    </header>
  );
}
