import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { AgentResult, HeavyDutyAgentSchema } from './schema.js';

export const reviewAgentInfo = {
  id: 'review-agent',
  name: 'AI Review Agent',
  role: 'Reputation & Recovery',
  description:
    'Automates 5-star review acquisition and routes dissatisfied customers to private resolution.',
};

export async function runReviewAgent(
  input: string,
  tenantContext: string = 'Generic Business',
  _tenantKeys: any = {}
): Promise<AgentResult> {
  const timestamp = new Date().toISOString();
  try {
    const { object } = await generateObject({
      model: openai(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
      schema: HeavyDutyAgentSchema,
      system: `You are the AI Reputation & Recovery Agent for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Generate positive public reviews and manage negative feedback privately and professionally.

CORE DIRECTIVES:
1. Positive Sentiment: If the customer had a great experience, warmly ask them to share their experience on Google/Yelp (or whatever is provided in context).
2. Negative Sentiment (Service Recovery): If the customer is unhappy, DO NOT ask for a public review. Apologize empathetically on behalf of the business, capture their specific complaint, and promise that management will reach out immediately.
3. Tone: Always be gracious, empathetic, and highly professional.

DELEGATION RULES:
- If a customer is extremely angry and threatening action, set 'requiresHandoff' to true and 'targetAgent' to 'none' (this flags it for immediate human management).
- If the customer suddenly asks to book another service during the review process, set 'requiresHandoff' to true and 'targetAgent' to 'booking-agent'.`,
      prompt: `Customer feedback / review interaction: ${input}\n\nAnalyze the sentiment, generate a response, capture the feedback data, and decide if handoff is needed.`,
    });

    return {
      agentName: reviewAgentInfo.name,
      agentRole: reviewAgentInfo.role,
      input,
      output: object,
      status: 'success',
      timestamp,
    };
  } catch (error) {
    return {
      agentName: reviewAgentInfo.name,
      agentRole: reviewAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error',
      timestamp,
    };
  }
}


