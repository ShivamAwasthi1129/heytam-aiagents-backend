/**
 * AI EMR/EHR Integration Agent — Heavy-Duty with Real-World Tools
 * Synchronize operational information between AI workflows and core EMR/EHR systems.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const emrEhrIntegrationAgentInfo = {
  id: 'emr-ehr-integration-agent',
  name: 'AI EMR/EHR Integration Agent',
  role: 'System Coordination',
  description: 'Synchronize operational information between AI workflows and core EMR/EHR systems.',
};

export async function runEmrEhrIntegrationAgent(
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
      system: `You are the ${emrEhrIntegrationAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Synchronize operational information between AI workflows and core EMR/EHR systems.

TOOL USAGE GUIDANCE:
- Use queryDatabase to pull data before syncing.
- Use saveLeadToDatabase or writeToGoogleSheet to write back synchronized records.
- Never expose sensitive clinical data — only handle operationally permitted fields.

DELEGATION RULES:
- Does not directly handle client conversations; used as a data-sync agent.

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
      agentName: emrEhrIntegrationAgentInfo.name,
      agentRole: emrEhrIntegrationAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: emrEhrIntegrationAgentInfo.name,
      agentRole: emrEhrIntegrationAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

