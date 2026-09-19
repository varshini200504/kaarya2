````markdown
# Kaarya 🤖

### AI-Powered Operations Teammate for Support & Merchant Growth

> Kaarya doesn't just generate answers. It helps drive the right business outcome — with AI reasoning, company knowledge, deterministic policies, human oversight, and verified execution.

---

## 🚀 Overview

Kaarya is an AI-powered operations teammate designed to automate repetitive customer-support workflows while helping businesses identify and qualify merchant growth opportunities.

Instead of allowing an LLM to directly perform sensitive actions, Kaarya separates AI intelligence from business authority.

```text
Customer / Merchant
        ↓
   Context Assembly
        ↓
   Knowledge Retrieval (RAG)
        ↓
     Gemini AI
   AI Recommendation
        ↓
 Deterministic Policy Engine
        ↓
 ┌──────┼─────────┐
 ↓      ↓         ↓
AUTO   HUMAN    ESCALATE
 ↓      ↓
Execute  Approval
        ↓
   Outcome Verification
        ↓
       Audit
````

---

## 🎯 Problem

Businesses handle thousands of repetitive operational requests every day:

* Payment and refund issues
* Failed orders
* Customer verification
* Fraud-related exceptions
* Support escalations
* Merchant growth opportunities
* Sales qualification

Traditional automation relies on rigid rules, while generic AI assistants can reason well but should not be given unrestricted authority over sensitive business actions.

Kaarya combines both approaches:

**AI provides intelligence.
Business policies provide authority.
Humans handle exceptions.**

---

# 💡 Key Features

## 1. 🧑‍💻 AI-Powered Support Resolution

Kaarya understands customer issues and gathers relevant context including:

* Customer information
* Order information
* Payment status
* Verification status
* Fraud signals
* Supporting evidence

The AI then proposes an appropriate resolution.

Example:

> "Payment was captured but the order failed."

Kaarya can determine that a refund may be appropriate while the deterministic policy engine independently validates whether the action is allowed.

---

## 2. 🧠 RAG-Powered Business Knowledge

Kaarya uses Retrieval-Augmented Generation to ground AI reasoning in company-specific knowledge.

The knowledge base contains:

```text
knowledge/
├── refund_policy.md
├── fraud_policy.md
├── support_sop.md
├── escalation_policy.md
└── past_resolutions.json
```

Before Gemini reasons about a case, Kaarya retrieves relevant knowledge from these sources.

```text
Customer Request
       ↓
Knowledge Retrieval
       ↓
Relevant Policies / SOPs
       ↓
Gemini
       ↓
Recommendation
```

This allows the AI to reason using operational knowledge instead of relying only on generic model knowledge.

---

## 3. 🛡️ Deterministic Policy Engine

AI does not have direct authority to execute sensitive actions.

Gemini produces a recommendation such as:

```json
{
  "action": "refund",
  "amount": 499,
  "confidence": 0.94
}
```

The recommendation is then independently checked by the deterministic policy engine.

The policy layer evaluates factors such as:

* Customer verification
* Fraud signals
* Refund amount limits
* Confidence thresholds
* Authorization requirements
* Human approval requirements
* Payment state

Possible outcomes:

```text
AUTO APPROVE
     OR
HUMAN APPROVAL
     OR
ESCALATE
```

### Core principle

> **The AI can recommend. The policy engine authorizes.**

---

## 4. 👩‍💼 Human-in-the-Loop

Not every case should be automated.

Kaarya routes uncertain, risky, or high-value cases to human agents with the relevant context and AI reasoning already prepared.

```text
Customer Issue
     ↓
AI Investigation
     ↓
Evidence
     ↓
AI Reasoning
     ↓
Policy Checks
     ↓
Human Approval
```

This allows human agents to focus on exceptions instead of repetitive investigation.

---

## 5. ✅ Outcome Verification

Kaarya does not consider an action successful simply because an API call was triggered.

After execution, the system verifies the expected business outcome.

```text
Refund Requested
      ↓
Refund Executed
      ↓
Verify Transaction State
      ↓
Verify Customer Notification
      ↓
Verify Ticket State
      ↓
Record Outcome
```

### Key principle

> **Triggering an action is not the same as resolving a case.**

---

## 6. 📊 Auditability & Metrics

Kaarya maintains an operational trail containing information such as:

* AI recommendation
* Confidence
* Retrieved knowledge
* Policy checks
* Final decision
* Human intervention
* Execution
* Verification
* Outcome

This makes AI-assisted operations more transparent and measurable.

---

# 💰 Merchant Sales Intelligence

Kaarya is not limited to customer support.

It also identifies potential merchant growth opportunities.

The system evaluates business signals such as:

* GMV
* Business growth
* Plan utilization
* Projected transaction volume
* Merchant qualification signals

```text
High Growth
     +
High GMV
     +
High Plan Utilization
     +
High Projected Volume
          ↓
Potential Upgrade Opportunity
          ↓
Qualification
          ↓
Offer
          ↓
Buying Intent
          ↓
