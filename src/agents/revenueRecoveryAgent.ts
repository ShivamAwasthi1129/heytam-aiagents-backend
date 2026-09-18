/**
 * AI Revenue Recovery Agent — Heavy-Duty with Real-World Tools
 * Identify missed appointments, abandoned inquiries, and lapsed memberships to recover lost revenue.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const revenueRecoveryAgentInfo = {
  id: 'revenue-recovery-agent',
  name: 'AI Revenue Recovery Agent',
  role: 'Revenue Opportunities',
  description: 'Identify missed appointments, abandoned inquiries, and lapsed memberships to recover lost revenue.',
};

export async function runRevenueRecoveryAgent(
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
      system: `You are the ${revenueRecoveryAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Identify missed appointments, abandoned inquiries, and lapsed memberships to recover lost revenue.

TOOL USAGE GUIDANCE:
- Use queryDatabase to find leads/clients with status "no-show", "abandoned", or "lapsed".
- Use sendSms or sendEmail with recovery offers.
- Use addLeadNote to track recovery efforts.

DELEGATION RULES:
- If interested, route to 'booking-agent' for immediate scheduling.

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
      agentName: revenueRecoveryAgentInfo.name,
      agentRole: revenueRecoveryAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: revenueRecoveryAgentInfo.name,
      agentRole: revenueRecoveryAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

