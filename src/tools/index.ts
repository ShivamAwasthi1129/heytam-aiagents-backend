/**
 * Tools Index - Master Tool Registry
 * Exports createAgentTools() which assembles ALL real-world tools per tenant.
 * Each tenant provides their own API keys per request - nothing is stored server-side.
 */
import { createCommunicationTools, TenantCommunicationKeys } from './communication.tools.js';
import { createCalendarTools, TenantCalendarKeys } from './calendar.tools.js';
import { createCrmTools, TenantCrmKeys } from './crm.tools.js';
import { createInboxTools, TenantInboxKeys } from './inbox.tools.js';
import { z } from 'zod';
import { defineTool } from './tool-helper.js';

// The full aggregated interface for all tenant keys
export interface TenantKeys extends TenantCommunicationKeys, TenantCalendarKeys, TenantCrmKeys, TenantInboxKeys {
  openaiApiKey?: string;
}

// All valid agent IDs for delegation
export const ALL_AGENT_IDS = [
  'lead-concierge', 'lead-qualifier', 'voice-agent', 'receptionist-agent',
  'sms-concierge', 'whatsapp-concierge', 'web-concierge', 'treatment-advisor',
  'booking-agent', 'follow-up-agent', 'no-show-prevention-agent',
  'cancellation-recovery-agent', 'waitlist-agent', 'reactivation-agent',
  'membership-agent', 'upsell-agent', 'rebooking-agent', 'patient-concierge',
  'post-treatment-agent', 'review-agent', 'referral-agent', 'campaign-agent',
  'lead-recovery-agent', 'front-desk-copilot', 'crm-agent',
  'emr-ehr-integration-agent', 'revenue-recovery-agent', 'growth-analyst',
  'integration-guardian', 'none'
] as const;

export type AgentId = typeof ALL_AGENT_IDS[number];

/**
 * finalizeResponse — MUST be the last tool call the agent makes.
 * Delivers structured JSON output to the route handler.
 */
export const finalizeResponseTool = defineTool({
  description: 'ALWAYS call this as your FINAL action to deliver your structured response back to the system. Never end a turn without calling this tool.',
  parameters: z.object({
    chainOfThought: z.string().describe("Your internal step-by-step reasoning about the user's intent and what actions you took."),
    messageToUser: z.string().describe('The final natural language response to send back to the user or lead.'),
    capturedData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])).describe('Any structured data captured during this session.'),
    requiresHandoff: z.boolean().describe('True if this specific task is now complete and another specialized agent must continue.'),
    targetAgent: z.enum(ALL_AGENT_IDS).describe("The next agent to delegate to, or 'none' if done."),
    handoffReason: z.string().describe("Explain why a handoff is occurring, or 'N/A' if none."),
    actionsExecuted: z.array(z.string()).describe('List of real-world actions taken (or empty array if none).'),
  }),
  execute: async (args) => args, // Route handler intercepts this as the final structured output
});

/**
 * Assemble the complete tool registry for a given tenant.
 * Pass the returned object directly into generateText({ tools }).
 */
export function createAgentTools(tenantKeys: TenantKeys) {
  return {
    ...createCommunicationTools(tenantKeys),
    ...createCalendarTools(tenantKeys),
    ...createCrmTools(tenantKeys),
    ...createInboxTools(tenantKeys),
    finalizeResponse: finalizeResponseTool,
  };
}

export type AgentTools = ReturnType<typeof createAgentTools>;
