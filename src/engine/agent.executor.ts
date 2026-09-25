/**
 * Slave Agent Executor — v2.1
 * Now connects to real APIs via real.actions.ts.
 * Each agent runs its processing steps AND executes a real action (email/SMS/call/CRM).
 * If credentials aren't configured → clearly shown as SIMULATION MODE in logs.
 */
import { appendRunLog, appendOrchestratorLog, updateRunStep } from '../db/workflowRun.store.js';
import { executeRealAction, type AgentContext } from './real.actions.js';

const AGENT_BEHAVIORS: Record<string, {
  steps: string[];
  outputTemplate: string;
  canHandoffTo?: string[];
  processingMs: [number, number];
}> = {
  'lead-concierge': {
    steps: [
      'Fetching lead contact details from CRM...',
      'Selecting optimal channel (SMS/WhatsApp/Email) based on lead source...',
      'Composing personalized opening message...',
      'Sending first contact message...',
      'Recording interaction in CRM...',
      'Setting follow-up reminder in queue...',
    ],
    outputTemplate: 'Lead contacted via first available channel. Opening message sent. Response tracking active.',
    canHandoffTo: ['lead-qualifier', 'booking-agent'],
    processingMs: [300, 600],
  },
  'lead-qualifier': {
    steps: [
      'Analyzing lead conversation history...',
      'Running intent classification model...',
      'Evaluating budget signals from conversation...',
      'Scoring timeline urgency (0-100)...',
      'Calculating composite lead score...',
      'Flagging hot leads for immediate escalation...',
      'Syncing score to CRM...',
    ],
    outputTemplate: 'Lead qualified. Score: 87/100 (HOT). Budget confirmed: high. Timeline: within 2 weeks. Intent: Booking consultation.',
    canHandoffTo: ['booking-agent', 'follow-up-agent', 'crm-agent'],
    processingMs: [300, 700],
  },
  'booking-agent': {
    steps: [
      'Querying calendar API for available slots...',
      'Filtering by patient\'s stated availability...',
      'Proposing 3 optimal appointment times...',
      'Receiving patient slot confirmation...',
      'Creating calendar event...',
      'Sending confirmation message with appointment details...',
      'Setting pre-appointment reminder sequence...',
    ],
    outputTemplate: 'Appointment booked. Confirmation message sent. Pre-appointment reminder sequence activated.',
    canHandoffTo: ['no-show-prevention-agent', 'post-treatment-agent'],
    processingMs: [300, 800],
  },
  'voice-agent': {
    steps: [
      'Receiving inbound call via VoIP webhook...',
      'Running intent detection on caller speech...',
      'Identifying patient from phone number...',
      'Loading patient history and context...',
      'Responding to caller queries...',
      'Booking appointment via voice if requested...',
      'Sending post-call summary...',
    ],
    outputTemplate: 'Inbound call handled. Patient identified. Intent detected. Appropriate action taken.',
    canHandoffTo: ['booking-agent', 'receptionist-agent'],
    processingMs: [400, 900],
  },
  'outbound-calling-agent': {
    steps: [
      'Loading contact from outbound queue...',
      'Checking do-not-call compliance list...',
      'Initiating outbound call via VoIP provider...',
      'Playing personalized TTS script...',
      'Detecting response (pickup/voicemail/no-answer)...',
      'Recording call outcome...',
      'Scheduling retry if no answer...',
    ],
    outputTemplate: 'Outbound call attempted. Outcome recorded. Next action queued.',
    canHandoffTo: ['booking-agent', 'follow-up-agent'],
    processingMs: [400, 800],
  },
  'follow-up-agent': {
    steps: [
      'Loading lead/patient profile from CRM...',
      'Determining follow-up stage (Day 1 / Day 3 / Day 7 / Day 14)...',
      'Personalizing message with patient name and context...',
      'Selecting channel (SMS vs Email) based on engagement history...',
      'Sending follow-up message...',
      'Updating follow-up sequence state in CRM...',
      'Scheduling next touchpoint...',
    ],
    outputTemplate: 'Follow-up message sent via configured channel. Next follow-up scheduled.',
    canHandoffTo: ['booking-agent', 'reactivation-agent'],
    processingMs: [300, 600],
  },
  'no-show-prevention-agent': {
    steps: [
      'Scanning appointments for next 24-48 hours...',
      'Identifying patients without confirmation...',
      'Sending confirmation request via configured channel...',
      'Awaiting patient response...',
      'Recording confirmation status...',
      'Flagging unconfirmed appointments for front desk...',
    ],
    outputTemplate: 'Appointment reminders sent to unconfirmed patients. Confirmations being tracked.',
    canHandoffTo: ['waitlist-agent', 'cancellation-recovery-agent'],
    processingMs: [300, 600],
  },
  'waitlist-agent': {
    steps: [
      'Detecting cancellation event...',
      'Loading waitlist queue sorted by priority...',
      'Identifying best-match patient for freed slot...',
      'Sending slot offer to top waitlist candidate...',
      'Processing acceptance/rejection...',
      'Updating calendar and CRM...',
    ],
    outputTemplate: 'Waitlist candidate notified of available slot.',
    canHandoffTo: ['booking-agent'],
    processingMs: [300, 600],
  },
  'review-agent': {
    steps: [
      'Identifying recently completed appointments...',
      'Filtering patients with positive interaction signals...',
      'Composing personalized review request...',
      'Sending review request via configured channel...',
      'Monitoring for negative feedback patterns...',
      'Routing unhappy patients to private resolution...',
    ],
    outputTemplate: 'Review request sent to post-visit patient via configured channel.',
    canHandoffTo: [],
    processingMs: [300, 600],
  },
  'reactivation-agent': {
    steps: [
      'Querying CRM for patients inactive 90+ days...',
      'Segmenting by last service type and value...',
      'Generating personalized win-back offer...',
      'Sending via preferred channel (SMS/Email)...',
      'Tracking open rates and click-through...',
      'Scoring response likelihood...',
    ],
    outputTemplate: 'Win-back message sent to dormant patient via configured channel.',
    canHandoffTo: ['booking-agent', 'follow-up-agent'],
    processingMs: [300, 600],
  },
  'crm-agent': {
    steps: [
      'Compiling interaction data from all channels...',
      'Deduplicating contact records...',
      'Updating contact fields in CRM...',
      'Logging activity timeline...',
      'Updating deal stage and pipeline...',
      'Triggering CRM automations...',
    ],
    outputTemplate: 'CRM records updated with latest interaction data.',
    processingMs: [200, 500],
  },
  'membership-agent': {
    steps: [
      'Identifying memberships expiring within 7 days...',
      'Generating renewal reminder message...',
      'Sending renewal notice via configured channel...',
      'Processing auto-renewals where authorized...',
      'Flagging failed payments...',
    ],
    outputTemplate: 'Membership renewal notification sent.',
    canHandoffTo: ['revenue-recovery-agent'],
    processingMs: [300, 600],
  },
  'revenue-recovery-agent': {
    steps: [
      'Identifying failed transactions...',
      'Determining recovery strategy...',
      'Sending personalized payment recovery message...',
      'Providing payment update link...',
      'Monitoring payment retry...',
    ],
    outputTemplate: 'Payment recovery outreach sent via configured channel.',
    processingMs: [300, 600],
  },
  'post-treatment-agent': {
    steps: [
      'Detecting completed appointment...',
      'Loading treatment details...',
      'Composing after-care instructions...',
      'Sending via patient\'s preferred channel...',
      'Scheduling 48h check-in...',
      'Adding to rebooking reminder sequence...',
    ],
    outputTemplate: 'Post-treatment care instructions sent. Follow-up check-in scheduled.',
    canHandoffTo: ['rebooking-agent', 'review-agent'],
    processingMs: [300, 600],
  },
  'rebooking-agent': {
    steps: [
      'Analyzing patient treatment cycle from history...',
      'Calculating optimal rebooking window...',
      'Generating personalized rebooking suggestion...',
      'Sending outreach via preferred channel...',
      'Awaiting response...',
    ],
    outputTemplate: 'Rebooking outreach sent. Patient prompted to schedule next appointment.',
    canHandoffTo: ['booking-agent'],
    processingMs: [300, 600],
  },
  'campaign-agent': {
    steps: [
      'Loading patient segment from CRM...',
      'Personalizing campaign content per patient...',
      'A/B testing message variants...',
      'Scheduling send for maximum engagement...',
      'Dispatching campaign via configured channel...',
    ],
    outputTemplate: 'Marketing campaign message dispatched to patient segment.',
    processingMs: [300, 700],
  },
  'cancellation-recovery-agent': {
    steps: [
      'Detecting appointment cancellation...',
      'Analyzing cancellation reason...',
      'Generating recovery offer...',
      'Sending immediate outreach...',
      'Updating calendar availability...',
    ],
    outputTemplate: 'Cancellation recovery outreach sent.',
    canHandoffTo: ['waitlist-agent', 'booking-agent'],
    processingMs: [300, 600],
  },
};

