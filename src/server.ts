import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import dns from 'dns';
import cron from 'node-cron';
import { MongoClient } from 'mongodb';
import agentsRoutes from './routes/agents.routes.js';
import authRoutes from './routes/auth.routes.js';
import toolsRoutes from './routes/tools.routes.js';
import businessesRoutes from './routes/businesses.routes.js';
import workflowsRoutes from './routes/workflows.routes.js';
import dispatchRoutes from './routes/dispatch.routes.js';
import { ALL_AGENT_IDS } from './tools/index.js';
import { getDb } from './db/mongodb.js';
import { metricsRegistry, cronExecutionsTotal, activeWorkflowRuns } from './metrics/prometheus.js';
import { getModelConfig, getModelDescription, validateModelConfig } from './engine/model-provider.js';
import { crmLeadSignalProvider } from './signals/crm-lead-signals.js';
import { orchestrateWorkflow } from './engine/orchestrator.engine.js';

// Configure reliable DNS servers to avoid Windows SRV lookup issues for MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where setting DNS servers is restricted
}

// Load .env first, then override with .env.local if present
dotenv.config();
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

// Normalize environment variable names
if (process.env.OPEN_AI_KEY && !process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.OPEN_AI_KEY;
}
if (process.env.DATABASE_URL && !process.env.MONGODB_URI) {
  process.env.MONGODB_URI = process.env.DATABASE_URL;
}

const app = express();
const PORT = process.env.PORT || 4000;

// Production-ready CORS supporting localhost, Vercel deployments, and custom domains
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://heytam-onboarding-flow.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(null, true); // Permissive fallback for agent tool integrations
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root Service Metadata Endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'heytam-agents-backend',
    name: 'HeyTam Slave Agents Workforce Engine',
    version: '2.3.0',
    role: 'slave-agents-workforce-engine',
    orchestrator: {
      status: 'external',
      name: 'heytam-core',
      url: process.env.HEYTAM_CORE_URL || 'http://localhost:3000',
      description: 'Master Orchestrator supervisor hosted in heytam-core',
    },
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      systemHealth: '/api/system/health',
      execute: '/execute',
      slaveExecute: '/api/slave/:agentId/execute',
      dispatch: '/api/dispatch',
      auth: '/api/auth',
      tools: '/api/tools',
      workflows: '/api/workflows',
      businesses: '/api/businesses',
      agents: '/api/agents',
    },
  });
});

// Quick Health Check for Cloud Hosting (Render, Railway, Fly, AWS, etc.)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'heytam-agents-backend',
    role: 'slave-agents-workforce-engine',
    version: '2.3.0',
    orchestrator: 'external (heytam-core)',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessesRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/agents', agentsRoutes);

// ─── Slave Execution & Dispatch Routes (heytam-core integration) ───────────────
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/slave', dispatchRoutes);

// Root /execute endpoint compatible with heytam-core's default cluster URLs
// e.g. CALLING_AGENT_URL=http://localhost:4000/execute?agent=calling
app.post('/execute', (req, res, next) => {
  (dispatchRoutes as any).handle(req, res, next);
});

// ─── Prometheus Metrics Endpoint (heytam-core integration) ─────────────────────
// Mirrors the /metrics endpoint on each agent pod in heytam-core
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', metricsRegistry.contentType);
  res.end(await metricsRegistry.getMetrics());
});

