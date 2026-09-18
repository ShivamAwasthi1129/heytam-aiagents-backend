/**
 * AI Cancellation Recovery Agent — Heavy-Duty with Real-World Tools
 * Engage clients who cancel and find them another suitable appointment slot.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const cancellationRecoveryAgentInfo = {
  id: 'cancellation-recovery-agent',
  name: 'AI Cancellation Recovery Agent',
  role: 'Recover Cancellations',
  description: 'Engage clients who cancel and find them another suitable appointment slot.',
};

export async function runCancellationRecoveryAgent(
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
      system: `You are the ${cancellationRecoveryAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Engage clients who cancel and find them another suitable appointment slot.

TOOL USAGE GUIDANCE:
- Use cancelAppointment to remove the existing booking if confirmed.
- Use checkCalendarAvailability to find alternative slots.
- Use sendSms or sendEmail to propose alternatives.

DELEGATION RULES:
- If the client agrees to rebook, route to 'booking-agent'.
- If they want a refund/complaint, route to 'review-agent'.

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
      agentName: cancellationRecoveryAgentInfo.name,
      agentRole: cancellationRecoveryAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: cancellationRecoveryAgentInfo.name,
      agentRole: cancellationRecoveryAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

