import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import { ToastProvider, useToast } from './components/Toast';
import Overview from './pages/Overview';
import Simulator from './pages/Simulator';
import Sales from './pages/Sales';
import Approvals from './pages/Approvals';
import Audit from './pages/Audit';
import MetricsPage from './pages/Metrics';
import Trust from './pages/Trust';
import { getAudit, getApprovals, getMetrics, getHealth } from './api/client';

const TITLES = {
  overview: 'Overview',
  simulator: 'Customer Simulator',
  sales: 'Sales Simulator',
  approvals: 'Approvals',
  audit: 'Audit Log',
  metrics: 'Metrics',
  trust: 'Trust & Learning',
};

function Shell() {
  const { notify } = useToast();

  const [page, setPage] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [metrics, setMetrics] = useState(null);
  const [audit, setAudit] = useState(null);
  const [approvals, setApprovals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [online, setOnline] = useState(true);

  const wasOffline = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [m, a, q] = await Promise.all([
        getMetrics(),
        getAudit(),
        getApprovals(),
      ]);
      if (!mounted.current) return;
      setMetrics(m);
      setAudit(a);
      setApprovals(q);
      setError(null);
      setOnline(true);
      if (wasOffline.current) {
        wasOffline.current = false;
        notify('Reconnected to Kaarya backend.', 'success');
      }
    } catch (err) {
      if (!mounted.current) return;
      setError(err.message);
      if (err.status === 0) {
        setOnline(false);
        if (!wasOffline.current) {
          wasOffline.current = true;
          notify('Unable to reach Kaarya backend.', 'error');
        }
      } else {
        notify(err.message, 'error');
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [notify]);

  // Initial load + lightweight polling so the queue stays current during a demo.
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  // Independent health ping for the connection indicator.
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        await getHealth();
        if (!cancelled) setOnline(true);
      } catch (err) {
        if (!cancelled) setOnline(false);
      }
    };
    ping();
    const id = setInterval(ping, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const shared = {
    metrics,
    audit,
    approvals,
    loading,
    error,
    refresh,
    notify,
    onNavigate: setPage,
  };

  const pendingCount = (approvals || []).filter(
    (a) => a.status === 'pending'
  ).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar
        active={page}
        onNavigate={setPage}
        pendingCount={pendingCount}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={TITLES[page]}
          online={online}
          onOpenMobile={() => setMobileOpen(true)}
          onRefresh={refresh}
          refreshing={refreshing}
        />

        <main className="flex-1 px-4 py-5 lg:px-6">
          {page === 'overview' ? <Overview {...shared} /> : null}
          {page === 'simulator' ? (
            <Simulator refresh={refresh} notify={notify} />
          ) : null}
          {page === 'sales' ? <Sales notify={notify} /> : null}
          {page === 'approvals' ? <Approvals {...shared} /> : null}
          {page === 'audit' ? <Audit {...shared} /> : null}
          {page === 'metrics' ? <MetricsPage {...shared} /> : null}
          {page === 'trust' ? <Trust {...shared} /> : null}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
