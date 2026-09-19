# Kaarya — AI-Powered Operations Console

Kaarya is an AI-powered operations console that helps support and sales teams handle customer issues, make policy-aware decisions, and identify merchant opportunities.

The platform combines **LLM reasoning, lightweight RAG, deterministic policy enforcement, automated actions, human approvals, sales qualification, auditability, and outcome verification** into a single workflow.

> **AI proposes. Policy decides. Humans stay in control.**

---

## 🚀 What Kaarya Does

Kaarya supports two major operational workflows:

### 1. Customer Support

Automates refund-related customer support while ensuring that every decision passes through deterministic business policies.

```text
Customer Message
       ↓
Understand Context
       ↓
Retrieve Knowledge (RAG)
       ↓
AI Reasoning
       ↓
Policy Engine
       ↓
 ┌───────────────┐
 │               │
AUTO APPROVE   HUMAN REVIEW
 │               │
 ↓               ↓
Refund        Approve / Escalate
 ↓
CRM Update
 ↓
Ticket Closed
 ↓
Outcome Verification
