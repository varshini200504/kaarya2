/**
 * Centralized client for the Kaarya Express backend.
 * Every network call in the app goes through here — nothing is mocked.
 */

export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, timeout = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new ApiError('Unable to reach Kaarya backend.', 0);
  }
  clearTimeout(timer);

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  if (!res.ok || (data && data.ok === false)) {
    const message =
      (data && data.error) || `Request failed (${res.status}).`;
    throw new ApiError(message, res.status);
  }

  return data;
}

/* ---- reads ---- */

export const getHealth = () => request('/health');

export const getMetrics = () => request('/metrics').then((d) => d.metrics);

export const getAudit = () => request('/audit').then((d) => d.events || []);

export const getApprovals = () =>
  request('/approvals').then((d) => d.approvals || []);

export const getTicket = (id) =>
  request(`/tickets/${encodeURIComponent(id)}`).then((d) => d.ticket);

/* ---- the pipeline ---- */

/** POST /chat — runs Understand → Decide → Policy on the backend. */
export const sendChat = ({ customerId, orderId, message }) =>
  request('/chat', { method: 'POST', body: { customerId, orderId, message } });

/* ---- action endpoints (exposed for manual/agent-triggered use) ---- */

export const refund = ({ orderId, amount, reason }) =>
  request('/refund', { method: 'POST', body: { orderId, amount, reason } });

export const updateCRM = ({ customerId, note }) =>
  request('/crm/update', { method: 'POST', body: { customerId, note } });

export const closeTicket = ({ ticketId, resolutionSummary }) =>
  request('/ticket/close', {
    method: 'POST',
    body: { ticketId, resolutionSummary },
  });

/* ---- approval queue ---- */

export const approveApproval = (id, agentId = 'agent-priya') =>
  request(`/approvals/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: { agentId },
  }).then((d) => d.approval);

export const escalateApproval = (id, note) =>
  request(`/approvals/${encodeURIComponent(id)}/escalate`, {
    method: 'POST',
    body: { note },
  }).then((d) => d.approval);

/* ---- sales simulator: Understand -> Decide -> Gate -> Act -> Collaborate ---- */

/** GET /sales/merchants — merchants available to the sell flow. */
export const getSalesMerchants = () =>
  request('/sales/merchants').then((d) => d.merchants || []);

/** GET /sales/merchants/:id — raw signals + derived qualification, read-only. */
export const getSalesMerchant = (merchantId) =>
  request(`/sales/merchants/${encodeURIComponent(merchantId)}`);

/**
 * POST /sales/simulate — the one entry point for the whole sell pipeline.
 *   { merchantId }                     -> detect + qualify, return draft offer
 *   { merchantId, action:'send_offer'} -> send it (policy-gated)
 *   { merchantId, message }            -> classify reply and respond
 */
export const simulateSales = ({ merchantId, message, action }) =>
  request('/sales/simulate', {
    method: 'POST',
    body: { merchantId, message, action },
  });

/** GET /sales/opportunities — every opportunity the sell flow has created. */
export const getSalesOpportunities = () =>
  request('/sales/opportunities').then((d) => d.opportunities || []);

/** POST /sales/opportunities/:id/handoff — rep takes the warm lead. */
export const handoffOpportunity = (opportunityId, { repId, repName }) =>
  request(`/sales/opportunities/${encodeURIComponent(opportunityId)}/handoff`, {
    method: 'POST',
    body: { repId, repName },
  });
