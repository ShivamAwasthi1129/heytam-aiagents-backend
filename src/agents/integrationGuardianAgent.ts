/**
 * AI Integration Guardian — Heavy-Duty with Real-World Tools
 * Monitor API health, detect failures in connected systems, and initiate safe recovery protocols.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const integrationGuardianAgentInfo = {
  id: 'integration-guardian',
  name: 'AI Integration Guardian',
  role: 'Integration Health',
  description: 'Monitor API health, detect failures in connected systems, and initiate safe recovery protocols.',
};

export async function runIntegrationGuardianAgent(
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
      system: `You are the ${integrationGuardianAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Monitor API health, detect failures in connected systems, and initiate safe recovery protocols.

TOOL USAGE GUIDANCE:
- Use readGoogleSheet and queryDatabase to check data freshness and identify sync failures.
- Report errors clearly so engineers can act.

DELEGATION RULES:
- Does not handle client conversations. Alerts staff via sendEmail in case of critical failures.

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
      agentName: integrationGuardianAgentInfo.name,
      agentRole: integrationGuardianAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: integrationGuardianAgentInfo.name,
      agentRole: integrationGuardianAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

