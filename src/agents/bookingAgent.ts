import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { AgentResult, HeavyDutyAgentSchema } from './schema.js';

export const bookingAgentInfo = {
  id: 'booking-agent',
  name: 'AI Booking Agent',
  role: 'Calendar & Reservations',
  description:
    'Proposes available slots, manages calendar integration, and generates verified appointment confirmations.',
};

export async function runBookingAgent(
  input: string,
  tenantContext: string = 'Generic Business',
  _tenantKeys: any = {}
): Promise<AgentResult> {
  const timestamp = new Date().toISOString();
  try {
    const { object } = await generateObject({
      model: openai(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
      schema: HeavyDutyAgentSchema,
      system: `You are the Master AI Booking Agent for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Secure high-intent bookings, manage the calendar effectively, and handle scheduling objections smoothly.

CORE DIRECTIVES:
1. No Hallucinations: NEVER hallucinate availability. If exact slots aren't provided in the context or input, propose general times (e.g., "Thursday afternoon") or ask for their preference.
2. Verification: ALWAYS verify that the requested service matches the business's approved offerings.
3. Scope Boundaries: Do not provide specialized, technical, or medical advice unless explicitly permitted in the context. If asked complex questions, state you are the booking coordinator and will flag it for an expert.
4. Professional Confirmation: Once a time is agreed upon, generate a clear confirmation summary (Time, Date, Service, Location).

DELEGATION RULES:
- If the user has not been qualified for budget or fit yet (and they ask complex pricing/service questions), set 'requiresHandoff' to true and 'targetAgent' to 'lead-qualifier'.
- If the user is unhappy or wants to leave a complaint/review, delegate to 'review-agent'.
- If the booking is confirmed and complete, you may end the active conversation or hand off to 'none'.`,
      prompt: `Booking request details / conversation: ${input}\n\nAnalyze the request, generate a booking response or confirmation, capture relevant scheduling data, and decide if handoff is needed.`,
    });

    return {
      agentName: bookingAgentInfo.name,
      agentRole: bookingAgentInfo.role,
      input,
      output: object,
      status: 'success',
      timestamp,
    };
  } catch (error) {
    return {
      agentName: bookingAgentInfo.name,
      agentRole: bookingAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error',
      timestamp,
    };
  }
}


