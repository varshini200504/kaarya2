import {
  LayoutDashboard,
  MessagesSquare,
  BriefcaseBusiness,
  Zap,
  ScrollText,
  BarChart3,
  ShieldCheck,
  X,
} from 'lucide-react';

export const NAV = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'simulator', label: 'Customer Simulator', icon: MessagesSquare },
  { key: 'sales', label: 'Sales Simulator', icon: BriefcaseBusiness },
  { key: 'approvals', label: 'Approvals', icon: Zap },
  { key: 'audit', label: 'Audit Log', icon: ScrollText },
  { key: 'metrics', label: 'Metrics', icon: BarChart3 },
  { key: 'trust', label: 'Trust & Learning', icon: ShieldCheck },
];

function NavList({ active, onNavigate, pendingCount }) {
  return (
    <nav className="flex-1 px-3 py-4">
      <ul className="space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <li key={item.key}>
              <button
                onClick={() => onNavigate(item.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors
                  ${
                    isActive
                      ? 'bg-brand-50 font-semibold text-brand-700'
                      : 'text-ink-700 hover:bg-canvas'
                  }`}
              >
                <Icon
                  size={16}
                  strokeWidth={isActive ? 2.4 : 2}
                  className={isActive ? 'text-brand-600' : 'text-ink-500'}
                />
                <span className="flex-1 text-left">{item.label}</span>
                {item.key === 'approvals' && pendingCount > 0 ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                    {pendingCount}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Identity() {
  return (
    <div className="border-t border-line px-4 py-4">
      <p className="label mb-2">Agent</p>
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
          PS
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Priya Sharma</p>
          <p className="truncate text-xs text-ink-500">Support Operations</p>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Online
      </p>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 font-mono text-sm font-semibold text-white">
        K
      </div>
      <div>
        <p className="text-[15px] font-semibold leading-tight tracking-tight">KAARYA</p>
        <p className="text-[11px] leading-tight text-ink-500">
          AI-powered support operations
        </p>
      </div>
    </div>
  );
}

export default function Sidebar({
  active,
  onNavigate,
  pendingCount,
  mobileOpen,
  onCloseMobile,
}) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white lg:flex">
        <Brand />
        <NavList active={active} onNavigate={onNavigate} pendingCount={pendingCount} />
        <Identity />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-900/30"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-line bg-white shadow-pop">
            <div className="flex items-start justify-between">
              <Brand />
              <button
                onClick={onCloseMobile}
                className="p-4 text-ink-500"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
            <NavList
              active={active}
              onNavigate={(k) => {
                onNavigate(k);
                onCloseMobile();
              }}
              pendingCount={pendingCount}
            />
            <Identity />
          </aside>
        </div>
      ) : null}
    </>
  );
}
