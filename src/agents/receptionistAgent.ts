/**
 * AI Receptionist — Heavy-Duty with Real-World Tools
 * Handle incoming call transcriptions: answer FAQs, identify caller intent, and route appropriately.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const receptionistAgentInfo = {
  id: 'receptionist-agent',
  name: 'AI Receptionist',
  role: 'Inbound Call Handling',
  description: 'Handle incoming call transcriptions: answer FAQs, identify caller intent, and route appropriately.',
};

export async function runReceptionistAgent(
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
      system: `You are the ${receptionistAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Handle incoming call transcriptions: answer FAQs, identify caller intent, and route appropriately.

TOOL USAGE GUIDANCE:
- Use queryDatabase to look up the caller by phone number before responding.
- Use addLeadNote to record the interaction summary.
- If the caller wants to book, use checkCalendarAvailability before confirming.

DELEGATION RULES:
- Route booking requests to 'booking-agent'.
- Route complaints to 'review-agent'.

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
      agentName: receptionistAgentInfo.name,
      agentRole: receptionistAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: receptionistAgentInfo.name,
      agentRole: receptionistAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

