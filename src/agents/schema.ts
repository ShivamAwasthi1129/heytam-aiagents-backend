import { z } from 'zod';

export const AgentDelegationEnum = z.enum([
  'lead-concierge',
  'lead-qualifier',
  'voice-agent',
  'receptionist-agent',
  'sms-concierge',
  'whatsapp-concierge',
  'web-concierge',
  'treatment-advisor',
  'booking-agent',
  'follow-up-agent',
  'no-show-prevention-agent',
  'cancellation-recovery-agent',
  'waitlist-agent',
  'reactivation-agent',
  'membership-agent',
  'upsell-agent',
  'rebooking-agent',
  'patient-concierge',
  'post-treatment-agent',
  'review-agent',
  'referral-agent',
  'campaign-agent',
  'lead-recovery-agent',
  'front-desk-copilot',
  'crm-agent',
  'emr-ehr-integration-agent',
  'revenue-recovery-agent',
  'growth-analyst',
  'integration-guardian',
  'none'
]);

export const HeavyDutyAgentSchema = z.object({
  chainOfThought: z.string().describe("The agent's internal reasoning about the user's input, intent, and what action to take next."),
  messageToUser: z.string().describe("The actual response message to send back to the user on behalf of the business."),
  capturedData: z.record(z.string(), z.any()).describe("Any structured data captured from the conversation (e.g. name, budget, preferred date, intent, issue)."),
  delegation: z.object({
    requiresHandoff: z.boolean().describe("True if this agent has finished its specific job and needs to pass the conversation to a different specialized agent."),
    targetAgent: AgentDelegationEnum.describe("The agent to hand off to if requiresHandoff is true. Otherwise 'none'."),
    handoffReason: z.string().optional().describe("Why the handoff is occurring.")
  }).describe("Delegation instructions for the master orchestrator to route the request.")
});

export type HeavyDutyAgentOutput = z.infer<typeof HeavyDutyAgentSchema>;

export interface AgentResult {
  agentName: string;
  agentRole: string;
  input: string;
  output: HeavyDutyAgentOutput | string; // Heavy duty object on success, string on error
  status: 'success' | 'error';
  timestamp: string;
}

