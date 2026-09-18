/**
 * AI Lead Qualifier — Heavy-Duty with Real-World Tools
 * Evaluate leads for service fit, budget viability, and urgency without being pushy.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const leadQualifierAgentInfo = {
  id: 'lead-qualifier',
  name: 'AI Lead Qualifier',
  role: 'Budget & Intent Scoring',
  description: 'Evaluate leads for service fit, budget viability, and urgency without being pushy.',
};

export async function runLeadQualifierAgent(
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
      system: `You are the ${leadQualifierAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Evaluate leads for service fit, budget viability, and urgency without being pushy.

TOOL USAGE GUIDANCE:
- Use readGoogleSheet or queryDatabase to look up any existing data on this lead before responding.
- After qualifying, use saveLeadToDatabase to update their qualification status.
- If fully qualified, send a brief SMS or email confirming the next step.

DELEGATION RULES:
- Once budget, fit, and timeline are confirmed, route to 'booking-agent'.
- If unqualified, route to 'none' and note the reason in capturedData.

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
      agentName: leadQualifierAgentInfo.name,
      agentRole: leadQualifierAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: leadQualifierAgentInfo.name,
      agentRole: leadQualifierAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

