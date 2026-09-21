/**
 * Heytam Master Orchestrator Engine
 * Coordinates all slave agents, manages handoffs, tracks real-time execution.
 * This is the brain of the AI workforce.
 */
import {
  createWorkflowRun,
  completeRun,
  appendOrchestratorLog,
  getWorkflowRun,
  type WorkflowRun,
} from '../db/workflowRun.store.js';
import { executeAgent } from './agent.executor.js';
import { getWorkflows } from '../db/workflow.store.js';

export interface OrchestratorRunOptions {
  workflowId: string;
  businessId: string;
  workflowName: string;
  trigger: string;
  steps: Array<{ order: number; agentId: string; agentName: string }>;
  triggerData?: Record<string, any>;
}

/**
 * Orchestrator's main run method — executes all workflow steps in sequence
 * with handoff support between slave agents.
 * Returns immediately with runId; execution happens asynchronously.
 */
export async function orchestrateWorkflow(options: OrchestratorRunOptions): Promise<{ runId: string }> {
  const { workflowId, businessId, workflowName, trigger, steps, triggerData } = options;

  // Create the run record
  const run = await createWorkflowRun({
    workflowId,
    businessId,
    workflowName,
    trigger,
    triggerData,
    steps,
  });

  const runId = run.id;

  // Execute asynchronously (don't await — return run ID immediately for real-time polling)
  runWorkflow(runId, businessId, steps, triggerData).catch(async (err) => {
    console.error('[Orchestrator Error]', err);
    await appendOrchestratorLog(runId, `[ERROR] Orchestrator encountered an error: ${err?.message}`);
    await completeRun(runId, 'failed', err?.message);
  });

  return { runId };
}

async function runWorkflow(runId: string, businessId: string, steps: Array<{ order: number; agentId: string; agentName: string }>, triggerData?: Record<string, any>) {
  let previousOutput = '';

  await appendOrchestratorLog(runId, `[Orchestrator] 🧠 Heytam Orchestrator activated — routing ${steps.length} agents`);

  // Log trigger data if it contains recipient info
  if (triggerData?.recipientEmail) {
    await appendOrchestratorLog(runId, `[Orchestrator] 📬 Recipient email: ${triggerData.recipientEmail}`);
  }
  if (triggerData?.recipientPhone) {
    await appendOrchestratorLog(runId, `[Orchestrator] 📱 Recipient phone: ${triggerData.recipientPhone}`);
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    await appendOrchestratorLog(
      runId,
      `[Orchestrator] Dispatching task to Agent ${step.order}: ${step.agentName} (${step.agentId})`
    );

    const result = await executeAgent({
      agentId: step.agentId,
      agentName: step.agentName,
      businessId,
      runId,
      stepOrder: step.order,
      input: previousOutput || `Workflow triggered`,
      context: { workflowStep: i + 1, totalSteps: steps.length },
      triggerData,
    });

    previousOutput = result.output;

    const realTag = result.realActionTaken ? '✅ [REAL]' : '⚠ [SIM]';
    await appendOrchestratorLog(
      runId,
      `[Orchestrator] ${realTag} ${step.agentName} completed in ${result.durationMs}ms`
    );

    if (result.handoffTo && !steps.find(s => s.agentId === result.handoffTo)) {
      await appendOrchestratorLog(
        runId,
        `[Orchestrator] 🔀 ${step.agentName} triggered inter-agent handoff → ${result.handoffTo} (ad-hoc)`
      );
    }

    await new Promise(r => setTimeout(r, 200));
  }

  await appendOrchestratorLog(runId, `[Orchestrator] 🎉 Workflow completed. All agents executed successfully.`);
  await completeRun(runId, 'completed', previousOutput);
}


/**
 * AI Workflow Suggester — Parses natural language and returns a structured workflow
 */
