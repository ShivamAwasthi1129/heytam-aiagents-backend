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
    chainOfThought: z.string().describe('Step-by-step reasoning: What is the data source? What is the intent? What action is needed?'),
    intentSummary: z.string().describe('A clean, normalized summary of what needs to be done — passed directly to the slave agent as its input.'),
    targetAgent: z.enum(ALL_AGENT_IDS).describe('The specific slave agent that should handle this request.'),
    handoffReason: z.string().describe('Why this specific agent was selected.'),
    extractedPayload: z.record(z.string(), z.any()).describe('Clean structured data from the raw input (name, phone, email, intent, dates, etc.).'),
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

  const model = tenantKeys.openaiApiKey
    ? createOpenAI({ apiKey: tenantKeys.openaiApiKey })(process.env.OPENAI_MODEL || 'gpt-4o')
    : openai(process.env.OPENAI_MODEL || 'gpt-4o'); // Orchestrator uses smarter model

  const tools = {
    ...createAgentTools(tenantKeys),
    routingDecision: routingDecisionTool,
  };

  try {
    const result = await generateText({
      model,
      tools: tools as any,
      stopWhen: ({ stepCount }: any) => stepCount >= 8,
      system: `You are the Heytam AI Master Orchestrator for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: You are the BRAIN. You read all incoming data from ANY source (CRM webhook, Google Sheets, email inbox, SMS, API call, manual input), normalize it, and decide which slave agent should handle the task.

YOU DO NOT TALK TO CUSTOMERS DIRECTLY. Your job is routing and data intelligence.

DATA READING CAPABILITIES:
- If the input references an email inbox → use readLatestEmails and readEmailBody to fetch full context.
- If the input references a spreadsheet or CRM → use readGoogleSheet or queryDatabase to pull the data.
- If phone numbers are present → note them for the slave agent to use.

AGENT ROUTING GUIDE:
- 'lead-concierge': Brand new inbound lead, no prior contact.
- 'lead-qualifier': Lead needs budget/service assessment.
- 'booking-agent': Ready to schedule an appointment.
- 'follow-up-agent': Lead has gone cold or quiet.
- 'voice-agent': Requires outbound phone call.
- 'receptionist-agent': Inbound phone call transcript to process.
- 'sms-concierge': Incoming SMS to handle.
- 'whatsapp-concierge': Incoming WhatsApp message.
- 'web-concierge': Website chat interaction.
- 'review-agent': Complaint or review request.
- 'cancellation-recovery-agent': Cancellation received.
- 'no-show-prevention-agent': Appointment reminder needed.
- 'reactivation-agent': Dormant contact to re-engage.
- 'revenue-recovery-agent': Missed revenue opportunity.

MANDATORY: Your LAST action MUST be calling the routingDecision tool.`,
      prompt: `RAW INCOMING DATA:\n\n${stringifiedInput}\n\nRead this data (fetching additional context if needed), identify the intent, and output your routing decision.`,
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
