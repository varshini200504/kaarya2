require('dotenv').config();

const express = require('express');
const cors = require('cors');


const chatRoutes = require('./src/routes/chat');
const refundRoutes = require('./src/routes/refund');
const crmRoutes = require('./src/routes/crm');
const ticketRoutes = require('./src/routes/ticket');
const approvalsRoutes = require('./src/routes/approvals');
const auditRoutes = require('./src/routes/audit');
const salesRoutes = require('./src/routes/sales');
const { initKnowledge } = require('./src/rag/retriever');
const { activeReasoner } = require('./src/engine/llm');

const app = express();
app.use(cors());
app.use(express.json());

// Simple request logger — handy for demo debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => res.json({ ok: true, service: 'kaarya-backend' }));

app.use(chatRoutes);      // POST /chat, GET /tickets/:id
app.use(refundRoutes);    // POST /refund
app.use(crmRoutes);       // POST /crm/update
app.use(ticketRoutes);    // POST /ticket/close
app.use(approvalsRoutes); // GET /approvals, POST /approvals/:id/approve|escalate
app.use(auditRoutes);     // GET /audit, GET /metrics
app.use(salesRoutes);     // POST /sales/simulate, GET /sales/*, POST /sales/opportunities/:id/handoff

app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Kaarya backend running on http://localhost:${PORT}`);
  console.log(`GEMINI_API_KEY set: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`ANTHROPIC_API_KEY set: ${!!process.env.ANTHROPIC_API_KEY}`);
  console.log(`Reasoner: ${activeReasoner()} (falls back to mock on any failure)`);
  initKnowledge(); // preload knowledge base; logs and continues if unavailable
});
