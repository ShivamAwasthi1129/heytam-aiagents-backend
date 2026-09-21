/**
 * MongoDB Singleton Connection Manager — Backend
 */
import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  const dbName = process.env.MONGODB_DB || 'heytam-ai-agents';

  if (!uri) throw new Error('MONGODB_URI is not configured');

  client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(dbName);
  return db;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