Human Sales Handoff
```

Instead of blindly upselling every merchant, Kaarya identifies merchants that show genuine signals of business growth and potential product needs.

---

## 🤝 Human Sales Handoff

When a merchant demonstrates meaningful buying intent, Kaarya can create a human-ready sales handoff.

The sales representative receives relevant context such as:

* Merchant profile
* Current plan
* Business signals
* Recommended plan
* Opportunity value
* Conversation context
* Buying intent

The goal is not to replace sales representatives.

The goal is to provide them with **better-qualified opportunities and better context**.

---

# 🏗️ Architecture

```text
                    ┌───────────────────┐
                    │ Customer / Merchant│
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │ Context Assembly  │
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │   RAG Retrieval   │
                    │ Policies / SOPs   │
                    │ Past Resolutions  │
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │    Gemini AI      │
                    │    Reasoning      │
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │ Deterministic     │
                    │ Policy Engine     │
                    └─────────┬─────────┘
                              ↓
                 ┌────────────┼────────────┐
                 ↓            ↓            ↓
              AUTO         HUMAN        ESCALATE
                 ↓            ↓
             Execute       Approval
                 └────────────┬────────────┘
                              ↓
                    ┌───────────────────┐
                    │ Outcome           │
                    │ Verification      │
                    └─────────┬─────────┘
                              ↓
                    ┌───────────────────┐
                    │ Audit & Metrics   │
                    └───────────────────┘
```

---

# 🧠 AI Architecture

Kaarya separates intelligence from authority:

| Component       | Responsibility                         |
| --------------- | -------------------------------------- |
| RAG             | Retrieve relevant business knowledge   |
| Gemini          | Understand context and propose actions |
| Policy Engine   | Decide whether the action is permitted |
| Execution Layer | Perform authorized actions             |
| Verification    | Confirm the expected outcome           |
| Audit Layer     | Record the operational trail           |
| Human Agent     | Handle exceptions and high-risk cases  |

---

# 🛠️ Technology Stack

### Frontend

* React.js
* JavaScript
* HTML
* CSS

### Backend

* Node.js
* Express.js
* REST APIs

### AI

* Google Gemini API
* Anthropic Claude API as optional fallback
* Claude Code for AI-assisted development

### RAG

* Local knowledge base
* BM25-based retrieval
* Policy and SOP documents
* Historical resolution data

### Data

* JSON-based prototype data
* In-memory/mock operational data

### Engineering

* Git
* GitHub
* Environment-based API configuration
* Deterministic policy engine
* Audit logging

---

# 📁 Project Structure

```text
kaarya-backend/
│
├── server.js
├── package.json
│
├── src/
│   ├── engine/
│   │   ├── llm.js
│   │   └── policy.js
│   │
│   ├── rag/
│   │   └── retriever.js
│   │
│   ├── routes/
│   │   ├── chat.js
│   │   ├── refund.js
│   │   ├── approvals.js
│   │   ├── audit.js
│   │   ├── crm.js
│   │   ├── ticket.js
│   │   └── sales.js
│   │
│   └── adapters/
│
├── knowledge/
│   ├── refund_policy.md
│   ├── fraud_policy.md
│   ├── support_sop.md
│   ├── escalation_policy.md
│   └── past_resolutions.json
│
└── test/
```

---

# ⚙️ Getting Started

## 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd kaarya-backend
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

Create a `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Optional:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_MODEL=gemini-2.5-flash
```

**Never commit `.env` or API keys to GitHub.**

## 4. Start the backend

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:4000
```

Health check:

```text
GET /health
```

---

# 🔄 Example Support Flow

```text
Customer:
"Money was deducted but my order failed."

        ↓

Context Assembly
        ↓
Order + Customer + Payment + Evidence
        ↓
RAG Retrieval
        ↓
Refund Policy + Support SOP
        ↓
Gemini
        ↓
Recommendation:
"Refund ₹499"
        ↓
Policy Engine
        ↓
✓ Customer verified
✓ Payment captured
✓ No fraud flag
✓ Amount within limit
✓ Confidence sufficient
        ↓
AUTO APPROVE
        ↓
Refund Execution
        ↓
Outcome Verification
        ↓
Audit
```

---

# 💼 Business Impact

### Support Operations

* Reduce repetitive support workload
* Accelerate resolution
* Route exceptions intelligently
* Reduce manual investigation

### Risk & Trust

* Keep financial actions policy-controlled
* Maintain human oversight
* Provide explainable decisions
* Verify post-action outcomes

### Merchant Growth

* Identify high-potential merchants
* Qualify opportunities automatically
* Generate contextual offers
* Provide sales teams with warm handoffs

---

# 🏆 Why Kaarya?

Traditional automation:

```text
IF condition
→ Execute action
```

Generic AI:

```text
Prompt
→ Generate response
```

Kaarya:

```text
Understand
   ↓
Retrieve Knowledge
   ↓
Reason
   ↓
Apply Policy
   ↓
Act
   ↓
Verify
   ↓
Audit
```

### The goal isn't to replace humans.

### The goal is to give humans an AI teammate that can safely handle the work between the request and the business outcome.

---

# 🚀 Future Improvements

* Vector/embedding-based semantic retrieval
* Dynamic trust ladder
* Feedback-driven learning
* Systemic incident detection
* Production payment/CRM/ticket integrations
* Persistent database
* Authentication and role-based access
* Advanced agent/tool orchestration

---

# 🏅 Hackathon

Built for the **Paytm <3 AI Hackathon**.

---

## ⭐ Core Idea

> **Kaarya turns AI from a conversational assistant into a controlled operational teammate — combining company knowledge, AI reasoning, deterministic policies, human oversight and verified execution.**

```
```
