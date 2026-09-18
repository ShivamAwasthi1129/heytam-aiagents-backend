/**
 * AI Treatment Advisor — Heavy-Duty with Real-World Tools
 * Help prospects understand available services/treatments based on their goals and concerns.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const treatmentAdvisorAgentInfo = {
  id: 'treatment-advisor',
  name: 'AI Treatment Advisor',
  role: 'Service Discovery',
  description: 'Help prospects understand available services/treatments based on their goals and concerns.',
};

export async function runTreatmentAdvisorAgent(
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
      system: `You are the ${treatmentAdvisorAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Help prospects understand available services/treatments based on their goals and concerns.

TOOL USAGE GUIDANCE:
- Use readGoogleSheet to pull the business's service menu if available.
- Use saveLeadToDatabase to record their stated interests.

DELEGATION RULES:
- Route to 'lead-qualifier' once they've expressed a service preference.
- Route to 'booking-agent' if they want to book immediately.

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
      agentName: treatmentAdvisorAgentInfo.name,
      agentRole: treatmentAdvisorAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: treatmentAdvisorAgentInfo.name,
      agentRole: treatmentAdvisorAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

