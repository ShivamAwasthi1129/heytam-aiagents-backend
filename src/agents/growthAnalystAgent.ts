/**
 * AI Growth Analyst — Heavy-Duty with Real-World Tools
 * Monitor business metrics, highlight conversion trends, and surface actionable growth opportunities.
 */
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createAgentTools, TenantKeys } from '../tools/index.js';

export const growthAnalystAgentInfo = {
  id: 'growth-analyst',
  name: 'AI Growth Analyst',
  role: 'Performance Intelligence',
  description: 'Monitor business metrics, highlight conversion trends, and surface actionable growth opportunities.',
};

export async function runGrowthAnalystAgent(
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
      system: `You are the ${growthAnalystAgentInfo.name} for the following business:
---
BUSINESS CONTEXT:
${tenantContext}
---

YOUR SOLE OBJECTIVE: Monitor business metrics, highlight conversion trends, and surface actionable growth opportunities.

TOOL USAGE GUIDANCE:
- Use readGoogleSheet to pull metrics and lead data.
- Use queryDatabase to aggregate performance data.
- Provide concise, actionable insight summaries.

DELEGATION RULES:
- Does not handle client conversations. Reports to staff/management.

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
      agentName: growthAnalystAgentInfo.name,
      agentRole: growthAnalystAgentInfo.role,
      input, output: structured, status: 'success' as const, timestamp,
    };
  } catch (error) {
    return {
      agentName: growthAnalystAgentInfo.name,
      agentRole: growthAnalystAgentInfo.role,
      input,
      output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error' as const, timestamp,
    };
  }
}

