/**
 * Workflow Run Store — Persists real-time execution logs per workflow run
 */
import { getDb } from './mongodb.js';

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'handoff';

export interface WorkflowRunStep {
  order: number;
  agentId: string;
  agentName: string;
  agentIcon: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  input?: string;
  output?: string;
  handoffTo?: string;
  logs: string[];
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  businessId: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed';
  trigger: string;
  triggerData?: Record<string, any>;
  steps: WorkflowRunStep[];
  orchestratorLog: string[];
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  result?: string;
  createdAt: string;
}

const AGENT_ICONS: Record<string, string> = {
  'lead-concierge': '💬',
  'lead-qualifier': '✅',
  'voice-agent': '🎙️',
  'outbound-calling-agent': '📞',
  'receptionist-agent': '🏥',
  'sms-concierge': '📱',
  'whatsapp-concierge': '💚',
  'web-concierge': '🌐',
  'booking-agent': '📅',
  'follow-up-agent': '🔔',
  'upsell-agent': '📈',
  'membership-agent': '🏆',
  'revenue-recovery-agent': '💰',
  'campaign-agent': '📣',
  'referral-agent': '🤝',
  'review-agent': '⭐',
  'reactivation-agent': '🔄',
  'no-show-prevention-agent': '⏰',
  'cancellation-recovery-agent': '🔃',
  'waitlist-agent': '📋',
  'rebooking-agent': '📆',
  'post-treatment-agent': '💊',
  'patient-concierge': '👤',
  'emr-ehr-integration-agent': '🏥',
  'crm-agent': '🗃️',
  'front-desk-copilot': '🖥️',
  'growth-analyst': '📊',
  'integration-guardian': '🛡️',
  'lead-recovery-agent': '🚑',
  'treatment-advisor': '💡',
};

export function getAgentIcon(agentId: string): string {
  return AGENT_ICONS[agentId] || '🤖';
}

export async function createWorkflowRun(data: {
  workflowId: string;
  businessId: string;
  workflowName: string;
  trigger: string;
  triggerData?: Record<string, any>;
  steps: Array<{ order: number; agentId: string; agentName: string }>;
}): Promise<WorkflowRun> {
  const db = await getDb();
  const now = new Date().toISOString();

  const run: WorkflowRun = {
    id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workflowId: data.workflowId,
    businessId: data.businessId,
    workflowName: data.workflowName,
    status: 'running',
    trigger: data.trigger,
    triggerData: data.triggerData,
    steps: data.steps.map(s => ({
      order: s.order,
      agentId: s.agentId,
      agentName: s.agentName,
      agentIcon: getAgentIcon(s.agentId),
      status: 'pending',
      logs: [],
    })),
    orchestratorLog: [`[${now}] Heytam Orchestrator received trigger: ${data.trigger}`, `[${now}] Analyzing context and routing to ${data.steps.length} agents...`],
    startedAt: now,
    createdAt: now,
  };

  await db.collection('workflow_runs').insertOne(run as any);
  return run;
}

export async function updateRunStep(runId: string, stepOrder: number, update: Partial<WorkflowRunStep>): Promise<void> {
  const db = await getDb();
  const setFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(update)) {
    setFields[`steps.${stepOrder - 1}.${k}`] = v;
  }
  await db.collection('workflow_runs').updateOne({ id: runId }, { $set: setFields });
}

export async function appendRunLog(runId: string, stepOrder: number, message: string): Promise<void> {
  const db = await getDb();
  await db.collection('workflow_runs').updateOne(
    { id: runId },
    { $push: { [`steps.${stepOrder - 1}.logs`]: message as any } }
  );
}

export async function appendOrchestratorLog(runId: string, message: string): Promise<void> {
  const db = await getDb();
  await db.collection('workflow_runs').updateOne(
    { id: runId },
    { $push: { orchestratorLog: message as any } }
  );
}

export async function completeRun(runId: string, status: 'completed' | 'failed', result?: string): Promise<void> {
  const db = await getDb();
  const run = await db.collection('workflow_runs').findOne({ id: runId }) as any;
  const startedAt = run?.startedAt ? new Date(run.startedAt).getTime() : Date.now();
  const now = new Date().toISOString();
  await db.collection('workflow_runs').updateOne(
    { id: runId },
    { $set: { status, completedAt: now, totalDurationMs: Date.now() - startedAt, result: result || '' } }
  );
}

export async function getWorkflowRun(runId: string): Promise<WorkflowRun | null> {
  const db = await getDb();
  const doc = await db.collection('workflow_runs').findOne({ id: runId });
  return doc ? doc as unknown as WorkflowRun : null;
}

export async function getWorkflowRuns(workflowId: string, businessId: string, limit = 10): Promise<WorkflowRun[]> {
  const db = await getDb();
  const docs = await db.collection('workflow_runs')
    .find({ workflowId, businessId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs as unknown as WorkflowRun[];
}

export async function getBusinessRuns(businessId: string, limit = 20): Promise<WorkflowRun[]> {
  const db = await getDb();
  const docs = await db.collection('workflow_runs')
    .find({ businessId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs as unknown as WorkflowRun[];
}