// Comprehensive System Diagnostics Endpoint
app.get('/api/system/health', async (req, res) => {
  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  const mongoDbName = process.env.MONGODB_DB || 'heytam-ai-agents';
  const openAiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;

  let mongoStatus: {
    connected: boolean;
    database?: string;
    latencyMs?: number;
    error?: string;
  } = { connected: false };

  try {
    const start = Date.now();
    const db = await getDb();
    await db.command({ ping: 1 });
    mongoStatus = {
      connected: true,
      database: mongoDbName,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    mongoStatus = {
      connected: false,
      database: mongoDbName,
      error: err?.message || 'Failed to connect to MongoDB',
    };
  }

  // heytam-core: dynamic AI backend status
  const modelConfig = getModelConfig();
  const modelValidation = validateModelConfig();

  res.json({
    status: 'ok',
    service: 'heytam-agents-backend',
    version: '2.3.0',
    timestamp: new Date().toISOString(),
    // heytam-core: Dynamic model backend (OPENAI | ANTHROPIC | COPILOT)
    aiBackend: {
      backend: modelConfig.backend,
      model: modelConfig.model,
      description: getModelDescription(),
      configured: modelValidation.valid,
      configError: modelValidation.error || null,
    },
    mongodb: mongoStatus,
    agents: {
      total: ALL_AGENT_IDS.length,
      list: ALL_AGENT_IDS,
    },
    // heytam-core: decentralized pod topology info
    architecture: {
      topology: 'pod-per-slave-agent',
      role: 'slave-agents-workforce-engine',
      orchestrator: {
        name: 'heytam-core',
        status: 'external',
        role: 'supervisor',
        url: process.env.HEYTAM_CORE_URL || 'http://localhost:3000',
        managedBy: 'heytam-core repository (Mastra AI)',
      },
      agentPods: [
        { name: 'HeyTam Orchestrator (heytam-core)', port: 3000, role: 'supervisor', status: 'external' },
        { name: 'Calling Agent Slave Pod', port: 4000, path: '/api/dispatch/calling/execute', role: 'telephony', status: 'running' },
        { name: 'Mail Agent Slave Pod', port: 4000, path: '/api/dispatch/mail/execute', role: 'communication', status: 'running' },
        { name: 'Marketing Agent Slave Pod', port: 4000, path: '/api/dispatch/marketing/execute', role: 'campaigns', status: 'running' },
        { name: 'Sales & Ops Slaves (30 agents)', port: 4000, path: '/api/slave/:agentId/execute', role: 'operations', status: 'running' },
      ],
      schedulerStatus: process.env.ENABLE_STANDALONE_SCHEDULER === 'true' ? 'running' : 'delegated-to-heytam-core',
      crmSignals: 'active',
      phiScrubber: 'enabled',
      prometheusMetrics: '/metrics',
    },
  });
});

// Database Live Read/Write Test Endpoint
app.post('/api/test/db', async (req, res) => {
  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  const mongoDbName = process.env.MONGODB_DB || 'heytam-ai-agents';

  if (!mongoUri) {
    return res.status(400).json({
      success: false,
      error: 'MongoDB connection string (DATABASE_URL) is not configured.',
    });
  }

  const start = Date.now();
  let client: MongoClient | null = null;
  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(mongoDbName);
    const collection = db.collection('test_diagnostics');

    const testId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const testDoc = {
      testId,
      source: 'Heytam Frontend Diagnostic Console',
      createdAt: new Date().toISOString(),
      metadata: req.body?.metadata || { note: 'Live verification test' },
    };

    const insertResult = await collection.insertOne(testDoc);
    const retrieved = await collection.findOne({ testId });
    const totalRecords = await collection.countDocuments();

    return res.json({
      success: true,
      message: 'MongoDB write and read verification succeeded!',
      latencyMs: Date.now() - start,
      database: mongoDbName,
      insertedId: insertResult.insertedId.toString(),
      record: retrieved,
      totalTestRecords: totalRecords,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Database test failed',
    });
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }
});

// Initialize DB indexes on startup
async function initIndexes() {
  try {
    const db = await getDb();
    await db.collection('businesses').createIndex({ email: 1 }, { unique: true });
    await db.collection('businesses').createIndex({ id: 1 }, { unique: true });
    await db.collection('business_tools').createIndex({ businessId: 1, toolId: 1 }, { unique: true });
    await db.collection('tool_configurations').createIndex({ businessId: 1, toolId: 1 }, { unique: true });
    await db.collection('workflows').createIndex({ businessId: 1, id: 1 });
    await db.collection('workflow_runs').createIndex({ businessId: 1, workflowId: 1 });
    await db.collection('workflow_runs').createIndex({ id: 1 }, { unique: true });
    await db.collection('workflow_runs').createIndex({ businessId: 1, createdAt: -1 });
    await db.collection('leads').createIndex({ tenantId: 1 });
    await db.collection('logs').createIndex({ tenantId: 1, timestamp: -1 });
    console.log('✅ MongoDB indexes created/verified');

  } catch (err) {
    console.warn('⚠️  Could not create MongoDB indexes:', err);
  }
}

