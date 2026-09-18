import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import dns from 'dns';
import { MongoClient } from 'mongodb';
import agentsRoutes from './routes/agents.routes.js';
import { ALL_AGENT_IDS } from './tools/index.js';

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

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/agents', agentsRoutes);

// Quick Health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'heytam-agents-backend',
    timestamp: new Date().toISOString(),
  });
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

  if (mongoUri) {
    const start = Date.now();
    let client: MongoClient | null = null;
    try {
      client = new MongoClient(mongoUri);
      await client.connect();
      // Ping the database
      await client.db(mongoDbName).command({ ping: 1 });
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
    } finally {
      if (client) {
        await client.close().catch(() => {});
      }
    }
  } else {
    mongoStatus = {
      connected: false,
      error: 'No DATABASE_URL or MONGODB_URI configured in .env / .env.local',
    };
  }

  res.json({
    status: 'ok',
    service: 'heytam-agents-backend',
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

    // 1. Insert
    const insertResult = await collection.insertOne(testDoc);

    // 2. Read back
    const retrieved = await collection.findOne({ testId });

    // 3. Count documents in collection
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

app.listen(PORT, () => {
  console.log(`Heytam Agents Backend is running on port ${PORT}`);
});
