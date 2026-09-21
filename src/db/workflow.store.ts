/**
 * Workflow Store — CRUD for multi-agent workflows
 */
import { getDb } from './mongodb.js';

export interface WorkflowStep {
  order: number;
  agentId: string;
  agentName: string;
  config?: Record<string, any>;
}

export interface Workflow {
  id: string;
  businessId: string;
  name: string;
  description: string;
  trigger: string;
  steps: WorkflowStep[];
  status: 'active' | 'paused' | 'draft';
  createdAt: string;
  updatedAt: string;
}

export async function createWorkflow(businessId: string, data: Omit<Workflow, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>): Promise<Workflow> {
  const db = await getDb();
  const workflow: Workflow = {
    id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    businessId,
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.collection('workflows').insertOne(workflow as any);
  return workflow;
}

export async function getWorkflows(businessId: string): Promise<Workflow[]> {
  const db = await getDb();
  const docs = await db.collection('workflows').find({ businessId }).sort({ createdAt: -1 }).toArray();
  return docs as unknown as Workflow[];
}

export async function updateWorkflow(businessId: string, workflowId: string, updates: Partial<Workflow>): Promise<Workflow | null> {
  const db = await getDb();
  await db.collection('workflows').updateOne(
    { id: workflowId, businessId },
    { $set: { ...updates, updatedAt: new Date().toISOString() } }
  );
  const doc = await db.collection('workflows').findOne({ id: workflowId, businessId });
  return doc ? (doc as unknown as Workflow) : null;
}

export async function deleteWorkflow(businessId: string, workflowId: string): Promise<void> {
  const db = await getDb();
  await db.collection('workflows').deleteOne({ id: workflowId, businessId });
}