const server = app.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`🚀 Heytam Agents Backend v2.3 running on http://0.0.0.0:${PORT}`);
  console.log(`📡 API Endpoints: http://0.0.0.0:${PORT}/api`);
  console.log(`🏥 Health Check: http://0.0.0.0:${PORT}/health`);
  console.log(`📊 Prometheus Metrics: http://0.0.0.0:${PORT}/metrics`);
  console.log(`🤖 Dispatch API: http://0.0.0.0:${PORT}/api/dispatch`);

  // Log dynamic AI backend config (heytam-core integration)
  const modelConfig = getModelConfig();
  const modelValidation = validateModelConfig();
  console.log(`🧠 AI Backend: ${getModelDescription()} [${modelValidation.valid ? '✅ Configured' : '⚠ ' + modelValidation.error}]`);

  await initIndexes();

  // ─── heytam-core: Start CRM Lead Signal Provider polling ──────────────
  // Polls CRM every 30 seconds for pending leads and routes to orchestrator
  crmLeadSignalProvider.on('signal', async (notification) => {
    console.log(`[CRM Signal] ${notification.kind} — ${notification.summary}`);

    // Auto-route based on signal kind
    const lead = notification.payload;
    const businessId = lead.businessId || 'system';

    try {
      if (notification.kind === 'lead-pending-call') {
        await orchestrateWorkflow({
          workflowId: `crm-signal-${Date.now()}`,
          businessId,
          workflowName: 'CRM Lead: Outbound Call',
          trigger: 'CRM Lead Signal',
          steps: [
            { order: 1, agentId: 'lead-concierge', agentName: 'Lead Concierge' },
            { order: 2, agentId: 'outbound-calling-agent', agentName: 'Outbound Calling Agent' },
          ],
          triggerData: {
            recipientPhone: lead.phone,
            recipientEmail: lead.email,
            recipientName: lead.name,
            leadId: lead.id,
            source: lead.source,
          },
        });
        console.log(`[CRM Signal] ✅ Lead ${lead.id} routed to calling pipeline`);
      } else if (notification.kind === 'lead-pending-email') {
        await orchestrateWorkflow({
          workflowId: `crm-signal-${Date.now()}`,
          businessId,
          workflowName: 'CRM Lead: Email Follow-up',
          trigger: 'CRM Lead Signal',
          steps: [
            { order: 1, agentId: 'lead-qualifier', agentName: 'Lead Qualifier' },
            { order: 2, agentId: 'follow-up-agent', agentName: 'Follow-up Agent' },
          ],
          triggerData: {
            recipientEmail: lead.email,
            recipientName: lead.name,
            leadId: lead.id,
          },
        });
        console.log(`[CRM Signal] ✅ Lead ${lead.id} routed to email pipeline`);
      }
    } catch (err) {
      console.error(`[CRM Signal] ❌ Failed to route lead signal:`, err);
    }
  });

  // Start polling CRM every 30 seconds
  crmLeadSignalProvider.start(30000);

  // ─── Master Orchestrator Scheduler Delegation ─────────────────────────────
  // The HeyTam Master Orchestrator (heytam-core) hosts the enterprise cron schedules:
  // - 0 8 * * * (Daily marketing sync)
  // - */15 * * * * (High-priority email polling)
  // In heytam-agents-backend, standalone local scheduling is enabled only on demand.
  const enableStandaloneScheduler = process.env.ENABLE_STANDALONE_SCHEDULER === 'true';

  if (enableStandaloneScheduler) {
    cron.schedule('0 8 * * *', async () => {
      console.log('[Scheduler] ⏰ Executing daily marketing sync...');
      try {
        await orchestrateWorkflow({
          workflowId: `cron-marketing-${Date.now()}`,
          businessId: 'system',
          workflowName: 'Daily Marketing Sync',
          trigger: 'Cron: Daily 8:00 AM',
          steps: [
            { order: 1, agentId: 'campaign-agent', agentName: 'Marketing Optimization Agent' },
            { order: 2, agentId: 'growth-analyst', agentName: 'Growth Analyst' },
          ],
        });
        cronExecutionsTotal.labels({ task_type: 'marketing_sync', status: 'success' }).inc();
        console.log('[Scheduler] ✅ Daily marketing sync delegated successfully');
      } catch (error) {
        cronExecutionsTotal.labels({ task_type: 'marketing_sync', status: 'error' }).inc();
        console.error('[Scheduler] ❌ Failed to execute marketing sync:', error);
      }
    });

    cron.schedule('*/15 * * * *', async () => {
      console.log('[Scheduler] ⏰ Polling for high-priority unread emails...');
      try {
        await orchestrateWorkflow({
          workflowId: `cron-mail-${Date.now()}`,
          businessId: 'system',
          workflowName: 'Email Poll & Categorization',
          trigger: 'Cron: Every 15 Minutes',
          steps: [
            { order: 1, agentId: 'receptionist-agent', agentName: 'Receptionist Agent (Inbox)' },
          ],
        });
        cronExecutionsTotal.labels({ task_type: 'mail_poll', status: 'success' }).inc();
        console.log('[Scheduler] ✅ Email poll delegated successfully');
      } catch (error) {
        cronExecutionsTotal.labels({ task_type: 'mail_poll', status: 'error' }).inc();
        console.error('[Scheduler] ❌ Failed to poll emails:', error);
      }
    });

    cron.schedule('0 7 * * *', async () => {
      console.log('[Scheduler] ⏰ Running no-show prevention check...');
      try {
        await orchestrateWorkflow({
          workflowId: `cron-noshow-${Date.now()}`,
          businessId: 'system',
          workflowName: 'No-Show Prevention Check',
          trigger: 'Cron: Daily 7:00 AM',
          steps: [
            { order: 1, agentId: 'no-show-prevention-agent', agentName: 'No-Show Prevention Agent' },
          ],
        });
        cronExecutionsTotal.labels({ task_type: 'noshow_check', status: 'success' }).inc();
      } catch (error) {
        cronExecutionsTotal.labels({ task_type: 'noshow_check', status: 'error' }).inc();
        console.error('[Scheduler] ❌ Failed no-show check:', error);
      }
    });
    console.log('⏰ Standalone Scheduler: 3 local cron tasks registered');
  } else {
    console.log('ℹ HeyTam Master Orchestrator cron scheduler is delegated to heytam-core.');
    console.log('  (Local standalone scheduler is standby; set ENABLE_STANDALONE_SCHEDULER=true if running solo)');
  }

  console.log('📡 CRM Signal Provider: listening for lead webhooks');
});

// Graceful shutdown handling for container and process managers (Render, Railway, Docker, PM2)
function handleShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('✅ HTTP server closed. Process exiting.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

