/**
 * Heytam AI Master Orchestrator — Universal Data Router
 * Reads raw data from ANY source, normalizes it, and routes to the correct slave AI agent.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys, ALL_AGENT_IDS } from '../tools/index.js';
import { z } from 'zod';
import { defineTool } from '../tools/tool-helper.js';

export const masterOrchestratorInfo = {
  id: 'master-orchestrator',
  name: 'Heytam AI Master Orchestrator',
  role: 'Master AI Orchestration',
  description: 'Central intelligence router: reads raw data from any source, determines intent, and dispatches tasks to the correct slave AI agents.',
};

// The orchestrator outputs a routing decision
const routingDecisionTool = defineTool({
  description: 'ALWAYS call this as your LAST action to output a structured routing decision for the slave agent system.',
  parameters: z.object({
    chainOfThought: z.string().describe('Step-by-step reasoning: What is the data source? What is the intent? What action was taken or needed?'),
    intentSummary: z.string().describe('A clean, normalized summary of what needs to be done — passed directly to the slave agents as their input.'),
    targetAgent: z.enum(ALL_AGENT_IDS).describe('The primary slave agent assigned to this task.'),
    assignedSlaveAgents: z.array(z.string()).optional().describe('List of all slave agents required/assigned for this multi-step task (e.g. ["lead-concierge", "voice-agent"]).'),
    executedActions: z.array(z.string()).optional().describe('List of tools/actions executed during orchestration (e.g. ["sendEmail: sent message", "makeVoiceCall: called +91..."]).'),
    missingKeys: z.array(z.string()).optional().describe('List of missing API keys or credentials needed to execute any part of the request (e.g. ["twilioAccountSid", "smtpHost"]).'),
    handoffReason: z.string().describe('Why this specific agent or group of agents was selected.'),
    extractedPayload: z.record(z.string(), z.any()).describe('Clean structured data from the raw input (name, phone, email, intent, dates, requestedActions, etc.).'),
    urgency: z.enum(['immediate', 'high', 'normal', 'low']).describe('How urgently this needs to be handled.'),
  }),
  execute: async (args) => args,
});

export async function runMasterOrchestrator(
  rawInput: any,
  tenantContext: string = 'Generic Business',
  tenantKeys: TenantKeys = {}
) {
  const timestamp = new Date().toISOString();
  const stringifiedInput = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput, null, 2);

  const orchestratorModelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const model = tenantKeys.openaiApiKey
    ? createOpenAI({ apiKey: tenantKeys.openaiApiKey })(orchestratorModelName)
    : openai(orchestratorModelName);

  const tools = {
    ...createAgentTools(tenantKeys),
    routingDecision: routingDecisionTool,
  };

  try {
    const result = await generateText({
      model,
      tools: tools as any,
      stopWhen: ({ stepCount }: any) => stepCount >= 10,
      system: `You are the Heytam AI Master Orchestrator & Central Intelligence Hub for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR DUAL OBJECTIVE (BRAIN & HAND):
1. BRAIN: Analyze raw incoming inputs from any source. Identify all requested tasks, extract structured details (name, email, phone, actions), identify ALL required slave AI agents, and detect if any API keys/credentials are missing.
2. HAND: If the user request demands real actions (e.g., sending an email, sending an SMS, making a voice call, querying a DB), YOU MUST EXECUTE THE CORRESPONDING AVAILABLE TOOLS (sendEmail, sendSms, makeVoiceCall, etc.) STEP-BY-STEP directly during this orchestration session!

MULTI-TASK & MULTI-AGENT WORKFLOW:
When given a multi-part prompt (e.g., "Send an email/message to X and then call phone number Y"):
Step 1: Extract all contact info (name, email, phone number) and requested messages.
Step 2: Identify which slave agents correspond to these tasks (e.g. 'lead-concierge' or 'sms-concierge' for email/SMS, 'voice-agent' for outbound phone calls).
Step 3: Call available tools step-by-step (e.g., call sendEmail or sendSms first, then call makeVoiceCall).
Step 4: If any tool returns an error due to missing tenant keys (e.g. missing Twilio SID, missing SMTP host), collect those in the 'missingKeys' array parameter.
Step 5: Record all attempted/executed steps in 'executedActions' and all assigned agents in 'assignedSlaveAgents'.
Step 6: MANDATORY: Always conclude by calling the 'routingDecision' tool.

SLAVE AGENT DIRECTORY:
- 'lead-concierge': Inbound lead / initial email / messaging engagement.
- 'voice-agent': Outbound phone calls and voice conversations.
- 'sms-concierge': SMS text message communication.
- 'whatsapp-concierge': WhatsApp chat outreach.
- 'booking-agent': Scheduling & appointment management.
- 'follow-up-agent': Multi-touch re-engagement for quiet leads.
- 'receptionist-agent': Processing call transcripts & front-desk inquiries.
- 'review-agent': Collecting feedback and review requests.
- 'crm-agent': Managing contact logs and notes.

MANDATORY: Your LAST action MUST be calling the routingDecision tool.`,
      prompt: `RAW INCOMING REQUEST:\n\n${stringifiedInput}\n\nUnderstand the flow, execute required tools step-by-step, assign the appropriate slave agents, check for missing keys if needed, and output your routing decision.`,
    });

    let routing;
    const allSteps = result.steps || [];
    for (const step of [...allSteps].reverse()) {
      const finalToolResult = (step.toolResults || []).find((t: any) => t.toolName === 'routingDecision');
      if (finalToolResult) { routing = (finalToolResult as any)?.output ?? (finalToolResult as any)?.result; break; }
    }
    if (!routing) {
      routing = {
        chainOfThought: 'Could not determine routing.',
        intentSummary: stringifiedInput,
        targetAgent: 'lead-concierge',
        assignedSlaveAgents: ['lead-concierge'],
        executedActions: [],
        missingKeys: [],
        handoffReason: 'Defaulted to Lead Concierge.',
        extractedPayload: {},
        urgency: 'normal',
      };
    }

    return {
      agentName: masterOrchestratorInfo.name,
      agentRole: masterOrchestratorInfo.role,
      rawInput, routingDecision: routing, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: masterOrchestratorInfo.name,
      agentRole: masterOrchestratorInfo.role,
      rawInput,
      routingDecision: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}
