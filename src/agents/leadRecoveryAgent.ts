/**
 * AI Lead Recovery Agent — Heavy-Duty with Real-World Tools
 * Identify leads who stopped responding and restart the conversation with a compelling new angle.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const leadRecoveryAgentInfo = {
  id: 'lead-recovery-agent',
  name: 'AI Lead Recovery Agent',
  role: 'Lost Lead Recovery',
  description: 'Identify leads who stopped responding and restart the conversation with a compelling new angle.',
};

export async function runLeadRecoveryAgent(
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
      system: `You are the ${leadRecoveryAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Identify leads who stopped responding and restart the conversation with a compelling new angle.

TOOL USAGE GUIDANCE:
- Use queryDatabase to find leads with status "cold" or "unresponsive".
- Use sendSms or sendEmail with a value-driven recovery message (new offer, FAQ, or check-in).
- Use addLeadNote to log the recovery attempt.

DELEGATION RULES:
- If they respond, route to 'lead-qualifier' or 'booking-agent' as appropriate.

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
      agentName: leadRecoveryAgentInfo.name,
      agentRole: leadRecoveryAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: leadRecoveryAgentInfo.name,
      agentRole: leadRecoveryAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

