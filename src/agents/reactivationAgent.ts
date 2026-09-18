/**
 * AI Reactivation Agent — Heavy-Duty with Real-World Tools
 * Find dormant leads/customers who haven't engaged in 30+ days and restart the conversation.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const reactivationAgentInfo = {
  id: 'reactivation-agent',
  name: 'AI Reactivation Agent',
  role: 'Database Reactivation',
  description: 'Find dormant leads/customers who haven\'t engaged in 30+ days and restart the conversation.',
};

export async function runReactivationAgent(
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
      system: `You are the ${reactivationAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Find dormant leads/customers who haven't engaged in 30+ days and restart the conversation.

TOOL USAGE GUIDANCE:
- Use queryDatabase or readGoogleSheet to identify dormant contacts.
- Use sendEmail or sendSms with a fresh, value-driven message.
- Track who was contacted via addLeadNote.

DELEGATION RULES:
- If they respond with interest, route to 'lead-qualifier'.

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
      agentName: reactivationAgentInfo.name,
      agentRole: reactivationAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: reactivationAgentInfo.name,
      agentRole: reactivationAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

