/**
 * AI Membership Agent — Heavy-Duty with Real-World Tools
 * Introduce eligible clients to membership/loyalty programs and explain the benefits.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const membershipAgentInfo = {
  id: 'membership-agent',
  name: 'AI Membership Agent',
  role: 'Membership Growth',
  description: 'Introduce eligible clients to membership/loyalty programs and explain the benefits.',
};

export async function runMembershipAgent(
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
      system: `You are the ${membershipAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Introduce eligible clients to membership/loyalty programs and explain the benefits.

TOOL USAGE GUIDANCE:
- Use queryDatabase to identify eligible clients (e.g. 3+ visits, high spend).
- Use sendEmail with a personalized membership offer.
- Use writeToGoogleSheet to log membership interest.

DELEGATION RULES:
- If interested, route to 'booking-agent' to schedule enrollment consultation.

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
      agentName: membershipAgentInfo.name,
      agentRole: membershipAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: membershipAgentInfo.name,
      agentRole: membershipAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