export function suggestWorkflow(prompt: string): {
  name: string;
  description: string;
  trigger: string;
  steps: Array<{ order: number; agentId: string; agentName: string }>;
  explanation: string;
  extractedTriggerData?: {
    recipientEmail?: string;
    recipientName?: string;
    message?: string;
    service?: string;
  };
} {
  const text = prompt.toLowerCase();

  // Extract email address if present in prompt
  const emailMatch = prompt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const extractedEmail = emailMatch ? emailMatch[0] : undefined;

  // Extract custom message if present in prompt
  let extractedMessage: string | undefined;
  const msgKeywords = ['message is', 'message:', 'saying', 'body is', 'body:'];
  for (const kw of msgKeywords) {
    if (text.includes(kw)) {
      const parts = prompt.split(new RegExp(kw, 'i'));
      if (parts[1]) {
        extractedMessage = parts[1].split(/(and\s+(set|book|schedule|create)|in\s+calender|in\s+calendar)/i)[0]?.trim();
        break;
      }
    }
  }

  // ─── 1. Email + Calendar / Reminder Intent ───────────────────────────────────
  if ((text.includes('email') || text.includes('mail')) && (text.includes('calender') || text.includes('calendar') || text.includes('remainder') || text.includes('reminder') || text.includes('schedule') || text.includes('book'))) {
    return {
      name: 'Email & Calendar Reminder Flow',
      description: `Sends email${extractedEmail ? ` to ${extractedEmail}` : ''} and sets a reminder in the calendar.`,
      trigger: 'Manual / On-demand Trigger',
      explanation: `I've constructed a clean 2-step automation based on your request. Step 1: Follow-up Agent sends your email${extractedEmail ? ` to ${extractedEmail}` : ''}${extractedMessage ? ` with message: "${extractedMessage}"` : ''}. Step 2: Booking Agent schedules the reminder in your calendar. No calling agents are included.`,
      steps: [
        { order: 1, agentId: 'follow-up-agent', agentName: 'Follow-up Agent (Email)' },
        { order: 2, agentId: 'booking-agent', agentName: 'Booking Agent (Calendar)' },
      ],
      extractedTriggerData: {
        recipientEmail: extractedEmail || 'shivamawasthi1129@gmail.com',
        recipientName: extractedEmail ? extractedEmail.split('@')[0] : 'Shivam Awasthi',
        message: extractedMessage || 'Hi from the Heytam server',
        service: 'Calendar Reminder & Follow-Up',
      },
    };
  }

  // ─── 2. Direct Email-Only Intent ─────────────────────────────────────────────
  if (text.includes('email') && !text.includes('call') && !text.includes('phone') && !text.includes('sms')) {
    return {
      name: 'Direct Email Dispatch Flow',
      description: `Sends personalized email${extractedEmail ? ` to ${extractedEmail}` : ''}.`,
      trigger: 'Manual / Event Trigger',
      explanation: `Step 1 uses the Follow-up Agent to compose and send your email directly via SMTP or Google OAuth.`,
      steps: [
        { order: 1, agentId: 'follow-up-agent', agentName: 'Follow-up Agent (Email)' },
      ],
      extractedTriggerData: {
        recipientEmail: extractedEmail || 'shivamawasthi1129@gmail.com',
        recipientName: extractedEmail ? extractedEmail.split('@')[0] : 'Shivam Awasthi',
        message: extractedMessage || 'Hi from the Heytam server',
        service: 'Direct Email Communication',
      },
    };
  }

  // ─── 3. No-Show & Cancellations ──────────────────────────────────────────────
  if (text.includes('no-show') || text.includes('cancel') || text.includes('missed')) {
    return {
      name: 'No-show Recovery Flow',
      description: 'Handles cancellations by filling slots from the waitlist and sending recovery messages.',
      trigger: 'When an appointment is canceled or patient is marked no-show',
      explanation: 'Step 1: No-Show Prevention confirms no-show. Step 2: Waitlist Agent fills the slot. Step 3: Follow-up Agent reaches out to reschedule.',
      steps: [
        { order: 1, agentId: 'no-show-prevention-agent', agentName: 'No-Show Prevention' },
        { order: 2, agentId: 'waitlist-agent', agentName: 'Waitlist Agent' },
        { order: 3, agentId: 'follow-up-agent', agentName: 'Follow-up Agent' },
      ],
    };
  }

  // ─── 4. New Lead Nurture Pipeline ───────────────────────────────────────────
  if ((text.includes('new lead') || text.includes('contact form') || text.includes('inquiry')) && (text.includes('book') || text.includes('qualify'))) {
    return {
      name: 'New Lead → Booking Pipeline',
      description: 'Qualifies incoming leads and books them into consultation appointments.',
      trigger: 'When a new lead is received (form, web chat, etc.)',
      explanation: 'Step 1: Lead Qualifier classifies intent. Step 2: Follow-up Agent sends personalized email. Step 3: Booking Agent reserves calendar slot.',
      steps: [
        { order: 1, agentId: 'lead-qualifier', agentName: 'Lead Qualifier' },
        { order: 2, agentId: 'follow-up-agent', agentName: 'Follow-up Agent' },
        { order: 3, agentId: 'booking-agent', agentName: 'Booking Agent' },
      ],
    };
  }

  // ─── 5. Post-Treatment Care ───────────────────────────────────────────────────
  if (text.includes('post') || text.includes('after') || text.includes('treatment') || text.includes('consult')) {
    return {
      name: 'Post-Treatment Care Flow',
      description: 'Delivers after-care, collects reviews, and books the next appointment.',
      trigger: 'When an appointment or consultation is completed',
      explanation: 'Post-Treatment Agent sends after-care instructions. Review Agent requests a 5-star Google review. Rebooking Agent proactively schedules the next appointment.',
      steps: [
        { order: 1, agentId: 'post-treatment-agent', agentName: 'Post-Treatment Agent' },
        { order: 2, agentId: 'review-agent', agentName: 'Review Agent' },
        { order: 3, agentId: 'rebooking-agent', agentName: 'Rebooking Agent' },
      ],
    };
  }

  // ─── 6. Reactivation ─────────────────────────────────────────────────────────
  if (text.includes('reactivat') || text.includes('dormant') || text.includes('win back') || text.includes('inactive') || text.includes('haven\'t visited') || text.includes('lapsed')) {
    return {
      name: 'Patient Reactivation Campaign',
      description: 'Identifies dormant patients and re-engages them with a tailored offer.',
      trigger: 'When a patient has been inactive for 90+ days (daily scan)',
      explanation: 'Reactivation Agent identifies dormant patients and sends win-back emails. Follow-up Agent nurtures responses. Booking Agent confirms appointments.',
      steps: [
        { order: 1, agentId: 'reactivation-agent', agentName: 'Reactivation Agent' },
        { order: 2, agentId: 'follow-up-agent', agentName: 'Follow-up Agent' },
        { order: 3, agentId: 'booking-agent', agentName: 'Booking Agent' },
      ],
    };
  }

  // ─── 7. Reviews ──────────────────────────────────────────────────────────────
  if (text.includes('review') || text.includes('google') || text.includes('reputation') || text.includes('5-star')) {
    return {
      name: 'Review Generation Flow',
      description: 'Automatically requests 5-star reviews after every positive interaction.',
      trigger: 'After appointment completion',
      explanation: 'Review Agent sends Google Business review link. Follow-up Agent provides dedicated follow-up.',
      steps: [
        { order: 1, agentId: 'review-agent', agentName: 'Review Agent' },
        { order: 2, agentId: 'follow-up-agent', agentName: 'Follow-up Agent' },
      ],
    };
  }

  // ─── 8. Voice & Calling (Only if explicitly requested) ────────────────────────
  if (text.includes('call') || text.includes('phone') || text.includes('dial')) {
    return {
      name: 'Voice Calling & Booking Flow',
      description: 'Places outbound voice call and books confirmed consultations.',
      trigger: 'When an outbound calling task is triggered',
      explanation: 'Outbound Calling Agent dials contact via Twilio/VoIP. Booking Agent records appointment details.',
      steps: [
        { order: 1, agentId: 'outbound-calling-agent', agentName: 'Outbound Calling Agent' },
        { order: 2, agentId: 'booking-agent', agentName: 'Booking Agent' },
      ],
    };
  }

  // ─── Generic Fallback (Defaults to Email + Follow-up, NOT calling) ────────────
  const agentSteps: Array<{ order: number; agentId: string; agentName: string }> = [
    { order: 1, agentId: 'follow-up-agent', agentName: 'Follow-up Agent (Email)' },
  ];

  if (text.includes('book') || text.includes('calendar') || text.includes('schedule') || text.includes('remainder') || text.includes('reminder')) {
    agentSteps.push({ order: 2, agentId: 'booking-agent', agentName: 'Booking Agent (Calendar)' });
  }

  return {
    name: prompt.length > 40 ? prompt.slice(0, 40) + '...' : prompt,
    description: `Custom workflow: ${prompt}`,
    trigger: 'Manual trigger',
    explanation: `I've created a tailored ${agentSteps.length}-step workflow using Follow-up Agent${agentSteps.length > 1 ? ' and Booking Agent' : ''}.`,
    steps: agentSteps,
    extractedTriggerData: {
      recipientEmail: extractedEmail || 'shivamawasthi1129@gmail.com',
      recipientName: extractedEmail ? extractedEmail.split('@')[0] : 'Shivam Awasthi',
      message: extractedMessage || 'Hi from the Heytam server',
      service: 'Follow-up & Calendar Task',
    },
  };
}

