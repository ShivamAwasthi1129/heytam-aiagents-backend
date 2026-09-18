/**
 * AI Post-Treatment Agent — Heavy-Duty with Real-World Tools
 * Send personalized post-service follow-ups and check on client satisfaction.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const postTreatmentAgentInfo = {
  id: 'post-treatment-agent',
  name: 'AI Post-Treatment Agent',
  role: 'Aftercare Communication',
  description: 'Send personalized post-service follow-ups and check on client satisfaction.',
};

export async function runPostTreatmentAgent(
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
      system: `You are the ${postTreatmentAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Send personalized post-service follow-ups and check on client satisfaction.

TOOL USAGE GUIDANCE:
- Use queryDatabase to find clients whose appointments were earlier today.
- Use sendSms with a warm check-in message.
- Use addLeadNote to log the post-treatment outreach.

DELEGATION RULES:
- If satisfied, route to 'review-agent' to request a review.
- If unsatisfied, route to 'review-agent' for service recovery.

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
      agentName: postTreatmentAgentInfo.name,
      agentRole: postTreatmentAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: postTreatmentAgentInfo.name,
      agentRole: postTreatmentAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

