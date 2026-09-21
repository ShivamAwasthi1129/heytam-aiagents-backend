import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import dns from 'dns';
import { MongoClient } from 'mongodb';
import agentsRoutes from './routes/agents.routes.js';
import authRoutes from './routes/auth.routes.js';
import toolsRoutes from './routes/tools.routes.js';
import businessesRoutes from './routes/businesses.routes.js';
import workflowsRoutes from './routes/workflows.routes.js';
import { ALL_AGENT_IDS } from './tools/index.js';
import { getDb } from './db/mongodb.js';

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
    name: 'Heytam Autonomous AI Workforce Backend',
    version: '2.2.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      systemHealth: '/api/system/health',
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
    version: '2.2.0',
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

  res.json({
    status: 'ok',
    service: 'heytam-agents-backend',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    openai: {
      configured: Boolean(openAiKey),
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      maskedKey: openAiKey ? `${openAiKey.substring(0, 7)}...${openAiKey.slice(-4)}` : null,
    },
    mongodb: mongoStatus,
    agents: {
      total: ALL_AGENT_IDS.length,
      list: ALL_AGENT_IDS,
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
  console.log(`🚀 Heytam Agents Backend v2.2 running on http://0.0.0.0:${PORT}`);
  console.log(`📡 API Endpoints: http://0.0.0.0:${PORT}/api`);
  console.log(`🏥 Health Check: http://0.0.0.0:${PORT}/health`);
  await initIndexes();
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

