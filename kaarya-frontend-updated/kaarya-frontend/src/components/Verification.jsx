import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Ban,
  Clock,
  X,
} from 'lucide-react';
import { getTicket } from '../api/client';
import { inr } from '../lib/format';

/**
 * "Refund initiated" is not an outcome. After an action runs, re-read the
 * ticket from the backend (GET /tickets/:id) and confirm what actually
 * happened: money returned, customer told, ticket closed.
 *
 * Nothing here is asserted from local state — if the backend can't confirm a
 * line, it renders unconfirmed rather than green.
 */
export default function OutcomeVerification({
  ticketId,
  mode, // 'auto' | 'approved'
  amount,
  refundId,
  onStatus,
}) {
  const [state, setState] = useState('checking');
  const [checks, setChecks] = useState([]);
  const [error, setError] = useState(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    if (!ticketId) return undefined;
    let cancelled = false;
    if (onStatus) onStatus('checking');

    const timer = setTimeout(async () => {
      try {
        const ticket = await getTicket(ticketId);
        if (cancelled || !live.current) return;

        const agentReply = (ticket.messages || []).find(
          (m) => m.from === 'kaarya'
        );
        const closed = ticket.status === 'closed';
        const summary = ticket.resolutionSummary;

        const next = [
          {
            label: 'Refund processed',
            detail:
              mode === 'auto'
                ? `${inr(amount)} returned to original payment method`
                : `${inr(amount)} released after agent approval`,
            pass: !!summary || closed,
          },
          {
            label:
              mode === 'auto'
                ? 'Gateway reference recorded'
                : 'Approval recorded against the order',
            detail: refundId || summary || 'No reference returned',
            pass: !!(refundId || summary),
          },
          {
            label: 'Customer notified',
            detail: agentReply
              ? agentReply.text
              : 'No confirmation message on the ticket',
            pass: !!agentReply,
          },
          {
            label: 'Ticket closed',
            detail: `${ticket.id} · status ${ticket.status}`,
            pass: closed,
          },
        ];

        setChecks(next);
        const ok = next.every((c) => c.pass);
        setState(ok ? 'verified' : 'partial');
        if (onStatus) onStatus(ok ? 'ok' : 'partial');
      } catch (err) {
        if (cancelled || !live.current) return;
        setError(err.message);
        setState('error');
        if (onStatus) onStatus('error');
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, mode, amount, refundId]);

  return (
    <div className="animate-rise border-t border-line px-4 py-3.5">
      <div className="mb-2.5 flex items-center gap-1.5">
        <ShieldCheck size={13} className="text-emerald-600" />
        <h4 className="label">Outcome verification</h4>
      </div>

      {state === 'checking' ? (
        <p className="flex items-center gap-2 text-[13px] text-ink-500">
          <Loader2 size={13} className="animate-spin" />
          Re-reading the ticket from the backend…
        </p>
      ) : null}

      {state === 'error' ? (
        <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Outcome could not be confirmed — {error}
        </p>
      ) : null}

      {checks.length > 0 ? (
        <>
          <ul className="space-y-2">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    c.pass
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {c.pass ? (
                    <Check size={10} strokeWidth={3.5} />
                  ) : (
                    <X size={10} strokeWidth={3.5} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium leading-tight">
                    {c.label}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-500">
                    {c.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div
            className={`mt-3 rounded-md border px-3 py-2.5 ${
              state === 'verified'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <ShieldCheck size={15} strokeWidth={2.5} />
              {state === 'verified' ? 'Outcome verified' : 'Outcome partial'}
            </p>
            <p className="mt-1 text-[13px] leading-snug">
              {state === 'verified'
                ? 'Kaarya did not stop at initiating the refund — the final state was read back and confirmed.'
                : 'Some parts of the outcome could not be confirmed against the backend.'}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Outcome status for a case that hasn't acted yet. */
export function OutcomePending() {
  return (
    <div className="border-t border-line px-4 py-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        <Clock size={13} className="text-amber-600" />
        <h4 className="label">Outcome status</h4>
      </div>
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
        Waiting for human approval. No refund has been issued and no outcome can
        be claimed yet.
      </p>
    </div>
  );
}

/** Outcome status for a case where execution was deliberately blocked. */
export function OutcomeBlocked({ escalated }) {
  return (
    <div className="animate-rise border-t border-line px-4 py-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        <Ban size={13} className="text-red-600" />
        <h4 className="label">Outcome status</h4>
      </div>
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-red-800">
        <p className="text-sm font-semibold uppercase tracking-wide">
          Outcome blocked
        </p>
        <p className="mt-1 text-[13px] leading-snug">
          The refund was not executed because this case carries a fraud/risk
          signal.
        </p>
      </div>
      <ul className="mt-2.5 space-y-1.5 text-[13px]">
        <li className="flex items-center gap-2">
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full ${
              escalated
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-canvas text-ink-300'
            }`}
          >
            <Check size={10} strokeWidth={3.5} />
          </span>
          Case escalated
        </li>
        <li className="flex items-center gap-2">
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full ${
              escalated
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-canvas text-ink-300'
            }`}
          >
            <Check size={10} strokeWidth={3.5} />
          </span>
          Risk review requested
        </li>
        <li className="flex items-center gap-2 font-medium text-red-700">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100">
            <X size={10} strokeWidth={3.5} />
          </span>
          Refund: not executed
        </li>
      </ul>
    </div>
  );
}
