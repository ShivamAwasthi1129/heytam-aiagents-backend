/**
 * AI SMS Concierge — Heavy-Duty with Real-World Tools
 * Handle two-way SMS conversations for inquiries, follow-ups, and appointment booking.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const smsConciergeAgentInfo = {
  id: 'sms-concierge',
  name: 'AI SMS Concierge',
  role: 'Text Conversations',
  description: 'Handle two-way SMS conversations for inquiries, follow-ups, and appointment booking.',
};

export async function runSmsConciergeAgent(
  input: string,
  tenantContext: string = 'Generic Business',
  tenantKeys: TenantKeys = {}
) {
  const timestamp = new Date().toISOString();
  const tools = createAgentTools(tenantKeys);
  const model = tenantKeys.openaiApiKey
    ? createOpenAI({ apiKey: tenantKeys.openaiApiKey })(process.env.OPENAI_MODEL || 'gpt-4o-mini')
    : openai(process.env.OPENAI_MODEL || 'gpt-4o-mini');

  try {
    const result = await generateText({
      model,
      tools: tools as any,
      stopWhen: ({ stepCount }: any) => stepCount >= 6,
      system: `You are the ${smsConciergeAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Handle two-way SMS conversations for inquiries, follow-ups, and appointment booking.

TOOL USAGE GUIDANCE:
- Use sendSms to reply to the lead via SMS.
- Use saveLeadToDatabase to capture their data.
- Keep SMS replies under 160 characters when possible.

DELEGATION RULES:
- Route to 'booking-agent' when appointment intent is clear.
- Route to 'review-agent' if dissatisfied.

MANDATORY: Your LAST action MUST be calling the finalizeResponse tool with a complete structured output.`,
      prompt: `Input / context: ${input}\n\nAnalyze and take real action using available tools, then finalize your response.`,
    });

    // Extract finalizeResponse result from the last step in AI SDK v7
    let structured;
    const allSteps = result.steps || [];
    for (const step of allSteps.reverse()) {
      const finalToolResult = (step.toolResults || []).find((t: any) => t.toolName === 'finalizeResponse');
      if (finalToolResult) { structured = (finalToolResult as any)?.output ?? (finalToolResult as any)?.result; break; }
    }
    if (!structured) {
      structured = {
        chainOfThought: 'No structured output produced.',
        messageToUser: result.text,
        capturedData: {},
        requiresHandoff: false,
        targetAgent: 'none',
      };
    }

    return {
      agentName: smsConciergeAgentInfo.name,
      agentRole: smsConciergeAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: smsConciergeAgentInfo.name,
      agentRole: smsConciergeAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

