/**
 * Business Store — MongoDB CRUD for tenant businesses
 */
import { getDb } from './mongodb.js';
import bcrypt from 'bcryptjs';

export interface Business {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  passwordHash: string;
  phone: string;
  location: string;
  tone: string;
  services: string[];
  status: 'active' | 'trial' | 'paused';
  plan: {
    name: string;
    monthlyFee: number;
  };
  webhookKey: string;
  createdAt: string;
  updatedAt: string;
}

export async function createBusiness(data: {
  name: string;
  ownerName: string;
  email: string;
  password: string;
  phone: string;
  location: string;
  tone?: string;
  services?: string[];
}): Promise<Business> {
  const db = await getDb();
  const existing = await db.collection('businesses').findOne({ email: data.email.toLowerCase() });
  if (existing) throw new Error('A business with this email already exists.');

  const passwordHash = await bcrypt.hash(data.password, 12);
  const id = `biz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const webhookKey = `whk_${Math.random().toString(36).slice(2, 18)}`;

  const business: Business = {
    id,
    name: data.name,
    ownerName: data.ownerName,
    email: data.email.toLowerCase(),
    passwordHash,
    phone: data.phone,
    location: data.location,
    tone: data.tone || 'Professional, warm, and helpful',
    services: data.services || [],
    status: 'trial',
    plan: { name: 'Starter', monthlyFee: 0 },
    webhookKey,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.collection('businesses').insertOne(business as any);
  return business;
}

export async function findBusinessByEmail(email: string): Promise<Business | null> {
  const db = await getDb();
  const doc = await db.collection('businesses').findOne({ email: email.toLowerCase() });
  return doc ? (doc as unknown as Business) : null;
}

export async function findBusinessById(id: string): Promise<Business | null> {
  const db = await getDb();
  const doc = await db.collection('businesses').findOne({ id });
  return doc ? (doc as unknown as Business) : null;
}

export async function updateBusiness(id: string, updates: Partial<Business>): Promise<Business | null> {
  const db = await getDb();
  const updateData = { ...updates, updatedAt: new Date().toISOString() };
  await db.collection('businesses').updateOne({ id }, { $set: updateData });
  return findBusinessById(id);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function getBusinessStats(businessId: string): Promise<{
  activeTools: number;
  needsSetup: number;
  availableToAdd: number;
  totalTools: number;
  monthlySpend: number;
}> {
  const db = await getDb();
  const tools = await db.collection('business_tools').find({ businessId }).toArray();
  const active = tools.filter((t: any) => t.status === 'active').length;
  const needsSetup = tools.filter((t: any) => t.status === 'needs_setup').length;
  const monthlySpend = tools.reduce((sum: number, t: any) => sum + (t.monthlyFee || 0), 0);

  return {
    activeTools: active,
    needsSetup,
    availableToAdd: 30 - tools.length,
    totalTools: tools.length,
    monthlySpend,
  };
}