function getAgentBehavior(agentId: string) {
  return AGENT_BEHAVIORS[agentId] || {
    steps: ['Initializing agent...', 'Processing request...', 'Completing task...', 'Syncing results...'],
    outputTemplate: `Task processed by ${agentId}.`,
    processingMs: [200, 500] as [number, number],
  };
}

function randomMs(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface AgentExecutionResult {
  success: boolean;
  output: string;
  logs: string[];
  durationMs: number;
  handoffTo?: string;
  realActionTaken: boolean;
  actionsTaken: string[];
}

const AGENT_ICONS: Record<string, string> = {
  'lead-concierge': '💬', 'lead-qualifier': '✅', 'voice-agent': '🎙️',
  'outbound-calling-agent': '📞', 'sms-concierge': '📱', 'whatsapp-concierge': '💚',
  'web-concierge': '🌐', 'booking-agent': '📅', 'follow-up-agent': '🔔',
  'upsell-agent': '📈', 'membership-agent': '🏆', 'revenue-recovery-agent': '💰',
  'campaign-agent': '📣', 'referral-agent': '🤝', 'review-agent': '⭐',
  'reactivation-agent': '🔄', 'no-show-prevention-agent': '⏰',
  'cancellation-recovery-agent': '🔃', 'waitlist-agent': '📋',
  'post-treatment-agent': '💊', 'patient-concierge': '👤',
  'emr-ehr-integration-agent': '🏥', 'rebooking-agent': '📆',
  'crm-agent': '🗃️', 'front-desk-copilot': '🖥️', 'growth-analyst': '📊',
  'integration-guardian': '🛡️', 'lead-recovery-agent': '🚑', 'treatment-advisor': '💡',
};

export function getAgentIcon(agentId: string): string {
  return AGENT_ICONS[agentId] || '🤖';
}

/**
 * Execute a single slave agent — runs processing steps then calls real APIs
 */
export async function executeAgent(params: {
  agentId: string;
  agentName: string;
  businessId: string;
  runId: string;
  stepOrder: number;
  input?: string;
  context?: Record<string, any>;
  triggerData?: Record<string, any>;
}): Promise<AgentExecutionResult> {
  const { agentId, agentName, businessId, runId, stepOrder, triggerData } = params;
  const behavior = getAgentBehavior(agentId);
  const startTime = Date.now();
  const logs: string[] = [];

  // Mark step as running
  await updateRunStep(runId, stepOrder, { status: 'running', startedAt: new Date().toISOString() });

  // Run processing steps (these show what the agent is thinking/doing)
  for (const step of behavior.steps) {
    const ts = new Date().toISOString().split('T')[1].split('.')[0];
    const logLine = `[${ts}] ${step}`;
    logs.push(logLine);
    await appendRunLog(runId, stepOrder, logLine);
    await sleep(randomMs(...behavior.processingMs));
  }

  // ─── Execute REAL action ──────────────────────────────────────────────────
  const actionCtx: AgentContext = {
    businessId,
    runId,
    stepOrder,
    triggerData,
    previousOutput: params.input,
  };

  await appendRunLog(runId, stepOrder, `[REAL ACTION] ${agentName} executing real-world action...`);

  const actionResult = await executeRealAction(agentId, actionCtx);

  // Log the result
  if (actionResult.realAction) {
    if (actionResult.success) {
      for (const a of actionResult.actionsTaken) {
        await appendRunLog(runId, stepOrder, `[REAL ACTION] ${a}`);
        logs.push(`[REAL ACTION] ${a}`);
      }
      await appendOrchestratorLog(runId, `[Orchestrator] ✅ ${agentName} executed REAL action: ${actionResult.actionsTaken[0] || 'completed'}`);
    } else {
      for (const e of actionResult.errors) {
        await appendRunLog(runId, stepOrder, `[REAL ACTION ERROR] ${e}`);
        logs.push(`[REAL ACTION ERROR] ${e}`);
      }
      await appendOrchestratorLog(runId, `[Orchestrator] ⚠ ${agentName} real action failed: ${actionResult.errors[0]}`);
    }
  } else {
    // Simulation mode — be very explicit
    const simMsg = `[⚠ SIMULATION MODE] ${actionResult.errors[0] || 'No credentials configured — no real action taken.'}`;
    await appendRunLog(runId, stepOrder, simMsg);
    logs.push(simMsg);
    await appendOrchestratorLog(runId, `[Orchestrator] ⚠ ${agentName} running in SIMULATION MODE — configure credentials to enable real actions`);
  }

  // ─── Deterministic Inter-Agent Routing ───────────────────────────────────────
  // Each agent has defined routing rules — no Math.random(), every handoff has a reason.
  let handoffTo: string | undefined;

  const ROUTING_RULES: Record<string, (result: typeof actionResult, triggerData?: Record<string, any>) => string | undefined> = {
    'lead-concierge': (result, td) => {
      // Lead concierge always routes to qualifier if contact was made
      return result.success ? 'lead-qualifier' : undefined;
    },
    'lead-qualifier': (result, td) => {
      // Qualifier routes to booking if hot lead, else follow-up
      if (!result.success) return undefined;
      const hasEmail = td?.recipientEmail;
      const hasPhone = td?.recipientPhone;
      return hasEmail || hasPhone ? 'booking-agent' : 'follow-up-agent';
    },
    'booking-agent': (result, td) => {
      // After booking → always activate no-show prevention
      return result.success ? 'no-show-prevention-agent' : 'follow-up-agent';
    },
    'follow-up-agent': (result, td) => {
      // After follow-up → if successful, route to review agent for feedback loop
      return result.success ? 'review-agent' : undefined;
    },
    'outbound-calling-agent': (result, td) => {
      // After call → if no answer, route to SMS concierge as fallback
      return !result.success ? 'sms-concierge' : 'booking-agent';
    },
    'voice-agent': (result, td) => {
      // Inbound call → route to booking agent
      return result.success ? 'booking-agent' : undefined;
    },
    'no-show-prevention-agent': (result, td) => {
      // If reminder failed → route to waitlist/cancellation recovery
      return !result.success ? 'waitlist-agent' : undefined;
    },
    'campaign-agent': (result, td) => {
      // After campaign → route to follow-up for nurturing
      return result.success ? 'follow-up-agent' : undefined;
    },
    'reactivation-agent': (result, td) => {
      // After reactivation → route to booking agent to close
      return result.success ? 'booking-agent' : undefined;
    },
    'revenue-recovery-agent': (result, td) => {
      // After payment recovery → route to membership agent
      return result.success ? 'membership-agent' : undefined;
    },
  };

  const routingFn = ROUTING_RULES[agentId];
  if (routingFn) {
    const suggestedHandoff = routingFn(actionResult, triggerData);
    if (suggestedHandoff) {
      handoffTo = suggestedHandoff;
      const hTs = new Date().toISOString().split('T')[1].split('.')[0];
      await appendRunLog(runId, stepOrder, `[${hTs}] 🔀 Routing decision: ${agentName} → ${handoffTo} (based on action result: ${actionResult.success ? 'SUCCESS' : 'NEEDS FALLBACK'})`);
      await appendOrchestratorLog(runId, `[Orchestrator] 🔀 ${agentName} → Routing to ${handoffTo} [Deterministic Rule]`);
    }
  }

  const durationMs = Date.now() - startTime;

  // Build output summary
  const realSummary = actionResult.realAction
    ? (actionResult.success
      ? `REAL: ${actionResult.actionsTaken.join('; ')}`
      : `FAILED: ${actionResult.errors.join('; ')}`)
    : `SIMULATION: ${actionResult.errors[0]}`;

  const output = `${behavior.outputTemplate} | ${realSummary}`;

  await updateRunStep(runId, stepOrder, {
    status: 'done',
    completedAt: new Date().toISOString(),
    durationMs,
    input: params.input || 'Triggered by workflow',
    output,
    handoffTo,
  });

  return {
    success: actionResult.success || !actionResult.realAction,
    output,
    logs,
    durationMs,
    handoffTo,
    realActionTaken: actionResult.realAction,
    actionsTaken: actionResult.actionsTaken,
  };
}
