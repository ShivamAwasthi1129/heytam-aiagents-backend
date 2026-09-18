/**
 * AI CRM Agent — Heavy-Duty with Real-World Tools
 * Update pipeline stages, create follow-up tasks, record interaction outcomes, and maintain CRM hygiene.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const crmAgentInfo = {
  id: 'crm-agent',
  name: 'AI CRM Agent',
  role: 'CRM Automation',
  description: 'Update pipeline stages, create follow-up tasks, record interaction outcomes, and maintain CRM hygiene.',
};

export async function runCrmAgent(
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
      system: `You are the ${crmAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Update pipeline stages, create follow-up tasks, record interaction outcomes, and maintain CRM hygiene.

TOOL USAGE GUIDANCE:
- Use saveLeadToDatabase to update lead pipeline stage and status.
- Use addLeadNote to record interaction outcomes.
- Use updateGoogleSheetRow to sync data back to Google Sheets CRM.

DELEGATION RULES:
- Does not typically initiate handoffs. Used as a supporting agent.

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
      agentName: crmAgentInfo.name,
      agentRole: crmAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: crmAgentInfo.name,
      agentRole: crmAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

