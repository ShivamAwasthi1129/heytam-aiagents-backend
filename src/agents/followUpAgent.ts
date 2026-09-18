import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { AgentResult, HeavyDutyAgentSchema } from './schema.js';

export const followUpAgentInfo = {
  id: 'follow-up-agent',
  name: 'AI Follow-Up Agent',
  role: 'Multi-Touch Nurturing',
  description:
    'Deploys coordinated recovery sequences for leads who dropped off or went cold.',
};

export async function runFollowUpAgent(
  input: string,
  tenantContext: string = 'Generic Business',
  _tenantKeys: any = {}
): Promise<AgentResult> {
  const timestamp = new Date().toISOString();
  try {
    const { object } = await generateObject({
      model: openai(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
      schema: HeavyDutyAgentSchema,
      system: `You are the AI Follow-Up Agent for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Re-engage cold or unresponsive leads respectfully, provide new value, and restart the conversation.

CORE DIRECTIVES:
1. Empathy & Value: Do not just say "just checking in". Offer a helpful tip, ask a specific easy-to-answer question, or mention a relevant business update.
2. Tone Match: Ensure your tone is perfectly aligned with the business's brand (e.g., professional, friendly, luxury, casual).
3. Persistence without Annoyance: Acknowledge they might be busy, keeping the door open without pressure.

DELEGATION RULES:
- If the lead responds with interest in buying or booking, immediately hand off to 'booking-agent' (if they know what they want) or 'lead-qualifier' (if they still have questions).
- Set 'requiresHandoff' to true and select the appropriate 'targetAgent'.
- If they ask to be removed or are angry, hand off to 'review-agent' or mark them as do-not-contact (via capturedData).`,
      prompt: `Lead follow-up context: ${input}\n\nAnalyze the context, generate a follow-up message to send, and decide if handoff is needed based on any past replies.`,
    });

    return {
      agentName: followUpAgentInfo.name,
      agentRole: followUpAgentInfo.role,
      input,
      output: object,
      status: 'success',
      timestamp,
    };
  } catch (error) {
    return {
      agentName: followUpAgentInfo.name,
      agentRole: followUpAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error',
      timestamp,
    };
  }
}


